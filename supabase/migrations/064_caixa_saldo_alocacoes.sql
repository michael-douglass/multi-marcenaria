-- Alocações do saldo disponível (bancos/contas) por mês de referência
CREATE TABLE IF NOT EXISTS movelaria_caixa_saldo_alocacoes (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  mes_referencia  INTEGER NOT NULL CHECK (mes_referencia BETWEEN 1 AND 12),
  ano_referencia  INTEGER NOT NULL CHECK (ano_referencia >= 2020),
  descricao       TEXT NOT NULL,
  valor           NUMERIC(12, 2) NOT NULL CHECK (valor > 0),
  criado_por      UUID REFERENCES auth.users(id),
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_caixa_saldo_aloc_mes_ano
  ON movelaria_caixa_saldo_alocacoes (ano_referencia, mes_referencia);

ALTER TABLE movelaria_caixa_saldo_alocacoes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_caixa_saldo_alocacoes" ON movelaria_caixa_saldo_alocacoes;
CREATE POLICY "auth_caixa_saldo_alocacoes"
  ON movelaria_caixa_saldo_alocacoes FOR ALL TO authenticated
  USING (true) WITH CHECK (true);
