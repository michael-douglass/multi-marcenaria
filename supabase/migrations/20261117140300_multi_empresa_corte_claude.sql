-- M13 — Corte Claude por empresa: o "tenant" deixa de ser a Garbo fixa e passa a ser a empresa do contexto.
-- (inventory_items.company_id NULL = "global" deixa de existir: cada empresa tem o próprio inventário.)
create or replace function public.orcamentos_ia_tenant_company_id()
returns uuid language sql stable set search_path = public, pg_temp as $$
  select public.app_empresa_atual();
$$;
