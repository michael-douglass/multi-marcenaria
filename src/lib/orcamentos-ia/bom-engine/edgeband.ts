import type { CutPiece, BomLine } from '@/lib/orcamentos-ia/bom-engine/types'

export type EdgebandWidthMm = 22 | 35 | 45

/** Chapas simples → 22 mm; engrosso → 35 mm (padrão) ou 45 mm se thickness ≥ 36. */
export function edgebandWidthForPiece(piece: CutPiece): EdgebandWidthMm {
  if (piece.doubled || piece.thickness_mm >= 30) {
    return piece.thickness_mm >= 36 ? 45 : 35
  }
  return 22
}

export function edgeMetersForPiece(piece: CutPiece): number {
  const e = piece.edge_lengths_mm
  const mm =
    (e.front ?? 0) + (e.back ?? 0) + (e.left ?? 0) + (e.right ?? 0)
  return (mm * Math.max(1, piece.quantity)) / 1000
}

export function edgebandBomLines(
  pieces: CutPiece[],
  unitCostPerM: Record<EdgebandWidthMm, number> = { 22: 2.5, 35: 4.5, 45: 5.5 },
): BomLine[] {
  const byWidth = new Map<EdgebandWidthMm, number>()
  for (const piece of pieces) {
    const meters = edgeMetersForPiece(piece)
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
      metadata: { width_mm: width },
    })
  }
  return lines
}
