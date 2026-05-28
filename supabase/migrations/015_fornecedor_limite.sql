-- Limite de crédito/compra acordado com cada fornecedor
ALTER TABLE movelaria_fornecedores
  ADD COLUMN IF NOT EXISTS limite_com_fornecedor NUMERIC(14, 2) NOT NULL DEFAULT 0;

COMMENT ON COLUMN movelaria_fornecedores.limite_com_fornecedor IS
  'Teto de compras a prazo; contas a pagar pendentes abatem deste valor.';
