import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { 
  format, 
  addMonths, 
  subMonths, 
  startOfMonth, 
  endOfMonth, 
  eachDayOfInterval, 
  startOfWeek, 
  endOfWeek, 
  isSameDay, 
  isToday, 
  addWeeks, 
  subWeeks, 
  addDays, 
  subDays,
  startOfDay,
  endOfDay,
  getHours,
  setHours,
  setMinutes,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  LayoutGrid,
  List,
  Columns,
  Clock,
  CheckSquare,
  CalendarRange,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import {
  EVENT_COMPACT_STACK_THRESHOLD,
  EVENT_COMPACT_STACK_WINDOW_MS,
  EVENT_MAX_SIDE_BY_SIDE_COLUMNS,
  EVENT_STACK_PEEK_CHIP_HEIGHT_PX,
  buildExpandedHourHeights,
  clampTopWithinDay,
  getDayGridHeightPx,
  getDayHeightFromHourHeights,
  getEventColumnStyle,
  getTopPxForDate,
  layoutTimedClusters,
  partitionTimedUntimedEvents,
  type TimedClusterLayout,
} from '@/lib/calendar-event-layout';
import type { AgendaEvent, BulkRescheduleOptions } from '@/hooks/useAgendaGeral';
import { floatingAgendaZoomToScale } from '@/lib/floating-agenda-zoom-preferences';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getDateTimeFromGridDrop } from '@/lib/agenda-calendar-drag';
import { useAgendaTimedEventDrag } from '@/hooks/useAgendaTimedEventDrag';
import { AgendaEventHoverPreview } from '@/components/agenda/AgendaEventHoverPreview';
import { AgendaBulkMoveDialog } from '@/components/agenda/AgendaBulkMoveDialog';
import { AgendaHourClusterBox } from '@/components/agenda/AgendaHourClusterBox';
import { getAgendaEventChipStyle } from '@/lib/agenda-event-colors';
import { isAgendaEventPostponable } from '@/lib/agenda-postpone';
import type { LeadLembrete } from '@/hooks/useLeadLembretes';
import type { MarketingTask } from '@/hooks/useMarketingTasks';
import type { PessoalAgendaEventData } from '@/components/agenda/TarefaPessoalOcorrenciaDialog';

const CLUSTER_EVENT_TYPE_LABELS: Record<AgendaEvent['type'], string> = {
  tarefa: 'Reunião',
  lembrete: 'Lembrete',
  pessoal: 'Pessoal',
  conteudo: 'Marketing',
};

function getClusterEventSubtitle(event: AgendaEvent): string | undefined {
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

interface FullCalendarProps {
  events: AgendaEvent[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onEditEvent?: (event: AgendaEvent) => void;
  onCompleteEvent?: (event: AgendaEvent) => void;
  onDeleteEvent?: (event: AgendaEvent) => void;
  onEventDrop?: (event: AgendaEvent, newStart: Date, newEnd: Date) => void;
  /** Mover várias tarefas selecionadas para outra data. */
  onBulkReschedule?: (
    events: AgendaEvent[],
    targetDate: Date,
    options: BulkRescheduleOptions,
  ) => Promise<unknown> | unknown;
  /** Concluir várias tarefas selecionadas. */
  onBulkComplete?: (events: AgendaEvent[]) => Promise<unknown> | unknown;
  isRescheduling?: boolean;
  /** Ao selecionar um resultado da busca, o calendário navega para este dia. */
  focusDate?: Date | null;
  onFocusDateApplied?: () => void;
  /** Layout reduzido para painel lateral flutuante */
  compact?: boolean;
  /** Zoom do painel flutuante (80–200%) — escala layout compacto sem CSS zoom */
  zoomPercent?: number;
  /** Clique em faixa horária vazia — ex.: criar tarefa no horário clicado. */
  onTimeSlotClick?: (dateTime: Date) => void;
  /** Diálogo acima do painel flutuante da agenda. */
  floatingLayer?: boolean;
}

type CalendarView = 'dia' | 'semana' | 'mes';

interface CalendarLayout {
  hourHeightWeek: number;
  hourHeightDay: number;
  untimedStripMaxHeight: number;
  timeColWeek: number;
  timeColDay: number;
  monthCellMinH: number;
  dayEventMinHeight: number;
  weekEventMinHeight: number;
  fixedViewHeight: number | null;
}

function getCalendarLayout(compact: boolean): CalendarLayout {
  if (!compact) {
    return {
      hourHeightWeek: 80,
      hourHeightDay: 96,
      untimedStripMaxHeight: 120,
      timeColWeek: 80,
      timeColDay: 100,
      monthCellMinH: 120,
      dayEventMinHeight: 40,
      weekEventMinHeight: 22,
      fixedViewHeight: 700,
    };
  }

  /**
   * Painel flutuante: horas altas o bastante para o preview listar
   * várias tarefas na faixa, sem a caixa invadir o horário seguinte.
   */
  return {
    hourHeightWeek: 48,
    hourHeightDay: 104,
    untimedStripMaxHeight: 64,
    timeColWeek: 34,
    timeColDay: 40,
    monthCellMinH: 54,
    dayEventMinHeight: 26,
    weekEventMinHeight: 18,
    fixedViewHeight: null,
  };
}

function scaleCalendarLayout(layout: CalendarLayout, scale: number): CalendarLayout {
  if (scale === 1) return layout;
  const m = (value: number) => Math.round(value * scale);
  return {
    hourHeightWeek: m(layout.hourHeightWeek),
    hourHeightDay: m(layout.hourHeightDay),
    untimedStripMaxHeight: m(layout.untimedStripMaxHeight),
    timeColWeek: m(layout.timeColWeek),
    timeColDay: m(layout.timeColDay),
    monthCellMinH: m(layout.monthCellMinH),
    dayEventMinHeight: m(layout.dayEventMinHeight),
    weekEventMinHeight: m(layout.weekEventMinHeight),
    fixedViewHeight: layout.fixedViewHeight ? m(layout.fixedViewHeight) : null,
  };
}

function getEventTypeClasses(event: AgendaEvent, compact = false) {
  return cn(
    compact ? 'text-[10px] px-1.5 py-0.5' : 'text-[10px] p-1',
    'rounded border shadow-sm cursor-pointer transition-all hover:z-30 hover:brightness-95 overflow-hidden',
    event.status === 'concluido' && 'opacity-60 line-through',
  );
}

function getEventChipStyle(event: AgendaEvent) {
  return getAgendaEventChipStyle(event);
}

function getTimedEventMetrics(
  event: AgendaEvent,
  hourHeight: number,
  minHeight: number,
  maxSpanHours?: number,
  hourHeights?: number[],
) {
  const durationHours = (event.end.getTime() - event.start.getTime()) / (1000 * 60 * 60);
  const visibleHours =
    maxSpanHours != null ? Math.min(durationHours, maxSpanHours) : durationHours;

  if (hourHeights && hourHeights.length >= 24) {
    const topPx = getTopPxForDate(event.start, hourHeights);
    const endAt = new Date(
      event.start.getTime() + visibleHours * 60 * 60 * 1000,
    );
    const endPx = getTopPxForDate(endAt, hourHeights);
    const dayHeightPx = getDayHeightFromHourHeights(hourHeights);
    const heightPx = Math.min(Math.max(endPx - topPx, minHeight), Math.max(dayHeightPx - topPx, minHeight));
    return { topPx, heightPx };
  }

  const startHour = event.start.getHours();
  const startMin = event.start.getMinutes();
  const dayHeightPx = getDayGridHeightPx(hourHeight);
  const rawTop = (startHour + startMin / 60) * hourHeight;
  const remainingPx = Math.max(dayHeightPx - rawTop, minHeight);
  const heightPx = Math.min(Math.max(visibleHours * hourHeight, minHeight), remainingPx);
  const topPx = clampTopWithinDay(rawTop, heightPx, dayHeightPx);
  return { topPx, heightPx };
}

function getTimedEventPosition(
  event: AgendaEvent,
  hourHeight: number,
  column: number,
  totalColumns: number,
  minHeight: number,
  maxSpanHours?: number,
  hourHeights?: number[],
) {
  const { topPx, heightPx } = getTimedEventMetrics(
    event,
    hourHeight,
    minHeight,
    maxSpanHours,
    hourHeights,
  );
  return {
    top: `${topPx}px`,
    height: `${heightPx}px`,
    ...getEventColumnStyle(column, totalColumns),
  };
}

function getOverflowChipPosition(
  clusterStart: Date,
  hourHeight: number,
  visibleColumnCount: number,
  minHeight: number,
) {
  const startHour = clusterStart.getHours() + clusterStart.getMinutes() / 60;
  const dayHeightPx = getDayGridHeightPx(hourHeight);
  const height = Math.max(minHeight, 18);
  const rawTop = startHour * hourHeight;
  const top = clampTopWithinDay(rawTop, height, dayHeightPx);
  return {
    top: `${top}px`,
    height: `${height}px`,
    ...getEventColumnStyle(Math.max(0, visibleColumnCount - 1), Math.max(1, visibleColumnCount)),
  };
}

function getCurrentTimeOffsetPx(now: Date, hourHeight: number, hourHeights?: number[]) {
  if (hourHeights && hourHeights.length >= 24) {
    return getTopPxForDate(now, hourHeights);
  }
  return (now.getHours() + now.getMinutes() / 60) * hourHeight;
}

function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const tick = () => setNow(new Date());
    const id = window.setInterval(tick, intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);

  return now;
}

interface CurrentTimeLineProps {
  now: Date;
  hourHeight: number;
  compact?: boolean;
  hourHeights?: number[];
}

function CurrentTimeLine({
  now,
  hourHeight,
  compact = false,
  hourHeights,
}: CurrentTimeLineProps) {
  const top = getCurrentTimeOffsetPx(now, hourHeight, hourHeights);

  return (
    <div
      className="absolute left-0 right-0 z-20 pointer-events-none"
      style={{ top: `${top}px`, transform: 'translateY(-50%)' }}
      aria-hidden
    >
      <div className="relative flex items-center">
        <span
          className={cn(
            'absolute rounded-full bg-red-500 shadow-sm',
            compact ? '-left-1 h-1.5 w-1.5' : '-left-1.5 h-2 w-2',
          )}
        />
        <div className="h-px w-full bg-red-500" />
        {!compact && (
          <span className="absolute left-2 -top-2.5 text-[9px] font-semibold text-red-500 bg-background/90 px-0.5 rounded">
            {format(now, 'HH:mm')}
          </span>
        )}
      </div>
    </div>
  );
}

interface CurrentTimeMarkerProps {
  now: Date;
  hourHeight: number;
  compact?: boolean;
  hourHeights?: number[];
}

function CurrentTimeMarker({
  now,
  hourHeight,
  compact = false,
  hourHeights,
}: CurrentTimeMarkerProps) {
  const top = getCurrentTimeOffsetPx(now, hourHeight, hourHeights);

  return (
    <div
      className="absolute right-0 z-20 pointer-events-none"
      style={{ top: `${top}px`, transform: 'translateY(-50%)' }}
      aria-hidden
    >
      <span
        className={cn(
          'font-bold text-red-500',
          compact ? 'pr-0.5 text-[7px]' : 'pr-1 text-[9px]',
        )}
      >
        {format(now, compact ? 'HH' : 'HH:mm')}
      </span>
    </div>
  );
}

export function FullCalendar({
  events,
  selectedDate,
  onSelectDate,
  onEditEvent,
  onCompleteEvent,
  onDeleteEvent,
  onEventDrop,
  onBulkReschedule,
  onBulkComplete,
  isRescheduling = false,
  focusDate,
  onFocusDateApplied,
  compact = false,
  zoomPercent,
  onTimeSlotClick,
  floatingLayer = false,
}: FullCalendarProps) {
  const zoomScale =
    compact && zoomPercent != null ? floatingAgendaZoomToScale(zoomPercent) : 1;
  const layout = scaleCalendarLayout(getCalendarLayout(compact), zoomScale);
  const now = useNow();
  const [view, setView] = useState<CalendarView>('dia');
  const [currentPivot, setCurrentPivot] = useState(selectedDate);
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkMoveOpen, setBulkMoveOpen] = useState(false);
  /** Chave do horário aberto no popup central (ISO do início do cluster). */
  const [expandedClusterKey, setExpandedClusterKey] = useState<string | null>(null);

  useEffect(() => {
    if (!focusDate) return;
    setCurrentPivot(focusDate);
    setView('dia');
    onSelectDate(focusDate);
    onFocusDateApplied?.();
  }, [focusDate, onSelectDate, onFocusDateApplied]);

  const canSelectBulk = !!onBulkReschedule || !!onBulkComplete;
  const canDrag = !!onEventDrop && !isRescheduling && !selectionMode;
  const gridRefsMap = useRef(new Map<string, HTMLDivElement>());
  const hourHeightsByDayRef = useRef(new Map<string, number[]>());
  const weekDayColumnRefs = useRef<(HTMLDivElement | null)[]>([]);
  const weekDaysForDragRef = useRef<Date[]>([]);

  const registerGridRef = useCallback((day: Date, el: HTMLDivElement | null) => {
    const key = day.toISOString();
    if (el) gridRefsMap.current.set(key, el);
    else gridRefsMap.current.delete(key);
  }, []);

  const getGridElement = useCallback(
    (day: Date) => gridRefsMap.current.get(day.toISOString()) ?? null,
    [],
  );

  const getHourHeights = useCallback(
    (day: Date) => hourHeightsByDayRef.current.get(day.toISOString()),
    [],
  );

  const clusterLayoutOptions = useMemo(
    () =>
      compact
        ? {
            /** 2+ tarefas na mesma faixa de 1 hora → lista vertical (sem “+N mais”). */
            stackThreshold: EVENT_COMPACT_STACK_THRESHOLD,
            stackWindowMs: EVENT_COMPACT_STACK_WINDOW_MS,
            maxSideBySideColumns: 2,
          }
        : {
            stackThreshold: Number.POSITIVE_INFINITY,
            maxSideBySideColumns: EVENT_MAX_SIDE_BY_SIDE_COLUMNS,
          },
    [compact],
  );

  const resolveExpandedHourHeights = useCallback(
    (dayEvents: AgendaEvent[], baseHourHeight: number) => {
      if (!compact) {
        return Array.from({ length: 24 }, () => baseHourHeight);
      }
      const { timed } = partitionTimedUntimedEvents(dayEvents);
      const clusters = layoutTimedClusters(timed, clusterLayoutOptions);
      const peekChipPx =
        EVENT_STACK_PEEK_CHIP_HEIGHT_PX * Math.min(zoomScale, 1.15);
      return buildExpandedHourHeights({
        baseHourHeight,
        stacks: clusters
          .filter((cluster) => cluster.useStack)
          .map((cluster) => ({
            start: cluster.start,
            eventCount: cluster.allEvents.length,
          })),
        chipHeightPx: peekChipPx,
        compact: true,
      });
    },
    [clusterLayoutOptions, compact, zoomScale],
  );

  const resolveWeekTargetDay = useCallback(
    (clientX: number, _clientY: number, fallbackDay: Date) => {
      for (let i = 0; i < weekDayColumnRefs.current.length; i++) {
        const el = weekDayColumnRefs.current[i];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientX >= rect.left && clientX <= rect.right) {
          return weekDaysForDragRef.current[i] ?? fallbackDay;
        }
      }
      return fallbackDay;
    },
    [],
  );

  const {
    dragState,
    activeTargetDayKey,
    handlePointerDown,
    handlePointerMove,
    handlePointerUp,
    handlePointerCancel,
    handleEditClick,
    isDraggingEvent,
  } = useAgendaTimedEventDrag({
    canDrag,
    onEventDrop,
    onEditEvent,
    getGridElement,
    resolveTargetDay: view === 'semana' ? resolveWeekTargetDay : undefined,
    getHourHeights,
  });

  const eligibleDayEvents = useMemo(
    () =>
      events.filter(
        (event) => isSameDay(event.start, currentPivot) && isAgendaEventPostponable(event),
      ),
    [events, currentPivot],
  );

  const selectedEvents = useMemo(
    () => events.filter((event) => selectedIds.has(event.id)),
    [events, selectedIds],
  );

  const allEligibleSelected =
    eligibleDayEvents.length > 0 &&
    eligibleDayEvents.every((event) => selectedIds.has(event.id));

  useEffect(() => {
    if (!selectionMode) return;
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const eligibleIds = new Set(eligibleDayEvents.map((e) => e.id));
      const next = new Set([...prev].filter((id) => eligibleIds.has(id)));
      return next.size === prev.size ? prev : next;
    });
  }, [selectionMode, eligibleDayEvents]);

  const toggleSelectionMode = () => {
    setSelectionMode((prev) => {
      if (prev) {
        setSelectedIds(new Set());
        setBulkMoveOpen(false);
        return false;
      }
      return true;
    });
  };

  const enterSelectionMode = () => {
    setSelectionMode(true);
  };

  const exitSelectionMode = () => {
    setSelectionMode(false);
    setSelectedIds(new Set());
    setBulkMoveOpen(false);
  };

  const toggleEventSelected = (eventId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(eventId)) next.delete(eventId);
      else next.add(eventId);
      return next;
    });
  };

  const selectAllEligible = () => {
    setSelectedIds(new Set(eligibleDayEvents.map((event) => event.id)));
  };

  /** Marca só a lista recebida (ex.: todas as tarefas daquele horário no popup). */
  const selectSpecificEvents = (list: AgendaEvent[]) => {
    setSelectionMode(true);
    setSelectedIds(
      new Set(list.filter(isAgendaEventPostponable).map((event) => event.id)),
    );
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const handleBulkConfirm = async (targetDate: Date, options: BulkRescheduleOptions) => {
    if (!onBulkReschedule || selectedEvents.length === 0) return;
    await onBulkReschedule(selectedEvents, targetDate, options);
    setBulkMoveOpen(false);
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const handleBulkCompleteClick = async () => {
    if (!onBulkComplete || selectedEvents.length === 0) return;
    await onBulkComplete(selectedEvents);
    setSelectedIds(new Set());
    setSelectionMode(false);
  };

  const hourClusterBulkActions = canSelectBulk
    ? {
        enabled: true as const,
        selectionMode,
        selectedIds,
        isBusy: isRescheduling,
        onEnterSelectionMode: enterSelectionMode,
        onExitSelectionMode: exitSelectionMode,
        onSelectEvents: selectSpecificEvents,
        onClearSelection: clearSelection,
        onCompleteSelected: onBulkComplete ? handleBulkCompleteClick : undefined,
      }
    : undefined;

  const renderSelectionCheckbox = (event: AgendaEvent) => {
    if (!selectionMode || !isAgendaEventPostponable(event)) return null;
    const checked = selectedIds.has(event.id);
    return (
      <div
        className={cn(
          'absolute z-20 flex items-center justify-center rounded bg-background/90 shadow-sm',
          compact ? 'right-0.5 top-0.5 p-0' : 'right-1 top-1 p-0.5',
        )}
        data-agenda-selection-checkbox
        onPointerDown={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
        onClick={(e) => {
          e.stopPropagation();
          e.preventDefault();
        }}
      >
        <Checkbox
          checked={checked}
          onCheckedChange={() => toggleEventSelected(event.id)}
          className={cn(compact ? 'h-3 w-3' : 'h-3.5 w-3.5')}
          aria-label={checked ? 'Desmarcar tarefa' : 'Marcar tarefa'}
        />
      </div>
    );
  };

  const handleEventSelectInteraction = (event: AgendaEvent) => {
    if (!isAgendaEventPostponable(event)) return;
    if (!isSameDay(event.start, currentPivot)) {
      setCurrentPivot(event.start);
      onSelectDate(event.start);
      setSelectedIds(new Set([event.id]));
      return;
    }
    toggleEventSelected(event.id);
  };

  const renderDragSnapIndicator = (dayKey: string) => {
    if (!dragState?.isActive || activeTargetDayKey !== dayKey) return null;
    return (
      <div
        className="absolute left-0 right-0 z-40 pointer-events-none"
        style={{ top: `${dragState.previewTopPx}px` }}
        aria-hidden
      >
        <div className="relative flex items-center">
          <span
            className={cn(
              'absolute rounded-full bg-primary shadow-sm',
              compact ? '-left-1 h-1.5 w-1.5' : '-left-1.5 h-2 w-2',
            )}
          />
          <div className="h-0.5 w-full bg-primary" />
          <span
            className={cn(
              'absolute font-semibold text-primary bg-background/95 border border-primary/30 rounded px-1',
              compact ? 'left-1 -top-3 text-[8px]' : 'left-2 -top-3.5 text-[10px]',
            )}
          >
            {format(dragState.previewStart, 'HH:mm')}
          </span>
        </div>
      </div>
    );
  };

  const getTimedEventPointerHandlers = (
    event: AgendaEvent,
    targetDay: Date,
    hourHeight: number,
  ) => ({
    onPointerDown: (e: React.PointerEvent<HTMLElement>) => {
      if (selectionMode) {
        e.stopPropagation();
        handleEventSelectInteraction(event);
        return;
      }
      if (!canDrag) return;
      handlePointerDown(event, e, targetDay, hourHeight);
    },
    onPointerMove: handlePointerMove,
    onPointerUp: handlePointerUp,
    onPointerCancel: handlePointerCancel,
  });

  const navigatePivot = (next: Date) => {
    setCurrentPivot(next);
    onSelectDate(next);
  };

  const handlePrev = () => {
    if (view === 'mes') navigatePivot(subMonths(currentPivot, 1));
    else if (view === 'semana') navigatePivot(subWeeks(currentPivot, 1));
    else navigatePivot(subDays(currentPivot, 1));
  };

  const handleNext = () => {
    if (view === 'mes') navigatePivot(addMonths(currentPivot, 1));
    else if (view === 'semana') navigatePivot(addWeeks(currentPivot, 1));
    else navigatePivot(addDays(currentPivot, 1));
  };

  const handleToday = () => {
    navigatePivot(new Date());
  };

  const handleTimeGridClick = (
    e: React.MouseEvent<HTMLElement>,
    targetDay: Date,
    hourHeight: number,
    hourHeights?: number[],
  ) => {
    if (!onTimeSlotClick) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-agenda-event]')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    onTimeSlotClick(
      getDateTimeFromGridDrop(offsetY, hourHeight, targetDay, hourHeights),
    );
  };

  const handleHourLabelClick = (targetDay: Date, hour: number) => {
    if (!onTimeSlotClick) return;
    onTimeSlotClick(setMinutes(setHours(startOfDay(targetDay), hour), 0));
  };

  const eventPreviewProps = {
    compact,
    onComplete: onCompleteEvent,
    onDelete: onDeleteEvent,
    onEditEvent,
    onPostpone: onEventDrop,
    isRescheduling,
  };
  const hoverDisabled = selectionMode;

  const renderEventListRow = (event: AgendaEvent, dense = false) => {
    const subtitle = getClusterEventSubtitle(event);
    const typeLabel = CLUSTER_EVENT_TYPE_LABELS[event.type];

    return (
      <AgendaEventHoverPreview
        key={event.id}
        event={event}
        /** Sem balão de hover nas linhas da lista (evita encavalar outras horas). */
        disabled
        {...eventPreviewProps}
      >
        <button
          type="button"
          data-agenda-event
          className={cn(
            getEventTypeClasses(event, true),
            'relative w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            dense
              ? 'h-full min-h-0 rounded-md border-l-[3px] px-1.5 py-0 text-[11px] leading-snug shadow-none'
              : cn(
                  'rounded-xl border border-[rgba(42,24,18,0.10)] border-l-[3px] px-3 py-2.5 shadow-sm',
                  'bg-[#fffcf8]/90 transition-colors hover:bg-white hover:shadow-md',
                ),
            selectionMode && selectedIds.has(event.id) && 'ring-2 ring-primary',
          )}
          style={getEventChipStyle(event)}
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            if (selectionMode) {
              handleEventSelectInteraction(event);
              return;
            }
            handleEditClick(event);
          }}
        >
          {renderSelectionCheckbox(event)}
          {dense ? (
            <span className={cn('block truncate font-medium', selectionMode && 'pr-3.5')}>
              {event.title}
            </span>
          ) : (
            <div className={cn('flex flex-col gap-1', selectionMode && 'pr-4')}>
              <div className="flex items-center gap-2">
                <span className="font-display text-[13px] tracking-[0.06em] text-[#2a1812] tabular-nums">
                  {format(event.start, 'HH:mm')}
                </span>
                <span className="rounded border border-[rgba(42,24,18,0.10)] bg-white/70 px-1.5 py-px text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8d5e22]">
                  {typeLabel}
                </span>
              </div>
              <span className="truncate text-[13px] font-medium leading-snug text-[#2a1812]">
                {event.title}
              </span>
              {subtitle ? (
                <span className="truncate text-[11px] text-[#6b5344]">{subtitle}</span>
              ) : null}
            </div>
          )}
        </button>
      </AgendaEventHoverPreview>
    );
  };

  const renderOverflowMoreChip = (
    cluster: TimedClusterLayout<AgendaEvent>,
    hourHeight: number,
    minHeight: number,
  ) => {
    if (cluster.overflow.length === 0) return null;
    const visibleCols = Math.max(1, cluster.layouted[0]?.totalColumns ?? 1);
    const position = getOverflowChipPosition(cluster.start, hourHeight, visibleCols + 1, minHeight);
    const chipStyle = getEventColumnStyle(visibleCols, visibleCols + 1);
    const clusterKey = `overflow:${cluster.start.toISOString()}`;

    return (
      <AgendaHourClusterBox
        key={clusterKey}
        variant="overflow-chip"
        clusterStart={cluster.start}
        clusterEnd={cluster.end}
        minTimeSpanPx={minHeight}
        events={cluster.allEvents}
        hourHeight={hourHeight}
        compact={compact}
        floatingLayer={floatingLayer}
        overflowCount={cluster.overflow.length}
        overflowChipStyle={{
          top: position.top,
          height: position.height,
          left: chipStyle.left,
          width: chipStyle.width,
        }}
        expanded={expandedClusterKey === clusterKey}
        onExpandedChange={(open) => setExpandedClusterKey(open ? clusterKey : null)}
        renderEventRow={renderEventListRow}
        bulkActions={hourClusterBulkActions}
      />
    );
  };

  const renderStackedCluster = (
    cluster: TimedClusterLayout<AgendaEvent>,
    hourHeight: number,
    minHeight: number,
    layoutTopPx?: number,
  ) => {
    const clusterKey = `stack:${cluster.start.toISOString()}`;
    return (
      <AgendaHourClusterBox
        key={clusterKey}
        clusterStart={cluster.start}
        clusterEnd={cluster.end}
        minTimeSpanPx={minHeight}
        events={cluster.allEvents}
        hourHeight={hourHeight}
        chipHeightPx={EVENT_STACK_PEEK_CHIP_HEIGHT_PX * (compact ? Math.min(zoomScale, 1.15) : 1)}
        compact={compact}
        floatingLayer={floatingLayer}
        layoutTopPx={layoutTopPx}
        expanded={expandedClusterKey === clusterKey}
        onExpandedChange={(open) => setExpandedClusterKey(open ? clusterKey : null)}
        renderEventRow={renderEventListRow}
        bulkActions={hourClusterBulkActions}
      />
    );
  };

  const renderColumnClusterEvent = (
    layouted: TimedClusterLayout<AgendaEvent>['layouted'][number],
    targetDay: Date,
    hourHeight: number,
    minHeight: number,
    weekMode = false,
    hourHeights?: number[],
  ) => {
    const { event, column, totalColumns } = layouted;
    const position = getTimedEventPosition(
      event,
      hourHeight,
      column,
      totalColumns,
      minHeight,
      compact ? 1 : undefined,
      hourHeights,
    );
    const isDragging = isDraggingEvent(event.id);
    const displayStyle =
      isDragging && dragState
        ? { ...position, top: `${dragState.previewTopPx}px`, zIndex: 50 }
        : position;

    return (
      <div key={event.id}>
        {isDragging && (
          <div
            className={cn(
              getEventTypeClasses(event, true),
              'absolute z-[5] opacity-35 border-dashed pointer-events-none',
              !weekMode && (compact ? 'rounded border-l-2' : 'rounded-lg border-l-4'),
            )}
            style={{ ...position, ...getEventChipStyle(event) }}
            aria-hidden
          />
        )}
        <AgendaEventHoverPreview
          event={event}
          disabled={isDragging || hoverDisabled}
          {...eventPreviewProps}
        >
          <div
            data-agenda-event
            role="button"
            tabIndex={0}
            {...getTimedEventPointerHandlers(event, targetDay, hourHeight)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                if (selectionMode) {
                  handleEventSelectInteraction(event);
                  return;
                }
                handleEditClick(event);
              }
            }}
            className={cn(
              /** z-[7]: listas empilhadas (z-[8]) ficam por cima se ainda houver sobreposição. */
              'absolute z-[7] touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              weekMode
                ? getEventTypeClasses(event, true)
                : cn(
                    'shadow-sm hover:z-30 hover:brightness-[0.97]',
                    !isDragging && 'transition-all active:scale-[0.99]',
                    compact ? 'rounded border-l-2 p-0.5' : 'rounded-lg border-l-4 p-2 shadow-md',
                    getEventTypeClasses(event, compact),
                    event.status === 'concluido' && 'grayscale-[0.3]',
                  ),
              canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
              isDragging && 'cursor-grabbing ring-2 ring-primary shadow-xl scale-[1.02] opacity-95',
              selectionMode && selectedIds.has(event.id) && 'ring-2 ring-primary',
            )}
            style={{ ...displayStyle, ...getEventChipStyle(event) }}
            title={
              selectionMode
                ? 'Clique para marcar ou desmarcar'
                : canDrag
                  ? 'Segure e arraste para alterar o horário, ou clique para editar'
                  : 'Clique para editar'
            }
          >
            {renderSelectionCheckbox(event)}
            {weekMode ? (
              <div className={cn('font-bold truncate', selectionMode && 'pr-3.5')}>
                {isDragging && dragState
                  ? format(dragState.previewStart, 'HH:mm')
                  : format(event.start, 'HH:mm')}{' '}
                · {event.title}
              </div>
            ) : (
              <>
                <div className="flex justify-between items-start gap-0.5 mb-0.5">
                  <div
                    className={cn(
                      'font-bold leading-tight',
                      compact
                        ? zoomScale >= 1.2
                          ? 'line-clamp-3 text-[9px]'
                          : 'line-clamp-2 text-[8px]'
                        : 'line-clamp-2 text-xs',
                      selectionMode && 'pr-3.5',
                    )}
                  >
                    {compact
                      ? `${
                          isDragging && dragState
                            ? format(dragState.previewStart, 'HH:mm')
                            : format(event.start, 'HH:mm')
                        } · ${event.title}`
                      : event.title}
                  </div>
                  {!compact && !selectionMode && (
                    <Badge
                      variant="outline"
                      className="text-[9px] shrink-0 bg-white/50 dark:bg-black/20"
                    >
                      {event.type}
                    </Badge>
                  )}
                </div>
                {!compact && (
                  <div className="opacity-90 flex items-center gap-0.5 text-[10px]">
                    <Clock className="shrink-0 h-3 w-3" />
                    {isDragging && dragState
                      ? format(dragState.previewStart, 'HH:mm')
                      : format(event.start, 'HH:mm')}
                    {` - ${format(event.end, 'HH:mm')}`}
                  </div>
                )}
                {event.description &&
                  parseFloat(position.height) > (compact ? 32 * zoomScale : 72) && (
                    <div
                      className={cn(
                        'opacity-80 line-clamp-2 mt-0.5',
                        compact ? 'text-[8px]' : 'text-[10px]',
                      )}
                    >
                      {event.description}
                    </div>
                  )}
              </>
            )}
          </div>
        </AgendaEventHoverPreview>
      </div>
    );
  };

  const renderTimedClustersForDay = (
    dayEvents: AgendaEvent[],
    targetDay: Date,
    hourHeight: number,
    minHeight: number,
    weekMode = false,
    hourHeights?: number[],
  ) => {
    const { timed } = partitionTimedUntimedEvents(dayEvents);
    const clusters = layoutTimedClusters(timed, clusterLayoutOptions);
    const resolvedHeights =
      hourHeights ??
      (compact ? resolveExpandedHourHeights(dayEvents, hourHeight) : undefined);

    if (resolvedHeights) {
      hourHeightsByDayRef.current.set(targetDay.toISOString(), resolvedHeights);
    }

    const columnNodes: ReactNode[] = [];
    const overlayNodes: ReactNode[] = [];

    for (const cluster of clusters) {
      if (cluster.useStack) {
        const layoutTopPx = resolvedHeights
          ? getTopPxForDate(cluster.start, resolvedHeights)
          : undefined;
        overlayNodes.push(
          renderStackedCluster(cluster, hourHeight, minHeight, layoutTopPx),
        );
        continue;
      }
      columnNodes.push(
        ...cluster.layouted.map((item) =>
          renderColumnClusterEvent(
            item,
            targetDay,
            hourHeight,
            minHeight,
            weekMode,
            resolvedHeights,
          ),
        ),
      );
      const overflow = renderOverflowMoreChip(cluster, hourHeight, minHeight);
      if (overflow) overlayNodes.push(overflow);
    }

    /** Listas empilhadas por cima das tarefas soltas (z-[8] > z-[7]). */
    return [...columnNodes, ...overlayNodes];
  };

  const renderUntimedStrip = (untimedEvents: AgendaEvent[], dense = false) => {
    if (untimedEvents.length === 0) return null;

    return (
      <div
        className="shrink-0 border-b bg-muted/10 px-1 py-1 space-y-0.5 overflow-y-auto"
        style={{
          height: layout.untimedStripMaxHeight,
          maxHeight: layout.untimedStripMaxHeight,
        }}
      >
        <p className="text-[8px] font-medium uppercase tracking-wide text-muted-foreground px-0.5">
          Sem horário ({untimedEvents.length})
        </p>
        <div className={cn('flex gap-1', dense ? 'flex-col' : 'flex-wrap')}>
          {untimedEvents.map((event) => (
            <AgendaEventHoverPreview
              key={event.id}
              event={event}
              disabled={hoverDisabled}
              {...eventPreviewProps}
            >
              <button
                type="button"
                className={cn(
                  getEventTypeClasses(event, true),
                  'relative text-left max-w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  selectionMode && selectedIds.has(event.id) && 'ring-2 ring-primary',
                )}
                style={getEventChipStyle(event)}
                onClick={(e) => {
                  if (!selectionMode) return;
                  e.preventDefault();
                  e.stopPropagation();
                  handleEventSelectInteraction(event);
                }}
              >
                {renderSelectionCheckbox(event)}
                <span className="block truncate font-medium pr-4">
                  {format(event.start, 'HH:mm')} · {event.title}
                </span>
              </button>
            </AgendaEventHoverPreview>
          ))}
        </div>
      </div>
    );
  };

  const renderMonthView = () => {
    const monthStart = startOfMonth(currentPivot);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart, { weekStartsOn: 0 });
    const endDate = endOfWeek(monthEnd, { weekStartsOn: 0 });
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const diasSemana = compact
      ? ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']
      : ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];

    return (
      <div className="w-full">
        <div className="grid grid-cols-7 border-b">
          {diasSemana.map((dia, i) => (
            <div
              key={`${dia}-${i}`}
              className={cn(
                'text-center font-medium text-muted-foreground',
                compact ? 'py-1 text-[9px]' : 'py-2 text-sm',
              )}
            >
              {dia}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 border-l border-t">
          {calendarDays.map((day) => {
            const isSelected = isSameDay(day, selectedDate);
            const isCurrentMonth = day.getMonth() === currentPivot.getMonth();
            const dayEvents = events.filter((e) => isSameDay(e.start, day));

            return (
              <div
                key={day.toString()}
                onClick={() => {
                  onSelectDate(day);
                  setCurrentPivot(day);
                  setView('dia');
                }}
                className={cn(
                  'border-r border-b transition-colors cursor-pointer hover:bg-accent/50',
                  compact ? 'p-0.5' : 'p-2',
                  !isCurrentMonth && 'bg-muted/30 text-muted-foreground',
                  isSelected && 'bg-primary/5 ring-1 ring-inset ring-primary',
                )}
                style={{ minHeight: layout.monthCellMinH }}
              >
                <div className="flex items-center justify-between mb-0.5">
                  <span
                    className={cn(
                      'flex items-center justify-center rounded-full font-medium',
                      compact ? 'h-5 w-5 text-[10px]' : 'h-7 w-7 text-sm',
                      isToday(day) && 'bg-primary text-primary-foreground',
                      isSelected && !isToday(day) && 'text-primary font-bold',
                    )}
                  >
                    {format(day, 'd')}
                  </span>
                  {dayEvents.length > 0 && !compact && (
                    <span className="text-[10px] text-muted-foreground">
                      {dayEvents.length} {dayEvents.length === 1 ? 'item' : 'itens'}
                    </span>
                  )}
                  {dayEvents.length > 0 && compact && (
                    <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                  )}
                </div>
                <div className={cn('overflow-hidden', compact ? 'space-y-0.5' : 'space-y-1')}>
                  {dayEvents.slice(0, compact ? 2 : 3).map((event) => (
                    <AgendaEventHoverPreview
                      key={event.id}
                      event={event}
                      disabled={hoverDisabled}
                      {...eventPreviewProps}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectionMode) {
                            handleEventSelectInteraction(event);
                          }
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            if (selectionMode) {
                              handleEventSelectInteraction(event);
                              return;
                            }
                            handleEditClick(event);
                          }
                        }}
                        className={cn(
                          'relative rounded border truncate flex items-center gap-0.5 cursor-pointer hover:brightness-95',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          compact ? 'text-[8px] px-1 py-px' : 'text-[10px] px-1.5 py-0.5',
                          event.status === 'concluido' && 'opacity-60 line-through',
                          selectionMode && selectedIds.has(event.id) && 'ring-1 ring-primary',
                        )}
                        style={getEventChipStyle(event)}
                      >
                        {selectionMode && isAgendaEventPostponable(event) && (
                          <Checkbox
                            checked={selectedIds.has(event.id)}
                            className="h-2.5 w-2.5 shrink-0"
                            aria-hidden
                          />
                        )}
                        {!selectionMode && (
                          <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
                        )}
                        {compact
                          ? `${format(event.start, 'HH:mm')} · ${event.title}`
                          : event.title}
                      </div>
                    </AgendaEventHoverPreview>
                  ))}
                  {dayEvents.length > (compact ? 2 : 3) && (
                    <div className={cn('text-muted-foreground pl-0.5', compact ? 'text-[8px]' : 'text-[10px]')}>
                      +{dayEvents.length - (compact ? 2 : 3)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderWeekView = () => {
    const startDate = startOfWeek(currentPivot, { weekStartsOn: 0 });
    const endDate = endOfWeek(currentPivot, { weekStartsOn: 0 });
    const weekDays = eachDayOfInterval({ start: startDate, end: endDate });
    weekDaysForDragRef.current = weekDays;
    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
      <div
        className={cn('flex flex-col min-h-0', layout.fixedViewHeight ? `h-[${layout.fixedViewHeight}px]` : 'flex-1')}
        style={layout.fixedViewHeight ? { height: layout.fixedViewHeight } : undefined}
      >
        <div className="grid border-b shrink-0" style={{ gridTemplateColumns: `${layout.timeColWeek}px 1fr` }}>
          <div className="border-r bg-muted/20" />
          <div className="grid grid-cols-7">
            {weekDays.map((day) => (
              <div
                key={day.toString()}
                className={cn('text-center border-r last:border-r-0', compact ? 'py-0.5' : 'py-2')}
              >
                <div
                  className={cn(
                    'font-medium text-muted-foreground uppercase',
                    compact ? 'text-[8px]' : 'text-xs',
                  )}
                >
                  {format(day, compact ? 'EEEEE' : 'eee', { locale: ptBR })}
                </div>
                <div
                  className={cn(
                    'mx-auto flex items-center justify-center rounded-full font-semibold',
                    compact ? 'h-5 w-5 text-[10px] mt-0.5' : 'text-lg h-8 w-8 mt-1',
                    isToday(day) && 'bg-primary text-primary-foreground',
                  )}
                >
                  {format(day, 'd')}
                </div>
              </div>
            ))}
          </div>
        </div>

        <ScrollArea className="flex-1 min-h-0">
          <div className="grid border-b min-h-full" style={{ gridTemplateColumns: `${layout.timeColWeek}px 1fr` }}>
            <div className="relative border-r bg-muted/10">
              {hours.map((hour) => (
                <div
                  key={hour}
                  className={cn(
                    'border-b text-muted-foreground text-right',
                    compact ? 'px-0.5 text-[8px]' : 'p-1 text-[10px]',
                    onTimeSlotClick && 'cursor-pointer hover:bg-muted/30 transition-colors',
                  )}
                  style={{ height: layout.hourHeightWeek }}
                  onClick={() => handleHourLabelClick(currentPivot, hour)}
                  title={onTimeSlotClick ? `Criar tarefa às ${format(setHours(new Date(), hour), 'HH:mm')}` : undefined}
                >
                  {compact && hour % 2 !== 0 ? '' : format(setHours(new Date(), hour), compact ? 'HH' : 'HH:mm')}
                </div>
              ))}
              {weekDays.some((day) => isToday(day)) && (
                <CurrentTimeMarker now={now} hourHeight={layout.hourHeightWeek} compact={compact} />
              )}
            </div>
            <div className="grid grid-cols-7">
              {weekDays.map((day, dayIndex) => {
                const dayEvents = events.filter((e) => isSameDay(e.start, day));
                const dayKey = day.toISOString();
                const isDragTarget = activeTargetDayKey === dayKey;

                return (
                  <div
                    key={day.toString()}
                    ref={(el) => {
                      weekDayColumnRefs.current[dayIndex] = el;
                    }}
                    className="relative min-h-full border-r last:border-r-0"
                    style={{ minHeight: hours.length * layout.hourHeightWeek }}
                  >
                    <div
                      ref={(el) => registerGridRef(day, el)}
                      className={cn(
                        'absolute inset-0 overflow-hidden',
                        isDragTarget && 'bg-primary/5 ring-1 ring-inset ring-primary/40',
                        onTimeSlotClick && 'cursor-pointer',
                      )}
                      onClick={(e) => handleTimeGridClick(e, day, layout.hourHeightWeek)}
                    >
                      {hours.map((hour) => (
                        <div
                          key={hour}
                          className="border-b last:border-b-0 pointer-events-none"
                          style={{ height: layout.hourHeightWeek }}
                        />
                      ))}
                      {isToday(day) && (
                        <CurrentTimeLine now={now} hourHeight={layout.hourHeightWeek} compact={compact} />
                      )}
                      {renderDragSnapIndicator(dayKey)}
                      {renderTimedClustersForDay(
                        dayEvents,
                        day,
                        layout.hourHeightWeek,
                        layout.weekEventMinHeight,
                        true,
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  };

  const renderDayView = () => {
    const hours = Array.from({ length: 24 }, (_, i) => i);
    const dayEvents = events.filter((e) => isSameDay(e.start, currentPivot));
    const { untimed } = partitionTimedUntimedEvents(dayEvents);
    const hasUntimedStrip = untimed.length > 0;
    const hourHeights = resolveExpandedHourHeights(dayEvents, layout.hourHeightDay);
    const dayGridHeightPx = getDayHeightFromHourHeights(hourHeights);
    hourHeightsByDayRef.current.set(currentPivot.toISOString(), hourHeights);

    return (
      <div
        className={cn('flex flex-col min-h-0', !layout.fixedViewHeight && 'flex-1')}
        style={layout.fixedViewHeight ? { height: layout.fixedViewHeight } : undefined}
      >
        {!compact && (
          <div className="grid border-b shrink-0" style={{ gridTemplateColumns: `${layout.timeColDay}px 1fr` }}>
            <div className="border-r bg-muted/20 py-4 text-center">
              <div className="text-sm font-medium text-muted-foreground uppercase">
                {format(currentPivot, 'EEEE', { locale: ptBR })}
              </div>
            </div>
            <div className="p-4 bg-muted/5 flex items-center justify-between">
              <h3 className="text-xl font-bold flex items-center gap-2">
                {format(currentPivot, "dd 'de' MMMM", { locale: ptBR })}
                {isToday(currentPivot) && <Badge>Hoje</Badge>}
              </h3>
              <span className="text-sm text-muted-foreground">
                {dayEvents.length} {dayEvents.length === 1 ? 'evento' : 'eventos'}
              </span>
            </div>
          </div>
        )}

        {compact && (
          <div className="flex items-center justify-between gap-1 px-1.5 py-1 border-b bg-muted/10 shrink-0 text-[10px]">
            <span className="font-semibold uppercase truncate">
              {format(currentPivot, 'EEE dd MMM', { locale: ptBR })}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              {isToday(currentPivot) && (
                <Badge variant="outline" className="h-4 px-1 text-[8px]">
                  Hoje
                </Badge>
              )}
              <span className="text-muted-foreground">
                {dayEvents.length} evt
              </span>
            </div>
          </div>
        )}

        <ScrollArea className="flex-1 min-h-0">
          <div
            className="grid border-b min-h-full"
            style={{ gridTemplateColumns: `${layout.timeColDay}px 1fr` }}
          >
            <div className="flex flex-col border-r bg-muted/10">
              {hasUntimedStrip && (
                <div
                  className="shrink-0 border-b bg-muted/20"
                  style={{ height: layout.untimedStripMaxHeight }}
                />
              )}
              <div className="relative flex flex-col">
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className={cn(
                      'border-b text-muted-foreground text-right',
                      compact ? 'px-0.5 text-[8px]' : 'p-2 text-xs',
                      onTimeSlotClick && 'cursor-pointer hover:bg-muted/30 transition-colors',
                      /** Faixa expandida: destaca o horário “cheio” de lista. */
                      compact &&
                        hourHeights[hour] > layout.hourHeightDay + 0.5 &&
                        'bg-[#f7f0e6]/55 font-semibold text-[#6b5344]',
                    )}
                    style={{ height: hourHeights[hour] }}
                    onClick={() => handleHourLabelClick(currentPivot, hour)}
                    title={onTimeSlotClick ? `Criar tarefa às ${format(setHours(new Date(), hour), 'HH:mm')}` : undefined}
                  >
                    {compact && hour % 2 !== 0 && hourHeights[hour] <= layout.hourHeightDay + 0.5
                      ? ''
                      : format(setHours(new Date(), hour), compact ? 'HH' : 'HH:mm')}
                  </div>
                ))}
                {isToday(currentPivot) && (
                  <CurrentTimeMarker
                    now={now}
                    hourHeight={layout.hourHeightDay}
                    hourHeights={hourHeights}
                    compact={compact}
                  />
                )}
              </div>
            </div>
            <div className="flex min-h-full flex-col">
              {renderUntimedStrip(untimed)}
              <div
                ref={(el) => registerGridRef(currentPivot, el)}
                className={cn(
                  'relative flex-1 overflow-hidden',
                  activeTargetDayKey === currentPivot.toISOString() &&
                    'bg-primary/5 ring-1 ring-inset ring-primary/40',
                  onTimeSlotClick && 'cursor-pointer',
                )}
                style={{ minHeight: dayGridHeightPx }}
                onClick={(e) =>
                  handleTimeGridClick(e, currentPivot, layout.hourHeightDay, hourHeights)
                }
              >
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="border-b last:border-b-0 pointer-events-none"
                    style={{ height: hourHeights[hour] }}
                  />
                ))}

                {isToday(currentPivot) && (
                  <CurrentTimeLine
                    now={now}
                    hourHeight={layout.hourHeightDay}
                    hourHeights={hourHeights}
                    compact={compact}
                  />
                )}

                {renderDragSnapIndicator(currentPivot.toISOString())}

                {renderTimedClustersForDay(
                  dayEvents,
                  currentPivot,
                  layout.hourHeightDay,
                  layout.dayEventMinHeight,
                  false,
                  hourHeights,
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    );
  };

  const getHeaderTitle = () => {
    if (compact) {
      if (view === 'mes') return format(currentPivot, 'MMM yyyy', { locale: ptBR });
      if (view === 'semana') {
        const start = startOfWeek(currentPivot, { weekStartsOn: 0 });
        const end = endOfWeek(currentPivot, { weekStartsOn: 0 });
        return `${format(start, 'dd/MM')}–${format(end, 'dd/MM')}`;
      }
      return format(currentPivot, 'dd MMM yyyy', { locale: ptBR });
    }

    if (view === 'mes') return format(currentPivot, 'MMMM yyyy', { locale: ptBR });
    if (view === 'semana') {
      const start = startOfWeek(currentPivot, { weekStartsOn: 0 });
      const end = endOfWeek(currentPivot, { weekStartsOn: 0 });
      if (start.getMonth() === end.getMonth()) {
        return `${format(start, 'MMMM', { locale: ptBR })} de ${format(start, 'yyyy')}`;
      }
      return `${format(start, 'MMM', { locale: ptBR })} - ${format(end, 'MMM', { locale: ptBR })} de ${format(end, 'yyyy')}`;
    }
    return format(currentPivot, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  };

  return (
    <div className={cn('bg-background', compact && 'flex flex-col flex-1 min-h-0')}>
      <div
        className={cn(
          'border-b shrink-0',
          compact ? 'px-1.5 py-1 space-y-1' : 'flex flex-col sm:flex-row items-center justify-between p-4 gap-4',
        )}
      >
        {compact ? (
          <>
            <div className="flex items-center justify-between gap-1">
              <h2 className="text-[10px] font-semibold capitalize truncate min-w-0">
                {getHeaderTitle()}
              </h2>
              <Tabs value={view} onValueChange={(v) => setView(v as CalendarView)}>
                <TabsList className="h-6 p-0.5">
                  <TabsTrigger value="dia" className="text-[9px] h-5 px-1.5 gap-0.5">
                    <List className="h-2.5 w-2.5" />
                    Dia
                  </TabsTrigger>
                  <TabsTrigger value="semana" className="text-[9px] h-5 px-1.5 gap-0.5">
                    <Columns className="h-2.5 w-2.5" />
                    Sem
                  </TabsTrigger>
                  <TabsTrigger value="mes" className="text-[9px] h-5 px-1.5 gap-0.5">
                    <LayoutGrid className="h-2.5 w-2.5" />
                    Mês
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex items-center gap-1">
              <div className="flex flex-1 items-center justify-between gap-0.5 bg-muted/20 p-0.5 rounded-md min-w-0">
                <Button variant="ghost" size="icon" onClick={handlePrev} className="h-6 w-6">
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <Button variant="ghost" size="sm" onClick={handleToday} className="h-6 px-1.5 text-[9px]">
                  Hoje
                </Button>
                <Button variant="ghost" size="icon" onClick={handleNext} className="h-6 w-6">
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
            {canSelectBulk && (
              <Button
                variant={selectionMode ? 'default' : 'secondary'}
                size="sm"
                onClick={toggleSelectionMode}
                className="h-8 w-full shrink-0 px-2 text-[11px] gap-1.5 font-semibold border border-primary/30"
                title={selectionMode ? 'Sair da seleção' : 'Selecionar várias tarefas para mover'}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                {selectionMode ? 'Sair da seleção' : 'Selecionar várias tarefas'}
              </Button>
            )}
          </>
        ) : (
          <>
            <div className="flex items-center justify-between gap-2 w-full">
              <div className="flex items-center gap-1.5 min-w-0">
                <CalendarIcon className="h-5 w-5 text-primary shrink-0" />
                <h2 className="text-lg font-bold capitalize truncate">{getHeaderTitle()}</h2>
              </div>
              <Tabs value={view} onValueChange={(v) => setView(v as CalendarView)}>
                <TabsList>
                  <TabsTrigger value="dia" className="text-[10px] gap-1 px-2">
                    <List className="h-3 w-3" />
                    Dia
                  </TabsTrigger>
                  <TabsTrigger value="semana" className="text-[10px] gap-1 px-2">
                    <Columns className="h-3 w-3" />
                    Sem.
                  </TabsTrigger>
                  <TabsTrigger value="mes" className="text-[10px] gap-1 px-2">
                    <LayoutGrid className="h-3 w-3" />
                    Mês
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
            <div className="flex items-center justify-center gap-1 bg-muted/20 p-0.5 rounded-lg w-full">
              <Button variant="ghost" size="icon" onClick={handlePrev} className="h-7 w-7">
                <ChevronLeft className="h-3.5 w-3.5" />
              </Button>
              <Button variant="ghost" size="sm" onClick={handleToday} className="h-7 px-2 text-[10px]">
                Hoje
              </Button>
              <Button variant="ghost" size="icon" onClick={handleNext} className="h-7 w-7">
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
              {canSelectBulk && (
                <Button
                  variant={selectionMode ? 'default' : 'outline'}
                  size="sm"
                  onClick={toggleSelectionMode}
                  className="h-8 px-3 text-xs gap-1.5 font-semibold"
                >
                  <CheckSquare className="h-3.5 w-3.5" />
                  {selectionMode ? 'Cancelar seleção' : 'Selecionar tarefas'}
                </Button>
              )}
            </div>
          </>
        )}
      </div>

      <div className={cn('bg-card', compact && 'flex-1 min-h-0 flex flex-col')}>
        {view === 'mes' &&
          (compact ? (
            <ScrollArea className="flex-1 min-h-0">{renderMonthView()}</ScrollArea>
          ) : (
            renderMonthView()
          ))}
        {view === 'semana' && renderWeekView()}
        {view === 'dia' && renderDayView()}
      </div>

      {selectionMode && canSelectBulk && (
        <div
          className={cn(
            'flex flex-wrap items-center gap-1.5 border-t bg-muted/20 shrink-0',
            compact ? 'px-1.5 py-1' : 'px-4 py-2',
          )}
        >
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(compact ? 'h-6 px-1.5 text-[9px]' : 'h-8 text-xs')}
            onClick={allEligibleSelected ? clearSelection : selectAllEligible}
            disabled={eligibleDayEvents.length === 0}
          >
            {allEligibleSelected ? 'Desmarcar todos' : 'Marcar todos'}
          </Button>
          {onBulkComplete && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={cn('gap-1', compact ? 'h-6 px-1.5 text-[9px]' : 'h-8 text-xs')}
              disabled={selectedIds.size === 0 || isRescheduling}
              onClick={handleBulkCompleteClick}
            >
              <CheckCircle2 className={cn(compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5')} />
              Concluir {selectedIds.size > 0 ? selectedIds.size : ''}
            </Button>
          )}
          {onBulkReschedule && (
            <Button
              type="button"
              size="sm"
              className={cn('gap-1', compact ? 'h-6 px-1.5 text-[9px]' : 'h-8 text-xs')}
              disabled={selectedIds.size === 0 || isRescheduling}
              onClick={() => setBulkMoveOpen(true)}
            >
              <CalendarRange className={cn(compact ? 'h-2.5 w-2.5' : 'h-3.5 w-3.5')} />
              Mover {selectedIds.size > 0 ? selectedIds.size : ''}
            </Button>
          )}
          <span
            className={cn(
              'text-muted-foreground ml-auto',
              compact ? 'text-[8px]' : 'text-[10px]',
            )}
          >
            {selectedIds.size} selecionada{selectedIds.size === 1 ? '' : 's'}
            {eligibleDayEvents.length > 0 && ` · ${eligibleDayEvents.length} no dia`}
          </span>
        </div>
      )}

      {canDrag && !compact && !selectionMode && (
        <p className="px-4 pt-2 text-[10px] text-muted-foreground border-t">
          Segure e arraste os cards para cima ou para baixo nas visões Dia ou Semana para alterar o horário (intervalos de 15 min).
          {isRescheduling && ' Salvando...'}
        </p>
      )}

      {compact && canDrag && isRescheduling && !selectionMode && (
        <p className="px-2 py-1 text-[9px] text-muted-foreground border-t text-center">Salvando...</p>
      )}

      <div
        className={cn(
          'flex items-center border-t text-muted-foreground shrink-0',
          compact ? 'justify-center gap-2 py-1 px-1' : 'flex-wrap gap-4 p-4 text-[10px]',
        )}
        title={compact ? 'Tarefas · Leads · Pessoal · Marketing' : undefined}
      >
        {(
          [
            { color: 'bg-blue-500', label: 'Tarefas' },
            { color: 'bg-amber-500', label: 'Leads' },
            { color: 'bg-emerald-500', label: 'Pessoal' },
            { color: 'bg-purple-500', label: 'Marketing' },
          ] as const
        ).map(({ color, label }) => (
          <div key={label} className={cn('flex items-center gap-1', !compact && 'text-[10px]')}>
            <span className={cn('rounded-full', color, compact ? 'w-1.5 h-1.5' : 'w-2 h-2')} />
            {!compact && <span>{label}</span>}
          </div>
        ))}
      </div>

      {canSelectBulk && (
        <AgendaBulkMoveDialog
          open={bulkMoveOpen}
          onOpenChange={setBulkMoveOpen}
          events={selectedEvents}
          initialDate={addDays(currentPivot, 1)}
          isSubmitting={isRescheduling}
          floatingLayer={floatingLayer}
          onConfirm={handleBulkConfirm}
        />
      )}
    </div>
  );
}
