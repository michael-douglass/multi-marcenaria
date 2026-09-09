import type { AgendaEvent } from '@/hooks/useAgendaGeral';

/** Paleta curada da agenda (tom madeireira / ouro Garbo + contraste útil). */
export const AGENDA_COLOR_PRESETS = [
  '#3b82f6', // reunião (azul)
  '#f59e0b', // lead (âmbar)
  '#10b981', // pessoal (esmeralda)
  '#a855f7', // marketing (roxo)
  '#f2d892', // ouro Garbo
  '#2a1812', // mogno
  '#fb923c', // laranja
  '#f472b6', // rosa
  '#82d2ff', // céu
  '#ef4444', // vermelho
  '#14b8a6', // teal
  '#64748b', // ardósia
] as const;

export const AGENDA_TYPE_DEFAULT_HEX: Record<AgendaEvent['type'], string> = {
  tarefa: '#3b82f6',
  lembrete: '#f59e0b',
  pessoal: '#10b981',
  conteudo: '#a855f7',
};

const HEX_RE = /^#([0-9a-fA-F]{6})$/;

export function normalizeAgendaColor(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!HEX_RE.test(trimmed)) return null;
  return trimmed.toLowerCase();
}

/** Converte hex em RGB 0–255. */
export function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = normalizeAgendaColor(hex);
  if (!normalized) return null;
  const n = parseInt(normalized.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function mixWithWhite(hex: string, amount: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#ffffff';
  const t = Math.min(1, Math.max(0, amount));
  const r = Math.round(rgb.r + (255 - rgb.r) * t);
  const g = Math.round(rgb.g + (255 - rgb.g) * t);
  const b = Math.round(rgb.b + (255 - rgb.b) * t);
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`;
}

function relativeLuminance(hex: string): number {
  const rgb = hexToRgb(hex);
  if (!rgb) return 1;
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(rgb.r) + 0.7152 * channel(rgb.g) + 0.0722 * channel(rgb.b);
}

/** Texto escuro em fundos claros; claro em fundos escuros. */
export function agendaColorContrastText(hex: string): string {
  return relativeLuminance(hex) > 0.55 ? '#1c1410' : '#fff8ee';
}

export function resolveAgendaEventColor(event: Pick<AgendaEvent, 'type' | 'color'>): string {
  return normalizeAgendaColor(event.color) ?? AGENDA_TYPE_DEFAULT_HEX[event.type];
}

export interface AgendaEventColorStyle {
  backgroundColor: string;
  borderColor: string;
  color: string;
  boxShadow?: string;
}

/** Estilo inline do chip no calendário quando há cor (custom ou padrão do tipo). */
export function getAgendaEventChipStyle(
  event: Pick<AgendaEvent, 'type' | 'color' | 'status'>,
): AgendaEventColorStyle {
  const base = resolveAgendaEventColor(event);
  const hasCustom = Boolean(normalizeAgendaColor(event.color));
  const backgroundColor = hasCustom ? mixWithWhite(base, 0.82) : mixWithWhite(base, 0.88);
  const borderColor = mixWithWhite(base, 0.35);
  const color = hasCustom ? agendaColorContrastText(backgroundColor) : base;

  return {
    backgroundColor,
    borderColor,
    color,
    boxShadow: hasCustom ? `inset 3px 0 0 ${base}` : undefined,
  };
}

export function getAgendaEventDotColor(event: Pick<AgendaEvent, 'type' | 'color'>): string {
  return resolveAgendaEventColor(event);
}
