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

/** Espaço interno da grade: evita tarefas coladas nas bordas da agenda. */
const EVENT_SIDE_INSET_PERCENT = 1.5;
/** Faixa à direita para clicar em horário vazio (estilo Google Calendar). */
const EVENT_RIGHT_GUTTER_PERCENT = 6;
const EVENT_COLUMN_GAP_PERCENT = 1;
/**
 * Com muitas tarefas no mesmo horário, limita colunas para não virar
 * “fio de cabelo” sem largura útil — as extras se empilham com z-index.
 */
const EVENT_MAX_VISIBLE_COLUMNS = 5;

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

/**
 * Posição horizontal da tarefa dentro da grade do dia.
 * Sempre respeita margem esquerda/direita — nunca cola nas bordas nem ultrapassa 100%.
 */
export function getEventColumnStyle(column: number, totalColumns: number): {
  left: string;
  width: string;
} {
  const requested = Math.max(1, totalColumns);
  const cols = Math.min(requested, EVENT_MAX_VISIBLE_COLUMNS);
  const col =
    requested <= EVENT_MAX_VISIBLE_COLUMNS
      ? Math.max(0, Math.min(column, cols - 1))
      : Math.min(
          cols - 1,
          Math.floor((Math.max(0, column) / requested) * cols),
        );

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
