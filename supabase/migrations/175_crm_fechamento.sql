-- ============================================================
-- CRM Garbo: contratos, agenda comercial e lousa do lead
-- ============================================================

CREATE OR REPLACE FUNCTION public.movelaria_crm_pode_venda()
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
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  SELECT c.tipo_usuario, c.status_convite INTO v_tipo, v_status
  FROM emp_garbo.usuarios c WHERE c.id = auth.uid();
  IF v_tipo IS DISTINCT FROM 'colaborador' OR v_status IS DISTINCT FROM 'ATIVO' THEN
    RETURN FALSE;
  END IF;
  SELECT COALESCE(array_agg(r.role::TEXT), '{}'::TEXT[]) INTO v_roles
  FROM emp_garbo.user_roles r WHERE r.user_id = auth.uid();
  RETURN v_roles && ARRAY['admin', 'vendedor'];
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_pode_venda() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_pode_venda() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_contratos_boot()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE v_contratos JSONB; v_modelos JSONB; v_variaveis JSONB; v_leads JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_venda() THEN RAISE EXCEPTION 'Acesso negado aos contratos'; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'identificador', c.identificador, 'cliente_nome', c.cliente_nome,
    'status', c.status, 'lead_id', c.lead_id, 'lead_nome', l.nome,
    'campos_valores', COALESCE(c.campos_valores, '{}'::JSONB),
    'conteudo_final', COALESCE(c.conteudo_final, ''),
    'created_at', c.created_at
  ) ORDER BY c.created_at DESC), '[]'::JSONB)
  INTO v_contratos
  FROM emp_garbo.contratos c
  LEFT JOIN emp_garbo.leads l ON l.id = c.lead_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id, 'nome', m.nome, 'conteudo', m.conteudo, 'ativo', m.ativo
  ) ORDER BY m.nome), '[]'::JSONB)
  INTO v_modelos FROM emp_garbo.contratos_modelos m;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', v.id, 'nome', v.nome, 'label', v.label, 'tipo', v.tipo,
    'obrigatorio', v.obrigatorio, 'ordem', v.ordem
  ) ORDER BY v.ordem, v.nome), '[]'::JSONB)
  INTO v_variaveis FROM emp_garbo.contratos_variaveis v;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', l.id, 'nome', l.nome) ORDER BY l.nome), '[]'::JSONB)
  INTO v_leads FROM emp_garbo.leads l;

  RETURN jsonb_build_object(
    'contratos', COALESCE(v_contratos, '[]'::JSONB),
    'modelos', COALESCE(v_modelos, '[]'::JSONB),
    'variaveis', COALESCE(v_variaveis, '[]'::JSONB),
    'leads', COALESCE(v_leads, '[]'::JSONB)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.movelaria_crm_contratos_boot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_contratos_boot() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_contrato_salvar(
  p_id UUID, p_identificador TEXT, p_cliente_nome TEXT, p_status TEXT,
  p_lead_id BIGINT, p_campos JSONB, p_conteudo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_venda() THEN RAISE EXCEPTION 'Acesso negado aos contratos'; END IF;
  IF p_id IS NULL OR NULLIF(BTRIM(p_identificador), '') IS NULL THEN
    RAISE EXCEPTION 'Identificador é obrigatório';
  END IF;
  UPDATE emp_garbo.contratos SET
    identificador = BTRIM(p_identificador),
    cliente_nome = COALESCE(NULLIF(BTRIM(p_cliente_nome), ''), cliente_nome),
    status = COALESCE(NULLIF(BTRIM(p_status), ''), status),
    lead_id = p_lead_id,
    campos_valores = COALESCE(p_campos, campos_valores),
    conteudo_final = COALESCE(p_conteudo, conteudo_final)
  WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Contrato não encontrado'; END IF;
  SELECT jsonb_build_object(
    'id', c.id, 'identificador', c.identificador, 'cliente_nome', c.cliente_nome,
    'status', c.status, 'lead_id', c.lead_id, 'campos_valores', COALESCE(c.campos_valores, '{}'::JSONB),
    'conteudo_final', COALESCE(c.conteudo_final, ''), 'created_at', c.created_at
  ) INTO v_row FROM emp_garbo.contratos c WHERE c.id = p_id;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.movelaria_crm_contrato_salvar(UUID, TEXT, TEXT, TEXT, BIGINT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_contrato_salvar(UUID, TEXT, TEXT, TEXT, BIGINT, JSONB, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_contrato_criar(
  p_identificador TEXT, p_cliente_nome TEXT, p_lead_id BIGINT, p_campos JSONB, p_conteudo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id UUID; v_row JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_venda() THEN RAISE EXCEPTION 'Acesso negado aos contratos'; END IF;
  INSERT INTO emp_garbo.contratos (identificador, cliente_nome, status, lead_id, campos_valores, conteudo_final, criado_por)
  VALUES (
    COALESCE(NULLIF(BTRIM(p_identificador), ''), 'Rascunho'),
    COALESCE(NULLIF(BTRIM(p_cliente_nome), ''), 'Rascunho'),
    'rascunho', p_lead_id, COALESCE(p_campos, '{}'::JSONB), COALESCE(p_conteudo, ''), auth.uid()
  ) RETURNING id INTO v_id;
  SELECT jsonb_build_object(
    'id', c.id, 'identificador', c.identificador, 'cliente_nome', c.cliente_nome,
    'status', c.status, 'lead_id', c.lead_id, 'campos_valores', COALESCE(c.campos_valores, '{}'::JSONB),
    'conteudo_final', COALESCE(c.conteudo_final, ''), 'created_at', c.created_at
  ) INTO v_row FROM emp_garbo.contratos c WHERE c.id = v_id;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.movelaria_crm_contrato_criar(TEXT, TEXT, BIGINT, JSONB, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_contrato_criar(TEXT, TEXT, BIGINT, JSONB, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_agenda_boot()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE v_config JSONB; v_reunioes JSONB; v_leads JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_venda() THEN RAISE EXCEPTION 'Acesso negado à agenda comercial'; END IF;
  SELECT to_jsonb(c) INTO v_config FROM emp_garbo.agenda_config c LIMIT 1;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'titulo', r.titulo, 'descricao', r.descricao,
    'data_hora_inicio', r.data_hora_inicio, 'data_hora_fim', r.data_hora_fim,
    'duracao_minutos', r.duracao_minutos, 'convidado_nome', r.convidado_nome,
    'convidado_whatsapp', r.convidado_whatsapp, 'convidado_email', r.convidado_email,
    'status', r.status, 'tipo', r.tipo, 'lead_id', r.lead_id, 'lead_nome', l.nome,
    'observacoes', r.observacoes, 'link_video_conferencia', r.link_video_conferencia
  ) ORDER BY r.data_hora_inicio DESC), '[]'::JSONB)
  INTO v_reunioes
  FROM emp_garbo.agenda_reunioes r
  LEFT JOIN emp_garbo.leads l ON l.id = r.lead_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', l.id, 'nome', l.nome) ORDER BY l.nome), '[]'::JSONB)
  INTO v_leads FROM emp_garbo.leads l;
  RETURN jsonb_build_object(
    'config', COALESCE(v_config, '{}'::JSONB),
    'reunioes', COALESCE(v_reunioes, '[]'::JSONB),
    'leads', COALESCE(v_leads, '[]'::JSONB)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.movelaria_crm_agenda_boot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_agenda_boot() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_agenda_salvar(
  p_id UUID, p_titulo TEXT, p_inicio TIMESTAMPTZ, p_fim TIMESTAMPTZ,
  p_convidado TEXT, p_whatsapp TEXT, p_status TEXT, p_lead_id BIGINT, p_observacoes TEXT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_row JSONB; v_status TEXT;
BEGIN
  IF NOT public.movelaria_crm_pode_venda() THEN RAISE EXCEPTION 'Acesso negado à agenda comercial'; END IF;
  IF p_id IS NULL OR NULLIF(BTRIM(p_titulo), '') IS NULL OR p_inicio IS NULL THEN
    RAISE EXCEPTION 'Título e horário são obrigatórios';
  END IF;
  v_status := COALESCE(NULLIF(BTRIM(p_status), ''), 'pendente');
  UPDATE emp_garbo.agenda_reunioes SET
    titulo = BTRIM(p_titulo),
    data_hora_inicio = p_inicio,
    data_hora_fim = COALESCE(p_fim, p_inicio + INTERVAL '30 minutes'),
    duracao_minutos = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (COALESCE(p_fim, p_inicio + INTERVAL '30 minutes') - p_inicio)) / 60)::INT),
    convidado_nome = NULLIF(BTRIM(p_convidado), ''),
    convidado_whatsapp = NULLIF(BTRIM(p_whatsapp), ''),
    status = v_status,
    lead_id = p_lead_id,
    observacoes = NULLIF(BTRIM(p_observacoes), ''),
    atualizado_em = NOW(),
    confirmado_em = CASE WHEN v_status = 'confirmado' THEN COALESCE(confirmado_em, NOW()) ELSE confirmado_em END,
    concluido_em = CASE WHEN v_status = 'concluido' THEN COALESCE(concluido_em, NOW()) ELSE concluido_em END,
    cancelado_em = CASE WHEN v_status = 'cancelado' THEN COALESCE(cancelado_em, NOW()) ELSE cancelado_em END
  WHERE id = p_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Reunião não encontrada'; END IF;
  SELECT jsonb_build_object(
    'id', r.id, 'titulo', r.titulo, 'data_hora_inicio', r.data_hora_inicio,
    'data_hora_fim', r.data_hora_fim, 'convidado_nome', r.convidado_nome,
    'convidado_whatsapp', r.convidado_whatsapp, 'status', r.status,
    'lead_id', r.lead_id, 'observacoes', r.observacoes
  ) INTO v_row FROM emp_garbo.agenda_reunioes r WHERE r.id = p_id;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.movelaria_crm_agenda_salvar(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, BIGINT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_agenda_salvar(UUID, TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, TEXT, BIGINT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_agenda_criar(
  p_titulo TEXT, p_inicio TIMESTAMPTZ, p_fim TIMESTAMPTZ,
  p_convidado TEXT, p_whatsapp TEXT, p_lead_id BIGINT
)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE v_id UUID; v_row JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_venda() THEN RAISE EXCEPTION 'Acesso negado à agenda comercial'; END IF;
  IF NULLIF(BTRIM(p_titulo), '') IS NULL OR p_inicio IS NULL THEN
    RAISE EXCEPTION 'Título e horário são obrigatórios';
  END IF;
  INSERT INTO emp_garbo.agenda_reunioes (
    titulo, data_hora_inicio, data_hora_fim, duracao_minutos,
    convidado_nome, convidado_whatsapp, status, tipo, lead_id
  ) VALUES (
    BTRIM(p_titulo), p_inicio, COALESCE(p_fim, p_inicio + INTERVAL '30 minutes'),
    GREATEST(1, ROUND(EXTRACT(EPOCH FROM (COALESCE(p_fim, p_inicio + INTERVAL '30 minutes') - p_inicio)) / 60)::INT),
    NULLIF(BTRIM(p_convidado), ''), NULLIF(BTRIM(p_whatsapp), ''),
    'pendente', 'interno', p_lead_id
  ) RETURNING id INTO v_id;
  SELECT jsonb_build_object(
    'id', r.id, 'titulo', r.titulo, 'data_hora_inicio', r.data_hora_inicio,
    'data_hora_fim', r.data_hora_fim, 'convidado_nome', r.convidado_nome,
    'status', r.status, 'lead_id', r.lead_id
  ) INTO v_row FROM emp_garbo.agenda_reunioes r WHERE r.id = v_id;
  RETURN v_row;
END;
$$;
REVOKE ALL ON FUNCTION public.movelaria_crm_agenda_criar(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_agenda_criar(TEXT, TIMESTAMPTZ, TIMESTAMPTZ, TEXT, TEXT, BIGINT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_lousa_boot()
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE v_leads JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_pipeline() THEN RAISE EXCEPTION 'Acesso negado à lousa do lead'; END IF;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'lead_id', q.lead_id, 'lead_nome', q.lead_nome,
    'fotos', q.fotos, 'tracos', q.tracos
  ) ORDER BY q.fotos DESC, q.lead_nome), '[]'::JSONB)
  INTO v_leads
  FROM (
    SELECT i.lead_id, l.nome AS lead_nome, COUNT(DISTINCT i.id)::INT AS fotos,
      (SELECT COUNT(*)::INT FROM emp_garbo.lead_whiteboard_drawings d WHERE d.lead_id = i.lead_id) AS tracos
    FROM emp_garbo.lead_whiteboard_images i
    LEFT JOIN emp_garbo.leads l ON l.id = i.lead_id
    GROUP BY i.lead_id, l.nome
  ) q;
  RETURN jsonb_build_object('leads', COALESCE(v_leads, '[]'::JSONB));
END;
$$;
REVOKE ALL ON FUNCTION public.movelaria_crm_lousa_boot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_lousa_boot() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_lousa_obter(p_lead_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public
AS $$
DECLARE v_lead TEXT; v_images JSONB; v_drawings JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_pipeline() THEN RAISE EXCEPTION 'Acesso negado à lousa do lead'; END IF;
  IF p_lead_id IS NULL THEN RAISE EXCEPTION 'Lead inválido'; END IF;
  SELECT nome INTO v_lead FROM emp_garbo.leads WHERE id = p_lead_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', i.id, 'file_url', i.file_url, 'file_name', i.file_name,
    'position_x', i.position_x, 'position_y', i.position_y,
    'width', i.width, 'height', i.height, 'z_index', i.z_index
  ) ORDER BY i.z_index, i.criado_em), '[]'::JSONB)
  INTO v_images FROM emp_garbo.lead_whiteboard_images i WHERE i.lead_id = p_lead_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id, 'path_data', d.path_data, 'cor', d.cor, 'stroke_width', d.stroke_width
  ) ORDER BY d.criado_em), '[]'::JSONB)
  INTO v_drawings FROM emp_garbo.lead_whiteboard_drawings d WHERE d.lead_id = p_lead_id;
  RETURN jsonb_build_object(
    'lead_id', p_lead_id, 'lead_nome', v_lead,
    'images', COALESCE(v_images, '[]'::JSONB),
    'drawings', COALESCE(v_drawings, '[]'::JSONB)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.movelaria_crm_lousa_obter(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_lousa_obter(BIGINT) TO authenticated;

