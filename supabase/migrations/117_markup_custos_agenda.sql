-- Migration 117: custos do markup na Agenda de Obras (somente Administrador)

CREATE OR REPLACE FUNCTION movelaria_markup_custos_por_leads(p_lead_ids TEXT[])
RETURNS TABLE (
  lead_id         TEXT,
  custo_materiais NUMERIC,
  custo_servicos  NUMERIC,
  custo_despesas  NUMERIC,
  preco_final     NUMERIC
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, emp_garbo
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM movelaria_usuarios u
    WHERE u.id = auth.uid()
      AND u.ativo = true
      AND (
        u.perfil = 'administrador'
        OR 'administrador' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
      )
  ) THEN
    RETURN;
  END IF;

  IF p_lead_ids IS NULL OR cardinality(p_lead_ids) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (m.lead_id)
    m.lead_id::TEXT,
    COALESCE((m.modulos->'totais'->>'custo_materiais')::NUMERIC, 0),
    COALESCE((m.modulos->'totais'->>'custo_servicos')::NUMERIC, 0),
    COALESCE((m.modulos->'totais'->>'custo_despesas')::NUMERIC, 0),
    COALESCE(
      NULLIF((m.modulos->'totais'->>'preco_final')::NUMERIC, NULL),
      m.preco_final,
      0
    )
  FROM emp_garbo.markup_orcamentos m
  WHERE m.lead_id IS NOT NULL
    AND m.lead_id::TEXT = ANY (p_lead_ids)
  ORDER BY m.lead_id, m.atualizado_em DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION movelaria_markup_custos_por_leads(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_markup_custos_por_leads(TEXT[]) TO authenticated;
