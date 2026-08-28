-- ============================================================
-- CRM Garbo: marketing de conteúdo, gastos, pontua admin e automações
-- ============================================================

CREATE OR REPLACE FUNCTION public.movelaria_crm_colaborador_roles()
RETURNS TEXT[]
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
  IF auth.uid() IS NULL THEN RETURN '{}'::TEXT[]; END IF;
  SELECT c.tipo_usuario, c.status_convite INTO v_tipo, v_status
  FROM emp_garbo.usuarios c WHERE c.id = auth.uid();
  IF v_tipo IS DISTINCT FROM 'colaborador' OR v_status IS DISTINCT FROM 'ATIVO' THEN
    RETURN '{}'::TEXT[];
  END IF;
  SELECT COALESCE(array_agg(r.role::TEXT), '{}'::TEXT[])
  INTO v_roles
  FROM emp_garbo.user_roles r
  WHERE r.user_id = auth.uid();
  RETURN v_roles;
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_colaborador_roles() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_colaborador_roles() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_pode_marketing()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.movelaria_crm_colaborador_roles() && ARRAY['admin', 'marketing']::TEXT[];
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_pode_marketing() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_pode_marketing() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_pode_gastos()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.movelaria_crm_colaborador_roles() && ARRAY['admin']::TEXT[];
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_pode_gastos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_pode_gastos() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_pode_pontua_fin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.movelaria_crm_colaborador_roles() && ARRAY['admin', 'vendedor']::TEXT[];
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_pode_pontua_fin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_pode_pontua_fin() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_pode_automacao_mkt()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.movelaria_crm_colaborador_roles() && ARRAY['admin', 'vendedor', 'marketing']::TEXT[];
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_pode_automacao_mkt() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_pode_automacao_mkt() TO authenticated;

INSERT INTO emp_garbo.marketing_columns (nome, ordem)
SELECT v.nome, v.ordem
FROM (VALUES
  ('Ideias', 1),
  ('Enviados para aprovação', 2),
  ('Aprovados', 3),
  ('Postados Meta- Ads', 4),
  ('Postado- Instagram organico', 5),
  ('Postado Tik Tok', 6)
) AS v(nome, ordem)
WHERE NOT EXISTS (SELECT 1 FROM emp_garbo.marketing_columns);

CREATE OR REPLACE FUNCTION public.movelaria_crm_marketing_boot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_cols JSONB;
  v_cards JSONB;
  v_folders JSONB;
  v_nodes JSONB;
  v_tasks JSONB;
  v_agents JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_marketing() THEN
    RAISE EXCEPTION 'Acesso negado ao marketing';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'nome', c.nome, 'ordem', c.ordem
  ) ORDER BY c.ordem, c.nome), '[]'::JSONB)
  INTO v_cols FROM emp_garbo.marketing_columns c;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', x.id,
    'titulo', x.titulo,
    'script_copy', x.script_copy,
    'column_id', x.column_id,
    'urgente', COALESCE(x.urgente, FALSE),
    'performando', COALESCE(x.performando, FALSE),
    'ordem', x.ordem,
    'criado_em', x.criado_em
  ) ORDER BY x.ordem, x.criado_em), '[]'::JSONB)
  INTO v_cards FROM emp_garbo.marketing_content_cards x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', f.id, 'nome', f.nome, 'descricao', f.descricao, 'total', COALESCE(cnt.n, 0)
  ) ORDER BY f.nome), '[]'::JSONB)
  INTO v_folders
  FROM emp_garbo.marketing_media_folders f
  LEFT JOIN (
    SELECT folder_id, COUNT(*)::INT AS n
    FROM emp_garbo.marketing_medias
    GROUP BY folder_id
  ) cnt ON cnt.folder_id = f.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', n.id, 'titulo', n.titulo, 'conteudo', n.conteudo,
    'classificacao', n.classificacao, 'enviado_producao', COALESCE(n.enviado_producao, FALSE),
    'card_id', n.card_id, 'criado_em', n.criado_em
  ) ORDER BY n.criado_em DESC), '[]'::JSONB)
  INTO v_nodes FROM emp_garbo.marketing_planning_nodes n;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id, 'titulo', t.titulo, 'descricao', t.descricao,
    'status', t.status, 'data_agendada', t.data_agendada, 'hora_agendada', t.hora_agendada,
    'content_card_id', t.content_card_id
  ) ORDER BY t.data_agendada NULLS LAST, t.titulo), '[]'::JSONB)
  INTO v_tasks FROM emp_garbo.marketing_tasks t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id, 'nome', a.nome, 'slug', a.slug, 'ativo', COALESCE(a.ativo, TRUE)
  ) ORDER BY a.ordem, a.nome), '[]'::JSONB)
  INTO v_agents FROM emp_garbo.marketing_ai_agents a;

  RETURN jsonb_build_object(
    'colunas', COALESCE(v_cols, '[]'::JSONB),
    'cards', COALESCE(v_cards, '[]'::JSONB),
    'pastas', COALESCE(v_folders, '[]'::JSONB),
    'sem_pasta', (SELECT COUNT(*)::INT FROM emp_garbo.marketing_medias WHERE folder_id IS NULL),
    'total_midias', (SELECT COUNT(*)::INT FROM emp_garbo.marketing_medias),
    'nodes', COALESCE(v_nodes, '[]'::JSONB),
    'tarefas', COALESCE(v_tasks, '[]'::JSONB),
    'agentes', COALESCE(v_agents, '[]'::JSONB)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_marketing_boot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_marketing_boot() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_marketing_medias(
  p_folder_id UUID DEFAULT NULL,
  p_busca TEXT DEFAULT NULL,
  p_limit INT DEFAULT 48,
  p_offset INT DEFAULT 0,
  p_sem_pasta BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_items JSONB;
  v_total INT;
  v_lim INT := GREATEST(1, LEAST(COALESCE(p_limit, 48), 96));
  v_off INT := GREATEST(0, COALESCE(p_offset, 0));
  v_q TEXT := NULLIF(btrim(COALESCE(p_busca, '')), '');
BEGIN
  IF NOT public.movelaria_crm_pode_marketing() THEN
    RAISE EXCEPTION 'Acesso negado ao marketing';
  END IF;

  SELECT COUNT(*)::INT INTO v_total
  FROM emp_garbo.marketing_medias m
  WHERE (
      CASE
        WHEN COALESCE(p_sem_pasta, FALSE) THEN m.folder_id IS NULL
        WHEN p_folder_id IS NULL THEN TRUE
        ELSE m.folder_id = p_folder_id
      END
    )
    AND (v_q IS NULL OR m.titulo ILIKE '%' || v_q || '%' OR m.file_name ILIKE '%' || v_q || '%');

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::JSONB)
  INTO v_items
  FROM (
    SELECT m.id, m.titulo, m.tipo, m.file_url, m.file_name, m.folder_id, m.criado_em
    FROM emp_garbo.marketing_medias m
    WHERE (
        CASE
          WHEN COALESCE(p_sem_pasta, FALSE) THEN m.folder_id IS NULL
          WHEN p_folder_id IS NULL THEN TRUE
          ELSE m.folder_id = p_folder_id
        END
      )
      AND (v_q IS NULL OR m.titulo ILIKE '%' || v_q || '%' OR m.file_name ILIKE '%' || v_q || '%')
    ORDER BY COALESCE(m.fixado, FALSE) DESC, m.criado_em DESC
    LIMIT v_lim OFFSET v_off
  ) x;

  RETURN jsonb_build_object('items', COALESCE(v_items, '[]'::JSONB), 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_marketing_medias(UUID, TEXT, INT, INT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_marketing_medias(UUID, TEXT, INT, INT, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_marketing_salvar_coluna(p_id UUID, p_nome TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_ordem INT;
BEGIN
  IF NOT public.movelaria_crm_pode_marketing() THEN
    RAISE EXCEPTION 'Acesso negado ao marketing';
  END IF;
  IF NULLIF(btrim(p_nome), '') IS NULL THEN RAISE EXCEPTION 'Informe o nome da coluna'; END IF;

  IF p_id IS NULL THEN
    SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_ordem FROM emp_garbo.marketing_columns;
    INSERT INTO emp_garbo.marketing_columns (nome, ordem)
    VALUES (btrim(p_nome), v_ordem)
    RETURNING id INTO v_id;
  ELSE
    UPDATE emp_garbo.marketing_columns SET nome = btrim(p_nome), atualizado_em = NOW()
    WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_marketing_salvar_coluna(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_marketing_salvar_coluna(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_marketing_salvar_card(
  p_id UUID,
  p_titulo TEXT,
  p_script_copy TEXT,
  p_column_id UUID,
  p_urgente BOOLEAN DEFAULT FALSE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_ordem INT;
BEGIN
  IF NOT public.movelaria_crm_pode_marketing() THEN
    RAISE EXCEPTION 'Acesso negado ao marketing';
  END IF;
  IF NULLIF(btrim(p_titulo), '') IS NULL THEN RAISE EXCEPTION 'Informe o título'; END IF;
  IF p_column_id IS NULL THEN RAISE EXCEPTION 'Informe a coluna'; END IF;

  IF p_id IS NULL THEN
    SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_ordem
    FROM emp_garbo.marketing_content_cards WHERE column_id = p_column_id;
    INSERT INTO emp_garbo.marketing_content_cards (titulo, script_copy, column_id, urgente, ordem)
    VALUES (btrim(p_titulo), NULLIF(btrim(p_script_copy), ''), p_column_id, COALESCE(p_urgente, FALSE), v_ordem)
    RETURNING id INTO v_id;
  ELSE
    UPDATE emp_garbo.marketing_content_cards
    SET titulo = btrim(p_titulo),
        script_copy = NULLIF(btrim(p_script_copy), ''),
        column_id = p_column_id,
        urgente = COALESCE(p_urgente, FALSE),
        atualizado_em = NOW()
    WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_marketing_salvar_card(UUID, TEXT, TEXT, UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_marketing_salvar_card(UUID, TEXT, TEXT, UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_marketing_mover_card(p_id UUID, p_column_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.movelaria_crm_pode_marketing() THEN
    RAISE EXCEPTION 'Acesso negado ao marketing';
  END IF;
  UPDATE emp_garbo.marketing_content_cards
  SET column_id = p_column_id, atualizado_em = NOW()
  WHERE id = p_id;
  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_marketing_mover_card(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_marketing_mover_card(UUID, UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_marketing_excluir_card(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.movelaria_crm_pode_marketing() THEN
    RAISE EXCEPTION 'Acesso negado ao marketing';
  END IF;
  DELETE FROM emp_garbo.marketing_content_cards WHERE id = p_id;
  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_marketing_excluir_card(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_marketing_excluir_card(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_marketing_salvar_tarefa(
  p_id UUID,
  p_titulo TEXT,
  p_data DATE,
  p_status TEXT DEFAULT 'pendente'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.movelaria_crm_pode_marketing() THEN
    RAISE EXCEPTION 'Acesso negado ao marketing';
  END IF;
  IF NULLIF(btrim(p_titulo), '') IS NULL THEN RAISE EXCEPTION 'Informe o título'; END IF;
  IF p_data IS NULL THEN RAISE EXCEPTION 'Informe a data'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO emp_garbo.marketing_tasks (titulo, data_agendada, status, criado_por, destinatario_id, tipo)
    VALUES (
      btrim(p_titulo),
      p_data,
      COALESCE(NULLIF(btrim(p_status), ''), 'pendente'),
      auth.uid(),
      auth.uid(),
      'produzir'
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE emp_garbo.marketing_tasks
    SET titulo = btrim(p_titulo), data_agendada = p_data,
        status = COALESCE(NULLIF(btrim(p_status), ''), status), atualizado_em = NOW()
    WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_marketing_salvar_tarefa(UUID, TEXT, DATE, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_marketing_salvar_tarefa(UUID, TEXT, DATE, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_marketing_salvar_node(p_id UUID, p_titulo TEXT, p_conteudo TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.movelaria_crm_pode_marketing() THEN
    RAISE EXCEPTION 'Acesso negado ao marketing';
  END IF;
  IF NULLIF(btrim(p_titulo), '') IS NULL THEN RAISE EXCEPTION 'Informe o título'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO emp_garbo.marketing_planning_nodes (titulo, conteudo, classificacao, position_x, position_y)
    VALUES (btrim(p_titulo), NULLIF(btrim(p_conteudo), ''), 'planejamento_central', 40, 40)
    RETURNING id INTO v_id;
  ELSE
    UPDATE emp_garbo.marketing_planning_nodes
    SET titulo = btrim(p_titulo), conteudo = NULLIF(btrim(p_conteudo), ''), atualizado_em = NOW()
    WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_marketing_salvar_node(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_marketing_salvar_node(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_gastos_boot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_fontes JSONB;
  v_subs JSONB;
  v_cols JSONB;
  v_lanc JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_gastos() THEN
    RAISE EXCEPTION 'Acesso negado ao controle de gastos';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', f.id, 'nome', f.nome, 'icone', f.icone, 'cor', f.cor, 'ativo', COALESCE(f.ativo, TRUE), 'ordem', f.ordem
  ) ORDER BY f.ordem, f.nome), '[]'::JSONB)
  INTO v_fontes FROM emp_garbo.mkt_fontes f;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id, 'fonte_id', s.fonte_id, 'nome', s.nome, 'descricao', s.descricao, 'ativo', COALESCE(s.ativo, TRUE), 'ordem', s.ordem
  ) ORDER BY s.ordem, s.nome), '[]'::JSONB)
  INTO v_subs FROM emp_garbo.mkt_sub_fontes s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'sub_fonte_id', c.sub_fonte_id, 'nome', c.nome, 'tipo', c.tipo, 'ordem', c.ordem
  ) ORDER BY c.ordem, c.nome), '[]'::JSONB)
  INTO v_cols FROM emp_garbo.mkt_config_colunas c;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id, 'coluna_id', l.coluna_id, 'data', l.data, 'valor_numerico', l.valor_numerico, 'observacao', l.observacao
  ) ORDER BY l.data DESC), '[]'::JSONB)
  INTO v_lanc FROM emp_garbo.mkt_lancamentos l;

  RETURN jsonb_build_object(
    'fontes', COALESCE(v_fontes, '[]'::JSONB),
    'sub_fontes', COALESCE(v_subs, '[]'::JSONB),
    'colunas', COALESCE(v_cols, '[]'::JSONB),
    'lancamentos', COALESCE(v_lanc, '[]'::JSONB)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_gastos_boot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_gastos_boot() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_gastos_salvar_fonte(p_id UUID, p_nome TEXT, p_cor TEXT DEFAULT '#f2d892')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_ordem INT;
BEGIN
  IF NOT public.movelaria_crm_pode_gastos() THEN
    RAISE EXCEPTION 'Acesso negado ao controle de gastos';
  END IF;
  IF NULLIF(btrim(p_nome), '') IS NULL THEN RAISE EXCEPTION 'Informe o nome da fonte'; END IF;
  IF p_id IS NULL THEN
    SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_ordem FROM emp_garbo.mkt_fontes;
    INSERT INTO emp_garbo.mkt_fontes (nome, cor, icone, ativo, ordem)
    VALUES (btrim(p_nome), COALESCE(NULLIF(btrim(p_cor), ''), '#f2d892'), 'wallet', TRUE, v_ordem)
    RETURNING id INTO v_id;
  ELSE
    UPDATE emp_garbo.mkt_fontes SET nome = btrim(p_nome), cor = COALESCE(NULLIF(btrim(p_cor), ''), cor), atualizado_em = NOW()
    WHERE id = p_id RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_gastos_salvar_fonte(UUID, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_gastos_salvar_fonte(UUID, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_gastos_salvar_subfonte(p_id UUID, p_fonte_id UUID, p_nome TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
  v_ordem INT;
  v_col UUID;
BEGIN
  IF NOT public.movelaria_crm_pode_gastos() THEN
    RAISE EXCEPTION 'Acesso negado ao controle de gastos';
  END IF;
  IF p_fonte_id IS NULL THEN RAISE EXCEPTION 'Fonte inválida'; END IF;
  IF NULLIF(btrim(p_nome), '') IS NULL THEN RAISE EXCEPTION 'Informe o nome'; END IF;
  IF p_id IS NULL THEN
    SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_ordem FROM emp_garbo.mkt_sub_fontes WHERE fonte_id = p_fonte_id;
    INSERT INTO emp_garbo.mkt_sub_fontes (fonte_id, nome, ativo, ordem)
    VALUES (p_fonte_id, btrim(p_nome), TRUE, v_ordem)
    RETURNING id INTO v_id;
    INSERT INTO emp_garbo.mkt_config_colunas (sub_fonte_id, nome, tipo, ordem, largura, editavel)
    VALUES (v_id, 'Valor', 'currency', 1, 140, TRUE)
    RETURNING id INTO v_col;
  ELSE
    UPDATE emp_garbo.mkt_sub_fontes SET nome = btrim(p_nome), atualizado_em = NOW()
    WHERE id = p_id RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_gastos_salvar_subfonte(UUID, UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_gastos_salvar_subfonte(UUID, UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_gastos_salvar_lancamento(
  p_id UUID,
  p_coluna_id UUID,
  p_data DATE,
  p_valor NUMERIC,
  p_observacao TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.movelaria_crm_pode_gastos() THEN
    RAISE EXCEPTION 'Acesso negado ao controle de gastos';
  END IF;
  IF p_coluna_id IS NULL OR p_data IS NULL THEN RAISE EXCEPTION 'Informe a coluna e a data'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO emp_garbo.mkt_lancamentos (coluna_id, data, valor_numerico, observacao)
    VALUES (p_coluna_id, p_data, COALESCE(p_valor, 0), NULLIF(btrim(p_observacao), ''))
    RETURNING id INTO v_id;
  ELSE
    UPDATE emp_garbo.mkt_lancamentos
    SET valor_numerico = COALESCE(p_valor, 0), observacao = NULLIF(btrim(p_observacao), ''), atualizado_em = NOW()
    WHERE id = p_id RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_gastos_salvar_lancamento(UUID, UUID, DATE, NUMERIC, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_gastos_salvar_lancamento(UUID, UUID, DATE, NUMERIC, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_pontua_admin_boot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_prest JSONB;
  v_saques JSONB;
  v_libs JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_pontua_fin() THEN
    RAISE EXCEPTION 'Acesso negado ao financeiro Pontua';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', u.id, 'nome', u.nome, 'email', u.email, 'titulo', COALESCE(u.titulo, 'Prestador de Serviço'),
    'telefone', u.telefone
  ) ORDER BY u.nome), '[]'::JSONB)
  INTO v_prest
  FROM emp_garbo.usuarios u
  WHERE u.tipo_usuario = 'prestador_servico' AND u.status_convite = 'ATIVO';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'prestador_id', s.prestador_id,
    'valor_solicitado', s.valor_solicitado,
    'chave_pix', s.chave_pix,
    'tipo_chave_pix', s.tipo_chave_pix,
    'status', s.status,
    'criado_em', s.criado_em,
    'processado_em', s.processado_em
  ) ORDER BY s.criado_em DESC), '[]'::JSONB)
  INTO v_saques
  FROM emp_garbo.prestador_saque_pedidos s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id, 'lead_id', l.lead_id, 'prestador_id', l.prestador_id, 'status', l.status, 'field_id', l.field_id
  ) ORDER BY l.criado_em DESC NULLS LAST), '[]'::JSONB)
  INTO v_libs
  FROM emp_garbo.pontua_garbo_comissao_liberacoes l
  WHERE l.status = 'aguardando_liberacao';

  RETURN jsonb_build_object(
    'prestadores', COALESCE(v_prest, '[]'::JSONB),
    'saques', COALESCE(v_saques, '[]'::JSONB),
    'liberacoes', COALESCE(v_libs, '[]'::JSONB)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_pontua_admin_boot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_pontua_admin_boot() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_pontua_aprovar_saque(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row emp_garbo.prestador_saque_pedidos%ROWTYPE;
BEGIN
  IF NOT (public.movelaria_crm_colaborador_roles() && ARRAY['admin']::TEXT[]) THEN
    RAISE EXCEPTION 'Só o admin do CRM aprova saque';
  END IF;
  SELECT * INTO v_row FROM emp_garbo.prestador_saque_pedidos WHERE id = p_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_row.status IS DISTINCT FROM 'pendente' THEN RAISE EXCEPTION 'Pedido já processado'; END IF;

  INSERT INTO emp_garbo.pontua_garbo_lancamentos (prestador_id, tipo, valor, descricao, criado_por, saque_pedido_id)
  VALUES (v_row.prestador_id, 'saque', v_row.valor_solicitado,
          'Retirada PIX: ' || COALESCE(v_row.chave_pix, ''), auth.uid(), v_row.id);

  UPDATE emp_garbo.prestador_saque_pedidos
  SET status = 'aprovado', processado_em = NOW(), processado_por = auth.uid()
  WHERE id = p_id;

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_pontua_aprovar_saque(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_pontua_aprovar_saque(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_pontua_rejeitar_saque(p_id UUID, p_obs TEXT DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.movelaria_crm_colaborador_roles() && ARRAY['admin']::TEXT[]) THEN
    RAISE EXCEPTION 'Só o admin do CRM rejeita saque';
  END IF;
  UPDATE emp_garbo.prestador_saque_pedidos
  SET status = 'rejeitado', obs_admin = NULLIF(btrim(p_obs), ''), processado_em = NOW(), processado_por = auth.uid()
  WHERE id = p_id AND status = 'pendente';
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado ou já processado'; END IF;
  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_pontua_rejeitar_saque(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_pontua_rejeitar_saque(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_pontua_liberar_comissao(p_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT (public.movelaria_crm_colaborador_roles() && ARRAY['admin']::TEXT[]) THEN
    RAISE EXCEPTION 'Só o admin do CRM libera comissão';
  END IF;
  UPDATE emp_garbo.pontua_garbo_comissao_liberacoes
  SET status = 'liberada'
  WHERE id = p_id AND status = 'aguardando_liberacao';
  IF NOT FOUND THEN RAISE EXCEPTION 'Liberação não encontrada'; END IF;
  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_pontua_liberar_comissao(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_pontua_liberar_comissao(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_automacoes_boot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_atalhos JSONB;
  v_neg JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_automacao_mkt() THEN
    RAISE EXCEPTION 'Acesso negado às automações';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id, 'titulo', a.titulo, 'mensagem', a.mensagem,
    'url_img', a.url_img, 'url_pdf', a.url_pdf, 'url_audio', a.url_audio
  ) ORDER BY a.titulo), '[]'::JSONB)
  INTO v_atalhos FROM emp_garbo.atalhos a;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', n.id, 'telefone', n."numeroTelefone"
  ) ORDER BY n.id DESC), '[]'::JSONB)
  INTO v_neg FROM emp_garbo.negativacao_numeros n;

  RETURN jsonb_build_object(
    'atalhos', COALESCE(v_atalhos, '[]'::JSONB),
    'negativados', COALESCE(v_neg, '[]'::JSONB)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_automacoes_boot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_automacoes_boot() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_automacoes_salvar_atalho(
  p_id BIGINT,
  p_titulo TEXT,
  p_mensagem TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  IF NOT public.movelaria_crm_pode_automacao_mkt() THEN
    RAISE EXCEPTION 'Acesso negado às automações';
  END IF;
  IF NULLIF(btrim(p_titulo), '') IS NULL THEN RAISE EXCEPTION 'Informe o título'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO emp_garbo.atalhos (titulo, mensagem, user_auth, all_can_see)
    VALUES (btrim(p_titulo), COALESCE(p_mensagem, ''), auth.uid(), TRUE)
    RETURNING id INTO v_id;
  ELSE
    UPDATE emp_garbo.atalhos SET titulo = btrim(p_titulo), mensagem = COALESCE(p_mensagem, '')
    WHERE id = p_id RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_automacoes_salvar_atalho(BIGINT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_automacoes_salvar_atalho(BIGINT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_automacoes_salvar_negativado(p_telefone BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_id BIGINT;
BEGIN
  IF NOT (public.movelaria_crm_colaborador_roles() && ARRAY['admin', 'vendedor']::TEXT[]) THEN
    RAISE EXCEPTION 'Acesso negado à negativação';
  END IF;
  IF p_telefone IS NULL THEN RAISE EXCEPTION 'Informe o telefone'; END IF;
  INSERT INTO emp_garbo.negativacao_numeros ("numeroTelefone") VALUES (p_telefone)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_automacoes_salvar_negativado(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_automacoes_salvar_negativado(BIGINT) TO authenticated;
