import { useMemo, useState, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { format } from 'date-fns';
import { CheckCircle2, CheckSquare, Maximize2, Search, Square, X } from 'lucide-react';
import type { AgendaEvent } from '@/hooks/useAgendaGeral';
import { matchesAgendaGeralSearch } from '@/lib/agenda-geral-search';
import { isAgendaEventPostponable } from '@/lib/agenda-postpone';
import {
  EVENT_STACK_CHIP_HEIGHT_PX,
  EVENT_STACK_MAX_HEIGHT_PX,
  getStackClusterStyle,
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
  events: AgendaEvent[];
  hourHeight: number;
  chipHeightPx?: number;
  compact?: boolean;
  floatingLayer?: boolean;
  /**
   * `box` = caixa na grade (popup flutuante).
   * `overflow-chip` = botão “+N mais” que abre o mesmo popup central.
   */
  variant?: 'box' | 'overflow-chip';
  /** Posição do chip “+N” (só em overflow-chip). */
  overflowChipStyle?: CSSProperties;
  overflowCount?: number;
  /** Controle externo do popup (evita fechar no re-render da grade). */
  expanded: boolean;
  onExpandedChange: (open: boolean) => void;
  /** Linha de cada tarefa (já com cores, clique, seleção). */
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
 * Caixa de horário lotado: lista compacta + busca + abrir no centro da tela.
 * Visual de bloco de papel da agenda (creme / tinta).
 */
export function AgendaHourClusterBox({
  clusterStart,
  events,
  hourHeight,
  chipHeightPx = EVENT_STACK_CHIP_HEIGHT_PX,
  compact = false,
  floatingLayer = false,
  variant = 'box',
  overflowChipStyle,
  overflowCount,
  expanded,
  onExpandedChange,
  renderEventRow,
  bulkActions,
}: AgendaHourClusterBoxProps) {
  const [miniQuery, setMiniQuery] = useState('');
  const [dialogQuery, setDialogQuery] = useState('');

  const timeLabel = format(clusterStart, 'HH:mm');
  const total = events.length;
  const moreCount = overflowCount ?? Math.max(0, total - 1);

  const miniFiltered = useMemo(
    () => events.filter((e) => matchesAgendaGeralSearch(e, miniQuery)),
    [events, miniQuery],
  );
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

  const chromePx = compact ? 54 : 62;
  const stackStyle = getStackClusterStyle(
    clusterStart,
    hourHeight,
    Math.max(miniFiltered.length, 1),
    chipHeightPx,
    EVENT_STACK_MAX_HEIGHT_PX,
  );
  const boxHeight = Math.min(
    chromePx + Math.max(miniFiltered.length, 1) * chipHeightPx,
    EVENT_STACK_MAX_HEIGHT_PX + chromePx,
  );

  const openExpanded = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDialogQuery(miniQuery);
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
          // Altura fixa no viewport (dvh) para a lista poder rolar de verdade.
          'flex h-[min(90dvh,720px)] max-h-[90dvh] w-[min(96vw,480px)] flex-col gap-0 overflow-hidden p-0',
          'border-[rgba(42,24,18,0.14)] bg-[#fffcf8] text-[#2a1812] shadow-2xl',
          'sm:rounded-2xl',
        )}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
      >
        <DialogHeader className="shrink-0 space-y-1 border-b border-[rgba(42,24,18,0.10)] bg-[#f7f0e6]/90 px-4 pb-3 pr-12 pt-4 text-left">
          <DialogTitle className="font-serif text-xl tracking-tight text-[#2a1812]">
            {timeLabel}
          </DialogTitle>
          <DialogDescription className="text-sm text-[#6b5344]">
            {total} {total === 1 ? 'tarefa' : 'tarefas'} neste horário — role a lista, busque ou
            marque várias de uma vez.
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

        {/* overflow-y-auto nativo: ScrollArea do Radix não encolhia no flex e travava o scroll */}
        <div
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-2 [-webkit-overflow-scrolling:touch]"
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
            <div className="flex flex-col gap-1.5 pb-2">
              {dialogFiltered.map((event, index) => (
                <div
                  key={event.id}
                  role="listitem"
                  className="animate-in fade-in slide-in-from-bottom-1 fill-mode-both duration-200"
                  style={{ animationDelay: `${Math.min(index, 12) * 20}ms` }}
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
            'absolute z-20 rounded border border-dashed border-[#c4a574]/80 bg-[#fffcf8]/95 px-1 text-left font-semibold text-[#6b3f1f] shadow-sm',
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
          'absolute z-20 flex flex-col overflow-hidden rounded-lg border shadow-md',
          'border-[rgba(42,24,18,0.14)] bg-[#fffcf8]/95 text-[#2a1812]',
          'ring-1 ring-[rgba(42,24,18,0.04)]',
        )}
        style={{
          ...stackStyle,
          height: `${boxHeight}px`,
        }}
        onClick={(e) => e.stopPropagation()}
        title={`${total} tarefas às ${timeLabel} — use a busca ou amplie`}
      >
        <div
          className={cn(
            'sticky top-0 z-[1] flex shrink-0 items-center gap-1 border-b',
            'border-[rgba(42,24,18,0.10)] bg-[#f7f0e6]/95 px-1 py-0.5 backdrop-blur-sm',
          )}
        >
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                'truncate font-semibold uppercase tracking-[0.08em] text-[#6b5344]',
                compact ? 'text-[8px]' : 'text-[9px]',
              )}
            >
              {timeLabel} · {total} {total === 1 ? 'tarefa' : 'tarefas'}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className={cn(
              'shrink-0 text-[#6b5344] hover:bg-[rgba(42,24,18,0.08)] hover:text-[#2a1812]',
              compact ? 'h-5 w-5' : 'h-6 w-6',
            )}
            onClick={openExpanded}
            title="Abrir lista no centro da tela"
            aria-label="Abrir lista de tarefas no centro da tela"
          >
            <Maximize2 className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
          </Button>
        </div>

        <div className="relative shrink-0 border-b border-[rgba(42,24,18,0.08)] px-1 py-0.5">
          <Search
            className="pointer-events-none absolute left-1.5 top-1/2 h-2.5 w-2.5 -translate-y-1/2 text-[#9a7f6a]"
            aria-hidden
          />
          <Input
            value={miniQuery}
            onChange={(e) => setMiniQuery(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
            placeholder="Buscar nesta hora…"
            className={cn(
              'h-6 border-[rgba(42,24,18,0.12)] bg-white/70 pl-5 pr-6 text-[10px] text-[#2a1812]',
              'placeholder:text-[#9a7f6a] focus-visible:ring-[#c4a574]/50',
            )}
            aria-label={`Buscar nas ${total} tarefas das ${timeLabel}`}
          />
          {miniQuery && (
            <button
              type="button"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-[#9a7f6a] hover:text-[#2a1812]"
              onClick={(e) => {
                e.stopPropagation();
                setMiniQuery('');
              }}
              aria-label="Limpar busca"
            >
              <X className="h-2.5 w-2.5" />
            </button>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-0.5 [-webkit-overflow-scrolling:touch]">
          {miniFiltered.length === 0 ? (
            <p className="px-1 py-2 text-center text-[9px] text-[#9a7f6a]">
              Nenhuma tarefa com “{miniQuery.trim()}”
            </p>
          ) : (
            <div className="flex flex-col gap-px">
              {miniFiltered.map((event) => renderEventRow(event, true))}
            </div>
          )}
        </div>
      </div>

      {dialog}
    </>
  );
}
