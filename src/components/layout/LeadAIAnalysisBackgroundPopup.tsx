import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Loader2,
  Sparkles,
  Wand2,
  X,
  ExternalLink,
  CheckCircle2,
  AlertCircle,
  Crosshair,
  Zap,
  Minus,
  Sofa,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import {
  FLOATING_HORIZONTAL,
  FLOATING_ICONS_TOP,
  FLOATING_POPUP_TOP,
  floatingPopupMaxHeightStyle,
} from '@/lib/floating-ui-layout';
import {
  floatingAiBackgroundClass,
  FLOATING_UI_ROOT_ATTR,
} from '@/lib/overlay-z-index';
import {
  useLeadAIAnalysisBackground,
  type LeadAIAnalysisBackgroundJob,
} from '@/contexts/LeadAIAnalysisBackgroundContext';
import {
  useLeadAIRenderBackground,
  type LeadAIRenderBackgroundJob,
  type LeadAIEditBackgroundJob,
  type LeadAIAmbienteBackgroundJob,
} from '@/contexts/LeadAIRenderBackgroundContext';
import { FloatingLeadAIBackgroundIcon } from './FloatingLeadAIBackgroundIcon';

interface LeadAIAnalysisBackgroundPopupProps {
  onOpenLeadAnalysis: (leadId: number) => void;
  onOpenLeadRender: (leadId: number) => void;
  /** Quando true, o ícone minimizado entra na barra de ícones flutuantes do layout. */
  isIconSlotTaken?: boolean;
  /** Incrementar para forçar expansão (ex.: clique no ícone da barra). */
  expandRequest?: number;
  onMinimizedChange?: (minimized: boolean, meta: { count: number; activeCount: number }) => void;
}

type UnifiedJob =
  | { kind: 'analysis'; job: LeadAIAnalysisBackgroundJob }
  | { kind: 'render'; job: LeadAIRenderBackgroundJob }
  | { kind: 'edit'; job: LeadAIEditBackgroundJob }
  | { kind: 'ambiente'; job: LeadAIAmbienteBackgroundJob };

function isActiveStatus(status: string): boolean {
  return status === 'preparing' || status === 'running';
}

function jobStatusLabel(status: string, kind: UnifiedJob['kind']): string {
  switch (status) {
    case 'preparing':
      if (kind === 'edit') return 'Preparando máscara…';
      if (kind === 'ambiente') return 'Preparando ambiente…';
      return kind === 'render' ? 'Preparando esboço…' : 'Preparando imagens…';
    case 'running':
      if (kind === 'edit') return 'IA retocando…';
      if (kind === 'ambiente') return 'IA criando ambiente…';
      return kind === 'render' ? 'IA renderizando…' : 'IA analisando…';
    case 'completed':
      return 'Concluída';
    case 'error':
      return 'Falhou';
    default:
      return '';
  }
}

function jobTypeLabel(kind: UnifiedJob['kind']): string {
  switch (kind) {
    case 'edit':
      return 'Edição pontual';
    case 'render':
      return 'Renderização';
    case 'ambiente':
      return 'Ambiente';
    default:
      return 'Análise visual';
  }
}

function JobIcon({ kind, className }: { kind: UnifiedJob['kind']; className?: string }) {
  if (kind === 'edit') return <Crosshair className={className} />;
  if (kind === 'render') return <Wand2 className={className} />;
  if (kind === 'ambiente') return <Sofa className={className} />;
  return <Sparkles className={className} />;
}

export function LeadAIAnalysisBackgroundPopup({
  onOpenLeadAnalysis,
  onOpenLeadRender,
  isIconSlotTaken = false,
  expandRequest = 0,
  onMinimizedChange,
}: LeadAIAnalysisBackgroundPopupProps) {
  const analysisCtx = useLeadAIAnalysisBackground();
  const renderCtx = useLeadAIRenderBackground();
  const [isMinimized, setIsMinimized] = useState(false);
  const knownJobKeysRef = useRef<Set<string>>(new Set());
  const lastExpandRequestRef = useRef(expandRequest);

  const visibleJobs: UnifiedJob[] = [
    ...analysisCtx.jobs.map((job) => ({ kind: 'analysis' as const, job })),
    ...renderCtx.jobs.map((job) => ({ kind: 'render' as const, job })),
    ...renderCtx.editJobs.map((job) => ({ kind: 'edit' as const, job })),
    ...renderCtx.ambienteJobs.map((job) => ({ kind: 'ambiente' as const, job })),
  ]
    .filter(
      ({ job }) =>
        job.status === 'preparing' ||
        job.status === 'running' ||
        job.status === 'error' ||
        job.status === 'completed',
    )
    .sort((a, b) => b.job.startedAt - a.job.startedAt);

  const visibleJobKeys = visibleJobs.map(({ kind, job }) => `${kind}-${job.id}`);
  const activeCount = visibleJobs.filter(({ job }) => isActiveStatus(job.status)).length;

  // Nova tarefa reabre o painel se estiver minimizado.
  useEffect(() => {
    const known = knownJobKeysRef.current;
    const hasNewJob = visibleJobKeys.some((key) => !known.has(key));
    knownJobKeysRef.current = new Set(visibleJobKeys);

    if (hasNewJob && visibleJobKeys.length > 0) {
      setIsMinimized(false);
    }
  }, [visibleJobKeys.join('|')]);

  // Clique no ícone da barra de ícones flutuantes.
  useEffect(() => {
    if (expandRequest === lastExpandRequestRef.current) return;
    lastExpandRequestRef.current = expandRequest;
    if (expandRequest > 0) setIsMinimized(false);
  }, [expandRequest]);

  useEffect(() => {
    onMinimizedChange?.(isMinimized, {
      count: visibleJobs.length,
      activeCount,
    });
    // Callback do layout é intencionalmente omitido para evitar loop por identidade.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMinimized, visibleJobs.length, activeCount]);

  if (visibleJobs.length === 0) return null;

  if (typeof document === 'undefined') return null;

  const handleDismiss = (entry: UnifiedJob) => {
    if (entry.kind === 'analysis') analysisCtx.dismissJob(entry.job.id);
    else if (entry.kind === 'edit') renderCtx.dismissEditJob(entry.job.id);
    else if (entry.kind === 'ambiente') renderCtx.dismissAmbienteJob(entry.job.id);
    else renderCtx.dismissJob(entry.job.id);
  };

  const handleViewResult = (entry: UnifiedJob) => {
    const { job, kind } = entry;
    if (kind === 'analysis') {
      onOpenLeadAnalysis(job.leadId);
    } else {
      onOpenLeadRender(job.leadId);
    }
    handleDismiss(entry);
  };

  const handleClearFinished = () => {
    analysisCtx.dismissCompletedJobs();
    renderCtx.dismissCompletedJobs();
    renderCtx.dismissCompletedEditJobs();
    renderCtx.dismissCompletedAmbienteJobs();
  };

  const hasFinished = visibleJobs.some(
    ({ job }) => job.status === 'completed' || job.status === 'error',
  );

  // Portal no body + z alto: fica acima do LeadModal (mesmo padrão da Agenda).
  const floatingRootProps = {
    [FLOATING_UI_ROOT_ATTR]: '' as const,
  };

  if (isMinimized) {
    // Ícone próprio só quando a barra de ícones do layout não o está exibindo.
    if (isIconSlotTaken) return null;
    return createPortal(
      <div
        {...floatingRootProps}
        className={cn(
          'fixed pointer-events-auto',
          FLOATING_ICONS_TOP,
          FLOATING_HORIZONTAL,
          floatingAiBackgroundClass,
        )}
      >
        <FloatingLeadAIBackgroundIcon
          count={visibleJobs.length}
          activeCount={activeCount}
          onClick={() => setIsMinimized(false)}
        />
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      {...floatingRootProps}
      className={cn(
        'fixed pointer-events-auto flex w-[min(380px,calc(100vw-2rem))] flex-col',
        FLOATING_POPUP_TOP,
        FLOATING_HORIZONTAL,
        floatingAiBackgroundClass,
        'overflow-hidden rounded-2xl border border-gold-border-subtle/45',
        'bg-mahogany-panel/95 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.65),0_0_0_1px_hsl(var(--gold)/0.08)]',
        'backdrop-blur-xl',
        'animate-in slide-in-from-right-5 fade-in duration-300',
      )}
      style={floatingPopupMaxHeightStyle}
      role="status"
      aria-live="polite"
      aria-label="Tarefas de IA em segundo plano"
    >
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,hsl(var(--gold)/0.12),transparent_55%)]" />

      <div className="relative flex shrink-0 items-center justify-between gap-2 border-b border-gold-border-subtle/25 px-3.5 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-gold/35 bg-gold/15">
            {activeCount > 0 && (
              <span className="absolute inset-0 animate-ping rounded-full border border-gold/40 opacity-40" />
            )}
            <Zap className="relative h-4 w-4 text-gold" />
          </div>
          <div className="min-w-0">
            <p className="truncate font-display text-sm uppercase tracking-wide text-foreground">
              IA em segundo plano
            </p>
            {activeCount > 0 ? (
              <p className="text-[10px] text-cream-muted">
                {activeCount === 1
                  ? '1 tarefa ativa — continue usando o CRM'
                  : `${activeCount} tarefas ativas — continue usando o CRM`}
              </p>
            ) : (
              <p className="text-[10px] text-cream-muted">Tarefas finalizadas aguardando revisão</p>
            )}
          </div>
        </div>
        <div className="relative flex shrink-0 items-center gap-0.5">
          {hasFinished && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-[10px] text-cream-muted hover:text-foreground"
              onClick={handleClearFinished}
            >
              Limpar
            </Button>
          )}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-cream-muted hover:text-foreground"
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(true);
            }}
            title="Minimizar painel"
            aria-label="Minimizar painel de IA em segundo plano"
          >
            <Minus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <ul className="relative min-h-0 flex-1 space-y-2 overflow-y-auto p-2.5">
        {visibleJobs.map((entry, index) => {
          const { job, kind } = entry;
          const isActive = isActiveStatus(job.status);
          const leadLabel = job.leadName?.trim() || `Lead #${job.leadId}`;

          const itemLabel =
            kind === 'edit'
              ? `${(job as LeadAIEditBackgroundJob).pontoCount} ponto(s)`
              : kind === 'render'
                ? '1 esboço'
                : kind === 'ambiente'
                  ? 'composição'
                  : `${(job as LeadAIAnalysisBackgroundJob).itemCount} arquivo(s)`;

          const editJob = kind === 'edit' ? (job as LeadAIEditBackgroundJob) : null;
          const subtitle =
            kind === 'edit' ? editJob?.imageLabel : kind === 'render' ? undefined : undefined;

          return (
            <li
              key={`${kind}-${job.id}`}
              className={cn(
                'relative overflow-hidden rounded-xl border px-3 py-2.5 transition-colors',
                'animate-in fade-in slide-in-from-bottom-2',
                isActive && 'border-gold/40 bg-gold/[0.07]',
                job.status === 'completed' && 'border-emerald-500/35 bg-emerald-500/[0.06]',
                job.status === 'error' && 'border-destructive/35 bg-destructive/[0.06]',
              )}
              style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
            >
              {isActive && (
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-gold/60 to-transparent" />
              )}

              {!isActive && (
                <button
                  type="button"
                  className="absolute right-2 top-2 z-10 rounded-full p-1 text-muted-foreground hover:bg-muted/60"
                  onClick={() => handleDismiss(entry)}
                  aria-label="Fechar aviso"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}

              <div className="flex items-start gap-2.5 pr-6">
                <div className="relative mt-0.5 shrink-0">
                  {isActive ? (
                    <Loader2 className="h-4 w-4 animate-spin text-gold" />
                  ) : job.status === 'completed' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : (
                    <AlertCircle className="h-4 w-4 text-destructive" />
                  )}
                </div>

                <div className="min-w-0 flex-1 space-y-2">
                  <div className="flex items-start gap-2">
                    {editJob?.thumbnailUrl ? (
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-lg border border-gold-border-subtle/30 bg-mahogany-base">
                        <img
                          src={editJob.thumbnailUrl}
                          alt=""
                          className="h-full w-full object-cover"
                        />
                        {isActive && (
                          <div className="absolute inset-0 bg-gold/10 ring-1 ring-inset ring-gold/30" />
                        )}
                      </div>
                    ) : null}

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <JobIcon kind={kind} className="h-3.5 w-3.5 shrink-0 text-gold" />
                        <p className="truncate text-sm font-medium">{leadLabel}</p>
                      </div>
                      {subtitle && (
                        <p className="mt-0.5 truncate text-[10px] text-cream-muted">{subtitle}</p>
                      )}
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className="h-5 border-gold-border-subtle/20 bg-mahogany-elevated/80 px-1.5 text-[10px]"
                        >
                          {jobTypeLabel(kind)}
                        </Badge>
                        <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                          {itemLabel}
                        </Badge>
                        <span className="text-[10px] text-cream-faint">
                          {jobStatusLabel(job.status, kind)}
                        </span>
                      </div>
                    </div>
                  </div>

                  {job.status === 'error' && job.errorMessage && (
                    <p className="text-xs leading-relaxed text-destructive">{job.errorMessage}</p>
                  )}

                  {job.status === 'completed' && (
                    <Button
                      type="button"
                      size="sm"
                      className="h-7 w-full gap-1.5 bg-gold/90 text-[11px] text-mahogany-base hover:bg-gold"
                      onClick={() => handleViewResult(entry)}
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      {kind === 'analysis' ? 'Ver análise' : 'Ver resultado'}
                    </Button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>,
    document.body,
  );
}
