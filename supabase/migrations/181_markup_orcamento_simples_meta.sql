-- Folha comercial do markup (orçamento simples).
-- Não cria tabela: o documento vive em markup_orcamentos.modulos.meta.orcamento_simples.

DO $$
DECLARE
  r record;
  comentario text :=
    'JSON do caderno de custo. Folha comercial do cliente em modulos.meta.orcamento_simples (itens, desconto, fotos, validade). Não altera preco_final.';
BEGIN
  FOR r IN
    SELECT n.nspname
    FROM pg_namespace n
    JOIN pg_class c ON c.relnamespace = n.oid
    WHERE c.relkind = 'r'
      AND c.relname = 'markup_orcamentos'
      AND n.nspname LIKE 'emp_%'
  LOOP
    EXECUTE format('COMMENT ON COLUMN %I.markup_orcamentos.modulos IS %L', r.nspname, comentario);
  END LOOP;

  IF EXISTS (
    SELECT 1
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname = 'CRM-multi-empresas>markup_orcamentos<'
  ) THEN
    COMMENT ON COLUMN public."CRM-multi-empresas>markup_orcamentos<".modulos IS
      'JSON do caderno de custo. Folha comercial do cliente em modulos.meta.orcamento_simples (itens, desconto, fotos, validade). Não altera preco_final.';
  END IF;
END $$;
