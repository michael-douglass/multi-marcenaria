import { z } from 'zod'

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

export const boundingBoxSchema = z.object({
  page: z.number().int().min(1).describe('Número da página do PDF (1-based)'),
  x: z.number().min(0).max(1).describe('X relativo 0–1'),
  y: z.number().min(0).max(1).describe('Y relativo 0–1'),
  width: z.number().min(0).max(1),
  height: z.number().min(0).max(1),
})

export const caixariaPieceSchema = z.object({
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
  bounding_box: boundingBoxSchema.optional(),
})

export const frentePortaSchema = z.object({
  name: z.string().min(1),
  kind: z.enum(['porta_giro', 'porta_correr', 'frente_gaveta', 'frente_falsa', 'basculante', 'tamponamento']),
  width_mm: z.number().positive(),
  height_mm: z.number().positive(),
  thickness_mm: z.number().positive().default(15),
  material_name: z.string().min(2),
  quantity: z.number().positive().default(1),
  bounding_box: boundingBoxSchema.optional(),
})

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
  .object({
    name: z.string().min(1),
    description: z.string().optional(),
    dimensions: z
      .object({
        width_mm: z.number().positive().optional(),
        height_mm: z.number().positive().optional(),
        depth_mm: z.number().positive().optional(),
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
  })
  .superRefine((mod, ctx) => {
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

export const EXTRACTOR_SYSTEM_PROMPT = `Você é o Extrator técnico da Planilha 4.0 Premium (marcenaria).
Extraia ABSOLUTAMENTE TUDO do projeto em PDF/imagens:

OBRIGATÓRIO — NUNCA devolva módulos vazios nem materiais sem dados:
- Todo módulo DEVE ter ao menos um item em caixaria, frentes_portas, ferragens ou fitas_borda_m.
- Toda peça de caixaria/frente DEVE ter material_name preenchido, dimensões mm > 0 e quantity > 0.
- Toda ferragem/fita DEVE ter exact_quantity > 0 e categoria coerente (ferragem|puxador|consumivel|fita).
- PROIBIDO retornar arrays de materiais vazios em todos os módulos, ou quantities/dimensões nulas/zeradas.
- Sugira nomes de material realistas (ex.: "MDF Branco TX 15mm", "Dobradiça com amortecedor") para o de-para de preços.

INVENTÁRIO DE MÓDULOS — NÃO OMITIR (um módulo por peça nomeada no projeto):
- Guarda-roupa / closet / roupeiro
- Painel, cabeceira, painel ripado, home theater
- Nicho, nicho divisor de ambiente, estante vazada
- Torre, aéreo, basculante, inferior/superior de cozinha
- Mesa com Saia, escrivaninha, bancada, ilha
- Ferragens listadas nas pranchas (sempre como itens do módulo correspondente)
- Nomear o módulo de forma explícita (ex.: "Painel e Cabeceira", "Nicho Divisor de Ambiente")

MÓDULOS ESPECIAIS (mesas/bancadas):
- Tampos engrossados (30/45 mm), saias, passa-cabos, pés.
- Tampos: frentes_portas.kind = "tamponamento" ou caixaria função tampo.

CAIXARIA: bases, laterais, divisórias, prateleiras, fundos, sarrafos — mm, material, fitas C1/C2/L1/L2.
FRENTES/PORTAS/TAMPONAMENTOS: tipo, medidas e material.
FITAS DE BORDA: metros lineares (> 0).
FERRAGENS: SEMPRE por UNIDADE INDIVIDUAL (nunca caixa/pacote).
PUXADORES PERFIL: barras de 3 m + tampinhas laterais (2 por barra).

REFERÊNCIA VISUAL: preencha bounding_box (page 1-based + x,y,width,height 0–1) em caixaria, frentes, ferragens e fitas quando visível.

Bounding boxes 0–1 quando visíveis. Responda só no schema JSON.`

export const AUDITOR_SYSTEM_PROMPT = `Você é o Auditor construtivo (o3-mini) da Planilha 4.0.
Valide física de montagem: dobradiças por altura, folgas, furações, barras 3m + tampinhas, unidades individuais.
Compare com o INVENTÁRIO ESPERADO: se faltar guarda-roupa, painel, cabeceira, nicho, bancada/mesa ou ferragens, COMPLETE a extração.
PROIBIDO deixar módulos sem materiais ou quantidades zeradas — corrija/complete.
Devolva o JSON completo + auditor_notes e warnings objetivos.`

export const INVENTORY_SYSTEM_PROMPT = `Você lista o inventário de ambientes e módulos de um projeto de marcenaria (capa, sumário, plantas).
NÃO detalhe peças ainda — só nomes.
Inclua TODOS: guarda-roupa, painel, cabeceira, nicho divisor, torre, bancada, mesa, ferragens como módulo se houver prancha própria.
Responda só no JSON schema.`
