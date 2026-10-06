import { supabase } from '@/lib/supabase'

/** Preferências construtivas v11 (System Preferences Engine). */
export interface SystemPreferences {
  id?: string
  company_id: string
  base_assembly: 'under_sides' | 'between_sides'
  top_assembly: 'over_sides' | 'between_sides' | 'inside'
  mounting_device: 'screw' | 'minifix_dowel' | 'dowel_only'
  back_panel_type: 'grooved' | 'rebated' | 'screwed' | 'reinforced'
  back_panel_thickness: 3 | 6 | 15
  drawer_slide_type: 'telescopic' | 'telescopic_light' | 'hidden_soft_close' | 'touch'
  front_gap_mm: number
  box_thickness_mm: 15 | 18 | 25
  shelf_recess_mm: number
  edgeband_policy: 'front_only' | 'visible_edges' | 'all_edges'
}

export const DEFAULT_SYSTEM_PREFERENCES = (companyId: string): SystemPreferences => ({
  company_id: companyId,
  base_assembly: 'under_sides',
  top_assembly: 'over_sides',
  mounting_device: 'minifix_dowel',
  back_panel_type: 'grooved',
  back_panel_thickness: 6,
  drawer_slide_type: 'telescopic',
  front_gap_mm: 2,
  box_thickness_mm: 15,
  shelf_recess_mm: 10,
  edgeband_policy: 'visible_edges',
})

const SELECT_COLS =
  'id, company_id, base_assembly, top_assembly, mounting_device, back_panel_type, back_panel_thickness, drawer_slide_type, front_gap_mm, box_thickness_mm, shelf_recess_mm, edgeband_policy'

export async function getSystemPreferences(companyId: string): Promise<SystemPreferences> {
  const { data, error } = await supabase
    .from('system_preferences')
    .select(SELECT_COLS)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  if (!data) return DEFAULT_SYSTEM_PREFERENCES(companyId)
  return data as SystemPreferences
}

export async function upsertSystemPreferences(
  prefs: SystemPreferences,
): Promise<SystemPreferences> {
  const payload = {
    company_id: prefs.company_id,
    base_assembly: prefs.base_assembly,
    top_assembly: prefs.top_assembly,
    mounting_device: prefs.mounting_device,
    back_panel_type: prefs.back_panel_type,
    back_panel_thickness: prefs.back_panel_thickness,
    drawer_slide_type: prefs.drawer_slide_type,
    front_gap_mm: prefs.front_gap_mm,
    box_thickness_mm: prefs.box_thickness_mm,
    shelf_recess_mm: prefs.shelf_recess_mm,
    edgeband_policy: prefs.edgeband_policy,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('system_preferences')
    .upsert(payload, { onConflict: 'company_id' })
    .select(SELECT_COLS)
    .single()

  if (error) throw new Error(error.message)
  return data as SystemPreferences
}

/** Texto curto para injetar no System Prompt do Extrator/Desmontador. */
export function formatPreferencesForPrompt(prefs: SystemPreferences): string {
  return [
    'PREFERÊNCIAS CONSTRUTIVAS DA EMPRESA (obrigatório aplicar):',
    `- Base: ${prefs.base_assembly === 'under_sides' ? 'passante por baixo das laterais' : 'entre laterais'}`,
    `- Tampo: ${prefs.top_assembly === 'over_sides' ? 'por cima das laterais' : prefs.top_assembly === 'inside' ? 'por dentro' : 'entre laterais'}`,
    `- Fixação padrão: ${prefs.mounting_device}`,
    `- Fundo: ${prefs.back_panel_type} ${prefs.back_panel_thickness} mm`,
    `- Corrediças: ${prefs.drawer_slide_type}`,
    `- Folga entre frentes/portas: ${prefs.front_gap_mm} mm`,
    `- Espessura caixaria: ${prefs.box_thickness_mm} mm`,
    `- Recuo de prateleira: ${prefs.shelf_recess_mm} mm`,
    `- Bordeamento: ${prefs.edgeband_policy}`,
    '- PROIBIDO precificar o móvel por m² de fachada (L×A × R$/m²). Só BOM unitário.',
    '- Nichos abertos: montagem 100% cavilha; sem rasgo de fundo em topos expostos.',
    '- Engrosso (2×15 ou 2×18): fita larga 35 mm ou 45 mm.',
    '- Vão de gaveta mínimo 200 mm (restrição CNC/ventosas).',
  ].join('\n')
}
