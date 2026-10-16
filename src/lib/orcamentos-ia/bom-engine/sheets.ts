import {
  DEFAULT_SHEET_LOSS_PCT,
  STANDARD_SHEET_AREA_M2,
  sheetsFromAreaM2,
} from '@/lib/orcamentos-ia/pricing'
import type { CutPiece, BomLine } from '@/lib/orcamentos-ia/bom-engine/types'

export function pieceAreaM2(piece: CutPiece): number {
  const qty = Math.max(1, piece.quantity)
  const layers = piece.doubled ? 2 : 1
  return (piece.width_mm / 1000) * (piece.height_mm / 1000) * qty * layers
}

export function totalBoardAreaM2(pieces: CutPiece[]): number {
  return pieces.reduce((sum, p) => sum + pieceAreaM2(p), 0)
}

/**
 * Agrega chapas por SKU (`piece.material_name`), sem colapsar tudo num único Branco.
 * Peças sem material caem no `defaultMaterialName`.
 */
export function boardBomLines(
  pieces: CutPiece[],
  defaultMaterialName: string,
  unitCostPerM2: number,
  lossPct = DEFAULT_SHEET_LOSS_PCT,
): BomLine[] {
  const groups = new Map<string, CutPiece[]>()
  for (const p of pieces) {
    const key = String(p.material_name || '').trim() || defaultMaterialName
    const list = groups.get(key) ?? []
    list.push(p)
    groups.set(key, list)
  }

  const sheetCost = Math.round(unitCostPerM2 * STANDARD_SHEET_AREA_M2 * 100) / 100
  const lines: BomLine[] = []
  for (const [materialName, group] of groups) {
    const area = Math.round(totalBoardAreaM2(group) * 1000) / 1000
    if (area <= 0) continue
    const sheets = sheetsFromAreaM2(area, lossPct, STANDARD_SHEET_AREA_M2)
    lines.push({
      item_category: 'board',
      item_description: materialName,
      quantity: sheets,
      unit_of_measure: 'sheet',
      unit_cost: sheetCost,
      metadata: {
        area_m2: area,
        sheets_with_loss: sheets,
        sheet_area_m2: STANDARD_SHEET_AREA_M2,
        loss_pct: lossPct,
      },
    })
  }
  return lines
}

export { sheetsFromAreaM2, STANDARD_SHEET_AREA_M2, DEFAULT_SHEET_LOSS_PCT }
