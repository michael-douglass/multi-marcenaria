import type { BomLine, ModuleSpec, ModuleTypology } from '@/lib/orcamentos-ia/bom-engine/types'
import type { BomPreferences } from '@/lib/orcamentos-ia/bom-engine/preferences'
import { effectiveMountingDevice } from '@/lib/orcamentos-ia/bom-engine/preferences'

/** Dobradiças pela altura da porta (PRD v11). */
export function hingesForDoorHeight(heightMm: number): number {
  if (heightMm <= 900) return 2
  if (heightMm <= 1600) return 3
  if (heightMm <= 2200) return 4
  return 5
}

/** Parafusos/cavilhas/minifix por junção típica de caixa. */
export function fastenersForBox(
  typology: ModuleTypology,
  prefs: BomPreferences,
  jointCount: number,
): BomLine[] {
  const device = effectiveMountingDevice(typology, prefs)
  const joints = Math.max(0, jointCount)
  if (joints === 0) return []

  if (device === 'dowel_only') {
    return [
      {
        item_category: 'fastener',
        item_description: 'Cavilha 8x30',
        quantity: joints * 2,
        unit_of_measure: 'unit',
        unit_cost: 0.15,
        metadata: { device },
      },
    ]
  }

  if (device === 'screw') {
    return [
      {
        item_category: 'fastener',
        item_description: 'Parafuso 4.0x40',
        quantity: joints * 2,
        unit_of_measure: 'unit',
        unit_cost: 0.12,
        metadata: { device },
      },
    ]
  }

  // minifix_dowel — Minifix + cavilha + VB35 (união de fundo/travessa, PRD v11)
  return [
    {
      item_category: 'fastener',
      item_description: 'Minifix (tambor + pino)',
      quantity: joints,
      unit_of_measure: 'unit',
      unit_cost: 1.8,
      metadata: { device },
    },
    {
      item_category: 'fastener',
      item_description: 'Cavilha 8x30',
      quantity: joints,
      unit_of_measure: 'unit',
      unit_cost: 0.15,
      metadata: { device },
    },
    {
      item_category: 'fastener',
      item_description: 'VB35',
      quantity: Math.max(2, Math.ceil(joints / 2)),
      unit_of_measure: 'unit',
      unit_cost: 0.95,
      metadata: { device, use: 'fundo_travessa' },
    },
  ]
}

export function drawerHardwareLines(
  drawerCount: number,
  prefs: BomPreferences,
  slideDepthMm: number,
): BomLine[] {
  if (drawerCount <= 0) return []
  const slideLabel =
    prefs.drawer_slide_type === 'touch'
      ? 'Corrediça Oculta Fecho Toque'
      : prefs.drawer_slide_type === 'hidden_soft_close'
        ? 'Corrediça Oculta Soft Close'
        : prefs.drawer_slide_type === 'telescopic_light'
          ? 'Corrediça Telescópica Light'
          : 'Corrediça Telescópica'
  return [
    {
      item_category: 'hardware',
      item_description: `${slideLabel} ${slideDepthMm}mm`,
      quantity: drawerCount,
      unit_of_measure: 'pair',
      unit_cost: prefs.drawer_slide_type.includes('hidden') || prefs.drawer_slide_type === 'touch' ? 85 : 28,
      metadata: { slide_type: prefs.drawer_slide_type },
    },
  ]
}

export function doorHardwareLines(
  doorCount: number,
  doorHeightMm: number,
  typology: ModuleTypology,
  slidingDoors?: 2 | 3 | 4,
): BomLine[] {
  if (typology === 'armario_correr' && slidingDoors) {
    const n = slidingDoors
    return [
      {
        item_category: 'hardware',
        item_description: `Trilho superior ${n} portas`,
        quantity: 1,
        unit_of_measure: 'unit',
        unit_cost: n === 2 ? 90 : n === 3 ? 130 : 170,
        metadata: { sliding_doors: n, part: 'track_top' },
      },
      {
        item_category: 'hardware',
        item_description: `Trilho inferior ${n} portas`,
        quantity: 1,
        unit_of_measure: 'unit',
        unit_cost: n === 2 ? 70 : n === 3 ? 100 : 130,
        metadata: { sliding_doors: n, part: 'track_bottom' },
      },
      {
        item_category: 'hardware',
        item_description: 'Rodízio / carro deslizante',
        quantity: n * 2,
        unit_of_measure: 'unit',
        unit_cost: 18,
        metadata: { sliding_doors: n, part: 'roller' },
      },
    ]
  }
  if (doorCount <= 0) return []
  const hinges = hingesForDoorHeight(doorHeightMm) * doorCount
  return [
    {
      item_category: 'hardware',
      item_description: 'Dobradiça Soft Close',
      quantity: hinges,
      unit_of_measure: 'unit',
      unit_cost: 15,
      metadata: { per_door: hingesForDoorHeight(doorHeightMm) },
    },
  ]
}

/** Puxador perfil em barras de 3 m + ponteiras. */
export function handleProfileLines(totalMeters: number): BomLine[] {
  if (totalMeters <= 0) return []
  const bars = Math.ceil(totalMeters / 3)
  return [
    {
      item_category: 'hardware',
      item_description: 'Puxador perfil alumínio (barra 3m)',
      quantity: bars,
      unit_of_measure: 'bar',
      unit_cost: 45,
      metadata: { meters_needed: Math.round(totalMeters * 1000) / 1000 },
    },
    {
      item_category: 'hardware',
      item_description: 'Ponteira puxador perfil',
      quantity: bars * 2,
      unit_of_measure: 'unit',
      unit_cost: 2.5,
    },
  ]
}

export function estimateHandleMeters(spec: ModuleSpec): number {
  const doors = spec.door_count ?? 0
  const drawers = spec.drawer_count ?? 0
  const sliding = spec.sliding_doors ?? 0
  // Cava em travessa (recess): usa comprimento horizontal da travessa, não perfil vertical
  if (spec.handle_recess_mm != null && (spec.typology === 'balcao' || spec.typology === 'aereo')) {
    const cavaM = (spec.width_mm / 1000) * Math.max(1, doors || 1)
    return Math.round(cavaM * 1000) / 1000
  }
  // Perfil vertical por porta ≈ altura; gaveta ≈ largura útil
  const doorM = (doors || sliding) * (spec.height_mm / 1000)
  const drawerM = drawers * (Math.min(spec.width_mm, 600) / 1000)
  return Math.round((doorM + drawerM) * 1000) / 1000
}
