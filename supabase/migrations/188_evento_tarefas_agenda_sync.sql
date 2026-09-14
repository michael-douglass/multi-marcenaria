-- Vínculo Controle de Eventos ↔ Agenda Pessoal
-- Cada checklist do evento pode espelhar uma tarefa completa na agenda.

ALTER TABLE public.crm_multiempresas_agenda_pessoal_tarefas
  ADD COLUMN IF NOT EXISTS evento_id uuid,
  ADD COLUMN IF NOT EXISTS evento_tarefa_id uuid;

CREATE UNIQUE INDEX IF NOT EXISTS crm_multiempresas_agenda_pessoal_evento_tarefa_uidx
  ON public.crm_multiempresas_agenda_pessoal_tarefas (evento_tarefa_id)
  WHERE evento_tarefa_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS crm_multiempresas_agenda_pessoal_evento_id_idx
  ON public.crm_multiempresas_agenda_pessoal_tarefas (evento_id)
  WHERE evento_id IS NOT NULL;

COMMENT ON COLUMN public.crm_multiempresas_agenda_pessoal_tarefas.evento_id IS
  'Pasta de Controle de Eventos que originou esta tarefa (se houver).';
COMMENT ON COLUMN public.crm_multiempresas_agenda_pessoal_tarefas.evento_tarefa_id IS
  'ID da linha em evento_tarefas / crm_multiempresas_evento_tarefas.';

ALTER TABLE public.crm_multiempresas_evento_tarefas
  ADD COLUMN IF NOT EXISTS agenda_tarefa_id uuid;

CREATE INDEX IF NOT EXISTS crm_multiempresas_evento_tarefas_agenda_idx
  ON public.crm_multiempresas_evento_tarefas (agenda_tarefa_id)
  WHERE agenda_tarefa_id IS NOT NULL;

ALTER TABLE public.agenda_pessoal_tarefas
  ADD COLUMN IF NOT EXISTS evento_id uuid,
  ADD COLUMN IF NOT EXISTS evento_tarefa_id uuid;

DO $$
BEGIN
  IF to_regclass('public.agenda_pessoal_tarefas') IS NOT NULL THEN
    EXECUTE $sql$
      CREATE UNIQUE INDEX IF NOT EXISTS agenda_pessoal_evento_tarefa_uidx
        ON public.agenda_pessoal_tarefas (evento_tarefa_id)
        WHERE evento_tarefa_id IS NOT NULL
    $sql$;
  END IF;
END $$;

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
        'ALTER TABLE %I.agenda_pessoal_tarefas ADD COLUMN IF NOT EXISTS evento_id uuid',
        v_schema
      );
      EXECUTE format(
        'ALTER TABLE %I.agenda_pessoal_tarefas ADD COLUMN IF NOT EXISTS evento_tarefa_id uuid',
        v_schema
      );
      EXECUTE format(
        'CREATE UNIQUE INDEX IF NOT EXISTS agenda_pessoal_evento_tarefa_uidx ON %I.agenda_pessoal_tarefas (evento_tarefa_id) WHERE evento_tarefa_id IS NOT NULL',
        v_schema
      );
    END IF;

    IF to_regclass(format('%I.evento_tarefas', v_schema)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %I.evento_tarefas ADD COLUMN IF NOT EXISTS agenda_tarefa_id uuid',
        v_schema
      );
      EXECUTE format(
        'CREATE INDEX IF NOT EXISTS evento_tarefas_agenda_idx ON %I.evento_tarefas (agenda_tarefa_id) WHERE agenda_tarefa_id IS NOT NULL',
        v_schema
      );
    END IF;
  END LOOP;
END $$;
