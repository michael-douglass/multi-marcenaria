-- Adiciona suporte a cobranças recorrentes em movelaria_contas_pagar.
-- recorrencia_id: UUID compartilhado entre todas as parcelas da mesma série.
-- recorrente: flag que identifica a conta como parte de uma recorrência.
-- recorrencia_valor_base: valor padrão para auto-geração de novos meses.
-- recorrencia_encerramento: data opcional de encerramento da série.
ALTER TABLE movelaria_contas_pagar
  ADD COLUMN IF NOT EXISTS recorrente              BOOLEAN        NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS recorrencia_id          UUID,
  ADD COLUMN IF NOT EXISTS recorrencia_valor_base  NUMERIC(12, 2),
  ADD COLUMN IF NOT EXISTS recorrencia_encerramento DATE;

CREATE INDEX IF NOT EXISTS idx_contas_pagar_recorrencia_id
  ON movelaria_contas_pagar (recorrencia_id)
  WHERE recorrencia_id IS NOT NULL;
