import { useCallback, useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ExternalLink,
  FolderOpen,
  Loader2,
  RefreshCw,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'
import { useEmpresa } from '@/contexts/EmpresaContext'
import { useApp } from '@/context/AppContext'
import { useOrcamentosIaBackground } from '@/contexts/OrcamentosIaBackgroundContext'
import { canAccessCrmPath } from '@/lib/crm-identity'
import { ThoughtShaderCanvas } from '@/components/orcamentos-ia/ThoughtShaderCanvas'
import { AiThoughtConsole } from '@/components/orcamentos-ia/AiThoughtConsole'
import { CORTE_CLAUDE_TOKENS } from '@/lib/orcamentos-ia/ui-tokens'
import { formatBRL } from '@/lib/orcamentos-ia/pricing'
import {
  buildQuoteProjectPagePath,
  createOrcamentosIaSignedUrl,
  findQuoteProjectByLeadId,
  listQuoteAnalysesForProject,
  QUOTE_STATUS_LABEL,
  type QuoteAnalysisRow,
  type QuoteAnalysisStatus,
  type QuoteProjectRow,
} from '@/lib/orcamentos-ia/storage'

const T = CORTE_CLAUDE_TOKENS

interface LeadOrcamentosIaSectionProps {
  leadId: number
  leadName?: string | null
  /** Incrementar após enviar anexos → força refresh. */
  refreshToken?: number
  className?: string
}

function isProcessingStatus(status: QuoteAnalysisStatus): boolean {
  return (
    status === 'PENDING' ||
    status === 'PROCESSING' ||
    status === 'CONVERTING_PAGES' ||
    status === 'READING_LAYOUT' ||
    status === 'EXTRACTING_MODULES' ||
    status === 'FETCHING_MARKET_PRICES' ||
    status === 'AUDITING_REVISION'
  )
}

function saleFromTotals(totals: Record<string, unknown> | null | undefined): number | null {
  if (!totals || typeof totals !== 'object') return null
  const n = Number(totals.sale_price ?? totals.salePrice)
  return Number.isFinite(n) && n > 0 ? n : null
}

function materialsFromTotals(totals: Record<string, unknown> | null | undefined): number | null {
  if (!totals || typeof totals !== 'object') return null
  const n = Number(totals.materials_cost ?? totals.materialsCost ?? totals.cost_price)
  return Number.isFinite(n) && n >= 0 ? n : null
}

/** Progresso amigável (página atual / total) a partir dos totals do lote. */
function derivePageProgress(
  totals: Record<string, unknown> | null | undefined,
): { current: number; total: number } | null {
  if (!totals || typeof totals !== 'object') return null
  const cur = Number(totals.current_page)
  const total = Number(totals.total_pages)
  if (Number.isFinite(cur) && Number.isFinite(total) && total > 0) {
    // current_page no pipeline é 0-based; UI mostra 1-based
    const shown = Math.min(total, Math.max(1, Math.floor(cur) + 1))
    return { current: shown, total: Math.floor(total) }
  }
  const processed = Number(totals.pages_processed)
  if (Number.isFinite(processed) && Number.isFinite(total) && total > 0) {
    return {
      current: Math.min(Math.floor(total), Math.max(0, Math.floor(processed))),
      total: Math.floor(total),
    }
  }
  return null
}

function deriveModulesFound(
  totals: Record<string, unknown> | null | undefined,
): number | null {
  if (!totals || typeof totals !== 'object') return null
  const n = Number(totals.modules_found_count)
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : null
}

/**
 * Prévia Corte Claude da pasta Orçamentos IA ligada ao lead.
 * Não altera Markup comercial — seção paralela.
 */
export function LeadOrcamentosIaSection({
  leadId,
  leadName,
  refreshToken = 0,
  className,
}: LeadOrcamentosIaSectionProps) {
  const { empresa } = useEmpresa()
  const { crmProfile, userProfile } = useApp()
  const bg = useOrcamentosIaBackground()
  const companyId = empresa?.id ?? ''
  const canOpen = canAccessCrmPath('/orcamentos-ia', crmProfile, userProfile)

  const [loading, setLoading] = useState(false)
  const [project, setProject] = useState<QuoteProjectRow | null>(null)
  const [analyses, setAnalyses] = useState<QuoteAnalysisRow[]>([])
  const [thumbUrl, setThumbUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [reducedMotion, setReducedMotion] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    setReducedMotion(mq.matches)
    const onChange = () => setReducedMotion(mq.matches)
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [])

  const load = useCallback(async () => {
    if (!companyId || !leadId) {
      setProject(null)
      setAnalyses([])
      return
    }
    setLoading(true)
    setError(null)
    try {
      const { data: folder, error: folderErr } = await findQuoteProjectByLeadId(
        companyId,
        leadId,
      )
      if (folderErr) {
        setError(folderErr)
        setProject(null)
        setAnalyses([])
        return
      }
      setProject(folder)
      if (!folder) {
        setAnalyses([])
        setThumbUrl(null)
        return
      }
      const { data: batches, error: batchErr } = await listQuoteAnalysesForProject(folder.id)
      if (batchErr) setError(batchErr)
      const sorted = [...(batches ?? [])].sort(
        (a, b) =>
          new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime(),
      )
      setAnalyses(sorted)

      // Prefere path real gravado no lote; evita 400 se page-001 ainda não existir.
      const preferred =
        sorted.find((a) => isProcessingStatus(a.status)) ||
        sorted.find((a) => a.status === 'COMPLETED' || a.status === 'NEEDS_REVIEW') ||
        sorted[0]
      const totals =
        preferred?.totals && typeof preferred.totals === 'object'
          ? (preferred.totals as Record<string, unknown>)
          : null
      const paths = Array.isArray(totals?.page_paths)
        ? (totals.page_paths as unknown[]).filter((p): p is string => typeof p === 'string')
        : []
      const pagePath =
        paths[0] || buildQuoteProjectPagePath(companyId, folder.id, 1)
      try {
        const url = await createOrcamentosIaSignedUrl(pagePath, 60 * 30)
        setThumbUrl(url)
      } catch {
        setThumbUrl(null)
      }
    } finally {
      setLoading(false)
    }
  }, [companyId, leadId])

  useEffect(() => {
    void load()
  }, [load, refreshToken])

  // Preferir lote em andamento (não o FAILED antigo da pasta).
  const latest = useMemo(() => {
    if (!analyses.length) return null
    const running = analyses.find((a) => isProcessingStatus(a.status))
    if (running) return running
    const review = analyses.find((a) => a.status === 'NEEDS_REVIEW')
    if (review) return review
    const done = analyses.find((a) => a.status === 'COMPLETED')
    if (done) return done
    return analyses[0] ?? null
  }, [analyses])

  const analysisIds = useMemo(() => new Set(analyses.map((a) => a.id)), [analyses])

  /** Job ao vivo do popup — prioriza runner ativo / status ocupado. */
  const liveJob = useMemo(() => {
    const forProject = bg.jobs.filter((j) => analysisIds.has(j.analysisId))
    if (!forProject.length) return null
    const active = forProject.find(
      (j) => j.runnerActive || isProcessingStatus(j.status),
    )
    if (active) return active
    if (latest?.id) {
      const hit = forProject.find((j) => j.analysisId === latest.id)
      if (hit) return hit
    }
    return forProject[0] ?? null
  }, [bg.jobs, latest?.id, analysisIds])

  const liveJobSig = liveJob
    ? `${liveJob.analysisId}:${liveJob.status}:${liveJob.pipelineStage}:${liveJob.pipelineDetail}:${liveJob.pagesProcessed}:${liveJob.runnerActive}`
    : ''

  // Enquanto processa, atualiza pasta/totais e acompanha o job em segundo plano.
  useEffect(() => {
    const busy =
      Boolean(liveJob?.runnerActive) ||
      (latest != null && isProcessingStatus(latest.status)) ||
      (liveJob != null && isProcessingStatus(liveJob.status))
    if (!busy) return
    const timer = window.setInterval(() => {
      void load()
    }, 3500)
    return () => window.clearInterval(timer)
  }, [liveJobSig, latest?.status, latest?.id, load, liveJob])

  // Quando o job termina, refresca preço e status.
  useEffect(() => {
    if (!liveJob) return
    if (
      liveJob.status === 'COMPLETED' ||
      liveJob.status === 'NEEDS_REVIEW' ||
      liveJob.status === 'FAILED'
    ) {
      void load()
    }
  }, [liveJob?.status, liveJob?.analysisId, load, liveJob])

  const processing =
    Boolean(liveJob?.runnerActive) ||
    (liveJob != null && isProcessingStatus(liveJob.status)) ||
    (latest != null && isProcessingStatus(latest.status))

  // Totais: banco (poll) + overlay do job ao vivo no mesmo analysisId.
  const displayStatus = (() => {
    if (liveJob && latest && liveJob.analysisId === latest.id) {
      return liveJob.status || latest.status
    }
    if (liveJob && (liveJob.runnerActive || isProcessingStatus(liveJob.status))) {
      return liveJob.status
    }
    return liveJob?.status ?? latest?.status ?? null
  })()

  const displayTotals = useMemo(() => {
    const fromDb =
      latest?.totals && typeof latest.totals === 'object'
        ? (latest.totals as Record<string, unknown>)
        : null
    const fromJob = liveJob?.totalsSnapshot
    if (liveJob && latest && liveJob.analysisId === latest.id) {
      return { ...(fromDb || {}), ...(fromJob || {}) }
    }
    if (liveJob && (liveJob.runnerActive || isProcessingStatus(liveJob.status))) {
      return fromJob || fromDb
    }
    return fromDb || fromJob
  }, [latest, liveJob])

  const displayDetail =
    (liveJob &&
    (!latest || liveJob.analysisId === latest.id || liveJob.runnerActive)
      ? liveJob.pipelineDetail
      : null) ||
    (typeof displayTotals?.pipeline_detail === 'string'
      ? displayTotals.pipeline_detail
      : null)
  const displayStage =
    (liveJob &&
    (!latest || liveJob.analysisId === latest.id || liveJob.runnerActive)
      ? liveJob.pipelineStage
      : null) ||
    (typeof displayTotals?.pipeline_stage === 'string'
      ? displayTotals.pipeline_stage
      : null)

  const folderSale = saleFromTotals(project?.totals)
  const latestSale = saleFromTotals(latest?.totals as Record<string, unknown> | null)
  const salePrice = folderSale ?? latestSale
  const materials =
    materialsFromTotals(project?.totals) ??
    materialsFromTotals(latest?.totals as Record<string, unknown> | null)

  const hubHref = useMemo(() => {
    const auditId = liveJob?.analysisId || latest?.id
    if (auditId) return `/orcamentos-ia?audit=${encodeURIComponent(auditId)}`
    if (project?.id) return `/orcamentos-ia?project=${encodeURIComponent(project.id)}`
    return '/orcamentos-ia'
  }, [liveJob?.analysisId, latest?.id, project?.id])

  const statusLabel = displayStatus
    ? QUOTE_STATUS_LABEL[displayStatus] || displayStatus
    : project
      ? 'Pasta pronta — envie PDF/foto em Anexos'
      : 'Ainda sem cotação IA'

  const showLiveConsole =
    Boolean(liveJob) ||
    (latest != null &&
      (isProcessingStatus(latest.status) ||
        latest.status === 'FAILED' ||
        latest.status === 'NEEDS_REVIEW'))

  const pageProgress = derivePageProgress(displayTotals)
  const modulesFound = deriveModulesFound(displayTotals)
  const shaderProgress = !processing
    ? 0.12
    : pageProgress
      ? Math.min(0.95, Math.max(0.15, pageProgress.current / pageProgress.total))
      : 0.45

  if (!canOpen) return null

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl border border-[rgba(0,102,255,0.22)] bg-[#fffcf8] text-[#2a1812] shadow-sm',
        className,
      )}
      style={{ ['--cc-accent' as string]: T.accent }}
    >
      <div className="relative border-b border-[rgba(0,102,255,0.12)] px-4 py-3 sm:px-5">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              'radial-gradient(ellipse 80% 60% at 100% 0%, rgba(0,102,255,0.14), transparent 55%)',
          }}
        />
        <div className="relative z-[1] flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0 text-[#0066FF]" />
              <h3 className="text-sm font-semibold tracking-tight">Orçamento com IA</h3>
              <Badge
                variant="secondary"
                className="h-5 bg-[#0066FF]/10 px-1.5 text-[10px] font-semibold text-[#0066FF]"
              >
                Corte Claude
              </Badge>
            </div>
            <p className="mt-0.5 text-[11px] text-[#6b5244]">
              {leadName
                ? `Pasta ligada a ${leadName}`
                : 'Cotação fabril a partir dos anexos do lead'}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            title="Atualizar"
            disabled={loading}
            onClick={() => void load()}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
          </Button>
        </div>
      </div>

      <div className="space-y-3 p-4 sm:p-5">
        {!project && !loading ? (
          <p className="text-sm text-[#6b5244]">
            Ainda não há pasta de Orçamentos IA. Em <strong>Fotos e anexos</strong>, use o
            botão azul <strong>Cotar com IA</strong> num PDF ou imagem.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="relative aspect-[4/3] overflow-hidden rounded-xl border border-[rgba(0,102,255,0.2)] bg-[#0f1419]">
              {thumbUrl ? (
                <img
                  src={thumbUrl}
                  alt=""
                  className="absolute inset-0 h-full w-full object-cover opacity-90"
                />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-[11px] font-semibold uppercase tracking-widest text-[#0066FF]/80">
                  Prévia
                </div>
              )}
              {!reducedMotion && (
                <ThoughtShaderCanvas
                  className="absolute inset-0 opacity-55"
                  active={processing}
                  progress={shaderProgress}
                  intensity={processing ? 0.9 : 0.35}
                  mode={processing ? 'extract' : 'idle'}
                />
              )}
              {reducedMotion && (
                <div
                  className="absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(135deg, rgba(0,102,255,0.25), transparent 60%)',
                  }}
                />
              )}
              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between gap-2">
                <span className="rounded-md bg-black/55 px-2 py-0.5 text-[10px] font-medium text-white backdrop-blur-sm">
                  {statusLabel}
                </span>
                {analyses.length > 0 ? (
                  <span className="rounded-md bg-black/55 px-2 py-0.5 text-[10px] text-white/90 backdrop-blur-sm">
                    {analyses.length} lote{analyses.length !== 1 ? 's' : ''}
                  </span>
                ) : null}
              </div>
            </div>

            <div className="flex min-w-0 flex-col justify-between gap-3">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[#0066FF]">
                  {project?.name || 'Pasta do lead'}
                </p>
                {salePrice != null ? (
                  <p className="mt-1 text-2xl font-bold tabular-nums tracking-tight text-[#0f1419]">
                    {formatBRL(salePrice)}
                  </p>
                ) : (
                  <p className="mt-1 text-sm font-medium text-[#6b5244]">
                    {processing
                      ? displayDetail || 'IA calculando o orçamento…'
                      : 'Total aparece quando a cotação concluir'}
                  </p>
                )}
                {materials != null && salePrice != null ? (
                  <p className="mt-0.5 text-[11px] text-[#6b5244]">
                    Materiais {formatBRL(materials)}
                  </p>
                ) : null}
                {processing && pageProgress ? (
                  <div className="mt-2 space-y-1">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#6b5244]">
                      <span className="tabular-nums font-medium text-[#0f1419]">
                        Página {pageProgress.current} / {pageProgress.total}
                      </span>
                      {modulesFound != null ? (
                        <span className="tabular-nums">{modulesFound} módulo(s)</span>
                      ) : null}
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                      <div
                        className="h-full rounded-full bg-[#0066FF] transition-all duration-500"
                        style={{
                          width: `${Math.max(4, Math.round((100 * pageProgress.current) / pageProgress.total))}%`,
                        }}
                      />
                    </div>
                  </div>
                ) : null}
                {error ? (
                  <p className="mt-2 text-[11px] text-destructive">{error}</p>
                ) : null}
              </div>

              <div className="flex flex-wrap gap-2">
                {liveJob?.needsResume || liveJob?.status === 'FAILED' ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-amber-500/40 text-amber-900"
                    onClick={() =>
                      void bg.resumeQuoteAnalysis(liveJob.analysisId, liveJob.companyId)
                    }
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Retomar
                  </Button>
                ) : null}
                <Button
                  type="button"
                  size="sm"
                  className="gap-1.5 bg-[#0066FF] hover:bg-[#0052cc]"
                  asChild
                >
                  <Link to={hubHref}>
                    <ExternalLink className="h-3.5 w-3.5" />
                    {displayStatus === 'COMPLETED' || displayStatus === 'NEEDS_REVIEW'
                      ? 'Abrir conferência'
                      : 'Abrir Orçamentos com IA'}
                  </Link>
                </Button>
                {project ? (
                  <Button type="button" size="sm" variant="outline" className="gap-1.5" asChild>
                    <Link to={`/orcamentos-ia?project=${encodeURIComponent(project.id)}`}>
                      <FolderOpen className="h-3.5 w-3.5" />
                      Ver pasta
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {showLiveConsole && project ? (
          <div className="overflow-hidden rounded-xl border border-[#0066FF]/25 bg-white/90">
            <div className="border-b border-slate-200/80 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0066FF]">
                Passos da precificação
              </p>
              <p className="truncate text-[11px] text-slate-500">
                {liveJob?.fileName ||
                  (typeof displayTotals?.batch_label === 'string'
                    ? displayTotals.batch_label
                    : null) ||
                  latest?.id?.slice(0, 8) ||
                  'Lote'}
              </p>
            </div>
            <AiThoughtConsole
              status={displayStatus}
              pipelineStage={displayStage}
              pipelineDetail={displayDetail}
              thoughtLog={liveJob?.thoughtLog}
              analysisId={liveJob?.analysisId || latest?.id}
              companyId={liveJob?.companyId || companyId}
              projectId={project.id}
              pagesProcessed={
                liveJob?.pagesProcessed ??
                (typeof displayTotals?.pages_processed === 'number'
                  ? displayTotals.pages_processed
                  : null)
              }
              totals={displayTotals}
              errorMessage={
                liveJob?.runnerActive ||
                (liveJob != null && isProcessingStatus(liveJob.status))
                  ? null
                  : liveJob?.errorMessage || latest?.error_message || null
              }
              density="workshop"
            />
          </div>
        ) : null}

        {analyses.length > 1 ? (
          <ul className="space-y-1.5 border-t border-[rgba(42,24,18,0.08)] pt-3">
            {analyses.slice(0, 4).map((a) => (
              <li key={a.id}>
                <Link
                  to={`/orcamentos-ia?audit=${encodeURIComponent(a.id)}`}
                  className="flex items-center justify-between gap-2 rounded-md border border-transparent px-2 py-1.5 text-xs transition-colors hover:border-[#0066FF]/25 hover:bg-[#0066FF]/[0.04]"
                >
                  <span className="truncate text-[#2a1812]">
                    {QUOTE_STATUS_LABEL[a.status] || a.status}
                  </span>
                  <span className="shrink-0 tabular-nums text-[#6b5244]">
                    {saleFromTotals(a.totals as Record<string, unknown>) != null
                      ? formatBRL(saleFromTotals(a.totals as Record<string, unknown>)!)
                      : new Date(a.created_at).toLocaleDateString('pt-BR')}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </div>
  )
}
