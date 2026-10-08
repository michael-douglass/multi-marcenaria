-- Renomeia a coluna “Projeto pronto para orçamento” para “Precificações concluídas”
-- em todos os schemas emp_* (projetos concluídos passam a cair nela).
DO $$
DECLARE
  v_schema text;
BEGIN
  FOR v_schema IN
    SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'emp\_%' ESCAPE '\'
  LOOP
    IF to_regclass(format('%I.projeto_stages', v_schema)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format(
      $q$UPDATE %I.projeto_stages
         SET nome = 'Precificações concluídas'
         WHERE public.normalize_projeto_stage_nome_sql(nome) LIKE '%%pronto%%para%%orcamento%%'$q$,
      v_schema
    );
  END LOOP;
END $$;
