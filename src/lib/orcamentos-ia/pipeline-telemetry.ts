/**
 * Telemetria fina do pipeline (extração / auditoria) a partir de `totals`.
 * Usado pelo painel “Engrenagens” — sem depender da Edge.
 */
import {
  QUOTE_STATUS_PROGRESS,
  type QuoteAnalysisStatus,
} from '@/lib/orcamentos-ia/storage'

export type PipelineTelemetryPhase = 'extract' | 'audit' | 'self_heal' | 'other'

export type ShaderThoughtMode = 'extract' | 'audit' | 'idle'

export interface PipelineTelemetry {
  phase: PipelineTelemetryPhase
  shaderMode: ShaderThoughtMode
  /** 0–1 progresso fino da fase atual. */
  progress01: number
  /** 0–100 para a barra. */
  progressPercent: number
  /** Extração */
  currentPage: number | null
  totalPages: number | null
  modulesFound: number
  extractionLot: number | null
  lotLabel: string | null
  asyncChainStatus: string | null
  batchLabel: string | null
  /** Auditoria */
  auditedEnvironments: string[]
  inventoryEnvCount: number
  inventoryEnvNames: string[]
  coverageMissing: number
  selfHealAttempts: number
  currentAuditEnv: string | null
  pipelineDetail: string | null
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v && typeof v === 'object' && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

function parseEnvNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []
  const out: string[] = []
  for (const item of raw) {
    if (typeof item === 'string' && item.trim()) {
      out.push(item.trim())
      continue
    }
    const rec = asRecord(item)
    if (rec) {
      const name =
        (typeof rec.environment === 'string' && rec.environment) ||
        (typeof rec.name === 'string' && rec.name) ||
        null
      if (name?.trim()) out.push(name.trim())
    }
  }
  return out
}

function parseCurrentAuditEnv(detail: string | null, audited: string[]): string | null {
  if (detail) {
    const m =
      detail.match(/Auditoria incremental:\s*(.+?)(?:\s*\(\d+\/\d+\))?…?\s*$/i) ||
      detail.match(/Ambiente auditado:\s*(.+)$/i) ||
      detail.match(/Auditando\s+(.+?)(?:…|\.\.\.|$)/i)
    if (m?.[1]?.trim()) return m[1].trim()
  }
  return audited.length ? audited[audited.length - 1]! : null
}

function resolvePhase(
  status: QuoteAnalysisStatus | null | undefined,
  pipelineStage: string | null | undefined,
  totals: Record<string, unknown>,
): PipelineTelemetryPhase {
  const stage = String(pipelineStage || totals.pipeline_stage || '').toLowerCase()
  if (stage === 'self_heal') return 'self_heal'
  if (
    stage === 'auditing' ||
    stage === 'pricing_pending' ||
    status === 'AUDITING_REVISION'
  ) {
    return 'audit'
  }
  if (
    stage === 'extracting_batch' ||
    stage === 'reading_inventory' ||
    status === 'EXTRACTING_MODULES' ||
    status === 'READING_LAYOUT'
  ) {
    return 'extract'
  }
  return 'other'
}

/**
 * Deriva cartões + progresso fino a partir de totals / status.
 */
export function derivePipelineTelemetry(params: {
  totals?: Record<string, unknown> | null
  status?: QuoteAnalysisStatus | null
  pipelineStage?: string | null
  pipelineDetail?: string | null
}): PipelineTelemetry {
  const totals =
    params.totals && typeof params.totals === 'object' ? params.totals : {}
  const status = params.status ?? null
  const pipelineStage =
    params.pipelineStage ??
    (typeof totals.pipeline_stage === 'string' ? totals.pipeline_stage : null)
  const pipelineDetail =
    (typeof params.pipelineDetail === 'string' && params.pipelineDetail.trim()
      ? params.pipelineDetail.trim()
      : null) ||
    (typeof totals.pipeline_detail === 'string' && totals.pipeline_detail.trim()
      ? totals.pipeline_detail.trim()
      : null)

  const phase = resolvePhase(status, pipelineStage, totals)
  const shaderMode: ShaderThoughtMode =
    phase === 'extract' ? 'extract' : phase === 'audit' || phase === 'self_heal' ? 'audit' : 'idle'

  const currentPageRaw = Number(totals.current_page)
  const totalPagesRaw = Number(totals.total_pages)
  const currentPage =
    Number.isFinite(currentPageRaw) && currentPageRaw > 0 ? Math.floor(currentPageRaw) : null
  const totalPages =
    Number.isFinite(totalPagesRaw) && totalPagesRaw > 0 ? Math.floor(totalPagesRaw) : null

  const modulesFound = Number.isFinite(Number(totals.modules_found_count))
    ? Math.max(0, Math.floor(Number(totals.modules_found_count)))
    : 0

  const extractionLot = Number.isFinite(Number(totals.extraction_lot))
    ? Math.max(0, Math.floor(Number(totals.extraction_lot)))
    : null

  const lotEvery = Number(totals.checkpoint_every_pages) || 15
  let lotLabel: string | null = null
  if (totalPages && totalPages > 0) {
    const page = currentPage ?? 0
    const totalLots = Math.max(1, Math.ceil(totalPages / lotEvery))
    const currentLot = Math.min(totalLots, Math.floor(page / lotEvery) + 1)
    lotLabel = `Lote ${currentLot}/${totalLots}`
  }

  const batchLabel =
    typeof totals.batch_label === 'string' && totals.batch_label.trim()
      ? totals.batch_label.trim()
      : null

  const asyncChainStatus =
    typeof totals.async_chain_status === 'string' ? totals.async_chain_status : null

  const inventoryEnvNames = parseEnvNames(totals.inventory)
  const auditedEnvironments = parseEnvNames(totals.audited_environments)
  const inventoryEnvCount = inventoryEnvNames.length

  const coverage = asRecord(totals.coverage)
  const missingRaw = coverage?.missing
  const coverageMissing = Array.isArray(missingRaw) ? missingRaw.length : 0

  const selfHeal = asRecord(totals.self_heal)
  const selfHealAttempts = Number.isFinite(Number(selfHeal?.attempts))
    ? Math.max(0, Math.floor(Number(selfHeal?.attempts)))
    : 0

  const currentAuditEnv = parseCurrentAuditEnv(pipelineDetail, auditedEnvironments)

  const statusFallback = status ? QUOTE_STATUS_PROGRESS[status] : 0
  let progress01 = Math.min(1, Math.max(0, statusFallback / 100))

  if (phase === 'extract' && totalPages && totalPages > 0) {
    const page = Math.min(totalPages, Math.max(0, currentPage ?? 0))
    progress01 = page / totalPages
  } else if ((phase === 'audit' || phase === 'self_heal') && inventoryEnvCount > 0) {
    progress01 = Math.min(1, auditedEnvironments.length / inventoryEnvCount)
  }

  const progressPercent = Math.round(progress01 * 100)

  return {
    phase,
    shaderMode,
    progress01,
    progressPercent,
    currentPage,
    totalPages,
    modulesFound,
    extractionLot,
    lotLabel,
    asyncChainStatus,
    batchLabel,
    auditedEnvironments,
    inventoryEnvCount,
    inventoryEnvNames,
    coverageMissing,
    selfHealAttempts,
    currentAuditEnv,
    pipelineDetail,
  }
}
