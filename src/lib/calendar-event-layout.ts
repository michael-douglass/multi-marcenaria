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

export function getEventColumnStyle(column: number, totalColumns: number): {
  left: string;
  width: string;
} {
  const gap = 1.5;
  const width = (100 - gap * (totalColumns - 1)) / totalColumns;
  const left = column * (width + gap);
  return {
    left: `${left}%`,
    width: `${width}%`,
  };
}
