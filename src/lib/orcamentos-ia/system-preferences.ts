import { supabase } from '@/lib/supabase'

/** Preferências construtivas v11 + Default Cortecloud (System Preferences Engine). */
export interface SystemPreferences {
  id?: string
  company_id: string
  base_assembly: 'under_sides' | 'between_sides'
  top_assembly: 'over_sides' | 'between_sides' | 'inside'
  mounting_device: 'screw' | 'minifix_dowel' | 'dowel_only'
  back_panel_type: 'grooved' | 'rebated' | 'screwed' | 'reinforced'
  /** Espessura do fundo (alias PRD: back_thickness_mm). Default 6 mm Branco TX. */
  back_panel_thickness: 3 | 6 | 15
  drawer_slide_type: 'telescopic' | 'telescopic_light' | 'hidden_soft_close' | 'touch'
  front_gap_mm: number
  /** Caixa interna — MDF Branco TX. Default Cortecloud: 15. */
  box_thickness_mm: 15 | 18 | 25
  /** Frentes/portas — MDF cor do projeto. Default Cortecloud: 18. */
  front_thickness_mm: 15 | 18 | 25
  shelf_recess_mm: number
  edgeband_policy: 'front_only' | 'visible_edges' | 'all_edges'
  /**
   * kit_fabril_5_pecas: laterais + contras em Branco 15 mm, fundo 6 mm + corrediça oculta.
   * frente_only: só frente de gaveta (legado).
   * custom: livre (auditor/manual).
   */
  drawer_construction: 'kit_fabril_5_pecas' | 'frente_only' | 'custom'
  /** true = borda frontal da caixa branca recebe fita na cor da frente. */
  mixed_edge_banding: boolean
}

/**
 * Pré-configuração nativa (Default Cortecloud).
 * O marceneiro sobrescreve no modal; Extrator/Auditor/BOM respeitam o salvo.
 */
export const DEFAULT_SYSTEM_PREFERENCES = (companyId: string): SystemPreferences => ({
  company_id: companyId,
  base_assembly: 'under_sides',
  top_assembly: 'over_sides',
  mounting_device: 'minifix_dowel',
  back_panel_type: 'grooved',
  back_panel_thickness: 6,
  drawer_slide_type: 'hidden_soft_close',
  front_gap_mm: 2,
  box_thickness_mm: 15,
  front_thickness_mm: 18,
  shelf_recess_mm: 10,
  edgeband_policy: 'visible_edges',
  drawer_construction: 'kit_fabril_5_pecas',
  mixed_edge_banding: true,
})

/** Alias de produto (PRD / UI) — mesmo objeto de fábrica. */
export { DEFAULT_SYSTEM_PREFERENCES as DEFAULT_COMPANY_STANDARDS }

const SELECT_COLS =
  'id, company_id, base_assembly, top_assembly, mounting_device, back_panel_type, back_panel_thickness, drawer_slide_type, front_gap_mm, box_thickness_mm, front_thickness_mm, shelf_recess_mm, edgeband_policy, drawer_construction, mixed_edge_banding'

function coercePrefs(companyId: string, data: Record<string, unknown> | null): SystemPreferences {
  const d = DEFAULT_SYSTEM_PREFERENCES(companyId)
  if (!data) return d
  const front = Number(data.front_thickness_mm)
  const box = Number(data.box_thickness_mm)
  const back = Number(data.back_panel_thickness)
  const drawerConst = data.drawer_construction
  return {
    id: typeof data.id === 'string' ? data.id : undefined,
    company_id: companyId,
    base_assembly: (data.base_assembly as SystemPreferences['base_assembly']) || d.base_assembly,
    top_assembly: (data.top_assembly as SystemPreferences['top_assembly']) || d.top_assembly,
    mounting_device:
      (data.mounting_device as SystemPreferences['mounting_device']) || d.mounting_device,
    back_panel_type:
      (data.back_panel_type as SystemPreferences['back_panel_type']) || d.back_panel_type,
    back_panel_thickness: ([3, 6, 15].includes(back)
      ? back
      : d.back_panel_thickness) as SystemPreferences['back_panel_thickness'],
    drawer_slide_type:
      (data.drawer_slide_type as SystemPreferences['drawer_slide_type']) || d.drawer_slide_type,
    front_gap_mm: Number(data.front_gap_mm) || d.front_gap_mm,
    box_thickness_mm: ([15, 18, 25].includes(box)
      ? box
      : d.box_thickness_mm) as SystemPreferences['box_thickness_mm'],
    front_thickness_mm: ([15, 18, 25].includes(front)
      ? front
      : d.front_thickness_mm) as SystemPreferences['front_thickness_mm'],
    shelf_recess_mm: Number(data.shelf_recess_mm) || d.shelf_recess_mm,
    edgeband_policy:
      (data.edgeband_policy as SystemPreferences['edgeband_policy']) || d.edgeband_policy,
    drawer_construction:
      drawerConst === 'frente_only' || drawerConst === 'custom' || drawerConst === 'kit_fabril_5_pecas'
        ? drawerConst
        : d.drawer_construction,
    mixed_edge_banding:
      typeof data.mixed_edge_banding === 'boolean'
        ? data.mixed_edge_banding
        : d.mixed_edge_banding,
  }
}

export async function getSystemPreferences(companyId: string): Promise<SystemPreferences> {
  const { data, error } = await supabase
    .from('system_preferences')
    .select(SELECT_COLS)
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return coercePrefs(companyId, data as Record<string, unknown> | null)
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
    front_thickness_mm: prefs.front_thickness_mm,
    shelf_recess_mm: prefs.shelf_recess_mm,
    edgeband_policy: prefs.edgeband_policy,
    drawer_construction: prefs.drawer_construction,
    mixed_edge_banding: prefs.mixed_edge_banding,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('system_preferences')
    .upsert(payload, { onConflict: 'company_id' })
    .select(SELECT_COLS)
    .single()

  if (error) throw new Error(error.message)

  // Espelha colunas nativas na tabela legado company_standards (PRD / Default-with-Override)
  await supabase.from('company_standards').upsert(
    {
      company_id: prefs.company_id,
      box_thickness_mm: prefs.box_thickness_mm,
      front_thickness_mm: prefs.front_thickness_mm,
      back_thickness_mm: prefs.back_panel_thickness,
      drawer_construction: prefs.drawer_construction,
      mixed_edge_banding: prefs.mixed_edge_banding,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'company_id' },
  )

  return coercePrefs(prefs.company_id, data as Record<string, unknown>)
}

/** Texto curto para injetar no System Prompt do Extrator/Desmontador/Auditor. */
export function formatPreferencesForPrompt(prefs: SystemPreferences): string {
  const drawerLabel =
    prefs.drawer_construction === 'kit_fabril_5_pecas'
      ? `kit fabril 5 peças (laterais+contras Branco ${prefs.box_thickness_mm} mm, fundo ${prefs.back_panel_thickness} mm + corrediça ${prefs.drawer_slide_type})`
      : prefs.drawer_construction === 'frente_only'
        ? 'somente frente de gaveta'
        : 'custom (seguir desenho)'

  return [
    'PREFERÊNCIAS CONSTRUTIVAS DA EMPRESA (company_standards — OBRIGATÓRIO respeitar 100%; sobrescrevem qualquer default do prompt):',
    `- Caixa interna (box_thickness_mm): ${prefs.box_thickness_mm} mm — material OBRIGATÓRIO: MDF Branco TX (laterais, base, fundo, prateleira, divisória, travessa). NUNCA use MDF Noite/Louro/cor do projeto na caixa.`,
    `- Frentes/portas (front_thickness_mm): ${prefs.front_thickness_mm} mm — MDF cor do projeto (Noite, Louro Freijó, Reflecta, etc.)`,
    `- Fundo (back_thickness_mm): ${prefs.back_panel_thickness} mm (${prefs.back_panel_type})`,
    `- Gaveta (drawer_construction): ${drawerLabel}`,
    `- Fita mista (mixed_edge_banding): ${prefs.mixed_edge_banding ? 'SIM — borda frontal da caixa branca na COR DA FRENTE' : 'NÃO — fita segue o material da peça'}`,
    `- Base: ${prefs.base_assembly === 'under_sides' ? 'passante por baixo das laterais' : 'entre laterais'}`,
    `- Tampo: ${prefs.top_assembly === 'over_sides' ? 'por cima das laterais' : prefs.top_assembly === 'inside' ? 'por dentro' : 'entre laterais'}`,
    `- Fixação padrão: ${prefs.mounting_device}`,
    `- Corrediças: ${prefs.drawer_slide_type}`,
    `- Folga entre frentes/portas: ${prefs.front_gap_mm} mm`,
    `- Recuo de prateleira: ${prefs.shelf_recess_mm} mm`,
    `- Bordeamento: ${prefs.edgeband_policy}`,
    '- Se o marceneiro alterou qualquer valor acima, NÃO use defaults genéricos do modelo — use EXATAMENTE estes mm/tipos.',
    '- PROIBIDO precificar o móvel por m² de fachada (L×A × R$/m²). Só BOM unitário.',
    '- PROIBIDO inventar R$ / markup — preço fica no estoque + resolvedor.',
    '- Nichos abertos: montagem 100% cavilha; sem rasgo de fundo em topos expostos.',
    '- Engrosso (2×15 ou 2×18): fita larga 35 mm ou 45 mm.',
    '- Vão de gaveta mínimo 200 mm (restrição CNC/ventosas).',
    '- Armário de correr: portas + trilhos + sarrafo unilateral.',
  ].join('\n')
}
