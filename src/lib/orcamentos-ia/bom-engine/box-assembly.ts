import type { CutPiece, ModuleSpec, ModuleTypology } from '@/lib/orcamentos-ia/bom-engine/types'
import type { BomPreferences } from '@/lib/orcamentos-ia/bom-engine/preferences'
import {
  MIN_DRAWER_FRONT_MM,
  shouldSkipBackGroove,
} from '@/lib/orcamentos-ia/bom-engine/preferences'

let pieceSeq = 0
function pid(prefix: string): string {
  pieceSeq += 1
  return `${prefix}-${pieceSeq}`
}

export function resetPieceSeq(): void {
  pieceSeq = 0
}

function edgeFront(lengthMm: number) {
  return { front: lengthMm }
}

function edgeFrontSides(w: number, h: number) {
  return { front: w, left: h, right: h }
}

/**
 * Explode a caixa externa (laterais, base, tampo, fundo, prateleiras).
 * Desconta espessura do MDF conforme preferências de base/tampo.
 */
export function explodeBox(
  spec: ModuleSpec,
  prefs: BomPreferences,
  options?: {
    unilateralStretcher?: boolean
    skipBack?: boolean
    columnIndex?: number
  },
): CutPiece[] {
  const t = prefs.box_thickness_mm
  const W = spec.width_mm
  const H = spec.height_mm
  const D = spec.depth_mm
  const col = options?.column_index
  const doubledTop = Boolean(spec.doubled_top)
  const topThick = doubledTop ? t * 2 : t

  // Laterais: altura total; profundidade = D
  const laterals: CutPiece = {
    id: pid('lat'),
    role: 'lateral',
    name: 'Lateral',
    width_mm: D,
    height_mm: H,
    thickness_mm: t,
    quantity: 2,
    edge_lengths_mm: edgeFrontSides(D, H),
    skip_groove: options?.skipBack || shouldSkipBackGroove(spec.typology, true),
    column_index: col,
  }

  // Base
  let baseW: number
  let baseD: number
  if (prefs.base_assembly === 'under_sides') {
    baseW = W
    baseD = D
  } else {
    baseW = Math.max(0, W - 2 * t)
    baseD = D
  }
  const base: CutPiece = {
    id: pid('base'),
    role: 'base',
    name: 'Base',
    width_mm: baseW,
    height_mm: baseD,
    thickness_mm: t,
    quantity: 1,
    edge_lengths_mm: edgeFront(baseW),
    column_index: col,
  }

  // Tampo
  let topW: number
  let topD: number
  if (prefs.top_assembly === 'over_sides') {
    topW = W
    topD = D
  } else if (prefs.top_assembly === 'inside') {
    topW = Math.max(0, W - 2 * t)
    topD = Math.max(0, D - t)
  } else {
    topW = Math.max(0, W - 2 * t)
    topD = D
  }
  const tampo: CutPiece = {
    id: pid('tampo'),
    role: 'tampo',
    name: doubledTop ? 'Tampo engrossado' : 'Tampo',
    width_mm: topW,
    height_mm: topD,
    thickness_mm: topThick,
    quantity: 1,
    doubled: doubledTop,
    edge_lengths_mm: edgeFrontSides(topW, topD),
    column_index: col,
  }

  const pieces: CutPiece[] = [laterals, base, tampo]

  // Fundo
  const skipBack = options?.skipBack || shouldSkipBackGroove(spec.typology, true)
  if (!skipBack && prefs.back_panel_type !== 'screwed') {
    const backW = Math.max(0, W - 2 * t)
    const backH = Math.max(0, H - 2 * t)
    pieces.push({
      id: pid('fundo'),
      role: 'fundo',
      name: `Fundo ${prefs.back_panel_thickness}mm`,
      width_mm: backW,
      height_mm: backH,
      thickness_mm: prefs.back_panel_thickness,
      quantity: 1,
      edge_lengths_mm: {},
      skip_groove: false,
      column_index: col,
    })
  }

  // Prateleiras
  const shelves = spec.shelf_count ?? 0
  if (shelves > 0) {
    const shelfW = Math.max(0, W - 2 * t)
    const shelfD = Math.max(0, D - prefs.shelf_recess_mm - (skipBack ? 0 : prefs.back_panel_thickness))
    pieces.push({
      id: pid('prat'),
      role: 'prateleira',
      name: 'Prateleira',
      width_mm: shelfW,
      height_mm: shelfD,
      thickness_mm: t,
      quantity: shelves,
      edge_lengths_mm: edgeFront(shelfW),
      column_index: col,
    })
  }

  // Travessa dianteira (balcão / aéreo)
  if (spec.typology === 'balcao' || spec.typology === 'aereo' || spec.typology === 'gaveteiro') {
    const travW = Math.max(0, W - 2 * t)
    pieces.push({
      id: pid('trav'),
      role: 'travessa',
      name: 'Travessa dianteira',
      width_mm: travW,
      height_mm: 100,
      thickness_mm: t,
      quantity: 1,
      edge_lengths_mm: edgeFront(travW),
      column_index: col,
    })
  }

  // Sarrafo unilateral (armário de correr — evita colisão no transpasse)
  if (options?.unilateralStretcher) {
    pieces.push({
      id: pid('sarrafo'),
      role: 'sarrafo',
      name: 'Sarrafo de folga unilateral',
      width_mm: Math.max(0, D - t),
      height_mm: 50,
      thickness_mm: t,
      quantity: 1,
      edge_lengths_mm: {},
      column_index: col,
    })
  }

  return pieces
}

/** Frentes de gaveta + laterais/contrafundo/fundo de gaveta. */
export function explodeDrawers(
  spec: ModuleSpec,
  prefs: BomPreferences,
  warnings: string[],
): CutPiece[] {
  const count = spec.drawer_count ?? 0
  if (count <= 0) return []
  const t = prefs.box_thickness_mm
  const gap = prefs.front_gap_mm
  const frontH = Math.floor((spec.height_mm - gap * (count + 1)) / count)
  if (frontH < MIN_DRAWER_FRONT_MM) {
    warnings.push(
      `Altura da gaveta/vão ${frontH} mm < ${MIN_DRAWER_FRONT_MM} mm (mínimo CNC/ventosas). Ajuste cotas.`,
    )
  }
  const frontW = Math.max(0, spec.width_mm - 2 * gap)
  const slideDepth = Math.max(250, Math.min(550, Math.round(spec.depth_mm / 50) * 50 - 50))

  const pieces: CutPiece[] = [
    {
      id: pid('fg'),
      role: 'frente',
      name: 'Frente de gaveta',
      width_mm: frontW,
      height_mm: frontH,
      thickness_mm: t,
      quantity: count,
      edge_lengths_mm: edgeFrontSides(frontW, frontH),
    },
    {
      id: pid('gl'),
      role: 'gaveta_lateral',
      name: 'Lateral de gaveta',
      width_mm: slideDepth,
      height_mm: Math.max(80, frontH - 20),
      thickness_mm: t,
      quantity: count * 2,
      edge_lengths_mm: edgeFront(slideDepth),
    },
    {
      id: pid('gcf'),
      role: 'gaveta_contrafundo',
      name: 'Contrafundo de gaveta',
      width_mm: Math.max(0, frontW - 2 * t - 26),
      height_mm: Math.max(80, frontH - 20),
      thickness_mm: t,
      quantity: count,
      edge_lengths_mm: {},
    },
    {
      id: pid('gf'),
      role: 'gaveta_fundo',
      name: 'Fundo de gaveta 6mm',
      width_mm: Math.max(0, frontW - 2 * t - 26),
      height_mm: slideDepth - 10,
      thickness_mm: 6,
      quantity: count,
      edge_lengths_mm: {},
    },
  ]
  return pieces
}

export function explodeDoors(spec: ModuleSpec, prefs: BomPreferences): CutPiece[] {
  const t = prefs.box_thickness_mm
  const gap = prefs.front_gap_mm
  if (spec.typology === 'armario_correr' && spec.sliding_doors) {
    const n = spec.sliding_doors
    const doorW = Math.ceil(spec.width_mm / n) + 20 // sobreposição típica
    return [
      {
        id: pid('porta-c'),
        role: 'porta',
        name: `Porta de correr (${n})`,
        width_mm: doorW,
        height_mm: Math.max(0, spec.height_mm - gap),
        thickness_mm: t,
        quantity: n,
        edge_lengths_mm: edgeFrontSides(doorW, spec.height_mm),
      },
    ]
  }
  const doors = spec.door_count ?? 0
  if (doors <= 0) return []
  const doorW = Math.max(0, (spec.width_mm - gap * (doors + 1)) / doors)
  return [
    {
      id: pid('porta'),
      role: 'porta',
      name: 'Porta de giro',
      width_mm: doorW,
      height_mm: Math.max(0, spec.height_mm - 2 * gap),
      thickness_mm: t,
      quantity: doors,
      edge_lengths_mm: edgeFrontSides(doorW, spec.height_mm),
    },
  ]
}

export function inferTypology(name: string): ModuleTypology {
  const n = name.toLowerCase()
  if (/nicho|nicho aberto|cubo/.test(n)) return 'nicho'
  if (/correr|desliz/.test(n)) return 'armario_correr'
  if (/roupeiro|guarda[- ]?roupa|arm[aá]rio/.test(n) && /giro|porta/.test(n)) return 'armario_giro'
  if (/roupeiro|guarda[- ]?roupa/.test(n)) return 'armario_giro'
  if (/a[eé]reo|arm[aá]rio a[eé]reo/.test(n)) return 'aereo'
  if (/painel|ripado/.test(n)) return 'painel'
  if (/gaveteiro|gaveta/.test(n) && !/balc/.test(n)) return 'gaveteiro'
  // Bancada/ilha de gourmet → tipagem de balcão (não cair em "outro"/mesa)
  if (/bancada|ilha/.test(n)) return 'balcao'
  if (/balc[aã]o|baixo|cooktop|pia/.test(n)) return 'balcao'
  // Mesa/escrivaninha: tipologia explícita (BOM genérico em "outro", sem confundir com bancada)
  if (/\bmesa\b|escrivaninha/.test(n) && !/cabeceira/.test(n)) return 'outro'
  return 'outro'
}
