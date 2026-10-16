/**
 * Builder client-side de peças atômicas para o Raio-X 3D.
 * Prioridade: lista de corte → last_extraction → explode determinístico.
 * Zero custo de API.
 */
import { isCuttingListNote } from '@/lib/orcamentos-ia/pricing'
import type {
  AtomicPiece,
  AtomicPieceRole,
  AtomicSheetRole,
  QuoteExtraction,
} from '@/lib/orcamentos-ia/schemas'
import type { QuoteMaterialRow, QuoteModuleRow } from '@/lib/orcamentos-ia/quote-tree'
import {
  explodeFromExtractionModule,
  type ExplodeResultWithLabels,
} from '@/lib/orcamentos-ia/bom-engine/explode'
import type { CutPiece, PieceRole } from '@/lib/orcamentos-ia/bom-engine/types'
import {
  buildBoxMeshesFromBom,
  type BoxMeshDesc,
} from '@/lib/orcamentos-ia/bom-engine/xray-geometry'

const ROLE_SET = new Set<string>([
  'lateral',
  'base',
  'tampo',
  'divisoria',
  'prateleira',
  'fundo',
  'travessa',
  'sarrafo',
  'frente',
  'porta',
  'gaveta_lateral',
  'gaveta_contrafundo',
  'gaveta_fundo',
  'outro',
])

const FRENTE_KIND_TO_ROLE: Record<string, AtomicPieceRole> = {
  porta_giro: 'porta',
  porta_correr: 'porta',
  basculante: 'porta',
  frente_gaveta: 'frente',
  frente_falsa: 'frente',
  tamponamento: 'frente',
  porta: 'porta',
}

export interface BuildAtomicPiecesInput {
  module: QuoteModuleRow
  /** Extração completa em totals.last_extraction (opcional). */
  lastExtraction?: unknown
  selectedPieceId?: string | null
  boxThicknessMm?: number
}

export interface BuildAtomicPiecesResult {
  atomic_pieces: AtomicPiece[]
  source: 'cutting_list' | 'extraction' | 'explode'
  explode?: ExplodeResultWithLabels | null
}

function asRole(raw: string | undefined | null): AtomicPieceRole {
  if (!raw) return 'outro'
  const key = raw
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
  if (ROLE_SET.has(key)) return key as AtomicPieceRole
  if (key.includes('lateral')) return 'lateral'
  if (key.includes('prateleira')) return 'prateleira'
  if (key.includes('fundo') || key.includes('contrafundo')) return 'fundo'
  if (key.includes('tampo')) return 'tampo'
  if (key.includes('base')) return 'base'
  if (key.includes('divis')) return 'divisoria'
  if (key.includes('porta')) return 'porta'
  if (key.includes('frente') || key.includes('gaveta')) return 'frente'
  if (key.includes('travessa') || key.includes('sarrafo') || key.includes('roda')) return 'sarrafo'
  return 'outro'
}

function inferSheetRole(
  role: AtomicPieceRole,
  thicknessMm: number,
  materialName: string,
): AtomicSheetRole {
  if (role === 'frente' || role === 'porta') return 'front_color'
  if (role === 'fundo' || thicknessMm <= 8) return 'back_white'
  if (/branco|white|tx\b/i.test(materialName) && !/amendoeira|lino|bege|mint|blush|azul|imbuia|areia|jatob/i.test(materialName)) {
    return 'box_white'
  }
  // Neste ponto role !== 'fundo' (já retornou acima).
  if (/amendoeira|lino|bege|mint|blush|azul|imbuia|areia|papiro|lord|noronha|caiap|astral|chess|bold/i.test(materialName)) {
    return 'front_color'
  }
  return 'box_white'
}

function moduleDims(mod: QuoteModuleRow): {
  width_mm: number
  height_mm: number
  depth_mm: number
} {
  const d = mod.dimensions ?? {}
  return {
    width_mm: Number(d.width_mm) || 800,
    height_mm: Number(d.height_mm) || 720,
    depth_mm: Number(d.depth_mm) || 500,
  }
}

function parseCuttingListMaterial(mat: QuoteMaterialRow): {
  name: string
  material_name: string
  role: AtomicPieceRole
  width_mm: number
  height_mm: number
  thickness_mm: number
  quantity: number
} | null {
  if (!isCuttingListNote(mat.notes)) return null
  const notes = mat.notes ?? ''
  const [pieceName, materialPart] = mat.raw_name.includes('—')
    ? mat.raw_name.split('—').map((s) => s.trim())
    : [mat.raw_name, mat.raw_name]
  const fnMatch = notes.match(/fun[cç][aã]o\s*=\s*([a-z_]+)/i)
  const tipoMatch = notes.match(/tipo\s*=\s*([a-z_]+)/i)
  const dimsMatch = notes.match(
    /(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)x(\d+(?:\.\d+)?)mm(?:\s*[×x]\s*(\d+(?:\.\d+)?))?/i,
  )
  if (!dimsMatch) return null

  let role: AtomicPieceRole = 'outro'
  if (fnMatch) role = asRole(fnMatch[1])
  else if (tipoMatch) role = FRENTE_KIND_TO_ROLE[tipoMatch[1]] ?? asRole(tipoMatch[1])
  else role = asRole(pieceName)

  return {
    name: pieceName || 'Peça',
    material_name: materialPart || pieceName || 'MDF',
    role,
    width_mm: Number(dimsMatch[1]),
    height_mm: Number(dimsMatch[2]),
    thickness_mm: Number(dimsMatch[3]),
    quantity: Math.max(1, Number(dimsMatch[4] ?? mat.exact_quantity) || 1),
  }
}

function cutPiecesFromCuttingList(materials: QuoteMaterialRow[]): CutPiece[] {
  const out: CutPiece[] = []
  let i = 0
  for (const mat of materials) {
    const parsed = parseCuttingListMaterial(mat)
    if (!parsed) continue
    out.push({
      id: mat.id || `cut-${i++}`,
      role: parsed.role as PieceRole,
      name: parsed.name,
      width_mm: parsed.width_mm,
      height_mm: parsed.height_mm,
      thickness_mm: parsed.thickness_mm,
      quantity: parsed.quantity,
      edge_lengths_mm: {},
    })
  }
  return out
}

interface ExtractionModuleSlice {
  name: string
  typology?: string
  dimensions?: { width_mm?: number; height_mm?: number; depth_mm?: number }
  caixaria?: Array<{
    name: string
    function?: string
    width_mm: number
    height_mm: number
    thickness_mm: number
    quantity?: number
    material_name?: string
  }>
  frentes_portas?: Array<{
    name: string
    kind?: string
    width_mm: number
    height_mm: number
    thickness_mm: number
    quantity?: number
    material_name?: string
  }>
  door_count?: number
  drawer_count?: number
  shelf_count?: number
}

function findExtractionModule(
  lastExtraction: unknown,
  moduleName: string,
): ExtractionModuleSlice | null {
  if (!lastExtraction || typeof lastExtraction !== 'object') return null
  const ext = lastExtraction as Partial<QuoteExtraction>
  const envs = Array.isArray(ext.environments) ? ext.environments : []
  const target = moduleName.trim().toLowerCase()
  for (const env of envs) {
    for (const mod of env.modules ?? []) {
      if (
        String(mod.name ?? '')
          .trim()
          .toLowerCase() === target
      ) {
        return mod as ExtractionModuleSlice
      }
    }
  }
  for (const env of envs) {
    for (const mod of env.modules ?? []) {
      const n = String(mod.name ?? '')
        .trim()
        .toLowerCase()
      if (n && (n.includes(target) || target.includes(n))) {
        return mod as ExtractionModuleSlice
      }
    }
  }
  return null
}

function cutPiecesFromExtraction(mod: ExtractionModuleSlice): {
  pieces: CutPiece[]
  meta: Map<string, { material_name: string; sheet_role: AtomicSheetRole }>
} {
  const pieces: CutPiece[] = []
  const meta = new Map<string, { material_name: string; sheet_role: AtomicSheetRole }>()
  let i = 0

  for (const p of mod.caixaria ?? []) {
    const id = `ext-cx-${i++}`
    const role = asRole(p.function)
    const material_name = p.material_name || 'MDF Branco TX'
    pieces.push({
      id,
      role: role as PieceRole,
      name: p.name,
      width_mm: p.width_mm,
      height_mm: p.height_mm,
      thickness_mm: p.thickness_mm,
      quantity: Math.max(1, p.quantity ?? 1),
      edge_lengths_mm: {},
    })
    meta.set(id, {
      material_name,
      sheet_role: inferSheetRole(role, p.thickness_mm, material_name),
    })
  }

  for (const f of mod.frentes_portas ?? []) {
    const id = `ext-fr-${i++}`
    const role = FRENTE_KIND_TO_ROLE[f.kind ?? ''] ?? 'frente'
    const material_name = f.material_name || 'MDF Frente'
    pieces.push({
      id,
      role: role as PieceRole,
      name: f.name,
      width_mm: f.width_mm,
      height_mm: f.height_mm,
      thickness_mm: f.thickness_mm,
      quantity: Math.max(1, f.quantity ?? 1),
      edge_lengths_mm: {},
    })
    meta.set(id, {
      material_name,
      sheet_role: 'front_color',
    })
  }

  return { pieces, meta }
}

function meshToAtomic(
  mesh: BoxMeshDesc,
  material_name: string,
  sheet_role: AtomicSheetRole,
): AtomicPiece {
  return {
    id: mesh.id,
    name: mesh.name,
    role: asRole(mesh.role),
    width_mm: Math.round(Math.max(mesh.size[0], mesh.size[1], mesh.size[2]) * 1000),
    height_mm: Math.round(
      [...mesh.size].sort((a, b) => b - a)[1] * 1000,
    ),
    thickness_mm: mesh.thickness_mm,
    quantity: 1,
    material_name,
    sheet_role,
    position_m: mesh.position,
    size_m: mesh.size,
    highlighted: mesh.highlighted,
    gapTag: mesh.gapTag,
    column_index: mesh.column_index,
  }
}

function materialMetaForCutPieces(
  pieces: CutPiece[],
  materials: QuoteMaterialRow[],
): Map<string, { material_name: string; sheet_role: AtomicSheetRole }> {
  const meta = new Map<string, { material_name: string; sheet_role: AtomicSheetRole }>()
  const parsed = materials
    .map((m) => ({ mat: m, p: parseCuttingListMaterial(m) }))
    .filter((x): x is { mat: QuoteMaterialRow; p: NonNullable<ReturnType<typeof parseCuttingListMaterial>> } =>
      Boolean(x.p),
    )

  for (const piece of pieces) {
    const baseId = piece.id.replace(/-\d+$/, '')
    const hit =
      parsed.find((x) => x.mat.id === piece.id || x.mat.id === baseId) ??
      parsed.find((x) => x.p.name === piece.name && asRole(x.p.role) === piece.role) ??
      parsed.find((x) => asRole(x.p.role) === piece.role)

    const material_name = hit?.p.material_name ?? (piece.role === 'frente' || piece.role === 'porta'
      ? 'MDF Frente'
      : piece.role === 'fundo'
        ? 'MDF Branco 6mm'
        : 'MDF Branco TX')
    const role = piece.role as AtomicPieceRole
    meta.set(piece.id, {
      material_name,
      sheet_role: inferSheetRole(role, piece.thickness_mm, material_name),
    })
  }
  return meta
}

/**
 * Monta peças atômicas posicionadas para o Raio-X 3D (100% client-side).
 */
export function buildAtomicPieces(input: BuildAtomicPiecesInput): BuildAtomicPiecesResult {
  const dims = moduleDims(input.module)
  const boxT = input.boxThicknessMm ?? 15
  const materials = input.module.materials ?? []

  let pieces: CutPiece[] = cutPiecesFromCuttingList(materials)
  let source: BuildAtomicPiecesResult['source'] = 'cutting_list'
  let meta = materialMetaForCutPieces(pieces, materials)
  let explode: ExplodeResultWithLabels | null = null

  if (!pieces.length) {
    const extMod = findExtractionModule(input.lastExtraction, input.module.name)
    if (extMod && ((extMod.caixaria?.length ?? 0) > 0 || (extMod.frentes_portas?.length ?? 0) > 0)) {
      const fromExt = cutPiecesFromExtraction(extMod)
      pieces = fromExt.pieces
      meta = fromExt.meta
      source = 'extraction'
    }
  }

  if (!pieces.length) {
    explode = explodeFromExtractionModule(
      {
        name: input.module.name,
        dimensions: dims,
        typology: undefined,
      },
      null,
    )
    pieces = explode.pieces
    source = 'explode'
    meta = materialMetaForCutPieces(pieces, materials)
    for (const p of pieces) {
      if (!meta.has(p.id)) {
        const role = p.role as AtomicPieceRole
        const material_name =
          role === 'fundo'
            ? `MDF Branco ${p.thickness_mm}mm`
            : role === 'frente' || role === 'porta'
              ? 'MDF Frente'
              : `MDF Branco TX ${p.thickness_mm}mm`
        meta.set(p.id, {
          material_name,
          sheet_role: inferSheetRole(role, p.thickness_mm, material_name),
        })
      }
    }
  }

  const meshes = buildBoxMeshesFromBom(pieces, {
    moduleWidthMm: dims.width_mm,
    moduleHeightMm: dims.height_mm,
    moduleDepthMm: dims.depth_mm,
    boxThicknessMm: boxT,
    selectedPieceId: input.selectedPieceId,
    moduleName: input.module.name,
  })

  const atomic_pieces: AtomicPiece[] = meshes.map((mesh) => {
    const baseId = mesh.id.replace(/-\d+$/, '')
    const m =
      meta.get(mesh.id) ??
      meta.get(baseId) ?? {
        material_name: 'MDF',
        sheet_role: inferSheetRole(asRole(mesh.role), mesh.thickness_mm, 'MDF'),
      }
    return meshToAtomic(mesh, m.material_name, m.sheet_role)
  })

  return { atomic_pieces, source, explode }
}

/** Opacidade estrutural (vidro MDF Branco TX) — Épico 3 HelloMob. */
export const XRAY_BOX_OPACITY = 0.6
/** Opacidade frentes decorativas (Amendoeira/Noite/Lino…). */
export const XRAY_FRONT_OPACITY = 0.85

function frontDecorativeColor(name: string): string {
  if (/amendoeira/.test(name)) return '#c4a06a'
  if (/lino/.test(name)) return '#d4c4a8'
  if (/noite|noir|preto|black|lord|matt|grafite|chumbo/.test(name)) return '#3a3f47'
  if (/bege|papiro/.test(name)) return '#e6d5b8'
  if (/mint/.test(name)) return '#a8c9b8'
  if (/blush/.test(name)) return '#d4a5a5'
  if (/azul|astral/.test(name)) return '#5b7cfa'
  if (/imbuia|caiap/.test(name)) return '#8b5a3c'
  if (/areia|noronha/.test(name)) return '#cbb89a'
  if (/salerno/.test(name)) return '#b8956a'
  if (/fontana|magma/.test(name)) return '#8a6a4a'
  if (/carvalho/.test(name)) return '#c4a574'
  if (/itapu/.test(name)) return '#d2b48c'
  if (/fossil|cinza/.test(name)) return '#8b9098'
  if (/\blana\b/.test(name)) return '#d8cfc0'
  if (/jatob/.test(name)) return '#a67c52'
  if (/branco|white/.test(name)) return '#f5f7fa'
  return '#c4a574'
}

/** Hex aproximado da paleta (client-side, sem API). */
export function colorForAtomicPiece(piece: AtomicPiece): {
  color: string
  opacity: number
} {
  if (piece.highlighted) {
    return { color: '#0066FF', opacity: 0.88 }
  }

  const name = piece.material_name.toLowerCase()
  const isFront =
    piece.sheet_role === 'front_color' ||
    piece.role === 'frente' ||
    piece.role === 'porta'

  if (isFront) {
    return { color: frontDecorativeColor(name), opacity: XRAY_FRONT_OPACITY }
  }

  if (piece.sheet_role === 'back_white' || piece.role === 'fundo') {
    return { color: '#f2f4f7', opacity: XRAY_BOX_OPACITY }
  }

  // Caixaria estrutural translúcida (laterais, base, prateleira, divisória…)
  return { color: '#e8ecef', opacity: XRAY_BOX_OPACITY }
}
