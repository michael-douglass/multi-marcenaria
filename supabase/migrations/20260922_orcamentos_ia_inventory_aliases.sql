-- Apelidos De-Para: nome vindo do PDF → item do estoque (preço oficial)
CREATE TABLE IF NOT EXISTS public.inventory_aliases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  alias_raw text NOT NULL,
  alias_normalized text NOT NULL,
  inventory_item_id uuid NOT NULL REFERENCES public.inventory_items (id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_aliases_company_alias_uidx UNIQUE (company_id, alias_normalized)
);

CREATE INDEX IF NOT EXISTS inventory_aliases_company_id_idx
  ON public.inventory_aliases (company_id);

CREATE INDEX IF NOT EXISTS inventory_aliases_item_id_idx
  ON public.inventory_aliases (inventory_item_id);

ALTER TABLE public.inventory_aliases ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orcamentos_ia_inventory_aliases_auth_all ON public.inventory_aliases;
CREATE POLICY orcamentos_ia_inventory_aliases_auth_all
  ON public.inventory_aliases
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_aliases TO authenticated;
GRANT ALL ON public.inventory_aliases TO service_role;
