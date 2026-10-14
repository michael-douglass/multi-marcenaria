import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import { supabase } from '@/lib/supabase'
import {
  convertPdfPagesToJpegSequential,
  resizeImageToOrcamentosJpeg,
} from '@/lib/pdf-to-image'
import {
  DEFAULT_EXTRACTION_MODEL,
  isExtractionModelKey,
  ORCAMENTOS_IA_MODELS,
  type ExtractionModelKey,
} from '@/lib/orcamentos-ia/openai-models'
import {
  ORCAMENTOS_IA_BUCKET,
  appendThoughtLog,
  thoughtKindForStage,
  type QuoteAnalysisMode,
  type QuoteAnalysisStatus,
} from '@/lib/orcamentos-ia/storage'
import {
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
  applyAntiHallucinationHeuristics,
  buildCoverageReport,
  buildPageImagePath,
  clampGeometryBounds,
  ensureModulePlaceholder,
  findMarcenariaBomGaps,
  forceDeduplicateViewQuantities,
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
      .select('totals')
      .eq('id', analysisId)
      .maybeSingle()
    const prev =
      current?.totals && typeof current.totals === 'object'
        ? (current.totals as Record<string, unknown>)
        : {}

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

async function nodeConvertPages(state: PipelineStateType): Promise<Partial<PipelineStateType>> {
  await setAnalysisStatus(state.analysisId, 'CONVERTING_PAGES', {
    pipeline_stage: 'converting_pages',
    pipeline_detail: 'Preparando as páginas do projeto para a IA enxergar o desenho…',
  })

  // Reusa páginas já existentes (reprocessamento de PDF ou imagens)
  const pagesPrefix = `${state.companyId}/${state.analysisId}/pages`
  const { data: existing } = await supabase.storage
    .from(ORCAMENTOS_IA_BUCKET)
    .list(pagesPrefix, { limit: 100, sortBy: { column: 'name', order: 'asc' } })
  const existingPaths = (existing || [])
    .filter((o) => /\.(png|jpe?g|webp)$/i.test(o.name))
    .map((o) => `${pagesPrefix}/${o.name}`)
    .sort()

  const files =
    state.sourceFiles?.length > 0
      ? state.sourceFiles
      : state.pdfFile
        ? [state.pdfFile]
        : []

  // Se já há páginas e não há novos arquivos (reprocess só IA), reutiliza
  if (existingPaths.length > 0 && files.length === 0) {
    await setAnalysisStatus(state.analysisId, 'CONVERTING_PAGES', {
      pipeline_stage: 'converting_pages',
      pipeline_detail: `Já tenho ${Math.min(existingPaths.length, MAX_PIPELINE_PAGES)} página(s) pronta(s) — reaproveitando sem converter de novo.`,
      totals: { pages_processed: Math.min(existingPaths.length, MAX_PIPELINE_PAGES) },
    })
    return { pagePaths: existingPaths.slice(0, MAX_PIPELINE_PAGES) }
  }

  if (!files.length && existingPaths.length > 0) {
    return { pagePaths: existingPaths.slice(0, MAX_PIPELINE_PAGES) }
  }

  if (!files.length) {
    throw new Error('Nenhum PDF ou imagem para converter.')
  }

  const pagePaths: string[] = []
  let pageIndex = 0

  for (const file of files) {
    if (pageIndex >= MAX_PIPELINE_PAGES) break

    if (isPdfFile(file)) {
      await setAnalysisStatus(state.analysisId, 'CONVERTING_PAGES', {
        pipeline_stage: 'converting_pages',
        pipeline_detail: `Abrindo o PDF “${file.name}” e transformando cada folha em imagem…`,
      })

      const remaining = MAX_PIPELINE_PAGES - pageIndex
      await convertPdfPagesToJpegSequential(await file.arrayBuffer(), {
        maxPages: remaining,
        onPage: async ({ pageNumber, totalPages, blob }) => {
          pageIndex += 1
          const path = `${state.companyId}/${state.analysisId}/pages/page-${String(pageIndex).padStart(3, '0')}.jpg`
          const { error } = await supabase.storage.from(ORCAMENTOS_IA_BUCKET).upload(path, blob, {
            contentType: 'image/jpeg',
            upsert: true,
            cacheControl: '3600',
          })
          if (error) throw new Error(`Falha ao enviar página ${pageIndex}: ${error.message}`)
          pagePaths.push(path)
          await setAnalysisStatus(state.analysisId, 'CONVERTING_PAGES', {
            pipeline_stage: 'converting_pages',
            pipeline_detail: `Transformando página ${pageIndex} de ${totalPages} do PDF em imagem…`,
            totals: {
              pages_processed: pageIndex,
              pages_total: totalPages,
              conversion_page: pageNumber,
            },
            // Evita spam no thought_log; só marcos 1, a cada 3 e a última
            thought: pageIndex === 1 || pageIndex % 3 === 0 || pageIndex === totalPages,
          })
        },
      })
      continue
    }

    if (isImageFile(file)) {
      pageIndex += 1
      const jpegBlob = await resizeImageToOrcamentosJpeg(file)
      const path = `${state.companyId}/${state.analysisId}/pages/page-${String(pageIndex).padStart(3, '0')}.jpg`
      const { error } = await supabase.storage.from(ORCAMENTOS_IA_BUCKET).upload(path, jpegBlob, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '3600',
      })
      if (error) throw new Error(`Falha ao enviar imagem ${pageIndex}: ${error.message}`)
      pagePaths.push(path)
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

  if (pagePaths.length >= MAX_PIPELINE_PAGES) {
    await setAnalysisStatus(state.analysisId, 'CONVERTING_PAGES', {
      pipeline_stage: 'converting_pages',
      pipeline_detail: `Processadas as primeiras ${MAX_PIPELINE_PAGES} páginas.`,
      totals: {
        pages_processed: pagePaths.length,
        pages_cap: MAX_PIPELINE_PAGES,
        pages_warning: `Processadas as primeiras ${MAX_PIPELINE_PAGES} páginas.`,
        source_files: files.map((f) => f.name),
      },
    })
  }

  return { pagePaths }
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

  while (true) {
    const { data, error } = await supabase
      .from('quote_analyses')
      .select('status, totals, error_message')
      .eq('id', analysisId)
      .maybeSingle()

    if (error) throw new Error(error.message)
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

    if (data?.status === 'FAILED' || chainStatus === 'failed') {
      throw new Error(
        (typeof totals.pipeline_detail === 'string' && totals.pipeline_detail) ||
          data?.error_message ||
          'Cadeia async falhou. Clique em Retomar.',
      )
    }

    if (chainStatus === 'ready_for_pricing' || totals.pipeline_stage === 'pricing_pending') {
      const inventory = sanitizeInventory(
        Array.isArray(totals.inventory) ? (totals.inventory as InventoryEnv[]) : [],
      )
      const extraction =
        totals.partial_extraction && typeof totals.partial_extraction === 'object'
          ? totals.partial_extraction
          : { environments: [], auditor_notes: [], warnings: [] }
      return { extraction, inventory }
    }

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
  // Default-with-Override: lê company_standards (system_preferences) e injeta no Extrator/Auditor
  let prefsPrompt = ''
  let invokePrefs = DEFAULT_COMPANY_STANDARDS(state.companyId)
  try {
    invokePrefs = await getSystemPreferences(state.companyId)
    prefsPrompt = formatPreferencesForPrompt(invokePrefs)
  } catch {
    prefsPrompt = formatPreferencesForPrompt(invokePrefs)
  }
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

  const asyncReady = await waitForAsyncChainReady(state.analysisId)
  const inventory = asyncReady.inventory
  let mergedRaw = forceDeduplicateViewQuantities(mergeExtractions([asyncReady.extraction]))

  const finalizeExtractionTree = (raw: unknown): QuoteExtraction => {
    // Lock dormitório antes das heurísticas — evita Cozinha fantasma (Painel TV / Mesa cabeceira)
    const rebalanced = rebalanceEnvironments(raw, inventory)
    const merged = forceDeduplicateViewQuantities(mergeExtractions([rebalanced]))
    let sanitized = sanitizeExtractionPayload(
      clampGeometryBounds(applyAntiHallucinationHeuristics(merged)),
    )
    let parsed = quoteExtractionSchema.safeParse(sanitized)
    if (!parsed.success) {
      sanitized = sanitizeExtractionPayload(
        clampGeometryBounds(applyAntiHallucinationHeuristics(sanitized)),
      )
      parsed = quoteExtractionSchema.safeParse(sanitized)
    }
    if (!parsed.success) {
      sanitized = sanitizeExtractionPayload(stripNullOptionals(sanitized))
      parsed = quoteExtractionSchema.safeParse(sanitized)
    }
    if (!parsed.success) {
      const detail = parsed.error.issues
        .slice(0, 3)
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ')
      throw new Error(
        `Resposta do Extrator fora do schema esperado${detail ? ` (${detail})` : ''}.`,
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
  let coverage = buildCoverageReport(inventory, tree)

  /**
   * Self-Heal cirúrgico (v12.2):
   * 1) Uma chamada heal_module só para os faltantes (sem re-extrair todos os lotes)
   * 2–3) Injeção forçada determinística + auditoria com lock
   * Status permanece AUDITING_REVISION (sem piscar EXTRACTING_MODULES).
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

  const publishSelfHealStatus = async (detail: string) => {
    await setAnalysisStatus(state.analysisId, 'AUDITING_REVISION', {
      pipeline_stage: 'self_heal',
      pipeline_detail: detail,
      thought_kind: 'audit',
      thought: true,
      totals: {
        inventory,
        coverage,
        self_heal: {
          ...selfHeal,
          missing_after: coverage.missing.map((m) => ({ ...m })),
        },
        pages_processed: state.pagePaths.length,
      },
    })
  }

  while (coverage.missing.length > 0 && selfHeal.attempts < SELF_HEAL_MAX) {
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
          inventory,
          missingModules: coverage.missing,
          currentExtraction: tree,
          extraction: tree,
          healFeedback,
          ragMemoriesPrompt: [ragPrompt, healFeedback].filter(Boolean).join('\n\n'),
          models: ORCAMENTOS_IA_MODELS,
        })
        if (part.extraction) {
          const mergedHeal = forceDeduplicateViewQuantities(
            mergeExtractions([tree, part.extraction]),
          )
          tree = finalizeExtractionTree(mergedHeal)
          coverage = buildCoverageReport(inventory, tree)
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
      coverage = buildCoverageReport(inventory, tree)
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
        'Se ainda faltar item do inventário, reinjecte com dims/materiais padrão do ambiente.',
        'Cobertura 100% do inventário é obrigatória antes de encerrar.',
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
          inventory,
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
      // Rede de segurança: se o auditor removeu algo do inventário, re-injeta
      coverage = buildCoverageReport(inventory, tree)
      if (coverage.missing.length > 0) {
        try {
          tree = finalizeExtractionTree(injectMissingInventoryModules(tree, coverage.missing))
          coverage = buildCoverageReport(inventory, tree)
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

  await setAnalysisStatus(state.analysisId, 'FETCHING_MARKET_PRICES', {
    pipeline_stage: 'fetching_prices',
    pipeline_detail: 'Cruzando cada item com estoque e tabela de mercado…',
    thought_kind: 'price',
    totals: {
      inventory,
      coverage,
      bom_gaps: bomGaps,
      self_heal: selfHeal,
      pages_processed: state.pagePaths.length,
    },
  })

  return { extraction: tree }
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

  await setAnalysisStatus(state.analysisId, 'FETCHING_MARKET_PRICES', {
    pipeline_stage: 'fetching_prices',
    pipeline_detail: 'Aplicando preços e montando a lista de insumos do orçamento…',
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

  for (const [envIndex, env] of state.extraction.environments.entries()) {
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
  const coverage =
    (prevTotals.coverage as CoverageReport | undefined) ??
    buildCoverageReport(inventory, state.extraction)

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
  const duplicateFlags = validatePlausibleQuantities(state.extraction)
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

  const breaker = evaluateCircuitBreaker({
    extraction: state.extraction,
    materials: flatMats,
    coverage,
    pricing: financialTotals,
    prefs: systemPrefs,
    duplicateFlags,
    enforceBrancoTx: true,
  })

  const nextTotals: Record<string, unknown> = {
    ...prevTotals,
    materials_count: materialsSaved,
    bom_items_count: bomItemsSaved,
    market_price_flags: marketFlags,
    out_of_scope_modules: outOfScopeCount,
    environments: state.extraction.environments.length,
    modules: state.extraction.environments.reduce((n, e) => n + e.modules.length, 0),
    auditor_notes: state.extraction.auditor_notes,
    engineering_cot: engineeringCot.join('\n\n'),
    pricing_note:
      'v12: venda apenas por BOM (MPC% ou ×N) — circuit breaker; proibido m² de fachada',
    warnings: [
      ...(Array.isArray(state.extraction.warnings) ? state.extraction.warnings : []),
      ...(coverage.missing.length
        ? [
            `Cobertura incompleta: ${coverage.missing.length} módulo(s) do inventário ainda faltando.`,
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
    last_extraction: state.extraction,
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
    return { materialsSaved }
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

  return { materialsSaved }
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

  const app = buildPipelineGraph()
  const result = await app.invoke({
    analysisId: params.analysisId,
    companyId: params.companyId,
    mode: params.mode,
    extractionModel: resolveExtractionModelParam(params.extractionModel),
    sourceFiles: params.reuseExistingPages ? [] : sourceFiles,
    pdfFile: null,
    pagePaths: [],
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
    .select('id, company_id, mode, extraction_model, totals, source_pdf_path')
    .eq('id', params.analysisId)
    .eq('company_id', params.companyId)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!row) return { ok: false, error: 'Análise não encontrada.' }

  const { paths } = await listQuotePagePaths(params.companyId, params.analysisId)
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
  const coverage =
    aud.coverage ??
    buildCoverageReport(inventory, audited ?? seedExtraction)
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
  const reauditBreaker = evaluateCircuitBreaker({
    extraction: reauditExtraction,
    materials: reauditMats,
    coverage,
    pricing: reauditFinancial,
    duplicateFlags: reauditDup,
    enforceBrancoTx: true,
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
 */
export async function reprocessOrcamentosIaPipeline(params: {
  analysisId: string
  companyId: string
}): Promise<RunOrcamentosIaPipelineResult> {
  const { data: row, error } = await supabase
    .from('quote_analyses')
    .select('id, company_id, mode, extraction_model, source_pdf_path, totals')
    .eq('id', params.analysisId)
    .eq('company_id', params.companyId)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!row) return { ok: false, error: 'Análise não encontrada.' }

  const extractionModel = resolveExtractionModelParam(
    (row as { extraction_model?: string }).extraction_model,
  )
  const pagesPrefix = `${params.companyId}/${params.analysisId}/pages`
  const { data: existing } = await supabase.storage
    .from(ORCAMENTOS_IA_BUCKET)
    .list(pagesPrefix, { limit: 5 })

  const hasPages = (existing || []).some((o) => /\.(png|jpe?g|webp)$/i.test(o.name))

  const totals =
    row.totals && typeof row.totals === 'object' ? (row.totals as Record<string, unknown>) : {}
  const checkpointPage = Number(totals.current_page)
  const partial = totals.partial_extraction
  const hasPartial =
    partial &&
    typeof partial === 'object' &&
    Array.isArray((partial as { environments?: unknown }).environments)
  const resumeFromPage =
    hasPages &&
    hasPartial &&
    Number.isFinite(checkpointPage) &&
    checkpointPage > 0
      ? Math.floor(checkpointPage)
      : undefined

  await setAnalysisStatus(params.analysisId, 'PENDING', {
    error_message: null,
    totals: {
      async_chain_status: resumeFromPage ? 'running' : null,
      pipeline_stage: resumeFromPage ? 'extracting_batch' : totals.pipeline_stage,
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
    })
  }

  if (!row.source_pdf_path) {
    return { ok: false, error: 'PDF/imagem original não encontrado para reprocessar.' }
  }

  const { data: blob, error: dlError } = await supabase.storage
    .from(ORCAMENTOS_IA_BUCKET)
    .download(row.source_pdf_path)

  if (dlError || !blob) {
    return { ok: false, error: dlError?.message || 'Falha ao baixar o arquivo do Storage.' }
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

  return runOrcamentosIaPipeline({
    analysisId: params.analysisId,
    companyId: params.companyId,
    mode,
    extractionModel,
    sourceFiles: [file],
  })
}

/** Reexport útil para UI / testes. */
export { quoteExtractionSchema }
