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
  totals: Record<string, unknown> | null
  environments: QuoteEnvironmentRow[]
}

export async function loadQuoteAnalysisTree(
  analysisId: string,
): Promise<{ data: QuoteAnalysisDetail | null; error?: string }> {
  const { data: analysis, error: aErr } = await supabase
    .from('quote_analyses')
    .select('id, company_id, status, source_pdf_path, mode, totals')
    .eq('id', analysisId)
    .single()
  if (aErr || !analysis) return { data: null, error: aErr?.message || 'Análise não encontrada.' }

  const { data: envs, error: eErr } = await supabase
    .from('quote_environments')
    .select('id, analysis_id, name, sort_order')
    .eq('analysis_id', analysisId)
    .order('sort_order', { ascending: true })
  if (eErr) return { data: null, error: eErr.message }

  const envIds = (envs ?? []).map((e) => e.id)
  if (!envIds.length) {
    return {
      data: {
        ...analysis,
        environments: [],
      } as QuoteAnalysisDetail,
    }
  }

  const { data: modules, error: mErr } = await supabase
    .from('quote_modules')
    .select('id, environment_id, name, description, dimensions, bounding_box, page_number, page_image_path, sort_order')
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

/** Lista caminhos das páginas convertidas no Storage (page-001.png…). */
export async function listQuotePagePaths(
  companyId: string,
  analysisId: string,
): Promise<{ paths: string[]; error?: string }> {
  const prefix = `${companyId}/${analysisId}/pages`
  const { data, error } = await supabase.storage.from(ORCAMENTOS_IA_BUCKET).list(prefix, {
    limit: 80,
    sortBy: { column: 'name', order: 'asc' },
  })
  if (error) return { paths: [], error: error.message }
  const paths = (data || [])
    .filter((o) => /\.(png|jpe?g|webp)$/i.test(o.name))
    .map((o) => `${prefix}/${o.name}`)
    .sort()
  return { paths }
}

/** Gera URLs assinadas para pré-visualizar páginas no console. */
export async function getSignedQuotePageUrls(
  companyId: string,
  analysisId: string,
  maxPages = 24,
): Promise<{ pages: Array<{ path: string; url: string; index: number }>; error?: string }> {
  const { paths, error } = await listQuotePagePaths(companyId, analysisId)
  if (error) return { pages: [], error }
  const slice = paths.slice(0, maxPages)
  if (!slice.length) return { pages: [] }

  const { data, error: signError } = await supabase.storage
    .from(ORCAMENTOS_IA_BUCKET)
    .createSignedUrls(slice, 60 * 60)

  if (signError || !data) return { pages: [], error: signError?.message || 'Falha ao assinar páginas.' }

  const pages: Array<{ path: string; url: string; index: number }> = []
  for (let i = 0; i < slice.length; i++) {
    const signed = data[i]?.signedUrl
    if (!signed) continue
    pages.push({ path: slice[i], url: signed, index: i + 1 })
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
