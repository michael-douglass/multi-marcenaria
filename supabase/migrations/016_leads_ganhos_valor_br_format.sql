-- Corrige parsing de valor_orcamento: suporta formato brasileiro com ponto como
-- separador de milhar (ex.: "14.633" e "14.633,00" → 14633).
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
    CASE
      -- Formato brasileiro: ponto como milhar, vírgula como decimal
      -- Ex.: "14.633", "14.633,00", "1.234.567,89"
      WHEN COALESCE(to_jsonb(l) ->> 'valor_orcamento', '') ~ '^-?[0-9]{1,3}(\.[0-9]{3})+(,[0-9]{1,2})?$'
        THEN REPLACE(REPLACE(COALESCE(to_jsonb(l) ->> 'valor_orcamento', ''), '.', ''), ',', '.')::NUMERIC
      -- Inteiro ou decimal com ponto: "14633" ou "14633.50"
      WHEN COALESCE(to_jsonb(l) ->> 'valor_orcamento', '') ~ '^-?[0-9]+([.][0-9]+)?$'
        THEN (to_jsonb(l) ->> 'valor_orcamento')::NUMERIC
      -- Vírgula como decimal sem separador de milhar: "14633,50"
      WHEN COALESCE(to_jsonb(l) ->> 'valor_orcamento', '') ~ '^-?[0-9]+(,[0-9]+)?$'
        THEN REPLACE(COALESCE(to_jsonb(l) ->> 'valor_orcamento', ''), ',', '.')::NUMERIC
      ELSE NULL
    END AS valor_orcamento,
    COALESCE(
      NULLIF(trim(COALESCE(to_jsonb(l) ->> 'observacoes', '')), ''),
      NULLIF(trim(COALESCE(to_jsonb(l) ->> 'observacao',  '')), '')
    ) AS observacoes,
    l.criado_em,
    EXISTS (
      SELECT 1
      FROM movelaria_orcamentos_fechados o
      WHERE o.lead_id = l.id::TEXT
    ) AS ja_processado
  FROM emp_garbo.leads l
  WHERE l.status = 'Orçamentos ganhos'
  ORDER BY l.criado_em DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_get_leads_ganhos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_get_leads_ganhos() TO authenticated;
