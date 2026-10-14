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
  /** Portas de correr (2–8; típico 2–4). */
  sliding_doors?: 2 | 3 | 4 | 5 | 6 | 7 | 8
  /** Larguras das colunas (armário de giro); se vazio, 1 coluna = width */
  column_widths_mm?: number[]
  /** Maleiro ativo por coluna */
  top_shelf?: boolean
  /** Tampo/prateleira engrossada */
  doubled_top?: boolean
  /**
   * Recuo de puxador cava em travessa (Módulo 2): 0 = topo, 20 = intermediário, 40 = padrão de pega.
   */
  handle_recess_mm?: 0 | 20 | 40
  /**
   * Avanço da porta para baixo em aéreos com puxador passante (10–30 mm), Módulo 2.
   */
  door_overhang_mm?: number
  /** Tamponamento envoltório 18/25 mm em armário de correr (Módulo 7). */
  sliding_envelope?: boolean
  material_name?: string
  room_tag?: string
}

/** Etiqueta industrial por peça (ambiente → triagem na obra). */
export interface IndustrialLabel {
  room_tag: string
  module_name: string
  piece_id: string
  piece_name: string
  role: PieceRole
  width_mm: number
  height_mm: number
  thickness_mm: number
  quantity: number
  column_index?: number
  barcode_payload: string
}

export interface ExplodeResult {
  pieces: CutPiece[]
  bom: BomLine[]
  chainOfThought: string
  warnings: string[]
  mountingDevice: string
  /** Etiquetas industriais (Módulos 5–6); pode estar vazio. */
  labels?: IndustrialLabel[]
}
