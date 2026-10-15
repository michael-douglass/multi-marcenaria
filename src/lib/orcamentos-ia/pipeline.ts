import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import { isNetworkFailure } from '@/lib/network-error'
import { supabase } from '@/lib/supabase'
import {
  convertPdfPagesToJpegSequential,
  resizeImageToOrcamentosJpeg,
} from '@/lib/pdf-to-image'
import {
  assertBatchPagePaths,
  convertSelectedPdfPagesToJpeg,
  normalizeSelectedPages,
  pageNumbersFromTotals,
} from '@/lib/orcamentos-ia/pdf-processor'
import {
  DEFAULT_EXTRACTION_MODEL,
  isExtractionModelKey,
  ORCAMENTOS_IA_MODELS,
  type ExtractionModelKey,
} from '@/lib/orcamentos-ia/openai-models'
import {
  ORCAMENTOS_IA_BUCKET,
  appendThoughtLog,
  buildQuoteProjectPagePath,
  CANCELLED_BY_USER_MESSAGE,
  createOrcamentosIaSignedUrl,
  downloadOrcamentosIaObject,
  isQuoteAnalysisCancelled,
  isReadyForClientPricing,
  thoughtKindForStage,
  type QuoteAnalysisMode,
  type QuoteAnalysisStatus,
} from '@/lib/orcamentos-ia/storage'
import {
  normalizeModuleTypology,
  quoteExtractionSchema,
  type QuoteExtraction,
} from '@/lib/orcamentos-ia/schemas'
import {
  barsOf3mFromMeters,
  calculateQuotePricing,
  CONTINGENCY_PRICE_WARNING,
  createPriceResolver,
  DEFAULT_PRICING_PARAMS,
  endCapsForHandleBars,
  normalizePricingModality,
  repriceZeroMaterials,
  type PricingParams,
  type ResolvedMaterialPrice,
} from '@/lib/orcamentos-ia/pricing'
import {
  listQuotePagePaths,
  loadQuoteAnalysisTree,
} from '@/lib/orcamentos-ia/quote-tree'
import {
  buildScopedCoverageReport,
  filterExtractionToSelectedPages,
  scopeInventoryToSelectedPages,
  shouldBlockOnCoverageMissing,
  type CoverageScope,
} from '@/lib/orcamentos-ia/audit'
import {
  applyAntiHallucinationHeuristics,
  buildCoverageReport,
  buildPageImagePath,
  clampGeometryBounds,
  countBillableModules,
  ensureModulePlaceholder,
  expandInventoryFromExtraction,
  findMarcenariaBomGaps,
  forceDeduplicateViewQuantities,
  ensureExtractionHasEnvironments,
  injectMissingInventoryModules,
  mergeExtractions,
  modulesMatchCoverage,
  pageFromBoundingBox,
  sanitizeInventory,
  validatePlausibleQuantities,
  type CoverageReport,
  type InventoryEnv,
} from '@/lib/orcamentos-ia/merge-extraction'
import { rebalanceEnvironments } from '@/lib/orcamentos-ia/rebalance'
import {
  applyDualMaterialBoxDefaults,
  evaluateCircuitBreaker,
} from '@/lib/orcamentos-ia/circuit-breaker'
import {
  formatMemoriesForPrompt,
  getCompanyMemories,
} from '@/lib/orcamentos-ia/memory'
import {
  DEFAULT_COMPANY_STANDARDS,
  formatPreferencesForPrompt,
  getSystemPreferences,
} from '@/lib/orcamentos-ia/system-preferences'
import {
  clearBomItemsForProject,
  explodeModuleForPersist,
  insertBomItems,
  validateBomLines,
} from '@/lib/orcamentos-ia/bom-persist'
import { consolidateExtractionForPricing } from '@/lib/orcamentos-ia/bom-consolidate'
import { refreshQuoteProjectFolderSnapshot } from '@/lib/orcamentos-ia/project-folder-merge'
import { formatPageRanges } from '@/lib/orcamentos-ia/page-ranges'
import {
  CUTTING_LIST_TAG,
  isCuttingListNote,
  pieceAreaM2,
  sheetPurchaseNotes,
  sheetsForModuleArea,
  sheetUnitPrice,
} from '@/lib/orcamentos-ia/module-sheet-pricing'

/**
 * Pipeline multi-agente (Fase 3).
 * - Orquestração: LangGraph no cliente (status + páginas + persistência).
 * - Visão/extração/auditoria: Edge Function `orcamentos-ia-pipeline`
 *   (modo max = Claude Opus estrito na Edge, sem fallback gpt-4o;
 *   modo pro = OpenAI gpt-4o / o3-mini; chaves só no servidor).
 * - Preços: `createPriceResolver` (alias → inventory → market → contingência; nunca R$ 0).
 */

/** Anti-504 async: até 300 páginas (cadeia Edge 1 página/request). */
const MAX_PIPELINE_PAGES = 300

/** Poll da cadeia async (Edge) até ready_for_pricing / failed. */
const ASYNC_CHAIN_POLL_MS = 2500
const ASYNC_CHAIN_STALL_MS = 12 * 60 * 1000

async function assertNotCancelled(analysisId: string): Promise<void> {
  const { data } = await supabase
    .from('quote_analyses')
    .select('status, error_message, totals')
    .eq('id', analysisId)
    .maybeSingle()
  if (
    isQuoteAnalysisCancelled({
      status: data?.status,
      error_message: data?.error_message,
      totals:
        data?.totals && typeof data.totals === 'object'
          ? (data.totals as Record<string, unknown>)
          : null,
    })
  ) {
    throw new Error(CANCELLED_BY_USER_MESSAGE)
  }
}

async function setAnalysisStatus(
  analysisId: string,
  status: QuoteAnalysisStatus,
  extra?: {
    error_message?: string | null
    totals?: Record<string, unknown>
    pipeline_stage?: string
    pipeline_detail?: string | null
    thought_kind?: 'info' | 'vision' | 'audit' | 'price' | 'warn' | 'done'
    /** Se false, não grava linha no thought_log (evita spam em progresso de página). */
    thought?: boolean
    pricing_modality?: string | null
    pricing_params?: Record<string, unknown> | null
  },
) {
  let totalsPatch = extra?.totals
  const shouldTouchTotals =
    !!extra?.pipeline_stage ||
    extra?.pipeline_detail !== undefined ||
    !!extra?.totals ||
    extra?.thought === true

  if (shouldTouchTotals) {
    const { data: current } = await supabase
      .from('quote_analyses')
      .select('status, error_message, totals')
      .eq('id', analysisId)
      .maybeSingle()
    const prev =
      current?.totals && typeof current.totals === 'object'
        ? (current.totals as Record<string, unknown>)
        : {}
    // Não “ressuscitar” job interrompido pelo usuário (ticks/cliente atrasados).
    if (
      isQuoteAnalysisCancelled({
        status: current?.status,
        error_message: current?.error_message,
        totals: prev,
      }) &&
      status !== 'FAILED' &&
      status !== 'COMPLETED' &&
      status !== 'NEEDS_REVIEW'
    ) {
      return
    }

    const stage =
      extra?.pipeline_stage ||
      (typeof prev.pipeline_stage === 'string' ? prev.pipeline_stage : 'upload')
    const detail =
      extra?.pipeline_detail !== undefined
        ? extra.pipeline_detail
        : typeof prev.pipeline_detail === 'string'
          ? prev.pipeline_detail
          : null

    let thought_log = Array.isArray(prev.thought_log) ? prev.thought_log : []
    const shouldAppendThought =
      extra?.thought !== false &&
      (extra?.pipeline_detail !== undefined || extra?.thought === true) &&
      detail &&
      String(detail).trim()
    if (shouldAppendThought) {
      thought_log = appendThoughtLog(prev, {
        stage,
        kind: extra?.thought_kind || thoughtKindForStage(stage),
        message: String(detail).trim(),
      })
    }

    totalsPatch = {
      ...prev,
      ...(extra?.totals || {}),
      ...(extra?.pipeline_stage ? { pipeline_stage: extra.pipeline_stage } : {}),
      ...(extra?.pipeline_detail !== undefined ? { pipeline_detail: extra.pipeline_detail } : {}),
      thought_log,
      pipeline_updated_at: new Date().toISOString(),
    }
  }

  const { error } = await supabase
    .from('quote_analyses')
    .update({
      status,
      updated_at: new Date().toISOString(),
      ...(extra?.error_message !== undefined ? { error_message: extra.error_message } : {}),
      ...(totalsPatch ? { totals: totalsPatch } : {}),
      ...(extra?.pricing_modality !== undefined
        ? { pricing_modality: extra.pricing_modality }
        : {}),
      ...(extra?.pricing_params !== undefined ? { pricing_params: extra.pricing_params } : {}),
    })
    .eq('id', analysisId)
  if (error) throw new Error(error.message)
}

const PipelineState = Annotation.Root({
  analysisId: Annotation<string>,
  companyId: Annotation<string>,
  mode: Annotation<QuoteAnalysisMode>,
  /** Chave UI do modelo de visão (sonnet / opus / gpt-4o). */
  extractionModel: Annotation<ExtractionModelKey>({
    reducer: (_a, b) => b,
    default: () => DEFAULT_EXTRACTION_MODEL,
  }),
  /** PDF e/ou imagens de origem. */
  sourceFiles: Annotation<File[]>({
    reducer: (_a, b) => b,
    default: () => [],
  }),
  /** @deprecated use sourceFiles — mantido para compat */
  pdfFile: Annotation<File | null>({
    reducer: (_a, b) => b,
    default: () => null,
  }),
  pagePaths: Annotation<string[]>({
    reducer: (_a, b) => b,
    default: () => [],
  }),
  /** Páginas absolutas do PDF neste lote (1-based). Vazio = todas convertidas. */
  pageNumbers: Annotation<number[]>({
    reducer: (_a, b) => b,
    default: () => [],
  }),
  /** Pasta quote_projects — storage compartilhado de páginas. */
  projectId: Annotation<string | null>({
    reducer: (_a, b) => b,
    default: () => null,
  }),
  extraction: Annotation<QuoteExtraction | null>({
    reducer: (_a, b) => b,
    default: () => null,
  }),
  materialsSaved: Annotation<number>({
    reducer: (_a, b) => b,
    default: () => 0,
  }),
  error: Annotation<string | null>({
    reducer: (_a, b) => b,
    default: () => null,
  }),
  /** Checkpoint async: continuar da página N (0-based) sem zerar partial_extraction. */
  resumeFromPage: Annotation<number | null>({
    reducer: (_a, b) => b,
    default: () => null,
  }),
})

type PipelineStateType = typeof PipelineState.State

function priceNotes(price: ResolvedMaterialPrice, base?: string | null): string | null {
  const parts = [
    base?.trim() || null,
    price.warning,
    price.source === 'contingency' ? CONTINGENCY_PRICE_WARNING : null,
    price.source === 'contingency' ? `preço base: ${price.matchedName}` : null,
  ]
  const unique = [...new Set(parts.filter(Boolean))]
  return unique.length ? unique.join(' · ') : null
}

function assertPriced(price: ResolvedMaterialPrice, label: string): ResolvedMaterialPrice {
  if (!(price.unitPrice > 0)) {
    throw new Error(`Preço inválido (R$ 0) para “${label}” — contingência falhou.`)
  }
  return price
}

/** Material que não é chapa de madeira (pé metálico, vidro, espelho…). */
function isNonSheetMaterial(material: string): boolean {
  const n = material
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
  if (/\b(mdf|mdp|compensado|osb|madeira|laminado|chapa)\b/.test(n)) return false
  return /\b(metal|metalico|aco|ferro|inox|aluminio|vidro|espelho|acrilico)\b/.test(n)
}

function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

function isImageFile(file: File): boolean {
  const t = file.type.toLowerCase()
  const n = file.name.toLowerCase()
  return (
    t.startsWith('image/') ||
    n.endsWith('.png') ||
    n.endsWith('.jpg') ||
    n.endsWith('.jpeg') ||
    n.endsWith('.webp')
  )
}

function pageNumberFromStorageName(name: string): number | null {
  const m = name.match(/page-(\d+)\.(?:png|jpe?g|webp)$/i)
  if (!m) return null
  const n = Number(m[1])
  return Number.isInteger(n) && n > 0 ? n : null
}

/** Resolve path do PDF da pasta/análise (sem baixar os bytes). */
async function resolveProjectPdfStoragePath(params: {
  analysisId: string
  projectId: string | null
}): Promise<string> {
  const { data: analysis } = await supabase
    .from('quote_analyses')
    .select('source_pdf_path, project_id')
    .eq('id', params.analysisId)
    .maybeSingle()

  let path =
    typeof analysis?.source_pdf_path === 'string' && analysis.source_pdf_path.trim()
      ? analysis.source_pdf_path.trim()
      : null

  const projectId =
    params.projectId ||
    (typeof analysis?.project_id === 'string' ? analysis.project_id : null)

  if (!path && projectId) {
    const { data: project } = await supabase
      .from('quote_projects')
      .select('pdf_url')
      .eq('id', projectId)
      .maybeSingle()
    if (typeof project?.pdf_url === 'string' && project.pdf_url.trim()) {
      path = project.pdf_url.trim()
    }
  }

  if (!path) {
    throw new Error(
      'PDF da pasta não encontrado. Envie o arquivo uma vez em “Novo orçamento” ou “Cotar mais páginas”.',
    )
  }
  return path
}

/**
 * URL assinada do PDF da pasta — pdf.js lê por faixas (não baixa 80 MB de uma vez).
 */
async function signProjectPdfUrl(params: {
  analysisId: string
  projectId: string | null
}): Promise<string> {
  const path = await resolveProjectPdfStoragePath(params)
  return createOrcamentosIaSignedUrl(path, 60 * 60)
}

/**
 * Fallback: baixa o PDF inteiro (só se a abertura por URL falhar).
 */
async function downloadProjectPdfAsFile(params: {
  analysisId: string
  projectId: string | null
}): Promise<File> {
  const path = await resolveProjectPdfStoragePath(params)
  const blob = await downloadOrcamentosIaObject(path)
  const fileName = path.split('/').pop() || 'projeto.pdf'
  return new File([blob], fileName, { type: 'application/pdf' })
}

async function nodeConvertPages(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  await setAnalysisStatus(state.analysisId, 'CONVERTING_PAGES', {
    pipeline_stage: 'converting_pages',
    pipeline_detail: 'Preparando as páginas do projeto para a IA enxergar o desenho…',
  })

  const projectId = state.projectId?.trim() || null

  // Reidrata page_ranges do lote quando o estado veio sem pageNumbers (retomar/reprocessar).
  let selectedPages = normalizeSelectedPages(state.pageNumbers)
  if (!selectedPages.length) {
    const { data: row } = await supabase
      .from('quote_analyses')
      .select('totals, project_id')
      .eq('id', state.analysisId)
      .maybeSingle()
    const totals =
      row?.totals && typeof row.totals === 'object'
        ? (row.totals as Record<string, unknown>)
        : null
    selectedPages = pageNumbersFromTotals(totals)
    const resolvedProject =
      projectId ||
      (typeof row?.project_id === 'string' && row.project_id.trim()
        ? row.project_id.trim()
        : null)
    // Pasta/lote incremental: proibido “todas as páginas” (gasto de tokens).
    if (resolvedProject && !selectedPages.length) {
      throw new Error(
        'Este lote da pasta não tem páginas selecionadas (page_ranges). Escolha as páginas na grade e inicie de novo — não enviaremos o PDF inteiro à IA.',
      )
    }
  }

  const resolvedProjectId =
    projectId ||
    (
      await supabase
        .from('quote_analyses')
        .select('project_id')
        .eq('id', state.analysisId)
        .maybeSingle()
    ).data?.project_id?.trim() ||
    null

  // Pasta do projeto: JPEGs compartilhados entre lotes. Sem pasta: path clássico por análise.
  const pagesPrefix = resolvedProjectId
    ? `${state.companyId}/quote-projects/${resolvedProjectId}/pages`
    : `${state.companyId}/${state.analysisId}/pages`

  const { data: existing } = await supabase.storage
    .from(ORCAMENTOS_IA_BUCKET)
    .list(pagesPrefix, { limit: 300, sortBy: { column: 'name', order: 'asc' } })
  const existingByPage = new Map<number, string>()
  for (const o of existing || []) {
    if (!/\.(png|jpe?g|webp)$/i.test(o.name)) continue
    const n = pageNumberFromStorageName(o.name)
    if (n != null) existingByPage.set(n, `${pagesPrefix}/${o.name}`)
  }
  const existingPaths = [...existingByPage.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, path]) => path)

  let files: File[] =
    state.sourceFiles?.length > 0
      ? state.sourceFiles
      : state.pdfFile
        ? [state.pdfFile]
        : []

  const filterSelected = (paths: string[]): string[] => {
    if (!selectedPages.length) return paths.slice(0, MAX_PIPELINE_PAGES)
    return assertBatchPagePaths(paths, selectedPages).slice(0, MAX_PIPELINE_PAGES)
  }

  const missingSelected = selectedPages.length
    ? selectedPages.filter((p) => !existingByPage.has(p))
    : []

  /** PDF da pasta via URL assinada (range) — evita “Failed to fetch” em 80 MB. */
  let pdfSignedUrl: string | null = null

  // Incremental sem re-upload: assina URL do PDF se faltam JPEGs das páginas pedidas.
  if (
    !files.length &&
    (missingSelected.length > 0 || (existingPaths.length === 0 && selectedPages.length > 0))
  ) {
    const loteHint = selectedPages.length
      ? `lote págs. ${formatPageRanges(selectedPages)}`
      : 'páginas escolhidas'
    await setAnalysisStatus(state.analysisId, 'CONVERTING_PAGES', {
      pipeline_stage: 'converting_pages',
      pipeline_detail:
        missingSelected.length > 0 && selectedPages.length
          ? `Retomando ${loteHint}: abrindo o PDF da pasta (por faixas) para converter ${missingSelected.length} página(s) que faltam…`
          : `Abrindo o PDF da pasta (sem novo upload) para converter só as ${loteHint}…`,
      totals: selectedPages.length
        ? { page_ranges: selectedPages, selected_pages: selectedPages }
        : undefined,
    })
    pdfSignedUrl = await signProjectPdfUrl({
      analysisId: state.analysisId,
      projectId: resolvedProjectId,
    })
  }

  // Só reutiliza quando NÃO falta nenhuma página do lote (evita seguir com 2/19).
  if (
    existingPaths.length > 0 &&
    files.length === 0 &&
    !pdfSignedUrl &&
    missingSelected.length === 0
  ) {
    const pagePaths = filterSelected(existingPaths)
    if (!pagePaths.length) {
      throw new Error(
        selectedPages.length
          ? 'As páginas escolhidas ainda não foram convertidas nesta pasta.'
          : 'Nenhuma página pronta para reutilizar.',
      )
    }
    const strictPaths = selectedPages.length
      ? assertBatchPagePaths(pagePaths, selectedPages)
      : pagePaths
    await setAnalysisStatus(state.analysisId, 'CONVERTING_PAGES', {
      pipeline_stage: 'converting_pages',
      pipeline_detail: `Já tenho ${strictPaths.length} página(s) pronta(s) — reaproveitando sem converter de novo.`,
      totals: {
        pages_processed: strictPaths.length,
        page_paths: strictPaths,
        ...(selectedPages.length ? { page_ranges: selectedPages, selected_pages: selectedPages } : {}),
      },
    })
    return { pagePaths: strictPaths, pageNumbers: selectedPages }
  }

  if (!files.length && !pdfSignedUrl && existingPaths.length > 0 && missingSelected.length === 0) {
    const pagePaths = filterSelected(existingPaths)
    return {
      pagePaths: selectedPages.length
        ? assertBatchPagePaths(pagePaths, selectedPages)
        : pagePaths,
      pageNumbers: selectedPages,
    }
  }

  if (!files.length && !pdfSignedUrl) {
    throw new Error('Nenhum PDF ou imagem para converter.')
  }

  // Com seleção: PDF só converte páginas do lote (nunca o arquivo inteiro).
  if (selectedPages.length === 0 && files.some(isPdfFile)) {
    // Sem pasta e sem seleção explícita: limita ao teto, mas avisa.
    console.warn(
      '[orcamentos-ia] conversão sem page_ranges — usando teto MAX_PIPELINE_PAGES (fluxo legado sem pasta).',
    )
  }

  const pagePaths: string[] = []
  let pageIndex = 0

  const uploadConvertedPage = async (pageNumber: number, totalPages: number, blob: Blob) => {
    pageIndex += 1
    const path = resolvedProjectId
      ? buildQuoteProjectPagePath(state.companyId, resolvedProjectId, pageNumber)
      : `${state.companyId}/${state.analysisId}/pages/page-${String(pageNumber).padStart(3, '0')}.jpg`
    const { error } = await supabase.storage.from(ORCAMENTOS_IA_BUCKET).upload(path, blob, {
      contentType: 'image/jpeg',
      upsert: true,
      cacheControl: '3600',
    })
    if (error) throw new Error(`Falha ao enviar página ${pageNumber}: ${error.message}`)
    existingByPage.set(pageNumber, path)
    await setAnalysisStatus(state.analysisId, 'CONVERTING_PAGES', {
      pipeline_stage: 'converting_pages',
      pipeline_detail: `Transformando página ${pageNumber} de ${totalPages} do PDF em imagem…`,
      totals: {
        pages_processed: pageIndex,
        pages_total: totalPages,
        conversion_page: pageNumber,
        ...(selectedPages.length
          ? { page_ranges: selectedPages, selected_pages: selectedPages }
          : {}),
      },
      thought: pageIndex === 1 || pageIndex % 3 === 0 || pageNumber === totalPages,
    })
  }

  // Pasta/lote: abre PDF por URL assinada (range) — não baixa 80 MB na memória.
  if (pdfSignedUrl && selectedPages.length) {
    const needConvert = selectedPages
      .filter((p) => !existingByPage.has(p))
      .slice(0, MAX_PIPELINE_PAGES)
    if (needConvert.length) {
      await setAnalysisStatus(state.analysisId, 'CONVERTING_PAGES', {
        pipeline_stage: 'converting_pages',
        pipeline_detail: `Convertendo só as páginas ${needConvert.slice(0, 8).join(', ')}${
          needConvert.length > 8 ? '…' : ''
        } do PDF da pasta…`,
      })
      try {
        await convertSelectedPdfPagesToJpeg({
          url: pdfSignedUrl,
          pageNumbers: needConvert,
          maxPages: MAX_PIPELINE_PAGES,
          onPage: async ({ pageNumber, totalPages, blob }) => {
            await uploadConvertedPage(pageNumber, totalPages, blob)
          },
        })
      } catch {
        // Fallback: baixa o PDF inteiro e converte o que ainda falta.
        const stillNeed = needConvert.filter((p) => !existingByPage.has(p))
        if (stillNeed.length) {
          await setAnalysisStatus(state.analysisId, 'CONVERTING_PAGES', {
            pipeline_stage: 'converting_pages',
            pipeline_detail:
              'Abertura por faixas falhou — baixando o PDF completo da pasta para continuar…',
          })
          const pdfFile = await downloadProjectPdfAsFile({
            analysisId: state.analysisId,
            projectId: resolvedProjectId,
          })
          await convertSelectedPdfPagesToJpeg({
            data: await pdfFile.arrayBuffer(),
            pageNumbers: stillNeed,
            maxPages: MAX_PIPELINE_PAGES,
            onPage: async ({ pageNumber, totalPages, blob }) => {
              await uploadConvertedPage(pageNumber, totalPages, blob)
            },
          })
        }
      }
    }
    const ordered = selectedPages
    for (const n of ordered) {
      const path = existingByPage.get(n)
      if (path && pagePaths.length < MAX_PIPELINE_PAGES) pagePaths.push(path)
    }
  }

  for (const file of files) {
    if (pageIndex >= MAX_PIPELINE_PAGES) break

    if (isPdfFile(file)) {
      await setAnalysisStatus(state.analysisId, 'CONVERTING_PAGES', {
        pipeline_stage: 'converting_pages',
        pipeline_detail: selectedPages.length
          ? `Convertendo só as páginas ${selectedPages.slice(0, 8).join(', ')}${
              selectedPages.length > 8 ? '…' : ''
            } do PDF…`
          : `Abrindo o PDF “${file.name}” e transformando cada folha em imagem…`,
      })

      const needConvert = selectedPages.length
        ? selectedPages.filter((p) => !existingByPage.has(p)).slice(0, MAX_PIPELINE_PAGES)
        : Array.from({ length: MAX_PIPELINE_PAGES }, (_, i) => i + 1)

      if (selectedPages.length && !needConvert.length) {
        // Já todas no storage — monta pagePaths da seleção
      } else if (selectedPages.length) {
        await convertSelectedPdfPagesToJpeg({
          data: await file.arrayBuffer(),
          pageNumbers: needConvert,
          maxPages: MAX_PIPELINE_PAGES,
          onPage: async ({ pageNumber, totalPages, blob }) => {
            await uploadConvertedPage(pageNumber, totalPages, blob)
          },
        })
      } else {
        // Legado sem seleção (sem pasta): primeiras N páginas.
        await convertPdfPagesToJpegSequential(await file.arrayBuffer(), {
          maxPages: MAX_PIPELINE_PAGES,
          onPage: async ({ pageNumber, totalPages, blob }) => {
            await uploadConvertedPage(pageNumber, totalPages, blob)
          },
        })
      }

      const ordered = selectedPages.length
        ? selectedPages
        : [...existingByPage.keys()].sort((a, b) => a - b)
      for (const n of ordered) {
        const path = existingByPage.get(n)
        if (path && pagePaths.length < MAX_PIPELINE_PAGES) pagePaths.push(path)
      }
      continue
    }

    if (isImageFile(file)) {
      pageIndex += 1
      const jpegBlob = await resizeImageToOrcamentosJpeg(file)
      const path = resolvedProjectId
        ? buildQuoteProjectPagePath(state.companyId, resolvedProjectId, pageIndex)
        : `${state.companyId}/${state.analysisId}/pages/page-${String(pageIndex).padStart(3, '0')}.jpg`
      const { error } = await supabase.storage.from(ORCAMENTOS_IA_BUCKET).upload(path, jpegBlob, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '3600',
      })
      if (error) throw new Error(`Falha ao enviar imagem ${pageIndex}: ${error.message}`)
      if (!selectedPages.length || selectedPages.includes(pageIndex)) {
        pagePaths.push(path)
      }
      await setAnalysisStatus(state.analysisId, 'CONVERTING_PAGES', {
        pipeline_stage: 'converting_pages',
        pipeline_detail: `Recebendo a foto ${pageIndex}: ${file.name}`,
        totals: { pages_processed: pageIndex },
      })
      continue
    }

    throw new Error(`Tipo de arquivo não suportado: ${file.name}`)
  }

  if (!pagePaths.length) throw new Error('Nenhuma página gerada a partir dos arquivos.')

  const strictPaths = selectedPages.length
    ? assertBatchPagePaths(pagePaths, selectedPages)
    : pagePaths

  await setAnalysisStatus(state.analysisId, 'CONVERTING_PAGES', {
    pipeline_stage: 'converting_pages',
    pipeline_detail:
      strictPaths.length >= MAX_PIPELINE_PAGES
        ? `Processadas as primeiras ${MAX_PIPELINE_PAGES} páginas.`
        : `Pronto: ${strictPaths.length} página(s) para este lote.`,
    totals: {
      pages_processed: strictPaths.length,
      page_paths: strictPaths,
      ...(selectedPages.length
        ? { page_ranges: selectedPages, selected_pages: selectedPages }
        : {}),
      ...(strictPaths.length >= MAX_PIPELINE_PAGES
        ? {
            pages_cap: MAX_PIPELINE_PAGES,
            pages_warning: `Processadas as primeiras ${MAX_PIPELINE_PAGES} páginas.`,
          }
        : {}),
      source_files: files.map((f) => f.name),
    },
  })

  return { pagePaths: strictPaths, pageNumbers: selectedPages }
}

/**
 * Aguarda a cadeia Edge (1 página/request) gravar async_chain_status=ready_for_pricing.
 * Retorna partial_extraction + inventory do checkpoint.
 */
async function waitForAsyncChainReady(analysisId: string): Promise<{
  extraction: unknown
  inventory: InventoryEnv[]
}> {
  const started = Date.now()
  let lastUpdated = Date.now()
  let consecutiveNetworkMisses = 0
  /** Exige 2 polls seguidos em ready com a mesma contagem — evita corrida com tick de auditoria atrasado. */
  let readyStreak = 0
  let lastReadyMods: number | null = null

  while (true) {
    let data: {
      status?: string | null
      totals?: unknown
      error_message?: string | null
    } | null = null
    try {
      const res = await supabase
        .from('quote_analyses')
        .select('status, totals, error_message')
        .eq('id', analysisId)
        .maybeSingle()
      if (res.error) throw new Error(res.error.message)
      data = res.data
      consecutiveNetworkMisses = 0
    } catch (err) {
      // PDF grande: a Edge segue na nuvem; um "Failed to fetch" no poll do browser
      // não deve matar o job (falso FAILED). Re-tenta até estolar de verdade.
      consecutiveNetworkMisses += 1
      if (consecutiveNetworkMisses >= 8) {
        throw new Error(
          err instanceof Error && /failed to fetch|network|abort/i.test(err.message)
            ? 'A conexão caiu várias vezes ao acompanhar a leitura. A nuvem pode ainda estar processando — clique em Retomar.'
            : err instanceof Error
              ? err.message
              : 'Falha ao consultar o progresso da análise.',
        )
      }
      await new Promise((r) => setTimeout(r, ASYNC_CHAIN_POLL_MS))
      continue
    }

    const totals =
      data?.totals && typeof data.totals === 'object'
        ? (data.totals as Record<string, unknown>)
        : {}
    const chainStatus = typeof totals.async_chain_status === 'string' ? totals.async_chain_status : ''
    const updatedAt =
      typeof totals.pipeline_updated_at === 'string'
        ? Date.parse(totals.pipeline_updated_at)
        : NaN
    if (Number.isFinite(updatedAt)) lastUpdated = updatedAt

    if (
      chainStatus === 'cancelled' ||
      isQuoteAnalysisCancelled({
        status: data?.status,
        error_message: data?.error_message,
        totals,
      })
    ) {
      throw new Error(CANCELLED_BY_USER_MESSAGE)
    }

    // Só trata FAILED se a cadeia também parou — evita falso alarme quando o
    // cliente gravou FAILED por rede e o chain_tick da Edge já retomou o status.
    if (chainStatus === 'failed') {
      throw new Error(
        (typeof totals.pipeline_detail === 'string' && totals.pipeline_detail) ||
          data?.error_message ||
          'Cadeia async falhou. Clique em Retomar.',
      )
    }
    // Recuperável: Edge já deixou ready_for_pricing, mas o client falhou no schema
    // (ex.: environments []). Não derruba o poll — segue para injeção + precificação.
    const readyDespiteClientFail =
      data?.status === 'FAILED' &&
      (chainStatus === 'ready_for_pricing' || totals.pipeline_stage === 'pricing_pending')
    if (data?.status === 'FAILED' && chainStatus !== 'running' && !readyDespiteClientFail) {
      throw new Error(
        (typeof totals.pipeline_detail === 'string' && totals.pipeline_detail) ||
          data?.error_message ||
          'Cadeia async falhou. Clique em Retomar.',
      )
    }

    if (chainStatus === 'ready_for_pricing' || totals.pipeline_stage === 'pricing_pending') {
      const extraction =
        totals.partial_extraction && typeof totals.partial_extraction === 'object'
          ? totals.partial_extraction
          : { environments: [], auditor_notes: [], warnings: [] }
      const envCount = Array.isArray((extraction as { environments?: unknown }).environments)
        ? ((extraction as { environments: unknown[] }).environments).length
        : 0
      const auditedCount = Array.isArray(totals.audited_environments)
        ? totals.audited_environments.length
        : 0
      // Ainda há ambientes sem carimbo de auditoria → espera um pouco.
      // Depois de 90s em ready, segue mesmo assim (evita travar a UI para sempre).
      const readySinceMs = Number.isFinite(updatedAt)
        ? Date.now() - updatedAt
        : Date.now() - started
      if (envCount > 0 && auditedCount < envCount && readySinceMs < 90_000) {
        readyStreak = 0
        lastReadyMods = null
        await new Promise((r) => setTimeout(r, ASYNC_CHAIN_POLL_MS))
        continue
      }
      const mods = Number(totals.modules_found_count) || countBillableModules(extraction)
      if (lastReadyMods === mods) readyStreak += 1
      else {
        readyStreak = 1
        lastReadyMods = mods
      }
      if (readyStreak < 2) {
        await new Promise((r) => setTimeout(r, ASYNC_CHAIN_POLL_MS))
        continue
      }
      const inventory = expandInventoryFromExtraction(
        sanitizeInventory(
          Array.isArray(totals.inventory) ? (totals.inventory as InventoryEnv[]) : [],
        ),
        extraction,
      )
      return { extraction, inventory }
    }
    readyStreak = 0
    lastReadyMods = null

    if (Date.now() - lastUpdated > ASYNC_CHAIN_STALL_MS) {
      throw new Error(
        'A leitura async parou sem progresso. Clique em Retomar para continuar da última página.',
      )
    }
    if (Date.now() - started > 6 * 60 * 60 * 1000) {
      throw new Error('Tempo máximo da cadeia async excedido (6h). Clique em Retomar.')
    }

    await new Promise((r) => setTimeout(r, ASYNC_CHAIN_POLL_MS))
  }
}

async function invokeOrcamentosIaPhase(body: Record<string, unknown>): Promise<{
  ok?: boolean
  error?: string
  extraction?: unknown
  inventory?: InventoryEnv[]
  coverage?: CoverageReport
  bomGaps?: Array<{ environment: string; module: string; reason: string }>
  auditNeedsRerun?: boolean
  hallucinationScore?: number
  pagesProcessed?: number
}> {
  const { data, error } = await supabase.functions.invoke('orcamentos-ia-pipeline', { body })
  type PipelinePayload = {
    ok?: boolean
    error?: string
    extraction?: unknown
    inventory?: InventoryEnv[]
    coverage?: CoverageReport
    bomGaps?: Array<{ environment: string; module: string; reason: string }>
    auditNeedsRerun?: boolean
    hallucinationScore?: number
    pagesProcessed?: number
  }
  let payload = (data ?? null) as PipelinePayload | null

  // FunctionsHttpError: corpo JSON fica em error.context (não em data)
  if (error) {
    let bodyErr = typeof payload?.error === 'string' ? payload.error.trim() : ''
    if (!bodyErr) {
      try {
        const ctx = (error as { context?: Response }).context
        if (ctx && typeof ctx.json === 'function') {
          const cloned = typeof ctx.clone === 'function' ? ctx.clone() : ctx
          const parsed = (await cloned.json()) as PipelinePayload
          if (parsed && typeof parsed === 'object') {
            payload = parsed
            if (typeof parsed.error === 'string') bodyErr = parsed.error.trim()
          }
        } else if (ctx && typeof ctx.text === 'function') {
          const text = await ctx.text()
          const parsed = JSON.parse(text) as PipelinePayload
          if (typeof parsed?.error === 'string') {
            payload = parsed
            bodyErr = parsed.error.trim()
          }
        }
      } catch {
        /* ignore parse */
      }
    }
    const msg = bodyErr || error.message || 'Falha ao chamar o pipeline de IA.'
    // Só tratar como timeout se não houver erro explícito da Edge
    if (
      !bodyErr &&
      /non-2xx|504|502|timeout|timed out/i.test(error.message || '')
    ) {
      throw new Error(
        'A IA demorou demais nesta etapa (limite do servidor). Vou tentar de novo em etapas menores — clique em Retomar.',
      )
    }
    throw new Error(msg)
  }
  if (!payload?.ok) {
    throw new Error(payload?.error || 'Pipeline de IA retornou erro.')
  }
  return payload
}

async function nodeInvokeAgents(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  // Aba fechou depois da Edge: já tem partial_extraction + ready_for_pricing.
  // Não reinicia a leitura — só consolida e segue para precificação.
  const { data: checkpointRow } = await supabase
    .from('quote_analyses')
    .select('totals')
    .eq('id', state.analysisId)
    .maybeSingle()
  const checkpointTotals =
    checkpointRow?.totals && typeof checkpointRow.totals === 'object'
      ? (checkpointRow.totals as Record<string, unknown>)
      : null
  const skipAsyncRestart = isReadyForClientPricing(checkpointTotals)

  // Preferências sempre carregadas — usadas na consolidação mesmo no atalho de precificação.
  let invokePrefs = DEFAULT_COMPANY_STANDARDS(state.companyId)
  let prefsPrompt = ''
  try {
    invokePrefs = await getSystemPreferences(state.companyId)
    prefsPrompt = formatPreferencesForPrompt(invokePrefs)
  } catch {
    prefsPrompt = formatPreferencesForPrompt(invokePrefs)
  }

  if (!skipAsyncRestart) {
    await setAnalysisStatus(state.analysisId, 'READING_LAYOUT', {
      pipeline_stage: 'reading_inventory',
      pipeline_detail: 'Olhando a capa: vou listar ambientes e móveis prometidos no projeto…',
    })

    // RAG + preferências construtivas v11 injetadas no System Prompt do Extrator
    const { memories } = await getCompanyMemories({
      companyId: state.companyId,
      query:
        'regras construtivas, ferragens por unidade, puxadores perfil 3 metros, descontos de porta e correções de orçamento',
      matchThreshold: 0.65,
      matchCount: 12,
    })
    const ragPrompt = [
      'REGRA DE OURO — COMPANY STANDARDS: se o bloco abaixo trouxer valores salvos pelo marceneiro, eles prevalecem sobre qualquer default genérico do prompt estático.',
      prefsPrompt,
      formatMemoriesForPrompt(memories),
    ]
      .filter(Boolean)
      .join('\n\n')

    // Anti-504: Edge processa 1 página/request em cadeia (start_async <2s + waitUntil).
    const resumeFromPage =
      typeof state.resumeFromPage === 'number' && state.resumeFromPage > 0
        ? state.resumeFromPage
        : undefined

    await setAnalysisStatus(state.analysisId, 'EXTRACTING_MODULES', {
      pipeline_stage: 'extracting_batch',
      pipeline_detail: resumeFromPage
        ? `Retomando cadeia async na página ${resumeFromPage + 1}…`
        : `Disparando leitura async de ${state.pagePaths.length} página(s)…`,
      thought_kind: 'vision',
      totals: {
        total_pages: state.pagePaths.length,
        pages_processed: state.pagePaths.length,
      },
    })

    await invokeOrcamentosIaPhase({
      analysisId: state.analysisId,
      companyId: state.companyId,
      mode: state.mode,
      extraction_model: state.extractionModel,
      pagePaths: state.pagePaths,
      phase: 'start_async',
      resumeFromPage,
      ragMemoriesPrompt: ragPrompt,
      models: ORCAMENTOS_IA_MODELS,
    })
  } else {
    await setAnalysisStatus(state.analysisId, 'AUDITING_REVISION', {
      pipeline_stage: 'pricing_pending',
      pipeline_detail:
        'Leitura já pronta na nuvem — retomando consolidação e precificação (sem reler o PDF)…',
      thought_kind: 'audit',
      // isReadyForClientPricing exige async_chain ready — não deixar FAILED antigo bloquear.
      error_message: null,
      totals: {
        async_chain_status: 'ready_for_pricing',
        pipeline_stage: 'pricing_pending',
      },
    })
  }

  const asyncReady = await waitForAsyncChainReady(state.analysisId)
  await assertNotCancelled(state.analysisId)
  let inventory = expandInventoryFromExtraction(
    asyncReady.inventory,
    asyncReady.extraction,
  )
  // Rede de segurança: render/capa sem cotas → Edge devolve environments [].
  // Injeta stubs do inventário ANTES do schema (evita FAILED "Too small").
  let mergedRaw = forceDeduplicateViewQuantities(
    mergeExtractions([
      ensureExtractionHasEnvironments(asyncReady.extraction, inventory),
    ]),
  )

  const coerceModuleTypologies = (tree: unknown): unknown => {
    if (!tree || typeof tree !== 'object') return tree
    const root = tree as Record<string, unknown>
    const envs = Array.isArray(root.environments) ? root.environments : []
    const remapNotes: string[] = []
    const environments = envs.map((env) => {
      if (!env || typeof env !== 'object') return env
      const e = env as Record<string, unknown>
      const modules = Array.isArray(e.modules) ? e.modules : []
      return {
        ...e,
        modules: modules.map((mod) => {
          if (!mod || typeof mod !== 'object') return mod
          const m = { ...(mod as Record<string, unknown>) }
          const before = m.typology
          const after = normalizeModuleTypology(before) ?? (before != null && before !== '' ? 'outro' : undefined)
          if (before != null && before !== '' && after && String(before) !== after) {
            remapNotes.push(`Tipologia "${String(before)}" → "${after}"`)
          }
          if (after) m.typology = after
          else delete m.typology
          return m
        }),
      }
    })
    const warnings = Array.isArray(root.warnings) ? [...(root.warnings as string[])] : []
    if (remapNotes.length) {
      warnings.push(`Tipologias normalizadas: ${[...new Set(remapNotes)].slice(0, 8).join('; ')}`)
    }
    return { ...root, environments, warnings: [...new Set(warnings)] }
  }

  const finalizeExtractionTree = (raw: unknown): QuoteExtraction => {
    // Lock dormitório antes das heurísticas — evita Cozinha fantasma (Painel TV / Mesa cabeceira)
    const rebalanced = rebalanceEnvironments(raw, inventory)
    const merged = forceDeduplicateViewQuantities(mergeExtractions([rebalanced]))
    let sanitized = sanitizeExtractionPayload(
      clampGeometryBounds(applyAntiHallucinationHeuristics(merged)),
    )
    sanitized = coerceModuleTypologies(sanitized)
    let parsed = quoteExtractionSchema.safeParse(sanitized)
    if (!parsed.success) {
      sanitized = sanitizeExtractionPayload(
        clampGeometryBounds(applyAntiHallucinationHeuristics(sanitized)),
      )
      sanitized = coerceModuleTypologies(sanitized)
      parsed = quoteExtractionSchema.safeParse(sanitized)
    }
    if (!parsed.success) {
      sanitized = sanitizeExtractionPayload(stripNullOptionals(sanitized))
      sanitized = coerceModuleTypologies(sanitized)
      parsed = quoteExtractionSchema.safeParse(sanitized)
    }
    // Última chance: se só typology falhou (preprocess falhou em edge case), force outro
    if (!parsed.success) {
      const onlyTypology = parsed.error.issues.every((i) =>
        i.path.some((p) => p === 'typology'),
      )
      if (onlyTypology) {
        sanitized = coerceModuleTypologies(sanitized)
        parsed = quoteExtractionSchema.safeParse(sanitized)
      }
    }
    // Última rede de segurança: módulo in-scope sem materiais (ex.: vidraçaria
    // que o preprocess forçou de volta) → marca fora de escopo em vez de derrubar o job.
    if (!parsed.success) {
      const onlyEmptyMaterials = parsed.error.issues.every((i) =>
        /Módulo sem materiais/i.test(i.message),
      )
      if (onlyEmptyMaterials) {
        sanitized = markEmptyModulesOutOfScope(sanitized)
        sanitized = coerceModuleTypologies(sanitized)
        parsed = quoteExtractionSchema.safeParse(sanitized)
      }
    }
    if (!parsed.success) {
      const detail = parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')
      const emptyEnvs = parsed.error.issues.some(
        (i) =>
          i.path.includes('environments') &&
          /too small|at least 1|min/i.test(i.message),
      )
      throw new Error(
        emptyEnvs
          ? `A IA não encontrou móveis nas páginas deste lote (lista de ambientes vazia). Confira se as páginas escolhidas têm desenho de marcenaria — capa/índice/página em branco não geram cotação. ${detail ? `(${detail})` : ''}`
          : `Resposta do Extrator fora do schema esperado${detail ? ` (${detail})` : ''}.`,
      )
    }

    const dualApplied = applyDualMaterialBoxDefaults(
      parsed.data,
      invokePrefs.box_thickness_mm ?? DEFAULT_COMPANY_STANDARDS(state.companyId).box_thickness_mm,
    )
    const dualParsed = quoteExtractionSchema.safeParse(dualApplied)
    if (dualParsed.success) parsed = dualParsed

    const geom = clampGeometryBounds(forceDeduplicateViewQuantities(parsed.data))
    const clamped = forceDeduplicateViewQuantities(geom)
    const reparsed = quoteExtractionSchema.safeParse(clamped)
    if (reparsed.success) parsed = reparsed
    return parsed.data
  }

  let tree = finalizeExtractionTree(mergedRaw)
  inventory = expandInventoryFromExtraction(inventory, tree)
  const batchPagesForCoverage =
    normalizeSelectedPages(state.pageNumbers).length > 0
      ? normalizeSelectedPages(state.pageNumbers)
      : normalizeSelectedPages(
          state.pagePaths
            .map((p) => {
              const m = p.match(/page-(\d+)\./i)
              return m ? Number(m[1]) : null
            })
            .filter((n): n is number => n != null),
        )
  const coverageScope: CoverageScope = batchPagesForCoverage.length ? 'batch' : 'project'
  let scopedPack = scopeInventoryToSelectedPages(inventory, batchPagesForCoverage, tree)
  let coverage: CoverageReport & {
    deferred?: CoverageReport['missing']
    coverage_scope?: CoverageScope
  } = buildScopedCoverageReport(inventory, tree, batchPagesForCoverage)

  /**
   * Self-Heal cirúrgico (v12.2):
   * 1) Uma chamada heal_module só para os faltantes (sem re-extrair todos os lotes)
   * 2–3) Injeção forçada determinística + auditoria com lock
   * Status permanece AUDITING_REVISION (sem piscar EXTRACTING_MODULES).
   * Em lote parcial: só missing do escopo batch (não a casa inteira da capa).
   */
  const SELF_HEAL_MAX = 3
  const selfHeal = {
    attempts: 0,
    max_retries: SELF_HEAL_MAX,
    mode: null as 'surgical' | 'forced_inject' | null,
    missing_before: coverage.missing.map((m) => ({ ...m })),
    missing_after: coverage.missing.map((m) => ({ ...m })),
    feedback: [] as string[],
  }

  const refreshScopedCoverage = () => {
    scopedPack = scopeInventoryToSelectedPages(inventory, batchPagesForCoverage, tree)
    coverage = buildScopedCoverageReport(inventory, tree, batchPagesForCoverage)
  }

  const publishSelfHealStatus = async (detail: string) => {
    await setAnalysisStatus(state.analysisId, 'AUDITING_REVISION', {
      pipeline_stage: 'self_heal',
      pipeline_detail: detail,
      thought_kind: 'audit',
      thought: true,
      totals: {
        inventory,
        coverage,
        coverage_scope: coverageScope,
        selected_pages: batchPagesForCoverage,
        page_ranges: batchPagesForCoverage.length
          ? batchPagesForCoverage
          : undefined,
        deferred_inventory: scopedPack.deferred,
        self_heal: {
          ...selfHeal,
          missing_after: coverage.missing.map((m) => ({ ...m })),
        },
        pages_processed: state.pagePaths.length,
      },
    })
  }

  while (coverage.missing.length > 0 && selfHeal.attempts < SELF_HEAL_MAX) {
    await assertNotCancelled(state.analysisId)
    selfHeal.attempts += 1
    const missingLines = coverage.missing
      .slice(0, 12)
      .map((m) => `- ${m.environment} → ${m.module}`)
      .join('\n')
    const missingLabel = coverage.missing
      .slice(0, 3)
      .map((m) => m.module)
      .join(', ')
    const healFeedback = [
      `═══ AUTO-CORREÇÃO ${selfHeal.attempts}/${SELF_HEAL_MAX} ═══`,
      'MÓDULOS OBRIGATÓRIOS AUSENTES — cure de forma CIRÚRGICA (só estes), sem reescrever o restante da árvore:',
      missingLines,
      'Nome canônico curto (ex.: Painel TV). Inclua caixaria/frentes, cotas mm e bounding_box.',
    ].join('\n')
    selfHeal.feedback.push(healFeedback)

    if (selfHeal.attempts === 1) {
      selfHeal.mode = 'surgical'
      await publishSelfHealStatus(
        `Auto-correção ${selfHeal.attempts}/${SELF_HEAL_MAX}: Encaixando ${missingLabel || 'módulo faltante'}…`,
      )
      try {
        const healPageCap = Math.min(12, state.pagePaths.length)
        const part = await invokeOrcamentosIaPhase({
          analysisId: state.analysisId,
          companyId: state.companyId,
          mode: state.mode,
          extraction_model: state.extractionModel,
          pagePaths: state.pagePaths.slice(0, healPageCap),
          phase: 'heal_module',
          inventory: scopedPack.scopedInventory,
          missingModules: coverage.missing,
          currentExtraction: tree,
          extraction: tree,
          healFeedback,
          ragMemoriesPrompt: [ragPrompt, healFeedback].filter(Boolean).join('\n\n'),
          models: ORCAMENTOS_IA_MODELS,
        })
        if (part.extraction) {
          const beforeCount = countBillableModules(tree)
          const mergedHeal = forceDeduplicateViewQuantities(
            mergeExtractions([tree, part.extraction]),
          )
          const healed = finalizeExtractionTree(mergedHeal)
          const afterCount = countBillableModules(healed)
          // Não aceitar cura que “apaga” a árvore rica (ex.: 20 → 8 stubs)
          if (afterCount >= Math.max(1, Math.floor(beforeCount * 0.7))) {
            tree = healed
          } else {
            console.warn(
              `[pipeline] self-heal cirúrgico descartado: módulos ${beforeCount} → ${afterCount}`,
            )
            tree = finalizeExtractionTree(injectMissingInventoryModules(tree, coverage.missing))
          }
          refreshScopedCoverage()
          selfHeal.missing_after = coverage.missing.map((m) => ({ ...m }))
        }
      } catch (healSurgicalErr) {
        console.warn(
          '[pipeline] self-heal cirúrgico falhou:',
          healSurgicalErr instanceof Error ? healSurgicalErr.message : healSurgicalErr,
        )
      }
      continue
    }

    // Tentativas 2–3: injeção forçada determinística (100% cobertura do inventário)
    selfHeal.mode = 'forced_inject'
    await publishSelfHealStatus(
      `Auto-correção ${selfHeal.attempts}/${SELF_HEAL_MAX}: Injeção forçada — ${missingLabel || 'módulo faltante'}…`,
    )
    try {
      const injected = injectMissingInventoryModules(tree, coverage.missing)
      tree = finalizeExtractionTree(injected)
      refreshScopedCoverage()
      selfHeal.missing_after = coverage.missing.map((m) => ({ ...m }))
    } catch (injectErr) {
      console.warn(
        '[pipeline] injeção forçada falhou:',
        injectErr instanceof Error ? injectErr.message : injectErr,
      )
      break
    }

    if (state.mode === 'max') {
      await publishSelfHealStatus(
        `Auto-correção ${selfHeal.attempts}/${SELF_HEAL_MAX}: Auditoria preservando injeção…`,
      )
      const injectLockFeedback = [
        healFeedback,
        'INJEÇÃO FORÇADA ATIVA: NÃO remova módulos com auditor_notes contendo "injeção forçada self-heal".',
        'Se ainda faltar item do inventário do LOTE, reinjecte com dims/materiais padrão do ambiente.',
        coverageScope === 'batch'
          ? 'Cobertura 100% só do inventário deste lote (páginas selecionadas) — ignore capa/casa inteira.'
          : 'Cobertura 100% do inventário é obrigatória antes de encerrar.',
      ].join('\n')
      try {
        const auditPageCap = 12
        const aud = await invokeOrcamentosIaPhase({
          analysisId: state.analysisId,
          companyId: state.companyId,
          mode: state.mode,
          extraction_model: state.extractionModel,
          pagePaths: state.pagePaths.slice(0, auditPageCap),
          phase: 'audit',
          inventory: scopedPack.scopedInventory,
          extraction: tree,
          healFeedback: injectLockFeedback,
          forcedInjectLock: true,
          ragMemoriesPrompt: [ragPrompt, injectLockFeedback].filter(Boolean).join('\n\n'),
          models: ORCAMENTOS_IA_MODELS,
        })
        if (aud.extraction) {
          // Merge com a árvore pré-auditoria para não perder injetados se o modelo omitir
          const mergedAud = forceDeduplicateViewQuantities(
            mergeExtractions([tree, aud.extraction]),
          )
          tree = finalizeExtractionTree(mergedAud)
        }
      } catch (healAuditErr) {
        console.warn(
          '[pipeline] self-heal audit (inject lock) falhou:',
          healAuditErr instanceof Error ? healAuditErr.message : healAuditErr,
        )
      }
      // Rede de segurança: se o auditor removeu algo do inventário do lote, re-injeta
      refreshScopedCoverage()
      if (coverage.missing.length > 0) {
        try {
          tree = finalizeExtractionTree(injectMissingInventoryModules(tree, coverage.missing))
          refreshScopedCoverage()
        } catch (reInjectErr) {
          console.warn(
            '[pipeline] re-injeção pós-auditoria falhou:',
            reInjectErr instanceof Error ? reInjectErr.message : reInjectErr,
          )
        }
      }
      selfHeal.missing_after = coverage.missing.map((m) => ({ ...m }))
    }

    if (coverage.missing.length === 0) break
  }

  const estimatedPieces = tree.environments
    .flatMap((e) => e.modules)
    .flatMap((mod) => [...mod.caixaria, ...mod.frentes_portas])
    .filter((p) => p.dimensions_estimated).length
  const oversized = tree.environments
    .flatMap((e) => e.modules.map((mod) => ({ mod, pieces: [...mod.caixaria, ...mod.frentes_portas] })))
    .flatMap(({ mod, pieces }) =>
      pieces
        .filter((p) => {
          const [a, b] = [p.width_mm, p.height_mm].sort((x, y) => y - x)
          return a > 2750 || b > 1850
        })
        .map((p) => `${mod.name} → ${p.name} (${p.width_mm}×${p.height_mm} mm)`),
    )
  if (oversized.length) {
    tree.warnings.push(
      `Peça(s) maiores que a chapa 2750×1850 — confira se a IA agrupou o móvel: ${oversized.slice(0, 5).join('; ')}`,
    )
  }
  if (estimatedPieces > 0) {
    tree.warnings.push(
      `${estimatedPieces} peça(s) sem cota no projeto — medidas estimadas pelo tipo (confira na auditoria).`,
    )
  }
  if (selfHeal.attempts > 0) {
    tree.auditor_notes = [
      ...(Array.isArray(tree.auditor_notes) ? tree.auditor_notes : []),
      `Self-heal (${selfHeal.mode || 'surgical'}): ${selfHeal.attempts} ciclo(s); faltando ao final: ${
        selfHeal.missing_after.length
          ? selfHeal.missing_after.map((m) => m.module).join(', ')
          : 'nenhum'
      }.`,
    ]
  }

  const bomGaps = findMarcenariaBomGaps(tree)
  if (bomGaps.length) {
    const detail = bomGaps
      .slice(0, 5)
      .map((g) => `${g.module}: ${g.reason}`)
      .join('; ')
    console.warn('[pipeline] BOM gaps após auditor/self-heal:', detail)
  }

  // Consolidação global (paleta dinâmica + De-Para ferragens) — ainda SEM preços.
  const { extraction: consolidatedTree, consolidatedBom, projectSheetPalette } =
    consolidateExtractionForPricing(tree)
  tree = consolidatedTree
  tree.auditor_notes = [
    ...(Array.isArray(tree.auditor_notes) ? tree.auditor_notes : []),
    ...consolidatedBom.notes,
    `Paleta de chapas: ${projectSheetPalette.length} SKU(s) (sem colapso Jatobá).`,
  ]

  refreshScopedCoverage()

  await setAnalysisStatus(state.analysisId, 'AUDITING_REVISION', {
    pipeline_stage: 'pricing_pending',
    pipeline_detail:
      'Lista de materiais consolidada — em seguida busco preços uma única vez…',
    thought_kind: 'audit',
    totals: {
      inventory,
      coverage,
      coverage_scope: coverageScope,
      selected_pages: batchPagesForCoverage,
      page_ranges: batchPagesForCoverage.length ? batchPagesForCoverage : undefined,
      deferred_inventory: scopedPack.deferred,
      bom_gaps: bomGaps,
      self_heal: selfHeal,
      pages_processed: state.pagePaths.length,
      consolidated_bom: consolidatedBom,
      project_sheet_palette: projectSheetPalette.map((s) => ({
        label: s.label,
        thickness_mm: s.thickness_mm,
        role: s.role,
      })),
    },
  })

  return { extraction: tree }
}

/**
 * Módulos sem nenhum material (caixaria/frente/ferragem/fita) que ainda estão
 * in-scope — típico de vidraçaria/equipamento — passam a out_of_scope para o Zod.
 */
function markEmptyModulesOutOfScope(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const root = raw as Record<string, unknown>
  const environments = (Array.isArray(root.environments) ? root.environments : [])
    .map((env) => {
      if (!env || typeof env !== 'object') return null
      const e = env as Record<string, unknown>
      const modules = (Array.isArray(e.modules) ? e.modules : [])
        .map((mod) => {
          if (!mod || typeof mod !== 'object') return null
          const m = { ...(mod as Record<string, unknown>) }
          if (m.out_of_scope === true) return m
          const total =
            (Array.isArray(m.caixaria) ? m.caixaria.length : 0) +
            (Array.isArray(m.frentes_portas) ? m.frentes_portas.length : 0) +
            (Array.isArray(m.ferragens) ? m.ferragens.length : 0) +
            (Array.isArray(m.fitas_borda_m) ? m.fitas_borda_m.length : 0)
          if (total === 0) m.out_of_scope = true
          return m
        })
        .filter(Boolean)
      if (!modules.length) return null
      return { ...e, modules }
    })
    .filter(Boolean)
  return { ...root, environments }
}

/** Corrige quantidades zeradas; marca fora de escopo (pedra/decoração). Dimensões → schema. */
function sanitizeExtractionPayload(raw: unknown): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const root = raw as Record<string, unknown>
  const envs = Array.isArray(root.environments) ? root.environments : []
  const environments = envs
    .map((env) => {
      if (!env || typeof env !== 'object') return null
      const e = env as Record<string, unknown>
      const modules = Array.isArray(e.modules) ? e.modules : []
      const cleanedModules = modules
        .map((mod) => {
          if (!mod || typeof mod !== 'object') return null
          let m = { ...(mod as Record<string, unknown>) }
          const modName = typeof m.name === 'string' ? m.name.trim() : ''
          if (!modName) return null

          // Medidas (mm) ≤ 0 são estimadas por tipo no schema (dimension-defaults)
          m.caixaria = coercePositiveList(m.caixaria, ['quantity']).map(sanitizePieceEdgeBanding)
          m.frentes_portas = coercePositiveList(m.frentes_portas, ['quantity'])
          m.ferragens = coercePositiveList(m.ferragens, ['exact_quantity', 'full_units_quantity'])
          m.fitas_borda_m = coercePositiveList(m.fitas_borda_m, ['meters'])

          // Guarda-roupa com 5–8 folhas: IA manda sliding_doors=6; schema antigo só 2|3|4 derrubava o job.
          if (m.sliding_doors != null) {
            const n = Math.round(Number(m.sliding_doors))
            if (!Number.isFinite(n)) delete m.sliding_doors
            else m.sliding_doors = Math.min(8, Math.max(2, n))
          }

          m = ensureModulePlaceholder(m)

          // Módulo in-scope sem nenhum material → remove (exceto tipologias de marcenaria
          // já preenchidas por ensureModulePlaceholder / enrich mínimo)
          if (m.out_of_scope !== true) {
            const total =
              (Array.isArray(m.caixaria) ? m.caixaria.length : 0) +
              (Array.isArray(m.frentes_portas) ? m.frentes_portas.length : 0) +
              (Array.isArray(m.ferragens) ? m.ferragens.length : 0) +
              (Array.isArray(m.fitas_borda_m) ? m.fitas_borda_m.length : 0)
            if (total === 0) {
              // Segunda chance: tipologias de caixa não podem sumir (paridade Flaviane)
              m = ensureModulePlaceholder({ ...m, out_of_scope: false })
              const retry =
                (Array.isArray(m.caixaria) ? m.caixaria.length : 0) +
                (Array.isArray(m.frentes_portas) ? m.frentes_portas.length : 0)
              if (retry === 0) return null
            }
          }
          return m
        })
        .filter(Boolean)
      if (!cleanedModules.length) return null
      return { ...e, modules: cleanedModules }
    })
    .filter(Boolean)

  const warnings = Array.isArray(root.warnings) ? [...(root.warnings as string[])] : []
  if (environments.length === 0) {
    warnings.push('Nenhum ambiente com materiais restantes após limpeza — confira o PDF.')
  }

  return { ...root, environments, warnings: [...new Set(warnings)] }
}

function coercePositiveList(value: unknown, numericKeys: string[]): unknown[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const row = { ...(item as Record<string, unknown>) }
      for (const key of numericKeys) {
        const n = Number(row[key])
        if (!Number.isFinite(n) || n <= 0) row[key] = 1
      }
      if (typeof row.material_name === 'string' && !row.material_name.trim()) {
        row.material_name = 'MDF Branco TX 15mm'
      }
      if (typeof row.raw_name === 'string' && !row.raw_name.trim()) {
        row.raw_name = 'Ferragem genérica'
      }
      if (typeof row.tape_name === 'string' && !row.tape_name.trim()) {
        row.tape_name = 'Fita de Borda'
      }
      return row
    })
}

/** Remove `null` em objetos aninhados (Zod .optional() ≠ .nullable()). */
function stripNullOptionals(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNullOptionals)
  if (!value || typeof value !== 'object') return value
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (v === null) continue
    out[k] = stripNullOptionals(v)
  }
  return out
}

/**
 * null/NaN em edge_banding derrubava o Zod (.optional() aceita undefined, não null).
 * Convenção Cortecloud (HAR): C1/C2 = arestas do comprimento (c); L1/L2 = arestas da largura (l).
 * Ver docs/evidence/cortecloud-caixaria-report.md e schemas.caixariaPieceSchema.
 */
/** Sanitiza edge_banding para o Zod. */
function sanitizePieceEdgeBanding(item: unknown): unknown {
  if (!item || typeof item !== 'object') return item
  const row = { ...(item as Record<string, unknown>) }
  const eb = row.edge_banding
  // IA manda edge_banding: null com frequência — remove a chave (vira undefined)
  if (eb == null || typeof eb !== 'object') {
    delete row.edge_banding
    return row
  }
  const band = { ...(eb as Record<string, unknown>) }
  const meters = Number(band.meters)
  band.meters = Number.isFinite(meters) && meters >= 0 ? meters : 0
  if (band.tape_name == null || (typeof band.tape_name === 'string' && !band.tape_name.trim())) {
    delete band.tape_name
  }
  for (const side of ['C1', 'C2', 'L1', 'L2'] as const) {
    if (band[side] == null) band[side] = false
    else band[side] = Boolean(band[side])
  }
  row.edge_banding = band
  return row
}

async function nodeResolvePricesAndPersist(
  state: PipelineStateType,
): Promise<Partial<PipelineStateType>> {
  if (!state.extraction) throw new Error('Extração vazia.')
  await assertNotCancelled(state.analysisId)

  await setAnalysisStatus(state.analysisId, 'FETCHING_MARKET_PRICES', {
    pipeline_stage: 'fetching_prices',
    pipeline_detail:
      'Buscando preços (estoque → De-Para → mercado) — passagem única no BOM consolidado…',
    thought_kind: 'price',
  })

  // Limpa ambientes anteriores desta análise (reprocessamento)
  const { data: oldEnvs } = await supabase
    .from('quote_environments')
    .select('id')
    .eq('analysis_id', state.analysisId)
  if (oldEnvs?.length) {
    await supabase
      .from('quote_environments')
      .delete()
      .in(
        'id',
        oldEnvs.map((e) => e.id),
      )
  }

  let materialsSaved = 0
  let marketFlags = 0
  let outOfScopeCount = 0
  let bomItemsSaved = 0
  const engineeringCot: string[] = []
  let systemPrefs: Awaited<ReturnType<typeof getSystemPreferences>> | null = null
  try {
    systemPrefs = await getSystemPreferences(state.companyId)
  } catch {
    systemPrefs = null
  }
  const resolver = await createPriceResolver(state.companyId, {
    preferredThicknessMm: systemPrefs?.box_thickness_mm ?? 15,
  })
  const price = (name: string, category: string) => assertPriced(resolver.resolve(name, category), name)
  await clearBomItemsForProject(state.analysisId)

  const persistPageNumbers =
    normalizeSelectedPages(state.pageNumbers).length > 0
      ? normalizeSelectedPages(state.pageNumbers)
      : normalizeSelectedPages(
          state.pagePaths
            .map((p) => {
              const m = p.match(/page-(\d+)\./i)
              return m ? Number(m[1]) : null
            })
            .filter((n): n is number => n != null),
        )
  const extractionForPersist = filterExtractionToSelectedPages(
    state.extraction,
    persistPageNumbers,
  ) as QuoteExtraction
  if (!extractionForPersist?.environments?.length) {
    throw new Error('Nenhum módulo do lote restante após filtro de páginas — abortando persistência.')
  }

  for (const [envIndex, env] of extractionForPersist.environments.entries()) {
    const { data: envRow, error: envError } = await supabase
      .from('quote_environments')
      .insert({
        analysis_id: state.analysisId,
        name: env.name,
        sort_order: envIndex,
      })
      .select('id')
      .single()
    if (envError || !envRow) throw new Error(envError?.message || 'Erro ao salvar ambiente.')

    for (const [modIndex, mod] of env.modules.entries()) {
      const modPage =
        pageFromBoundingBox(mod.bounding_box) ??
        (typeof mod.bounding_box?.page === 'number' ? mod.bounding_box.page : null)
      const modPagePath = buildPageImagePath(
        state.companyId,
        state.analysisId,
        modPage,
        state.pagePaths,
      )

      const { data: modRow, error: modError } = await supabase
        .from('quote_modules')
        .insert({
          environment_id: envRow.id,
          name: mod.name,
          description: mod.description ?? null,
          dimensions: mod.dimensions ?? {},
          bounding_box: mod.bounding_box ?? null,
          page_number: modPage,
          page_image_path: modPagePath,
          sort_order: modIndex,
          out_of_scope: mod.out_of_scope === true,
        })
        .select('id')
        .single()
      if (modError || !modRow) throw new Error(modError?.message || 'Erro ao salvar módulo.')

      // Pedra / alvenaria / decoração: só registra o módulo, sem insumos nem custo
      if (mod.out_of_scope) {
        outOfScopeCount += 1
        continue
      }

      const materialRows: Array<Record<string, unknown>> = []
      const sheetAgg = new Map<
        string,
        { areaM2: number; price: ReturnType<typeof price>; bbox: unknown }
      >()

      const withPage = (
        row: Record<string, unknown>,
        bbox: unknown,
      ): Record<string, unknown> => {
        const piecePage = pageFromBoundingBox(bbox)
        // Peça com página diferente do módulo = alucinação comum; ancora no módulo
        const page =
          piecePage && modPage && piecePage !== modPage ? modPage : (piecePage ?? modPage)
        let inheritedBbox: unknown =
          bbox && typeof bbox === 'object'
            ? bbox
            : mod.bounding_box
              ? mod.bounding_box
              : page
                ? { page, x: 0, y: 0, width: 1, height: 1 }
                : null
        if (
          inheritedBbox &&
          typeof inheritedBbox === 'object' &&
          page &&
          pageFromBoundingBox(inheritedBbox) !== page
        ) {
          inheritedBbox = { ...(inheritedBbox as Record<string, unknown>), page }
        }
        return {
          ...row,
          bounding_box: inheritedBbox,
          page_image_path: buildPageImagePath(
            state.companyId,
            state.analysisId,
            page,
            state.pagePaths,
          ),
        }
      }

      // Total de fita do módulo é autoritativo: não somar de novo a fita por peça
      const moduleHasTapeTotals = mod.fitas_borda_m.length > 0

      for (const piece of mod.caixaria) {
        // Pé metálico, vidro etc. listados como peça: cotar por unidade, não como chapa
        if (isNonSheetMaterial(piece.material_name)) {
          const label = `${piece.name} — ${piece.material_name}`
          const unitPrice = price(label, 'ferragem')
          if (unitPrice.usingMarketPrice) marketFlags += 1
          materialRows.push(
            withPage(
              {
                module_id: modRow.id,
                raw_name: label,
                category: 'ferragem',
                system_material_id: unitPrice.inventoryItemId,
                using_market_price: unitPrice.usingMarketPrice,
                market_price_confirmed: false,
                unit_price: unitPrice.unitPrice,
                exact_quantity: piece.quantity,
                full_units_quantity: Math.ceil(piece.quantity),
                unit_measure: 'un',
                notes: priceNotes(unitPrice, `Peça não-MDF (${piece.width_mm}x${piece.height_mm}mm)`),
              },
              piece.bounding_box,
            ),
          )
          continue
        }

        const piecePrice = price(piece.material_name, 'chapa')
        materialRows.push(
          withPage(
            {
              module_id: modRow.id,
              raw_name: `${piece.name} — ${piece.material_name}`,
              category: 'chapa',
              system_material_id: piecePrice.inventoryItemId,
              using_market_price: false,
              market_price_confirmed: true,
              unit_price: 0,
              exact_quantity: piece.quantity,
              full_units_quantity: Math.ceil(piece.quantity),
              unit_measure: 'un',
              notes: `${CUTTING_LIST_TAG}; função=${piece.function}; ${piece.width_mm}x${piece.height_mm}x${piece.thickness_mm}mm × ${piece.quantity}${piece.dimensions_estimated ? ' (medida estimada)' : ''}`,
            },
            piece.bounding_box,
          ),
        )
        const prev = sheetAgg.get(piece.material_name) ?? {
          areaM2: 0,
          price: piecePrice,
          bbox: piece.bounding_box,
        }
        prev.areaM2 += pieceAreaM2(piece.width_mm, piece.height_mm, piece.quantity)
        prev.price = piecePrice
        sheetAgg.set(piece.material_name, prev)
        if (!moduleHasTapeTotals && piece.edge_banding && piece.edge_banding.meters > 0) {
          // `meters` vem por unidade da peça
          const tapeMeters = Math.round(piece.edge_banding.meters * piece.quantity * 100) / 100
          const tapeName = piece.edge_banding.tape_name || 'Fita de Borda'
          const tapePrice = price(tapeName, 'fita_borda')
          if (tapePrice.usingMarketPrice) marketFlags += 1
          materialRows.push(
            withPage(
              {
                module_id: modRow.id,
                raw_name: tapeName,
                category: 'fita_borda',
                system_material_id: tapePrice.inventoryItemId,
                using_market_price: tapePrice.usingMarketPrice,
                market_price_confirmed: false,
                unit_price: tapePrice.unitPrice,
                exact_quantity: tapeMeters,
                full_units_quantity: Math.ceil(tapeMeters),
                unit_measure: 'm',
                notes: priceNotes(
                  tapePrice,
                  `Fita de borda: ${piece.edge_banding.meters} m × ${piece.quantity} peça(s)`,
                ),
              },
              piece.bounding_box,
            ),
          )
        }
      }

      for (const frente of mod.frentes_portas) {
        const frentePrice = price(frente.material_name, 'chapa')
        materialRows.push(
          withPage(
            {
              module_id: modRow.id,
              raw_name: `${frente.name} — ${frente.material_name}`,
              category: 'chapa',
              system_material_id: frentePrice.inventoryItemId,
              using_market_price: false,
              market_price_confirmed: true,
              unit_price: 0,
              exact_quantity: frente.quantity,
              full_units_quantity: Math.ceil(frente.quantity),
              unit_measure: 'un',
              notes: `${CUTTING_LIST_TAG}; tipo=${frente.kind}; ${frente.width_mm}x${frente.height_mm}x${frente.thickness_mm}mm × ${frente.quantity}${frente.dimensions_estimated ? ' (medida estimada)' : ''}`,
            },
            frente.bounding_box,
          ),
        )
        const prevF = sheetAgg.get(frente.material_name) ?? {
          areaM2: 0,
          price: frentePrice,
          bbox: frente.bounding_box,
        }
        prevF.areaM2 += pieceAreaM2(frente.width_mm, frente.height_mm, frente.quantity)
        prevF.price = frentePrice
        sheetAgg.set(frente.material_name, prevF)
      }

      for (const [materialName, agg] of sheetAgg) {
        const packed = sheetsForModuleArea(agg.areaM2)
        const unitPrice = sheetUnitPrice(agg.price)
        if (agg.price.usingMarketPrice) marketFlags += 1
        materialRows.push(
          withPage(
            {
              module_id: modRow.id,
              raw_name: `Chapa — ${materialName}`,
              category: 'chapa',
              system_material_id: agg.price.inventoryItemId,
              using_market_price: agg.price.usingMarketPrice,
              market_price_confirmed: false,
              unit_price: unitPrice,
              exact_quantity: packed.sheets,
              full_units_quantity: packed.sheets,
              unit_measure: 'chapa',
              notes: priceNotes(
                agg.price,
                sheetPurchaseNotes(packed.areaM2, packed.sheets, packed.lossPct),
              ),
            },
            agg.bbox,
          ),
        )
      }

      for (const fita of mod.fitas_borda_m) {
        const fitaPrice = price(fita.tape_name, 'fita_borda')
        if (fitaPrice.usingMarketPrice) marketFlags += 1
        materialRows.push(
          withPage(
            {
              module_id: modRow.id,
              raw_name: fita.tape_name,
              category: 'fita_borda',
              system_material_id: fitaPrice.inventoryItemId,
              using_market_price: fitaPrice.usingMarketPrice,
              market_price_confirmed: false,
              unit_price: fitaPrice.unitPrice,
              exact_quantity: fita.meters,
              full_units_quantity: Math.ceil(fita.meters),
              unit_measure: 'm',
              notes: priceNotes(fitaPrice),
            },
            fita.bounding_box,
          ),
        )
      }

      for (const ferr of mod.ferragens) {
        const isHandleBar =
          ferr.category === 'puxador' &&
          (ferr.unit_measure === 'barra' || /perfil|regua|régua/i.test(ferr.raw_name))
        const category = ferr.category
        const ferrPrice = price(ferr.raw_name, category)
        if (ferrPrice.usingMarketPrice) marketFlags += 1

        let exact = ferr.exact_quantity
        let fullUnits = ferr.full_units_quantity
        let unitMeasure = ferr.unit_measure
        let notes = ferr.notes ?? 'Unidade individual (Planilha 4.0)'

        if (isHandleBar && ferr.unit_measure === 'm') {
          fullUnits = barsOf3mFromMeters(exact)
          unitMeasure = 'barra'
          notes = `Puxador perfil: ${exact} m → ${fullUnits} barra(s) de 3 m`
        } else if (isHandleBar) {
          fullUnits = Math.max(fullUnits, Math.ceil(exact))
          notes = `Puxador perfil em barras de 3 m; ${notes}`
        } else {
          unitMeasure = 'un'
          fullUnits = Math.ceil(exact)
        }

        const ferrRow = withPage(
          {
            module_id: modRow.id,
            raw_name: ferr.raw_name,
            category,
            system_material_id: ferrPrice.inventoryItemId,
            using_market_price: ferrPrice.usingMarketPrice,
            market_price_confirmed: false,
            unit_price: ferrPrice.unitPrice,
            exact_quantity: exact,
            full_units_quantity: fullUnits,
            unit_measure: unitMeasure,
            notes: priceNotes(ferrPrice, notes),
          },
          ferr.bounding_box,
        )
        materialRows.push(ferrRow)

        if (isHandleBar && fullUnits > 0) {
          const caps = endCapsForHandleBars(fullUnits)
          const capPrice = price('Tampinha lateral puxador perfil', 'puxador')
          if (capPrice.usingMarketPrice) marketFlags += 1
          materialRows.push({
            ...ferrRow,
            raw_name: 'Tampinha lateral puxador perfil',
            category: 'puxador',
            system_material_id: capPrice.inventoryItemId,
            using_market_price: capPrice.usingMarketPrice,
            market_price_confirmed: false,
            unit_price: capPrice.unitPrice,
            exact_quantity: caps,
            full_units_quantity: caps,
            unit_measure: 'un',
            notes: priceNotes(capPrice, `2 tampinhas por barra de 3 m (${fullUnits} barras)`),
          })
        }
      }

      // Gate: materiais marcenaria devem ter preço > 0
      const unpriced = materialRows.filter(
        (r) =>
          ['chapa', 'fita_borda', 'ferragem', 'puxador', 'consumivel'].includes(
            String(r.category),
          ) &&
          !(Number(r.unit_price) > 0) &&
          !isCuttingListNote(typeof r.notes === 'string' ? r.notes : null),
      )
      if (unpriced.length) {
        throw new Error(
          `Módulo “${mod.name}” com ${unpriced.length} item(ns) sem preço — cotação incompleta.`,
        )
      }

      if (materialRows.length) {
        const { error: matError } = await supabase.from('quote_materials').insert(materialRows)
        if (matError) throw new Error(matError.message)
        materialsSaved += materialRows.length
      } else {
        throw new Error(
          `Módulo “${mod.name}” sem materiais após extração — pipeline abortado (proibido lista vazia).`,
        )
      }

      // v11: desmonte determinístico → bom_items + CoT de engenharia
      const exploded = explodeModuleForPersist(mod, systemPrefs, env.name)
      const bomCheck = validateBomLines(exploded.bom)
      if (!bomCheck.ok) {
        throw new Error(
          `BOM inválido no módulo “${mod.name}”: ${bomCheck.issues.slice(0, 3).join(' | ')}`,
        )
      }
      const bomInsert = await insertBomItems(state.analysisId, modRow.id, exploded.bom)
      if (bomInsert.error) throw new Error(bomInsert.error)
      bomItemsSaved += bomInsert.count
      engineeringCot.push(`### ${mod.name}\n${exploded.chainOfThought}`)
      for (const w of exploded.warnings) {
        engineeringCot.push(`AVISO [${mod.name}]: ${w}`)
      }
    }
  }

  await setAnalysisStatus(state.analysisId, 'AUDITING_REVISION', {
    pipeline_stage: 'persisting',
    pipeline_detail: 'Finalizando: gravando ambientes, módulos e materiais no orçamento…',
    thought_kind: 'price',
  })

  // Preserva inventário/cobertura já gravados no passo de extração
  const { data: current } = await supabase
    .from('quote_analyses')
    .select('totals')
    .eq('id', state.analysisId)
    .maybeSingle()
  const prevTotals =
    current?.totals && typeof current.totals === 'object'
      ? (current.totals as Record<string, unknown>)
      : {}

  const inventory = Array.isArray(prevTotals.inventory)
    ? (prevTotals.inventory as InventoryEnv[])
    : []
  const persistScopePages =
    persistPageNumbers.length > 0
      ? persistPageNumbers
      : pageNumbersFromTotals(prevTotals)
  const coverageScopePersist: CoverageScope = persistScopePages.length ? 'batch' : 'project'
  const scopedPersist = buildScopedCoverageReport(
    inventory,
    extractionForPersist,
    persistScopePages,
  )
  const coverage: CoverageReport = scopedPersist

  // v12: gravar sale_price / MPC obrigatoriamente
  const { data: analysisRow } = await supabase
    .from('quote_analyses')
    .select('pricing_modality, pricing_params')
    .eq('id', state.analysisId)
    .maybeSingle()

  const modality = normalizePricingModality(
    analysisRow?.pricing_modality || DEFAULT_PRICING_PARAMS.modality,
  )
  const rawParams =
    analysisRow?.pricing_params && typeof analysisRow.pricing_params === 'object'
      ? (analysisRow.pricing_params as Record<string, unknown>)
      : {}
  const pricingParams: PricingParams = {
    ...DEFAULT_PRICING_PARAMS,
    modality,
    mpcPercent:
      Number(rawParams.mpcPercent ?? rawParams.mpc_margin_pct) ||
      DEFAULT_PRICING_PARAMS.mpcPercent,
    materialMultiplier:
      Number(rawParams.materialMultiplier ?? rawParams.multiplier_n) ||
      DEFAULT_PRICING_PARAMS.materialMultiplier,
  }

  const treeResult = await loadQuoteAnalysisTree(state.analysisId)
  if (!treeResult.data) {
    throw new Error(treeResult.error || 'Falha ao carregar árvore para precificação.')
  }
  const tree = treeResult.data
  const pricingResult = calculateQuotePricing(tree, pricingParams)
  const duplicateFlags = validatePlausibleQuantities(extractionForPersist)
  const flatMats = tree.environments.flatMap((e) =>
    e.modules.flatMap((m) => m.materials),
  )

  const financialTotals = {
    materials_cost: pricingResult.materialsCost,
    cost_price: pricingResult.materialsCost,
    sale_price: pricingResult.salePrice,
    mpc_margin_pct:
      pricingResult.modality === 'mpc_margin' ? pricingParams.mpcPercent : null,
    multiplier_n:
      pricingResult.modality === 'material_multiplier'
        ? pricingParams.materialMultiplier
        : null,
    pricing_modality: pricingResult.modality,
    pricing_formula: pricingResult.formulaLabel,
    sheet_area_m2_ref: pricingResult.totalAreaSqm,
    priced_at: new Date().toISOString(),
    using_facade_sqm: false,
  }

  // Em lote: pagesTotal = tamanho do lote (não page_count do PDF inteiro).
  const pagesTotal =
    coverageScopePersist === 'batch'
      ? persistScopePages.length || state.pagePaths.length
      : Number(prevTotals.pages_total) ||
        Number(prevTotals.total_pages) ||
        (Array.isArray(prevTotals.page_paths) ? prevTotals.page_paths.length : 0) ||
        state.pagePaths.length
  const coverageForBreaker =
    shouldBlockOnCoverageMissing({
      coverageScope: coverageScopePersist,
      missingCount: coverage.missing.length,
      deferredCount: scopedPersist.deferred.length,
    })
      ? coverage
      : { ...coverage, missing: [] }
  const breaker = evaluateCircuitBreaker({
    extraction: extractionForPersist,
    materials: flatMats,
    coverage: coverageForBreaker,
    pricing: financialTotals,
    prefs: systemPrefs,
    duplicateFlags,
    enforceBrancoTx: true,
    pagesTotal,
    billableModuleCount: countBillableModules(extractionForPersist),
    coverageScope: coverageScopePersist,
  })

  const nextTotals: Record<string, unknown> = {
    ...prevTotals,
    materials_count: materialsSaved,
    bom_items_count: bomItemsSaved,
    market_price_flags: marketFlags,
    out_of_scope_modules: outOfScopeCount,
    environments: extractionForPersist.environments.length,
    modules: extractionForPersist.environments.reduce((n, e) => n + e.modules.length, 0),
    auditor_notes: extractionForPersist.auditor_notes,
    engineering_cot: engineeringCot.join('\n\n'),
    pricing_note:
      'v12: venda apenas por BOM (MPC% ou ×N) — circuit breaker; proibido m² de fachada',
    warnings: [
      ...(Array.isArray(extractionForPersist.warnings) ? extractionForPersist.warnings : []),
      ...(coverage.missing.length
        ? [
            coverageScopePersist === 'batch'
              ? `Cobertura incompleta neste lote: ${coverage.missing.length} módulo(s) faltando nas páginas selecionadas.`
              : `Cobertura incompleta: ${coverage.missing.length} módulo(s) do inventário ainda faltando.`,
          ]
        : []),
      ...(coverage.extras?.length
        ? [
            `Possíveis alucinações: ${coverage.extras.length} módulo(s) a mais que o inventário — confira no PDF.`,
          ]
        : []),
      ...(!breaker.ok
        ? breaker.blockers.map((b) => `Circuit breaker: ${b}`)
        : []),
    ],
    inventory,
    coverage,
    coverage_scope: coverageScopePersist,
    selected_pages: persistScopePages,
    page_ranges: persistScopePages.length ? persistScopePages : prevTotals.page_ranges,
    deferred_inventory: scopedPersist.deferred,
    last_extraction: extractionForPersist,
    duplicate_view_flags: duplicateFlags,
    circuit_breaker: breaker,
    ...financialTotals,
  }

  const pricingParamsPersist = {
    mpcPercent: pricingParams.mpcPercent,
    materialMultiplier: pricingParams.materialMultiplier,
    mpc_margin_pct: pricingParams.mpcPercent,
    multiplier_n: pricingParams.materialMultiplier,
    modality: pricingResult.modality,
  }

  if (!breaker.ok) {
    await setAnalysisStatus(state.analysisId, 'NEEDS_REVIEW', {
      error_message: breaker.blockers[0] || 'Circuit breaker: revisão necessária',
      pipeline_stage: 'needs_review',
      pipeline_detail: `Circuit breaker: ${breaker.blockers.slice(0, 2).join(' | ')}`,
      thought_kind: 'warn',
      pricing_modality: pricingResult.modality,
      pricing_params: pricingParamsPersist,
      totals: nextTotals,
    })
    await maybeRefreshProjectFolder(state)
    return { materialsSaved, extraction: extractionForPersist }
  }

  await setAnalysisStatus(state.analysisId, 'COMPLETED', {
    error_message: null,
    pipeline_stage: 'completed',
    pipeline_detail: 'Pronto — análise concluída. Você já pode revisar chapas e ferragens.',
    thought_kind: 'done',
    pricing_modality: pricingResult.modality,
    pricing_params: pricingParamsPersist,
    totals: nextTotals,
  })

  await maybeRefreshProjectFolder(state)
  return { materialsSaved, extraction: extractionForPersist }
}

/** Após precificar o lote, une extractions da pasta e grava snapshot consolidado. */
async function maybeRefreshProjectFolder(state: PipelineStateType): Promise<void> {
  let projectId = state.projectId?.trim() || null
  if (!projectId) {
    const { data } = await supabase
      .from('quote_analyses')
      .select('project_id')
      .eq('id', state.analysisId)
      .maybeSingle()
    projectId = typeof data?.project_id === 'string' ? data.project_id : null
  }
  if (!projectId) return
  try {
    const result = await refreshQuoteProjectFolderSnapshot(projectId)
    if (!result.ok) {
      console.warn('[orcamentos-ia] folder snapshot:', result.error)
    }
  } catch (err) {
    console.warn('[orcamentos-ia] folder snapshot failed', err)
  }
}

function buildPipelineGraph() {
  const graph = new StateGraph(PipelineState)
    .addNode('convertPages', async (state) => {
      try {
        return await nodeConvertPages(state)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro na conversão do PDF'
        await setAnalysisStatus(state.analysisId, 'FAILED', { error_message: message, pipeline_stage: 'failed', pipeline_detail: message })
        return { error: message }
      }
    })
    .addNode('invokeAgents', async (state) => {
      if (state.error) return {}
      try {
        return await nodeInvokeAgents(state)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro nos agentes de IA'
        // Só rede no poll: a Edge pode ainda estar lendo. Erros reais da cadeia
        // (HTTP 500, JSON inválido, etc.) devem ir para FAILED mesmo se o texto
        // diga "Clique em Retomar".
        if (/interrompid/i.test(message)) {
          return { error: CANCELLED_BY_USER_MESSAGE }
        }
        if (
          isNetworkFailure(err) ||
          /conexão caiu várias vezes|nuvem pode ainda estar processando/i.test(message)
        ) {
          await setAnalysisStatus(state.analysisId, 'EXTRACTING_MODULES', {
            error_message: message,
            pipeline_stage: 'extracting_batch',
            pipeline_detail: message,
          })
          return { error: message }
        }
        await setAnalysisStatus(state.analysisId, 'FAILED', { error_message: message, pipeline_stage: 'failed', pipeline_detail: message })
        return { error: message }
      }
    })
    .addNode('resolvePrices', async (state) => {
      if (state.error) return {}
      try {
        return await nodeResolvePricesAndPersist(state)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao resolver preços'
        if (/interrompid/i.test(message)) {
          return { error: CANCELLED_BY_USER_MESSAGE }
        }
        await setAnalysisStatus(state.analysisId, 'FAILED', { error_message: message, pipeline_stage: 'failed', pipeline_detail: message })
        return { error: message }
      }
    })
    .addEdge(START, 'convertPages')
    .addEdge('convertPages', 'invokeAgents')
    .addEdge('invokeAgents', 'resolvePrices')
    .addEdge('resolvePrices', END)

  return graph.compile()
}

export interface RunOrcamentosIaPipelineParams {
  analysisId: string
  companyId: string
  mode: QuoteAnalysisMode
  /** Modelo de visão; default Sonnet econômico. */
  extractionModel?: ExtractionModelKey
  /** PDF e/ou imagens. Preferir este campo. */
  sourceFiles?: File[]
  /** @deprecated use sourceFiles */
  pdfFile?: File
  /** Se true, não reconverte — só reusa pages/ já no Storage. */
  reuseExistingPages?: boolean
  /** Retomar cadeia async a partir desta página (0-based). */
  resumeFromPage?: number
  /**
   * Páginas absolutas do PDF a incluir neste lote (1-based).
   * Omitido = converter/usar todas.
   */
  pageNumbers?: number[]
  /**
   * Pasta quote_projects.
   * Com pageNumbers e sourceFiles vazio: baixa PDF de quote_projects.pdf_url
   * e converte só as páginas selecionadas (sem re-upload).
   */
  projectId?: string | null
}

function resolveExtractionModelParam(value: unknown): ExtractionModelKey {
  return isExtractionModelKey(value) ? value : DEFAULT_EXTRACTION_MODEL
}

export interface RunOrcamentosIaPipelineResult {
  ok: boolean
  error?: string
  materialsSaved?: number
}

/** Dispara o grafo Supervisor → Extrator → Preços → COMPLETED. */
export async function runOrcamentosIaPipeline(
  params: RunOrcamentosIaPipelineParams,
): Promise<RunOrcamentosIaPipelineResult> {
  const sourceFiles =
    params.sourceFiles?.length
      ? params.sourceFiles
      : params.pdfFile
        ? [params.pdfFile]
        : []

  const pageNumbers =
    Array.isArray(params.pageNumbers) && params.pageNumbers.length > 0
      ? [...new Set(params.pageNumbers.filter((p) => Number.isInteger(p) && p > 0))].sort(
          (a, b) => a - b,
        )
      : []

  const app = buildPipelineGraph()
  const result = await app.invoke({
    analysisId: params.analysisId,
    companyId: params.companyId,
    mode: params.mode,
    extractionModel: resolveExtractionModelParam(params.extractionModel),
    sourceFiles: params.reuseExistingPages ? [] : sourceFiles,
    pdfFile: null,
    pagePaths: [],
    pageNumbers,
    projectId: params.projectId?.trim() || null,
    extraction: null,
    materialsSaved: 0,
    error: null,
    resumeFromPage:
      typeof params.resumeFromPage === 'number' && params.resumeFromPage > 0
        ? params.resumeFromPage
        : null,
  })

  if (result.error) {
    return { ok: false, error: result.error }
  }
  return { ok: true, materialsSaved: result.materialsSaved }
}

/**
 * Reaudita estrutura (cobertura + marcações + BOM) sem apagar materiais/preços confirmados.
 * Chama só `phase: 'audit'` na Edge e aplica correções de página/bbox nos módulos.
 */
export async function reauditOrcamentosIaAnalysis(params: {
  analysisId: string
  companyId: string
}): Promise<{ ok: boolean; error?: string; auditNeedsRerun?: boolean; updatedModules?: number }> {
  const { data: row, error } = await supabase
    .from('quote_analyses')
    .select('id, company_id, mode, extraction_model, totals, source_pdf_path, project_id')
    .eq('id', params.analysisId)
    .eq('company_id', params.companyId)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!row) return { ok: false, error: 'Análise não encontrada.' }

  const reauditTotals =
    row.totals && typeof row.totals === 'object' ? (row.totals as Record<string, unknown>) : {}
  const preferredPaths = Array.isArray(reauditTotals.page_paths)
    ? (reauditTotals.page_paths as unknown[]).filter((p): p is string => typeof p === 'string')
    : []
  const reauditProjectId =
    typeof (row as { project_id?: string | null }).project_id === 'string'
      ? (row as { project_id: string }).project_id
      : null
  const { paths: listedPaths } = await listQuotePagePaths(params.companyId, params.analysisId, {
    projectId: reauditProjectId,
    preferredPaths,
  })
  const batchPages = pageNumbersFromTotals(reauditTotals)
  const paths = batchPages.length
    ? assertBatchPagePaths(listedPaths, batchPages)
    : listedPaths
  if (!paths.length) return { ok: false, error: 'Sem páginas convertidas para reauditar.' }
  const reauditExtractionModel = resolveExtractionModelParam(
    (row as { extraction_model?: string }).extraction_model,
  )

  const treeResult = await loadQuoteAnalysisTree(params.analysisId)
  const tree = treeResult.data
  if (treeResult.error || !tree) {
    return { ok: false, error: treeResult.error || 'Não foi possível carregar a árvore.' }
  }

  const prevTotals =
    row.totals && typeof row.totals === 'object' ? (row.totals as Record<string, unknown>) : {}
  const inventory = Array.isArray(prevTotals.inventory)
    ? sanitizeInventory(prevTotals.inventory as InventoryEnv[])
    : tree.environments.map((e) => ({
        environment: e.name,
        modules: e.modules.filter((m) => !m.out_of_scope).map((m) => m.name),
      }))

  const extractionFromTree = {
    environments: tree.environments.map((env) => ({
      name: env.name,
      modules: env.modules.map((mod) => ({
        name: mod.name,
        description: mod.description ?? undefined,
        dimensions: mod.dimensions ?? undefined,
        bounding_box: mod.bounding_box ?? undefined,
        out_of_scope: mod.out_of_scope === true,
        caixaria: mod.materials
          .filter((m) => m.category === 'chapa' && !isCuttingListNote(m.notes))
          .slice(0, 1)
          .map((m) => ({
            name: m.raw_name,
            material_name: m.raw_name.includes('—')
              ? m.raw_name.split('—').pop()?.trim() || m.raw_name
              : m.raw_name,
            thickness_mm: 15,
            width_mm: Number(mod.dimensions?.width_mm) || 800,
            height_mm: Number(mod.dimensions?.height_mm) || 720,
            quantity: Math.max(1, Number(m.exact_quantity) || 1),
            function: 'outro' as const,
          })),
        frentes_portas: [],
        ferragens: mod.materials
          .filter((m) => m.category === 'ferragem' || m.category === 'puxador')
          .map((m) => ({
            name: m.raw_name,
            quantity: Math.max(1, Number(m.exact_quantity) || 1),
            unit: 'un' as const,
          })),
        fitas_borda_m: mod.materials
          .filter((m) => m.category === 'fita_borda')
          .map((m) => ({
            width_mm: 22 as const,
            meters: Math.max(0.1, Number(m.exact_quantity) || 0.1),
          })),
      })),
    })),
    auditor_notes: Array.isArray(prevTotals.auditor_notes)
      ? (prevTotals.auditor_notes as string[])
      : [],
    warnings: Array.isArray(prevTotals.warnings) ? (prevTotals.warnings as string[]) : [],
  }

  const seedExtraction =
    prevTotals.last_extraction && typeof prevTotals.last_extraction === 'object'
      ? prevTotals.last_extraction
      : extractionFromTree

  await setAnalysisStatus(params.analysisId, 'AUDITING_REVISION', {
    pipeline_stage: 'reauditing',
    pipeline_detail: 'Reauditoria: cobrindo móveis, BOM e marcações de página…',
    thought_kind: 'audit',
  })

  const reauditMode = row.mode === 'pro' ? 'pro' : 'max'
  let aud: Awaited<ReturnType<typeof invokeOrcamentosIaPhase>>
  try {
    aud = await invokeOrcamentosIaPhase({
      analysisId: params.analysisId,
      companyId: params.companyId,
      mode: reauditMode,
      extraction_model: reauditExtractionModel,
      pagePaths: paths.slice(0, reauditMode === 'max' ? 12 : 24),
      phase: 'audit',
      inventory,
      extraction: seedExtraction,
      models: ORCAMENTOS_IA_MODELS,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    await setAnalysisStatus(params.analysisId, 'COMPLETED', {
      pipeline_stage: 'completed',
      pipeline_detail: 'Reauditoria incompleta — preços e lista foram mantidos.',
      thought_kind: 'warn',
      thought: true,
    })
    return { ok: false, error: message }
  }

  const auditedRaw = aud.extraction && typeof aud.extraction === 'object' ? aud.extraction : null
  const audited = auditedRaw
    ? forceDeduplicateViewQuantities(mergeExtractions([auditedRaw]))
    : null
  const reauditBatchPages = pageNumbersFromTotals(reauditTotals)
  const coverage =
    aud.coverage ??
    (reauditBatchPages.length
      ? buildScopedCoverageReport(inventory, audited ?? seedExtraction, reauditBatchPages)
      : buildCoverageReport(inventory, audited ?? seedExtraction))
  const auditNeedsRerun =
    aud.auditNeedsRerun === true ||
    coverage.missing.length > 0 ||
    (aud.bomGaps?.length ?? 0) > 0 ||
    (aud.hallucinationScore ?? 0) > 0

  let updatedModules = 0
  if (audited && typeof audited === 'object') {
    const envs = Array.isArray((audited as { environments?: unknown }).environments)
      ? ((audited as { environments: Array<{ name?: string; modules?: unknown[] }> }).environments)
      : []
    for (const env of envs) {
      const treeEnv = tree.environments.find(
        (e) =>
          normalizeKey(e.name) === normalizeKey(env.name || '') ||
          modulesMatchCoverage(e.name, env.name || ''),
      )
      if (!treeEnv) continue
      for (const mod of Array.isArray(env.modules) ? env.modules : []) {
        if (!mod || typeof mod !== 'object') continue
        const rec = mod as Record<string, unknown>
        const name = typeof rec.name === 'string' ? rec.name : ''
        const treeMod = treeEnv.modules.find(
          (m) =>
            normalizeKey(m.name) === normalizeKey(name) || modulesMatchCoverage(m.name, name),
        )
        if (!treeMod) continue
        const bbox = rec.bounding_box
        const page =
          pageFromBoundingBox(bbox) ??
          (typeof rec.page_number === 'number' ? rec.page_number : null)
        if (!page && !bbox) continue
        const pagePath = buildPageImagePath(params.companyId, params.analysisId, page, paths)
        const { error: upErr } = await supabase
          .from('quote_modules')
          .update({
            bounding_box: bbox && typeof bbox === 'object' ? bbox : treeMod.bounding_box,
            page_number: page ?? treeMod.page_number,
            page_image_path: pagePath ?? treeMod.page_image_path,
          })
          .eq('id', treeMod.id)
        if (!upErr) updatedModules += 1
      }
    }
  }

  const flatMats = tree.environments.flatMap((e) => e.modules.flatMap((m) => m.materials))
  const repriced = await repriceZeroMaterials({
    companyId: params.companyId,
    materials: flatMats,
  })

  const notes = Array.isArray((audited as { auditor_notes?: unknown } | null)?.auditor_notes)
    ? ((audited as { auditor_notes: string[] }).auditor_notes)
    : Array.isArray(prevTotals.auditor_notes)
      ? (prevTotals.auditor_notes as string[])
      : []

  const reauditTree = await loadQuoteAnalysisTree(params.analysisId)
  const reauditMats =
    reauditTree.data?.environments.flatMap((e) => e.modules.flatMap((m) => m.materials)) ||
    flatMats
  const reauditPricingParams: PricingParams = {
    ...DEFAULT_PRICING_PARAMS,
    modality: normalizePricingModality(
      (prevTotals.pricing_modality as string) || DEFAULT_PRICING_PARAMS.modality,
    ),
  }
  const reauditPricing = reauditTree.data
    ? calculateQuotePricing(reauditTree.data, reauditPricingParams)
    : null
  const reauditFinancial = {
    materials_cost: reauditPricing?.materialsCost ?? (Number(prevTotals.materials_cost) || 0),
    cost_price: reauditPricing?.materialsCost ?? (Number(prevTotals.cost_price) || 0),
    sale_price: reauditPricing?.salePrice ?? (Number(prevTotals.sale_price) || 0),
    mpc_margin_pct: reauditPricingParams.mpcPercent,
    multiplier_n: reauditPricingParams.materialMultiplier,
    pricing_modality: reauditPricing?.modality ?? reauditPricingParams.modality,
    pricing_formula: reauditPricing?.formulaLabel ?? null,
    priced_at: new Date().toISOString(),
    using_facade_sqm: false,
  }
  const reauditExtraction =
    audited ?? forceDeduplicateViewQuantities(mergeExtractions([seedExtraction]))
  const reauditDup = validatePlausibleQuantities(reauditExtraction)
  const reauditCoverageScope: CoverageScope = reauditBatchPages.length ? 'batch' : 'project'
  const reauditBreaker = evaluateCircuitBreaker({
    extraction: reauditExtraction,
    materials: reauditMats,
    coverage,
    pricing: reauditFinancial,
    duplicateFlags: reauditDup,
    enforceBrancoTx: true,
    pagesTotal:
      reauditCoverageScope === 'batch'
        ? reauditBatchPages.length || paths.length
        : paths.length,
    coverageScope: reauditCoverageScope,
  })
  const reauditStatus: QuoteAnalysisStatus =
    !reauditBreaker.ok || auditNeedsRerun ? 'NEEDS_REVIEW' : 'COMPLETED'

  await setAnalysisStatus(params.analysisId, reauditStatus, {
    error_message: reauditBreaker.ok ? null : reauditBreaker.blockers[0] || null,
    pipeline_stage: reauditStatus === 'COMPLETED' ? 'completed' : 'needs_review',
    pipeline_detail: !reauditBreaker.ok
      ? `Circuit breaker: ${reauditBreaker.blockers.slice(0, 2).join(' | ')}`
      : auditNeedsRerun
        ? 'Reauditoria: ainda há pontos a conferir (cobertura/BOM/marcações).'
        : 'Reauditoria concluída — móveis e preços conferidos.',
    thought_kind: reauditBreaker.ok ? 'done' : 'warn',
    pricing_modality: reauditFinancial.pricing_modality,
    pricing_params: {
      mpcPercent: reauditPricingParams.mpcPercent,
      materialMultiplier: reauditPricingParams.materialMultiplier,
      mpc_margin_pct: reauditPricingParams.mpcPercent,
      multiplier_n: reauditPricingParams.materialMultiplier,
      modality: reauditFinancial.pricing_modality,
    },
    totals: {
      ...prevTotals,
      ...reauditFinancial,
      circuit_breaker: reauditBreaker,
      duplicate_view_flags: reauditDup,
      coverage,
      coverage_scope: reauditCoverageScope,
      selected_pages: reauditBatchPages,
      page_ranges: reauditBatchPages.length ? reauditBatchPages : prevTotals.page_ranges,
      inventory,
      auditor_notes: notes,
      audit_needs_rerun: auditNeedsRerun || !reauditBreaker.ok,
      last_extraction: audited ?? prevTotals.last_extraction ?? seedExtraction,
      reaudit_at: new Date().toISOString(),
      reprice_updated: repriced.updated,
      warnings: [
        ...(Array.isArray(prevTotals.warnings) ? (prevTotals.warnings as string[]) : []),
        ...(coverage.missing.length
          ? [`Cobertura incompleta: ${coverage.missing.length} módulo(s) do inventário ainda faltando.`]
          : []),
      ].filter((v, i, a) => a.indexOf(v) === i),
    },
  })

  return { ok: true, auditNeedsRerun, updatedModules }
}

function normalizeKey(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Reprocessa um orçamento já existente.
 * Preferência: reusa páginas em pages/; se não houver, baixa o arquivo fonte.
 * `fromScratch: true` apaga checkpoint/partial e recomeça da página 1.
 */
export async function reprocessOrcamentosIaPipeline(params: {
  analysisId: string
  companyId: string
  /** Se true, zera partial_extraction / checkpoint e recomeça do zero. */
  fromScratch?: boolean
}): Promise<RunOrcamentosIaPipelineResult> {
  const { data: row, error } = await supabase
    .from('quote_analyses')
    .select('id, company_id, mode, extraction_model, source_pdf_path, totals, project_id')
    .eq('id', params.analysisId)
    .eq('company_id', params.companyId)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!row) return { ok: false, error: 'Análise não encontrada.' }

  const extractionModel = resolveExtractionModelParam(
    (row as { extraction_model?: string }).extraction_model,
  )
  const totals =
    row.totals && typeof row.totals === 'object' ? (row.totals as Record<string, unknown>) : {}
  const pageNumbers = pageNumbersFromTotals(totals)
  const projectId =
    typeof (row as { project_id?: string | null }).project_id === 'string'
      ? (row as { project_id: string }).project_id
      : null

  const analysisPagesPrefix = `${params.companyId}/${params.analysisId}/pages`
  const projectPagesPrefix = projectId
    ? `${params.companyId}/quote-projects/${projectId}/pages`
    : null
  const { data: existingAnalysis } = await supabase.storage
    .from(ORCAMENTOS_IA_BUCKET)
    .list(analysisPagesPrefix, { limit: 5 })
  const { data: existingProject } = projectPagesPrefix
    ? await supabase.storage
        .from(ORCAMENTOS_IA_BUCKET)
        .list(projectPagesPrefix, { limit: 5 })
    : { data: null }

  const hasPages =
    (existingAnalysis || []).some((o) => /\.(png|jpe?g|webp)$/i.test(o.name)) ||
    (existingProject || []).some((o) => /\.(png|jpe?g|webp)$/i.test(o.name))

  const fromScratch = params.fromScratch === true
  const batchLabel =
    typeof totals.batch_label === 'string' && totals.batch_label.trim()
      ? totals.batch_label.trim()
      : pageNumbers.length
        ? formatPageRanges(pageNumbers)
        : null

  // Recomeçar do zero: limpa BOM/ambientes e checkpoint async
  if (fromScratch) {
    const { data: oldEnvs } = await supabase
      .from('quote_environments')
      .select('id')
      .eq('analysis_id', params.analysisId)
    if (oldEnvs?.length) {
      await supabase
        .from('quote_environments')
        .delete()
        .in(
          'id',
          oldEnvs.map((e) => e.id),
        )
    }
    try {
      await supabase.from('bom_items').delete().eq('analysis_id', params.analysisId)
    } catch {
      /* tabela pode não existir em ambientes antigos */
    }
  }

  const checkpointPage = Number(totals.current_page)
  const partial = totals.partial_extraction
  const hasPartial =
    !fromScratch &&
    partial &&
    typeof partial === 'object' &&
    Array.isArray((partial as { environments?: unknown }).environments)
  const resumeFromPage =
    !fromScratch &&
    hasPages &&
    hasPartial &&
    Number.isFinite(checkpointPage) &&
    checkpointPage > 0
      ? Math.floor(checkpointPage)
      : undefined

  // Pasta incremental: Retomar SEMPRE reancora page_ranges do lote (pré-config).
  if (projectId && !pageNumbers.length && !fromScratch) {
    return {
      ok: false,
      error:
        'Este lote da pasta não tem páginas selecionadas (page_ranges). Escolha as páginas na grade e inicie de novo.',
    }
  }

  const resumeDetail = fromScratch
    ? batchLabel
      ? `Recomeçando do zero o lote págs. ${batchLabel} — checkpoint limpo…`
      : 'Recomeçando do zero — checkpoint e extração parcial limpos…'
    : resumeFromPage
      ? batchLabel
        ? `Retomando lote págs. ${batchLabel} na página ${resumeFromPage + 1}…`
        : `Retomando na página ${resumeFromPage + 1}…`
      : batchLabel
        ? `Retomando lote págs. ${batchLabel} — reusando o que já converteu e completando o resto…`
        : 'Preparando reprocessamento…'

  const pricingReady = !fromScratch && isReadyForClientPricing(totals)
  const pricingReadyDetail = batchLabel
    ? `Retomando precificação do lote págs. ${batchLabel} — leitura já pronta…`
    : 'Retomando precificação — leitura já pronta na nuvem…'

  await setAnalysisStatus(params.analysisId, pricingReady ? 'AUDITING_REVISION' : 'PENDING', {
    error_message: null,
    pipeline_stage: fromScratch
      ? 'upload'
      : pricingReady
        ? 'pricing_pending'
        : resumeFromPage
          ? 'extracting_batch'
          : 'converting_pages',
    pipeline_detail: pricingReady ? pricingReadyDetail : resumeDetail,
    thought_kind: pricingReady ? 'audit' : 'info',
    totals: fromScratch
      ? {
          current_page: 0,
          partial_extraction: null,
          async_chain_status: null,
          extraction_lot: null,
          inventory: null,
          coverage: null,
          consolidated_bom: null,
          project_sheet_palette: null,
          bom_gaps: null,
          self_heal: null,
          circuit_breaker: null,
          modules_found_count: 0,
          thought_log: [],
          ...(pageNumbers.length
            ? {
                page_ranges: pageNumbers,
                selected_pages: pageNumbers,
                batch_label: batchLabel,
              }
            : {}),
        }
      : pricingReady
        ? {
            // Mantém partial_extraction / async_chain — só retoma precificação.
            async_chain_status: 'ready_for_pricing',
            pipeline_stage: 'pricing_pending',
            ...(pageNumbers.length
              ? {
                  page_ranges: pageNumbers,
                  selected_pages: pageNumbers,
                  batch_label: batchLabel,
                }
              : {}),
          }
        : {
            async_chain_status: resumeFromPage ? 'running' : null,
            pipeline_stage: resumeFromPage ? 'extracting_batch' : 'converting_pages',
            ...(pageNumbers.length
              ? {
                  page_ranges: pageNumbers,
                  selected_pages: pageNumbers,
                  batch_label: batchLabel,
                }
              : {}),
          },
  })

  if (hasPages) {
    return runOrcamentosIaPipeline({
      analysisId: params.analysisId,
      companyId: params.companyId,
      mode: (row.mode === 'pro' ? 'pro' : 'max') as QuoteAnalysisMode,
      extractionModel,
      reuseExistingPages: true,
      resumeFromPage,
      pageNumbers: pageNumbers.length ? pageNumbers : undefined,
      projectId,
    })
  }

  if (!row.source_pdf_path) {
    return { ok: false, error: 'PDF/imagem original não encontrado para reprocessar.' }
  }

  let blob: Blob
  try {
    blob = await downloadOrcamentosIaObject(row.source_pdf_path)
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : 'Falha ao baixar o arquivo do Storage.',
    }
  }

  const fileName = row.source_pdf_path.split('/').pop() || 'projeto.pdf'
  const lower = fileName.toLowerCase()
  const mime = lower.endsWith('.pdf')
    ? 'application/pdf'
    : lower.endsWith('.webp')
      ? 'image/webp'
      : lower.endsWith('.png')
        ? 'image/png'
        : 'image/jpeg'
  const file = new File([blob], fileName, { type: mime })
  const mode = (row.mode === 'pro' ? 'pro' : 'max') as QuoteAnalysisMode

  // Mesmo sem JPEGs no Storage: se houver checkpoint, NÃO zerar partial na Edge
  // (exceto when fromScratch já limpou acima).
  return runOrcamentosIaPipeline({
    analysisId: params.analysisId,
    companyId: params.companyId,
    mode,
    extractionModel,
    sourceFiles: [file],
    resumeFromPage,
    pageNumbers: pageNumbers.length ? pageNumbers : undefined,
    projectId,
  })
}

/** Evita double-persist (React Strict Mode / reload paralelo). */
const repersistInFlight = new Map<
  string,
  Promise<{ ok: boolean; materialsSaved?: number; error?: string }>
>()

/**
 * Regrava ambientes/módulos/materiais/BOM a partir de `totals.last_extraction`.
 * Usado quando o lote tem extração + sale_price, mas as linhas do banco sumiram
 * (ex.: restore parcial) e a UI hidrata itens virtuais a R$ 0.
 */
export async function repersistQuoteAnalysisFromLastExtraction(params: {
  analysisId: string
  companyId: string
  /** Apaga ambientes atuais e regrava (útil após corrida que duplicou linhas). */
  force?: boolean
}): Promise<{ ok: boolean; materialsSaved?: number; error?: string }> {
  const existing = repersistInFlight.get(params.analysisId)
  if (existing) return existing

  const run = (async () => {
    const { data: row, error } = await supabase
      .from('quote_analyses')
      .select('id, company_id, project_id, mode, totals')
      .eq('id', params.analysisId)
      .maybeSingle()
    if (error || !row) {
      return { ok: false, error: error?.message || 'Análise não encontrada.' }
    }

    // Já há ambientes reais no banco → não regrava (evita duplicar), salvo force.
    if (!params.force) {
      const { count: envCount } = await supabase
        .from('quote_environments')
        .select('id', { count: 'exact', head: true })
        .eq('analysis_id', params.analysisId)
      if ((envCount ?? 0) > 0) {
        return { ok: true, materialsSaved: 0 }
      }
    }

    const totals =
      row.totals && typeof row.totals === 'object'
        ? (row.totals as Record<string, unknown>)
        : {}
    const raw = totals.last_extraction
    if (!raw || typeof raw !== 'object') {
      return { ok: false, error: 'Este lote não tem extração salva para regravar preços.' }
    }

    let parsed = quoteExtractionSchema.safeParse(raw)
    if (!parsed.success) {
      const cleaned = forceDeduplicateViewQuantities(mergeExtractions([raw]))
      parsed = quoteExtractionSchema.safeParse(cleaned)
    }
    if (!parsed.success) {
      const detail = parsed.error.issues
        .slice(0, 2)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')
      return {
        ok: false,
        error: `Extração salva inválida${detail ? ` (${detail})` : ''}. Rode a cotação de novo.`,
      }
    }

    const preferredPaths = Array.isArray(totals.page_paths)
      ? (totals.page_paths as unknown[]).filter((p): p is string => typeof p === 'string')
      : []
    const projectId =
      typeof row.project_id === 'string' && row.project_id.trim()
        ? row.project_id
        : null
    const listed = await listQuotePagePaths(params.companyId, params.analysisId, {
      projectId,
      preferredPaths,
    })
    const pageNumbers = Array.isArray(totals.page_ranges)
      ? [
          ...new Set(
            (totals.page_ranges as unknown[]).filter(
              (n): n is number => typeof n === 'number' && Number.isInteger(n) && n > 0,
            ),
          ),
        ].sort((a, b) => a - b)
      : []

    try {
      const result = await nodeResolvePricesAndPersist({
        analysisId: params.analysisId,
        companyId: params.companyId,
        mode: (row.mode as QuoteAnalysisMode) || 'max',
        extractionModel: DEFAULT_EXTRACTION_MODEL,
        sourceFiles: [],
        pdfFile: null,
        pagePaths: listed.paths,
        pageNumbers,
        projectId,
        extraction: parsed.data,
        materialsSaved: 0,
        error: null,
        resumeFromPage: null,
      })
      return { ok: true, materialsSaved: result.materialsSaved }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Falha ao regravar preços.'
      return { ok: false, error: message }
    }
  })()

  repersistInFlight.set(params.analysisId, run)
  try {
    return await run
  } finally {
    repersistInFlight.delete(params.analysisId)
  }
}

/** Reexport útil para UI / testes. */
export { quoteExtractionSchema }
