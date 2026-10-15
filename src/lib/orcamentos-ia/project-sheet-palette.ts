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

const COLOR_TOKEN_RE =
  /bege\s*papiro|papiro|lord\s*matt|\blord\b|mint\s*essencial|\bmint\b|blush\s*essencial|\bblush\b|azul\s*astral|\bazul\b|imbuia\s*caiap|\bimbuia\b|areia\s*noronha|\bareia\b|amendoeira|\blino\b|freij|noite|duna|hanover|reflecta|jatob/i

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

        if (/branco|tx|white|eucatex|multimarcas/i.test(mat)) {
          add({
            label: mat,
            thickness_mm,
            role: thickness_mm === 6 ? 'back_white' : 'box_white',
          })
          continue
        }

        if (COLOR_TOKEN_RE.test(mat) || COLOR_TOKEN_RE.test(p.name || '')) {
          // Preferir label canônico Flaviane quando o token bater
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
  if (built.some((s) => s.role === 'front_color')) return ensureBoxBack(built)
  return ensureBoxBack(DEFAULT_BOX_BACK_PALETTE)
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
