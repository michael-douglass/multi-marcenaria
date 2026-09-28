-- lead_projetos.lead_id é bigint; o trigger sync_lead_status_from_projeto_stage
-- chamava promote_lead_status_visita_obra_feita(..., NEW.lead_id, ...) e o Postgres
-- não encontrava a função com assinatura (text, integer, boolean) → PATCH 404 ao
-- mover cards para "a serem feitos" / "em andamento".

DROP FUNCTION IF EXISTS public.promote_lead_status_visita_obra_feita(text, integer, boolean);
DROP FUNCTION IF EXISTS public.promote_lead_status_visita_obra_feita(text, bigint, boolean);

CREATE OR REPLACE FUNCTION public.promote_lead_status_visita_obra_feita(
  p_schema text,
  p_lead_id bigint,
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

COMMENT ON FUNCTION public.promote_lead_status_visita_obra_feita(text, bigint, boolean) IS
  'Promove lead para Visita em obra Feita (só avançar). lead_id como bigint (mesmo tipo de leads.id / lead_projetos.lead_id).';
