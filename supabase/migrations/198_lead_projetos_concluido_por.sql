-- Assinatura de quem marcou o projeto como concluído (ateliê).
-- Emp_garbo + espelho master CRM-multi-empresas + demais schemas emp_*.

ALTER TABLE emp_garbo.lead_projetos
  ADD COLUMN IF NOT EXISTS concluido_por UUID,
  ADD COLUMN IF NOT EXISTS concluido_em TIMESTAMPTZ;

COMMENT ON COLUMN emp_garbo.lead_projetos.concluido_por IS
  'Usuário que marcou o projeto como concluído (última coluna / feitos).';
COMMENT ON COLUMN emp_garbo.lead_projetos.concluido_em IS
  'Momento em que o projeto foi marcado como concluído.';

ALTER TABLE public."CRM-multi-empresas>lead_projetos<"
  ADD COLUMN IF NOT EXISTS concluido_por UUID,
  ADD COLUMN IF NOT EXISTS concluido_em TIMESTAMPTZ;

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
    IF to_regclass(format('%I.lead_projetos', v_schema)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %I.lead_projetos
           ADD COLUMN IF NOT EXISTS concluido_por UUID,
           ADD COLUMN IF NOT EXISTS concluido_em TIMESTAMPTZ',
        v_schema
      );
    END IF;
  END LOOP;
END $$;

-- Backfill: quem estava com o desenho vira a assinatura nos já feitos
-- (última coluna por ordem em cada schema).
DO $$
DECLARE
  v_schema text;
  v_feito_id uuid;
BEGIN
  FOR v_schema IN
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name LIKE 'emp\_%' ESCAPE '\'
  LOOP
    IF to_regclass(format('%I.lead_projetos', v_schema)) IS NULL
       OR to_regclass(format('%I.projeto_stages', v_schema)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'SELECT id FROM %I.projeto_stages WHERE ativo = true ORDER BY ordem DESC LIMIT 1',
      v_schema
    ) INTO v_feito_id;

    IF v_feito_id IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'UPDATE %I.lead_projetos
         SET concluido_por = arquiteto_id,
             concluido_em = COALESCE(atualizado_em, criado_em, now())
       WHERE stage_id = $1
         AND concluido_por IS NULL
         AND arquiteto_id IS NOT NULL',
      v_schema
    ) USING v_feito_id;
  END LOOP;
END $$;
