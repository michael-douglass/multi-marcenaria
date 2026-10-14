/**
 * Company Standards — Default-with-Override (padrão fabril Cortecloud).
 *
 * Persistência: tabela `system_preferences` (+ view SQL `company_standards`).
 * Defaults de fábrica vêm pré-configurados; o marceneiro sobrescreve no modal
 * e Extrator/Auditor / bom-engine respeitam 100% o valor salvo.
 */
import { z } from 'zod'
import {
  DEFAULT_COMPANY_STANDARDS,
  getSystemPreferences,
  upsertSystemPreferences,
  type SystemPreferences,
} from '@/lib/orcamentos-ia/system-preferences'

export { DEFAULT_COMPANY_STANDARDS }

/** Construção de gaveta — alinhado ao kit Cortecloud (plano 23574204). */
export const drawerConstructionSchema = z.enum([
  'kit_fabril_5_pecas',
  'frente_only',
  'custom',
])

export type DrawerConstruction = z.infer<typeof drawerConstructionSchema>

/**
 * Schema Zod dos padrões da empresa (nativos + sobrescrita tipada).
 * `back_thickness_mm` é o nome de produto; persiste como `back_panel_thickness`.
 */
export const companyStandardsSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().min(1),
  base_assembly: z.enum(['under_sides', 'between_sides']),
  top_assembly: z.enum(['over_sides', 'between_sides', 'inside']),
  mounting_device: z.enum(['screw', 'minifix_dowel', 'dowel_only']),
  back_panel_type: z.enum(['grooved', 'rebated', 'screwed', 'reinforced']),
  back_thickness_mm: z.union([z.literal(3), z.literal(6), z.literal(15)]),
  back_panel_thickness: z.union([z.literal(3), z.literal(6), z.literal(15)]),
  drawer_slide_type: z.enum([
    'telescopic',
    'telescopic_light',
    'hidden_soft_close',
    'touch',
  ]),
  front_gap_mm: z.number().nonnegative(),
  box_thickness_mm: z.union([z.literal(15), z.literal(18), z.literal(25)]),
  front_thickness_mm: z.union([z.literal(15), z.literal(18), z.literal(25)]),
  shelf_recess_mm: z.number().nonnegative(),
  edgeband_policy: z.enum(['front_only', 'visible_edges', 'all_edges']),
  drawer_construction: drawerConstructionSchema,
  mixed_edge_banding: z.boolean(),
})

export type CompanyStandards = SystemPreferences

/** Alias legível para o fundo (PRD / UI). */
export function backThicknessMm(prefs: CompanyStandards): 3 | 6 | 15 {
  return prefs.back_panel_thickness
}

export function parseCompanyStandards(raw: unknown): CompanyStandards {
  const row = (typeof raw === 'object' && raw ? raw : {}) as Record<string, unknown>
  const back =
    Number(row.back_panel_thickness) || Number(row.back_thickness_mm) || 6
  const parsed = companyStandardsSchema.safeParse({
    ...row,
    back_thickness_mm: back,
    back_panel_thickness: back,
  })
  if (!parsed.success) {
    throw new Error(
      `company_standards inválido: ${parsed.error.issues.map((i) => i.message).join('; ')}`,
    )
  }
  const d = parsed.data
  return {
    id: d.id,
    company_id: d.company_id,
    base_assembly: d.base_assembly,
    top_assembly: d.top_assembly,
    mounting_device: d.mounting_device,
    back_panel_type: d.back_panel_type,
    back_panel_thickness: d.back_panel_thickness,
    drawer_slide_type: d.drawer_slide_type,
    front_gap_mm: d.front_gap_mm,
    box_thickness_mm: d.box_thickness_mm,
    front_thickness_mm: d.front_thickness_mm,
    shelf_recess_mm: d.shelf_recess_mm,
    edgeband_policy: d.edgeband_policy,
    drawer_construction: d.drawer_construction,
    mixed_edge_banding: d.mixed_edge_banding,
  }
}

export async function getCompanyStandards(companyId: string): Promise<CompanyStandards> {
  const prefs = await getSystemPreferences(companyId)
  return parseCompanyStandards(prefs)
}

export async function upsertCompanyStandards(
  prefs: CompanyStandards,
): Promise<CompanyStandards> {
  const validated = parseCompanyStandards(prefs)
  return upsertSystemPreferences(validated)
}
