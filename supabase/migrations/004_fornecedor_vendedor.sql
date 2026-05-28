ALTER TABLE movelaria_fornecedores
  ADD COLUMN IF NOT EXISTS nome_vendedor     TEXT,
  ADD COLUMN IF NOT EXISTS telefone_vendedor TEXT;
