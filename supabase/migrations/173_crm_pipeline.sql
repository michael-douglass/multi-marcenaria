-- ============================================================
-- Pipeline CRM Garbo: leitura e movimentação via emp_garbo
-- ============================================================

CREATE OR REPLACE FUNCTION public.movelaria_crm_pode_pipeline()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_tipo   TEXT;
  v_status TEXT;
  v_roles  TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT c.tipo_usuario, c.status_convite
  INTO v_tipo, v_status
  FROM emp_garbo.usuarios c
  WHERE c.id = auth.uid();

  IF v_tipo IS DISTINCT FROM 'colaborador' OR v_status IS DISTINCT FROM 'ATIVO' THEN
    RETURN FALSE;
  END IF;

  SELECT COALESCE(array_agg(r.role::TEXT), '{}'::TEXT[])
  INTO v_roles
  FROM emp_garbo.user_roles r
  WHERE r.user_id = auth.uid();

  RETURN v_roles && ARRAY['admin', 'vendedor', 'projetista', 'projetista_admin'];
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_pode_pipeline() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_pode_pipeline() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_pipeline_boot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_stages JSONB;
  v_pages  JSONB;
  v_leads  JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_pipeline() THEN
    RAISE EXCEPTION 'Acesso negado ao pipeline comercial';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'nome', s.nome,
    'ordem', s.ordem
  ) ORDER BY s.ordem, s.nome), '[]'::JSONB)
  INTO v_stages
  FROM emp_garbo.pipeline_custom_stages s
  WHERE s.ativo IS TRUE;

  SELECT COALESCE(jsonb_agg(pagina ORDER BY (pagina->>'ordem')::INT, pagina->>'nome'), '[]'::JSONB)
  INTO v_pages
  FROM (
    SELECT jsonb_build_object(
      'id', p.id,
      'nome', p.nome,
      'slug', p.slug,
      'ordem', p.ordem,
      'colunas', COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
          'id', c.id,
          'nome', c.nome,
          'ordem', c.ordem,
          'fontes', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'tipo', f.tipo_fonte,
              'valor', f.valor_fonte,
              'ativo', f.ativo
            ))
            FROM emp_garbo.kanban_column_sources f
            WHERE f.coluna_id = c.id
          ), '[]'::JSONB),
          'overrides', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'leadId', o.lead_id,
              'acao', o.acao
            ))
            FROM emp_garbo.kanban_card_overrides o
            WHERE o.coluna_id = c.id AND o.ativo IS TRUE
          ), '[]'::JSONB)
        ) ORDER BY c.ordem, c.nome)
        FROM emp_garbo.kanban_columns c
        WHERE c.pagina_id = p.id AND c.ativo IS TRUE
      ), '[]'::JSONB)
    ) AS pagina
    FROM emp_garbo.kanban_pages p
    WHERE p.ativo IS TRUE
  ) q;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'nome', l.nome,
    'telefone', l.telefone,
    'email', l.email,
    'origem', l.origem,
    'status', l.status,
    'valorNegocio', l.valor_negocio,
    'valorOrcamento', l.valor_orcamento,
    'dataChegada', l.data_chegada,
    'vendedorId', l.vendedor_responsavel_id,
    'vendedorNome', v.nome,
    'darAtencao', COALESCE(l.dar_atencao, FALSE),
    'observacoes', l.observacoes
  ) ORDER BY l.data_chegada DESC, l.id DESC), '[]'::JSONB)
  INTO v_leads
  FROM emp_garbo.leads l
  LEFT JOIN emp_garbo.usuarios v ON v.id = l.vendedor_responsavel_id;

  RETURN jsonb_build_object(
    'etapas', v_stages,
    'quadros', v_pages,
    'leads', v_leads
  );
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_pipeline_boot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_pipeline_boot() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_mover_lead(p_lead_id BIGINT, p_status TEXT)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.movelaria_crm_pode_pipeline() THEN
    RAISE EXCEPTION 'Acesso negado ao pipeline comercial';
  END IF;
  IF p_lead_id IS NULL OR NULLIF(BTRIM(p_status), '') IS NULL THEN
    RAISE EXCEPTION 'Lead e etapa são obrigatórios';
  END IF;

  UPDATE emp_garbo.leads
  SET status = BTRIM(p_status),
      atualizado_em = NOW()
  WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_mover_lead(BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_mover_lead(BIGINT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_salvar_lead(
  p_lead_id BIGINT,
  p_nome TEXT,
  p_telefone TEXT,
  p_email TEXT,
  p_origem TEXT,
  p_observacoes TEXT,
  p_valor_negocio NUMERIC,
  p_status TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.movelaria_crm_pode_pipeline() THEN
    RAISE EXCEPTION 'Acesso negado ao pipeline comercial';
  END IF;
  IF p_lead_id IS NULL OR NULLIF(BTRIM(p_nome), '') IS NULL THEN
    RAISE EXCEPTION 'Nome do lead é obrigatório';
  END IF;

  UPDATE emp_garbo.leads
  SET nome = BTRIM(p_nome),
      telefone = NULLIF(BTRIM(p_telefone), ''),
      email = NULLIF(BTRIM(p_email), ''),
      origem = NULLIF(BTRIM(p_origem), ''),
      observacoes = NULLIF(BTRIM(p_observacoes), ''),
      valor_negocio = COALESCE(p_valor_negocio, 0),
      status = COALESCE(NULLIF(BTRIM(p_status), ''), status),
      atualizado_em = NOW()
  WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_salvar_lead(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_salvar_lead(BIGINT, TEXT, TEXT, TEXT, TEXT, TEXT, NUMERIC, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_criar_lead(
  p_nome TEXT,
  p_telefone TEXT,
  p_origem TEXT
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
  v_status TEXT;
BEGIN
  IF NOT public.movelaria_crm_pode_pipeline() THEN
    RAISE EXCEPTION 'Acesso negado ao pipeline comercial';
  END IF;
  IF NULLIF(BTRIM(p_nome), '') IS NULL THEN
    RAISE EXCEPTION 'Nome do lead é obrigatório';
  END IF;

  SELECT s.nome
  INTO v_status
  FROM emp_garbo.pipeline_custom_stages s
  WHERE s.ativo IS TRUE
  ORDER BY s.ordem, s.nome
  LIMIT 1;

  INSERT INTO emp_garbo.leads (nome, telefone, origem, status, vendedor_responsavel_id)
  VALUES (
    BTRIM(p_nome),
    NULLIF(BTRIM(p_telefone), ''),
    NULLIF(BTRIM(p_origem), ''),
    COALESCE(v_status, 'Novo Lead'),
    auth.uid()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_criar_lead(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_criar_lead(TEXT, TEXT, TEXT) TO authenticated;
