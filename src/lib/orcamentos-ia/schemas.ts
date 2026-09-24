import { z } from 'zod'
import {
  defaultFrenteMm,
  defaultPieceMm,
  estimateModuleDimensions,
  positiveOrNull,
} from '@/lib/orcamentos-ia/dimension-defaults'

/** Categorias alinhadas à Planilha 4.0 / inventory_items. */
export const materialCategorySchema = z.enum([
  'chapa',
  'fita_borda',
  'ferragem',
  'puxador',
  'consumivel',
  'servico',
  'mao_obra',
  'outro',
])

const clamp01 = (value: unknown) => Math.min(1, Math.max(0, Number(value) || 0))

/** Referência visual; valores fora de 0–1 são limitados e página inválida descarta a caixa. */
export const boundingBoxSchema = z.preprocess(
  (raw) => {
    if (!raw || typeof raw !== 'object') return undefined
    const b = raw as Record<string, unknown>
    const page = Math.round(Number(b.page))
    if (!Number.isFinite(page) || page < 1) return undefined
    return {
      page,
      x: clamp01(b.x),
      y: clamp01(b.y),
      width: clamp01(b.width),
      height: clamp01(b.height),
    }
  },
  z
    .object({
      page: z.number().int().min(1).describe('Número da página do PDF (1-based)'),
      x: z.number().min(0).max(1).describe('X relativo 0–1'),
      y: z.number().min(0).max(1).describe('Y relativo 0–1'),
      width: z.number().min(0).max(1),
      height: z.number().min(0).max(1),
    })
    .optional(),
)

/** Completa medidas ≤ 0 / nulas com o padrão do tipo; marca `dimensions_estimated`. */
function fillPieceMm(raw: unknown, defaults: (row: Record<string, unknown>) => {
  width_mm: number
  height_mm: number
  thickness_mm: number
}): unknown {
  if (!raw || typeof raw !== 'object') return raw
  const row = { ...(raw as Record<string, unknown>) }
  const d = defaults(row)
  let estimated = row.dimensions_estimated === true
  for (const key of ['width_mm', 'height_mm'] as const) {
    const n = positiveOrNull(row[key])
    if (n == null) {
      row[key] = d[key]
      estimated = true
    } else row[key] = n
  }
  row.thickness_mm = positiveOrNull(row.thickness_mm) ?? d.thickness_mm
  if (estimated) row.dimensions_estimated = true
  return row
}

export const caixariaPieceSchema = z.preprocess(
  (raw) => fillPieceMm(raw, (row) => defaultPieceMm(row.function)),
  z.object({
    name: z.string().min(1).describe('Ex.: Base, Lateral esquerda, Divisória, Fundo, Sarrafo'),
    function: z.enum([
      'base',
      'lateral',
      'divisoria',
      'prateleira',
      'fundo',
      'sarrafo',
      'tampo',
      'outro',
    ]),
    width_mm: z.number().positive(),
    height_mm: z.number().positive(),
    thickness_mm: z.number().positive().default(15),
    material_name: z.string().min(2).describe('Ex.: MDF Branco TX 15mm'),
    edge_banding: z
      .object({
        C1: z.boolean().default(false),
        C2: z.boolean().default(false),
        L1: z.boolean().default(false),
        L2: z.boolean().default(false),
        tape_name: z.string().optional(),
        meters: z.number().nonnegative().default(0),
      })
      .optional(),
    quantity: z.number().positive().default(1),
    dimensions_estimated: z.boolean().optional(),
    bounding_box: boundingBoxSchema.optional(),
  }),
)

export const frentePortaSchema = z.preprocess(
  (raw) => fillPieceMm(raw, (row) => defaultFrenteMm(row.kind)),
  z.object({
    name: z.string().min(1),
    kind: z.enum(['porta_giro', 'porta_correr', 'frente_gaveta', 'frente_falsa', 'basculante', 'tamponamento']),
    width_mm: z.number().positive(),
    height_mm: z.number().positive(),
    thickness_mm: z.number().positive().default(15),
    material_name: z.string().min(2),
    quantity: z.number().positive().default(1),
    dimensions_estimated: z.boolean().optional(),
    bounding_box: boundingBoxSchema.optional(),
  }),
)

/**
 * Ferragens e acessórios — SEMPRE unidade individual (nunca caixa/pacote).
 * Puxador perfil: quantidade em barras de 3m + tampinhas laterais.
 */
export const ferragemItemSchema = z.object({
  raw_name: z.string().min(2),
  category: z.enum(['ferragem', 'puxador', 'consumivel']),
  unit_measure: z.enum(['un', 'barra', 'm', 'kg']).default('un'),
  /** Quantidade exata do projeto (unidades individuais ou metros). */
  exact_quantity: z.number().positive(),
  /**
   * Para puxador perfil: número de barras de 3 m (arredondado para cima).
   * Para demais: igual a exact_quantity arredondado.
   */
  full_units_quantity: z.number().int().positive(),
  notes: z.string().optional(),
  bounding_box: boundingBoxSchema.optional(),
})

export const moduleExtractionSchema = z
  .preprocess(
    (raw) => {
      if (!raw || typeof raw !== 'object') return raw
      const m = { ...(raw as Record<string, unknown>) }
      const d =
        m.dimensions && typeof m.dimensions === 'object'
          ? (m.dimensions as Record<string, unknown>)
          : {}
      // Fora de escopo (pedra/decoração): mantém medidas só se todas forem válidas
      if (m.out_of_scope === true) {
        const valid = (['width_mm', 'height_mm', 'depth_mm'] as const).every(
          (k) => positiveOrNull(d[k]) != null,
        )
        m.dimensions = valid
          ? {
              width_mm: positiveOrNull(d.width_mm),
              height_mm: positiveOrNull(d.height_mm),
              depth_mm: positiveOrNull(d.depth_mm),
            }
          : undefined
        return m
      }
      const est = estimateModuleDimensions(m.name)
      let estimated = d.estimated === true
      const dims: Record<string, unknown> = {}
      for (const key of ['width_mm', 'height_mm', 'depth_mm'] as const) {
        const n = positiveOrNull(d[key])
        if (n == null) estimated = true
        dims[key] = n ?? est[key]
      }
      if (estimated) dims.estimated = true
      m.dimensions = dims
      return m
    },
    z.object({
      name: z.string().min(1),
      description: z.string().optional(),
      /** Pedra, alvenaria, decoração — listado à parte, sem custo. */
      out_of_scope: z.boolean().optional(),
      dimensions: z
        .object({
          width_mm: z.number().positive(),
          height_mm: z.number().positive(),
          depth_mm: z.number().positive(),
          /** true quando alguma medida foi estimada pelo tipo do módulo. */
          estimated: z.boolean().optional(),
        })
        .optional(),
      bounding_box: boundingBoxSchema.optional(),
      caixaria: z.array(caixariaPieceSchema).default([]),
      frentes_portas: z.array(frentePortaSchema).default([]),
      ferragens: z.array(ferragemItemSchema).default([]),
      fitas_borda_m: z
        .array(
          z.object({
            tape_name: z.string().min(2),
            meters: z.number().positive(),
            bounding_box: boundingBoxSchema.optional(),
          }),
        )
        .default([]),
    }),
  )
  .superRefine((mod, ctx) => {
    if (mod.out_of_scope) return
    const total =
      mod.caixaria.length +
      mod.frentes_portas.length +
      mod.ferragens.length +
      mod.fitas_borda_m.length
    if (total === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          'Módulo sem materiais: informe ao menos caixaria, frente, ferragem ou fita de borda.',
      })
    }
  })

export const environmentExtractionSchema = z.object({
  name: z.string().describe('Ex.: Cozinha, Closet, Lavanderia'),
  modules: z.array(moduleExtractionSchema).min(1),
})

/** Resultado completo do Extrator (gpt-4o). */
export const quoteExtractionSchema = z.object({
  environments: z.array(environmentExtractionSchema).min(1),
  auditor_notes: z.array(z.string()).default([]),
  warnings: z.array(z.string()).default([]),
})

export type QuoteExtraction = z.infer<typeof quoteExtractionSchema>
export type ModuleExtraction = z.infer<typeof moduleExtractionSchema>
export type FerragemItem = z.infer<typeof ferragemItemSchema>
export type MaterialCategory = z.infer<typeof materialCategorySchema>
