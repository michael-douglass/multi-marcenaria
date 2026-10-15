import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  AlertCircle,
  BrainCircuit,
  CheckCircle2,
  ExternalLink,
  Loader2,
  Minus,
  Play,
  RotateCcw,
  Square,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import {
  FLOATING_HORIZONTAL,
  FLOATING_ORCAMENTOS_IA_ICON_RIGHT,
  FLOATING_ORCAMENTOS_IA_ICON_TOP,
  FLOATING_POPUP_TOP,
  floatingPopupMaxHeightStyle,
} from '@/lib/floating-ui-layout'
import {
  floatingAiBackgroundClass,
  FLOATING_UI_ROOT_ATTR,
} from '@/lib/overlay-z-index'
import {
  useOrcamentosIaBackground,
  type OrcamentosIaBackgroundJob,
} from '@/contexts/OrcamentosIaBackgroundContext'
import {
  QUOTE_STATUS_LABEL,
  QUOTE_STATUS_PROGRESS,
} from '@/lib/orcamentos-ia/storage'
import { AiThoughtConsole } from '@/components/orcamentos-ia/AiThoughtConsole'

interface OrcamentosIaBackgroundPopupProps {
  isIconSlotTaken?: boolean
  expandRequest?: number
  onMinimizedChange?: (minimized: boolean, meta: { count: number; activeCount: number }) => void
}

function isActiveJob(job: OrcamentosIaBackgroundJob): boolean {
  return (
    job.runnerActive ||
    job.needsResume ||
    (job.status !== 'COMPLETED' && job.status !== 'FAILED')
  )
}

export function OrcamentosIaBackgroundPopup({
  isIconSlotTaken = false,
  expandRequest = 0,
  onMinimizedChange,
}: OrcamentosIaBackgroundPopupProps) {
  const ctx = useOrcamentosIaBackground()
  /** Sempre inicia como miniatura; só expande por clique do usuário (ícone / Acompanhar). */
  const [isMinimized, setIsMinimized] = useState(true)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const lastExpandRequestRef = useRef(expandRequest)
  const lastCtxExpandRef = useRef(ctx.expandRequest)

  const visibleJobs = [...ctx.jobs].sort((a, b) => b.startedAt - a.startedAt)
  const activeCount = visibleJobs.filter(isActiveJob).length

  const focusJobId = (analysisId: string | null | undefined) => {
    if (!analysisId) return
    const match = visibleJobs.find((j) => j.analysisId === analysisId)
    if (match) setExpandedId(match.id)
  }

  useEffect(() => {
    if (expandRequest === lastExpandRequestRef.current) return
    lastExpandRequestRef.current = expandRequest
    if (expandRequest > 0) {
      setIsMinimized(false)
      focusJobId(ctx.focusAnalysisId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expandRequest, ctx.focusAnalysisId])

  useEffect(() => {
    if (ctx.expandRequest === lastCtxExpandRef.current) return
    lastCtxExpandRef.current = ctx.expandRequest
    if (ctx.expandRequest > 0) {
      setIsMinimized(false)
      focusJobId(ctx.focusAnalysisId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ctx.expandRequest, ctx.focusAnalysisId])

  useEffect(() => {
    onMinimizedChange?.(isMinimized, {
      count: visibleJobs.length,
      activeCount,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMinimized, visibleJobs.length, activeCount])

  if (visibleJobs.length === 0) return null
  if (typeof document === 'undefined') return null

  const floatingRootProps = {
    [FLOATING_UI_ROOT_ATTR]: '' as const,
  }

  if (isMinimized) {
    if (isIconSlotTaken) return null
    return createPortal(
      <div
        {...floatingRootProps}
        className={cn(
          'fixed pointer-events-auto',
          FLOATING_ORCAMENTOS_IA_ICON_TOP,
          FLOATING_ORCAMENTOS_IA_ICON_RIGHT,
          floatingAiBackgroundClass,
        )}
      >
        <button
          type="button"
          onClick={() => setIsMinimized(false)}
          className={cn(
            'relative flex h-12 w-12 items-center justify-center rounded-full border border-[#0066FF]/40',
            'bg-[#0f172a]/95 text-[#0066FF] shadow-lg backdrop-blur-md',
            'hover:bg-[#0066FF]/15 transition-colors',
          )}
          aria-label="Abrir Orçamentos IA em segundo plano"
          title="Orçamentos IA"
        >
          {activeCount > 0 && (
            <span className="absolute inset-0 animate-ping rounded-full border border-[#0066FF]/35 opacity-40" />
          )}
          <BrainCircuit className="relative h-5 w-5" />
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#0066FF] px-1 text-[10px] font-bold text-white">
            {visibleJobs.length}
          </span>
        </button>
      </div>,
      document.body,
    )
  }

  const detailJob =
    (ctx.focusAnalysisId
      ? visibleJobs.find((j) => j.analysisId === ctx.focusAnalysisId)
      : null) ??
    visibleJobs.find((j) => j.id === expandedId) ??
    visibleJobs.find(isActiveJob) ??
    visibleJobs[0]

  return createPortal(
    <div
      {...floatingRootProps}
      className={cn(
        'fixed pointer-events-auto flex w-[min(420px,calc(100vw-1.5rem))] flex-col',
        FLOATING_POPUP_TOP,
        FLOATING_HORIZONTAL,
        floatingAiBackgroundClass,
        'overflow-hidden rounded-2xl border border-[#0066FF]/25',
        'bg-[#f7f4ef]/97 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.45)]',
        'backdrop-blur-xl',
        'animate-in slide-in-from-right-5 fade-in duration-300',
      )}
      style={floatingPopupMaxHeightStyle}
      role="status"
      aria-live="polite"
      aria-label="Orçamentos IA em segundo plano"
    >
      <div className="relative flex shrink-0 items-center justify-between gap-2 border-b border-slate-200/80 px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[#0066FF]/40 bg-[#0066FF]/10">
            {activeCount > 0 && (
              <span className="absolute inset-0 animate-ping rounded-full border border-[#0066FF]/40 opacity-40" />
            )}
            <BrainCircuit className="relative h-4 w-4 text-[#0066FF]" />
          </div>
          <div className="min-w-0">
            <p
              className="truncate text-sm font-semibold uppercase tracking-wide text-[#1a2332]"
              style={{ fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.06em' }}
            >
              Orçamentos IA · segundo plano
            </p>
            <p className="truncate text-[11px] text-muted-foreground">
              {activeCount > 0
                ? `${activeCount} em andamento — pode usar outras páginas`
                : 'Tarefas recentes'}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => setIsMinimized(true)}
            aria-label="Minimizar"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3 space-y-3">
        <ul className="space-y-2">
          {visibleJobs.map((job) => {
            const progress = QUOTE_STATUS_PROGRESS[job.status] ?? 0
            const active = isActiveJob(job)
            return (
              <li
                key={job.id}
                className={cn(
                  'rounded-xl border bg-white/80 p-3',
                  active ? 'border-[#0066FF]/35' : 'border-slate-200',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() =>
                      setExpandedId((id) => (id === job.id ? null : job.id))
                    }
                  >
                    <p className="truncate text-sm font-medium text-[#1a2332]">
                      {job.fileName || `Análise ${job.analysisId.slice(0, 8)}`}
                    </p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      {job.status === 'COMPLETED' && (
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                      )}
                      {job.status === 'FAILED' && (
                        <AlertCircle className="h-3.5 w-3.5 text-destructive" />
                      )}
                      {active && job.status !== 'FAILED' && (
                        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#0066FF]" />
                      )}
                      {job.needsResume
                        ? 'Pausado — clique em Retomar'
                        : QUOTE_STATUS_LABEL[job.status]}
                    </p>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 shrink-0"
                    onClick={() => ctx.dismissJob(job.id)}
                    aria-label="Dispensar"
                    disabled={job.runnerActive}
                  >
                    <X className="h-3.5 w-3.5" />
                  </Button>
                </div>

                {active && !job.needsResume && (
                  <Progress value={progress} className="mt-2 h-1" />
                )}

                {job.pipelineDetail && (
                  <p className="mt-2 line-clamp-2 text-[11px] text-[#5c6570]">
                    {job.pipelineDetail}
                  </p>
                )}

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {job.needsResume && (
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 gap-1 bg-[#0066FF] text-xs text-white hover:bg-[#0052cc]"
                      onClick={() => void ctx.resumeQuoteAnalysis(job.analysisId)}
                    >
                      <Play className="h-3 w-3" />
                      Retomar
                    </Button>
                  )}
                  {active && !job.needsResume && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 border-red-500/40 text-xs text-red-700 hover:bg-red-50"
                      title="Para a leitura agora"
                      onClick={() => {
                        if (
                          !window.confirm(
                            'Interromper a leitura? O progresso parcial fica salvo para Retomar.',
                          )
                        ) {
                          return
                        }
                        void ctx.cancelQuoteAnalysis(job.analysisId)
                      }}
                    >
                      <Square className="h-3 w-3" />
                      Interromper
                    </Button>
                  )}
                  {(job.needsResume ||
                    job.status === 'FAILED' ||
                    job.status === 'NEEDS_REVIEW') && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 gap-1 border-amber-500/40 text-xs text-amber-800 hover:bg-amber-50"
                      title="Apaga o progresso e lê o PDF de novo desde a página 1"
                      onClick={() => {
                        if (
                          !window.confirm(
                            'Recomeçar do ZERO? Apaga o progresso parcial e começa de novo.',
                          )
                        ) {
                          return
                        }
                        void ctx.restartQuoteAnalysisFromScratch(job.analysisId)
                      }}
                    >
                      <RotateCcw className="h-3 w-3" />
                      Recomeçar do zero
                    </Button>
                  )}
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 gap-1 text-xs"
                    onClick={() => ctx.openAnalysis(job.analysisId)}
                  >
                    <ExternalLink className="h-3 w-3" />
                    Abrir
                  </Button>
                </div>
              </li>
            )
          })}
        </ul>

        {detailJob && (
          <div className="rounded-xl border border-[#0066FF]/25 overflow-hidden bg-white/90">
            <div className="border-b border-slate-200/80 px-3 py-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#0066FF]">
                Passos da precificação
              </p>
              <p className="truncate text-[11px] text-slate-500">
                {detailJob.fileName || detailJob.analysisId.slice(0, 8)}
              </p>
            </div>
            <AiThoughtConsole
              status={detailJob.status}
              pipelineStage={detailJob.pipelineStage}
              pipelineDetail={detailJob.pipelineDetail}
              thoughtLog={detailJob.thoughtLog}
              analysisId={detailJob.analysisId}
              companyId={detailJob.companyId}
              projectId={
                (typeof detailJob.totalsSnapshot?.project_id === 'string'
                  ? detailJob.totalsSnapshot.project_id
                  : null) ||
                (typeof detailJob.totalsSnapshot?.projectId === 'string'
                  ? detailJob.totalsSnapshot.projectId
                  : null)
              }
              pagesProcessed={detailJob.pagesProcessed}
              totals={detailJob.totalsSnapshot}
              errorMessage={
                detailJob.runnerActive || isActiveJob(detailJob)
                  ? null
                  : detailJob.errorMessage
              }
              density="workshop"
            />
          </div>
        )}

        {visibleJobs.some((j) => j.status === 'COMPLETED' || j.status === 'FAILED') && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={() => ctx.dismissCompletedJobs()}
          >
            Limpar concluídos / falhas
          </Button>
        )}
      </div>
    </div>,
    document.body,
  )
}
