export interface KanbanStageSkin {
  key: string
  header: string
  column: string
  card: string
  rail: string
}

const SKINS: KanbanStageSkin[] = [
  {
    key: 'emerald',
    header: 'bg-emerald-500/15 text-emerald-100 border-emerald-400/45',
    column:
      'border-emerald-400/30 shadow-[0_3px_8px_rgba(16,185,129,0.07)]',
    card:
      'text-cream border-emerald-400/30 bg-gradient-to-br from-emerald-950/70 via-[#140c08]/92 to-[#0a0402]/95 shadow-[0_2px_6px_rgba(0,0,0,0.18)]',
    rail: 'bg-emerald-400',
  },
  {
    key: 'sky',
    header: 'bg-sky-500/15 text-sky-100 border-sky-400/45',
    column:
      'border-sky-400/30 shadow-[0_3px_8px_rgba(56,189,248,0.07)]',
    card:
      'text-cream border-sky-400/30 bg-gradient-to-br from-sky-950/70 via-[#140c08]/92 to-[#0a0402]/95 shadow-[0_2px_6px_rgba(0,0,0,0.18)]',
    rail: 'bg-sky-400',
  },
  {
    key: 'teal',
    header: 'bg-teal-500/15 text-teal-100 border-teal-400/45',
    column:
      'border-teal-400/30 shadow-[0_3px_8px_rgba(45,212,191,0.07)]',
    card:
      'text-cream border-teal-400/30 bg-gradient-to-br from-teal-950/70 via-[#140c08]/92 to-[#0a0402]/95 shadow-[0_2px_6px_rgba(0,0,0,0.18)]',
    rail: 'bg-teal-400',
  },
  {
    key: 'amber',
    header: 'bg-amber-500/15 text-amber-100 border-amber-400/45',
    column:
      'border-amber-400/30 shadow-[0_3px_8px_rgba(251,191,36,0.07)]',
    card:
      'text-cream border-amber-400/30 bg-gradient-to-br from-amber-950/70 via-[#140c08]/92 to-[#0a0402]/95 shadow-[0_2px_6px_rgba(0,0,0,0.18)]',
    rail: 'bg-amber-400',
  },
  {
    key: 'gold',
    header: 'bg-gold/15 text-gold border-gold/45',
    column:
      'border-gold/30 shadow-[0_3px_8px_rgba(242,216,146,0.07)]',
    card:
      'text-cream border-gold/30 bg-gradient-to-br from-[#3a2a12]/80 via-[#140c08]/92 to-[#0a0402]/95 shadow-[0_2px_6px_rgba(0,0,0,0.18)]',
    rail: 'bg-gold',
  },
  {
    key: 'violet',
    header: 'bg-violet-500/15 text-violet-100 border-violet-400/45',
    column:
      'border-violet-400/30 shadow-[0_3px_8px_rgba(167,139,250,0.07)]',
    card:
      'text-cream border-violet-400/30 bg-gradient-to-br from-violet-950/70 via-[#140c08]/92 to-[#0a0402]/95 shadow-[0_2px_6px_rgba(0,0,0,0.18)]',
    rail: 'bg-violet-400',
  },
  {
    key: 'rose',
    header: 'bg-rose-500/15 text-rose-100 border-rose-400/45',
    column:
      'border-rose-400/30 shadow-[0_3px_8px_rgba(251,113,133,0.07)]',
    card:
      'text-cream border-rose-400/30 bg-gradient-to-br from-rose-950/70 via-[#140c08]/92 to-[#0a0402]/95 shadow-[0_2px_6px_rgba(0,0,0,0.18)]',
    rail: 'bg-rose-400',
  },
  {
    key: 'cyan',
    header: 'bg-cyan-500/15 text-cyan-100 border-cyan-400/45',
    column:
      'border-cyan-400/30 shadow-[0_3px_8px_rgba(34,211,238,0.07)]',
    card:
      'text-cream border-cyan-400/30 bg-gradient-to-br from-cyan-950/70 via-[#140c08]/92 to-[#0a0402]/95 shadow-[0_2px_6px_rgba(0,0,0,0.18)]',
    rail: 'bg-cyan-400',
  },
]

const TOKEN_INDEX: Record<string, number> = {
  primary: 0,
  success: 1,
  warning: 3,
  destructive: 6,
  secondary: 5,
  muted: 7,
}

function normalizeStage(status: string): string {
  return status
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/** Cor da coluna: token do cadastro, dica pelo nome, ou índice para nunca repetir lado a lado. */
export function kanbanStageSkin(
  status: string,
  colorToken?: string | null,
  columnIndex = 0,
): KanbanStageSkin {
  if (colorToken && TOKEN_INDEX[colorToken] != null) {
    return SKINS[TOKEN_INDEX[colorToken]]!
  }

  const name = normalizeStage(status)
  if (name.includes('novo')) return SKINS[0]!
  if (name.includes('visita') && name.includes('agend')) return SKINS[1]!
  if (name.includes('visita')) return SKINS[2]!
  if (name.includes('orcamento') || name.includes('orçamento')) return SKINS[3]!
  if (name.includes('precif')) return SKINS[4]!
  if (name.includes('envi')) return SKINS[5]!
  if (name.includes('perdid') || name.includes('nao matric')) return SKINS[6]!
  if (name.includes('cadastr')) return SKINS[7]!

  return SKINS[Math.abs(columnIndex) % SKINS.length]!
}
