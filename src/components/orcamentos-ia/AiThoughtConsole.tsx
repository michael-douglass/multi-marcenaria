import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import {
  Check,
  Circle,
  Cog,
  FileImage,
  Loader2,
  ScanSearch,
  ShieldCheck,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { Badge } from '@/components/ui/badge'
import { ThoughtShaderCanvas } from '@/components/orcamentos-ia/ThoughtShaderCanvas'
import { getSignedQuotePageUrls } from '@/lib/orcamentos-ia/quote-tree'
import { derivePipelineTelemetry } from '@/lib/orcamentos-ia/pipeline-telemetry'
import { pageNumbersFromTotals } from '@/lib/orcamentos-ia/pdf-processor'
import {
  PIPELINE_VISUAL_STEPS,
  QUOTE_STATUS_PROGRESS,
  resolvePipelineStageId,
  thoughtIntensityForStage,
  type PipelineStageId,
  type QuoteAnalysisStatus,
  type ThoughtKind,
  type ThoughtLogEntry,
} from '@/lib/orcamentos-ia/storage'

export type AiThoughtDensity = 'compact' | 'workshop' | 'full'

export interface AiThoughtConsoleProps {
  status: QuoteAnalysisStatus | null
  pipelineStage?: string | null
  pipelineDetail?: string | null
  thoughtLog?: ThoughtLogEntry[]
  uploading?: boolean
  progressOverride?: number
  analysisId?: string | null
  companyId?: string | null
  /** Pasta do projeto — páginas JPEG ficam em quote-projects/{id}/pages. */
  projectId?: string | null
  errorMessage?: string | null
  /** Páginas já processadas (totals.pages_processed) — dispara refresh das thumbs. */
  pagesProcessed?: number | null
  /** totals do lote — engrenagens extract/audit. */
  totals?: Record<string, unknown> | null
  /**
   * compact = log estreito (legado)
   * workshop = lista/popup com engrenagens + shader
   * full = upload / tela ampla
   */
  density?: AiThoughtDensity
  /** @deprecated use density="compact" */
  compact?: boolean
}

function stepState(
  stepId: PipelineStageId,
  current: PipelineStageId,
  failed: boolean,
): 'done' | 'active' | 'pending' | 'failed' {
  if (failed && stepId === current) return 'failed'
  if (current === 'completed') return 'done'
  if (current === 'failed') {
    const order = PIPELINE_VISUAL_STEPS.map((s) => s.id)
    const failIdx = Math.max(0, order.indexOf('persisting'))
    const stepIdx = order.indexOf(stepId)
    if (stepIdx < 0) return 'pending'
    if (stepIdx < failIdx) return 'done'
    return stepId === 'completed' ? 'pending' : stepIdx === failIdx ? 'failed' : 'pending'
  }
  const order = PIPELINE_VISUAL_STEPS.map((s) => s.id)
  const curIdx = order.indexOf(current === 'failed' ? 'upload' : current)
  const stepIdx = order.indexOf(stepId)
  if (stepIdx < curIdx) return 'done'
  if (stepIdx === curIdx) return 'active'
  return 'pending'
}

const KIND_LABEL: Record<ThoughtKind, string> = {
  info: 'info',
  vision: 'visão',
  audit: 'auditoria',
  price: 'preço',
  warn: 'alerta',
  done: 'ok',
}

function formatClock(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  } catch {
    return ''
  }
}

function kindChipClass(kind: ThoughtKind): string {
  switch (kind) {
    case 'vision':
      return 'border-[#0066FF]/35 bg-[#0066FF]/10 text-[#0066FF]'
    case 'audit':
      return 'border-amber-600/30 bg-amber-500/10 text-amber-800'
    case 'price':
      return 'border-emerald-600/30 bg-emerald-500/10 text-emerald-800'
    case 'warn':
      return 'border-destructive/35 bg-destructive/10 text-destructive'
    case 'done':
      return 'border-emerald-600/35 bg-emerald-500/15 text-emerald-800'
    default:
      return 'border-slate-300 bg-slate-100 text-slate-600'
  }
}

interface PagePreview {
  path: string
  url: string
  index: number
}

function resolveDensity(
  density: AiThoughtDensity | undefined,
  compact: boolean | undefined,
): AiThoughtDensity {
  if (density) return density
  if (compact) return 'compact'
  return 'full'
}

/** Console de oficina: etapas + pensamento ao vivo + preview das páginas do PDF. */
export function AiThoughtConsole({
  status,
  pipelineStage,
  pipelineDetail,
  thoughtLog = [],
  uploading,
  progressOverride,
  analysisId,
  companyId,
  projectId: projectIdProp,
  errorMessage,
  pagesProcessed,
  totals = null,
  density: densityProp,
  compact = false,
}: AiThoughtConsoleProps) {
  const density = resolveDensity(densityProp, compact)
  const isCompact = density === 'compact'
  const isWorkshop = density === 'workshop'
  const showSidePanel = density === 'full' || density === 'workshop'
  const showTimeline = density !== 'compact'

  const current =
    uploading && !status
      ? ('upload' as PipelineStageId)
      : resolvePipelineStageId(status, pipelineStage)
  const failed = status === 'FAILED'
  const busy = status != null && status !== 'COMPLETED' && status !== 'FAILED'
  const converting = busy && current === 'converting_pages'

  const resolvedProjectId = useMemo(() => {
    if (typeof projectIdProp === 'string' && projectIdProp.trim()) return projectIdProp.trim()
    const fromTotals =
      totals && typeof totals.project_id === 'string' ? totals.project_id.trim() : ''
    return fromTotals || null
  }, [projectIdProp, totals])

  const preferredPagePaths = useMemo(() => {
    if (!totals || !Array.isArray(totals.page_paths)) return null
    const paths = totals.page_paths.filter((p): p is string => typeof p === 'string' && p.length > 0)
    return paths.length ? paths : null
  }, [totals])

  /** Chave estável — evita re-fetch a cada novo objeto totals do poll. */
  const preferredPathsKey = preferredPagePaths?.join('\n') ?? ''

  const batchPageNumbers = useMemo(() => pageNumbersFromTotals(totals), [totals])
  const batchPagesKey = batchPageNumbers.join(',')

  const knownPageCount = preferredPagePaths?.length || batchPageNumbers.length || 0

  const telemetry = useMemo(
    () =>
      derivePipelineTelemetry({
        totals,
        status,
        pipelineStage,
        pipelineDetail,
      }),
    [totals, status, pipelineStage, pipelineDetail],
  )

  const progress =
    progressOverride ??
    (telemetry.phase === 'extract' || telemetry.phase === 'audit' || telemetry.phase === 'self_heal'
      ? telemetry.progressPercent
      : status
        ? QUOTE_STATUS_PROGRESS[status]
        : uploading
          ? 4
          : 0)

  const intensityStage =
    (pipelineStage || '').toLowerCase() === 'self_heal' ? 'self_heal' : current

  const activeStep = PIPELINE_VISUAL_STEPS.find((s) => s.id === current)
  const stepIndex = Math.max(
    1,
    PIPELINE_VISUAL_STEPS.findIndex((s) => s.id === current) + 1,
  )
  const intensity = thoughtIntensityForStage(intensityStage)
  const shaderProgress =
    telemetry.phase === 'extract' || telemetry.phase === 'audit' || telemetry.phase === 'self_heal'
      ? telemetry.progress01
      : Math.min(1, Math.max(0, progress / 100))

  const logRef = useRef<HTMLDivElement>(null)
  const [pages, setPages] = useState<PagePreview[]>([])
  const [activePage, setActivePage] = useState(0)
  const [pagesLoading, setPagesLoading] = useState(false)

  const displayLog = useMemo(() => {
    if (thoughtLog.length) return thoughtLog
    if (pipelineDetail) {
      return [
        {
          at: new Date().toISOString(),
          stage: current,
          kind: 'info' as ThoughtKind,
          message: pipelineDetail,
        },
      ]
    }
    return []
  }, [thoughtLog, pipelineDetail, current])

  const refreshPages = useCallback(async () => {
    if (!companyId || !analysisId) return
    setPagesLoading(true)
    try {
      const preferred =
        preferredPathsKey.length > 0 ? preferredPathsKey.split('\n') : null
      const batchNums = batchPagesKey
        ? batchPagesKey.split(',').map((n) => Number(n)).filter((n) => n >= 1)
        : []
      const { pages: loaded } = await getSignedQuotePageUrls(companyId, analysisId, 80, {
        projectId: resolvedProjectId,
        preferredPaths: preferred,
        pageNumbers: batchNums.length ? batchNums : null,
      })
      setPages(loaded)
      setActivePage((prev) => {
        if (!loaded.length) return 0
        if (prev >= loaded.length) return loaded.length - 1
        if (busy && current === 'converting_pages') return loaded.length - 1
        if (busy && telemetry.currentPage != null) {
          const idx = loaded.findIndex((p) => p.index === telemetry.currentPage)
          if (idx >= 0) return idx
        }
        return prev
      })
    } finally {
      setPagesLoading(false)
    }
  }, [
    companyId,
    analysisId,
    resolvedProjectId,
    preferredPathsKey,
    batchPagesKey,
    busy,
    current,
    telemetry.currentPage,
  ])

  useEffect(() => {
    void refreshPages()
  }, [
    refreshPages,
    pagesProcessed,
    status,
    pipelineStage,
    telemetry.currentPage,
    resolvedProjectId,
    preferredPathsKey,
    batchPagesKey,
  ])

  useEffect(() => {
    if (!companyId || !analysisId) return
    if (!(busy || uploading)) return
    const timer = window.setInterval(() => void refreshPages(), 3000)
    return () => window.clearInterval(timer)
  }, [companyId, analysisId, busy, uploading, refreshPages])

  useEffect(() => {
    const el = logRef.current
    if (!el) return
    el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [displayLog.length, pipelineDetail])

  // Sync active page when current_page changes during extract
  useEffect(() => {
    if (telemetry.currentPage == null || !pages.length) return
    const idx = pages.findIndex((p) => p.index === telemetry.currentPage)
    if (idx >= 0) setActivePage(idx)
  }, [telemetry.currentPage, pages])

  const currentPreview = pages[activePage] ?? pages[pages.length - 1] ?? null

  const gearsCard =
    isWorkshop || density === 'full' ? (
      <div className="grid gap-2 rounded-xl border border-[#0066FF]/25 bg-gradient-to-br from-[#0066FF]/[0.06] to-[#f7f4ef]/90 p-3 sm:grid-cols-2">
        <div className="min-w-0 space-y-2 rounded-lg border border-slate-200/80 bg-white/80 p-2.5">
          <div className="flex items-center gap-1.5">
            <ScanSearch className="h-3.5 w-3.5 text-[#0066FF]" aria-hidden />
            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#0066FF]"
              style={{ fontFamily: 'Raleway, sans-serif' }}
            >
              Extração
            </p>
            {telemetry.phase === 'extract' && busy ? (
              <Loader2 className="ml-auto h-3 w-3 animate-spin text-[#0066FF]" aria-hidden />
            ) : null}
          </div>
          <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
            <div>
              <dt className="text-muted-foreground">Página</dt>
              <dd className="font-semibold tabular-nums text-[#1a2332]">
                {telemetry.currentPage != null && telemetry.totalPages != null
                  ? `${telemetry.currentPage} / ${telemetry.totalPages}`
                  : '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Lote</dt>
              <dd className="font-semibold tabular-nums text-[#1a2332]">
                {telemetry.lotLabel ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Módulos</dt>
              <dd className="font-semibold tabular-nums text-[#0066FF]">
                {telemetry.modulesFound}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Cadeia</dt>
              <dd className="truncate font-medium text-[#1a2332]">
                {telemetry.asyncChainStatus ?? '—'}
              </dd>
            </div>
          </dl>
          {telemetry.batchLabel ? (
            <p className="truncate text-[10px] text-slate-500">
              Págs. {telemetry.batchLabel}
            </p>
          ) : null}
        </div>

        <div className="min-w-0 space-y-2 rounded-lg border border-slate-200/80 bg-white/80 p-2.5">
          <div className="flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5 text-amber-700" aria-hidden />
            <p
              className="text-[10px] font-bold uppercase tracking-[0.18em] text-amber-800"
              style={{ fontFamily: 'Raleway, sans-serif' }}
            >
              Auditoria
            </p>
            {(telemetry.phase === 'audit' || telemetry.phase === 'self_heal') && busy ? (
              <Cog className="ml-auto h-3.5 w-3.5 animate-spin text-amber-700" aria-hidden />
            ) : null}
          </div>
          <dl className="grid grid-cols-2 gap-x-2 gap-y-1.5 text-[11px]">
            <div className="col-span-2">
              <dt className="text-muted-foreground">Ambiente atual</dt>
              <dd className="truncate font-semibold text-[#1a2332]">
                {telemetry.currentAuditEnv ?? '—'}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Auditados</dt>
              <dd className="font-semibold tabular-nums text-[#1a2332]">
                {telemetry.auditedEnvironments.length}
                {telemetry.inventoryEnvCount > 0
                  ? ` / ${telemetry.inventoryEnvCount}`
                  : ''}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Faltando</dt>
              <dd
                className={cn(
                  'font-semibold tabular-nums',
                  telemetry.coverageMissing > 0 ? 'text-amber-700' : 'text-emerald-700',
                )}
              >
                {telemetry.coverageMissing}
              </dd>
            </div>
          </dl>
          {telemetry.selfHealAttempts > 0 ? (
            <Badge
              variant="outline"
              className="border-amber-500/40 text-[10px] font-normal text-amber-800"
            >
              Auto-correção {telemetry.selfHealAttempts}×
            </Badge>
          ) : null}
          {telemetry.auditedEnvironments.length > 0 ? (
            <div className="flex max-h-[52px] flex-wrap gap-1 overflow-y-auto">
              {telemetry.auditedEnvironments.slice(-8).map((env) => (
                <span
                  key={env}
                  className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] text-slate-600"
                >
                  {env}
                </span>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    ) : null

  return (
    <div
      className={cn(
        'overflow-x-hidden overflow-y-auto rounded-2xl border border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-sm',
        isCompact && 'max-h-[min(55vh,480px)]',
        isWorkshop && 'max-h-[min(72vh,720px)]',
        density === 'full' && 'max-h-[min(92vh,920px)]',
      )}
      style={
        {
          '--oi-accent': '#0066FF',
        } as CSSProperties
      }
    >
      <div
        className={cn(
          'grid gap-0',
          showSidePanel
            ? 'lg:grid-cols-[minmax(0,1.15fr)_minmax(200px,0.85fr)] lg:items-stretch'
            : 'grid-cols-1',
        )}
      >
        <div
          className={cn(
            'flex min-w-0 flex-col gap-3',
            isCompact ? 'p-3' : 'p-3 sm:gap-3.5 sm:p-4',
          )}
        >
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p
                className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#0066FF]"
                style={{ fontFamily: 'Raleway, sans-serif' }}
              >
                {isWorkshop ? 'Engrenagens · ao vivo' : 'Pensamento da IA · ao vivo'}
              </p>
              <h3
                className={cn(
                  'leading-none tracking-wide text-[#1a2332]',
                  isCompact ? 'text-xl' : 'text-2xl sm:text-3xl',
                )}
                style={{ fontFamily: "'Bebas Neue', sans-serif" }}
              >
                {stepIndex} · {activeStep?.shortLabel ?? 'Processando'}
              </h3>
              <p
                className="max-w-xl text-sm text-[#5c6570]"
                style={{ fontFamily: "'Cormorant Garamond', serif" }}
              >
                {pipelineDetail || activeStep?.hint || 'Aguardando…'}
              </p>
            </div>
            <div className="text-right">
              <span className="block text-xl font-semibold tabular-nums text-[#1a2332] sm:text-2xl">
                {progress}%
              </span>
              <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
                {status === 'COMPLETED'
                  ? 'Concluído'
                  : status === 'FAILED'
                    ? 'Falhou'
                    : telemetry.phase === 'extract'
                      ? 'Extraindo'
                      : telemetry.phase === 'audit' || telemetry.phase === 'self_heal'
                        ? 'Auditando'
                        : 'Em andamento'}
              </span>
            </div>
          </div>

          <Progress value={progress} className="h-1.5 shrink-0" />

          {errorMessage && (
            <p className="rounded-lg border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
              {errorMessage}
            </p>
          )}

          {gearsCard}

          {showTimeline && isWorkshop ? (
            <ol className="flex gap-1 overflow-x-auto pb-0.5">
              {PIPELINE_VISUAL_STEPS.map((step) => {
                const state = stepState(step.id, current, failed)
                return (
                  <li
                    key={step.id}
                    className={cn(
                      'flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-[10px] transition-colors',
                      state === 'active' && 'bg-[#0066FF]/10 text-[#0066FF]',
                      state === 'done' && 'text-emerald-700',
                      state === 'failed' && 'bg-destructive/10 text-destructive',
                      state === 'pending' && 'text-muted-foreground/55',
                    )}
                  >
                    {state === 'done' && <Check className="h-3 w-3" aria-hidden />}
                    {state === 'active' && (
                      <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                    )}
                    {state === 'failed' && <X className="h-3 w-3" aria-hidden />}
                    {state === 'pending' && <Circle className="h-3 w-3" aria-hidden />}
                    <span className="font-medium">{step.shortLabel}</span>
                  </li>
                )
              })}
            </ol>
          ) : null}

          <div
            className={cn(
              'grid min-h-0 gap-3',
              density === 'full'
                ? 'sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4 md:grid-cols-[140px_minmax(0,1fr)]'
                : 'grid-cols-1',
            )}
          >
            {density === 'full' && (
              <ol className="flex gap-1 overflow-x-auto pb-1 sm:flex-col sm:space-y-1 sm:overflow-visible sm:pb-0">
                {PIPELINE_VISUAL_STEPS.map((step) => {
                  const state = stepState(step.id, current, failed)
                  return (
                    <li
                      key={step.id}
                      className={cn(
                        'flex shrink-0 items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                        state === 'active' && 'bg-[#0066FF]/10 text-[#0066FF]',
                        state === 'done' && 'text-emerald-700',
                        state === 'failed' && 'bg-destructive/10 text-destructive',
                        state === 'pending' && 'text-muted-foreground/55',
                      )}
                    >
                      <span className="shrink-0">
                        {state === 'done' && <Check className="h-3.5 w-3.5" aria-hidden />}
                        {state === 'active' && (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                        )}
                        {state === 'failed' && <X className="h-3.5 w-3.5" aria-hidden />}
                        {state === 'pending' && <Circle className="h-3.5 w-3.5" aria-hidden />}
                      </span>
                      <span className="truncate font-medium">{step.shortLabel}</span>
                    </li>
                  )
                })}
              </ol>
            )}

            <div
              ref={logRef}
              className={cn(
                'min-h-[120px] overflow-y-auto rounded-xl border border-slate-200 bg-[#f7f4ef]/80 px-3 py-2.5 font-mono text-[11px] leading-relaxed text-[#1a2332]',
                isCompact && 'max-h-[180px]',
                isWorkshop && 'max-h-[280px]',
                density === 'full' && 'max-h-[min(40vh,280px)] sm:max-h-[min(36vh,300px)]',
              )}
              role="log"
              aria-live="polite"
              aria-relevant="additions"
            >
              {displayLog.length === 0 ? (
                <p className="text-muted-foreground">Aguardando o primeiro pensamento…</p>
              ) : (
                <ul className="space-y-2.5">
                  {displayLog.map((entry, i) => {
                    const isLast = i === displayLog.length - 1
                    return (
                      <li
                        key={`${entry.at}-${i}`}
                        className={cn(
                          'animate-in fade-in slide-in-from-bottom-1 duration-300',
                          isLast && busy && 'rounded-md bg-[#0066FF]/[0.06] px-1.5 py-1',
                          !isLast && 'opacity-80',
                        )}
                      >
                        <div className="mb-0.5 flex flex-wrap items-center gap-1.5">
                          <span className="tabular-nums text-[10px] text-muted-foreground">
                            {formatClock(entry.at)}
                          </span>
                          <span
                            className={cn(
                              'rounded border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide',
                              kindChipClass(entry.kind),
                            )}
                          >
                            {KIND_LABEL[entry.kind] || entry.kind}
                          </span>
                        </div>
                        <p className={cn('text-[12px]', isLast && busy && 'font-medium')}>
                          {entry.kind === 'done' ? `✓ ${entry.message}` : entry.message}
                          {isLast && busy && (
                            <span className="ml-0.5 inline-block h-3 w-[2px] animate-pulse bg-[#0066FF] align-middle" />
                          )}
                        </p>
                      </li>
                    )
                  })}
                </ul>
              )}
            </div>
          </div>

          {analysisId && (
            <p className="text-[10px] text-muted-foreground">ID: {analysisId}</p>
          )}
        </div>

        {showSidePanel && (
          <div
            className={cn(
              'relative flex flex-col border-t border-slate-200 lg:border-l lg:border-t-0',
              isWorkshop ? 'min-h-[180px] lg:min-h-[280px]' : 'min-h-[220px] lg:min-h-[320px]',
            )}
          >
            <ThoughtShaderCanvas
              className="pointer-events-none absolute inset-0 h-full w-full opacity-45"
              progress={shaderProgress}
              intensity={intensity * 0.55}
              active={busy || !!uploading}
              mode={telemetry.shaderMode}
            />

            <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-2 p-3 sm:p-4">
              <div className="flex items-center justify-between gap-2">
                <p
                  className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#0066FF]"
                  style={{ fontFamily: 'Raleway, sans-serif' }}
                >
                  {telemetry.phase === 'audit' || telemetry.phase === 'self_heal'
                    ? 'Nós da auditoria'
                    : 'Páginas do projeto'}
                </p>
                <span className="text-[10px] tabular-nums text-muted-foreground">
                  {pages.length
                    ? `${activePage + 1} / ${pages.length}`
                    : pagesLoading
                      ? 'Carregando…'
                      : 'Aguardando conversão'}
                </span>
              </div>

              <div
                className={cn(
                  'relative flex flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-200/80 bg-white/70',
                  isWorkshop ? 'min-h-[120px]' : 'min-h-[160px] sm:min-h-[200px]',
                )}
              >
                {currentPreview ? (
                  <img
                    src={currentPreview.url}
                    alt={`Página ${currentPreview.index} do PDF`}
                    className={cn(
                      'w-full object-contain object-center',
                      isWorkshop
                        ? 'max-h-[min(28vh,240px)]'
                        : 'max-h-[min(42vh,420px)]',
                    )}
                    loading="lazy"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-muted-foreground">
                    {pagesLoading || converting || uploading ? (
                      <Loader2 className="h-8 w-8 animate-spin text-[#0066FF]" aria-hidden />
                    ) : (
                      <FileImage className="h-8 w-8 opacity-40" aria-hidden />
                    )}
                    <p
                      className="text-sm"
                      style={{ fontFamily: "'Cormorant Garamond', serif" }}
                    >
                      {pagesLoading
                        ? 'Carregando pré-visualização das páginas…'
                        : knownPageCount > 0 && !pages.length
                          ? 'As imagens deste lote estão na pasta — tentando liberar a pré-visualização…'
                          : converting || uploading
                            ? 'Convertendo o PDF em imagens para a IA ler…'
                            : busy
                              ? 'Buscando as páginas deste lote na pasta do projeto…'
                              : 'As páginas do PDF aparecem aqui assim que forem convertidas.'}
                    </p>
                  </div>
                )}
              </div>

              {pages.length > 0 && (
                <div className="flex gap-2 overflow-x-auto pb-1">
                  {pages.map((page, i) => (
                    <button
                      key={page.path}
                      type="button"
                      onClick={() => setActivePage(i)}
                      className={cn(
                        'relative h-14 w-11 shrink-0 overflow-hidden rounded-md border bg-white transition-all sm:h-16 sm:w-12',
                        i === activePage
                          ? 'border-[#0066FF] ring-2 ring-[#0066FF]/35'
                          : 'border-slate-200 opacity-80 hover:opacity-100',
                        telemetry.currentPage === page.index &&
                          telemetry.phase === 'extract' &&
                          'ring-2 ring-amber-400/50',
                      )}
                      aria-label={`Ver página ${page.index}`}
                      aria-pressed={i === activePage}
                    >
                      <img
                        src={page.url}
                        alt=""
                        className="h-full w-full object-cover object-top"
                        loading="lazy"
                      />
                      <span className="absolute inset-x-0 bottom-0 bg-black/55 py-0.5 text-center text-[9px] font-medium text-white">
                        {page.index}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/** @deprecated use AiThoughtConsole — mantido para imports antigos */
export function AnalysisPipelineStages(
  props: Pick<
    AiThoughtConsoleProps,
    'status' | 'pipelineStage' | 'pipelineDetail' | 'uploading'
  >,
) {
  return <AiThoughtConsole {...props} />
}
