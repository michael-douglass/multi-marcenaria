-- Pipeline → Ateliê: quando o lead entra em “Enviou orçamento”, o card do projeto
-- vai para a coluna “Orçamento ( Ja enviados )” em Projetos.

CREATE OR REPLACE FUNCTION public.lead_status_is_enviou_orcamento(p_status text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT public.normalize_projeto_stage_nome_sql(p_status) IN (
    'enviou orcamento',
    'orcamentos ja enviados',
    'orcamento ja enviado',
    'orcamento enviado'
  );
$$;

CREATE OR REPLACE FUNCTION public.sync_projeto_stage_from_lead_status()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_schema text := TG_TABLE_SCHEMA;
  v_is_master boolean := (TG_TABLE_SCHEMA = 'public');
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  IF NOT public.lead_status_is_enviou_orcamento(NEW.status) THEN
    RETURN NEW;
  END IF;

  IF v_is_master THEN
    UPDATE public."CRM-multi-empresas>lead_projetos<" lp
    SET stage_id = t.id
    FROM (
      SELECT s.id
      FROM public."CRM-multi-empresas>projeto_stages<" s
      WHERE coalesce(s.ativo, true) = true
        AND public.normalize_projeto_stage_nome_sql(s.nome) LIKE '%orcamento%'
        AND public.normalize_projeto_stage_nome_sql(s.nome) LIKE '%enviado%'
      ORDER BY s.ordem ASC NULLS LAST
      LIMIT 1
    ) t
    WHERE lp.lead_id = NEW.id AND lp.stage_id IS DISTINCT FROM t.id;
  ELSE
    EXECUTE format(
      $q$
      UPDATE %1$I.lead_projetos lp
      SET stage_id = t.id
      FROM (
        SELECT s.id
        FROM %1$I.projeto_stages s
        WHERE coalesce(s.ativo, true) = true
          AND public.normalize_projeto_stage_nome_sql(s.nome) LIKE '%%orcamento%%'
          AND public.normalize_projeto_stage_nome_sql(s.nome) LIKE '%%enviado%%'
        ORDER BY s.ordem ASC NULLS LAST
        LIMIT 1
      ) t
      WHERE lp.lead_id = $1 AND lp.stage_id IS DISTINCT FROM t.id
      $q$,
      v_schema
    ) USING NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sync_projeto_stage_from_lead_status() IS
  'Pipeline → Ateliê: lead em Enviou orçamento move o projeto para a coluna Orçamento (Ja enviados).';

-- Master
DROP TRIGGER IF EXISTS trg_sync_projeto_stage_from_lead_status ON public."CRM-multi-empresas>leads<";
CREATE TRIGGER trg_sync_projeto_stage_from_lead_status
  AFTER INSERT OR UPDATE OF status ON public."CRM-multi-empresas>leads<"
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_projeto_stage_from_lead_status();

-- Schemas emp_* (inclui emp_garbo) + backfill
DO $$
DECLARE
  v_schema text;
BEGIN
  FOR v_schema IN
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name LIKE 'emp\_%' ESCAPE '\'
  LOOP
    IF to_regclass(format('%I.leads', v_schema)) IS NULL
       OR to_regclass(format('%I.lead_projetos', v_schema)) IS NULL
       OR to_regclass(format('%I.projeto_stages', v_schema)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format('DROP TRIGGER IF EXISTS trg_sync_projeto_stage_from_lead_status ON %I.leads', v_schema);
    EXECUTE format(
      'CREATE TRIGGER trg_sync_projeto_stage_from_lead_status
         AFTER INSERT OR UPDATE OF status ON %I.leads
         FOR EACH ROW
         EXECUTE FUNCTION public.sync_projeto_stage_from_lead_status()',
      v_schema
    );

    -- Backfill: leads que já estão em Enviou orçamento
    EXECUTE format(
      $q$
      UPDATE %1$I.lead_projetos lp
      SET stage_id = t.id
      FROM %1$I.leads l,
        LATERAL (
          SELECT s.id FROM %1$I.projeto_stages s
          WHERE coalesce(s.ativo, true) = true
            AND public.normalize_projeto_stage_nome_sql(s.nome) LIKE '%%orcamento%%'
            AND public.normalize_projeto_stage_nome_sql(s.nome) LIKE '%%enviado%%'
          ORDER BY s.ordem ASC NULLS LAST
          LIMIT 1
        ) t
      WHERE l.id = lp.lead_id
        AND public.lead_status_is_enviou_orcamento(l.status)
        AND lp.stage_id IS DISTINCT FROM t.id
      $q$,
      v_schema
    );
  END LOOP;
END $$;
