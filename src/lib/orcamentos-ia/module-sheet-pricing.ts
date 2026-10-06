import {
  CUTTING_LIST_TAG,
  DEFAULT_SHEET_LOSS_PCT,
  isCuttingListNote,
  sheetsFromAreaM2,
  STANDARD_SHEET_AREA_M2,
} from '@/lib/orcamentos-ia/pricing'

export { CUTTING_LIST_TAG, isCuttingListNote }

export function pieceAreaM2(widthMm: number, heightMm: number, qty: number): number {
  const q = Math.max(0, qty)
  return Math.round(((widthMm * heightMm * q) / 1_000_000) * 1000) / 1000
}

/** Preço de 1 chapa comercial (2,75×1,85). Nunca usa R$/m² de fachada. */
export function sheetUnitPrice(resolved: {
  unitPrice: number
  unit: string
  pricePerM2: number | null
}): number {
  const u = (resolved.unit || '').toLowerCase()
  if (u === 'chapa' && resolved.unitPrice > 0) return Math.round(resolved.unitPrice * 100) / 100
  if (resolved.pricePerM2 && resolved.pricePerM2 > 0) {
    return Math.round(resolved.pricePerM2 * STANDARD_SHEET_AREA_M2 * 100) / 100
  }
  return Math.round(resolved.unitPrice * 100) / 100
}

export function sheetsForModuleArea(
  areaM2: number,
  lossPct = DEFAULT_SHEET_LOSS_PCT,
): { sheets: number; areaM2: number; lossPct: number } {
  const area = Math.round(areaM2 * 1000) / 1000
  return {
    areaM2: area,
    lossPct,
    sheets: sheetsFromAreaM2(area, lossPct),
  }
}

export function sheetPurchaseNotes(areaM2: number, sheets: number, lossPct: number): string {
  return `módulo: ${areaM2.toFixed(3)} m² de corte + ${lossPct}% perda → ${sheets} chapa(s) 2,75×1,85 m`
}

/**
 * Converte linhas antigas (peça × R$/m²) em lista de corte + 1 chapa por material no módulo.
 */
export function convertM2RowsToModuleSheets<
  T extends {
    id: string
    module_id: string
    raw_name: string
    category: string
    unit_measure: string
    unit_price: number
    exact_quantity: number
    full_units_quantity: number
    notes: string | null
    using_market_price: boolean
    market_price_confirmed: boolean
    system_material_id: string | null
  },
>(rows: T[]): { keep: T[]; insert: Array<Omit<T, 'id'>>; deleteIds: string[] } {
  const deleteIds: string[] = []
  const keep: T[] = []
  const insert: Array<Omit<T, 'id'>> = []
  const groups = new Map<
    string,
    {
      template: T
      areaM2: number
      materialName: string
      usingMarket: boolean
      pricePerM2: number
    }
  >()

  for (const row of rows) {
    const isAreaChapa =
      row.category === 'chapa' &&
      (row.unit_measure === 'm2' || row.unit_measure === 'm²') &&
      !isCuttingListNote(row.notes)

    if (!isAreaChapa) {
      keep.push(row)
      continue
    }

    deleteIds.push(row.id)
    const materialName = row.raw_name.includes('—')
      ? row.raw_name.split('—').pop()?.trim() || row.raw_name
      : row.raw_name
    const pieceName = row.raw_name.includes('—')
      ? row.raw_name.split('—')[0].trim()
      : row.raw_name
    const qtyMatch = row.notes?.match(/×\s*(\d+(?:\.\d+)?)/)
    const pieceQty = qtyMatch ? Number(qtyMatch[1]) : 1

    const { id: _pieceId, ...pieceRest } = row
    insert.push({
      ...pieceRest,
      raw_name: `${pieceName} — ${materialName}`,
      unit_price: 0,
      exact_quantity: pieceQty > 0 ? pieceQty : 1,
      full_units_quantity: Math.max(1, Math.ceil(pieceQty || 1)),
      unit_measure: 'un',
      using_market_price: false,
      market_price_confirmed: true,
      notes: `${CUTTING_LIST_TAG}; ${row.notes ?? ''}`.trim(),
    })

    const key = `${row.module_id}::${materialName}`
    const g = groups.get(key) ?? {
      template: row,
      areaM2: 0,
      materialName,
      usingMarket: row.using_market_price,
      pricePerM2: Number(row.unit_price) || 0,
    }
    g.areaM2 += Number(row.exact_quantity) || 0
    if (row.using_market_price) g.usingMarket = true
    if (Number(row.unit_price) > 0) g.pricePerM2 = Number(row.unit_price)
    groups.set(key, g)
  }

  for (const g of groups.values()) {
    const { sheets, areaM2 } = sheetsForModuleArea(g.areaM2)
    const unitPrice = Math.round(g.pricePerM2 * STANDARD_SHEET_AREA_M2 * 100) / 100
    const { id: _sheetId, ...sheetRest } = g.template
    insert.push({
      ...sheetRest,
      raw_name: `Chapa — ${g.materialName}`,
      category: 'chapa',
      unit_price: unitPrice,
      exact_quantity: sheets,
      full_units_quantity: sheets,
      unit_measure: 'chapa',
      using_market_price: g.usingMarket,
      market_price_confirmed: false,
      notes: sheetPurchaseNotes(areaM2, sheets, DEFAULT_SHEET_LOSS_PCT),
    })
  }

  return { keep, insert, deleteIds }
}
