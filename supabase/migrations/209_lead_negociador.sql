-- Negociador: margem mínima + splits na markup_config,
-- e histórico de negociações por lead (lead_negociacoes).

-- A) Colunas de configuração do Negociador em markup_config
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
      'ALTER TABLE %I.markup_config
         ADD COLUMN IF NOT EXISTS negociador_margem_minima_percent NUMERIC(10,2) NOT NULL DEFAULT 100,
         ADD COLUMN IF NOT EXISTS negociador_pct_material NUMERIC(10,2) NOT NULL DEFAULT 33.34,
         ADD COLUMN IF NOT EXISTS negociador_pct_mao_obra NUMERIC(10,2) NOT NULL DEFAULT 33.33,
         ADD COLUMN IF NOT EXISTS negociador_pct_lucro NUMERIC(10,2) NOT NULL DEFAULT 33.33',
      r.nspname
    );
  END LOOP;
END $$;

ALTER TABLE public."CRM-multi-empresas>markup_config<"
  ADD COLUMN IF NOT EXISTS negociador_margem_minima_percent NUMERIC(10,2) NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS negociador_pct_material NUMERIC(10,2) NOT NULL DEFAULT 33.34,
  ADD COLUMN IF NOT EXISTS negociador_pct_mao_obra NUMERIC(10,2) NOT NULL DEFAULT 33.33,
  ADD COLUMN IF NOT EXISTS negociador_pct_lucro NUMERIC(10,2) NOT NULL DEFAULT 33.33;

COMMENT ON COLUMN emp_garbo.markup_config.negociador_margem_minima_percent IS
  'Margem mínima aceitável do Negociador: % sobre o custo de material. Piso = custo × (1 + este%/100). Padrão 100.';
COMMENT ON COLUMN emp_garbo.markup_config.negociador_pct_material IS
  'Percentual do valor negociado atribuído a Material. Soma com mão de obra e lucro deve ser 100.';
COMMENT ON COLUMN emp_garbo.markup_config.negociador_pct_mao_obra IS
  'Percentual do valor negociado atribuído a Mão de obra.';
COMMENT ON COLUMN emp_garbo.markup_config.negociador_pct_lucro IS
  'Percentual do valor negociado atribuído a Lucro.';

-- B) Tabela lead_negociacoes em todos os schemas emp_*
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
      'CREATE TABLE IF NOT EXISTS %I.lead_negociacoes (
         id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
         lead_id BIGINT NOT NULL,
         orcamento_ids UUID[] NOT NULL DEFAULT ''{}'',
         custo_material NUMERIC(14,2) NOT NULL DEFAULT 0,
         preco_original NUMERIC(14,2) NOT NULL DEFAULT 0,
         margem_minima_percent NUMERIC(10,2) NOT NULL DEFAULT 100,
         piso NUMERIC(14,2) NOT NULL DEFAULT 0,
         valor_negociado NUMERIC(14,2) NOT NULL DEFAULT 0,
         pct_material NUMERIC(10,2) NOT NULL DEFAULT 33.34,
         pct_mao_obra NUMERIC(10,2) NOT NULL DEFAULT 33.33,
         pct_lucro NUMERIC(10,2) NOT NULL DEFAULT 33.33,
         valor_material NUMERIC(14,2) NOT NULL DEFAULT 0,
         valor_mao_obra NUMERIC(14,2) NOT NULL DEFAULT 0,
         valor_lucro NUMERIC(14,2) NOT NULL DEFAULT 0,
         status TEXT NOT NULL DEFAULT ''fechada'',
         observacao TEXT,
         criado_por UUID,
         criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
         atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
         CONSTRAINT lead_negociacoes_status_check
           CHECK (status IN (''rascunho'', ''fechada'', ''aplicada_markup''))
       )',
      v_schema
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS lead_negociacoes_lead_id_idx ON %I.lead_negociacoes (lead_id, atualizado_em DESC)',
      v_schema
    );

    EXECUTE format(
      'ALTER TABLE %I.lead_negociacoes ENABLE ROW LEVEL SECURITY',
      v_schema
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS auth_all_lead_negociacoes ON %I.lead_negociacoes',
      v_schema
    );
    EXECUTE format(
      'CREATE POLICY auth_all_lead_negociacoes ON %I.lead_negociacoes
         FOR ALL TO authenticated USING (true) WITH CHECK (true)',
      v_schema
    );

    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON %I.lead_negociacoes TO authenticated',
      v_schema
    );
  END LOOP;
END $$;

-- Espelho público (schemas emp_* ainda não expostos na API)
CREATE TABLE IF NOT EXISTS public."CRM-multi-empresas>lead_negociacoes<" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id BIGINT NOT NULL,
  orcamento_ids UUID[] NOT NULL DEFAULT '{}',
  custo_material NUMERIC(14,2) NOT NULL DEFAULT 0,
  preco_original NUMERIC(14,2) NOT NULL DEFAULT 0,
  margem_minima_percent NUMERIC(10,2) NOT NULL DEFAULT 100,
  piso NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_negociado NUMERIC(14,2) NOT NULL DEFAULT 0,
  pct_material NUMERIC(10,2) NOT NULL DEFAULT 33.34,
  pct_mao_obra NUMERIC(10,2) NOT NULL DEFAULT 33.33,
  pct_lucro NUMERIC(10,2) NOT NULL DEFAULT 33.33,
  valor_material NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_mao_obra NUMERIC(14,2) NOT NULL DEFAULT 0,
  valor_lucro NUMERIC(14,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'fechada',
  observacao TEXT,
  criado_por UUID,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  schema_nome TEXT,
  CONSTRAINT crm_lead_negociacoes_status_check
    CHECK (status IN ('rascunho', 'fechada', 'aplicada_markup'))
);

CREATE INDEX IF NOT EXISTS crm_lead_negociacoes_lead_id_idx
  ON public."CRM-multi-empresas>lead_negociacoes<" (lead_id, atualizado_em DESC);

ALTER TABLE public."CRM-multi-empresas>lead_negociacoes<" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS auth_all_crm_lead_negociacoes ON public."CRM-multi-empresas>lead_negociacoes<";
CREATE POLICY auth_all_crm_lead_negociacoes ON public."CRM-multi-empresas>lead_negociacoes<"
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public."CRM-multi-empresas>lead_negociacoes<" TO authenticated;
