-- Config do Negociador por lead (override da global em markup_config).
-- Sem linha = usa a config de todos os clientes.

DO $$
DECLARE
  r record;
  v_schema text;
BEGIN
  FOR r IN
    SELECT DISTINCT n.nspname
    FROM pg_namespace n
    JOIN pg_class c ON c.relnamespace = n.oid
    WHERE c.relkind = 'r'
      AND c.relname = 'leads'
      AND n.nspname LIKE 'emp_%'
  LOOP
    v_schema := r.nspname;

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.lead_negociador_config (
         lead_id BIGINT PRIMARY KEY,
         margem_minima_percent NUMERIC(10,2) NOT NULL DEFAULT 100,
         pct_material NUMERIC(10,2) NOT NULL DEFAULT 33.34,
         pct_mao_obra NUMERIC(10,2) NOT NULL DEFAULT 33.33,
         pct_lucro NUMERIC(10,2) NOT NULL DEFAULT 33.33,
         atualizado_por UUID,
         atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
       )',
      v_schema
    );

    EXECUTE format(
      'ALTER TABLE %I.lead_negociador_config ENABLE ROW LEVEL SECURITY',
      v_schema
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS auth_all_lead_negociador_config ON %I.lead_negociador_config',
      v_schema
    );
    EXECUTE format(
      'CREATE POLICY auth_all_lead_negociador_config ON %I.lead_negociador_config
         FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      v_schema
    );

    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON %I.lead_negociador_config TO authenticated',
      v_schema
    );
  END LOOP;
END $$;

CREATE TABLE IF NOT EXISTS public."CRM-multi-empresas>lead_negociador_config<" (
  lead_id BIGINT PRIMARY KEY,
  margem_minima_percent NUMERIC(10,2) NOT NULL DEFAULT 100,
  pct_material NUMERIC(10,2) NOT NULL DEFAULT 33.34,
  pct_mao_obra NUMERIC(10,2) NOT NULL DEFAULT 33.33,
  pct_lucro NUMERIC(10,2) NOT NULL DEFAULT 33.33,
  atualizado_por UUID,
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  schema_nome TEXT
);

ALTER TABLE public."CRM-multi-empresas>lead_negociador_config<" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_all_crm_lead_negociador_config
  ON public."CRM-multi-empresas>lead_negociador_config<";
CREATE POLICY auth_all_crm_lead_negociador_config
  ON public."CRM-multi-empresas>lead_negociador_config<"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public."CRM-multi-empresas>lead_negociador_config<" TO authenticated;

COMMENT ON TABLE emp_garbo.lead_negociador_config IS
  'Override do Negociador por lead. Se não houver linha, usa markup_config (todos os clientes).';
