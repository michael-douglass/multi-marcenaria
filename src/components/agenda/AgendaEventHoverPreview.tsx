import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import * as HoverCardPrimitive from '@radix-ui/react-hover-card';
import { Check, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { FLOATING_AGENDA_ROOT_ATTR } from '@/lib/overlay-z-index';
import { isAgendaEventPostponable } from '@/lib/agenda-postpone';
import { AgendaEventPostponeControls } from '@/components/agenda/AgendaEventPostponeControls';
import type { AgendaEvent } from '@/hooks/useAgendaGeral';
import type { LeadLembrete } from '@/hooks/useLeadLembretes';
import type { MarketingTask } from '@/hooks/useMarketingTasks';
import type { PessoalAgendaEventData } from '@/components/agenda/TarefaPessoalOcorrenciaDialog';

const EVENT_TYPE_LABELS: Record<AgendaEvent['type'], string> = {
  tarefa: 'Reunião',
  lembrete: 'Lembrete',
  pessoal: 'Pessoal',
  conteudo: 'Marketing',
};

const EVENT_TYPE_DOT: Record<AgendaEvent['type'], string> = {
  tarefa: 'bg-blue-500',
  lembrete: 'bg-amber-500',
  pessoal: 'bg-emerald-500',
  conteudo: 'bg-purple-500',
};

function getEventSubtitle(event: AgendaEvent): string | undefined {
  switch (event.type) {
    case 'lembrete':
      return (event.originalData as LeadLembrete).lead?.nome || undefined;
    case 'pessoal':
      return (event.originalData as PessoalAgendaEventData).titular_nome || undefined;
    case 'conteudo':
      return (event.originalData as MarketingTask).tipo || undefined;
    default:
      return undefined;
  }
}

interface AgendaEventHoverPreviewProps {
  event: AgendaEvent;
  /** Painel flutuante estreito → vidro + delays curtos */
  compact?: boolean;
  /** Ex.: durante arraste — não mostra prévia */
  disabled?: boolean;
  onComplete?: (event: AgendaEvent) => void;
  onDelete?: (event: AgendaEvent) => void;
  /** Toque no título do balão abre a edição. */
  onEditEvent?: (event: AgendaEvent) => void;
  /** Confirma o rascunho de adiar (mesmo caminho do arraste). */
  onPostpone?: (event: AgendaEvent, newStart: Date, newEnd: Date) => void;
  isRescheduling?: boolean;
  children: ReactElement;
}

/**
 * Prévia em hover estilo “vidro” sobre chips da agenda.
 * No painel flutuante, o popup fica confinado e redimensiona para caber no container.
 * Primeiro toque no chip prende o balão; toque no título edita; setas só adianta.
 */
export function AgendaEventHoverPreview({
  event,
  compact = false,
  disabled = false,
  onComplete,
  onDelete,
  onEditEvent,
  onPostpone,
  isRescheduling = false,
  children,
}: AgendaEventHoverPreviewProps) {
  const [open, setOpen] = useState(false);
  const [pinned, setPinned] = useState(false);
  const [draftStart, setDraftStart] = useState(event.start);
  const triggerWrapRef = useRef<HTMLSpanElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [portalContainer, setPortalContainer] = useState<HTMLElement | null>(null);
  const [collisionBoundary, setCollisionBoundary] = useState<Element | null>(null);

  const resolvePanelRoot = useCallback((): HTMLElement | null => {
    const fromTrigger = triggerWrapRef.current?.closest<HTMLElement>(
      `[${FLOATING_AGENDA_ROOT_ATTR}]`,
    );
    if (fromTrigger) return fromTrigger;
    if (typeof document === 'undefined') return null;
    return document.querySelector<HTMLElement>(`[${FLOATING_AGENDA_ROOT_ATTR}]`);
  }, []);

  useEffect(() => {
    if (!compact) {
      setPortalContainer(null);
      setCollisionBoundary(null);
      return;
    }
    const sync = () => {
      const root = resolvePanelRoot();
      setPortalContainer(root);
      setCollisionBoundary(root);
    };
    sync();
    const id = window.requestAnimationFrame(sync);
    return () => window.cancelAnimationFrame(id);
  }, [compact, open, resolvePanelRoot]);

  useEffect(() => {
    if (open) setDraftStart(event.start);
  }, [open, event.start]);

  const unpin = useCallback(() => {
    setPinned(false);
    setOpen(false);
  }, []);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (disabled) {
        setOpen(false);
        setPinned(false);
        return;
      }
      if (pinned && !next) return;
      setOpen(next);
      if (!next) setPinned(false);
    },
    [disabled, pinned],
  );

  useEffect(() => {
    if (disabled) {
      setOpen(false);
      setPinned(false);
    }
  }, [disabled]);

  useEffect(() => {
    if (!pinned) return;

    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      if (contentRef.current?.contains(target)) return;
      if (triggerWrapRef.current?.contains(target)) return;
      unpin();
    };

    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [pinned, unpin]);

  if (disabled) {
    return children;
  }

  const isDone = event.status === 'concluido';
  const subtitle = getEventSubtitle(event);
  const previewText = event.description?.trim() || null;
  const canPostpone = Boolean(onPostpone) && isAgendaEventPostponable(event);

  const metaParts = [
    format(event.start, 'HH:mm'),
    subtitle,
    EVENT_TYPE_LABELS[event.type],
    isDone ? 'concluída' : null,
  ].filter(Boolean);

  const showActions = Boolean(onComplete || onDelete);

  const handlePinFromChip = () => {
    setPinned(true);
    setOpen(true);
  };

  const handleEditFromTitle = () => {
    if (!onEditEvent) return;
    unpin();
    onEditEvent(event);
  };

  return (
    <HoverCardPrimitive.Root
      open={open}
      onOpenChange={handleOpenChange}
      openDelay={compact ? 180 : 280}
      closeDelay={compact ? 320 : 400}
    >
      <span ref={triggerWrapRef} className="contents">
        <HoverCardPrimitive.Trigger asChild onClick={handlePinFromChip}>
          {children}
        </HoverCardPrimitive.Trigger>
      </span>

      <HoverCardPrimitive.Portal container={compact ? portalContainer ?? undefined : undefined}>
        <HoverCardPrimitive.Content
          ref={contentRef}
          side={compact ? 'top' : 'left'}
          sideOffset={compact ? 4 : 8}
          align="start"
          avoidCollisions
          sticky="partial"
          collisionPadding={compact ? 8 : 16}
          collisionBoundary={compact ? collisionBoundary ?? undefined : undefined}
          data-floating-agenda-root={compact ? '' : undefined}
          className={cn(
            'flex flex-col outline-none select-none pointer-events-auto',
            'data-[state=open]:animate-in data-[state=closed]:animate-out',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
            'data-[side=bottom]:slide-in-from-top-2 data-[side=top]:slide-in-from-bottom-2',
            'data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2',
            compact
              ? cn(
                  'z-[205] rounded-lg border border-border/30 bg-background/30 p-2',
                  'text-foreground/85 shadow-sm',
                  'backdrop-blur-xl backdrop-saturate-150',
                  'w-[min(11.5rem,var(--radix-hover-card-content-available-width,11.5rem))]',
                  'max-w-[min(11.5rem,var(--radix-hover-card-content-available-width,11.5rem))]',
                  'max-h-[min(20rem,var(--radix-hover-card-content-available-height,20rem))]',
                )
              : cn(
                  'z-50 rounded-lg border border-border/50 bg-popover/90 p-3',
                  'text-popover-foreground shadow-md backdrop-blur-md',
                  'w-[min(16rem,var(--radix-hover-card-content-available-width,16rem))]',
                  'max-w-[min(16rem,var(--radix-hover-card-content-available-width,16rem))]',
                  'max-h-[min(22rem,var(--radix-hover-card-content-available-height,22rem))]',
                ),
          )}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          <div
            className={cn(
              'min-h-0 flex-1 space-y-1.5 overflow-y-auto overscroll-contain',
              '[scrollbar-width:thin]',
              compact ? 'pr-0.5' : 'pr-1',
            )}
          >
            <div className="flex items-start gap-1.5">
              <span
                className={cn(
                  'mt-1 h-2 w-2 shrink-0 rounded-full',
                  EVENT_TYPE_DOT[event.type],
                )}
                aria-hidden
              />
              {onEditEvent ? (
                <button
                  type="button"
                  className={cn(
                    'min-w-0 text-left font-semibold leading-snug break-words',
                    'rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                    compact ? 'text-[11px]' : 'text-sm',
                    isDone && 'line-through opacity-70',
                  )}
                  onClick={handleEditFromTitle}
                >
                  {event.title}
                </button>
              ) : (
                <p
                  className={cn(
                    'min-w-0 font-semibold leading-snug break-words',
                    compact ? 'text-[11px]' : 'text-sm',
                    isDone && 'line-through opacity-70',
                  )}
                >
                  {event.title}
                </p>
              )}
            </div>

            <p
              className={cn(
                'text-muted-foreground leading-snug break-words',
                compact ? 'text-[10px]' : 'text-xs',
              )}
            >
              {metaParts.join(' · ')}
            </p>

            {canPostpone && (
              <AgendaEventPostponeControls
                event={event}
                draftStart={draftStart}
                onDraftStartChange={setDraftStart}
                compact={compact}
                isSaving={isRescheduling}
                onConfirm={(newStart, newEnd) => {
                  unpin();
                  onPostpone?.(event, newStart, newEnd);
                }}
              />
            )}

            {previewText ? (
              <p
                className={cn(
                  'whitespace-pre-wrap break-words text-muted-foreground/90 leading-snug',
                  compact ? 'text-[10px]' : 'text-xs',
                )}
              >
                {previewText}
              </p>
            ) : (
              !compact && (
                <p className="text-xs text-muted-foreground/70 italic">Sem descrição adicional.</p>
              )
            )}

            {onEditEvent && (
              <p className={cn('pt-0.5 text-muted-foreground/60', compact ? 'text-[9px]' : 'text-[10px]')}>
                {compact ? 'Toque no título para editar' : 'Toque no título para editar · Arraste para reagendar'}
              </p>
            )}
          </div>

          {showActions && (
            <div
              className={cn(
                'shrink-0 flex gap-1.5 border-t border-border/30 bg-inherit',
                compact ? 'mt-1.5 pt-1.5' : 'mt-2.5 pt-2.5',
              )}
            >
              {onComplete && (
                <Button
                  type="button"
                  size="sm"
                  variant={isDone ? 'secondary' : 'default'}
                  disabled={isDone}
                  className={cn(
                    'h-7 min-w-0 flex-1 gap-1 px-1.5',
                    compact ? 'text-[10px]' : 'text-xs',
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    unpin();
                    onComplete(event);
                  }}
                >
                  <Check className={cn('shrink-0', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
                  <span className="truncate">{isDone ? 'Concluída' : 'Concluir'}</span>
                </Button>
              )}
              {onDelete && (
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  className={cn(
                    'h-7 min-w-0 flex-1 gap-1 px-1.5',
                    compact ? 'text-[10px]' : 'text-xs',
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    unpin();
                    onDelete(event);
                  }}
                >
                  <Trash2 className={cn('shrink-0', compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
                  <span className="truncate">Excluir</span>
                </Button>
              )}
            </div>
          )}
        </HoverCardPrimitive.Content>
      </HoverCardPrimitive.Portal>
    </HoverCardPrimitive.Root>
  );
}
