/**
 * Medidas padrão (mm) usadas quando a IA extrai peças/módulos sem cota impressa.
 * Evita dimensões zeradas (Zod) sem inventar 15×15 mm — valores típicos Planilha 4.0.
 */

export type CaixariaFunction =
  | 'base'
  | 'lateral'
  | 'divisoria'
  | 'prateleira'
  | 'fundo'
  | 'sarrafo'
  | 'tampo'
  | 'outro'

export type FrenteKind =
  | 'porta_giro'
  | 'porta_correr'
  | 'frente_gaveta'
  | 'frente_falsa'
  | 'basculante'
  | 'tamponamento'

type Mm = { width_mm: number; height_mm: number; thickness_mm: number }

const PIECE_DEFAULTS: Record<CaixariaFunction, Mm> = {
  base: { width_mm: 800, height_mm: 550, thickness_mm: 15 },
  lateral: { width_mm: 550, height_mm: 700, thickness_mm: 15 },
  divisoria: { width_mm: 530, height_mm: 700, thickness_mm: 15 },
  prateleira: { width_mm: 764, height_mm: 530, thickness_mm: 15 },
  fundo: { width_mm: 800, height_mm: 700, thickness_mm: 6 },
  sarrafo: { width_mm: 800, height_mm: 70, thickness_mm: 15 },
  tampo: { width_mm: 1200, height_mm: 600, thickness_mm: 15 },
  outro: { width_mm: 600, height_mm: 400, thickness_mm: 15 },
}

const FRENTE_DEFAULTS: Record<FrenteKind, Mm> = {
  porta_giro: { width_mm: 400, height_mm: 700, thickness_mm: 15 },
  porta_correr: { width_mm: 800, height_mm: 2200, thickness_mm: 15 },
  frente_gaveta: { width_mm: 400, height_mm: 180, thickness_mm: 15 },
  frente_falsa: { width_mm: 400, height_mm: 180, thickness_mm: 15 },
  basculante: { width_mm: 800, height_mm: 350, thickness_mm: 15 },
  tamponamento: { width_mm: 600, height_mm: 700, thickness_mm: 15 },
}

export function defaultPieceMm(fn: unknown): Mm {
  return PIECE_DEFAULTS[(fn as CaixariaFunction) in PIECE_DEFAULTS ? (fn as CaixariaFunction) : 'outro']
}

export function defaultFrenteMm(kind: unknown): Mm {
  return FRENTE_DEFAULTS[
    (kind as FrenteKind) in FRENTE_DEFAULTS ? (kind as FrenteKind) : 'tamponamento'
  ]
}

/** Número > 0 ou null. */
export function positiveOrNull(value: unknown): number | null {
  const n = Number(value)
  return Number.isFinite(n) && n > 0 ? n : null
}

const MODULE_ESTIMATES: Array<{ match: RegExp; dims: Omit<Mm, 'thickness_mm'> & { depth_mm: number } }> = [
  // Mais específicos primeiro ("mesa de cabeceira" ≠ mesa/cabeceira)
  { match: /inferior|gaveteiro|comoda|cômoda|criado|mesa de cabeceira/i, dims: { width_mm: 1200, height_mm: 800, depth_mm: 550 } },
  { match: /guarda[\s-]?roupa|roupeiro|closet|armario|armário/i, dims: { width_mm: 2000, height_mm: 2400, depth_mm: 600 } },
  { match: /painel|cabeceira|home|ripado/i, dims: { width_mm: 2000, height_mm: 1800, depth_mm: 50 } },
  { match: /mesa|escrivaninha/i, dims: { width_mm: 1200, height_mm: 750, depth_mm: 600 } },
  { match: /bancada|ilha|balcao|balcão/i, dims: { width_mm: 1800, height_mm: 900, depth_mm: 600 } },
  { match: /aereo|aéreo|basculante|superior/i, dims: { width_mm: 1200, height_mm: 700, depth_mm: 350 } },
  { match: /torre/i, dims: { width_mm: 600, height_mm: 2200, depth_mm: 600 } },
  { match: /nicho|estante|prateleira/i, dims: { width_mm: 800, height_mm: 400, depth_mm: 300 } },
]

/** Estimativa L×A×P do módulo pelo nome (quando a planta não traz cotas). */
export function estimateModuleDimensions(name: unknown): {
  width_mm: number
  height_mm: number
  depth_mm: number
} {
  const n = typeof name === 'string' ? name : ''
  const hit = MODULE_ESTIMATES.find((e) => e.match.test(n))
  return hit ? { ...hit.dims } : { width_mm: 1000, height_mm: 800, depth_mm: 500 }
}
