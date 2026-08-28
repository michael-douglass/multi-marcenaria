/** Opções de família de fonte para texto na lousa (valor CSS font-family). */
export const WHITEBOARD_FONT_OPTIONS = [
  { value: 'Inter, ui-sans-serif, system-ui, sans-serif', label: 'Inter (padrão)' },
  { value: 'Arial, Helvetica, sans-serif', label: 'Arial' },
  { value: 'Verdana, Geneva, sans-serif', label: 'Verdana' },
  { value: 'Georgia, "Times New Roman", serif', label: 'Serifada (Georgia)' },
  { value: '"Courier New", Courier, monospace', label: 'Monoespaçada' },
  { value: '"Segoe UI", Tahoma, sans-serif', label: 'Segoe UI' },
] as const;

export const WHITEBOARD_FONT_SIZE_MIN = 8;
export const WHITEBOARD_FONT_SIZE_MAX = 72;

export const WHITEBOARD_TEXT_CONFIG_DEFAULTS = {
  fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  fontSizePx: 16,
  textColorHex: '#111827',
} as const;
