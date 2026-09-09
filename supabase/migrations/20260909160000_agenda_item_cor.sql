-- Cor customizada por item da agenda (reunião, lembrete de lead, tarefa pessoal).
-- NULL = usa a cor padrão do tipo no calendário.

ALTER TABLE public.crm_multiempresas_agenda_pessoal_tarefas
  ADD COLUMN IF NOT EXISTS cor text;

ALTER TABLE public.agenda_pessoal_tarefas
  ADD COLUMN IF NOT EXISTS cor text;

ALTER TABLE public."CRM-multi-empresas>agenda_reunioes<"
  ADD COLUMN IF NOT EXISTS cor text;

ALTER TABLE public."CRM-multi-empresas>lead_lembretes<"
  ADD COLUMN IF NOT EXISTS cor text;

-- Espelho legado Selletos (se existir no mesmo banco)
DO $$
BEGIN
  IF to_regclass('public."CRM-Selletos>agenda_reunioes<"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public."CRM-Selletos>agenda_reunioes<" ADD COLUMN IF NOT EXISTS cor text';
  END IF;
  IF to_regclass('public."CRM-Selletos>lead_lembretes<"') IS NOT NULL THEN
    EXECUTE 'ALTER TABLE public."CRM-Selletos>lead_lembretes<" ADD COLUMN IF NOT EXISTS cor text';
  END IF;
END $$;

COMMENT ON COLUMN public.crm_multiempresas_agenda_pessoal_tarefas.cor IS
  'Cor hex (#rrggbb) do item na agenda; NULL = cor padrão do tipo.';

DO $$
DECLARE
  v_schema text;
BEGIN
  FOR v_schema IN
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name LIKE 'emp\_%' ESCAPE '\'
  LOOP
    IF to_regclass(format('%I.agenda_pessoal_tarefas', v_schema)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %I.agenda_pessoal_tarefas ADD COLUMN IF NOT EXISTS cor text',
        v_schema
      );
    END IF;

    IF to_regclass(format('%I.agenda_reunioes', v_schema)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %I.agenda_reunioes ADD COLUMN IF NOT EXISTS cor text',
        v_schema
      );
    END IF;

    IF to_regclass(format('%I.lead_lembretes', v_schema)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %I.lead_lembretes ADD COLUMN IF NOT EXISTS cor text',
        v_schema
      );
    END IF;
  END LOOP;
END $$;
