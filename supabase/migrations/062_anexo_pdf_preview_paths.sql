-- Suporte a múltiplas páginas de preview para PDFs (uma imagem PNG por página)

ALTER TABLE movelaria_obra_arquivos
  ADD COLUMN IF NOT EXISTS preview_paths TEXT[];

ALTER TABLE movelaria_obra_evolucao
  ADD COLUMN IF NOT EXISTS preview_paths TEXT[];

ALTER TABLE movelaria_contas_pagar_anexos
  ADD COLUMN IF NOT EXISTS preview_paths TEXT[];
