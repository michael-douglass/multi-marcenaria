-- ============================================================
-- Orçamentos IA — RLS por company_id (casa única Garbo)
-- Autenticados só acessam a empresa Garbo + catálogo global (company_id NULL).
-- Filhos (environments/modules/materials/bom) via JOIN em quote_analyses.
-- ============================================================

-- UUID canônico (src/contexts/EmpresaContext.tsx → GARBO_EMPRESA_ID)
CREATE OR REPLACE FUNCTION public.orcamentos_ia_tenant_company_id()
RETURNS uuid
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT '2c196e67-dd26-4e1c-839d-4d234f3a3dfd'::uuid;
$$;

CREATE OR REPLACE FUNCTION public.orcamentos_ia_can_access_company(p_company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT auth.uid() IS NOT NULL
    AND (
      p_company_id IS NULL
      OR p_company_id = public.orcamentos_ia_tenant_company_id()
    );
$$;

GRANT EXECUTE ON FUNCTION public.orcamentos_ia_tenant_company_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.orcamentos_ia_can_access_company(uuid) TO authenticated, service_role;

-- ---------- company_standards ----------
DROP POLICY IF EXISTS orcamentos_ia_company_standards_auth_all ON public.company_standards;
CREATE POLICY orcamentos_ia_company_standards_tenant
  ON public.company_standards
  FOR ALL TO authenticated
  USING (public.orcamentos_ia_can_access_company(company_id))
  WITH CHECK (public.orcamentos_ia_can_access_company(company_id));

-- ---------- inventory_items (NULL = catálogo global) ----------
DROP POLICY IF EXISTS orcamentos_ia_inventory_items_auth_all ON public.inventory_items;
CREATE POLICY orcamentos_ia_inventory_items_tenant
  ON public.inventory_items
  FOR ALL TO authenticated
  USING (public.orcamentos_ia_can_access_company(company_id))
  WITH CHECK (
    company_id IS NULL
    OR public.orcamentos_ia_can_access_company(company_id)
  );

-- ---------- inventory_aliases ----------
DROP POLICY IF EXISTS orcamentos_ia_inventory_aliases_auth_all ON public.inventory_aliases;
CREATE POLICY orcamentos_ia_inventory_aliases_tenant
  ON public.inventory_aliases
  FOR ALL TO authenticated
  USING (public.orcamentos_ia_can_access_company(company_id))
  WITH CHECK (public.orcamentos_ia_can_access_company(company_id));

-- ---------- market_reference_prices (global — leitura/escrita só autenticado) ----------
DROP POLICY IF EXISTS orcamentos_ia_market_reference_prices_auth_all ON public.market_reference_prices;
CREATE POLICY orcamentos_ia_market_reference_prices_auth
  ON public.market_reference_prices
  FOR ALL TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- ---------- ai_memories ----------
DROP POLICY IF EXISTS orcamentos_ia_ai_memories_auth_all ON public.ai_memories;
CREATE POLICY orcamentos_ia_ai_memories_tenant
  ON public.ai_memories
  FOR ALL TO authenticated
  USING (public.orcamentos_ia_can_access_company(company_id))
  WITH CHECK (public.orcamentos_ia_can_access_company(company_id));

-- ---------- quote_analyses ----------
DROP POLICY IF EXISTS orcamentos_ia_quote_analyses_auth_all ON public.quote_analyses;
CREATE POLICY orcamentos_ia_quote_analyses_tenant
  ON public.quote_analyses
  FOR ALL TO authenticated
  USING (public.orcamentos_ia_can_access_company(company_id))
  WITH CHECK (public.orcamentos_ia_can_access_company(company_id));

-- ---------- quote_environments ----------
DROP POLICY IF EXISTS orcamentos_ia_quote_environments_auth_all ON public.quote_environments;
CREATE POLICY orcamentos_ia_quote_environments_tenant
  ON public.quote_environments
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quote_analyses a
      WHERE a.id = analysis_id
        AND public.orcamentos_ia_can_access_company(a.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quote_analyses a
      WHERE a.id = analysis_id
        AND public.orcamentos_ia_can_access_company(a.company_id)
    )
  );

-- ---------- quote_modules ----------
DROP POLICY IF EXISTS orcamentos_ia_quote_modules_auth_all ON public.quote_modules;
CREATE POLICY orcamentos_ia_quote_modules_tenant
  ON public.quote_modules
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quote_environments e
      JOIN public.quote_analyses a ON a.id = e.analysis_id
      WHERE e.id = environment_id
        AND public.orcamentos_ia_can_access_company(a.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.quote_environments e
      JOIN public.quote_analyses a ON a.id = e.analysis_id
      WHERE e.id = environment_id
        AND public.orcamentos_ia_can_access_company(a.company_id)
    )
  );

-- ---------- quote_materials ----------
DROP POLICY IF EXISTS orcamentos_ia_quote_materials_auth_all ON public.quote_materials;
CREATE POLICY orcamentos_ia_quote_materials_tenant
  ON public.quote_materials
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.quote_modules m
      JOIN public.quote_environments e ON e.id = m.environment_id
      JOIN public.quote_analyses a ON a.id = e.analysis_id
      WHERE m.id = module_id
        AND public.orcamentos_ia_can_access_company(a.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.quote_modules m
      JOIN public.quote_environments e ON e.id = m.environment_id
      JOIN public.quote_analyses a ON a.id = e.analysis_id
      WHERE m.id = module_id
        AND public.orcamentos_ia_can_access_company(a.company_id)
    )
  );

-- ---------- system_preferences ----------
DROP POLICY IF EXISTS orcamentos_ia_system_preferences_auth_all ON public.system_preferences;
CREATE POLICY orcamentos_ia_system_preferences_tenant
  ON public.system_preferences
  FOR ALL TO authenticated
  USING (public.orcamentos_ia_can_access_company(company_id))
  WITH CHECK (public.orcamentos_ia_can_access_company(company_id));

-- ---------- bom_items ----------
DROP POLICY IF EXISTS orcamentos_ia_bom_items_auth_all ON public.bom_items;
CREATE POLICY orcamentos_ia_bom_items_tenant
  ON public.bom_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.quote_analyses a
      WHERE a.id = project_id
        AND public.orcamentos_ia_can_access_company(a.company_id)
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.quote_analyses a
      WHERE a.id = project_id
        AND public.orcamentos_ia_can_access_company(a.company_id)
    )
  );

-- ---------- ai_prompt_overrides ----------
DROP POLICY IF EXISTS orcamentos_ia_ai_prompt_overrides_auth_all ON public.ai_prompt_overrides;
CREATE POLICY orcamentos_ia_ai_prompt_overrides_tenant
  ON public.ai_prompt_overrides
  FOR ALL TO authenticated
  USING (public.orcamentos_ia_can_access_company(company_id))
  WITH CHECK (public.orcamentos_ia_can_access_company(company_id));
