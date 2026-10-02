-- Chat do ateliê: cada mensagem tem um destinatário.
-- Visibilidade: autor + destinatário (admin vê tudo). NULL = fila do ateliê (projetistas).

ALTER TABLE emp_garbo.lead_projeto_notas
  ADD COLUMN IF NOT EXISTS destinatario_id UUID;

COMMENT ON COLUMN emp_garbo.lead_projeto_notas.destinatario_id IS
  'Usuário a quem a mensagem foi endereçada. NULL = fila do ateliê (visível a projetistas).';

CREATE INDEX IF NOT EXISTS lead_projeto_notas_destinatario_idx
  ON emp_garbo.lead_projeto_notas (destinatario_id)
  WHERE destinatario_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS lead_projeto_notas_autor_idx
  ON emp_garbo.lead_projeto_notas (autor_id);

ALTER TABLE public."CRM-multi-empresas>lead_projeto_notas<"
  ADD COLUMN IF NOT EXISTS destinatario_id UUID;

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
    IF to_regclass(format('%I.lead_projeto_notas', v_schema)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'ALTER TABLE %I.lead_projeto_notas
         ADD COLUMN IF NOT EXISTS destinatario_id UUID',
      v_schema
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS lead_projeto_notas_destinatario_idx
         ON %I.lead_projeto_notas (destinatario_id)
         WHERE destinatario_id IS NOT NULL',
      v_schema
    );

    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS lead_projeto_notas_autor_idx
         ON %I.lead_projeto_notas (autor_id)',
      v_schema
    );
  END LOOP;
END $$;

-- Backfill: titular → arquiteto; arquiteto → titular.
DO $$
DECLARE
  v_schema text;
BEGIN
  FOR v_schema IN
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name LIKE 'emp\_%' ESCAPE '\'
  LOOP
    IF to_regclass(format('%I.lead_projeto_notas', v_schema)) IS NULL
       OR to_regclass(format('%I.lead_projetos', v_schema)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'UPDATE %I.lead_projeto_notas n
         SET destinatario_id = CASE
           WHEN lp.titular_id IS NOT NULL AND n.autor_id = lp.titular_id THEN lp.arquiteto_id
           WHEN lp.arquiteto_id IS NOT NULL AND n.autor_id = lp.arquiteto_id THEN lp.titular_id
           WHEN lp.titular_id IS NOT NULL AND n.autor_id <> lp.titular_id THEN lp.titular_id
           ELSE n.destinatario_id
         END
       FROM %I.lead_projetos lp
       WHERE lp.lead_id = n.lead_id
         AND n.destinatario_id IS NULL',
      v_schema,
      v_schema
    );
  END LOOP;
END $$;
