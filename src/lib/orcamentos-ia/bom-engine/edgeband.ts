import type { CutPiece, BomLine, PieceRole } from '@/lib/orcamentos-ia/bom-engine/types'
import type { SystemPreferences } from '@/lib/orcamentos-ia/system-preferences'

export type EdgebandWidthMm = 22 | 35 | 45
export type EdgebandPolicy = SystemPreferences['edgeband_policy']

/** Chapas simples → 22 mm; engrosso → 35 mm (padrão) ou 45 mm se thickness ≥ 36. */
export function edgebandWidthForPiece(piece: CutPiece): EdgebandWidthMm {
  if (piece.doubled || piece.thickness_mm >= 30) {
    return piece.thickness_mm >= 36 ? 45 : 35
  }
  return 22
}

/**
 * Aplica política de bordeamento da marcenaria às arestas da peça.
 * - front_only: só topo da frente
 * - visible_edges: frente + laterais (padrão Planilha 4.0 / UI)
 * - all_edges: perímetro completo (frente, trás, esquerda, direita) quando houver cotas
 */
export function applyEdgebandPolicy(
  piece: CutPiece,
  policy: EdgebandPolicy = 'visible_edges',
): CutPiece['edge_lengths_mm'] {
  const e = piece.edge_lengths_mm ?? {}
  const w = piece.width_mm
  const h = piece.height_mm

  if (policy === 'front_only') {
    return e.front != null && e.front > 0 ? { front: e.front } : w > 0 ? { front: w } : {}
  }

  if (policy === 'all_edges') {
    // Fundo/sarrafo sem aresta útil: mantém vazio
    if (piece.role === 'fundo' || piece.role === 'sarrafo') return e
    return {
      front: e.front ?? w,
      back: e.back ?? w,
      left: e.left ?? h,
      right: e.right ?? h,
    }
  }

  // visible_edges: frentes/portas já vêm com frente+laterais; caixaria tipicamente só frente
  if (isFrontFacingRole(piece.role)) {
    return {
      front: e.front ?? w,
      left: e.left ?? h,
      right: e.right ?? h,
      ...(e.back != null && e.back > 0 ? { back: e.back } : {}),
    }
  }
  return e.front != null || e.back != null || e.left != null || e.right != null
    ? e
    : w > 0
      ? { front: w }
      : {}
}

function isFrontFacingRole(role: PieceRole): boolean {
  return role === 'frente' || role === 'porta' || role === 'tampo'
}

export function edgeMetersForPiece(
  piece: CutPiece,
  policy: EdgebandPolicy = 'visible_edges',
): number {
  const e = applyEdgebandPolicy(piece, policy)
  const mm = (e.front ?? 0) + (e.back ?? 0) + (e.left ?? 0) + (e.right ?? 0)
  return (mm * Math.max(1, piece.quantity)) / 1000
}

export function edgebandBomLines(
  pieces: CutPiece[],
  unitCostPerM: Record<EdgebandWidthMm, number> = { 22: 2.5, 35: 4.5, 45: 5.5 },
  policy: EdgebandPolicy = 'visible_edges',
): BomLine[] {
  const byWidth = new Map<EdgebandWidthMm, number>()
  for (const piece of pieces) {
    const meters = edgeMetersForPiece(piece, policy)
    if (meters <= 0) continue
    const w = edgebandWidthForPiece(piece)
    byWidth.set(w, (byWidth.get(w) ?? 0) + meters)
  }
  const lines: BomLine[] = []
  for (const [width, meters] of byWidth) {
    const qty = Math.round(meters * 1000) / 1000
    lines.push({
      item_category: 'edgeband',
      item_description: `Fita de Borda ${width}mm`,
      quantity: qty,
      unit_of_measure: 'm',
      unit_cost: unitCostPerM[width],
      metadata: { width_mm: width, edgeband_policy: policy },
    })
  }
  return lines
}
