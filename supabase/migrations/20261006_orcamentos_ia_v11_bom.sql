-- ============================================================
-- Orçamentos IA v11 (Corte Claude) — system_preferences + bom_items
-- Precificação modular por componentes (HelloMob / Cortecloud).
-- company_id = tenant CRM existente (sem tabela companies).
-- ============================================================

-- ------------------------------------------------------------
-- 1) Preferências construtivas globais (System Preferences Engine)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.system_preferences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE,
  base_assembly varchar(50) NOT NULL DEFAULT 'under_sides',
  top_assembly varchar(50) NOT NULL DEFAULT 'over_sides',
  mounting_device varchar(50) NOT NULL DEFAULT 'minifix_dowel',
  back_panel_type varchar(50) NOT NULL DEFAULT 'grooved',
  back_panel_thickness int NOT NULL DEFAULT 6,
  drawer_slide_type varchar(50) NOT NULL DEFAULT 'telescopic',
  front_gap_mm numeric(4, 1) NOT NULL DEFAULT 2.0,
  box_thickness_mm int NOT NULL DEFAULT 15,
  shelf_recess_mm numeric(5, 1) NOT NULL DEFAULT 10.0,
  edgeband_policy varchar(50) NOT NULL DEFAULT 'visible_edges',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT system_preferences_base_assembly_check CHECK (
    base_assembly IN ('under_sides', 'between_sides')
  ),
  CONSTRAINT system_preferences_top_assembly_check CHECK (
    top_assembly IN ('over_sides', 'between_sides', 'inside')
  ),
  CONSTRAINT system_preferences_mounting_device_check CHECK (
    mounting_device IN ('screw', 'minifix_dowel', 'dowel_only')
  ),
  CONSTRAINT system_preferences_back_panel_type_check CHECK (
    back_panel_type IN ('grooved', 'rebated', 'screwed', 'reinforced')
  ),
  CONSTRAINT system_preferences_drawer_slide_type_check CHECK (
    drawer_slide_type IN ('telescopic', 'telescopic_light', 'hidden_soft_close', 'touch')
  )
);

CREATE INDEX IF NOT EXISTS system_preferences_company_id_idx
  ON public.system_preferences (company_id);

-- ------------------------------------------------------------
-- 2) Bill of Materials (peças / fitas / ferragens unitárias)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bom_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.quote_analyses (id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES public.quote_modules (id) ON DELETE CASCADE,
  item_category varchar(50) NOT NULL,
  item_description varchar(255) NOT NULL,
  quantity numeric(12, 3) NOT NULL DEFAULT 0,
  unit_of_measure varchar(20) NOT NULL DEFAULT 'unit',
  unit_cost numeric(10, 2) NOT NULL DEFAULT 0,
  total_cost numeric(12, 2) GENERATED ALWAYS AS (quantity * unit_cost) STORED,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bom_items_category_check CHECK (
    item_category IN ('board', 'edgeband', 'hardware', 'fastener', 'labor', 'other')
  ),
  CONSTRAINT bom_items_unit_check CHECK (
    unit_of_measure IN ('m2', 'm', 'unit', 'pair', 'bar', 'sheet', 'roll')
  )
);

CREATE INDEX IF NOT EXISTS bom_items_project_id_idx ON public.bom_items (project_id);
CREATE INDEX IF NOT EXISTS bom_items_module_id_idx ON public.bom_items (module_id);
CREATE INDEX IF NOT EXISTS bom_items_category_idx ON public.bom_items (item_category);

-- ------------------------------------------------------------
-- 3) Prompt Studio — overrides de system prompts por agente
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_prompt_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  agent_key varchar(50) NOT NULL,
  system_prompt text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_prompt_overrides_agent_key_check CHECK (
    agent_key IN ('extractor', 'disassembler', 'auditor')
  ),
  CONSTRAINT ai_prompt_overrides_company_agent_uidx UNIQUE (company_id, agent_key)
);

CREATE INDEX IF NOT EXISTS ai_prompt_overrides_company_id_idx
  ON public.ai_prompt_overrides (company_id);

-- ------------------------------------------------------------
-- 4) RLS (tenant filtrado na app via company_id / project_id)
-- ------------------------------------------------------------
ALTER TABLE public.system_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bom_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_prompt_overrides ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orcamentos_ia_system_preferences_auth_all ON public.system_preferences;
CREATE POLICY orcamentos_ia_system_preferences_auth_all
  ON public.system_preferences
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS orcamentos_ia_bom_items_auth_all ON public.bom_items;
CREATE POLICY orcamentos_ia_bom_items_auth_all
  ON public.bom_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS orcamentos_ia_ai_prompt_overrides_auth_all ON public.ai_prompt_overrides;
CREATE POLICY orcamentos_ia_ai_prompt_overrides_auth_all
  ON public.ai_prompt_overrides
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.system_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bom_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_prompt_overrides TO authenticated;
