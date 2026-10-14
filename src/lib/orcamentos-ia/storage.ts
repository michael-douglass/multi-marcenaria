import { supabase } from '@/lib/supabase'
import {
  DEFAULT_EXTRACTION_MODEL,
  EXTRACTION_MODEL_KEYS,
  EXTRACTION_MODEL_LABELS,
  isExtractionModelKey,
  resolveExtractionApiModel,
  type ExtractionModelKey,
} from '@/lib/orcamentos-ia/openai-models'

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
}

export interface QuoteAnalysisRow {
  id: string
  company_id: string
  mode: string
  extraction_model?: string | null
  status: QuoteAnalysisStatus
  source_pdf_path: string | null
  error_message: string | null
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
  const { data, error } = await supabase
    .from('quote_analyses')
    .insert({
      company_id: params.companyId,
      mode: params.mode,
      extraction_model: extractionModel,
      status: 'PENDING',
      created_by: params.createdBy ?? null,
      source_pdf_path: params.sourcePdfPath ?? null,
    })
    .select(
      'id, company_id, mode, extraction_model, status, source_pdf_path, error_message, created_at, updated_at',
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
      'id, company_id, mode, status, source_pdf_path, error_message, created_at, updated_at',
    )
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as QuoteAnalysisRow[] }
}

/**
 * Exclui a análise (cascade em ambientes/módulos/materiais)
 * e remove arquivos do Storage em `companyId/analysisId/`.
 */
export async function deleteQuoteAnalysis(
  analysis: Pick<QuoteAnalysisRow, 'id' | 'company_id' | 'source_pdf_path'>,
): Promise<{ error?: string }> {
  const prefix = `${analysis.company_id}/${analysis.id}`

  // Remove pasta do Storage (PDF + páginas), se existir
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
    if (analysis.source_pdf_path && !paths.includes(analysis.source_pdf_path)) {
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
