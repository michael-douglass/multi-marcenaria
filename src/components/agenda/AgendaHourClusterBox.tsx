import { useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, CheckSquare, Maximize2, Search, Square, X } from 'lucide-react';
import type { AgendaEvent } from '@/hooks/useAgendaGeral';
import { matchesAgendaGeralSearch } from '@/lib/agenda-geral-search';
import { isAgendaEventPostponable } from '@/lib/agenda-postpone';
import {
  EVENT_STACK_CHIP_HEIGHT_PX,
  EVENT_STACK_PEEK_CHIP_HEIGHT_PX,
  EVENT_STACK_PEEK_CHROME_COMPACT_PX,
  EVENT_STACK_PEEK_CHROME_PX,
  EVENT_STACK_PEEK_LIST_PAD_PX,
  EVENT_STACK_PEEK_ROW_GAP_PX,
  getEventColumnStyle,
  getStackPeekNaturalHeightPx,
} from '@/lib/calendar-event-layout';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';

interface AgendaHourClusterBoxProps {
  clusterStart: Date;
  /** Fim do intervalo do grupo na grade — limita a altura para não cobrir outros horários. */
  clusterEnd: Date;
  events: AgendaEvent[];
  hourHeight: number;
  /** Altura mínima de um evento na grade (mesma regra dos chips soltos). */
  minTimeSpanPx?: number;
  chipHeightPx?: number;
  compact?: boolean;
  floatingLayer?: boolean;
  /**
   * `box` = caixa na grade (preview + popup).
   * `overflow-chip` = botão “+N mais” que abre o mesmo popup central.
   */
  variant?: 'box' | 'overflow-chip';
  /** Posição do chip “+N” (só em overflow-chip). */
  overflowChipStyle?: CSSProperties;
  overflowCount?: number;
  /** Controle externo do popup (evita fechar no re-render da grade). */
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  /**
   * Topo na grade já resolvido pelo FullCalendar (empurra tarefas soltas
   * para antes/depois da lista). Se omitido, usa o horário do cluster.
   */
  layoutTopPx?: number;
  /**
   * Linha de cada tarefa.
   * `dense` = preview fechado (bem compacto); sem dense = cartão do popup.
   */
  renderEventRow: (event: AgendaEvent, dense?: boolean) => ReactNode;
  /** Ações em lote (selecionar / concluir várias). */
  bulkActions?: {
    enabled: boolean;
    selectionMode: boolean;
    selectedIds: Set<string>;
    isBusy?: boolean;
    onEnterSelectionMode: () => void;
    onExitSelectionMode: () => void;
    onSelectEvents: (events: AgendaEvent[]) => void;
    onClearSelection: () => void;
    onCompleteSelected?: () => void | Promise<unknown>;
  };
}

/**
 * Caixa de horário lotado:
 * - fechada → preview com todas as tarefas, cabendo só na faixa daquela hora
 *   (não encavalando o horário seguinte);
 * - aberta → popup central com busca e cartões mais legíveis.
 * Visual de bloco de papel da agenda (creme / tinta).
 */
export function AgendaHourClusterBox({
  clusterStart,
  clusterEnd,
  events,
  hourHeight,
  minTimeSpanPx = EVENT_STACK_CHIP_HEIGHT_PX,
  chipHeightPx = EVENT_STACK_PEEK_CHIP_HEIGHT_PX,
  compact = false,
  floatingLayer = false,
  variant = 'box',
  overflowChipStyle,
  overflowCount,
  expanded,
  onExpandedChange,
  layoutTopPx,
  renderEventRow,
  bulkActions,
}: AgendaHourClusterBoxProps) {
  const [dialogQuery, setDialogQuery] = useState('');

  const timeLabel = format(clusterStart, 'HH:mm');
  const total = events.length;
  const moreCount = overflowCount ?? Math.max(0, total - 1);

  const dialogFiltered = useMemo(
    () => events.filter((e) => matchesAgendaGeralSearch(e, dialogQuery)),
    [events, dialogQuery],
  );

  const eligibleInView = useMemo(
    () => dialogFiltered.filter(isAgendaEventPostponable),
    [dialogFiltered],
  );
  const selectedInViewCount = useMemo(
    () => eligibleInView.filter((e) => bulkActions?.selectedIds.has(e.id)).length,
    [eligibleInView, bulkActions?.selectedIds],
  );
  const allEligibleInViewSelected =
    eligibleInView.length > 0 && selectedInViewCount === eligibleInView.length;

  /** Só o cabeçalho na caixa fechada — a busca fica no popup. */
  const chromePx = compact ? EVENT_STACK_PEEK_CHROME_COMPACT_PX : EVENT_STACK_PEEK_CHROME_PX;
  const startHour = clusterStart.getHours() + clusterStart.getMinutes() / 60;
  const rawTop = startHour * hourHeight;
  const boxHeight = getStackPeekNaturalHeightPx(total, chipHeightPx, compact);
  const naturalListPx =
    chromePx +
    EVENT_STACK_PEEK_LIST_PAD_PX +
    Math.max(total, 1) * chipHeightPx +
    Math.max(total - 1, 0) * EVENT_STACK_PEEK_ROW_GAP_PX;
  const needsScroll = naturalListPx > boxHeight + 0.5;
  const columnStyle = getEventColumnStyle(0, 1);
  const stackStyle = {
    top: `${layoutTopPx ?? rawTop}px`,
    height: `${boxHeight}px`,
    left: columnStyle.left,
    width: columnStyle.width,
  };

  const openExpanded = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDialogQuery('');
    // Adia a abertura: o mesmo clique não pode ser lido como “fora” e fechar o dialog.
    window.setTimeout(() => onExpandedChange(true), 0);
  };

  const handleToggleSelectAllInHour = () => {
    if (!bulkActions?.enabled) return;
    if (!bulkActions.selectionMode) {
      bulkActions.onEnterSelectionMode();
    }
    if (allEligibleInViewSelected) {
      bulkActions.onClearSelection();
      return;
    }
    bulkActions.onSelectEvents(eligibleInView);
  };

  const handleStartSelecting = () => {
    bulkActions?.onEnterSelectionMode();
  };

  const dialog = (
    <Dialog
      open={expanded}
      onOpenChange={(open) => {
        onExpandedChange(open);
        if (!open) setDialogQuery('');
      }}
    >
      <DialogContent
        floatingLayer={floatingLayer}
        className={cn(
          'flex h-[min(92dvh,760px)] max-h-[92dvh] w-[min(96vw,560px)] flex-col gap-0 overflow-hidden p-0',
          'border-[rgba(42,24,18,0.14)] bg-[#fffcf8] text-[#2a1812] shadow-2xl',
          'sm:rounded-2xl',
        )}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DialogHeader className="relative shrink-0 space-y-2 overflow-hidden border-b border-[rgba(42,24,18,0.10)] bg-[#f7f0e6]/95 px-5 pb-4 pr-12 pt-5 text-left">
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.35]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg, transparent, transparent 27px, rgba(42,24,18,0.04) 27px, rgba(42,24,18,0.04) 28px)',
            }}
            aria-hidden
          />
          <div className="relative flex items-end gap-3">
            <DialogTitle className="font-display text-4xl leading-none tracking-[0.04em] text-[#2a1812]">
              {timeLabel}
            </DialogTitle>
            <span
              className={cn(
                'mb-0.5 inline-flex items-center rounded-md border border-[rgba(42,24,18,0.12)]',
                'bg-white/70 px-2 py-0.5 font-display text-[11px] tracking-[0.14em] text-[#8d5e22]',
              )}
            >
              {total} {total === 1 ? 'TAREFA' : 'TAREFAS'}
            </span>
          </div>
          <DialogDescription className="relative text-sm leading-relaxed text-[#6b5344]">
            Lista completa deste horário — busque, role ou marque várias de uma vez.
          </DialogDescription>
        </DialogHeader>

        <div className="relative shrink-0 border-b border-[rgba(42,24,18,0.08)] px-4 py-3">
          <Search
            className="pointer-events-none absolute left-6 top-1/2 h-4 w-4 -translate-y-1/2 text-[#9a7f6a]"
            aria-hidden
          />
          <Input
            autoFocus
            value={dialogQuery}
            onChange={(e) => setDialogQuery(e.target.value)}
            placeholder="Buscar por nome, lead, detalhes…"
            className={cn(
              'h-10 border-[rgba(42,24,18,0.14)] bg-white/80 pl-10 pr-10 text-[#2a1812]',
              'placeholder:text-[#9a7f6a] focus-visible:ring-[#c4a574]/55',
            )}
            aria-label="Buscar tarefas deste horário"
          />
          {dialogQuery && (
            <button
              type="button"
              className="absolute right-6 top-1/2 -translate-y-1/2 rounded-md p-1 text-[#9a7f6a] hover:bg-[rgba(42,24,18,0.06)] hover:text-[#2a1812]"
              onClick={() => setDialogQuery('')}
              aria-label="Limpar busca"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          <p className="mt-2 text-[11px] text-[#9a7f6a]">
            {dialogFiltered.length === total
              ? `Mostrando todas as ${total}`
              : `${dialogFiltered.length} de ${total} tarefas`}
          </p>
        </div>

        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3 [-webkit-overflow-scrolling:touch]"
          role="list"
          aria-label={`Tarefas das ${timeLabel}`}
        >
          {dialogFiltered.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-2 px-4 py-12 text-center">
              <Search className="h-8 w-8 text-[#c4a574]/70" aria-hidden />
              <p className="text-sm font-medium text-[#6b5344]">Nada encontrado</p>
              <p className="max-w-[240px] text-xs text-[#9a7f6a]">
                Tente outro termo ou limpe a busca para ver as {total} tarefas de novo.
              </p>
            </div>
          ) : (
            <div className="flex flex-col gap-2 pb-2">
              {dialogFiltered.map((event, index) => (
                <div
                  key={event.id}
                  role="listitem"
                  className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-200"
                  style={{ animationDelay: `${Math.min(index, 12) * 24}ms` }}
                >
                  {renderEventRow(event, false)}
                </div>
              ))}
            </div>
          )}
        </div>

        {bulkActions?.enabled && (
          <div
            className={cn(
              'shrink-0 border-t border-[rgba(42,24,18,0.10)] bg-[#f7f0e6]/95 px-3 py-2.5',
              'flex flex-wrap items-center gap-2',
            )}
          >
            {!bulkActions.selectionMode ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 border-[rgba(42,24,18,0.16)] bg-white/80 text-[#2a1812] hover:bg-white"
                onClick={handleStartSelecting}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                Selecionar várias
              </Button>
            ) : (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-9 gap-1.5 border-[rgba(42,24,18,0.16)] bg-white/80 text-[#2a1812] hover:bg-white"
                  onClick={handleToggleSelectAllInHour}
                  disabled={eligibleInView.length === 0 || bulkActions.isBusy}
                >
                  {allEligibleInViewSelected ? (
                    <>
                      <Square className="h-3.5 w-3.5" />
                      Desmarcar todas
                    </>
                  ) : (
                    <>
                      <CheckSquare className="h-3.5 w-3.5" />
                      Marcar todas
                      {eligibleInView.length > 0 ? ` (${eligibleInView.length})` : ''}
                    </>
                  )}
                </Button>
                {bulkActions.onCompleteSelected && (
                  <Button
                    type="button"
                    size="sm"
                    className="h-9 gap-1.5 bg-[#2a1812] text-[#fffcf8] hover:bg-[#3d281c]"
                    disabled={selectedInViewCount === 0 || bulkActions.isBusy}
                    onClick={() => void bulkActions.onCompleteSelected?.()}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Concluir {selectedInViewCount > 0 ? selectedInViewCount : ''}
                  </Button>
                )}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-9 text-[#6b5344] hover:bg-[rgba(42,24,18,0.06)] hover:text-[#2a1812]"
                  onClick={bulkActions.onExitSelectionMode}
                  disabled={bulkActions.isBusy}
                >
                  Cancelar
                </Button>
                <span className="ml-auto text-[11px] text-[#9a7f6a]">
                  {selectedInViewCount} selecionada{selectedInViewCount === 1 ? '' : 's'}
                  {eligibleInView.length > 0 && ` · ${eligibleInView.length} nesta hora`}
                </span>
              </>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );

  if (variant === 'overflow-chip') {
    return (
      <>
        <button
          type="button"
          data-agenda-event
          className={cn(
            'absolute z-[8] rounded border border-dashed border-[#c4a574]/80 bg-[#fffcf8]/95 px-1 text-left font-semibold text-[#6b3f1f] shadow-sm',
            'hover:bg-[#f7f0e6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c4a574]/55',
            compact ? 'text-[8px] leading-tight' : 'text-[10px]',
          )}
          style={overflowChipStyle}
          onClick={openExpanded}
          title={`Ver todas as ${total} tarefas deste horário`}
        >
          +{moreCount} mais
        </button>
        {dialog}
      </>
    );
  }

  return (
    <>
      <div
        data-agenda-event
        className={cn(
          'absolute z-[8] flex flex-col overflow-hidden rounded-lg border shadow-md',
          'border-[rgba(42,24,18,0.14)] bg-[#fffcf8]/95 text-[#2a1812]',
          'ring-1 ring-[rgba(42,24,18,0.04)]',
        )}
        style={stackStyle}
        onClick={(e) => e.stopPropagation()}
        title={`${total} tarefas às ${timeLabel} — role a lista ou amplie para ler melhor`}
      >
        <div
          className={cn(
            'flex h-7 shrink-0 items-center gap-1 border-b',
            'border-[rgba(42,24,18,0.10)] bg-[#f7f0e6]/95 px-1.5 backdrop-blur-sm',
          )}
        >
          <button
            type="button"
            className="min-w-0 flex-1 rounded-sm px-0.5 text-left hover:bg-[rgba(42,24,18,0.04)] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-[#c4a574]/55"
            onClick={openExpanded}
            title="Abrir lista completa"
          >
            <p
              className={cn(
                'truncate font-semibold uppercase tracking-[0.08em] text-[#6b5344]',
                compact ? 'text-[9px]' : 'text-[10px]',
              )}
            >
              {timeLabel} · {total} {total === 1 ? 'tarefa' : 'tarefas'}
            </p>
          </button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-[#6b5344] hover:bg-[rgba(42,24,18,0.08)] hover:text-[#2a1812]"
            onClick={openExpanded}
            title="Abrir lista no centro da tela"
            aria-label="Abrir lista de tarefas no centro da tela"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </Button>
        </div>

        {/* Preview: todas as tarefas com altura legível; scroll só se passar do teto */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1 [-webkit-overflow-scrolling:touch]"
          role="list"
          aria-label={`Preview das ${total} tarefas das ${timeLabel}`}
        >
          <div
            className={cn(
              'flex flex-col gap-0.5',
              '[&_button[data-agenda-event]]:flex [&_button[data-agenda-event]]:h-full',
              '[&_button[data-agenda-event]]:items-center',
              '[&_button[data-agenda-event]]:rounded-md [&_button[data-agenda-event]]:border-l-[3px]',
              '[&_button[data-agenda-event]]:px-1.5 [&_button[data-agenda-event]]:py-0',
              '[&_button[data-agenda-event]]:text-[11px] [&_button[data-agenda-event]]:leading-snug',
              '[&_button[data-agenda-event]]:shadow-none',
            )}
          >
            {events.map((event) => (
              <div
                key={event.id}
                role="listitem"
                className="min-w-0 shrink-0 overflow-hidden"
                style={{ height: `${chipHeightPx}px` }}
              >
                {renderEventRow(event, true)}
              </div>
            ))}
          </div>
          {needsScroll ? (
            <p className="sticky bottom-0 mt-0.5 bg-gradient-to-t from-[#fffcf8] via-[#fffcf8]/95 to-transparent pt-2 text-center text-[9px] font-medium text-[#8d5e22]">
              Role para ver todas · {total}
            </p>
          ) : null}
        </div>
      </div>

      {dialog}
    </>
  );
}
