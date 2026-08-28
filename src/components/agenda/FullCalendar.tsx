import { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import {
  getEventColumnStyle,
  layoutOverlappingEvents,
  partitionTimedUntimedEvents,
} from '@/lib/calendar-event-layout';
import type { AgendaEvent } from '@/hooks/useAgendaGeral';
import { floatingAgendaZoomToScale } from '@/lib/floating-agenda-zoom-preferences';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { getDateTimeFromGridDrop } from '@/lib/agenda-calendar-drag';
import { useAgendaTimedEventDrag } from '@/hooks/useAgendaTimedEventDrag';
import { AgendaEventHoverPreview } from '@/components/agenda/AgendaEventHoverPreview';

interface FullCalendarProps {
  events: AgendaEvent[];
  selectedDate: Date;
  onSelectDate: (date: Date) => void;
  onEditEvent?: (event: AgendaEvent) => void;
  onCompleteEvent?: (event: AgendaEvent) => void;
  onDeleteEvent?: (event: AgendaEvent) => void;
  onEventDrop?: (event: AgendaEvent, newStart: Date, newEnd: Date) => void;
  isRescheduling?: boolean;
  /** Ao selecionar um resultado da busca, o calendário navega para este dia. */
  focusDate?: Date | null;
  onFocusDateApplied?: () => void;
  /** Layout reduzido para painel lateral flutuante */
  compact?: boolean;
  /** Zoom do painel flutuante (80–140%) — escala layout compacto sem CSS zoom */
  zoomPercent?: number;
  /** Clique em faixa horária vazia — ex.: criar tarefa no horário clicado. */
  onTimeSlotClick?: (dateTime: Date) => void;
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

  return {
    hourHeightWeek: 32,
    hourHeightDay: 40,
    untimedStripMaxHeight: 64,
    timeColWeek: 32,
    timeColDay: 36,
    monthCellMinH: 52,
    dayEventMinHeight: 24,
    weekEventMinHeight: 16,
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
    'rounded border shadow-sm cursor-pointer transition-all hover:z-30 hover:brightness-95',
    compact ? 'overflow-visible' : 'overflow-hidden',
    event.type === 'tarefa' &&
      'bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/40 dark:border-blue-800',
    event.type === 'lembrete' &&
      'bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/40 dark:border-amber-800',
    event.type === 'pessoal' &&
      'bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/40 dark:border-emerald-800',
    event.type === 'conteudo' &&
      'bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/40 dark:border-purple-800',
    event.status === 'concluido' && 'opacity-60 line-through',
  );
}

function getTimedEventPosition(
  event: AgendaEvent,
  hourHeight: number,
  column: number,
  totalColumns: number,
  minHeight: number,
) {
  const startHour = event.start.getHours();
  const startMin = event.start.getMinutes();
  const durationHours = (event.end.getTime() - event.start.getTime()) / (1000 * 60 * 60);
  const top = (startHour + startMin / 60) * hourHeight;
  const height = Math.max(durationHours * hourHeight, minHeight);
  return {
    top: `${top}px`,
    height: `${height}px`,
    ...getEventColumnStyle(column, totalColumns),
  };
}

function getCurrentTimeOffsetPx(now: Date, hourHeight: number) {
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
}

function CurrentTimeLine({ now, hourHeight, compact = false }: CurrentTimeLineProps) {
  const top = getCurrentTimeOffsetPx(now, hourHeight);

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
}

function CurrentTimeMarker({ now, hourHeight, compact = false }: CurrentTimeMarkerProps) {
  const top = getCurrentTimeOffsetPx(now, hourHeight);

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
  isRescheduling = false,
  focusDate,
  onFocusDateApplied,
  compact = false,
  zoomPercent,
  onTimeSlotClick,
}: FullCalendarProps) {
  const zoomScale =
    compact && zoomPercent != null ? floatingAgendaZoomToScale(zoomPercent) : 1;
  const layout = scaleCalendarLayout(getCalendarLayout(compact), zoomScale);
  const now = useNow();
  const [view, setView] = useState<CalendarView>('dia');
  const [currentPivot, setCurrentPivot] = useState(selectedDate);

  useEffect(() => {
    if (!focusDate) return;
    setCurrentPivot(focusDate);
    setView('dia');
    onSelectDate(focusDate);
    onFocusDateApplied?.();
  }, [focusDate, onSelectDate, onFocusDateApplied]);
  const canDrag = !!onEventDrop && !isRescheduling;
  const gridRefsMap = useRef(new Map<string, HTMLDivElement>());
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
  });

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
  ) => {
    if (!onTimeSlotClick) return;
    const target = e.target as HTMLElement;
    if (target.closest('[data-agenda-event]')) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const offsetY = e.clientY - rect.top;
    onTimeSlotClick(getDateTimeFromGridDrop(offsetY, hourHeight, targetDay));
  };

  const handleHourLabelClick = (targetDay: Date, hour: number) => {
    if (!onTimeSlotClick) return;
    onTimeSlotClick(setMinutes(setHours(startOfDay(targetDay), hour), 0));
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
              compact={compact}
              onComplete={onCompleteEvent}
              onDelete={onDeleteEvent}
            >
              <button
                type="button"
                onClick={() => onEditEvent?.(event)}
                className={cn(
                  getEventTypeClasses(event, true),
                  'text-left max-w-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                )}
              >
                <span className="block truncate font-medium">
                  {format(event.start, 'HH:mm')} · {event.title}
                </span>
              </button>
            </AgendaEventHoverPreview>
          ))}
        </div>
      </div>
    );
  };

  const renderWeekTimedEvent = (
    layouted: ReturnType<typeof layoutOverlappingEvents<AgendaEvent>>[number],
    targetDay: Date,
  ) => {
    const { event, column, totalColumns } = layouted;
    const position = getTimedEventPosition(
      event,
      layout.hourHeightWeek,
      column,
      totalColumns,
      layout.weekEventMinHeight,
    );
    const isDragging = isDraggingEvent(event.id);
    const displayStyle = isDragging && dragState
      ? { ...position, top: `${dragState.previewTopPx}px`, zIndex: 50 }
      : position;

    return (
      <div key={event.id}>
        {isDragging && (
          <div
            className={cn(
              getEventTypeClasses(event, true),
              'absolute z-[5] opacity-35 border-dashed pointer-events-none',
            )}
            style={position}
            aria-hidden
          />
        )}
        <AgendaEventHoverPreview
          event={event}
          compact={compact}
          disabled={isDragging}
          onComplete={onCompleteEvent}
          onDelete={onDeleteEvent}
        >
          <div
            data-agenda-event
            role="button"
            tabIndex={0}
            {...getTimedEventPointerHandlers(event, targetDay, layout.hourHeightWeek)}
            onClick={() => handleEditClick(event)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleEditClick(event);
              }
            }}
            className={cn(
              getEventTypeClasses(event, true),
              'absolute z-10 touch-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              canDrag && 'cursor-grab active:cursor-grabbing',
              isDragging && 'cursor-grabbing ring-2 ring-primary shadow-lg scale-[1.02] opacity-95',
            )}
            style={displayStyle}
          >
            <div className="font-bold truncate">
              {isDragging && dragState
                ? format(dragState.previewStart, 'HH:mm')
                : format(event.start, 'HH:mm')}{' '}
              · {event.title}
            </div>
          </div>
        </AgendaEventHoverPreview>
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
                      compact={compact}
                      onComplete={onCompleteEvent}
                      onDelete={onDeleteEvent}
                    >
                      <div
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditEvent?.(event);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            e.stopPropagation();
                            onEditEvent?.(event);
                          }
                        }}
                        className={cn(
                          'rounded border truncate flex items-center gap-0.5 cursor-pointer hover:brightness-95',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          compact ? 'text-[8px] px-1 py-px' : 'text-[10px] px-1.5 py-0.5',
                          event.type === 'tarefa' && "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-900/20 dark:border-blue-800",
                          event.type === 'lembrete' && "bg-amber-50 border-amber-200 text-amber-700 dark:bg-amber-900/20 dark:border-amber-800",
                          event.type === 'pessoal' && "bg-emerald-50 border-emerald-200 text-emerald-700 dark:bg-emerald-900/20 dark:border-emerald-800",
                          event.type === 'conteudo' && "bg-purple-50 border-purple-200 text-purple-700 dark:bg-purple-900/20 dark:border-purple-800",
                          event.status === 'concluido' && "opacity-60 line-through"
                        )}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current shrink-0" />
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
                const layoutedTimed = layoutOverlappingEvents(dayEvents);
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
                        'absolute inset-0',
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
                      {layoutedTimed.map((layouted) => renderWeekTimedEvent(layouted, day))}
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
    const { timed, untimed } = partitionTimedUntimedEvents(dayEvents);
    const layoutedTimed = layoutOverlappingEvents(timed);
    const hasUntimedStrip = untimed.length > 0;

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
                    )}
                    style={{ height: layout.hourHeightDay }}
                    onClick={() => handleHourLabelClick(currentPivot, hour)}
                    title={onTimeSlotClick ? `Criar tarefa às ${format(setHours(new Date(), hour), 'HH:mm')}` : undefined}
                  >
                    {compact && hour % 2 !== 0
                      ? ''
                      : format(setHours(new Date(), hour), compact ? 'HH' : 'HH:mm')}
                  </div>
                ))}
                {isToday(currentPivot) && (
                  <CurrentTimeMarker now={now} hourHeight={layout.hourHeightDay} compact={compact} />
                )}
              </div>
            </div>
            <div className="flex min-h-full flex-col">
              {renderUntimedStrip(untimed)}
              <div
                ref={(el) => registerGridRef(currentPivot, el)}
                className={cn(
                  'relative flex-1',
                  activeTargetDayKey === currentPivot.toISOString() &&
                    'bg-primary/5 ring-1 ring-inset ring-primary/40',
                  onTimeSlotClick && 'cursor-pointer',
                )}
                style={{ minHeight: hours.length * layout.hourHeightDay }}
                onClick={(e) => handleTimeGridClick(e, currentPivot, layout.hourHeightDay)}
              >
                {hours.map((hour) => (
                  <div
                    key={hour}
                    className="border-b last:border-b-0 pointer-events-none"
                    style={{ height: layout.hourHeightDay }}
                  />
                ))}

                {isToday(currentPivot) && (
                  <CurrentTimeLine now={now} hourHeight={layout.hourHeightDay} compact={compact} />
                )}

                {renderDragSnapIndicator(currentPivot.toISOString())}

                {layoutedTimed.map(({ event, column, totalColumns }) => {
                  const position = getTimedEventPosition(
                    event,
                    layout.hourHeightDay,
                    column,
                    totalColumns,
                    layout.dayEventMinHeight,
                  );
                  const heightPx = parseFloat(position.height);
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
                            'absolute z-[5] rounded-lg border-2 border-dashed border-primary/40 bg-muted/20 pointer-events-none',
                            compact ? 'rounded border-l-2' : 'rounded-lg border-l-4',
                          )}
                          style={position}
                          aria-hidden
                        />
                      )}
                      <AgendaEventHoverPreview
                        event={event}
                        compact={compact}
                        disabled={isDragging}
                        onComplete={onCompleteEvent}
                        onDelete={onDeleteEvent}
                      >
                        <div
                          data-agenda-event
                          role="button"
                          tabIndex={0}
                          {...getTimedEventPointerHandlers(event, currentPivot, layout.hourHeightDay)}
                          onClick={() => handleEditClick(event)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              handleEditClick(event);
                            }
                          }}
                          className={cn(
                            'absolute z-10 shadow-sm hover:z-30 hover:brightness-[0.97] touch-none',
                            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                            !isDragging && 'transition-all active:scale-[0.99]',
                            compact ? 'rounded border-l-2 p-0.5' : 'rounded-lg border-l-4 p-2 shadow-md',
                            canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                            isDragging && 'cursor-grabbing ring-2 ring-primary shadow-xl scale-[1.02] opacity-95',
                            getEventTypeClasses(event, compact),
                            event.type === 'tarefa' && 'border-blue-400 dark:border-blue-600',
                            event.type === 'lembrete' && 'border-amber-400 dark:border-amber-600',
                            event.type === 'pessoal' && 'border-emerald-400 dark:border-emerald-600',
                            event.type === 'conteudo' && 'border-purple-400 dark:border-purple-600',
                            event.status === 'concluido' && 'grayscale-[0.3]',
                          )}
                          style={displayStyle}
                          title={
                            canDrag
                              ? 'Segure e arraste para alterar o horário, ou clique para editar'
                              : 'Clique para editar'
                          }
                        >
                          <div className="flex justify-between items-start gap-0.5 mb-0.5">
                            <div
                              className={cn(
                                'font-bold leading-tight',
                                compact
                                  ? zoomScale >= 1.2
                                    ? 'line-clamp-3 text-[9px]'
                                    : 'line-clamp-2 text-[8px]'
                                  : 'line-clamp-2 text-xs',
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
                            {!compact && (
                              <Badge
                                variant="outline"
                                className="text-[9px] shrink-0 bg-white/50 dark:bg-black/20"
                              >
                                {event.type}
                              </Badge>
                            )}
                          </div>
                          {!compact && (
                            <div
                              className={cn(
                                'opacity-90 flex items-center gap-0.5',
                                'text-[10px]',
                              )}
                            >
                              <Clock className="shrink-0 h-3 w-3" />
                              {isDragging && dragState
                                ? format(dragState.previewStart, 'HH:mm')
                                : format(event.start, 'HH:mm')}
                              {` - ${format(event.end, 'HH:mm')}`}
                            </div>
                          )}
                          {event.description && heightPx > (compact ? 32 * zoomScale : 72) && (
                            <div
                              className={cn(
                                'line-clamp-1 opacity-80 border-t pt-0.5 mt-0.5',
                                compact ? 'text-[8px]' : 'text-[10px]',
                              )}
                            >
                              {event.description}
                            </div>
                          )}
                        </div>
                      </AgendaEventHoverPreview>
                    </div>
                  );
                })}
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
            <div className="flex items-center justify-between gap-0.5 bg-muted/20 p-0.5 rounded-md">
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

      {canDrag && !compact && (
        <p className="px-4 pt-2 text-[10px] text-muted-foreground border-t">
          Segure e arraste os cards para cima ou para baixo nas visões Dia ou Semana para alterar o horário (intervalos de 15 min).
          {isRescheduling && ' Salvando...'}
        </p>
      )}

      {compact && canDrag && isRescheduling && (
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
    </div>
  );
}
