/**
 * Consolidação global do BOM pós-extração (antes da precificação).
 * - Caixa interna → Branco TX; fundo → 6 mm Branco TX
 * - Frentes/ripados coloridos: PRESERVA material_name (não colapsa Amendoeira/Lino → um só)
 * - Normaliza ferragens via mapHardwareAlias
 * Determinístico — não inventa quantidades de chapas do zero.
 */
import type { QuoteExtraction } from '@/lib/orcamentos-ia/schemas'
import { mapHardwareAlias } from '@/lib/orcamentos-ia/hardware-alias'
import { pieceAreaM2, sheetsForModuleArea } from '@/lib/orcamentos-ia/module-sheet-pricing'

export interface ProjectSheetSku {
  /** Rótulo comercial (ex.: MDF Branco Eucatex 15mm). */
  label: string
  thickness_mm: 6 | 15 | 18
  /** Papel: caixa/fundo branco vs frente colorida. */
  role: 'box_white' | 'back_white' | 'front_color'
  /** Tokens para match no material_name da IA. */
  match?: RegExp
}

/** Paleta padrão alinhada à lista Flaviane (quando o projeto não declara outra). */
export const DEFAULT_PROJECT_SHEET_PALETTE: ProjectSheetSku[] = [
  {
    label: 'MDF Branco Multimarcas 6mm',
    thickness_mm: 6,
    role: 'back_white',
    match: /branco|tx|white/i,
  },
  {
    label: 'MDF Branco Eucatex 15mm',
    thickness_mm: 15,
    role: 'box_white',
    match: /branco|tx|white/i,
  },
  {
    label: 'MDF Jatoba Brasileiro Arauco 15mm',
    thickness_mm: 15,
    role: 'front_color',
    match: /jatob|imbuia|areia|freij|noite|duna|cidreira|blush|mint|azul|bege|lord|madeira|cor/i,
  },
]

export interface ConsolidatedSheetLine {
  label: string
  thickness_mm: number
  sheets: number
  area_m2: number
}

export interface ConsolidatedHardwareLine {
  key: string
  canonicalName: string
  category: 'ferragem' | 'puxador' | 'consumivel'
  quantity: number
}

export interface ConsolidatedBom {
  sheets: ConsolidatedSheetLine[]
  hardware: ConsolidatedHardwareLine[]
  notes: string[]
}

function normalizeMat(s: string): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

const BOX_FN_RE = /^(lateral|base|prateleira|divisoria|sarrafo)$/
const FRONT_COLOR_RE =
  /amendoeira|lino|jatob|imbuia|areia|freij|noite|duna|blush|mint|azul|bege|lord|papiro|cidreira|hanover|reflecta/i

function boxWhiteSku(palette: ProjectSheetSku[]): ProjectSheetSku {
  return (
    palette.find((p) => p.role === 'box_white' && p.thickness_mm === 15) ||
    palette.find((p) => p.thickness_mm === 15 && /branco/i.test(p.label)) ||
    DEFAULT_PROJECT_SHEET_PALETTE[1]
  )
}

function backWhiteSku(palette: ProjectSheetSku[]): ProjectSheetSku {
  return (
    palette.find((p) => p.role === 'back_white' && p.thickness_mm === 6) ||
    palette.find((p) => p.thickness_mm === 6) ||
    DEFAULT_PROJECT_SHEET_PALETTE[0]
  )
}

/**
 * Normaliza só caixa/fundo. Frentes coloridas e ripados mantêm material_name original.
 */
function normalizePieceMaterial(
  piece: { function?: string; material_name: string; thickness_mm: number; name?: string },
  palette: ProjectSheetSku[],
  opts: { isFrontList: boolean },
): { material_name: string; thickness_mm: number } {
  const fn = String(piece.function || '')
  const mat = piece.material_name || ''
  const nameHint = `${piece.name || ''} ${mat}`

  // Fundo → sempre 6 mm Branco TX
  if (fn === 'fundo' || piece.thickness_mm <= 8) {
    const sku = backWhiteSku(palette)
    return { material_name: sku.label, thickness_mm: 6 }
  }

  // Lista de frentes/portas: nunca remapar cor
  if (opts.isFrontList) {
    return { material_name: mat, thickness_mm: piece.thickness_mm }
  }

  // Caixa interna (function) → Branco TX 15
  if (BOX_FN_RE.test(fn)) {
    // Exceção: ripas/sarrafos coloridos na caixaria (painel ripado)
    if (FRONT_COLOR_RE.test(nameHint) && /ripad|brise|sarrafo|outro/i.test(nameHint)) {
      return { material_name: mat, thickness_mm: piece.thickness_mm }
    }
    const sku = boxWhiteSku(palette)
    return { material_name: sku.label, thickness_mm: 15 }
  }

  // Tampo/outro já colorido → preservar
  if (FRONT_COLOR_RE.test(mat) || /frente|porta|gaveta|painel|ripado|fachada/i.test(nameHint)) {
    return { material_name: mat, thickness_mm: piece.thickness_mm }
  }

  // Branco genérico na caixa → padronizar label
  if (/branco|tx|white/i.test(mat)) {
    const sku = boxWhiteSku(palette)
    return { material_name: sku.label, thickness_mm: piece.thickness_mm <= 16 ? 15 : piece.thickness_mm }
  }

  return { material_name: mat, thickness_mm: piece.thickness_mm }
}

/**
 * Aplica normalização de caixa/fundo sem colapsar cores de frente.
 */
export function applySheetPaletteToExtraction(
  extraction: QuoteExtraction,
  palette: ProjectSheetSku[] = DEFAULT_PROJECT_SHEET_PALETTE,
): QuoteExtraction {
  const envs = extraction.environments.map((env) => ({
    ...env,
    modules: env.modules.map((mod) => {
      if (mod.out_of_scope) return mod
      return {
        ...mod,
        caixaria: mod.caixaria.map((p) => {
          const next = normalizePieceMaterial(p, palette, { isFrontList: false })
          return {
            ...p,
            thickness_mm: next.thickness_mm,
            material_name: next.material_name,
          }
        }),
        frentes_portas: mod.frentes_portas.map((p) => {
          const next = normalizePieceMaterial(p, palette, { isFrontList: true })
          return {
            ...p,
            thickness_mm: next.thickness_mm,
            material_name: next.material_name,
          }
        }),
        ferragens: mod.ferragens.map((f) => {
          const mapped = mapHardwareAlias(f.raw_name)
          return {
            ...f,
            raw_name: mapped.canonicalName,
            category: mapped.category,
          }
        }),
      }
    }),
  }))
  return { ...extraction, environments: envs }
}
/**
 * Agrega chapas comerciais + ferragens do projeto inteiro (para totals / auditoria).
 */
export function consolidateProjectBom(
  extraction: QuoteExtraction,
  palette: ProjectSheetSku[] = DEFAULT_PROJECT_SHEET_PALETTE,
): ConsolidatedBom {
  const normalized = applySheetPaletteToExtraction(extraction, palette)
  const sheetArea = new Map<string, { label: string; thickness_mm: number; area: number }>()
  const hardwareQty = new Map<
    string,
    { key: string; canonicalName: string; category: ConsolidatedHardwareLine['category']; qty: number }
  >()
  const notes: string[] = [
    'BOM consolidado deterministicamente (paleta do projeto + De-Para de ferragens).',
  ]

  for (const env of normalized.environments) {
    for (const mod of env.modules) {
      if (mod.out_of_scope) continue
      for (const p of [...mod.caixaria, ...mod.frentes_portas]) {
        const area = pieceAreaM2(p.width_mm, p.height_mm, p.quantity)
        const key = `${p.material_name}|${p.thickness_mm}`
        const prev = sheetArea.get(key)
        if (prev) prev.area += area
        else
          sheetArea.set(key, {
            label: p.material_name,
            thickness_mm: p.thickness_mm,
            area,
          })
      }
      for (const f of mod.ferragens) {
        const mapped = mapHardwareAlias(f.raw_name)
        const qty = Number(f.full_units_quantity || f.exact_quantity) || 0
        if (qty <= 0) continue
        const key = mapped.key !== 'unknown' ? mapped.key : normalizeMat(mapped.canonicalName)
        const prev = hardwareQty.get(key)
        if (prev) prev.qty += qty
        else
          hardwareQty.set(key, {
            key,
            canonicalName: mapped.canonicalName,
            category: mapped.category,
            qty,
          })
      }
    }
  }

  const sheets: ConsolidatedSheetLine[] = [...sheetArea.values()].map((g) => {
    const packed = sheetsForModuleArea(g.area)
    return {
      label: g.label,
      thickness_mm: g.thickness_mm,
      area_m2: Math.round(g.area * 1000) / 1000,
      sheets: packed.sheets,
    }
  })

  const hardware: ConsolidatedHardwareLine[] = [...hardwareQty.values()]
    .map((h) => ({
      key: h.key,
      canonicalName: h.canonicalName,
      category: h.category,
      quantity: Math.round(h.qty),
    }))
    .sort((a, b) => a.canonicalName.localeCompare(b.canonicalName, 'pt-BR'))

  const totalSheets = sheets.reduce((s, x) => s + x.sheets, 0)
  notes.push(`Chapas agregadas: ${totalSheets} un. em ${sheets.length} SKU(s).`)
  notes.push(`Ferragens canônicas: ${hardware.length} linha(s).`)

  return { sheets, hardware, notes }
}

/**
 * Pipeline helper: aplica paleta + devolve tree + consolidated_bom para totals.
 */
export function consolidateExtractionForPricing(
  extraction: QuoteExtraction,
  palette?: ProjectSheetSku[],
): { extraction: QuoteExtraction; consolidatedBom: ConsolidatedBom } {
  const pal = palette?.length ? palette : DEFAULT_PROJECT_SHEET_PALETTE
  const next = applySheetPaletteToExtraction(extraction, pal)
  return {
    extraction: next,
    consolidatedBom: consolidateProjectBom(next, pal),
  }
}
