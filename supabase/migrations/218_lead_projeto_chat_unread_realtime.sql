-- ============================================================
-- Realtime do badge de não lidas do chat do ateliê
-- - Publica lead_projeto_chat_leituras (marcar lida/não lida ao vivo)
-- - Replica IDENTITY FULL para filtros em UPDATE/DELETE
-- ============================================================

DO $$
DECLARE
  v_schema text;
BEGIN
  -- emp_garbo + demais emp_*
  FOR v_schema IN
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name = 'emp_garbo'
       OR schema_name LIKE 'emp\_%' ESCAPE '\'
  LOOP
    IF to_regclass(format('%I.lead_projeto_notas', v_schema)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %I.lead_projeto_notas REPLICA IDENTITY FULL',
        v_schema
      );

      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = v_schema
          AND tablename = 'lead_projeto_notas'
      ) THEN
        EXECUTE format(
          'ALTER PUBLICATION supabase_realtime ADD TABLE %I.lead_projeto_notas',
          v_schema
        );
      END IF;
    END IF;

    IF to_regclass(format('%I.lead_projeto_chat_leituras', v_schema)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %I.lead_projeto_chat_leituras REPLICA IDENTITY FULL',
        v_schema
      );

      IF NOT EXISTS (
        SELECT 1 FROM pg_publication_tables
        WHERE pubname = 'supabase_realtime'
          AND schemaname = v_schema
          AND tablename = 'lead_projeto_chat_leituras'
      ) THEN
        EXECUTE format(
          'ALTER PUBLICATION supabase_realtime ADD TABLE %I.lead_projeto_chat_leituras',
          v_schema
        );
      END IF;
    END IF;
  END LOOP;

  -- Espelho public (schemas ainda não expostos na API)
  IF to_regclass('public."CRM-multi-empresas>lead_projeto_notas<"') IS NOT NULL THEN
    ALTER TABLE public."CRM-multi-empresas>lead_projeto_notas<" REPLICA IDENTITY FULL;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'CRM-multi-empresas>lead_projeto_notas<'
    ) THEN
      ALTER PUBLICATION supabase_realtime
        ADD TABLE public."CRM-multi-empresas>lead_projeto_notas<";
    END IF;
  END IF;

  IF to_regclass('public."CRM-multi-empresas>lead_projeto_chat_leituras<"') IS NOT NULL THEN
    ALTER TABLE public."CRM-multi-empresas>lead_projeto_chat_leituras<" REPLICA IDENTITY FULL;
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = 'CRM-multi-empresas>lead_projeto_chat_leituras<'
    ) THEN
      ALTER PUBLICATION supabase_realtime
        ADD TABLE public."CRM-multi-empresas>lead_projeto_chat_leituras<";
    END IF;
  END IF;
END $$;
