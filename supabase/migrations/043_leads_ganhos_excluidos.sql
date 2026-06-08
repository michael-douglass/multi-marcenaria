-- Tabela para marcar leads excluídos manualmente da tela de Orçamentos Fechados
CREATE TABLE IF NOT EXISTS movelaria_leads_ganhos_excluidos (
  lead_id    TEXT        NOT NULL PRIMARY KEY,
  excluido_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE movelaria_leads_ganhos_excluidos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage excluded leads" ON movelaria_leads_ganhos_excluidos;
CREATE POLICY "Admins manage excluded leads"
  ON movelaria_leads_ganhos_excluidos
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Recria o RPC excluindo leads marcados na tabela acima
DROP FUNCTION IF EXISTS public.movelaria_get_leads_ganhos();
CREATE OR REPLACE FUNCTION public.movelaria_get_leads_ganhos()
RETURNS TABLE (
  id              TEXT,
  nome            TEXT,
  telefone        TEXT,
  email           TEXT,
  origem          TEXT,
  status          TEXT,
  valor_orcamento NUMERIC,
  observacoes     TEXT,
  criado_em       TIMESTAMPTZ,
  ja_processado   BOOLEAN
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, emp_garbo
AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.id::TEXT,
    l.nome,
    NULLIF(trim(COALESCE(l.telefone, '')), ''),
    NULLIF(trim(COALESCE(l.email, '')), ''),
    l.origem,
    l.status,
    (SELECT CASE
      WHEN COALESCE(raw_val, '') ~ '^-?[0-9]{1,3}(\.[0-9]{3})+(,[0-9]{1,2})?$'
        THEN REPLACE(REPLACE(raw_val, '.', ''), ',', '.')::NUMERIC
      WHEN COALESCE(raw_val, '') ~ '^-?[0-9]+([.][0-9]+)?$'
        THEN raw_val::NUMERIC
      WHEN COALESCE(raw_val, '') ~ '^-?[0-9]+(,[0-9]+)?$'
        THEN REPLACE(raw_val, ',', '.')::NUMERIC
      ELSE NULL
    END
    FROM (
      SELECT NULLIF(trim(COALESCE(
        NULLIF(trim(to_jsonb(l) ->> 'valor_negocio'), ''),
        NULLIF(trim(to_jsonb(l) ->> 'valor_orcamento'), '')
      )), '') AS raw_val
    ) v
    ) AS valor_orcamento,
    COALESCE(
      NULLIF(trim(COALESCE(to_jsonb(l) ->> 'observacoes', '')), ''),
      NULLIF(trim(COALESCE(to_jsonb(l) ->> 'observacao',  '')), '')
    ) AS observacoes,
    l.criado_em,
    (
      EXISTS (
        SELECT 1 FROM movelaria_orcamentos_fechados o WHERE o.lead_id = l.id::TEXT
      )
      OR
      EXISTS (
        SELECT 1 FROM movelaria_leads_ganhos_excluidos e WHERE e.lead_id = l.id::TEXT
      )
    ) AS ja_processado
  FROM emp_garbo.leads l
  WHERE l.status = 'Orçamentos ganhos'
  ORDER BY l.criado_em DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_get_leads_ganhos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_get_leads_ganhos() TO authenticated;
