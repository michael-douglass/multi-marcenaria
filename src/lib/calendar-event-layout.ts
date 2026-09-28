/** Intervalo com início e fim para posicionamento no calendário. */
export interface CalendarTimeRange {
  start: Date;
  end: Date;
}

export interface LayoutedCalendarEvent<T> {
  event: T;
  column: number;
  totalColumns: number;
}

/** Resultado por grupo de eventos que se sobrepõem no tempo. */
export interface TimedClusterLayout<T> {
  start: Date;
  end: Date;
  /** Eventos visíveis em colunas (sem os que vão para overflow). */
  layouted: LayoutedCalendarEvent<T>[];
  /** Eventos que não cabem nas colunas — lista/popover. */
  overflow: T[];
  /** Todos os eventos do grupo (ordem por início). */
  allEvents: T[];
  /**
   * true = empilhar em lista vertical (painel estreito / muitos itens).
   * false = colunas lado a lado + chip “+N” se houver overflow.
   */
  useStack: boolean;
}

/** Espaço interno da grade: evita tarefas coladas nas bordas da agenda. */
const EVENT_SIDE_INSET_PERCENT = 1.5;
/** Faixa à direita para clicar em horário vazio (estilo Google Calendar). */
const EVENT_RIGHT_GUTTER_PERCENT = 6;
const EVENT_COLUMN_GAP_PERCENT = 1;

/** Colunas lado a lado no calendário “cheio” antes de ir para “+N mais”. */
export const EVENT_MAX_SIDE_BY_SIDE_COLUMNS = 5;
/** No painel flutuante, acima disso vira lista vertical com todas as tarefas. */
export const EVENT_COMPACT_STACK_THRESHOLD = 3;
/** Altura de cada chip na lista empilhada (px). */
export const EVENT_STACK_CHIP_HEIGHT_PX = 22;
/** Altura máxima da caixa rolável de um grupo empilhado (px). */
export const EVENT_STACK_MAX_HEIGHT_PX = 220;

/** Tarefas criadas sem hora ficam à meia-noite com duração padrão de 1h. */
export function isUntimedCalendarBlock(event: CalendarTimeRange): boolean {
  return (
    event.start.getHours() === 0 &&
    event.start.getMinutes() === 0 &&
    event.end.getTime() - event.start.getTime() === 60 * 60 * 1000
  );
}

export function partitionTimedUntimedEvents<T extends CalendarTimeRange>(
  events: T[],
): { timed: T[]; untimed: T[] } {
  const timed: T[] = [];
  const untimed: T[] = [];
  for (const event of events) {
    if (isUntimedCalendarBlock(event)) {
      untimed.push(event);
    } else {
      timed.push(event);
    }
  }
  return { timed, untimed };
}

function getOverlapClusters<T extends CalendarTimeRange>(events: T[]): T[][] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const clusters: T[][] = [];
  let current: T[] = [sorted[0]];
  let clusterEnd = sorted[0].end.getTime();

  for (let i = 1; i < sorted.length; i++) {
    const event = sorted[i];
    if (event.start.getTime() < clusterEnd) {
      current.push(event);
      clusterEnd = Math.max(clusterEnd, event.end.getTime());
    } else {
      clusters.push(current);
      current = [event];
      clusterEnd = event.end.getTime();
    }
  }
  clusters.push(current);
  return clusters;
}

function assignColumnsInCluster<T extends CalendarTimeRange>(
  cluster: T[],
): LayoutedCalendarEvent<T>[] {
  const sorted = [...cluster].sort((a, b) => a.start.getTime() - b.start.getTime());
  const columnEnds: number[] = [];
  const placements: { event: T; column: number }[] = [];

  for (const event of sorted) {
    const startMs = event.start.getTime();
    let column = columnEnds.findIndex((end) => startMs >= end);
    if (column === -1) {
      column = columnEnds.length;
      columnEnds.push(event.end.getTime());
    } else {
      columnEnds[column] = event.end.getTime();
    }
    placements.push({ event, column });
  }

  const totalColumns = Math.max(1, columnEnds.length);
  return placements.map(({ event, column }) => ({
    event,
    column,
    totalColumns,
  }));
}

/** Distribui eventos sobrepostos em colunas lado a lado (estilo Google Calendar). */
export function layoutOverlappingEvents<T extends CalendarTimeRange>(
  events: T[],
): LayoutedCalendarEvent<T>[] {
  return getOverlapClusters(events).flatMap(assignColumnsInCluster);
}

export interface LayoutTimedClustersOptions {
  /** Acima deste nº de itens no grupo → lista vertical com todas. */
  stackThreshold?: number;
  /** Máximo de colunas lado a lado; o resto vai para overflow (+N). */
  maxSideBySideColumns?: number;
}

/**
 * Agrupa eventos sobrepostos e decide: colunas, lista empilhada ou colunas + overflow.
 * Garante que nenhuma tarefa fique escondida atrás de outra.
 */
export function layoutTimedClusters<T extends CalendarTimeRange>(
  events: T[],
  options?: LayoutTimedClustersOptions,
): TimedClusterLayout<T>[] {
  const stackThreshold = options?.stackThreshold ?? EVENT_COMPACT_STACK_THRESHOLD;
  const maxSideBySide =
    options?.maxSideBySideColumns ?? EVENT_MAX_SIDE_BY_SIDE_COLUMNS;

  return getOverlapClusters(events).map((cluster) => {
    const sorted = [...cluster].sort((a, b) => a.start.getTime() - b.start.getTime());
    const start = sorted.reduce(
      (min, e) => (e.start.getTime() < min.getTime() ? e.start : min),
      sorted[0].start,
    );
    const end = sorted.reduce(
      (max, e) => (e.end.getTime() > max.getTime() ? e.end : max),
      sorted[0].end,
    );

    const useStack = sorted.length > stackThreshold;

    if (useStack) {
      return {
        start,
        end,
        layouted: [],
        overflow: [],
        allEvents: sorted,
        useStack: true,
      };
    }

    const allLayouted = assignColumnsInCluster(sorted);
    const visibleColumnCount = Math.min(
      allLayouted[0]?.totalColumns ?? 1,
      maxSideBySide,
    );

    const layouted: LayoutedCalendarEvent<T>[] = [];
    const overflow: T[] = [];
    const usedOverflow = new Set<T>();

    for (const item of allLayouted) {
      if (item.column < visibleColumnCount) {
        layouted.push({
          ...item,
          totalColumns: visibleColumnCount,
        });
      } else if (!usedOverflow.has(item.event)) {
        overflow.push(item.event);
        usedOverflow.add(item.event);
      }
    }

    return {
      start,
      end,
      layouted,
      overflow,
      allEvents: sorted,
      useStack: false,
    };
  });
}

/**
 * Posição horizontal da tarefa dentro da grade do dia.
 * Sempre respeita margem esquerda/direita — nunca cola nas bordas nem ultrapassa 100%.
 * `totalColumns` já deve ser o nº de colunas visíveis (sem esconder extras).
 */
export function getEventColumnStyle(column: number, totalColumns: number): {
  left: string;
  width: string;
} {
  const cols = Math.max(1, totalColumns);
  const col = Math.max(0, Math.min(column, cols - 1));

  const usable = 100 - EVENT_SIDE_INSET_PERCENT - EVENT_RIGHT_GUTTER_PERCENT;
  const gapTotal = EVENT_COLUMN_GAP_PERCENT * (cols - 1);
  const width = Math.max((usable - gapTotal) / cols, 2);
  const left = EVENT_SIDE_INSET_PERCENT + col * (width + EVENT_COLUMN_GAP_PERCENT);
  const maxLeft = Math.max(EVENT_SIDE_INSET_PERCENT, 100 - EVENT_RIGHT_GUTTER_PERCENT - width);
  const safeLeft = Math.min(Math.max(left, EVENT_SIDE_INSET_PERCENT), maxLeft);

  return {
    left: `${safeLeft}%`,
    width: `${width}%`,
  };
}

/** Caixa da lista empilhada (todas as tarefas do grupo, com scroll se precisar). */
export function getStackClusterStyle(
  clusterStart: Date,
  hourHeight: number,
  eventCount: number,
  chipHeightPx = EVENT_STACK_CHIP_HEIGHT_PX,
  maxHeightPx = EVENT_STACK_MAX_HEIGHT_PX,
): { top: string; height: string; left: string; width: string } {
  const startHour = clusterStart.getHours() + clusterStart.getMinutes() / 60;
  const contentHeight = Math.max(eventCount, 1) * chipHeightPx;
  const height = Math.min(contentHeight, maxHeightPx);
  return {
    top: `${startHour * hourHeight}px`,
    height: `${height}px`,
    left: `${EVENT_SIDE_INSET_PERCENT}%`,
    width: `${100 - EVENT_SIDE_INSET_PERCENT - EVENT_RIGHT_GUTTER_PERCENT}%`,
  };
}
