import { supabase } from '@/lib/supabase'
import {
  DEFAULT_EXTRACTION_MODEL,
  EXTRACTION_MODEL_KEYS,
  EXTRACTION_MODEL_LABELS,
  isExtractionModelKey,
  resolveExtractionApiModel,
  type ExtractionModelKey,
} from '@/lib/orcamentos-ia/openai-models'
import { formatPageRanges } from '@/lib/orcamentos-ia/page-ranges'

export type { ExtractionModelKey }
export {
  DEFAULT_EXTRACTION_MODEL,
  EXTRACTION_MODEL_KEYS,
  EXTRACTION_MODEL_LABELS,
  isExtractionModelKey,
  resolveExtractionApiModel,
}

/** Nome do bucket autenticado (não público) para PDFs e páginas do módulo. */
export const ORCAMENTOS_IA_BUCKET = 'orcamentos-ia'

const PDF_MIME = 'application/pdf'
/** Limite alinhado ao bucket `orcamentos-ia` no Supabase (100 MB). */
export const MAX_SOURCE_BYTES = 100 * 1024 * 1024
const ALLOWED_IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp'] as const

export function formatSourceBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function isAllowedQuoteSourceFile(file: File): boolean {
  const name = file.name.toLowerCase()
  if (file.type === PDF_MIME || name.endsWith('.pdf')) return true
  if (file.type.startsWith('image/')) return true
  return ALLOWED_IMAGE_EXT.some((ext) => name.endsWith(ext))
}

export function contentTypeForSourceFile(file: File): string {
  if (file.type) return file.type
  const name = file.name.toLowerCase()
  if (name.endsWith('.pdf')) return PDF_MIME
  if (name.endsWith('.png')) return 'image/png'
  if (name.endsWith('.webp')) return 'image/webp'
  if (name.endsWith('.jpg') || name.endsWith('.jpeg')) return 'image/jpeg'
  return 'application/octet-stream'
}

export type QuoteAnalysisMode = 'max' | 'pro'

export type QuoteAnalysisStatus =
  | 'PENDING'
  | 'PROCESSING'
  | 'CONVERTING_PAGES'
  | 'READING_LAYOUT'
  | 'EXTRACTING_MODULES'
  | 'FETCHING_MARKET_PRICES'
  | 'AUDITING_REVISION'
  | 'NEEDS_REVIEW'
  | 'COMPLETED'
  | 'FAILED'

/** Percentual da barra de progresso conforme o status do job. */
export const QUOTE_STATUS_PROGRESS: Record<QuoteAnalysisStatus, number> = {
  PENDING: 8,
  PROCESSING: 30,
  CONVERTING_PAGES: 22,
  READING_LAYOUT: 38,
  EXTRACTING_MODULES: 55,
  FETCHING_MARKET_PRICES: 72,
  AUDITING_REVISION: 88,
  NEEDS_REVIEW: 95,
  COMPLETED: 100,
  FAILED: 100,
}

export const QUOTE_STATUS_LABEL: Record<QuoteAnalysisStatus, string> = {
  PENDING: 'Aguardando processamento',
  PROCESSING: 'Processando com IA…',
  CONVERTING_PAGES: 'Convertendo páginas / imagens',
  READING_LAYOUT: 'Lendo layout das pranchas',
  EXTRACTING_MODULES: 'Extraindo módulos e insumos',
  FETCHING_MARKET_PRICES: 'Buscando preços (lista de materiais pronta)',
  AUDITING_REVISION: 'Auditoria / montagem da lista de materiais',
  NEEDS_REVIEW: 'Revisão necessária (circuit breaker)',
  COMPLETED: 'Concluído',
  FAILED: 'Falhou',
}

/**
 * Etapas finas gravadas em `totals.pipeline_stage` (além do status).
 * Servem para a linha do tempo visual — o usuário vê exatamente onde a IA está.
 */
export type PipelineStageId =
  | 'upload'
  | 'converting_pages'
  | 'reading_inventory'
  | 'extracting_batch'
  | 'auditing'
  | 'pricing_pending'
  | 'fetching_prices'
  | 'persisting'
  | 'needs_review'
  | 'completed'
  | 'failed'

/** Checkpoint da cadeia async (totals JSONB). */
export interface PipelineAsyncCheckpoint {
  current_page?: number
  total_pages?: number
  modules_found_count?: number
  async_chain_status?: string | null
  pipeline_detail?: string | null
}

/**
 * Extração/auditoria da Edge já fecharam — falta só o cliente precificar e gravar.
 * (Aba fechada / refresh no meio deixa o lote “ocupado” sem runner.)
 */
export function isReadyForClientPricing(
  totals: Record<string, unknown> | null | undefined,
): boolean {
  if (!totals || typeof totals !== 'object') return false
  const chain =
    typeof totals.async_chain_status === 'string' ? totals.async_chain_status : ''
  const stage = typeof totals.pipeline_stage === 'string' ? totals.pipeline_stage : ''
  if (chain !== 'ready_for_pricing' && stage !== 'pricing_pending') return false
  const partial = totals.partial_extraction
  if (!partial || typeof partial !== 'object') return false
  const envs = (partial as { environments?: unknown }).environments
  return Array.isArray(envs) && envs.length > 0
}

export function formatAsyncPageProgress(totals: Record<string, unknown> | null | undefined): string | null {
  if (!totals || typeof totals !== 'object') return null
  const cur = Number(totals.current_page)
  const total = Number(totals.total_pages)
  const mods = Number(totals.modules_found_count)
  if (!Number.isFinite(total) || total <= 0) return null
  const page = Number.isFinite(cur) ? Math.min(Math.max(0, cur), total) : 0
  const modsLabel = Number.isFinite(mods) ? Math.max(0, mods) : 0
  if (typeof totals.pipeline_detail === 'string' && totals.pipeline_detail.trim()) {
    return totals.pipeline_detail.trim()
  }
  if (totals.pipeline_stage === 'auditing' || totals.pipeline_stage === 'pricing_pending') {
    return `Auditoria / montagem da lista — ${modsLabel} módulo(s) encontrados`
  }
  if (totals.pipeline_stage === 'fetching_prices') {
    return `Buscando preços — ${modsLabel} módulo(s)`
  }
  const lotEvery = Number(totals.checkpoint_every_pages) || 15
  const displayPage = Math.min(total, Math.max(1, page + (page < total ? 1 : 0)))
  const totalLots = Math.max(1, Math.ceil(total / lotEvery))
  const currentLot = Math.min(totalLots, Math.floor(page / lotEvery) + 1)
  return `Lote ${currentLot}/${totalLots}: lendo página ${displayPage} de ${total}… Módulos: ${modsLabel}`
}

/** Tipo de linha no console de pensamento da IA. */
export type ThoughtKind = 'info' | 'vision' | 'audit' | 'price' | 'warn' | 'done'

export interface ThoughtLogEntry {
  at: string
  stage: PipelineStageId | string
  kind: ThoughtKind
  message: string
}

export const THOUGHT_LOG_CAP = 40

export interface PipelineVisualStep {
  id: PipelineStageId
  label: string
  /** Título curto para o console (ex.: "Extração"). */
  shortLabel: string
  hint: string
}

export const PIPELINE_VISUAL_STEPS: PipelineVisualStep[] = [
  {
    id: 'upload',
    label: '1. Envio',
    shortLabel: 'Envio',
    hint: 'Arquivo chega ao sistema',
  },
  {
    id: 'converting_pages',
    label: '2. Páginas',
    shortLabel: 'Páginas',
    hint: 'PDF/fotos viram imagens para a IA ler',
  },
  {
    id: 'reading_inventory',
    label: '3. Inventário',
    shortLabel: 'Inventário',
    hint: 'Lista ambientes e móveis da capa',
  },
  {
    id: 'extracting_batch',
    label: '4. Extração',
    shortLabel: 'Extração',
    hint: 'Lê páginas em lotes de 15 (1 página/IA, checkpoint)',
  },
  {
    id: 'auditing',
    label: '5. Auditoria',
    shortLabel: 'Auditoria',
    hint: 'Confere ambiente por ambiente',
  },
  {
    id: 'pricing_pending',
    label: '6. Lista de materiais',
    shortLabel: 'BOM',
    hint: 'Consolida chapas/ferragens do projeto inteiro (ainda sem preço)',
  },
  {
    id: 'fetching_prices',
    label: '7. Preços',
    shortLabel: 'Preços',
    hint: 'Busca preços uma única vez com o BOM já montado',
  },
  {
    id: 'persisting',
    label: '8. Salvando',
    shortLabel: 'Salvando',
    hint: 'Grava módulos e insumos no orçamento',
  },
  {
    id: 'completed',
    label: '9. Pronto',
    shortLabel: 'Pronto',
    hint: 'Análise concluída',
  },
]

export function thoughtKindForStage(stage: string | null | undefined): ThoughtKind {
  switch (stage) {
    case 'converting_pages':
    case 'reading_inventory':
    case 'extracting_batch':
      return 'vision'
    case 'auditing':
    case 'self_heal':
    case 'pricing_pending':
      return 'audit'
    case 'fetching_prices':
    case 'persisting':
      return 'price'
    case 'completed':
      return 'done'
    case 'failed':
      return 'warn'
    default:
      return 'info'
  }
}

/** Intensidade 0–1 para o shader (etapas “pensando” mais forte). */
export function thoughtIntensityForStage(stage: string | null | undefined): number {
  switch (stage) {
    case 'extracting_batch':
      return 0.92
    case 'auditing':
    case 'self_heal':
      return 1
    case 'reading_inventory':
      return 0.72
    case 'converting_pages':
      return 0.45
    case 'fetching_prices':
      return 0.55
    case 'persisting':
      return 0.35
    case 'completed':
      return 0.15
    case 'failed':
      return 0.2
    default:
      return 0.3
  }
}

export function appendThoughtLog(
  prevTotals: Record<string, unknown>,
  entry: Omit<ThoughtLogEntry, 'at'> & { at?: string },
): ThoughtLogEntry[] {
  const raw = prevTotals.thought_log
  const prev: ThoughtLogEntry[] = Array.isArray(raw)
    ? raw.filter(
        (x): x is ThoughtLogEntry =>
          !!x &&
          typeof x === 'object' &&
          typeof (x as ThoughtLogEntry).message === 'string',
      )
    : []
  const nextEntry: ThoughtLogEntry = {
    at: entry.at || new Date().toISOString(),
    stage: entry.stage,
    kind: entry.kind,
    message: entry.message.trim(),
  }
  if (!nextEntry.message) return prev.slice(-THOUGHT_LOG_CAP)
  const last = prev[prev.length - 1]
  if (last && last.message === nextEntry.message && last.stage === nextEntry.stage) {
    return prev.slice(-THOUGHT_LOG_CAP)
  }
  return [...prev, nextEntry].slice(-THOUGHT_LOG_CAP)
}

export function parseThoughtLog(totals: Record<string, unknown> | null | undefined): ThoughtLogEntry[] {
  if (!totals || !Array.isArray(totals.thought_log)) return []
  return totals.thought_log.filter(
    (x): x is ThoughtLogEntry =>
      !!x &&
      typeof x === 'object' &&
      typeof (x as ThoughtLogEntry).message === 'string',
  )
}

/** Converte status bruto + pipeline_stage em um id da linha do tempo. */
export function resolvePipelineStageId(
  status: QuoteAnalysisStatus | null | undefined,
  pipelineStage?: string | null,
): PipelineStageId {
  const stage = (pipelineStage || '').toLowerCase().trim()
  if (status === 'FAILED') {
    // Mantém a etapa em que falhou, para a linha do tempo destacar o ponto certo
    if (stage && stage !== 'failed' && PIPELINE_VISUAL_STEPS.some((s) => s.id === stage)) {
      return stage as PipelineStageId
    }
    return 'failed'
  }
  if (status === 'COMPLETED') return 'completed'
  if (status === 'NEEDS_REVIEW') return 'needs_review'
  // Self-heal cirúrgico: visualmente permanece em Auditoria (sem piscar Extração)
  if (stage === 'self_heal') return 'auditing'
  if (stage && PIPELINE_VISUAL_STEPS.some((s) => s.id === stage)) {
    return stage as PipelineStageId
  }
  switch (status) {
    case 'PENDING':
      return 'upload'
    case 'CONVERTING_PAGES':
      return 'converting_pages'
    case 'READING_LAYOUT':
      return 'reading_inventory'
    case 'EXTRACTING_MODULES':
      return 'extracting_batch'
    case 'AUDITING_REVISION':
      return 'auditing'
    case 'FETCHING_MARKET_PRICES':
      return 'fetching_prices'
    case 'NEEDS_REVIEW':
      return 'needs_review'
    case 'PROCESSING':
      return 'extracting_batch'
    default:
      return 'upload'
  }
}

export interface EnsureBucketResult {
  ok: boolean
  error?: string
}

/**
 * Verifica se o bucket `orcamentos-ia` existe e está acessível.
 * A criação do bucket fica na migration SQL (cliente anon não cria buckets).
 */
export async function ensureOrcamentosIaBucket(): Promise<EnsureBucketResult> {
  const { error } = await supabase.storage.from(ORCAMENTOS_IA_BUCKET).list('', {
    limit: 1,
  })

  if (!error) return { ok: true }

  const message = error.message?.toLowerCase() ?? ''
  if (
    message.includes('not found') ||
    message.includes('bucket') ||
    message.includes('does not exist')
  ) {
    return {
      ok: false,
      error:
        'Bucket "orcamentos-ia" não encontrado. Aplique a migration 20260922_orcamentos_ia_storage.sql (pnpm migrate).',
    }
  }

  return { ok: false, error: error.message || 'Não foi possível acessar o Storage.' }
}

export function buildQuotePdfPath(companyId: string, analysisId: string, fileName: string): string {
  const safeName = fileName.replace(/[^\w.\-() ]+/g, '_').slice(0, 120)
  return `${companyId}/${analysisId}/${safeName}`
}

/** Path de página JPEG compartilhada na pasta do projeto (página absoluta do PDF). */
export function buildQuoteProjectPagePath(
  companyId: string,
  projectId: string,
  pageNumber: number,
): string {
  return `${companyId}/quote-projects/${projectId}/pages/page-${String(pageNumber).padStart(3, '0')}.jpg`
}

/** Path permanente do PDF da pasta (um único arquivo por projeto). */
export function buildQuoteProjectPdfPath(companyId: string, projectId: string): string {
  return `${companyId}/quote-projects/${projectId}/source.pdf`
}

/** URL assinada do objeto no bucket (PDF grande: preferir range via pdf.js). */
export async function createOrcamentosIaSignedUrl(
  path: string,
  expiresInSec = 60 * 60,
): Promise<string> {
  const clean = path.trim().replace(/^\/+/, '')
  if (!clean) throw new Error('Caminho do arquivo vazio.')
  const { data, error } = await supabase.storage
    .from(ORCAMENTOS_IA_BUCKET)
    .createSignedUrl(clean, expiresInSec)
  if (error || !data?.signedUrl) {
    throw new Error(error?.message || 'Não foi possível assinar a URL do arquivo.')
  }
  return data.signedUrl
}

/**
 * Baixa objeto grande do bucket (PDF 70–100 MB).
 *
 * Preferir `createOrcamentosIaSignedUrl` + pdf.js (range). Este helper fica
 * como fallback: URL assinada + `globalThis.fetch` nativo (sem o wrapper
 * do cliente, que estoura “Failed to fetch” em arquivos grandes).
 */
export async function downloadOrcamentosIaObject(
  path: string,
  options?: { maxAttempts?: number; expiresInSec?: number },
): Promise<Blob> {
  const clean = path.trim().replace(/^\/+/, '')
  if (!clean) throw new Error('Caminho do arquivo vazio.')

  const maxAttempts = options?.maxAttempts ?? 3
  const expiresInSec = options?.expiresInSec ?? 60 * 60
  let lastError: string | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const signedUrl = await createOrcamentosIaSignedUrl(clean, expiresInSec)
      const res = await globalThis.fetch(signedUrl)
      if (!res.ok) {
        lastError = `Download HTTP ${res.status} ao baixar o arquivo.`
      } else {
        const blob = await res.blob()
        if (!blob.size) {
          lastError = 'Arquivo vazio no Storage.'
        } else {
          return blob
        }
      }
    } catch (err) {
      lastError = err instanceof Error ? err.message : 'Failed to fetch'
    }
    if (attempt < maxAttempts) {
      await new Promise((r) => setTimeout(r, 700 * attempt))
    }
  }

  throw new Error(
    lastError ||
      'Falha ao baixar o PDF da pasta. Clique em Retomar em alguns segundos.',
  )
}

const QUOTE_PROJECT_SELECT =
  'id, company_id, name, source_pdf_name, source_fingerprint, pdf_url, budgeted_pages, page_count, totals, lead_id, created_by, created_at, updated_at'

export interface QuoteProjectRow {
  id: string
  company_id: string
  name: string
  source_pdf_name: string | null
  source_fingerprint: string | null
  /** Path no Storage do PDF permanente (não URL pública). */
  pdf_url: string | null
  /** Páginas absolutas já orçadas. */
  budgeted_pages: number[]
  page_count: number | null
  totals: Record<string, unknown> | null
  /** Lead CRM vinculado (1 pasta por lead). Null = pasta só do hub. */
  lead_id: number | null
  created_by: string | null
  created_at: string
  updated_at: string
}

function normalizeBudgetedPages(raw: unknown): number[] {
  if (!Array.isArray(raw)) return []
  return [...new Set(raw.filter((n): n is number => Number.isInteger(n) && n > 0))].sort(
    (a, b) => a - b,
  )
}

function asQuoteProjectRow(row: Record<string, unknown>): QuoteProjectRow {
  const leadRaw = row.lead_id
  const leadId =
    typeof leadRaw === 'number' && Number.isFinite(leadRaw)
      ? leadRaw
      : typeof leadRaw === 'string' && /^\d+$/.test(leadRaw)
        ? Number(leadRaw)
        : null
  return {
    id: String(row.id),
    company_id: String(row.company_id),
    name: String(row.name || ''),
    source_pdf_name: typeof row.source_pdf_name === 'string' ? row.source_pdf_name : null,
    source_fingerprint:
      typeof row.source_fingerprint === 'string' ? row.source_fingerprint : null,
    pdf_url: typeof row.pdf_url === 'string' ? row.pdf_url : null,
    budgeted_pages: normalizeBudgetedPages(row.budgeted_pages),
    page_count: typeof row.page_count === 'number' ? row.page_count : null,
    totals:
      row.totals && typeof row.totals === 'object'
        ? (row.totals as Record<string, unknown>)
        : null,
    lead_id: leadId,
    created_by: typeof row.created_by === 'string' ? row.created_by : null,
    created_at: String(row.created_at || ''),
    updated_at: String(row.updated_at || ''),
  }
}

export interface CreateQuoteProjectParams {
  companyId: string
  name: string
  sourcePdfName?: string | null
  sourceFingerprint?: string | null
  createdBy?: string | null
  /** Vincula a pasta a um lead CRM (1 pasta por lead). */
  leadId?: number | null
}

/** Cria a pasta de precificação (agrupa lotes de páginas). */
export async function createQuoteProject(
  params: CreateQuoteProjectParams,
): Promise<{ data: QuoteProjectRow | null; error?: string }> {
  const insert: Record<string, unknown> = {
    company_id: params.companyId,
    name: params.name.slice(0, 200),
    source_pdf_name: params.sourcePdfName ?? null,
    source_fingerprint: params.sourceFingerprint ?? null,
    created_by: params.createdBy ?? null,
    totals: {},
    budgeted_pages: [],
  }
  if (params.leadId != null && Number.isFinite(params.leadId)) {
    insert.lead_id = params.leadId
  }
  const { data, error } = await supabase
    .from('quote_projects')
    .insert(insert)
    .select(QUOTE_PROJECT_SELECT)
    .single()

  if (error) return { data: null, error: error.message }
  return { data: asQuoteProjectRow(data as Record<string, unknown>) }
}

/** Pasta de precificação já ligada a este lead (no máximo uma por empresa). */
export async function findQuoteProjectByLeadId(
  companyId: string,
  leadId: number,
): Promise<{ data: QuoteProjectRow | null; error?: string }> {
  if (!companyId || !Number.isFinite(leadId)) return { data: null }
  const { data, error } = await supabase
    .from('quote_projects')
    .select(QUOTE_PROJECT_SELECT)
    .eq('company_id', companyId)
    .eq('lead_id', leadId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  return { data: data ? asQuoteProjectRow(data as Record<string, unknown>) : null }
}

/**
 * Garante pasta do lead: reutiliza se existir, senão cria.
 * Nome padrão: "Lead {nome}".
 */
export async function ensureQuoteProjectForLead(params: {
  companyId: string
  leadId: number
  leadName?: string | null
  createdBy?: string | null
  sourcePdfName?: string | null
}): Promise<{ data: QuoteProjectRow | null; created: boolean; error?: string }> {
  const existing = await findQuoteProjectByLeadId(params.companyId, params.leadId)
  if (existing.error) return { data: null, created: false, error: existing.error }
  if (existing.data) return { data: existing.data, created: false }

  const label = (params.leadName || '').trim() || `Lead #${params.leadId}`
  const folderName = `Lead ${label}`.slice(0, 120)
  const created = await createQuoteProject({
    companyId: params.companyId,
    name: folderName,
    sourcePdfName: params.sourcePdfName ?? null,
    createdBy: params.createdBy ?? null,
    leadId: params.leadId,
  })
  if (created.error || !created.data) {
    // Corrida: outro request criou a pasta — tenta ler de novo
    const again = await findQuoteProjectByLeadId(params.companyId, params.leadId)
    if (again.data) return { data: again.data, created: false }
    return { data: null, created: false, error: created.error || 'Não foi possível criar a pasta.' }
  }
  return { data: created.data, created: true }
}

export async function getQuoteProject(
  projectId: string,
): Promise<{ data: QuoteProjectRow | null; error?: string }> {
  const { data, error } = await supabase
    .from('quote_projects')
    .select(QUOTE_PROJECT_SELECT)
    .eq('id', projectId)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  return { data: data ? asQuoteProjectRow(data as Record<string, unknown>) : null }
}

/** Lista pastas de precificação da empresa (mais recentes primeiro). */
export async function listQuoteProjects(
  companyId: string,
  limit = 40,
): Promise<{ data: QuoteProjectRow[]; error?: string }> {
  const { data, error } = await supabase
    .from('quote_projects')
    .select(QUOTE_PROJECT_SELECT)
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []).map((r) => asQuoteProjectRow(r as Record<string, unknown>)) }
}

/**
 * Reaproveita pasta que já tem o mesmo PDF (evita reenviar 80MB e pastas duplicadas).
 */
export async function findQuoteProjectWithPdfBySourceName(
  companyId: string,
  sourcePdfName: string,
): Promise<{ data: QuoteProjectRow | null; error?: string }> {
  const name = sourcePdfName.trim()
  if (!name) return { data: null }
  const { data, error } = await supabase
    .from('quote_projects')
    .select(QUOTE_PROJECT_SELECT)
    .eq('company_id', companyId)
    .eq('source_pdf_name', name)
    .not('pdf_url', 'is', null)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  return { data: data ? asQuoteProjectRow(data as Record<string, unknown>) : null }
}

/**
 * Reaproveita pasta pelo nome do arquivo mesmo com upload ainda em andamento
 * (pdf_url ainda null) — evita pasta duplicada quando o usuário clica “Iniciar”
 * antes do PDF de 80MB terminar de subir.
 */
export async function findQuoteProjectBySourceName(
  companyId: string,
  sourcePdfName: string,
): Promise<{ data: QuoteProjectRow | null; error?: string }> {
  const name = sourcePdfName.trim()
  if (!name) return { data: null }
  const { data, error } = await supabase
    .from('quote_projects')
    .select(QUOTE_PROJECT_SELECT)
    .eq('company_id', companyId)
    .eq('source_pdf_name', name)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { data: null, error: error.message }
  return { data: data ? asQuoteProjectRow(data as Record<string, unknown>) : null }
}

export interface UpdateQuoteProjectPdfParams {
  pdf_url: string
  page_count?: number | null
  source_pdf_name?: string | null
}

/** Grava path permanente do PDF + metadados na pasta. */
export async function updateQuoteProjectPdf(
  projectId: string,
  params: UpdateQuoteProjectPdfParams,
): Promise<{ error?: string }> {
  const patch: Record<string, unknown> = {
    pdf_url: params.pdf_url,
    updated_at: new Date().toISOString(),
  }
  if (params.page_count != null) patch.page_count = params.page_count
  if (params.source_pdf_name !== undefined) {
    patch.source_pdf_name = params.source_pdf_name
  }
  const { error } = await supabase.from('quote_projects').update(patch).eq('id', projectId)
  if (error) return { error: error.message }
  return {}
}

/** Substitui o array budgeted_pages da pasta. */
export async function updateQuoteProjectBudgetedPages(
  projectId: string,
  pages: number[],
): Promise<{ error?: string }> {
  const budgeted_pages = normalizeBudgetedPages(pages)
  const { error } = await supabase
    .from('quote_projects')
    .update({ budgeted_pages, updated_at: new Date().toISOString() })
    .eq('id', projectId)
  if (error) return { error: error.message }
  return {}
}

export interface UploadQuoteProjectPdfParams {
  companyId: string
  projectId: string
  file: File
  onProgress?: (percent: number) => void
}

/** Envia o PDF original uma vez para a pasta do projeto (path permanente). */
export async function uploadQuoteProjectPdf(
  params: UploadQuoteProjectPdfParams,
): Promise<UploadQuotePdfResult> {
  const { companyId, projectId, file, onProgress } = params
  const name = file.name.toLowerCase()
  const isPdf = file.type === 'application/pdf' || name.endsWith('.pdf')
  if (!isPdf) {
    return { path: '', error: 'A pasta do projeto aceita apenas PDF no arquivo permanente.' }
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return {
      path: '',
      error: `O arquivo ultrapassa o limite de ${formatSourceBytes(MAX_SOURCE_BYTES)}.`,
    }
  }

  const ready = await ensureOrcamentosIaBucket()
  if (!ready.ok) return { path: '', error: ready.error }

  const path = buildQuoteProjectPdfPath(companyId, projectId)
  try {
    const result = await uploadQuoteSourceViaXhr({
      path,
      file,
      contentType: 'application/pdf',
      onProgress,
    })
    if (result.error) return { path: '', error: result.error }
    return { path }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/abort/i.test(msg)) {
      return {
        path: '',
        error:
          'Upload abortado: o PDF pesado passou do tempo de envio. Mantenha a aba aberta e reenvie.',
      }
    }
    return { path: '', error: msg || 'Falha no upload.' }
  }
}

/** Lista lotes (análises) de uma pasta, mais recentes primeiro. */
export async function listQuoteAnalysesForProject(
  projectId: string,
): Promise<{ data: QuoteAnalysisRow[]; error?: string }> {
  const { data, error } = await supabase
    .from('quote_analyses')
    .select(
      'id, company_id, mode, status, source_pdf_path, error_message, project_id, totals, pricing_modality, pricing_params, created_at, updated_at',
    )
    .eq('project_id', projectId)
    .order('created_at', { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as QuoteAnalysisRow[] }
}

export async function updateQuoteProjectTotals(
  projectId: string,
  patch: Record<string, unknown>,
): Promise<{ error?: string }> {
  const { data: current } = await supabase
    .from('quote_projects')
    .select('totals')
    .eq('id', projectId)
    .maybeSingle()
  const prev =
    current?.totals && typeof current.totals === 'object'
      ? (current.totals as Record<string, unknown>)
      : {}
  const { error } = await supabase
    .from('quote_projects')
    .update({
      totals: { ...prev, ...patch },
      updated_at: new Date().toISOString(),
    })
    .eq('id', projectId)
  if (error) return { error: error.message }
  return {}
}

export interface UploadQuotePdfParams {
  companyId: string
  analysisId: string
  file: File
  /** 0–100 durante o envio (XHR). */
  onProgress?: (percent: number) => void
}

export interface UploadQuotePdfResult {
  path: string
  error?: string
}

/** Envia PDF ou imagem do projeto para o bucket autenticado. */
export async function uploadQuoteSource(params: UploadQuotePdfParams): Promise<UploadQuotePdfResult> {
  const { companyId, analysisId, file, onProgress } = params

  if (!isAllowedQuoteSourceFile(file)) {
    return { path: '', error: 'Envie PDF ou imagens (PNG, JPG, WebP).' }
  }
  if (file.size > MAX_SOURCE_BYTES) {
    return {
      path: '',
      error: `O arquivo ultrapassa o limite de ${formatSourceBytes(MAX_SOURCE_BYTES)}.`,
    }
  }

  const ready = await ensureOrcamentosIaBucket()
  if (!ready.ok) return { path: '', error: ready.error }

  const path = buildQuotePdfPath(companyId, analysisId, file.name)
  // XHR direto no Storage (sem o fetch custom do client) — PDFs grandes
  // não morrem por AbortSignal do wrapper e dá progresso real.
  try {
    const result = await uploadQuoteSourceViaXhr({
      path,
      file,
      contentType: contentTypeForSourceFile(file),
      onProgress,
    })
    if (result.error) return { path: '', error: result.error }
    return { path }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    if (/abort/i.test(msg)) {
      return {
        path: '',
        error:
          'Upload abortado: o PDF pesado passou do tempo de envio. Mantenha a aba aberta e reenvie.',
      }
    }
    return { path: '', error: msg || 'Falha no upload.' }
  }
}

async function uploadQuoteSourceViaXhr(opts: {
  path: string
  file: File
  contentType: string
  onProgress?: (percent: number) => void
}): Promise<{ error?: string }> {
  const { data: sessionData } = await supabase.auth.getSession()
  const token = sessionData.session?.access_token
  if (!token) {
    return { error: 'Sessão expirada. Faça login de novo e reenvie o PDF.' }
  }

  const baseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.replace(/\/$/, '')
  const anonKey =
    (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
    (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
  if (!baseUrl || !anonKey) {
    return { error: 'Configuração do Supabase incompleta no frontend.' }
  }

  const encodedPath = opts.path
    .split('/')
    .map((seg) => encodeURIComponent(seg))
    .join('/')
  const url = `${baseUrl}/storage/v1/object/${ORCAMENTOS_IA_BUCKET}/${encodedPath}`

  return await new Promise<{ error?: string }>((resolve) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', url)
    // PDFs grandes em rede lenta: 40 min (antes 10 min cortava no meio).
    xhr.timeout = 2_400_000
    xhr.setRequestHeader('Authorization', `Bearer ${token}`)
    xhr.setRequestHeader('apikey', anonKey)
    xhr.setRequestHeader('x-upsert', 'true')
    xhr.setRequestHeader('cache-control', '3600')
    xhr.setRequestHeader('Content-Type', opts.contentType)

    xhr.upload.onprogress = (ev) => {
      if (!ev.lengthComputable || !opts.onProgress) return
      const pct = Math.min(100, Math.round((ev.loaded / ev.total) * 100))
      opts.onProgress(pct)
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        opts.onProgress?.(100)
        resolve({})
        return
      }
      let detail = xhr.responseText?.slice(0, 280) || `HTTP ${xhr.status}`
      try {
        const parsed = JSON.parse(xhr.responseText) as { message?: string; error?: string }
        detail = parsed.message || parsed.error || detail
      } catch {
        /* texto cru */
      }
      if (xhr.status === 413) {
        resolve({
          error: `Arquivo rejeitado pelo servidor (muito grande). Limite: ${formatSourceBytes(MAX_SOURCE_BYTES)}.`,
        })
        return
      }
      resolve({ error: detail || `Falha no upload (HTTP ${xhr.status}).` })
    }

    xhr.ontimeout = () => {
      resolve({
        error:
          'Upload abortado: o PDF pesado passou do tempo de envio. Mantenha a aba aberta e reenvie.',
      })
    }
    xhr.onerror = () => {
      resolve({ error: 'Falha de rede no upload. Verifique a conexão e tente de novo.' })
    }
    xhr.onabort = () => {
      resolve({ error: 'Upload cancelado. Reenvie o arquivo.' })
    }

    xhr.send(opts.file)
  })
}

/** @deprecated use uploadQuoteSource */
export async function uploadQuotePdf(params: UploadQuotePdfParams): Promise<UploadQuotePdfResult> {
  return uploadQuoteSource(params)
}

export interface CreateQuoteAnalysisParams {
  companyId: string
  mode: QuoteAnalysisMode
  /** Modelo de visão/extração (default Sonnet econômico). */
  extractionModel?: ExtractionModelKey
  createdBy?: string | null
  sourcePdfPath?: string | null
  /** Pasta de projeto (quote_projects.id). */
  projectId?: string | null
  /** Páginas absolutas deste lote (1-based). */
  pageRanges?: number[] | null
  /** Rótulo compacto do lote (ex.: "1-5, 8"). */
  batchLabel?: string | null
}

export interface QuoteAnalysisRow {
  id: string
  company_id: string
  mode: string
  extraction_model?: string | null
  status: QuoteAnalysisStatus
  source_pdf_path: string | null
  error_message: string | null
  /** Pasta do projeto (quote_projects) — distinto de bom_items.project_id. */
  project_id?: string | null
  /** Checkpoint / progresso async (detalhe da etapa atual). */
  totals?: Record<string, unknown> | null
  pricing_modality?: string | null
  pricing_params?: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

/** Cria o job inicial em PENDING (antes ou depois do upload). */
export async function createPendingQuoteAnalysis(
  params: CreateQuoteAnalysisParams,
): Promise<{ data: QuoteAnalysisRow | null; error?: string }> {
  const extractionModel = isExtractionModelKey(params.extractionModel)
    ? params.extractionModel
    : DEFAULT_EXTRACTION_MODEL
  const pageRanges =
    Array.isArray(params.pageRanges) && params.pageRanges.length > 0
      ? [...new Set(params.pageRanges.filter((p) => Number.isInteger(p) && p > 0))].sort(
          (a, b) => a - b,
        )
      : null
  const totalsSeed: Record<string, unknown> = {}
  if (pageRanges?.length) {
    totalsSeed.page_ranges = pageRanges
    totalsSeed.batch_label = params.batchLabel || formatPageRanges(pageRanges)
  }
  if (params.projectId) {
    totalsSeed.project_id = params.projectId
  }

  const insertRow: Record<string, unknown> = {
    company_id: params.companyId,
    mode: params.mode,
    extraction_model: extractionModel,
    status: 'PENDING',
    created_by: params.createdBy ?? null,
    source_pdf_path: params.sourcePdfPath ?? null,
  }
  if (params.projectId) {
    insertRow.project_id = params.projectId
  }
  if (Object.keys(totalsSeed).length > 0) {
    insertRow.totals = totalsSeed
  }

  const { data, error } = await supabase
    .from('quote_analyses')
    .insert(insertRow)
    .select(
      'id, company_id, mode, extraction_model, status, source_pdf_path, error_message, project_id, totals, created_at, updated_at',
    )
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as QuoteAnalysisRow }
}

export async function updateQuoteAnalysisPdfPath(
  analysisId: string,
  sourcePdfPath: string,
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('quote_analyses')
    .update({ source_pdf_path: sourcePdfPath, updated_at: new Date().toISOString() })
    .eq('id', analysisId)

  if (error) return { error: error.message }
  return {}
}

export function isQuoteAnalysisStatus(value: string): value is QuoteAnalysisStatus {
  return value in QUOTE_STATUS_PROGRESS
}

/** Lista análises da empresa (mais recentes primeiro). */
export async function listQuoteAnalyses(
  companyId: string,
  limit = 40,
): Promise<{ data: QuoteAnalysisRow[]; error?: string }> {
  const { data, error } = await supabase
    .from('quote_analyses')
    .select(
      'id, company_id, mode, status, source_pdf_path, error_message, project_id, totals, created_at, updated_at',
    )
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as QuoteAnalysisRow[] }
}

export const CANCELLED_BY_USER_MESSAGE = 'Interrompido pelo usuário.'

/** True se o job foi cancelado pelo usuário (status/cadeia). */
export function isQuoteAnalysisCancelled(params: {
  status?: string | null
  error_message?: string | null
  totals?: Record<string, unknown> | null
}): boolean {
  const chain =
    params.totals && typeof params.totals.async_chain_status === 'string'
      ? params.totals.async_chain_status
      : ''
  if (chain === 'cancelled') return true
  const err = String(params.error_message || '')
  return /interrompid/i.test(err)
}

/**
 * Pede interrupção da leitura async e do pipeline no cliente.
 * A Edge para no próximo tick; o poll do browser encerra em seguida.
 */
export async function cancelOrcamentosIaAnalysis(
  analysisId: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data: current, error: readErr } = await supabase
    .from('quote_analyses')
    .select('id, status, totals, error_message')
    .eq('id', analysisId)
    .maybeSingle()
  if (readErr) return { ok: false, error: readErr.message }
  if (!current) return { ok: false, error: 'Análise não encontrada.' }

  const status = String(current.status || '')
  if (status === 'COMPLETED' || status === 'NEEDS_REVIEW') {
    return { ok: false, error: 'Este orçamento já terminou — não há o que interromper.' }
  }
  if (isQuoteAnalysisCancelled(current)) {
    return { ok: true }
  }

  const prev =
    current.totals && typeof current.totals === 'object'
      ? (current.totals as Record<string, unknown>)
      : {}
  const detail = 'Interrompido pelo usuário. Use Retomar ou Recomeçar do zero.'
  const thought_log = appendThoughtLog(prev, {
    stage: 'failed',
    kind: 'warn',
    message: detail,
  })

  const { error } = await supabase
    .from('quote_analyses')
    .update({
      status: 'FAILED',
      error_message: CANCELLED_BY_USER_MESSAGE,
      totals: {
        ...prev,
        async_chain_status: 'cancelled',
        pipeline_stage: 'failed',
        pipeline_detail: detail,
        cancel_requested_at: new Date().toISOString(),
        thought_log,
        pipeline_updated_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', analysisId)

  if (error) return { ok: false, error: error.message }
  return { ok: true }
}

/** PDF/páginas da pasta do projeto — compartilhados entre lotes; nunca apagar ao excluir um lote. */
export function isQuoteProjectSharedStoragePath(path: string | null | undefined): boolean {
  if (!path) return false
  return /\/quote-projects\/[^/]+\//.test(path)
}

/**
 * Exclui a análise (cascade em ambientes/módulos/materiais)
 * e remove só arquivos do Storage em `companyId/analysisId/`.
 * Nunca remove PDF/páginas em `…/quote-projects/{projectId}/…`.
 */
export async function deleteQuoteAnalysis(
  analysis: Pick<QuoteAnalysisRow, 'id' | 'company_id' | 'source_pdf_path'>,
): Promise<{ error?: string }> {
  const prefix = `${analysis.company_id}/${analysis.id}`

  // Remove pasta do Storage (PDF + páginas) só deste lote — não a pasta do projeto.
  try {
    const { data: rootFiles } = await supabase.storage.from(ORCAMENTOS_IA_BUCKET).list(prefix, {
      limit: 100,
    })
    const { data: pageFiles } = await supabase.storage
      .from(ORCAMENTOS_IA_BUCKET)
      .list(`${prefix}/pages`, { limit: 100 })

    const paths: string[] = []
    for (const f of rootFiles ?? []) {
      if (f.name) paths.push(`${prefix}/${f.name}`)
    }
    for (const f of pageFiles ?? []) {
      if (f.name) paths.push(`${prefix}/pages/${f.name}`)
    }
    // Só apaga source_pdf_path se for exclusivo deste lote (nunca quote-projects/).
    if (
      analysis.source_pdf_path &&
      !paths.includes(analysis.source_pdf_path) &&
      !isQuoteProjectSharedStoragePath(analysis.source_pdf_path) &&
      analysis.source_pdf_path.startsWith(`${prefix}/`)
    ) {
      paths.push(analysis.source_pdf_path)
    }
    if (paths.length) {
      await supabase.storage.from(ORCAMENTOS_IA_BUCKET).remove(paths)
    }
  } catch {
    // Não bloqueia exclusão do registro se o Storage falhar
  }

  const { error } = await supabase.from('quote_analyses').delete().eq('id', analysis.id)
  if (error) return { error: error.message }
  return {}
}

async function listStorageFilePaths(prefix: string): Promise<string[]> {
  const { data } = await supabase.storage.from(ORCAMENTOS_IA_BUCKET).list(prefix, {
    limit: 300,
    sortBy: { column: 'name', order: 'asc' },
  })
  const paths: string[] = []
  for (const f of data ?? []) {
    if (!f.name || f.name.endsWith('/')) continue
    // Pasta “virtual” no list: sem id e sem metadata de arquivo
    const isFolderPlaceholder = f.id == null && !f.metadata
    if (isFolderPlaceholder) continue
    paths.push(`${prefix}/${f.name}`)
  }
  return paths
}

/**
 * Exclui a pasta de precificação inteira:
 * - todos os lotes (quote_analyses) ligados
 * - PDF permanente, páginas e miniaturas em `…/quote-projects/{id}/`
 * - registro em quote_projects
 */
export async function deleteQuoteProject(params: {
  projectId: string
  companyId: string
}): Promise<{ error?: string; deletedBatches?: number }> {
  const { projectId, companyId } = params
  if (!projectId || !companyId) {
    return { error: 'Pasta ou empresa não identificada.' }
  }

  const { data: project, error: projectError } = await supabase
    .from('quote_projects')
    .select('id, company_id, name')
    .eq('id', projectId)
    .eq('company_id', companyId)
    .maybeSingle()
  if (projectError) return { error: projectError.message }
  if (!project) return { error: 'Pasta não encontrada.' }

  const { data: batches, error: batchesError } = await supabase
    .from('quote_analyses')
    .select('id, company_id, source_pdf_path')
    .eq('project_id', projectId)
  if (batchesError) return { error: batchesError.message }

  for (const batch of batches ?? []) {
    const del = await deleteQuoteAnalysis(batch)
    if (del.error) return { error: del.error, deletedBatches: 0 }
  }

  // Storage compartilhado da pasta (PDF + pages + thumbs).
  const folderPrefix = `${companyId}/quote-projects/${projectId}`
  try {
    const paths = [
      ...(await listStorageFilePaths(folderPrefix)),
      ...(await listStorageFilePaths(`${folderPrefix}/pages`)),
      ...(await listStorageFilePaths(`${folderPrefix}/thumbs`)),
    ]
    // source.pdf pode vir só como path conhecido
    const pdfPath = buildQuoteProjectPdfPath(companyId, projectId)
    if (!paths.includes(pdfPath)) paths.push(pdfPath)
    if (paths.length) {
      // remove em lotes (API tem limite prático)
      for (let i = 0; i < paths.length; i += 50) {
        await supabase.storage.from(ORCAMENTOS_IA_BUCKET).remove(paths.slice(i, i + 50))
      }
    }
  } catch {
    // Segue para apagar o registro mesmo se o Storage falhar parcialmente
  }

  const { error } = await supabase
    .from('quote_projects')
    .delete()
    .eq('id', projectId)
    .eq('company_id', companyId)
  if (error) return { error: error.message }

  return { deletedBatches: batches?.length ?? 0 }
}

/**
 * Lotes criados e abandonados no meio do upload (sem PDF).
 * Marca FAILED para não ficarem “fantasma” na lista.
 */
export async function failOrphanPendingAnalysesWithoutPdf(
  companyId: string,
  olderThanMs = 5 * 60 * 1000,
): Promise<{ failed: number; error?: string }> {
  const cutoff = new Date(Date.now() - olderThanMs).toISOString()
  const { data, error } = await supabase
    .from('quote_analyses')
    .update({
      status: 'FAILED',
      error_message:
        'Upload interrompido: o PDF não chegou a ser gravado. Envie de novo ou use “Cotar mais páginas” se a pasta já tiver o arquivo.',
      updated_at: new Date().toISOString(),
    })
    .eq('company_id', companyId)
    .eq('status', 'PENDING')
    .is('source_pdf_path', null)
    .lt('created_at', cutoff)
    .select('id')

  if (error) return { failed: 0, error: error.message }
  return { failed: data?.length ?? 0 }
}
