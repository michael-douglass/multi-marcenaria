import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { Check, Circle, FileImage, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Progress } from '@/components/ui/progress'
import { ThoughtShaderCanvas } from '@/components/orcamentos-ia/ThoughtShaderCanvas'
import { getSignedQuotePageUrls } from '@/lib/orcamentos-ia/quote-tree'
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

export interface AiThoughtConsoleProps {
  status: QuoteAnalysisStatus | null
  pipelineStage?: string | null
  pipelineDetail?: string | null
  thoughtLog?: ThoughtLogEntry[]
  uploading?: boolean
  progressOverride?: number
  analysisId?: string | null
  companyId?: string | null
  errorMessage?: string | null
  /** Páginas já processadas (totals.pages_processed) — dispara refresh das thumbs. */
  pagesProcessed?: number | null
  /** Layout reduzido para popup flutuante. */
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
  errorMessage,
  pagesProcessed,
  compact = false,
}: AiThoughtConsoleProps) {
  const current = uploading && !status
    ? ('upload' as PipelineStageId)
    : resolvePipelineStageId(status, pipelineStage)
  const failed = status === 'FAILED'
  const busy = status != null && status !== 'COMPLETED' && status !== 'FAILED'
  const progress =
    progressOverride ??
    (status ? QUOTE_STATUS_PROGRESS[status] : uploading ? 4 : 0)
  // Self-heal: etapa visual = Auditoria; intensidade usa o stage real
  const intensityStage =
    (pipelineStage || '').toLowerCase() === 'self_heal' ? 'self_heal' : current

  const activeStep = PIPELINE_VISUAL_STEPS.find((s) => s.id === current)
  const stepIndex = Math.max(
    1,
    PIPELINE_VISUAL_STEPS.findIndex((s) => s.id === current) + 1,
  )
  const intensity = thoughtIntensityForStage(intensityStage)
  const shaderProgress = Math.min(1, Math.max(0, progress / 100))

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
    const { pages: next } = await getSignedQuotePageUrls(companyId, analysisId, 40)
    setPages(next)
    setPagesLoading(false)
    setActivePage((prev) => {
      if (!next.length) return 0
      if (prev >= next.length) return next.length - 1
      // Durante conversão, acompanha a última página gerada
      if (busy && current === 'converting_pages') return next.length - 1
      return prev
    })
  }, [companyId, analysisId, busy, current])

  useEffect(() => {
    void refreshPages()
  }, [refreshPages, pagesProcessed, status, pipelineStage])

  // Enquanto converte, atualiza thumbs a cada 3s
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

  const currentPreview = pages[activePage] ?? pages[pages.length - 1] ?? null

  return (
    <div
      className={cn(
        'overflow-x-hidden overflow-y-auto rounded-2xl border border-slate-200/90 bg-white/90 shadow-sm backdrop-blur-sm',
        compact ? 'max-h-[min(55vh,480px)]' : 'max-h-[min(92vh,920px)]',
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
          compact
            ? 'grid-cols-1'
            : 'lg:grid-cols-[minmax(0,1.1fr)_minmax(220px,0.9fr)] lg:items-stretch',
        )}
      >
        <div className={cn('flex min-w-0 flex-col gap-3', compact ? 'p-3' : 'p-3 sm:gap-4 sm:p-5')}>
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-0 space-y-1">
              <p
                className="text-[10px] font-bold uppercase tracking-[0.28em] text-[#0066FF]"
                style={{ fontFamily: 'Raleway, sans-serif' }}
              >
                Pensamento da IA · ao vivo
              </p>
              <h3
                className={cn(
                  'leading-none tracking-wide text-[#1a2332]',
                  compact ? 'text-xl' : 'text-2xl sm:text-3xl md:text-4xl',
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

          <div
            className={cn(
              'grid min-h-0 gap-3',
              compact
                ? 'grid-cols-1'
                : 'sm:grid-cols-[120px_minmax(0,1fr)] sm:gap-4 md:grid-cols-[140px_minmax(0,1fr)]',
            )}
          >
            {!compact && (
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
                compact ? 'max-h-[180px]' : 'max-h-[min(40vh,280px)] sm:max-h-[min(36vh,300px)]',
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
                          isLast && busy && 'opacity-100',
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

        {/* Quadro de demonstração: páginas do PDF */}
        {!compact && (
        <div className="relative flex min-h-[220px] flex-col border-t border-slate-200 lg:min-h-[320px] lg:border-l lg:border-t-0">
          <ThoughtShaderCanvas
            className="pointer-events-none absolute inset-0 h-full w-full opacity-40"
            progress={shaderProgress}
            intensity={intensity * 0.55}
            active={busy || !!uploading}
          />

          <div className="relative z-[1] flex min-h-0 flex-1 flex-col gap-2 p-3 sm:p-4">
            <div className="flex items-center justify-between gap-2">
              <p
                className="text-[10px] font-bold uppercase tracking-[0.22em] text-[#0066FF]"
                style={{ fontFamily: 'Raleway, sans-serif' }}
              >
                Páginas do projeto
              </p>
              <span className="text-[10px] tabular-nums text-muted-foreground">
                {pages.length
                  ? `${activePage + 1} / ${pages.length}`
                  : pagesLoading
                    ? 'Carregando…'
                    : 'Aguardando conversão'}
              </span>
            </div>

            <div className="relative flex min-h-[160px] flex-1 items-center justify-center overflow-hidden rounded-xl border border-slate-200/80 bg-white/70 sm:min-h-[200px]">
              {currentPreview ? (
                <img
                  src={currentPreview.url}
                  alt={`Página ${currentPreview.index} do PDF`}
                  className="max-h-[min(42vh,420px)] w-full object-contain object-center"
                  loading="lazy"
                />
              ) : (
                <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-muted-foreground">
                  {pagesLoading || busy || uploading ? (
                    <Loader2 className="h-8 w-8 animate-spin text-[#0066FF]" aria-hidden />
                  ) : (
                    <FileImage className="h-8 w-8 opacity-40" aria-hidden />
                  )}
                  <p
                    className="text-sm"
                    style={{ fontFamily: "'Cormorant Garamond', serif" }}
                  >
                    {busy || uploading
                      ? 'Convertendo o PDF em imagens para a IA ler…'
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
                    <span className="absolute bottom-0 inset-x-0 bg-black/55 py-0.5 text-center text-[9px] font-medium text-white">
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
