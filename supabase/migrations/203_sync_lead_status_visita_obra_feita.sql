-- Quando o projeto entra em “a serem feitos” ou “em andamento” no ateliê,
-- promove o lead no Kanban/Pipeline para “Visita em obra Feita” (só avançar).

CREATE OR REPLACE FUNCTION public.normalize_projeto_stage_nome_sql(p_nome text)
RETURNS text
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT translate(
    lower(trim(both from coalesce(p_nome, ''))),
    'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
    'aaaaaeeeeiiiiooooouuuucnaaaaaeeeeiiiiooooouuuucn'
  );
$$;

COMMENT ON FUNCTION public.normalize_projeto_stage_nome_sql(text) IS
  'Normaliza nome de coluna do ateliê/funil (minúsculas, sem acento) para match flexível.';

CREATE OR REPLACE FUNCTION public.projeto_stage_triggers_visita_obra_feita(p_nome text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT
    public.normalize_projeto_stage_nome_sql(p_nome) LIKE '%a serem feitos%'
    OR (
      public.normalize_projeto_stage_nome_sql(p_nome) LIKE '%em andamento%'
      AND public.normalize_projeto_stage_nome_sql(p_nome) LIKE '%projeto%'
    );
$$;

CREATE OR REPLACE FUNCTION public.resolve_visita_em_obra_feita_status(
  p_schema text,
  p_is_master boolean DEFAULT false
)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_nome text;
BEGIN
  IF p_is_master THEN
    SELECT s.nome INTO v_nome
    FROM public."CRM-multi-empresas>pipeline_custom_stages<" s
    WHERE coalesce(s.ativo, true) = true
      AND public.normalize_projeto_stage_nome_sql(s.nome) LIKE '%visita%'
      AND public.normalize_projeto_stage_nome_sql(s.nome) LIKE '%obra%'
      AND public.normalize_projeto_stage_nome_sql(s.nome) LIKE '%feita%'
    ORDER BY s.ordem ASC NULLS LAST
    LIMIT 1;
  ELSE
    EXECUTE format(
      $q$
      SELECT s.nome
      FROM %I.pipeline_custom_stages s
      WHERE coalesce(s.ativo, true) = true
        AND public.normalize_projeto_stage_nome_sql(s.nome) LIKE '%%visita%%'
        AND public.normalize_projeto_stage_nome_sql(s.nome) LIKE '%%obra%%'
        AND public.normalize_projeto_stage_nome_sql(s.nome) LIKE '%%feita%%'
      ORDER BY s.ordem ASC NULLS LAST
      LIMIT 1
      $q$,
      p_schema
    ) INTO v_nome;
  END IF;

  RETURN NULLIF(btrim(coalesce(v_nome, '')), '');
END;
$$;

CREATE OR REPLACE FUNCTION public.promote_lead_status_visita_obra_feita(
  p_schema text,
  p_lead_id integer,
  p_is_master boolean DEFAULT false
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_target text;
  v_current text;
  v_target_ordem integer;
  v_current_ordem integer;
BEGIN
  IF p_lead_id IS NULL THEN
    RETURN false;
  END IF;

  v_target := public.resolve_visita_em_obra_feita_status(p_schema, p_is_master);
  IF v_target IS NULL THEN
    RETURN false;
  END IF;

  IF p_is_master THEN
    SELECT l.status INTO v_current
    FROM public."CRM-multi-empresas>leads<" l
    WHERE l.id = p_lead_id;

    IF v_current IS NOT DISTINCT FROM v_target THEN
      RETURN false;
    END IF;

    SELECT s.ordem INTO v_target_ordem
    FROM public."CRM-multi-empresas>pipeline_custom_stages<" s
    WHERE coalesce(s.ativo, true) = true
      AND s.nome = v_target
    ORDER BY s.ordem ASC NULLS LAST
    LIMIT 1;

    SELECT s.ordem INTO v_current_ordem
    FROM public."CRM-multi-empresas>pipeline_custom_stages<" s
    WHERE coalesce(s.ativo, true) = true
      AND s.nome IS NOT DISTINCT FROM v_current
    ORDER BY s.ordem ASC NULLS LAST
    LIMIT 1;

    -- Só avança: status vazio OU etapa do funil com ordem menor que a visita feita.
    -- Status fora do funil (ex.: Orçamentos ganhos) não é alterado.
    IF (v_current IS NULL OR btrim(v_current) = '')
       OR (v_current_ordem IS NOT NULL AND v_target_ordem IS NOT NULL AND v_current_ordem < v_target_ordem)
    THEN
      UPDATE public."CRM-multi-empresas>leads<"
      SET status = v_target
      WHERE id = p_lead_id
        AND status IS DISTINCT FROM v_target;
      RETURN FOUND;
    END IF;
  ELSE
    EXECUTE format(
      'SELECT l.status FROM %I.leads l WHERE l.id = $1',
      p_schema
    ) INTO v_current USING p_lead_id;

    IF v_current IS NOT DISTINCT FROM v_target THEN
      RETURN false;
    END IF;

    EXECUTE format(
      $q$
      SELECT s.ordem
      FROM %I.pipeline_custom_stages s
      WHERE coalesce(s.ativo, true) = true
        AND s.nome = $1
      ORDER BY s.ordem ASC NULLS LAST
      LIMIT 1
      $q$,
      p_schema
    ) INTO v_target_ordem USING v_target;

    EXECUTE format(
      $q$
      SELECT s.ordem
      FROM %I.pipeline_custom_stages s
      WHERE coalesce(s.ativo, true) = true
        AND s.nome IS NOT DISTINCT FROM $1
      ORDER BY s.ordem ASC NULLS LAST
      LIMIT 1
      $q$,
      p_schema
    ) INTO v_current_ordem USING v_current;

    IF (v_current IS NULL OR btrim(v_current) = '')
       OR (v_current_ordem IS NOT NULL AND v_target_ordem IS NOT NULL AND v_current_ordem < v_target_ordem)
    THEN
      EXECUTE format(
        'UPDATE %I.leads SET status = $1 WHERE id = $2 AND status IS DISTINCT FROM $1',
        p_schema
      ) USING v_target, p_lead_id;
      RETURN FOUND;
    END IF;
  END IF;

  RETURN false;
END;
$$;

CREATE OR REPLACE FUNCTION public.sync_lead_status_from_projeto_stage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schema text := TG_TABLE_SCHEMA;
  v_is_master boolean := (TG_TABLE_SCHEMA = 'public');
  v_stage_nome text;
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.stage_id IS NOT DISTINCT FROM NEW.stage_id THEN
    RETURN NEW;
  END IF;

  IF NEW.stage_id IS NULL OR NEW.lead_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF v_is_master THEN
    SELECT s.nome INTO v_stage_nome
    FROM public."CRM-multi-empresas>projeto_stages<" s
    WHERE s.id = NEW.stage_id;
  ELSE
    EXECUTE format(
      'SELECT s.nome FROM %I.projeto_stages s WHERE s.id = $1',
      v_schema
    ) INTO v_stage_nome USING NEW.stage_id;
  END IF;

  IF NOT public.projeto_stage_triggers_visita_obra_feita(v_stage_nome) THEN
    RETURN NEW;
  END IF;

  PERFORM public.promote_lead_status_visita_obra_feita(v_schema, NEW.lead_id, v_is_master);
  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_lead_status_from_projeto_stage() IS
  'Ateliê → Pipeline: colunas a serem feitos / em andamento promovem lead para Visita em obra Feita (só avançar).';

-- Trigger emp_garbo
DROP TRIGGER IF EXISTS trg_sync_lead_status_from_projeto_stage ON emp_garbo.lead_projetos;
CREATE TRIGGER trg_sync_lead_status_from_projeto_stage
  AFTER INSERT OR UPDATE OF stage_id ON emp_garbo.lead_projetos
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_lead_status_from_projeto_stage();

-- Trigger master
DROP TRIGGER IF EXISTS trg_sync_lead_status_from_projeto_stage
  ON public."CRM-multi-empresas>lead_projetos<";
CREATE TRIGGER trg_sync_lead_status_from_projeto_stage
  AFTER INSERT OR UPDATE OF stage_id ON public."CRM-multi-empresas>lead_projetos<"
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_lead_status_from_projeto_stage();

-- Demais schemas emp_*
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
      'DROP TRIGGER IF EXISTS trg_sync_lead_status_from_projeto_stage ON %I.lead_projetos',
      v_schema
    );
    EXECUTE format(
      'CREATE TRIGGER trg_sync_lead_status_from_projeto_stage
         AFTER INSERT OR UPDATE OF stage_id ON %I.lead_projetos
         FOR EACH ROW
         EXECUTE FUNCTION public.sync_lead_status_from_projeto_stage()',
      v_schema
    );
  END LOOP;
END $$;

-- Backfill: leads já nas colunas alvo, só se puderem avançar no funil
DO $$
DECLARE
  v_schema text;
  v_lead_id integer;
BEGIN
  -- emp_* schemas
  FOR v_schema IN
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name LIKE 'emp\_%' ESCAPE '\'
  LOOP
    IF to_regclass(format('%I.lead_projetos', v_schema)) IS NULL
       OR to_regclass(format('%I.projeto_stages', v_schema)) IS NULL
       OR to_regclass(format('%I.leads', v_schema)) IS NULL
       OR to_regclass(format('%I.pipeline_custom_stages', v_schema)) IS NULL THEN
      CONTINUE;
    END IF;

    FOR v_lead_id IN EXECUTE format(
      $q$
      SELECT lp.lead_id
      FROM %I.lead_projetos lp
      JOIN %I.projeto_stages ps ON ps.id = lp.stage_id
      WHERE public.projeto_stage_triggers_visita_obra_feita(ps.nome)
      $q$,
      v_schema,
      v_schema
    ) LOOP
      PERFORM public.promote_lead_status_visita_obra_feita(v_schema, v_lead_id, false);
    END LOOP;
  END LOOP;

  -- master
  IF EXISTS (
    SELECT 1
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name = 'CRM-multi-empresas>lead_projetos<'
  ) THEN
    FOR v_lead_id IN
      SELECT lp.lead_id
      FROM public."CRM-multi-empresas>lead_projetos<" lp
      JOIN public."CRM-multi-empresas>projeto_stages<" ps ON ps.id = lp.stage_id
      WHERE public.projeto_stage_triggers_visita_obra_feita(ps.nome)
    LOOP
      PERFORM public.promote_lead_status_visita_obra_feita('public', v_lead_id, true);
    END LOOP;
  END IF;
END $$;
