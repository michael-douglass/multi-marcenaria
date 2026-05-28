-- Saldo acumulado por fornecedor
CREATE TABLE IF NOT EXISTS movelaria_caixa_fornecedor (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id uuid        NOT NULL REFERENCES movelaria_fornecedores(id) ON DELETE CASCADE,
  saldo_atual   numeric(14,2) NOT NULL DEFAULT 0,
  criado_em     timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  UNIQUE (fornecedor_id)
);

-- Histórico de todas as movimentações (créditos e débitos)
CREATE TABLE IF NOT EXISTS movelaria_transacoes_caixa_fornecedor (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id   uuid        NOT NULL REFERENCES movelaria_fornecedores(id) ON DELETE CASCADE,
  tipo            text        NOT NULL CHECK (tipo IN ('credito', 'debito')),
  valor           numeric(14,2) NOT NULL CHECK (valor > 0),
  forma_pagamento text        CHECK (forma_pagamento IN ('cheque', 'dinheiro', 'cartao', 'pix')),
  descricao       text,
  conta_pagar_id  uuid        REFERENCES movelaria_contas_pagar(id) ON DELETE SET NULL,
  saldo_anterior  numeric(14,2) NOT NULL DEFAULT 0,
  saldo_posterior numeric(14,2) NOT NULL DEFAULT 0,
  criado_em       timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE movelaria_caixa_fornecedor              ENABLE ROW LEVEL SECURITY;
ALTER TABLE movelaria_transacoes_caixa_fornecedor   ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_caixa_fornecedor" ON movelaria_caixa_fornecedor;
CREATE POLICY "auth_caixa_fornecedor"
  ON movelaria_caixa_fornecedor FOR ALL
  TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "auth_transacoes_caixa_fornecedor" ON movelaria_transacoes_caixa_fornecedor;
CREATE POLICY "auth_transacoes_caixa_fornecedor"
  ON movelaria_transacoes_caixa_fornecedor FOR ALL
  TO authenticated USING (true) WITH CHECK (true);
