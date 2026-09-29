-- Precificação de mão de obra por hora e por dia.
-- markup_config: valor_dia_marcenaria (referência global).
-- markup_servico_templates: unidade_cobranca ('hora' | 'dia').

DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT n.nspname
    FROM pg_namespace n
    JOIN pg_class c ON c.relnamespace = n.oid
    WHERE c.relkind = 'r'
      AND c.relname = 'markup_config'
      AND n.nspname LIKE 'emp_%'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.markup_config ADD COLUMN IF NOT EXISTS valor_dia_marcenaria NUMERIC(12,2) NOT NULL DEFAULT 640',
      r.nspname
    );
  END LOOP;

  FOR r IN
    SELECT n.nspname
    FROM pg_namespace n
    JOIN pg_class c ON c.relnamespace = n.oid
    WHERE c.relkind = 'r'
      AND c.relname = 'markup_servico_templates'
      AND n.nspname LIKE 'emp_%'
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.markup_servico_templates ADD COLUMN IF NOT EXISTS unidade_cobranca TEXT NOT NULL DEFAULT ''hora''',
      r.nspname
    );
    -- Normaliza valores inválidos antes do CHECK (idempotente).
    EXECUTE format(
      'UPDATE %I.markup_servico_templates SET unidade_cobranca = ''hora'' WHERE unidade_cobranca IS NULL OR unidade_cobranca NOT IN (''hora'', ''dia'')',
      r.nspname
    );
    BEGIN
      EXECUTE format(
        'ALTER TABLE %I.markup_servico_templates ADD CONSTRAINT markup_servico_templates_unidade_cobranca_check CHECK (unidade_cobranca IN (''hora'', ''dia''))',
        r.nspname
      );
    EXCEPTION
      WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

ALTER TABLE public."CRM-multi-empresas>markup_config<"
  ADD COLUMN IF NOT EXISTS valor_dia_marcenaria NUMERIC(12,2) NOT NULL DEFAULT 640;

ALTER TABLE public."CRM-multi-empresas>markup_servico_templates<"
  ADD COLUMN IF NOT EXISTS unidade_cobranca TEXT NOT NULL DEFAULT 'hora';

UPDATE public."CRM-multi-empresas>markup_servico_templates<"
SET unidade_cobranca = 'hora'
WHERE unidade_cobranca IS NULL OR unidade_cobranca NOT IN ('hora', 'dia');

DO $$
BEGIN
  ALTER TABLE public."CRM-multi-empresas>markup_servico_templates<"
    ADD CONSTRAINT crm_markup_servico_templates_unidade_cobranca_check
    CHECK (unidade_cobranca IN ('hora', 'dia'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN emp_garbo.markup_config.valor_dia_marcenaria IS
  'Valor padrão de 1 dia de mão de obra (R$). Usado quando o campo cobra por dia.';

COMMENT ON COLUMN emp_garbo.markup_servico_templates.unidade_cobranca IS
  'Unidade de cobrança do campo: hora ou dia. A quantidade no orçamento multiplica o valor padrão.';
