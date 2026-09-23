-- Snapshot do nome de quem concluiu o projeto (assinatura legível: Gabriel, Monica…).

ALTER TABLE emp_garbo.lead_projetos
  ADD COLUMN IF NOT EXISTS concluido_por_nome TEXT;

COMMENT ON COLUMN emp_garbo.lead_projetos.concluido_por_nome IS
  'Nome de exibição de quem marcou como concluído (gravado no momento da conclusão).';

ALTER TABLE public."CRM-multi-empresas>lead_projetos<"
  ADD COLUMN IF NOT EXISTS concluido_por_nome TEXT;

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
        'ALTER TABLE %I.lead_projetos ADD COLUMN IF NOT EXISTS concluido_por_nome TEXT',
        v_schema
      );
    END IF;
  END LOOP;
END $$;

-- Backfill: primeiro nome a partir de usuarios, quando já há concluido_por
DO $$
DECLARE
  v_schema text;
BEGIN
  FOR v_schema IN
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name LIKE 'emp\_%' ESCAPE '\'
  LOOP
    IF to_regclass(format('%I.lead_projetos', v_schema)) IS NULL
       OR to_regclass(format('%I.usuarios', v_schema)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      'UPDATE %I.lead_projetos lp
         SET concluido_por_nome = split_part(trim(u.nome), '' '', 1)
       FROM %I.usuarios u
       WHERE u.id = lp.concluido_por
         AND lp.concluido_por IS NOT NULL
         AND (lp.concluido_por_nome IS NULL OR btrim(lp.concluido_por_nome) = '''')
         AND u.nome IS NOT NULL
         AND btrim(u.nome) <> ''''',
      v_schema,
      v_schema
    );
  END LOOP;
END $$;
