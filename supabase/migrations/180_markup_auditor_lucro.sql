-- Auditor de lucro: preço final alvo = custo de material × (percentual / 100).
-- 400% em R$ 10.000 = R$ 40.000. Só o administrador altera na calculadora.

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
      'ALTER TABLE %I.markup_config ADD COLUMN IF NOT EXISTS auditor_lucro_percentual NUMERIC(10,2) NOT NULL DEFAULT 400',
      r.nspname
    );
  END LOOP;
END $$;

ALTER TABLE public."CRM-multi-empresas>markup_config<"
  ADD COLUMN IF NOT EXISTS auditor_lucro_percentual NUMERIC(10,2) NOT NULL DEFAULT 400;

COMMENT ON COLUMN emp_garbo.markup_config.auditor_lucro_percentual IS
  'Percentual alvo do Auditor de lucro: preço final = custo de material × (este valor / 100). Padrão 400.';
