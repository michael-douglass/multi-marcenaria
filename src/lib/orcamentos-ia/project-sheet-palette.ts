/**
 * Paleta dinâmica de chapas (PRD v16 Épico 2).
 * Lote 1 / legenda → project_sheet_palette; nunca colapsar frentes coloridas em Jatobá.
 */
import type { QuoteExtraction } from '@/lib/orcamentos-ia/schemas'
import type { ProjectSheetSku } from '@/lib/orcamentos-ia/bom-consolidate'

/** SKUs de referência Cortecloud #23125828 (Flaviane) — 13 linhas comerciais. */
export const FLAVIANE_REFERENCE_PALETTE: ProjectSheetSku[] = [
  {
    label: 'MDF Branco Multimarcas 6mm',
    thickness_mm: 6,
    role: 'back_white',
    match: /branco\s*(tx|multimarcas|eucatex)?|white/i,
  },
  {
    label: 'MDF Branco Eucatex 15mm',
    thickness_mm: 15,
    role: 'box_white',
    match: /branco\s*(tx|eucatex|multimarcas)?|white/i,
  },
  {
    label: 'MDF Bege Papiro 15mm',
    thickness_mm: 15,
    role: 'front_color',
    match: /bege\s*papiro|papiro/i,
  },
  {
    label: 'MDF Lord Matt 15mm',
    thickness_mm: 15,
    role: 'front_color',
    match: /lord\s*matt|lord/i,
  },
  {
    label: 'MDF Mint Essencial 15mm',
    thickness_mm: 15,
    role: 'front_color',
    match: /mint\s*essencial|mint/i,
  },
  {
    label: 'MDF Mint Essencial 6mm',
    thickness_mm: 6,
    role: 'front_color',
    match: /mint/i,
  },
  {
    label: 'MDF Blush Essencial 15mm',
    thickness_mm: 15,
    role: 'front_color',
    match: /blush\s*essencial|blush/i,
  },
  {
    label: 'MDF Blush Essencial 6mm',
    thickness_mm: 6,
    role: 'front_color',
    match: /blush/i,
  },
  {
    label: 'MDF Azul Astral 15mm',
    thickness_mm: 15,
    role: 'front_color',
    match: /azul\s*astral|azul/i,
  },
  {
    label: 'MDF Imbuia Caiapo 15mm',
    thickness_mm: 15,
    role: 'front_color',
    match: /imbuia\s*caiap|imbuia/i,
  },
  {
    label: 'MDF Imbuia Caiapo 6mm',
    thickness_mm: 6,
    role: 'front_color',
    match: /imbuia/i,
  },
  {
    label: 'MDF Areia Noronha 15mm',
    thickness_mm: 15,
    role: 'front_color',
    match: /areia\s*noronha|areia/i,
  },
  {
    label: 'MDF Areia Noronha 6mm',
    thickness_mm: 6,
    role: 'front_color',
    match: /areia/i,
  },
]

/** Só caixa + fundo — sem SKU genérico de frente (anti-Jatobá). */
export const DEFAULT_BOX_BACK_PALETTE: ProjectSheetSku[] = [
  FLAVIANE_REFERENCE_PALETTE[0],
  FLAVIANE_REFERENCE_PALETTE[1],
]

/** Flaviane + DET_CLÍNICA (Cortecloud #23496206) + madeiras comuns. */
const COLOR_TOKEN_RE =
  /bege\s*papiro|papiro|lord\s*matt|\blord\b|mint\s*essencial|\bmint\b|blush\s*essencial|\bblush\b|azul\s*astral|\bazul\b|imbuia\s*caiap|\bimbuia\b|areia\s*noronha|\bareia\b|amendoeira|\blino\b|freij|noite|duna|hanover|reflecta|jatob|salerno|fontana|carvalho|itapu|cinza\s*fossil|fossil|\blana\b|magma|madeirado|madeira\s*clara/i

const WHITE_SHEET_RE = /branco|tx|white|eucatex|multimarcas/i
const SHEET_MATERIAL_RE = /mdf|mdp|chapa|compensado|osb|madeir/i

function normalizeLabel(s: string): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

function isJatobaCollapse(label: string): boolean {
  return /jatob/.test(normalizeLabel(label))
}

/**
 * Converte JSON da IA / totals em ProjectSheetSku[] (filtra Jatobá genérico).
 */
export function parseProjectSheetPalette(raw: unknown): ProjectSheetSku[] {
  if (!Array.isArray(raw)) return []
  const out: ProjectSheetSku[] = []
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue
    const r = row as Record<string, unknown>
    const label = String(r.label || r.material_name || '').trim()
    if (!label || isJatobaCollapse(label)) continue
    const th = Number(r.thickness_mm)
    const thickness_mm = (th <= 8 ? 6 : th <= 16 ? 15 : 18) as 6 | 15 | 18
    let role = String(r.role || '') as ProjectSheetSku['role']
    if (role !== 'box_white' && role !== 'back_white' && role !== 'front_color') {
      if (thickness_mm === 6 && /branco/i.test(label)) role = 'back_white'
      else if (/branco/i.test(label) && thickness_mm >= 15) role = 'box_white'
      else role = 'front_color'
    }
    out.push({ label, thickness_mm, role })
  }
  return out
}

/**
 * Varre material_name do BOM e monta paleta (frentes coloridas + caixa/fundo).
 */
export function buildProjectSheetPaletteFromExtraction(
  extraction: QuoteExtraction,
): ProjectSheetSku[] {
  const seen = new Map<string, ProjectSheetSku>()

  const add = (sku: ProjectSheetSku) => {
    if (isJatobaCollapse(sku.label)) return
    const key = `${normalizeLabel(sku.label)}|${sku.thickness_mm}|${sku.role}`
    if (!seen.has(key)) seen.set(key, sku)
  }

  add(DEFAULT_BOX_BACK_PALETTE[0])
  add(DEFAULT_BOX_BACK_PALETTE[1])

  const declared = parseProjectSheetPalette(
    (extraction as QuoteExtraction & { project_sheet_palette?: unknown }).project_sheet_palette,
  )
  for (const sku of declared) add(sku)

  for (const env of extraction.environments || []) {
    for (const mod of env.modules || []) {
      if (mod.out_of_scope) continue
      for (const p of [...(mod.caixaria || []), ...(mod.frentes_portas || [])]) {
        const mat = String(p.material_name || '').trim()
        if (!mat || isJatobaCollapse(mat)) continue
        const th = Number(p.thickness_mm) || 15
        const thickness_mm = (th <= 8 ? 6 : th <= 16 ? 15 : 18) as 6 | 15 | 18

        if (WHITE_SHEET_RE.test(mat)) {
          add({
            label: mat,
            thickness_mm,
            role: thickness_mm === 6 ? 'back_white' : 'box_white',
          })
          continue
        }

        // Qualquer chapa não-branca vira front_color (Salerno/Fontana/… inclusos).
        if (
          COLOR_TOKEN_RE.test(mat) ||
          COLOR_TOKEN_RE.test(p.name || '') ||
          SHEET_MATERIAL_RE.test(mat)
        ) {
          const ref = FLAVIANE_REFERENCE_PALETTE.find(
            (f) =>
              f.role === 'front_color' &&
              f.thickness_mm === thickness_mm &&
              f.match?.test(mat),
          )
          add({
            label: ref?.label || mat,
            thickness_mm,
            role: 'front_color',
            match: ref?.match,
          })
        }
      }
    }
  }

  return [...seen.values()]
}

/**
 * Resolve paleta para precificação: IA → BOM → só caixa/fundo (sem Jatobá).
 */
export function resolvePaletteForPricing(
  extraction: QuoteExtraction,
  explicit?: ProjectSheetSku[] | null,
): ProjectSheetSku[] {
  if (explicit?.length) {
    const filtered = explicit.filter((s) => !isJatobaCollapse(s.label))
    if (filtered.length) return ensureBoxBack(filtered)
  }
  const built = buildProjectSheetPaletteFromExtraction(extraction)
  // Nunca cair no default só-branco se a extração/legenda já trouxe cores.
  if (built.some((s) => s.role === 'front_color') || built.length > 2) {
    return ensureBoxBack(built)
  }
  return ensureBoxBack(DEFAULT_BOX_BACK_PALETTE)
}

/**
 * Conta SKUs comerciais distintos (cor + mm), agrupando variações de Branco.
 * Gate E3: ≥ 5 no BOM do DET_CLÍNICA.
 */
export function countDistinctCommercialSheetSkus(
  sheets: Array<{ label: string; thickness_mm: number; sheets?: number }>,
): number {
  const keys = new Set<string>()
  for (const s of sheets) {
    if ((Number(s.sheets) || 0) <= 0 && s.sheets !== undefined) continue
    const label = normalizeLabel(s.label)
    const th = Number(s.thickness_mm) || 15
    let color = 'outro'
    if (WHITE_SHEET_RE.test(label)) color = 'branco'
    else if (/salerno/.test(label)) color = 'salerno'
    else if (/fontana|magma/.test(label)) color = 'fontana'
    else if (/carvalho/.test(label) && /lir/.test(label)) color = 'carvalho_lir'
    else if (/carvalho/.test(label)) color = 'carvalho'
    else if (/itapu/.test(label)) color = 'itapua'
    else if (/fossil|cinza\s*fossil/.test(label)) color = 'cinza_fossil'
    else if (/\blana\b/.test(label)) color = 'lana'
    else if (/areia/.test(label)) color = 'areia'
    else if (/freij/.test(label)) color = 'freijo'
    else if (/imbuia/.test(label)) color = 'imbuia'
    else if (/noite/.test(label)) color = 'noite'
    else if (COLOR_TOKEN_RE.test(label)) color = label.slice(0, 24)
    keys.add(`${color}|${th}`)
  }
  return keys.size
}

function ensureBoxBack(palette: ProjectSheetSku[]): ProjectSheetSku[] {
  const hasBox = palette.some((p) => p.role === 'box_white')
  const hasBack = palette.some((p) => p.role === 'back_white')
  const next = [...palette]
  if (!hasBack) next.unshift(DEFAULT_BOX_BACK_PALETTE[0])
  if (!hasBox) next.splice(hasBack ? 1 : 0, 0, DEFAULT_BOX_BACK_PALETTE[1])
  return next
}

/** Chaves de materiais esperadas no gate Épico 2. */
export const FLAVIANE_PALETTE_MATERIAL_KEYS = [
  'bege_papiro',
  'lord_matt',
  'mint_essencial',
  'blush_essencial',
  'azul_astral',
  'imbuia_caiapo',
  'areia_noronha',
  'branco_tx',
  'branco_eucatex',
  'branco_multimarcas',
] as const
