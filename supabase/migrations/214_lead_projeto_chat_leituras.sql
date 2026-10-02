-- ============================================================
-- Leitura do canal do ateliê (estilo WhatsApp)
-- last_read_at por usuário + lead — contagem real de não lidas
-- emp_garbo + demais emp_* + espelho public CRM-multi-empresas
-- ============================================================

-- A) emp_garbo (schema principal exposto)
CREATE TABLE IF NOT EXISTS emp_garbo.lead_projeto_chat_leituras (
  user_id uuid NOT NULL,
  lead_id bigint NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, lead_id)
);

CREATE INDEX IF NOT EXISTS lead_projeto_chat_leituras_user_idx
  ON emp_garbo.lead_projeto_chat_leituras (user_id, last_read_at DESC);

COMMENT ON TABLE emp_garbo.lead_projeto_chat_leituras IS
  'Última vez que o usuário abriu o canal do ateliê daquele lead (não lidas = msgs do outro depois disso).';

ALTER TABLE emp_garbo.lead_projeto_chat_leituras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_projeto_chat_leituras_own ON emp_garbo.lead_projeto_chat_leituras;
CREATE POLICY lead_projeto_chat_leituras_own ON emp_garbo.lead_projeto_chat_leituras
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE ON emp_garbo.lead_projeto_chat_leituras TO authenticated;

-- B) Demais schemas emp_* (exceto emp_garbo já feito)
DO $$
DECLARE
  v_schema text;
BEGIN
  FOR v_schema IN
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name LIKE 'emp\_%' ESCAPE '\'
      AND schema_name <> 'emp_garbo'
  LOOP
    IF to_regclass(format('%I.lead_projetos', v_schema)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'CREATE TABLE IF NOT EXISTS %I.lead_projeto_chat_leituras (
         user_id uuid NOT NULL,
         lead_id bigint NOT NULL,
         last_read_at timestamptz NOT NULL DEFAULT now(),
         PRIMARY KEY (user_id, lead_id)
       )',
      v_schema
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS lead_projeto_chat_leituras_user_idx
         ON %I.lead_projeto_chat_leituras (user_id, last_read_at DESC)',
      v_schema
    );

    EXECUTE format(
      'ALTER TABLE %I.lead_projeto_chat_leituras ENABLE ROW LEVEL SECURITY',
      v_schema
    );

    EXECUTE format(
      'DROP POLICY IF EXISTS lead_projeto_chat_leituras_own ON %I.lead_projeto_chat_leituras',
      v_schema
    );

    EXECUTE format(
      'CREATE POLICY lead_projeto_chat_leituras_own ON %I.lead_projeto_chat_leituras
         FOR ALL TO authenticated
         USING (user_id = auth.uid())
         WITH CHECK (user_id = auth.uid())',
      v_schema
    );

    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON %I.lead_projeto_chat_leituras TO authenticated',
      v_schema
    );
  END LOOP;
END $$;

-- C) Espelho public (schemas emp_* ainda não expostos na API)
CREATE TABLE IF NOT EXISTS public."CRM-multi-empresas>lead_projeto_chat_leituras<" (
  user_id uuid NOT NULL,
  lead_id bigint NOT NULL,
  last_read_at timestamptz NOT NULL DEFAULT now(),
  schema_nome text,
  PRIMARY KEY (user_id, lead_id)
);

CREATE INDEX IF NOT EXISTS crm_lead_projeto_chat_leituras_user_idx
  ON public."CRM-multi-empresas>lead_projeto_chat_leituras<" (user_id, last_read_at DESC);

ALTER TABLE public."CRM-multi-empresas>lead_projeto_chat_leituras<" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS lead_projeto_chat_leituras_own ON public."CRM-multi-empresas>lead_projeto_chat_leituras<";
CREATE POLICY lead_projeto_chat_leituras_own ON public."CRM-multi-empresas>lead_projeto_chat_leituras<"
  FOR ALL TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public."CRM-multi-empresas>lead_projeto_chat_leituras<" TO authenticated;
