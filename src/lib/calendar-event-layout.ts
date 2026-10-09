/** Intervalo com início e fim para posicionamento no calendário. */
export interface CalendarTimeRange {
  start: Date;
  end: Date;
  /**
   * Sem horário marcado (faixa no topo).
   * Preferir este flag: 00:00 com hora explícita NÃO é “sem horário”.
   */
  untimed?: boolean;
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
/**
 * No painel flutuante: vira lista se tiver **mais** deste nº de tarefas
 * consecutivas na mesma faixa (1 → lista a partir de 2 tarefas juntas).
 */
export const EVENT_COMPACT_STACK_THRESHOLD = 1;
/** Janela de tempo da “faixa de horário” no painel (1 hora). */
export const EVENT_COMPACT_STACK_WINDOW_MS = 60 * 60 * 1000;
/** Altura de cada chip na lista empilhada “cheia” (px) — popup / modo amplo. */
export const EVENT_STACK_CHIP_HEIGHT_PX = 22;
/**
 * Altura de cada linha no preview da caixa fechada (px).
 * Mantém texto legível; a caixa cresce para mostrar todas (rola só se passar do teto).
 */
export const EVENT_STACK_PEEK_CHIP_HEIGHT_PX = 22;
/**
 * Teto da área de lista no preview (px), além do cabeçalho.
 * ~20 linhas legíveis; listas maiores (ex.: 44) rolam por dentro.
 */
export const EVENT_STACK_MAX_HEIGHT_PX = 520;
/** Cabeçalho da caixa de preview (compact / página). */
export const EVENT_STACK_PEEK_CHROME_COMPACT_PX = 28;
export const EVENT_STACK_PEEK_CHROME_PX = 32;
export const EVENT_STACK_PEEK_LIST_PAD_PX = 8;
export const EVENT_STACK_PEEK_ROW_GAP_PX = 2;
/** Altura natural da caixa de preview (sem clamp pelo fim do dia). */
export function getStackPeekNaturalHeightPx(
  eventCount: number,
  chipHeightPx: number,
  compact?: boolean,
): number {
  const chromePx = compact
    ? EVENT_STACK_PEEK_CHROME_COMPACT_PX
    : EVENT_STACK_PEEK_CHROME_PX;
  const listContentPx =
    Math.max(eventCount, 1) * chipHeightPx +
    Math.max(eventCount - 1, 0) * EVENT_STACK_PEEK_ROW_GAP_PX;
  return Math.min(
    chromePx + EVENT_STACK_PEEK_LIST_PAD_PX + listContentPx,
    EVENT_STACK_MAX_HEIGHT_PX + chromePx,
  );
}

/** Altura em px da caixa de preview (mesma conta do AgendaHourClusterBox). */
export function getStackPeekBoxHeightPx(params: {
  eventCount: number;
  chipHeightPx: number;
  compact?: boolean;
  /** Altura total do dia (px). Se omitido, usa só a altura natural. */
  dayHeightPx?: number;
  clusterStart?: Date;
  layoutTopPx?: number;
  minTimeSpanPx?: number;
}): number {
  const naturalHeight = getStackPeekNaturalHeightPx(
    params.eventCount,
    params.chipHeightPx,
    params.compact,
  );
  if (params.dayHeightPx == null || params.layoutTopPx == null) {
    return naturalHeight;
  }
  const remainingInDayPx = Math.max(
    params.dayHeightPx - params.layoutTopPx,
    params.minTimeSpanPx ?? EVENT_STACK_CHIP_HEIGHT_PX,
  );
  return Math.min(naturalHeight, remainingInDayPx);
}

/** Horas do dia (0–23) cobertas por pelo menos uma tarefa com horário. */
export function getOccupiedHours(events: CalendarTimeRange[]): Set<number> {
  const occupied = new Set<number>();
  for (const event of events) {
    const startHour = Math.min(23, Math.max(0, event.start.getHours()));
    const sameDay = event.end.toDateString() === event.start.toDateString();
    const lastInstant = new Date(Math.max(event.end.getTime() - 1, event.start.getTime()));
    const endHour = sameDay ? Math.min(23, lastInstant.getHours()) : 23;
    for (let hour = startHour; hour <= Math.max(startHour, endHour); hour += 1) {
      occupied.add(hour);
    }
  }
  return occupied;
}

/**
 * Expande a faixa de cada hora que tem lista empilhada, para a lista
 * caber no horário certo e as outras tarefas continuarem alinhadas ao relógio.
 */
export function buildExpandedHourHeights(params: {
  baseHourHeight: number;
  stacks: { start: Date; eventCount: number }[];
  chipHeightPx: number;
  compact?: boolean;
  /** Horas (0–23) com alguma tarefa; as demais encolhem para `emptyHourHeightPx`. */
  occupiedHours?: ReadonlySet<number>;
  emptyHourHeightPx?: number;
}): number[] {
  const { occupiedHours, emptyHourHeightPx } = params;
  const shouldCollapseEmpty = occupiedHours != null && emptyHourHeightPx != null;
  const heights = Array.from({ length: 24 }, (_, hour) =>
    shouldCollapseEmpty && !occupiedHours.has(hour)
      ? Math.min(emptyHourHeightPx, params.baseHourHeight)
      : params.baseHourHeight,
  );
  for (const stack of params.stacks) {
    const hour = Math.min(23, Math.max(0, stack.start.getHours()));
    const frac = Math.min(0.95, Math.max(0, stack.start.getMinutes() / 60));
    const boxH = getStackPeekNaturalHeightPx(
      stack.eventCount,
      params.chipHeightPx,
      params.compact,
    );
    /**
     * Trecho antes do início da lista mantém a escala normal (ver
     * `getStackTopPxForDate`); só o espaço da lista é acrescentado.
     */
    const needed = frac * params.baseHourHeight + boxH;
    heights[hour] = Math.max(heights[hour], needed);
  }
  return heights;
}

/**
 * Topo da lista empilhada: os minutos antes do início usam a altura normal da
 * hora, e não a altura expandida — evita um vão vazio acima da lista.
 */
export function getStackTopPxForDate(
  date: Date,
  hourHeights: number[],
  baseHourHeight: number,
): number {
  const hour = Math.min(23, Math.max(0, date.getHours()));
  const frac = Math.min(0.95, Math.max(0, date.getMinutes() / 60));
  let top = 0;
  for (let i = 0; i < hour; i += 1) {
    top += hourHeights[i] ?? 0;
  }
  const hourHeight = hourHeights[hour] ?? baseHourHeight;
  return top + frac * Math.min(hourHeight, baseHourHeight);
}

/** Topo (px) de um instante na grade com alturas de hora variáveis. */
export function getTopPxForDate(date: Date, hourHeights: number[]): number {
  const hour = Math.min(23, Math.max(0, date.getHours()));
  const frac = date.getMinutes() / 60 + date.getSeconds() / 3600;
  let top = 0;
  for (let i = 0; i < hour; i += 1) {
    top += hourHeights[i] ?? 0;
  }
  top += frac * (hourHeights[hour] ?? 0);
  return top;
}

export function getDayHeightFromHourHeights(hourHeights: number[]): number {
  return hourHeights.reduce((sum, h) => sum + h, 0);
}

/**
 * Tarefas sem hora ficam à meia-noite com duração de 1h — mas 00:00
 * com horário explícito deve aparecer na grade (não na faixa “Sem horário”).
 */
export function isUntimedCalendarBlock(event: CalendarTimeRange): boolean {
  if (event.untimed === true) return true;
  if (event.untimed === false) return false;
  /** Fallback legado para eventos sem o flag. */
  return (
    event.start.getHours() === 0 &&
    event.start.getMinutes() === 0 &&
    event.end.getTime() - event.start.getTime() === 60 * 60 * 1000
  );
}

/** Altura total da grade de um dia (00:00 → 24:00). */
export function getDayGridHeightPx(hourHeight: number, hourCount = 24): number {
  return hourCount * hourHeight;
}

/**
 * Garante que um bloco absoluto caiba dentro do dia.
 * Perto de 23h/24h, empurra o bloco para cima em vez de cortar com overflow.
 */
export function clampTopWithinDay(
  topPx: number,
  heightPx: number,
  dayHeightPx: number,
): number {
  if (dayHeightPx <= 0) return Math.max(0, topPx);
  const safeHeight = Math.min(Math.max(heightPx, 0), dayHeightPx);
  const maxTop = Math.max(0, dayHeightPx - safeHeight);
  return Math.min(Math.max(0, topPx), maxTop);
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

/**
 * Agrupa eventos que se sobrepõem no tempo.
 * Se `windowMs` for informado, não “puxa” para o mesmo grupo tarefas que
 * começam depois dessa janela a partir do início do grupo (ex.: 1 hora).
 * Assim a caixa “09:15 · N tarefas” não mistura a tarde inteira.
 */
function getOverlapClusters<T extends CalendarTimeRange>(
  events: T[],
  windowMs?: number,
): T[][] {
  if (events.length === 0) return [];

  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  const clusters: T[][] = [];
  let current: T[] = [sorted[0]];
  let clusterStart = sorted[0].start.getTime();
  let clusterEnd = sorted[0].end.getTime();

  for (let i = 1; i < sorted.length; i++) {
    const event = sorted[i];
    const startMs = event.start.getTime();
    const overlaps = startMs < clusterEnd;
    const withinWindow =
      windowMs == null || startMs < clusterStart + windowMs;

    if (overlaps && withinWindow) {
      current.push(event);
      clusterEnd = Math.max(clusterEnd, event.end.getTime());
    } else {
      clusters.push(current);
      current = [event];
      clusterStart = startMs;
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
  /**
   * Se definido, o grupo só inclui tarefas que começam dentro desta
   * janela a partir do início do cluster (painel: 1 hora).
   */
  stackWindowMs?: number;
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
  const stackWindowMs = options?.stackWindowMs;

  return getOverlapClusters(events, stackWindowMs).map((cluster) => {
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
      /** Na lista, a caixa ocupa só a faixa (ex.: 1h) — não o fim real de cada tarefa. */
      const stackEnd =
        stackWindowMs != null
          ? new Date(Math.min(end.getTime(), start.getTime() + stackWindowMs))
          : end;
      return {
        start,
        end: stackEnd,
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

/** Altura vertical (px) que o cluster ocupa na grade, a partir do início/fim no tempo. */
export function getClusterTimeSpanPx(
  clusterStart: Date,
  clusterEnd: Date,
  hourHeight: number,
  minHeightPx: number,
): number {
  const durationMs = clusterEnd.getTime() - clusterStart.getTime();
  const durationHours = Math.max(durationMs / (1000 * 60 * 60), 0);
  /** Não conta tempo que “passa” da meia-noite — a grade do dia termina às 24:00. */
  const startHour = clusterStart.getHours() + clusterStart.getMinutes() / 60;
  const remainingHours = Math.max(24 - startHour, 0);
  const cappedHours = Math.min(durationHours, remainingHours);
  return Math.max(cappedHours * hourHeight, minHeightPx);
}

/** Caixa da lista empilhada (todas as tarefas do grupo, com scroll se precisar). */
export function getStackClusterStyle(
  clusterStart: Date,
  hourHeight: number,
  eventCount: number,
  chipHeightPx = EVENT_STACK_CHIP_HEIGHT_PX,
  maxHeightPx = EVENT_STACK_MAX_HEIGHT_PX,
  boxHeightPx?: number,
): { top: string; height: string; left: string; width: string } {
  const startHour = clusterStart.getHours() + clusterStart.getMinutes() / 60;
  const contentHeight = Math.max(eventCount, 1) * chipHeightPx;
  const height = boxHeightPx ?? Math.min(contentHeight, maxHeightPx);
  const dayHeightPx = getDayGridHeightPx(hourHeight);
  const rawTop = startHour * hourHeight;
  const top = clampTopWithinDay(rawTop, height, dayHeightPx);
  return {
    top: `${top}px`,
    height: `${height}px`,
    left: `${EVENT_SIDE_INSET_PERCENT}%`,
    width: `${100 - EVENT_SIDE_INSET_PERCENT - EVENT_RIGHT_GUTTER_PERCENT}%`,
  };
}
