import { supabase } from '@/lib/supabase'
import { ORCAMENTOS_IA_BUCKET } from '@/lib/orcamentos-ia/storage'

export interface QuoteBoundingBox {
  page?: number
  x: number
  y: number
  width: number
  height: number
}

export interface QuoteMaterialRow {
  id: string
  module_id: string
  raw_name: string
  category: string
  system_material_id: string | null
  using_market_price: boolean
  market_price_confirmed: boolean
  unit_price: number
  exact_quantity: number
  full_units_quantity: number
  unit_measure: string
  bounding_box: QuoteBoundingBox | null
  notes: string | null
  page_image_path: string | null
}

export interface QuoteModuleRow {
  id: string
  environment_id: string
  name: string
  description: string | null
  dimensions: Record<string, unknown> | null
  bounding_box: QuoteBoundingBox | null
  page_number: number | null
  page_image_path: string | null
  sort_order: number
  /** Pedra, alvenaria, decoração — listado à parte, fora do custo. */
  out_of_scope: boolean
  materials: QuoteMaterialRow[]
}

export interface QuoteEnvironmentRow {
  id: string
  analysis_id: string
  name: string
  sort_order: number
  modules: QuoteModuleRow[]
}

export interface QuoteAnalysisDetail {
  id: string
  company_id: string
  status: string
  source_pdf_path: string | null
  mode: string
  project_id?: string | null
  totals: Record<string, unknown> | null
  environments: QuoteEnvironmentRow[]
}

/**
 * Quando o lote perdeu as linhas em quote_environments (ex.: exclusão + restore
 * do snapshot da pasta), monta uma árvore virtual a partir de totals.last_extraction
 * para a auditoria e o consolidado continuarem legíveis.
 */
/** IDs virtuais gerados quando não há linhas em quote_environments (fallback da extração). */
export function isVirtualHydratedId(id: string | null | undefined): boolean {
  return typeof id === 'string' && /^virt-(env|mod|mat)-/.test(id)
}

export function hydrateEnvironmentsFromExtraction(
  analysisId: string,
  extraction: unknown,
): QuoteEnvironmentRow[] {
  if (!extraction || typeof extraction !== 'object') return []
  const rawEnvs = (extraction as { environments?: unknown }).environments
  if (!Array.isArray(rawEnvs) || !rawEnvs.length) return []

  return rawEnvs.map((env, envIndex) => {
    const e = env && typeof env === 'object' ? (env as Record<string, unknown>) : {}
    const envId = `virt-env-${analysisId.slice(0, 8)}-${envIndex}`
    const modulesIn = Array.isArray(e.modules) ? e.modules : []
    const modules: QuoteModuleRow[] = modulesIn.map((mod, modIndex) => {
      const m = mod && typeof mod === 'object' ? (mod as Record<string, unknown>) : {}
      const moduleId = `virt-mod-${analysisId.slice(0, 8)}-${envIndex}-${modIndex}`
      const materials: QuoteMaterialRow[] = []
      let matSeq = 0
      const pushMat = (
        rawName: string,
        category: string,
        qty: number,
        unit: string,
        notes?: string,
      ) => {
        if (!(qty > 0) || !rawName.trim()) return
        materials.push({
          id: `virt-mat-${analysisId.slice(0, 8)}-${envIndex}-${modIndex}-${matSeq++}`,
          module_id: moduleId,
          raw_name: rawName,
          category,
          system_material_id: null,
          using_market_price: false,
          market_price_confirmed: false,
          unit_price: 0,
          exact_quantity: qty,
          full_units_quantity: qty,
          unit_measure: unit,
          bounding_box: null,
          notes: notes ?? null,
          page_image_path: null,
        })
      }
      for (const p of Array.isArray(m.caixaria) ? m.caixaria : []) {
        if (!p || typeof p !== 'object') continue
        const piece = p as Record<string, unknown>
        const w = Number(piece.width_mm) || 0
        const h = Number(piece.height_mm) || 0
        const q = Number(piece.quantity) || 1
        const area = w > 0 && h > 0 ? (w / 1000) * (h / 1000) * q : q
        pushMat(
          String(piece.material_name || piece.function || 'Chapa'),
          'chapa',
          area,
          'm2',
          typeof piece.function === 'string' ? piece.function : undefined,
        )
      }
      for (const p of Array.isArray(m.frentes_portas) ? m.frentes_portas : []) {
        if (!p || typeof p !== 'object') continue
        const piece = p as Record<string, unknown>
        const w = Number(piece.width_mm) || 0
        const h = Number(piece.height_mm) || 0
        const q = Number(piece.quantity) || 1
        const area = w > 0 && h > 0 ? (w / 1000) * (h / 1000) * q : q
        pushMat(String(piece.material_name || 'Frente'), 'chapa', area, 'm2', 'frente')
      }
      for (const f of Array.isArray(m.ferragens) ? m.ferragens : []) {
        if (!f || typeof f !== 'object') continue
        const item = f as Record<string, unknown>
        const qty = Number(item.full_units_quantity ?? item.exact_quantity) || 0
        pushMat(String(item.raw_name || 'Ferragem'), 'ferragem', qty, 'un')
      }
      for (const t of Array.isArray(m.fitas_borda_m) ? m.fitas_borda_m : []) {
        if (!t || typeof t !== 'object') continue
        const tape = t as Record<string, unknown>
        pushMat(String(tape.tape_name || 'Fita de borda'), 'fita_borda', Number(tape.meters) || 0, 'm')
      }
      const bbox =
        m.bounding_box && typeof m.bounding_box === 'object'
          ? (m.bounding_box as QuoteBoundingBox)
          : null
      return {
        id: moduleId,
        environment_id: envId,
        name: String(m.name || 'Módulo'),
        description: typeof m.description === 'string' ? m.description : null,
        dimensions:
          m.dimensions && typeof m.dimensions === 'object'
            ? (m.dimensions as Record<string, unknown>)
            : null,
        bounding_box: bbox,
        page_number:
          typeof bbox?.page === 'number'
            ? bbox.page
            : typeof m.page_number === 'number'
              ? m.page_number
              : null,
        page_image_path: null,
        sort_order: modIndex,
        out_of_scope: m.out_of_scope === true,
        materials,
      }
    })
    return {
      id: envId,
      analysis_id: analysisId,
      name: String(e.name || 'Ambiente'),
      sort_order: envIndex,
      modules,
    }
  })
}

export async function loadQuoteAnalysisTree(
  analysisId: string,
): Promise<{ data: QuoteAnalysisDetail | null; error?: string }> {
  const { data: analysis, error: aErr } = await supabase
    .from('quote_analyses')
    .select('id, company_id, status, source_pdf_path, mode, totals, project_id')
    .eq('id', analysisId)
    .single()
  if (aErr || !analysis) return { data: null, error: aErr?.message || 'Análise não encontrada.' }

  const totals =
    analysis.totals && typeof analysis.totals === 'object'
      ? (analysis.totals as Record<string, unknown>)
      : null

  const { data: envs, error: eErr } = await supabase
    .from('quote_environments')
    .select('id, analysis_id, name, sort_order')
    .eq('analysis_id', analysisId)
    .order('sort_order', { ascending: true })
  if (eErr) return { data: null, error: eErr.message }

  const envIds = (envs ?? []).map((e) => e.id)
  if (!envIds.length) {
    const hydrated = hydrateEnvironmentsFromExtraction(analysisId, totals?.last_extraction)
    return {
      data: {
        id: analysis.id,
        company_id: analysis.company_id,
        status: analysis.status,
        source_pdf_path: analysis.source_pdf_path,
        mode: analysis.mode,
        project_id:
          typeof (analysis as { project_id?: string | null }).project_id === 'string'
            ? (analysis as { project_id: string }).project_id
            : null,
        totals,
        environments: hydrated,
      },
    }
  }

  const { data: modules, error: mErr } = await supabase
    .from('quote_modules')
    .select('id, environment_id, name, description, dimensions, bounding_box, page_number, page_image_path, sort_order, out_of_scope')
    .in('environment_id', envIds)
    .order('sort_order', { ascending: true })
  if (mErr) return { data: null, error: mErr.message }

  const moduleIds = (modules ?? []).map((m) => m.id)
  let materials: QuoteMaterialRow[] = []
  if (moduleIds.length) {
    const { data: mats, error: matErr } = await supabase
      .from('quote_materials')
      .select(
        'id, module_id, raw_name, category, system_material_id, using_market_price, market_price_confirmed, unit_price, exact_quantity, full_units_quantity, unit_measure, bounding_box, notes, page_image_path',
      )
      .in('module_id', moduleIds)
    if (matErr) return { data: null, error: matErr.message }
    materials = (mats ?? []) as QuoteMaterialRow[]
  }

  const materialsByModule = new Map<string, QuoteMaterialRow[]>()
  for (const mat of materials) {
    const list = materialsByModule.get(mat.module_id) ?? []
    list.push(mat)
    materialsByModule.set(mat.module_id, list)
  }

  const modulesByEnv = new Map<string, QuoteModuleRow[]>()
  for (const mod of modules ?? []) {
    const row: QuoteModuleRow = {
      ...(mod as Omit<QuoteModuleRow, 'materials'>),
      materials: materialsByModule.get(mod.id) ?? [],
    }
    const list = modulesByEnv.get(mod.environment_id) ?? []
    list.push(row)
    modulesByEnv.set(mod.environment_id, list)
  }

  const environments: QuoteEnvironmentRow[] = (envs ?? []).map((env) => ({
    ...env,
    modules: modulesByEnv.get(env.id) ?? [],
  }))

  return {
    data: {
      id: analysis.id,
      company_id: analysis.company_id,
      status: analysis.status,
      source_pdf_path: analysis.source_pdf_path,
      mode: analysis.mode,
      project_id:
        typeof (analysis as { project_id?: string | null }).project_id === 'string'
          ? (analysis as { project_id: string }).project_id
          : null,
      totals: (analysis.totals as Record<string, unknown>) ?? null,
      environments,
    },
  }
}

export async function getSignedPdfUrl(path: string): Promise<{ url?: string; error?: string }> {
  const { data, error } = await supabase.storage
    .from(ORCAMENTOS_IA_BUCKET)
    .createSignedUrl(path, 60 * 60)
  if (error || !data?.signedUrl) return { error: error?.message || 'PDF indisponível.' }
  return { url: data.signedUrl }
}

/** Signed URL da página PNG/JPG ligada ao material. */
export async function getSignedPageImageUrl(
  path: string,
): Promise<{ url?: string; error?: string }> {
  return getSignedPdfUrl(path)
}

/** Extrai o nº da página (1-based) de `…/pages/page-009.jpg`. */
export function pageIndexFromStoragePath(path: string | null | undefined): number | null {
  if (!path) return null
  const match = path.match(/page-(\d+)\.(?:png|jpe?g|webp)$/i)
  if (!match) return null
  const n = Number(match[1])
  return Number.isFinite(n) && n >= 1 ? n : null
}

function sortPagePaths(paths: string[]): string[] {
  return [...paths].sort((a, b) => {
    const pa = pageIndexFromStoragePath(a) ?? 0
    const pb = pageIndexFromStoragePath(b) ?? 0
    return pa - pb || a.localeCompare(b)
  })
}

async function listPagesUnderPrefix(prefix: string): Promise<string[]> {
  const { data, error } = await supabase.storage.from(ORCAMENTOS_IA_BUCKET).list(prefix, {
    limit: 300,
    sortBy: { column: 'name', order: 'asc' },
  })
  if (error || !data?.length) return []
  return sortPagePaths(
    data
      .filter((o) => /\.(png|jpe?g|webp)$/i.test(o.name))
      .map((o) => `${prefix}/${o.name}`),
  )
}

/** Lista caminhos das páginas convertidas no Storage (page-001.png…). */
export async function listQuotePagePaths(
  companyId: string,
  analysisId: string,
  options?: {
    projectId?: string | null
    /** Preferência: page_paths gravados em totals do lote. */
    preferredPaths?: string[] | null
  },
): Promise<{ paths: string[]; error?: string }> {
  const preferred = sortPagePaths(
    (options?.preferredPaths || []).filter(
      (p): p is string => typeof p === 'string' && p.length > 0,
    ),
  )
  // Preferidos do lote: não misturar com a pasta inteira (outros lotes).
  if (preferred.length) return { paths: preferred }

  const prefixes = [
    options?.projectId
      ? `${companyId}/quote-projects/${options.projectId}/pages`
      : null,
    `${companyId}/${analysisId}/pages`,
  ].filter((p): p is string => Boolean(p))

  for (const prefix of prefixes) {
    const listed = await listPagesUnderPrefix(prefix)
    if (listed.length) return { paths: listed }
  }
  return { paths: [] }
}

async function signPagePaths(
  paths: string[],
): Promise<Array<{ path: string; url: string; index: number }>> {
  if (!paths.length) return []

  const pages: Array<{ path: string; url: string; index: number }> = []
  const { data, error: signError } = await supabase.storage
    .from(ORCAMENTOS_IA_BUCKET)
    .createSignedUrls(paths, 60 * 60)

  if (!signError && data?.length) {
    for (let i = 0; i < paths.length; i++) {
      const signed = data[i]?.signedUrl
      if (!signed) continue
      pages.push({
        path: paths[i],
        url: signed,
        index: pageIndexFromStoragePath(paths[i]) ?? i + 1,
      })
    }
  }

  // Fallback: assina uma a uma (batch às vezes falha parcial sem error global).
  if (!pages.length) {
    for (let i = 0; i < paths.length; i++) {
      const { data: one, error } = await supabase.storage
        .from(ORCAMENTOS_IA_BUCKET)
        .createSignedUrl(paths[i], 60 * 60)
      if (error || !one?.signedUrl) continue
      pages.push({
        path: paths[i],
        url: one.signedUrl,
        index: pageIndexFromStoragePath(paths[i]) ?? i + 1,
      })
    }
  }

  return pages
}

/** Gera URLs assinadas para pré-visualizar páginas no console. */
export async function getSignedQuotePageUrls(
  companyId: string,
  analysisId: string,
  maxPages = 24,
  options?: {
    projectId?: string | null
    preferredPaths?: string[] | null
    /** Só estas páginas (nº absoluto do PDF, 1-based). */
    pageNumbers?: number[] | null
  },
): Promise<{ pages: Array<{ path: string; url: string; index: number }>; error?: string }> {
  const { paths, error } = await listQuotePagePaths(companyId, analysisId, options)
  if (error) return { pages: [], error }

  const wanted = (options?.pageNumbers || []).filter(
    (n) => Number.isInteger(n) && n >= 1,
  )
  const wantedSet = wanted.length ? new Set(wanted) : null

  let filtered = wantedSet
    ? paths.filter((p) => {
        const idx = pageIndexFromStoragePath(p)
        return idx != null && wantedSet.has(idx)
      })
    : paths

  // Pasta do projeto sem page_paths no lote: monta caminhos esperados.
  if (
    !filtered.length &&
    wanted.length &&
    options?.projectId
  ) {
    filtered = wanted.map(
      (n) =>
        `${companyId}/quote-projects/${options.projectId}/pages/page-${String(n).padStart(3, '0')}.jpg`,
    )
  }

  const slice = filtered.slice(0, maxPages)
  if (!slice.length) return { pages: [] }

  let pages = await signPagePaths(slice)

  // Preferidos stale / assinatura falhou → tenta só a pasta do projeto.
  if (!pages.length && options?.preferredPaths?.length && options.projectId) {
    const listed = await listPagesUnderPrefix(
      `${companyId}/quote-projects/${options.projectId}/pages`,
    )
    const retry = wantedSet
      ? listed.filter((p) => {
          const idx = pageIndexFromStoragePath(p)
          return idx != null && wantedSet.has(idx)
        })
      : listed
    pages = await signPagePaths(retry.slice(0, maxPages))
  }

  return { pages }
}

export async function updateQuoteMaterial(
  materialId: string,
  patch: Partial<{
    raw_name: string
    exact_quantity: number
    full_units_quantity: number
    unit_price: number
    using_market_price: boolean
    market_price_confirmed: boolean
    notes: string | null
  }>,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('quote_materials')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', materialId)
  if (error) return { error: error.message }
  return {}
}
