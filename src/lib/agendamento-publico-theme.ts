/** Tokens visuais da página pública de agendamento (contraste + sombras). */

export const AGENDAMENTO_PUBLIC = {
  ink: '#1a100c',
  inkSoft: '#2a1812',
  body: '#4a3228',
  hint: '#5c4034',
  accent: '#c45c26',
  accentHover: '#a84a1e',
  accentGlow: 'rgba(196,92,38,0.35)',
  border: '#c9b8a8',
  borderStrong: '#b8a090',
  cardFrom: '#fffaf6',
  cardTo: '#f3e8dc',
} as const;

export const PUBLIC_STEP_HEADER =
  'mb-6 pb-4 border-b border-[#dccbc0]/90 shadow-[0_6px_16px_-12px_rgba(26,16,12,0.35)]';

export const PUBLIC_STEP_TITLE =
  'flex items-center gap-2 text-lg font-bold text-[#1a100c] [text-shadow:0_1px_0_rgba(255,255,255,0.75)]';

export const PUBLIC_STEP_DESC =
  'text-sm text-[#4a3228] mt-1.5 font-medium [text-shadow:0_1px_0_rgba(255,255,255,0.45)]';

export const PUBLIC_FORM_GROUP =
  'rounded-xl border border-[#a89080] bg-white p-4 shadow-[0_2px_10px_rgba(26,16,12,0.09),0_1px_0_rgba(255,255,255,0.95)_inset] space-y-2.5 transition-shadow hover:shadow-[0_4px_16px_rgba(26,16,12,0.11)]';

export const PUBLIC_FORM_LABEL =
  'text-[#1a100c] font-bold text-sm tracking-tight';

export const PUBLIC_FORM_HINT = 'text-xs text-[#3d2820] font-medium leading-relaxed';

export const PUBLIC_FORM_FIELD =
  'agendamento-public-field rounded-lg border-[#8a7060] bg-white text-[#1a100c] font-semibold placeholder:text-[#4a3228] placeholder:font-medium shadow-[inset_0_1px_3px_rgba(26,16,12,0.08),0_2px_8px_rgba(26,16,12,0.06)] focus-visible:outline-none focus-visible:ring-offset-0 focus-visible:border-[#c45c26] focus-visible:ring-2 focus-visible:ring-[#c45c26]/35 focus-visible:shadow-[0_0_0_3px_rgba(196,92,38,0.25),0_4px_14px_rgba(26,16,12,0.12)] caret-[#c45c26] transition-shadow';

export const PUBLIC_OPTION_CARD =
  'flex items-center gap-3 rounded-lg border px-3 py-2.5 cursor-pointer transition-all border-[#c9b8a8]/90 bg-white shadow-[0_1px_4px_rgba(26,16,12,0.06)] hover:border-[#c45c26]/40 hover:shadow-[0_3px_10px_rgba(26,16,12,0.08)]';

export const PUBLIC_OPTION_CARD_SELECTED =
  'border-[#c45c26]/70 bg-[#fff7f2] ring-1 ring-[#c45c26]/25 shadow-[0_4px_14px_rgba(196,92,38,0.15)]';

export const PUBLIC_FILE_ZONE =
  'rounded-xl border border-dashed border-[#8a7060] bg-white p-4 space-y-3 shadow-[inset_0_2px_6px_rgba(26,16,12,0.05),0_2px_8px_rgba(26,16,12,0.06)]';

export const PUBLIC_FILE_ITEM =
  'flex items-center justify-between gap-2 rounded-lg border border-[#c9b8a8]/80 bg-white px-2.5 py-2 text-xs text-[#1a100c] shadow-[0_1px_4px_rgba(26,16,12,0.06)]';

export const PUBLIC_PRIMARY_BTN =
  'w-full h-11 rounded-xl bg-[#c45c26] hover:bg-[#a84a1e] text-white font-semibold shadow-[0_4px_16px_rgba(196,92,38,0.38),0_2px_4px_rgba(26,16,12,0.12)] hover:shadow-[0_6px_22px_rgba(196,92,38,0.45)] transition-all';

export const PUBLIC_DATE_BTN =
  'p-3 rounded-xl border border-[#c9b8a8]/90 bg-white text-center transition-all shadow-[0_2px_8px_rgba(26,16,12,0.07)]';

export const PUBLIC_DATE_BTN_SELECTED =
  'border-[#c45c26] bg-[#fff7f2] ring-2 ring-[#c45c26]/35 shadow-[0_6px_18px_rgba(196,92,38,0.22)]';

export const PUBLIC_TIME_BTN =
  'p-3 rounded-xl border border-[#c9b8a8]/90 bg-white text-center font-semibold transition-all shadow-[0_2px_8px_rgba(26,16,12,0.07)] text-[#1a100c]';

export const PUBLIC_TIME_BTN_SELECTED =
  'border-[#c45c26] bg-[#c45c26] text-white shadow-[0_6px_18px_rgba(196,92,38,0.35)]';
