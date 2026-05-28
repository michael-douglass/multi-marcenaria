ALTER TABLE movelaria_orcamentos_fechados
  ADD COLUMN IF NOT EXISTS desconto_cartao_percentual NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS valor_liquido NUMERIC(12,2);

