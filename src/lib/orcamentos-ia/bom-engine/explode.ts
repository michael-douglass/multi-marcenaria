import type { ExplodeResult, ModuleSpec, BomLine, CutPiece } from '@/lib/orcamentos-ia/bom-engine/types'
import {
  resolveBomPreferences,
  effectiveMountingDevice,
  type BomPreferences,
} from '@/lib/orcamentos-ia/bom-engine/preferences'
import {
  explodeBox,
  explodeDrawers,
  explodeDoors,
  inferTypology,
  resetPieceSeq,
} from '@/lib/orcamentos-ia/bom-engine/box-assembly'
import { edgebandBomLines } from '@/lib/orcamentos-ia/bom-engine/edgeband'
import {
  fastenersForBox,
  drawerHardwareLines,
  doorHardwareLines,
  handleProfileLines,
  estimateHandleMeters,
} from '@/lib/orcamentos-ia/bom-engine/hardware'
import { boardBomLines, totalBoardAreaM2 } from '@/lib/orcamentos-ia/bom-engine/sheets'
import type { SystemPreferences } from '@/lib/orcamentos-ia/system-preferences'

export interface ExplodeOptions {
  prefs?: Partial<SystemPreferences> | null
  unitCostPerM2?: number
  moduleQty?: number
}

/**
 * Desmonte determinístico HelloMob/Cortecloud:
 * cotas + preferências + tipologia → peças + BOM + Chain of Thought.
 */
export function explodeModule(spec: ModuleSpec, options: ExplodeOptions = {}): ExplodeResult {
  resetPieceSeq()
  const warnings: string[] = []
  const prefs = resolveBomPreferences(options.prefs)
  const typology = spec.typology || inferTypology(spec.name)
  const working: ModuleSpec = { ...spec, typology }
  const mounting = effectiveMountingDevice(typology, prefs)
  const qty = Math.max(1, options.moduleQty ?? working.quantity ?? 1)

  const thought: string[] = [
    `Interpretação: módulo "${working.name}" como tipologia ${typology}.`,
    `Cotas externas: L=${working.width_mm} × A=${working.height_mm} × P=${working.depth_mm} mm.`,
    `Preferências: base=${prefs.base_assembly}, tampo=${prefs.top_assembly}, MDF=${prefs.box_thickness_mm} mm, fixação efetiva=${mounting}.`,
  ]

  if (typology === 'nicho') {
    thought.push('Nicho aberto: forçando montagem 100% cavilha e sem fundo rasgado (topos expostos).')
  }

  let pieces: CutPiece[] = []

  if (typology === 'armario_giro' && (working.column_widths_mm?.length ?? 0) > 1) {
    const cols = working.column_widths_mm!
    thought.push(`Armário de giro: ${cols.length} colunas independentes (${cols.join(' + ')} mm).`)
    cols.forEach((cw, i) => {
      const colSpec: ModuleSpec = {
        ...working,
        width_mm: cw,
        door_count: working.door_count ? Math.max(1, Math.round((working.door_count ?? 0) / cols.length)) : 1,
        drawer_count: i === 0 ? working.drawer_count : 0,
        shelf_count: working.shelf_count ?? (working.top_shelf ? 1 : 0),
      }
      pieces.push(...explodeBox(colSpec, prefs, { columnIndex: i + 1 }))
      pieces.push(...explodeDoors(colSpec, prefs))
      if (i === 0) pieces.push(...explodeDrawers(colSpec, prefs, warnings))
    })
  } else if (typology === 'armario_correr') {
    const sliding = working.sliding_doors ?? 2
    thought.push(
      `Armário de correr: frente coluna única + kit ${sliding} portas; recuo zero interno; sarrafo unilateral.`,
    )
    pieces.push(
      ...explodeBox(
        { ...working, sliding_doors: sliding, door_count: 0 },
        prefs,
        { unilateralStretcher: true },
      ),
    )
    pieces.push(...explodeDoors({ ...working, sliding_doors: sliding }, prefs))
    pieces.push(...explodeDrawers(working, prefs, warnings))
  } else if (typology === 'painel') {
    thought.push('Painel: peça principal + sarrafos/mão amiga.')
    const t = prefs.box_thickness_mm
    pieces.push({
      id: 'painel-1',
      role: 'outro',
      name: working.doubled_top ? 'Painel engrossado' : 'Painel',
      width_mm: working.width_mm,
      height_mm: working.height_mm,
      thickness_mm: working.doubled_top ? t * 2 : t,
      quantity: 1,
      doubled: working.doubled_top,
      edge_lengths_mm: {
        front: working.width_mm,
        back: working.width_mm,
        left: working.height_mm,
        right: working.height_mm,
      },
    })
    pieces.push({
      id: 'sarrafo-painel',
      role: 'sarrafo',
      name: 'Sarrafo mão amiga',
      width_mm: working.width_mm,
      height_mm: 70,
      thickness_mm: t,
      quantity: 3,
      edge_lengths_mm: {},
    })
  } else {
    const skipBack = typology === 'nicho'
    pieces.push(...explodeBox(working, prefs, { skipBack }))
    pieces.push(...explodeDoors(working, prefs))
    pieces.push(...explodeDrawers(working, prefs, warnings))
  }

  // Multiplicar módulo
  if (qty > 1) {
    thought.push(`Multiplicação Qtd=${qty}: duplicando peças no plano de corte.`)
    pieces = pieces.map((p) => ({ ...p, quantity: p.quantity * qty }))
  }

  // Descontos de espessura documentados
  const t = prefs.box_thickness_mm
  const lateral = pieces.find((p) => p.role === 'lateral')
  const base = pieces.find((p) => p.role === 'base')
  if (lateral && base) {
    thought.push(
      `Laterais: ${lateral.width_mm}×${lateral.height_mm}×${lateral.thickness_mm} mm (qtd ${lateral.quantity}).`,
    )
    thought.push(
      `Base (${prefs.base_assembly}): ${base.width_mm}×${base.height_mm} mm` +
        (prefs.base_assembly === 'between_sides' ? ` (largura = L − 2×${t}).` : ' (passante = L).'),
    )
  }

  const materialName = working.material_name ?? `MDF ${prefs.box_thickness_mm}mm`
  const unitCost = options.unitCostPerM2 ?? 45
  const bom: BomLine[] = [
    ...boardBomLines(pieces, materialName, unitCost),
    ...edgebandBomLines(pieces),
  ]

  // Junções aproximadas: 4 cantos + prateleiras×2 + gavetas×4
  const shelves = (working.shelf_count ?? 0) * qty
  const drawers = (working.drawer_count ?? 0) * qty
  const joints = 4 + shelves * 2 + drawers * 2
  bom.push(...fastenersForBox(typology, prefs, joints))

  const slideDepth = Math.max(250, Math.min(550, Math.round(working.depth_mm / 50) * 50 - 50))
  bom.push(...drawerHardwareLines(drawers, prefs, slideDepth))
  bom.push(
    ...doorHardwareLines(
      (working.door_count ?? 0) * qty,
      working.height_mm,
      typology,
      working.sliding_doors,
    ),
  )

  if (prefs.drawer_slide_type !== 'touch') {
    bom.push(...handleProfileLines(estimateHandleMeters(working) * qty))
  } else {
    thought.push('Fecho toque: sem puxador perfil visível.')
  }

  const area = totalBoardAreaM2(pieces)
  thought.push(
    `Área de chapas: ${area.toFixed(3)} m² → conversão comercial com perda 15% (chapa 2,75×1,85 = 5,0875 m²).`,
  )
  thought.push(
    `Fitas: ${bom
      .filter((b) => b.item_category === 'edgeband')
      .map((b) => `${b.item_description}=${b.quantity} m`)
      .join(', ') || 'nenhuma'}.`,
  )
  thought.push(`Ferragens/conectores calculados por unidade individual (nunca por pacote).`)

  if (working.doubled_top) {
    thought.push('Engrosso detectado: fita larga 35/45 mm obrigatória na emenda.')
  }
  if (working.room_tag) {
    thought.push(`Etiqueta de ambiente: ${working.room_tag}.`)
  }

  for (const w of warnings) thought.push(`AVISO: ${w}`)

  return {
    pieces,
    bom: scaleBomCosts(bom),
    chainOfThought: thought.join('\n'),
    warnings,
    mountingDevice: mounting,
  }
}

function scaleBomCosts(bom: BomLine[]): BomLine[] {
  return bom.map((line) => ({
    ...line,
    quantity: Math.round(line.quantity * 1000) / 1000,
  }))
}

export function explodeFromExtractionModule(
  mod: {
    name: string
    dimensions?: { width_mm?: number | null; height_mm?: number | null; depth_mm?: number | null }
    caixaria?: Array<{ function?: string | null }>
    frentes_portas?: Array<{ kind?: string | null }>
    room_tag?: string
  },
  prefs?: Partial<SystemPreferences> | null,
): ExplodeResult {
  const name = mod.name || 'Módulo'
  const typology = inferTypology(name)
  const drawers =
    mod.frentes_portas?.filter((f) => f.kind === 'frente_gaveta').length ??
    (typology === 'balcao' || typology === 'gaveteiro' ? 3 : 0)
  const doors =
    mod.frentes_portas?.filter((f) => f.kind === 'porta' || f.kind === 'porta_correr').length ??
    (typology === 'aereo' || typology === 'armario_giro' ? 2 : 0)
  const shelves = mod.caixaria?.filter((c) => c.function === 'prateleira').length ?? 0

  return explodeModule(
    {
      name,
      typology,
      width_mm: Number(mod.dimensions?.width_mm) || 800,
      height_mm: Number(mod.dimensions?.height_mm) || 720,
      depth_mm: Number(mod.dimensions?.depth_mm) || 500,
      drawer_count: drawers,
      door_count: doors,
      shelf_count: shelves,
      sliding_doors: typology === 'armario_correr' ? 2 : undefined,
      room_tag: mod.room_tag,
    },
    { prefs },
  )
}

export type { BomPreferences }
