/**
 * Tokens visuais Corte Claude (hub Orçamentos IA).
 * Accent de auditoria #0066FF — sem tema purple genérico.
 */
export const CORTE_CLAUDE_TOKENS = {
  accent: '#0066FF',
  accentHover: '#0052cc',
  ink: '#0f1419',
  inkSoft: '#2a3340',
  muted: '#5c6570',
  paper: '#eef1f4',
  paperWarm: '#f4f1ec',
  walnut: '#3d2a1f',
  walnutSoft: '#6b5244',
  card: '#ffffff',
  blueprintGrid: 'rgba(0, 102, 255, 0.12)',
} as const

export const CORTE_CLAUDE_CSS_VARS = {
  '--cc-accent': CORTE_CLAUDE_TOKENS.accent,
  '--cc-ink': CORTE_CLAUDE_TOKENS.ink,
  '--cc-muted': CORTE_CLAUDE_TOKENS.muted,
  '--cc-paper': CORTE_CLAUDE_TOKENS.paper,
  '--cc-walnut': CORTE_CLAUDE_TOKENS.walnut,
  '--cc-card': CORTE_CLAUDE_TOKENS.card,
  '--oi-accent': CORTE_CLAUDE_TOKENS.accent,
  '--oi-ink': CORTE_CLAUDE_TOKENS.ink,
  '--oi-muted': CORTE_CLAUDE_TOKENS.muted,
  '--oi-bg': CORTE_CLAUDE_TOKENS.paper,
  '--oi-card': CORTE_CLAUDE_TOKENS.card,
} as const

/** Lista de hex/classe proibidos no módulo (smoke E3). */
export const FORBIDDEN_PURPLE_MARKERS = [
  '#7c3aed',
  '#8b5cf6',
  '#a855f7',
  'purple-',
  'violet-',
  'indigo-500',
  'from-purple',
  'to-indigo',
] as const
