/** Paleta e tipografia da apresentação para arquitetos. */
export const APRESENTACAO_THEME = {
  bgBase: '#0a0908',
  bgMogno: '#1a1612',
  gold: '#f2d892',
  goldHover: '#f5e0a8',
  goldMuted: 'rgba(242, 216, 146, 0.55)',
  wood: '#c4a882',
  textPrimary: '#fffaf4',
  textMuted: 'rgba(255, 250, 244, 0.78)',
  overlayDark: 'rgba(8, 6, 4, 0.72)',
  overlayHero: 'rgba(8, 6, 4, 0.55)',
  /** Overlay suave — deixa a foto aparecer mais (fechamento) */
  overlaySoft: 'linear-gradient(90deg, rgba(8,6,4,0.78) 0%, rgba(8,6,4,0.45) 45%, rgba(8,6,4,0.25) 100%)',
  fontDisplay: "'Cormorant Garamond', Georgia, serif",
  fontBody: "'DM Sans', system-ui, sans-serif",
  /**
   * Sombras de leitura sobre foto + cubos (Proposta).
   * Camadas: halo escuro apertado + blur largo + leve brilho dourado.
   */
  textShadowTitle:
    '0 1px 2px rgba(0,0,0,0.95), 0 4px 18px rgba(0,0,0,0.75), 0 12px 42px rgba(0,0,0,0.55), 0 0 28px rgba(8,6,4,0.45)',
  textShadowBody:
    '0 1px 2px rgba(0,0,0,0.9), 0 3px 14px rgba(0,0,0,0.7), 0 10px 32px rgba(0,0,0,0.5)',
  textShadowGold:
    '0 1px 2px rgba(0,0,0,0.95), 0 4px 16px rgba(0,0,0,0.7), 0 0 24px rgba(242,216,146,0.18)',
} as const;

export const APRESENTACAO_CSS_VARS = {
  '--bg': APRESENTACAO_THEME.bgBase,
  '--mogno': APRESENTACAO_THEME.bgMogno,
  '--gold': APRESENTACAO_THEME.gold,
  '--text': APRESENTACAO_THEME.textPrimary,
  '--font-display': APRESENTACAO_THEME.fontDisplay,
  '--font-body': APRESENTACAO_THEME.fontBody,
} as const;
