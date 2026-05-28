-- Adiciona 'cartao' à forma_pagamento de contas_receber
ALTER TABLE movelaria_contas_receber
  DROP CONSTRAINT IF EXISTS movelaria_contas_receber_forma_pagamento_check;
ALTER TABLE movelaria_contas_receber
  ADD CONSTRAINT movelaria_contas_receber_forma_pagamento_check
  CHECK (forma_pagamento IN ('pix', 'dinheiro', 'cheque', 'boleto', 'cartao'));

-- Tabela de orçamentos fechados (leads ganhos com entrada no caixa)
CREATE TABLE IF NOT EXISTS movelaria_orcamentos_fechados (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id          TEXT,
  cliente_id       UUID REFERENCES movelaria_clientes(id) ON DELETE SET NULL,
  cliente_nome     TEXT NOT NULL,
  cliente_telefone TEXT,
  valor_total      NUMERIC(12,2) NOT NULL,
  descricao        TEXT,
  tipo_recebimento TEXT NOT NULL
    CHECK (tipo_recebimento IN ('a_vista', 'cartao_parcelado', 'nosso_parcelamento')),
  forma_pagamento  TEXT
    CHECK (forma_pagamento IN ('pix', 'dinheiro', 'cheque', 'boleto', 'cartao')),
  total_parcelas   INTEGER NOT NULL DEFAULT 1,
  observacoes      TEXT,
  criado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mov_orcamentos_lead    ON movelaria_orcamentos_fechados(lead_id);
CREATE INDEX IF NOT EXISTS idx_mov_orcamentos_cliente ON movelaria_orcamentos_fechados(cliente_id);
CREATE INDEX IF NOT EXISTS idx_mov_orcamentos_data    ON movelaria_orcamentos_fechados(criado_em DESC);

ALTER TABLE movelaria_orcamentos_fechados ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "orcamentos_fechados_select" ON movelaria_orcamentos_fechados;
CREATE POLICY "orcamentos_fechados_select" ON movelaria_orcamentos_fechados
  FOR SELECT TO authenticated USING (true);
DROP POLICY IF EXISTS "orcamentos_fechados_insert" ON movelaria_orcamentos_fechados;
CREATE POLICY "orcamentos_fechados_insert" ON movelaria_orcamentos_fechados
  FOR INSERT TO authenticated WITH CHECK (true);

-- Função que retorna leads ganhos com status de processamento
DROP FUNCTION IF EXISTS public.movelaria_get_leads_ganhos();
CREATE OR REPLACE FUNCTION public.movelaria_get_leads_ganhos()
RETURNS TABLE (
  id            TEXT,
  nome          TEXT,
  telefone      TEXT,
  email         TEXT,
  origem        TEXT,
  status        TEXT,
  criado_em     TIMESTAMPTZ,
  ja_processado BOOLEAN
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
    NULLIF(trim(COALESCE(l.email,    '')), ''),
    l.origem,
    l.status,
    l.criado_em,
    EXISTS (
      SELECT 1 FROM movelaria_orcamentos_fechados o
      WHERE o.lead_id = l.id::TEXT
    ) AS ja_processado
  FROM emp_garbo.leads l
  WHERE l.status = 'Orçamentos ganhos'
  ORDER BY l.criado_em DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_get_leads_ganhos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_get_leads_ganhos() TO authenticated;
