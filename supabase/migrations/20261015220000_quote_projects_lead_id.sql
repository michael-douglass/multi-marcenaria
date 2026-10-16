-- ============================================================
-- Orçamentos IA — vínculo pasta ↔ lead CRM (1 lead → 1 pasta)
-- lead_id nullable: pastas criadas no hub continuam sem lead.
-- ============================================================

ALTER TABLE public.quote_projects
  ADD COLUMN IF NOT EXISTS lead_id bigint;

COMMENT ON COLUMN public.quote_projects.lead_id IS
  'Lead CRM (leads.id) dono desta pasta de precificação. NULL = pasta só do hub Orçamentos IA.';

CREATE INDEX IF NOT EXISTS quote_projects_company_lead_id_idx
  ON public.quote_projects (company_id, lead_id)
  WHERE lead_id IS NOT NULL;

-- No máximo uma pasta ativa por lead na mesma empresa
CREATE UNIQUE INDEX IF NOT EXISTS quote_projects_company_lead_unique_idx
  ON public.quote_projects (company_id, lead_id)
  WHERE lead_id IS NOT NULL;
