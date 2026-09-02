-- Puxar lead para produção sem exigir obra
ALTER TABLE emp_garbo.obra_producao
  ALTER COLUMN obra_id DROP NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS obra_producao_lead_id_uidx
  ON emp_garbo.obra_producao (lead_id);

CREATE OR REPLACE FUNCTION public.movelaria_puxar_lead_producao(p_lead_id BIGINT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, emp_garbo
AS $$
DECLARE
  v_id UUID;
  v_stage UUID;
  v_obra UUID;
BEGIN
  IF NOT emp_garbo.me_can_access_producao(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado à produção';
  END IF;

  SELECT id INTO v_id FROM emp_garbo.obra_producao WHERE lead_id = p_lead_id;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT id INTO v_stage
  FROM emp_garbo.producao_stages
  WHERE ativo = true
  ORDER BY ordem ASC
  LIMIT 1;

  IF v_stage IS NULL THEN
    RAISE EXCEPTION 'Nenhuma coluna de produção configurada';
  END IF;

  SELECT id INTO v_obra
  FROM public.movelaria_obras
  WHERE origem_lead_id = p_lead_id::text
  ORDER BY criado_em DESC NULLS LAST
  LIMIT 1;

  INSERT INTO emp_garbo.obra_producao (obra_id, lead_id, stage_id)
  VALUES (v_obra, p_lead_id, v_stage)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_puxar_lead_producao(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_puxar_lead_producao(BIGINT) TO authenticated;
