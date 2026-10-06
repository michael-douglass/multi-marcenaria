/** Tipologias dos módulos 1–11 (PRD v11 Corte Claude). */
export type ModuleTypology =
  | 'balcao'
  | 'aereo'
  | 'armario_correr'
  | 'armario_giro'
  | 'nicho'
  | 'painel'
  | 'gaveteiro'
  | 'outro'

export type PieceRole =
  | 'lateral'
  | 'base'
  | 'tampo'
  | 'divisoria'
  | 'prateleira'
  | 'fundo'
  | 'travessa'
  | 'sarrafo'
  | 'frente'
  | 'porta'
  | 'gaveta_lateral'
  | 'gaveta_contrafundo'
  | 'gaveta_fundo'
  | 'outro'

export type BomItemCategory = 'board' | 'edgeband' | 'hardware' | 'fastener' | 'labor' | 'other'

export type BomUnit = 'm2' | 'm' | 'unit' | 'pair' | 'bar' | 'sheet' | 'roll'

export interface CutPiece {
  id: string
  role: PieceRole
  name: string
  width_mm: number
  height_mm: number
  thickness_mm: number
  quantity: number
  /** true = peça engrossada (duas chapas coladas) → fita larga */
  doubled?: boolean
  /** Topos a bordear: F=frente, T=traseira, E=esquerda, D=direita (comprimento em mm) */
  edge_lengths_mm: { front?: number; back?: number; left?: number; right?: number }
  /** Sem rasgo de fundo (nichos / topos expostos) */
  skip_groove?: boolean
  column_index?: number
}

export interface BomLine {
  item_category: BomItemCategory
  item_description: string
  quantity: number
  unit_of_measure: BomUnit
  unit_cost: number
  metadata?: Record<string, unknown>
}

export interface ModuleSpec {
  name: string
  typology: ModuleTypology
  width_mm: number
  height_mm: number
  depth_mm: number
  /** Quantidade de cópias do módulo */
  quantity?: number
  door_count?: number
  drawer_count?: number
  shelf_count?: number
  /** Portas de correr: 2, 3 ou 4 */
  sliding_doors?: 2 | 3 | 4
  /** Larguras das colunas (armário de giro); se vazio, 1 coluna = width */
  column_widths_mm?: number[]
  /** Maleiro ativo por coluna */
  top_shelf?: boolean
  /** Tampo/prateleira engrossada */
  doubled_top?: boolean
  material_name?: string
  room_tag?: string
}

export interface ExplodeResult {
  pieces: CutPiece[]
  bom: BomLine[]
  chainOfThought: string
  warnings: string[]
  mountingDevice: string
}
