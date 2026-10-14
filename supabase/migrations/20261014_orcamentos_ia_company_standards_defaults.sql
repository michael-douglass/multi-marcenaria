-- ============================================================
-- Orçamentos IA — Default-with-Override (padrão fabril Cortecloud)
-- Estende system_preferences (canônico v11) e company_standards (legado PRD).
-- ============================================================

-- 1) system_preferences (motor BOM / pipeline)
ALTER TABLE public.system_preferences
  ADD COLUMN IF NOT EXISTS front_thickness_mm int NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS drawer_construction varchar(50) NOT NULL DEFAULT 'kit_fabril_5_pecas',
  ADD COLUMN IF NOT EXISTS mixed_edge_banding boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'system_preferences_front_thickness_mm_check'
  ) THEN
    ALTER TABLE public.system_preferences
      ADD CONSTRAINT system_preferences_front_thickness_mm_check CHECK (
        front_thickness_mm IN (15, 18, 25)
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'system_preferences_drawer_construction_check'
  ) THEN
    ALTER TABLE public.system_preferences
      ADD CONSTRAINT system_preferences_drawer_construction_check CHECK (
        drawer_construction IN ('kit_fabril_5_pecas', 'frente_only', 'custom')
      );
  END IF;
END $$;

ALTER TABLE public.system_preferences
  ALTER COLUMN box_thickness_mm SET DEFAULT 15,
  ALTER COLUMN back_panel_thickness SET DEFAULT 6,
  ALTER COLUMN drawer_slide_type SET DEFAULT 'hidden_soft_close',
  ALTER COLUMN edgeband_policy SET DEFAULT 'visible_edges';

COMMENT ON COLUMN public.system_preferences.front_thickness_mm IS
  'Espessura padrão de frentes/portas (MDF cor do projeto). Default Cortecloud: 18.';
COMMENT ON COLUMN public.system_preferences.drawer_construction IS
  'kit_fabril_5_pecas = laterais+contras 15mm branco, fundo 6mm + corrediça oculta.';
COMMENT ON COLUMN public.system_preferences.mixed_edge_banding IS
  'true = fita da frente (cor) na borda frontal da caixa branca (padrão Cortecloud).';

-- 2) company_standards (tabela legado PRD v8/v10) — colunas nativas alinhadas
ALTER TABLE public.company_standards
  ADD COLUMN IF NOT EXISTS box_thickness_mm int NOT NULL DEFAULT 15,
  ADD COLUMN IF NOT EXISTS front_thickness_mm int NOT NULL DEFAULT 18,
  ADD COLUMN IF NOT EXISTS back_thickness_mm int NOT NULL DEFAULT 6,
  ADD COLUMN IF NOT EXISTS drawer_construction varchar(50) NOT NULL DEFAULT 'kit_fabril_5_pecas',
  ADD COLUMN IF NOT EXISTS mixed_edge_banding boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_standards_box_thickness_mm_check'
  ) THEN
    ALTER TABLE public.company_standards
      ADD CONSTRAINT company_standards_box_thickness_mm_check CHECK (
        box_thickness_mm IN (15, 18, 25)
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_standards_front_thickness_mm_check'
  ) THEN
    ALTER TABLE public.company_standards
      ADD CONSTRAINT company_standards_front_thickness_mm_check CHECK (
        front_thickness_mm IN (15, 18, 25)
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_standards_back_thickness_mm_check'
  ) THEN
    ALTER TABLE public.company_standards
      ADD CONSTRAINT company_standards_back_thickness_mm_check CHECK (
        back_thickness_mm IN (3, 6, 15)
      );
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'company_standards_drawer_construction_check'
  ) THEN
    ALTER TABLE public.company_standards
      ADD CONSTRAINT company_standards_drawer_construction_check CHECK (
        drawer_construction IN ('kit_fabril_5_pecas', 'frente_only', 'custom')
      );
  END IF;
END $$;

-- 3) Backfill system_preferences a partir de company_standards legado (se ainda não houver linha)
INSERT INTO public.system_preferences (
  company_id,
  base_assembly,
  top_assembly,
  mounting_device,
  back_panel_type,
  back_panel_thickness,
  drawer_slide_type,
  front_gap_mm,
  box_thickness_mm,
  front_thickness_mm,
  shelf_recess_mm,
  edgeband_policy,
  drawer_construction,
  mixed_edge_banding
)
SELECT
  cs.company_id,
  'under_sides',
  'over_sides',
  CASE
    WHEN cs.assembly_method ILIKE '%cavilha%' AND cs.assembly_method ILIKE '%minifix%' THEN 'minifix_dowel'
    WHEN cs.assembly_method ILIKE '%cavilha%' THEN 'dowel_only'
    ELSE 'minifix_dowel'
  END,
  CASE
    WHEN cs.bottom_fixing ILIKE '%refor%' THEN 'reinforced'
    WHEN cs.bottom_fixing ILIKE '%rebaix%' OR cs.bottom_fixing ILIKE '%rebaixo%' THEN 'rebated'
    ELSE 'grooved'
  END,
  COALESCE(cs.back_thickness_mm, 6),
  CASE
    WHEN cs.drawer_slide ILIKE '%oculta%' THEN 'hidden_soft_close'
    WHEN cs.drawer_slide ILIKE '%touch%' THEN 'touch'
    ELSE 'hidden_soft_close'
  END,
  2,
  COALESCE(cs.box_thickness_mm, 15),
  COALESCE(cs.front_thickness_mm, 18),
  10,
  'visible_edges',
  COALESCE(cs.drawer_construction, 'kit_fabril_5_pecas'),
  COALESCE(cs.mixed_edge_banding, true)
FROM public.company_standards cs
WHERE NOT EXISTS (
  SELECT 1 FROM public.system_preferences sp WHERE sp.company_id = cs.company_id
)
ON CONFLICT (company_id) DO NOTHING;
