-- ============================================================
-- Orçamentos IA v17 — Pasta de Precificação (quote_projects)
-- Agrupa vários lotes (quote_analyses) do mesmo PDF/projeto.
--
-- ATENÇÃO DE NOME:
--   bom_items.project_id  → FK para quote_analyses.id  (BOM daquele lote)
--   quote_analyses.project_id → FK para quote_projects.id (pasta do projeto)
-- ============================================================

CREATE TABLE IF NOT EXISTS public.quote_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  name text NOT NULL,
  source_pdf_name text,
  source_fingerprint text,
  -- Snapshot consolidado: consolidated_extraction, consolidated_bom, batches, sale_price
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.quote_projects IS
  'Pasta de precificação incremental — agrupa quote_analyses (lotes de páginas).';
COMMENT ON COLUMN public.quote_projects.totals IS
  'Snapshot consolidado da pasta (extraction/BOM/preço) após fusão dos lotes.';

CREATE INDEX IF NOT EXISTS quote_projects_company_id_idx
  ON public.quote_projects (company_id);
CREATE INDEX IF NOT EXISTS quote_projects_company_created_idx
  ON public.quote_projects (company_id, created_at DESC);

ALTER TABLE public.quote_analyses
  ADD COLUMN IF NOT EXISTS project_id uuid REFERENCES public.quote_projects (id) ON DELETE SET NULL;

COMMENT ON COLUMN public.quote_analyses.project_id IS
  'Pasta quote_projects.id — NÃO confundir com bom_items.project_id (= quote_analyses.id).';

CREATE INDEX IF NOT EXISTS quote_analyses_project_id_idx
  ON public.quote_analyses (project_id);
CREATE INDEX IF NOT EXISTS quote_analyses_company_project_idx
  ON public.quote_analyses (company_id, project_id);

ALTER TABLE public.quote_projects ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orcamentos_ia_quote_projects_tenant ON public.quote_projects;
CREATE POLICY orcamentos_ia_quote_projects_tenant
  ON public.quote_projects
  FOR ALL TO authenticated
  USING (public.orcamentos_ia_can_access_company(company_id))
  WITH CHECK (public.orcamentos_ia_can_access_company(company_id));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_projects TO authenticated;
GRANT ALL ON public.quote_projects TO service_role;
