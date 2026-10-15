/**
 * Regras construtivas HelloMob / Cortecloud para posicionamento Raio-X 3D.
 * Espelho runtime de docs/evidence/hellomob-construction-rules.json
 * (geometria apenas — sem precificação).
 */

export interface HellomobBackPanelRules {
  thickness_mm: 6
  rebate_depth_mm: number
  inset_from_rear_mm: number
}

export interface HellomobBoxRules {
  thickness_mm: 15 | 18
  base_assembly: 'under_sides' | 'between_sides'
  top_assembly: 'over_sides' | 'between_sides' | 'inside'
}

export interface HellomobConstructionRules {
  back_panel: HellomobBackPanelRules
  box: HellomobBoxRules
  front_gap_mm: number
  front_thickness_mm: number
  shelf_recess_mm: number
  plinth_typical_height_mm: number
  /** Regex sources (sem flags) para tipologias abertas / mesa. */
  open_typology_patterns: string[]
  open_allowed_roles: readonly string[]
  open_forbidden_roles: readonly string[]
}

/** Default alinhado ao plano HelloMob #23574204 + System Preferences Cortecloud. */
export const HELLOMOB_CONSTRUCTION_RULES: HellomobConstructionRules = {
  back_panel: {
    thickness_mm: 6,
    rebate_depth_mm: 10,
    inset_from_rear_mm: 10,
  },
  box: {
    thickness_mm: 15,
    base_assembly: 'under_sides',
    top_assembly: 'over_sides',
  },
  front_gap_mm: 2,
  front_thickness_mm: 18,
  shelf_recess_mm: 10,
  plinth_typical_height_mm: 100,
  open_typology_patterns: ['\\bmesa\\b', 'escrivaninha', 'bancada\\s*aberta'],
  open_allowed_roles: ['tampo', 'sarrafo', 'travessa', 'outro', 'frente'],
  open_forbidden_roles: ['fundo', 'base', 'prateleira', 'divisoria'],
}

export function detectOpenTypology(moduleName?: string | null, typology?: string | null): boolean {
  const hay = `${moduleName ?? ''} ${typology ?? ''}`.toLowerCase()
  if (!hay.trim()) return false
  // Mesa de jantar / escrivaninha — não bancada/ilha de gourmet fechada
  if (/\bbancada\b|\bilha\b|\bbalc[aã]o\b/.test(hay) && !/\bmesa\b/.test(hay)) return false
  return HELLOMOB_CONSTRUCTION_RULES.open_typology_patterns.some((src) => {
    try {
      return new RegExp(src, 'i').test(hay)
    } catch {
      return false
    }
  })
}

/** Z do centro do fundo (metros): senta no rebaixo traseiro. */
export function backPanelCenterZ_m(
  depth_m: number,
  thickness_m: number,
  rules: HellomobBackPanelRules = HELLOMOB_CONSTRUCTION_RULES.back_panel,
): number {
  const rebate = rules.rebate_depth_mm / 1000
  // Face traseira do fundo alinhada a D − (rebate − th) … centro = D − rebate + th/2
  return depth_m - rebate + thickness_m / 2
}
