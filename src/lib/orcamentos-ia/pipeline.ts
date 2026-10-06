import { Annotation, END, START, StateGraph } from '@langchain/langgraph'
import { supabase } from '@/lib/supabase'
import { convertPdfPagesToJpegSequential } from '@/lib/pdf-to-image'
import { ORCAMENTOS_IA_MODELS } from '@/lib/orcamentos-ia/openai-models'
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
  CONTINGENCY_PRICE_WARNING,
  createPriceResolver,
  DEFAULT_SHEET_LOSS_PCT,
  endCapsForHandleBars,
  sheetsFromAreaM2,
  type ResolvedMaterialPrice,
} from '@/lib/orcamentos-ia/pricing'
import {
  buildCoverageReport,
  buildPageImagePath,
  ensureModulePlaceholder,
  findMarcenariaBomGaps,
  mergeExtractions,
  pageFromBoundingBox,
  type CoverageReport,
  type InventoryEnv,
} from '@/lib/orcamentos-ia/merge-extraction'
import {
  formatMemoriesForPrompt,
  getCompanyMemories,
} from '@/lib/orcamentos-ia/memory'
import {
  formatPreferencesForPrompt,
  getSystemPreferences,
} from '@/lib/orcamentos-ia/system-preferences'
import {
  clearBomItemsForProject,
  explodeModuleForPersist,
  insertBomItems,
  validateBomLines,
} from '@/lib/orcamentos-ia/bom-persist'

/**
 * Pipeline multi-agente (Fase 3).
 * - Orquestração: LangGraph no cliente (status + páginas + persistência).
 * - Visão/extração/auditoria: Edge Function `orcamentos-ia-pipeline`
 *   (OpenAI gpt-4o + o3-mini; chave só no servidor).
 * - Preços: `createPriceResolver` (alias → inventory → market → contingência; nunca R$ 0).
 */

const MAX_PIPELINE_PAGES = 40

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
    })
    .eq('id', analysisId)
  if (error) throw new Error(error.message)
}

const PipelineState = Annotation.Root({
  analysisId: Annotation<string>,
  companyId: Annotation<string>,
  mode: Annotation<QuoteAnalysisMode>,
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
      const ext = file.name.toLowerCase().endsWith('.webp')
        ? 'webp'
        : file.name.toLowerCase().match(/\.jpe?g$/)
          ? 'jpg'
          : 'png'
      const path = `${state.companyId}/${state.analysisId}/pages/page-${String(pageIndex).padStart(3, '0')}.${ext}`
      const contentType =
        file.type ||
        (ext === 'jpg' ? 'image/jpeg' : ext === 'webp' ? 'image/webp' : 'image/png')
      const { error } = await supabase.storage.from(ORCAMENTOS_IA_BUCKET).upload(path, file, {
        contentType,
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
  let prefsPrompt = ''
  try {
    const prefs = await getSystemPreferences(state.companyId)
    prefsPrompt = formatPreferencesForPrompt(prefs)
  } catch {
    prefsPrompt = formatPreferencesForPrompt({
      company_id: state.companyId,
      base_assembly: 'under_sides',
      top_assembly: 'over_sides',
      mounting_device: 'minifix_dowel',
      back_panel_type: 'grooved',
      back_panel_thickness: 6,
      drawer_slide_type: 'telescopic',
      front_gap_mm: 2,
      box_thickness_mm: 15,
      shelf_recess_mm: 10,
      edgeband_policy: 'visible_edges',
    })
  }
  const ragPrompt = [prefsPrompt, formatMemoriesForPrompt(memories)].filter(Boolean).join('\n\n')

  await setAnalysisStatus(state.analysisId, 'EXTRACTING_MODULES', {
    pipeline_stage: 'extracting_batch',
    pipeline_detail:
      'Caçando chapas MDF, puxadores e ferragens nas pranchas — isso pode levar alguns minutos…',
    thought_kind: 'vision',
  })

  const { data, error } = await supabase.functions.invoke('orcamentos-ia-pipeline', {
    body: {
      analysisId: state.analysisId,
      companyId: state.companyId,
      mode: state.mode,
      pagePaths: state.pagePaths,
      models: ORCAMENTOS_IA_MODELS,
      ragMemoriesPrompt: ragPrompt,
    },
  })

  if (error) {
    throw new Error(error.message || 'Falha ao chamar o pipeline de IA.')
  }

  const payload = data as {
    ok?: boolean
    error?: string
    extraction?: unknown
    inventory?: InventoryEnv[]
    coverage?: CoverageReport
    pagesProcessed?: number
  }

  if (!payload?.ok) {
    throw new Error(payload?.error || 'Pipeline de IA retornou erro.')
  }

  const merged = mergeExtractions([payload.extraction])
  const sanitized = sanitizeExtractionPayload(merged)
  const parsed = quoteExtractionSchema.safeParse(sanitized)
  if (!parsed.success) {
    const detail = parsed.error.issues
      .slice(0, 3)
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('; ')
    throw new Error(
      `Resposta do Extrator fora do schema esperado${detail ? ` (${detail})` : ''}.`,
    )
  }

  const estimatedPieces = parsed.data.environments
    .flatMap((e) => e.modules)
    .flatMap((mod) => [...mod.caixaria, ...mod.frentes_portas])
    .filter((p) => p.dimensions_estimated).length
  // Peça maior que a chapa padrão (2750×1850) nas duas orientações: IA agregou o móvel inteiro
  const oversized = parsed.data.environments
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
    parsed.data.warnings.push(
      `Peça(s) maiores que a chapa 2750×1850 — confira se a IA agrupou o móvel: ${oversized.slice(0, 5).join('; ')}`,
    )
  }
  if (estimatedPieces > 0) {
    parsed.data.warnings.push(
      `${estimatedPieces} peça(s) sem cota no projeto — medidas estimadas pelo tipo (confira na auditoria).`,
    )
  }

  const inventory = Array.isArray(payload.inventory) ? payload.inventory : []
  const coverage =
    payload.coverage ?? buildCoverageReport(inventory, parsed.data)

  const bomGaps = findMarcenariaBomGaps(parsed.data)
  if (bomGaps.length) {
    const detail = bomGaps
      .slice(0, 5)
      .map((g) => `${g.module}: ${g.reason}`)
      .join('; ')
    console.warn('[pipeline] BOM gaps após auditor:', detail)
  }

  await setAnalysisStatus(state.analysisId, 'FETCHING_MARKET_PRICES', {
    pipeline_stage: 'fetching_prices',
    pipeline_detail: 'Cruzando cada item com estoque e tabela de mercado…',
    thought_kind: 'price',
    totals: {
      inventory,
      coverage,
      bom_gaps: bomGaps,
      pages_processed: payload.pagesProcessed ?? state.pagePaths.length,
    },
  })

  return { extraction: parsed.data }
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
          m.caixaria = coercePositiveList(m.caixaria, ['quantity'])
          m.frentes_portas = coercePositiveList(m.frentes_portas, ['quantity'])
          m.ferragens = coercePositiveList(m.ferragens, ['exact_quantity', 'full_units_quantity'])
          m.fitas_borda_m = coercePositiveList(m.fitas_borda_m, ['meters'])

          m = ensureModulePlaceholder(m)
          return m
        })
        .filter(Boolean)
      if (!cleanedModules.length) return null
      return { ...e, modules: cleanedModules }
    })
    .filter(Boolean)

  return { ...root, environments }
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
  const resolver = await createPriceResolver(state.companyId)
  const price = (name: string, category: string) => assertPriced(resolver.resolve(name, category), name)

  let systemPrefs: Awaited<ReturnType<typeof getSystemPreferences>> | null = null
  try {
    systemPrefs = await getSystemPreferences(state.companyId)
  } catch {
    systemPrefs = null
  }
  await clearBomItemsForProject(state.analysisId)

  /** Chapa em m²: área real × R$/m² (perda aplicada no custo e na lista de compras). */
  const areaRow = (
    p: ResolvedMaterialPrice,
    widthMm: number,
    heightMm: number,
    qty: number,
  ) => {
    const areaM2 = Math.round(((widthMm * heightMm * qty) / 1_000_000) * 1000) / 1000
    const perM2 = p.pricePerM2 && p.pricePerM2 > 0 ? p.pricePerM2 : null
    return perM2
      ? {
          unit_price: perM2,
          exact_quantity: areaM2,
          full_units_quantity: sheetsFromAreaM2(areaM2, DEFAULT_SHEET_LOSS_PCT),
          unit_measure: 'm2',
        }
      : {
          // Sem preço por m² derivável → mantém unidade do cadastro
          unit_price: p.unitPrice,
          exact_quantity: qty,
          full_units_quantity: Math.ceil(qty),
          unit_measure: p.unit || 'un',
        }
  }

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

      const withPage = (
        row: Record<string, unknown>,
        bbox: unknown,
      ): Record<string, unknown> => {
        const page = pageFromBoundingBox(bbox) ?? modPage
        const inheritedBbox =
          bbox && typeof bbox === 'object'
            ? bbox
            : mod.bounding_box
              ? mod.bounding_box
              : page
                ? { page, x: 0, y: 0, width: 1, height: 1 }
                : null
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
        if (piecePrice.usingMarketPrice) marketFlags += 1
        materialRows.push(
          withPage(
            {
              module_id: modRow.id,
              raw_name: `${piece.name} — ${piece.material_name}`,
              category: 'chapa',
              system_material_id: piecePrice.inventoryItemId,
              using_market_price: piecePrice.usingMarketPrice,
              market_price_confirmed: false,
              ...areaRow(piecePrice, piece.width_mm, piece.height_mm, piece.quantity),
              notes: priceNotes(
                piecePrice,
                `função=${piece.function}; ${piece.width_mm}x${piece.height_mm}x${piece.thickness_mm}mm × ${piece.quantity}${piece.dimensions_estimated ? ' (medida estimada)' : ''}`,
              ),
            },
            piece.bounding_box,
          ),
        )
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
        if (frentePrice.usingMarketPrice) marketFlags += 1
        materialRows.push(
          withPage(
            {
              module_id: modRow.id,
              raw_name: `${frente.name} — ${frente.material_name}`,
              category: 'chapa',
              system_material_id: frentePrice.inventoryItemId,
              using_market_price: frentePrice.usingMarketPrice,
              market_price_confirmed: false,
              ...areaRow(frentePrice, frente.width_mm, frente.height_mm, frente.quantity),
              notes: priceNotes(
                frentePrice,
                `tipo=${frente.kind}; ${frente.width_mm}x${frente.height_mm}x${frente.thickness_mm}mm × ${frente.quantity}${frente.dimensions_estimated ? ' (medida estimada)' : ''}`,
              ),
            },
            frente.bounding_box,
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
          ) && !(Number(r.unit_price) > 0),
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

  await setAnalysisStatus(state.analysisId, 'COMPLETED', {
    error_message: null,
    pipeline_stage: 'completed',
    pipeline_detail: 'Pronto — análise concluída. Você já pode revisar chapas e ferragens.',
    thought_kind: 'done',
    totals: {
      ...prevTotals,
      materials_count: materialsSaved,
      bom_items_count: bomItemsSaved,
      market_price_flags: marketFlags,
      out_of_scope_modules: outOfScopeCount,
      environments: state.extraction.environments.length,
      modules: state.extraction.environments.reduce((n, e) => n + e.modules.length, 0),
      auditor_notes: state.extraction.auditor_notes,
      engineering_cot: engineeringCot.join('\n\n'),
      pricing_note: 'v11: venda apenas por BOM (MPC% ou ×N) — proibido m² de fachada',
      warnings: [
        ...(Array.isArray(state.extraction.warnings) ? state.extraction.warnings : []),
        ...(coverage.missing.length
          ? [
              `Cobertura incompleta: ${coverage.missing.length} módulo(s) do inventário ainda faltando.`,
            ]
          : []),
      ],
      inventory,
      coverage,
    },
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
  /** PDF e/ou imagens. Preferir este campo. */
  sourceFiles?: File[]
  /** @deprecated use sourceFiles */
  pdfFile?: File
  /** Se true, não reconverte — só reusa pages/ já no Storage. */
  reuseExistingPages?: boolean
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
    sourceFiles: params.reuseExistingPages ? [] : sourceFiles,
    pdfFile: null,
    pagePaths: [],
    extraction: null,
    materialsSaved: 0,
    error: null,
  })

  if (result.error) {
    return { ok: false, error: result.error }
  }
  return { ok: true, materialsSaved: result.materialsSaved }
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
    .select('id, company_id, mode, source_pdf_path')
    .eq('id', params.analysisId)
    .eq('company_id', params.companyId)
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!row) return { ok: false, error: 'Análise não encontrada.' }

  const pagesPrefix = `${params.companyId}/${params.analysisId}/pages`
  const { data: existing } = await supabase.storage
    .from(ORCAMENTOS_IA_BUCKET)
    .list(pagesPrefix, { limit: 5 })

  const hasPages = (existing || []).some((o) => /\.(png|jpe?g|webp)$/i.test(o.name))

  await setAnalysisStatus(params.analysisId, 'PENDING', { error_message: null })

  if (hasPages) {
    return runOrcamentosIaPipeline({
      analysisId: params.analysisId,
      companyId: params.companyId,
      mode: (row.mode === 'pro' ? 'pro' : 'max') as QuoteAnalysisMode,
      reuseExistingPages: true,
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
    sourceFiles: [file],
  })
}

/** Reexport útil para UI / testes. */
export { quoteExtractionSchema }
