-- ============================================================
-- Orçamentos IA v18 — PDF permanente + páginas orçadas na pasta
-- quote_projects.pdf_url = path no Storage (não URL pública)
-- quote_projects.budgeted_pages = páginas já cotadas (union dos lotes)
-- ============================================================

ALTER TABLE public.quote_projects
  ADD COLUMN IF NOT EXISTS pdf_url text;

ALTER TABLE public.quote_projects
  ADD COLUMN IF NOT EXISTS budgeted_pages integer[] NOT NULL DEFAULT '{}'::integer[];

ALTER TABLE public.quote_projects
  ADD COLUMN IF NOT EXISTS page_count integer;

COMMENT ON COLUMN public.quote_projects.pdf_url IS
  'Path no bucket orcamentos-ia do PDF permanente da pasta (ex.: {company}/quote-projects/{id}/source.pdf). Signed URL sob demanda.';

COMMENT ON COLUMN public.quote_projects.budgeted_pages IS
  'Páginas absolutas do PDF já orçadas (união dos lotes COMPLETED/NEEDS_REVIEW).';

COMMENT ON COLUMN public.quote_projects.page_count IS
  'Total de páginas do PDF (cache para a grade visual).';
