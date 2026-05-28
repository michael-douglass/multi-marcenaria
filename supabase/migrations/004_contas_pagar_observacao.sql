-- Observação em lançamentos manuais / contas a pagar
ALTER TABLE movelaria_contas_pagar
  ADD COLUMN IF NOT EXISTS observacao TEXT;
