-- ============================================================
-- CRM Garbo: markup (custo interno) e slides de orçamento
-- Lê/grava emp_garbo sem copiar tabela
-- ============================================================

CREATE OR REPLACE FUNCTION public.movelaria_crm_pode_markup()
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

  RETURN v_roles && ARRAY['admin', 'projetista', 'projetista_admin'];
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_pode_markup() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_pode_markup() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_pode_slides()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  RETURN public.movelaria_crm_pode_pipeline();
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_pode_slides() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_pode_slides() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_markup_resumos()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_rows JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_pipeline() THEN
    RAISE EXCEPTION 'Acesso negado ao resumo de markup';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'lead_id', q.lead_id,
    'orcamento_id', q.id,
    'preco_final', q.preco_final,
    'titulo', q.titulo,
    'atualizado_em', q.atualizado_em
  )), '[]'::JSONB)
  INTO v_rows
  FROM (
    SELECT DISTINCT ON (m.lead_id)
      m.lead_id,
      m.id,
      COALESCE(
        NULLIF((m.modulos->'totais'->>'preco_final')::NUMERIC, NULL),
        m.preco_final,
        0
      ) AS preco_final,
      m.titulo,
      m.atualizado_em
    FROM emp_garbo.markup_orcamentos m
    WHERE m.lead_id IS NOT NULL
    ORDER BY m.lead_id, m.atualizado_em DESC NULLS LAST
  ) q
  WHERE q.preco_final > 0;

  RETURN COALESCE(v_rows, '[]'::JSONB);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_markup_resumos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_markup_resumos() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_markup_boot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_orcamentos JSONB;
  v_config     JSONB;
  v_categorias JSONB;
  v_produtos   JSONB;
  v_despesas   JSONB;
  v_servicos   JSONB;
  v_leads      JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_markup() THEN
    RAISE EXCEPTION 'Acesso negado ao markup';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id,
    'lead_id', m.lead_id,
    'lead_nome', l.nome,
    'titulo', m.titulo,
    'status', m.status,
    'preco_final', COALESCE(
      NULLIF((m.modulos->'totais'->>'preco_final')::NUMERIC, NULL),
      m.preco_final,
      0
    ),
    'atualizado_em', m.atualizado_em
  ) ORDER BY m.atualizado_em DESC NULLS LAST), '[]'::JSONB)
  INTO v_orcamentos
  FROM emp_garbo.markup_orcamentos m
  LEFT JOIN emp_garbo.leads l ON l.id = m.lead_id;

  SELECT to_jsonb(c)
  INTO v_config
  FROM emp_garbo.markup_config c
  ORDER BY c.atualizado_em DESC NULLS LAST
  LIMIT 1;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'nome', c.nome,
    'slug', c.slug,
    'subcategoria', c.subcategoria,
    'ordem', c.ordem,
    'ativo', c.ativo
  ) ORDER BY c.ordem, c.nome), '[]'::JSONB)
  INTO v_categorias
  FROM emp_garbo.markup_categorias c;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id,
    'categoria_id', p.categoria_id,
    'nome', p.nome,
    'variacao', p.variacao,
    'preco_unitario', p.preco_unitario,
    'unidade', p.unidade,
    'quantidade_padrao', p.quantidade_padrao,
    'ativo', p.ativo,
    'ordem', p.ordem,
    'categoria', c.nome
  ) ORDER BY c.ordem, p.ordem, p.nome), '[]'::JSONB)
  INTO v_produtos
  FROM emp_garbo.markup_produtos p
  LEFT JOIN emp_garbo.markup_categorias c ON c.id = p.categoria_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'nome', d.nome,
    'valor_padrao', d.valor_padrao,
    'ordem', d.ordem,
    'ativo', d.ativo
  ) ORDER BY d.ordem, d.nome), '[]'::JSONB)
  INTO v_despesas
  FROM emp_garbo.markup_despesa_templates d;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'nome', s.nome,
    'valor_hora_padrao', s.valor_hora_padrao,
    'ordem', s.ordem,
    'ativo', s.ativo
  ) ORDER BY s.ordem, s.nome), '[]'::JSONB)
  INTO v_servicos
  FROM emp_garbo.markup_servico_templates s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'nome', l.nome
  ) ORDER BY l.nome), '[]'::JSONB)
  INTO v_leads
  FROM emp_garbo.leads l;

  RETURN jsonb_build_object(
    'orcamentos', COALESCE(v_orcamentos, '[]'::JSONB),
    'config', COALESCE(v_config, '{}'::JSONB),
    'categorias', COALESCE(v_categorias, '[]'::JSONB),
    'produtos', COALESCE(v_produtos, '[]'::JSONB),
    'despesas', COALESCE(v_despesas, '[]'::JSONB),
    'servicos', COALESCE(v_servicos, '[]'::JSONB),
    'leads', COALESCE(v_leads, '[]'::JSONB)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_markup_boot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_markup_boot() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_markup_obter(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_row JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_markup() THEN
    RAISE EXCEPTION 'Acesso negado ao markup';
  END IF;
  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Orçamento inválido';
  END IF;

  SELECT jsonb_build_object(
    'id', m.id,
    'lead_id', m.lead_id,
    'lead_nome', l.nome,
    'titulo', m.titulo,
    'status', m.status,
    'modulos', COALESCE(m.modulos, '{}'::JSONB),
    'preco_final', COALESCE(m.preco_final, 0),
    'observacoes_rodape', COALESCE(m.observacoes_rodape, ''),
    'criado_em', m.criado_em,
    'atualizado_em', m.atualizado_em
  )
  INTO v_row
  FROM emp_garbo.markup_orcamentos m
  LEFT JOIN emp_garbo.leads l ON l.id = m.lead_id
  WHERE m.id = p_id;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Markup não encontrado';
  END IF;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_markup_obter(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_markup_obter(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_markup_salvar(
  p_id UUID,
  p_titulo TEXT,
  p_status TEXT,
  p_modulos JSONB,
  p_observacoes TEXT,
  p_lead_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_preco NUMERIC;
  v_row   JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_markup() THEN
    RAISE EXCEPTION 'Acesso negado ao markup';
  END IF;
  IF p_id IS NULL OR p_modulos IS NULL OR jsonb_typeof(p_modulos) <> 'object' THEN
    RAISE EXCEPTION 'Markup inválido';
  END IF;

  v_preco := COALESCE(
    NULLIF((p_modulos->'totais'->>'preco_final')::NUMERIC, NULL),
    0
  );

  UPDATE emp_garbo.markup_orcamentos
  SET titulo = COALESCE(NULLIF(BTRIM(p_titulo), ''), titulo),
      status = COALESCE(NULLIF(BTRIM(p_status), ''), status),
      modulos = p_modulos,
      preco_final = v_preco,
      observacoes_rodape = COALESCE(p_observacoes, observacoes_rodape),
      lead_id = COALESCE(p_lead_id, lead_id),
      atualizado_em = NOW()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Markup não encontrado';
  END IF;

  IF p_lead_id IS NOT NULL AND v_preco > 0 THEN
    UPDATE emp_garbo.leads
    SET valor_orcamento = v_preco,
        atualizado_em = NOW()
    WHERE id = p_lead_id
      AND (valor_orcamento IS NULL OR valor_orcamento = 0);
  END IF;

  SELECT jsonb_build_object(
    'id', m.id,
    'lead_id', m.lead_id,
    'titulo', m.titulo,
    'status', m.status,
    'modulos', m.modulos,
    'preco_final', m.preco_final,
    'observacoes_rodape', COALESCE(m.observacoes_rodape, ''),
    'atualizado_em', m.atualizado_em
  )
  INTO v_row
  FROM emp_garbo.markup_orcamentos m
  WHERE m.id = p_id;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_markup_salvar(UUID, TEXT, TEXT, JSONB, TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_markup_salvar(UUID, TEXT, TEXT, JSONB, TEXT, BIGINT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_markup_criar(
  p_lead_id BIGINT,
  p_titulo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id    UUID;
  v_nome  TEXT;
  v_row   JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_markup() THEN
    RAISE EXCEPTION 'Acesso negado ao markup';
  END IF;

  IF p_lead_id IS NOT NULL THEN
    SELECT nome INTO v_nome FROM emp_garbo.leads WHERE id = p_lead_id;
  END IF;

  INSERT INTO emp_garbo.markup_orcamentos (
    lead_id, titulo, status, modulos, preco_final, observacoes_rodape, criado_por
  ) VALUES (
    p_lead_id,
    COALESCE(NULLIF(BTRIM(p_titulo), ''), NULLIF(BTRIM(v_nome), ''), 'Markup'),
    'rascunho',
    '{}'::JSONB,
    0,
    '',
    auth.uid()
  )
  RETURNING id INTO v_id;

  SELECT jsonb_build_object(
    'id', m.id,
    'lead_id', m.lead_id,
    'lead_nome', l.nome,
    'titulo', m.titulo,
    'status', m.status,
    'modulos', COALESCE(m.modulos, '{}'::JSONB),
    'preco_final', COALESCE(m.preco_final, 0),
    'observacoes_rodape', COALESCE(m.observacoes_rodape, ''),
    'atualizado_em', m.atualizado_em
  )
  INTO v_row
  FROM emp_garbo.markup_orcamentos m
  LEFT JOIN emp_garbo.leads l ON l.id = m.lead_id
  WHERE m.id = v_id;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_markup_criar(BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_markup_criar(BIGINT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_markup_salvar_config(
  p_valor_hora NUMERIC,
  p_fator_sobras NUMERIC,
  p_margem_lucro NUMERIC,
  p_percentual_imposto NUMERIC,
  p_taxas_financeiras NUMERIC,
  p_custo_frete NUMERIC,
  p_rodape TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.movelaria_crm_pode_markup() THEN
    RAISE EXCEPTION 'Acesso negado ao markup';
  END IF;

  SELECT id INTO v_id FROM emp_garbo.markup_config ORDER BY atualizado_em DESC NULLS LAST LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO emp_garbo.markup_config (
      valor_hora_marcenaria, fator_sobras, margem_lucro, percentual_imposto,
      taxas_financeiras, custo_frete_padrao, rodape_observacoes_padrao
    ) VALUES (
      COALESCE(p_valor_hora, 80),
      COALESCE(p_fator_sobras, 5),
      COALESCE(p_margem_lucro, 30),
      COALESCE(p_percentual_imposto, 0),
      COALESCE(p_taxas_financeiras, 0),
      COALESCE(p_custo_frete, 0),
      COALESCE(p_rodape, '')
    );
  ELSE
    UPDATE emp_garbo.markup_config
    SET valor_hora_marcenaria = COALESCE(p_valor_hora, valor_hora_marcenaria),
        fator_sobras = COALESCE(p_fator_sobras, fator_sobras),
        margem_lucro = COALESCE(p_margem_lucro, margem_lucro),
        percentual_imposto = COALESCE(p_percentual_imposto, percentual_imposto),
        taxas_financeiras = COALESCE(p_taxas_financeiras, taxas_financeiras),
        custo_frete_padrao = COALESCE(p_custo_frete, custo_frete_padrao),
        rodape_observacoes_padrao = COALESCE(p_rodape, rodape_observacoes_padrao),
        atualizado_em = NOW()
    WHERE id = v_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_markup_salvar_config(NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_markup_salvar_config(NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, NUMERIC, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_markup_salvar_produto(
  p_id UUID,
  p_categoria_id UUID,
  p_nome TEXT,
  p_variacao TEXT,
  p_preco_unitario NUMERIC,
  p_unidade TEXT,
  p_quantidade_padrao NUMERIC,
  p_ativo BOOLEAN,
  p_ordem INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.movelaria_crm_pode_markup() THEN
    RAISE EXCEPTION 'Acesso negado ao markup';
  END IF;
  IF NULLIF(BTRIM(p_nome), '') IS NULL THEN
    RAISE EXCEPTION 'Nome do produto é obrigatório';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO emp_garbo.markup_produtos (
      categoria_id, nome, variacao, preco_unitario, unidade, quantidade_padrao, ativo, ordem
    ) VALUES (
      p_categoria_id,
      BTRIM(p_nome),
      NULLIF(BTRIM(p_variacao), ''),
      COALESCE(p_preco_unitario, 0),
      COALESCE(NULLIF(BTRIM(p_unidade), ''), 'un'),
      COALESCE(p_quantidade_padrao, 1),
      COALESCE(p_ativo, TRUE),
      COALESCE(p_ordem, 0)
    );
  ELSE
    UPDATE emp_garbo.markup_produtos
    SET categoria_id = COALESCE(p_categoria_id, categoria_id),
        nome = BTRIM(p_nome),
        variacao = NULLIF(BTRIM(p_variacao), ''),
        preco_unitario = COALESCE(p_preco_unitario, preco_unitario),
        unidade = COALESCE(NULLIF(BTRIM(p_unidade), ''), unidade),
        quantidade_padrao = COALESCE(p_quantidade_padrao, quantidade_padrao),
        ativo = COALESCE(p_ativo, ativo),
        ordem = COALESCE(p_ordem, ordem),
        atualizado_em = NOW()
    WHERE id = p_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_markup_salvar_produto(UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, BOOLEAN, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_markup_salvar_produto(UUID, UUID, TEXT, TEXT, NUMERIC, TEXT, NUMERIC, BOOLEAN, INTEGER) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_markup_salvar_categoria(
  p_id UUID,
  p_nome TEXT,
  p_ordem INTEGER,
  p_ativo BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug TEXT;
BEGIN
  IF NOT public.movelaria_crm_pode_markup() THEN
    RAISE EXCEPTION 'Acesso negado ao markup';
  END IF;
  IF NULLIF(BTRIM(p_nome), '') IS NULL THEN
    RAISE EXCEPTION 'Nome da categoria é obrigatório';
  END IF;

  v_slug := lower(regexp_replace(BTRIM(p_nome), '[^a-zA-Z0-9]+', '-', 'g'));

  IF p_id IS NULL THEN
    INSERT INTO emp_garbo.markup_categorias (nome, slug, ordem, ativo)
    VALUES (BTRIM(p_nome), v_slug, COALESCE(p_ordem, 0), COALESCE(p_ativo, TRUE));
  ELSE
    UPDATE emp_garbo.markup_categorias
    SET nome = BTRIM(p_nome),
        slug = v_slug,
        ordem = COALESCE(p_ordem, ordem),
        ativo = COALESCE(p_ativo, ativo)
    WHERE id = p_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_markup_salvar_categoria(UUID, TEXT, INTEGER, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_markup_salvar_categoria(UUID, TEXT, INTEGER, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_markup_salvar_despesa(
  p_id UUID,
  p_nome TEXT,
  p_valor_padrao NUMERIC,
  p_ordem INTEGER,
  p_ativo BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.movelaria_crm_pode_markup() THEN
    RAISE EXCEPTION 'Acesso negado ao markup';
  END IF;
  IF NULLIF(BTRIM(p_nome), '') IS NULL THEN
    RAISE EXCEPTION 'Nome da despesa é obrigatório';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO emp_garbo.markup_despesa_templates (nome, valor_padrao, ordem, ativo)
    VALUES (BTRIM(p_nome), COALESCE(p_valor_padrao, 0), COALESCE(p_ordem, 0), COALESCE(p_ativo, TRUE));
  ELSE
    UPDATE emp_garbo.markup_despesa_templates
    SET nome = BTRIM(p_nome),
        valor_padrao = COALESCE(p_valor_padrao, valor_padrao),
        ordem = COALESCE(p_ordem, ordem),
        ativo = COALESCE(p_ativo, ativo)
    WHERE id = p_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_markup_salvar_despesa(UUID, TEXT, NUMERIC, INTEGER, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_markup_salvar_despesa(UUID, TEXT, NUMERIC, INTEGER, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_markup_salvar_servico(
  p_id UUID,
  p_nome TEXT,
  p_valor_hora NUMERIC,
  p_ordem INTEGER,
  p_ativo BOOLEAN
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.movelaria_crm_pode_markup() THEN
    RAISE EXCEPTION 'Acesso negado ao markup';
  END IF;
  IF NULLIF(BTRIM(p_nome), '') IS NULL THEN
    RAISE EXCEPTION 'Nome do serviço é obrigatório';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO emp_garbo.markup_servico_templates (nome, valor_hora_padrao, ordem, ativo)
    VALUES (BTRIM(p_nome), COALESCE(p_valor_hora, 0), COALESCE(p_ordem, 0), COALESCE(p_ativo, TRUE));
  ELSE
    UPDATE emp_garbo.markup_servico_templates
    SET nome = BTRIM(p_nome),
        valor_hora_padrao = COALESCE(p_valor_hora, valor_hora_padrao),
        ordem = COALESCE(p_ordem, ordem),
        ativo = COALESCE(p_ativo, ativo)
    WHERE id = p_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_markup_salvar_servico(UUID, TEXT, NUMERIC, INTEGER, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_markup_salvar_servico(UUID, TEXT, NUMERIC, INTEGER, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_slides_boot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_slides JSONB;
  v_leads  JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_slides() THEN
    RAISE EXCEPTION 'Acesso negado aos slides de orçamento';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'identificador', s.identificador,
    'lead_id', s.lead_id,
    'lead_nome', l.nome,
    'cliente_nome', s.cliente_nome,
    'status', s.status,
    'dados', COALESCE(s.dados, '{}'::JSONB),
    'criado_em', s.criado_em,
    'atualizado_em', s.atualizado_em
  ) ORDER BY s.atualizado_em DESC NULLS LAST), '[]'::JSONB)
  INTO v_slides
  FROM emp_garbo.orcamento_slides s
  LEFT JOIN emp_garbo.leads l ON l.id = s.lead_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'nome', l.nome
  ) ORDER BY l.nome), '[]'::JSONB)
  INTO v_leads
  FROM emp_garbo.leads l;

  RETURN jsonb_build_object(
    'slides', COALESCE(v_slides, '[]'::JSONB),
    'leads', COALESCE(v_leads, '[]'::JSONB)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_slides_boot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_slides_boot() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_slide_salvar(
  p_id UUID,
  p_cliente_nome TEXT,
  p_identificador TEXT,
  p_lead_id BIGINT,
  p_status TEXT,
  p_dados JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_slides() THEN
    RAISE EXCEPTION 'Acesso negado aos slides de orçamento';
  END IF;
  IF p_id IS NULL OR NULLIF(BTRIM(p_cliente_nome), '') IS NULL THEN
    RAISE EXCEPTION 'Nome do cliente é obrigatório';
  END IF;

  UPDATE emp_garbo.orcamento_slides
  SET cliente_nome = BTRIM(p_cliente_nome),
      identificador = COALESCE(NULLIF(BTRIM(p_identificador), ''), identificador),
      lead_id = p_lead_id,
      status = COALESCE(NULLIF(BTRIM(p_status), ''), status),
      dados = COALESCE(p_dados, dados),
      atualizado_em = NOW()
  WHERE id = p_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Orçamento não encontrado';
  END IF;

  SELECT jsonb_build_object(
    'id', s.id,
    'identificador', s.identificador,
    'lead_id', s.lead_id,
    'cliente_nome', s.cliente_nome,
    'status', s.status,
    'dados', COALESCE(s.dados, '{}'::JSONB),
    'atualizado_em', s.atualizado_em
  )
  INTO v_row
  FROM emp_garbo.orcamento_slides s
  WHERE s.id = p_id;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_slide_salvar(UUID, TEXT, TEXT, BIGINT, TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_slide_salvar(UUID, TEXT, TEXT, BIGINT, TEXT, JSONB) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_slide_criar(
  p_cliente_nome TEXT,
  p_lead_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id    UUID;
  v_ident TEXT;
  v_nome  TEXT;
  v_row   JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_slides() THEN
    RAISE EXCEPTION 'Acesso negado aos slides de orçamento';
  END IF;

  IF p_lead_id IS NOT NULL THEN
    SELECT nome INTO v_nome FROM emp_garbo.leads WHERE id = p_lead_id;
  END IF;

  v_nome := COALESCE(NULLIF(BTRIM(p_cliente_nome), ''), NULLIF(BTRIM(v_nome), ''), 'Cliente');
  v_ident := 'RASC-' || upper(regexp_replace(v_nome, '[^a-zA-Z0-9]+', '-', 'g'))
    || '-' || substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 4);

  INSERT INTO emp_garbo.orcamento_slides (
    identificador, lead_id, cliente_nome, status, dados, criado_por
  ) VALUES (
    v_ident,
    p_lead_id,
    v_nome,
    'rascunho',
    jsonb_build_object(
      '_meta', jsonb_build_object('etapa', 1),
      'precificacao', jsonb_build_object('valor_final', 0, 'parcelas', 1)
    ),
    auth.uid()
  )
  RETURNING id INTO v_id;

  SELECT jsonb_build_object(
    'id', s.id,
    'identificador', s.identificador,
    'lead_id', s.lead_id,
    'cliente_nome', s.cliente_nome,
    'status', s.status,
    'dados', COALESCE(s.dados, '{}'::JSONB),
    'atualizado_em', s.atualizado_em
  )
  INTO v_row
  FROM emp_garbo.orcamento_slides s
  WHERE s.id = v_id;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_slide_criar(TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_slide_criar(TEXT, BIGINT) TO authenticated;
