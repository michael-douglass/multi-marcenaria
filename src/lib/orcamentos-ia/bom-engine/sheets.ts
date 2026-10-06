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

export function boardBomLines(
  pieces: CutPiece[],
  materialName: string,
  unitCostPerM2: number,
  lossPct = DEFAULT_SHEET_LOSS_PCT,
): BomLine[] {
  const area = Math.round(totalBoardAreaM2(pieces) * 1000) / 1000
  if (area <= 0) return []
  const sheets = sheetsFromAreaM2(area, lossPct, STANDARD_SHEET_AREA_M2)
  return [
    {
      item_category: 'board',
      item_description: materialName,
      quantity: area,
      unit_of_measure: 'm2',
      unit_cost: unitCostPerM2,
      metadata: {
        sheets_with_loss: sheets,
        sheet_area_m2: STANDARD_SHEET_AREA_M2,
        loss_pct: lossPct,
      },
    },
  ]
}

export { sheetsFromAreaM2, STANDARD_SHEET_AREA_M2, DEFAULT_SHEET_LOSS_PCT }
