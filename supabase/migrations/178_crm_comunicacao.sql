-- ============================================================
-- CRM Garbo: notificações, WhatsApp, eventos, chat interno e agenda pública
-- ============================================================

CREATE OR REPLACE FUNCTION public.movelaria_crm_pode_comunicacao()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT public.movelaria_crm_colaborador_roles()
    && ARRAY['admin', 'vendedor', 'projetista', 'projetista_admin', 'marketing']::TEXT[];
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_pode_comunicacao() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_pode_comunicacao() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_notificacoes(p_limit INT DEFAULT 40, p_offset INT DEFAULT 0)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_items JSONB;
  v_unread INT;
  v_total INT;
  v_lim INT := GREATEST(1, LEAST(COALESCE(p_limit, 40), 80));
  v_off INT := GREATEST(0, COALESCE(p_offset, 0));
BEGIN
  IF NOT public.movelaria_crm_pode_comunicacao() THEN
    RAISE EXCEPTION 'Acesso negado às notificações do CRM';
  END IF;

  SELECT COUNT(*)::INT, COUNT(*) FILTER (WHERE n.read = FALSE)::INT
  INTO v_total, v_unread
  FROM emp_garbo.notifications n
  WHERE n.user_id = auth.uid();

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::JSONB)
  INTO v_items
  FROM (
    SELECT n.id, n.lead_id, n.vendor_name, n.notification_type, n.message, n.read, n.created_at
    FROM emp_garbo.notifications n
    WHERE n.user_id = auth.uid()
    ORDER BY n.created_at DESC
    LIMIT v_lim OFFSET v_off
  ) x;

  RETURN jsonb_build_object(
    'items', COALESCE(v_items, '[]'::JSONB),
    'total', v_total,
    'nao_lidas', v_unread
  );
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_notificacoes(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_notificacoes(INT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_notificacao_ler(p_id UUID, p_todas BOOLEAN DEFAULT FALSE)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.movelaria_crm_pode_comunicacao() THEN
    RAISE EXCEPTION 'Acesso negado às notificações do CRM';
  END IF;
  IF COALESCE(p_todas, FALSE) THEN
    UPDATE emp_garbo.notifications SET read = TRUE
    WHERE user_id = auth.uid() AND read = FALSE;
  ELSE
    IF p_id IS NULL THEN RAISE EXCEPTION 'Informe a notificação'; END IF;
    UPDATE emp_garbo.notifications SET read = TRUE
    WHERE id = p_id AND user_id = auth.uid();
  END IF;
  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_notificacao_ler(UUID, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_notificacao_ler(UUID, BOOLEAN) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_whatsapp_historico(p_telefone TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_digits TEXT := regexp_replace(COALESCE(p_telefone, ''), '\D', '', 'g');
  v_items JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_pipeline() THEN
    RAISE EXCEPTION 'Acesso negado ao WhatsApp do lead';
  END IF;
  IF v_digits IS NULL OR length(v_digits) < 8 THEN
    RETURN jsonb_build_object('items', '[]'::JSONB);
  END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(x) ORDER BY x.criado_em), '[]'::JSONB)
  INTO v_items
  FROM (
    SELECT m.id, m.telefone, m.tipo_remetente, m.tipo_mensagem, m.conteudo,
           m.url_midia, m.origem, m.criado_em
    FROM emp_garbo.chat_mensagens m
    WHERE regexp_replace(m.telefone, '\D', '', 'g') = v_digits
       OR regexp_replace(m.telefone, '\D', '', 'g') = ('55' || v_digits)
       OR ('55' || regexp_replace(m.telefone, '\D', '', 'g')) = v_digits
    ORDER BY m.criado_em DESC
    LIMIT 80
  ) x;

  RETURN jsonb_build_object('items', COALESCE(v_items, '[]'::JSONB));
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_whatsapp_historico(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_whatsapp_historico(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_whatsapp_registrar(
  p_telefone TEXT,
  p_conteudo TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_digits TEXT := regexp_replace(COALESCE(p_telefone, ''), '\D', '', 'g');
  v_id UUID;
BEGIN
  IF NOT public.movelaria_crm_pode_venda() THEN
    RAISE EXCEPTION 'Acesso negado para enviar WhatsApp';
  END IF;
  IF v_digits IS NULL OR length(v_digits) < 8 THEN RAISE EXCEPTION 'Informe o telefone'; END IF;
  IF NULLIF(btrim(p_conteudo), '') IS NULL THEN RAISE EXCEPTION 'Escreva a mensagem'; END IF;

  INSERT INTO emp_garbo.chat_mensagens (
    telefone, tipo_remetente, usuario_id, tipo_mensagem, conteudo, origem, enviada, lida
  ) VALUES (
    v_digits, 'atendente', auth.uid(), 'texto', btrim(p_conteudo), 'crm', TRUE, TRUE
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_whatsapp_registrar(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_whatsapp_registrar(TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_eventos_boot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_eventos JSONB;
  v_paginas JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_venda() THEN
    RAISE EXCEPTION 'Acesso negado aos eventos';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', e.id, 'titulo', e.titulo, 'data_evento', e.data_evento,
    'tipo', e.tipo, 'tipo_custom', e.tipo_custom, 'observacoes', e.observacoes, 'fixado', e.fixado
  ) ORDER BY e.fixado DESC, e.data_evento DESC), '[]'::JSONB)
  INTO v_eventos FROM emp_garbo.eventos e;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'evento_id', p.evento_id, 'secao', p.secao,
    'titulo', p.titulo, 'corpo', p.corpo, 'ordem', p.ordem
  ) ORDER BY p.ordem, p.titulo), '[]'::JSONB)
  INTO v_paginas FROM emp_garbo.evento_paginas p;

  RETURN jsonb_build_object(
    'eventos', COALESCE(v_eventos, '[]'::JSONB),
    'paginas', COALESCE(v_paginas, '[]'::JSONB)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_eventos_boot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_eventos_boot() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_chat_boot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_contatos JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_venda() THEN
    RAISE EXCEPTION 'Acesso negado ao chat interno';
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'nome', c.nome, 'telefone', c.telefone, 'lead_id', c.lead_id,
    'ultima_mensagem_em', c.ultima_mensagem_em, 'nao_lidas', COALESCE(c.mensagens_nao_lidas, 0)
  ) ORDER BY c.ultima_mensagem_em DESC NULLS LAST), '[]'::JSONB)
  INTO v_contatos FROM emp_garbo.chat_contatos c;

  RETURN jsonb_build_object('contatos', COALESCE(v_contatos, '[]'::JSONB));
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_chat_boot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_chat_boot() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_lead_ia_boot(p_lead_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_analises JSONB;
  v_renders JSONB;
  v_chat JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_pipeline() THEN
    RAISE EXCEPTION 'Acesso negado à IA do lead';
  END IF;
  IF p_lead_id IS NULL THEN RAISE EXCEPTION 'Informe o lead'; END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::JSONB)
  INTO v_analises
  FROM (
    SELECT a.id, a.modelo, a.conteudo, a.perguntas_briefing, a.criado_em
    FROM emp_garbo.lead_ai_analises a
    WHERE a.lead_id = p_lead_id
    ORDER BY a.criado_em DESC
    LIMIT 12
  ) x;

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::JSONB)
  INTO v_renders
  FROM (
    SELECT r.id, r.output_public_url, r.vision_model, r.image_model, r.criado_em, r.edit_notas
    FROM emp_garbo.lead_ai_renders r
    WHERE r.lead_id = p_lead_id
    ORDER BY r.criado_em DESC
    LIMIT 12
  ) x;

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::JSONB)
  INTO v_chat
  FROM (
    SELECT m.id, m.role, m.content, m.modelo, m.criado_em
    FROM emp_garbo.lead_ai_chat_messages m
    WHERE m.lead_id = p_lead_id
    ORDER BY m.criado_em DESC
    LIMIT 30
  ) x;

  RETURN jsonb_build_object(
    'analises', COALESCE(v_analises, '[]'::JSONB),
    'renders', COALESCE(v_renders, '[]'::JSONB),
    'chat', COALESCE(v_chat, '[]'::JSONB)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_lead_ia_boot(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_lead_ia_boot(BIGINT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_agenda_publica(p_slug TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_cfg emp_garbo.agenda_config%ROWTYPE;
  v_ocupados JSONB;
BEGIN
  SELECT * INTO v_cfg
  FROM emp_garbo.agenda_config
  WHERE slug = NULLIF(btrim(p_slug), '') AND ativo = TRUE
  LIMIT 1;
  IF v_cfg.id IS NULL THEN
    RAISE EXCEPTION 'Agenda não encontrada';
  END IF;

  SELECT COALESCE(jsonb_agg(r.data_hora_inicio ORDER BY r.data_hora_inicio), '[]'::JSONB)
  INTO v_ocupados
  FROM emp_garbo.agenda_reunioes r
  WHERE r.status IS DISTINCT FROM 'cancelado'
    AND r.data_hora_inicio >= NOW()
    AND r.data_hora_inicio < NOW() + make_interval(days => GREATEST(1, v_cfg.antecedencia_maxima_dias));

  RETURN jsonb_build_object(
    'nome', v_cfg.nome_agenda,
    'slug', v_cfg.slug,
    'duracao_minutos', v_cfg.duracao_minutos,
    'intervalo_minutos', v_cfg.intervalo_minutos,
    'horario_inicio', v_cfg.horario_inicio,
    'horario_fim', v_cfg.horario_fim,
    'dias_disponiveis', v_cfg.dias_disponiveis,
    'texto', v_cfg.texto_pagina_agendamento,
    'antecedencia_minima_horas', v_cfg.antecedencia_minima_horas,
    'antecedencia_maxima_dias', v_cfg.antecedencia_maxima_dias,
    'ocupados', COALESCE(v_ocupados, '[]'::JSONB)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_agenda_publica(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_agenda_publica(TEXT) TO anon, authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_agenda_publica_criar(
  p_slug TEXT,
  p_nome TEXT,
  p_whatsapp TEXT,
  p_inicio TIMESTAMPTZ
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cfg emp_garbo.agenda_config%ROWTYPE;
  v_id UUID;
  v_fim TIMESTAMPTZ;
  v_digits TEXT := regexp_replace(COALESCE(p_whatsapp, ''), '\D', '', 'g');
BEGIN
  SELECT * INTO v_cfg
  FROM emp_garbo.agenda_config
  WHERE slug = NULLIF(btrim(p_slug), '') AND ativo = TRUE
  LIMIT 1;
  IF v_cfg.id IS NULL THEN RAISE EXCEPTION 'Agenda não encontrada'; END IF;
  IF NULLIF(btrim(p_nome), '') IS NULL THEN RAISE EXCEPTION 'Informe o nome'; END IF;
  IF length(COALESCE(v_digits, '')) < 8 THEN RAISE EXCEPTION 'Informe o WhatsApp'; END IF;
  IF p_inicio IS NULL THEN RAISE EXCEPTION 'Informe data e horário'; END IF;
  IF p_inicio < NOW() + make_interval(hours => GREATEST(0, v_cfg.antecedencia_minima_horas)) THEN
    RAISE EXCEPTION 'Este horário precisa de mais antecedência';
  END IF;
  IF EXISTS (
    SELECT 1 FROM emp_garbo.agenda_reunioes r
    WHERE r.status IS DISTINCT FROM 'cancelado'
      AND r.data_hora_inicio = p_inicio
  ) THEN
    RAISE EXCEPTION 'Este horário já foi reservado';
  END IF;

  v_fim := p_inicio + make_interval(mins => GREATEST(15, v_cfg.duracao_minutos));

  INSERT INTO emp_garbo.agenda_reunioes (
    titulo, data_hora_inicio, data_hora_fim, duracao_minutos,
    convidado_nome, convidado_whatsapp, status, tipo
  ) VALUES (
    'Agendamento: ' || btrim(p_nome),
    p_inicio, v_fim, GREATEST(15, v_cfg.duracao_minutos),
    btrim(p_nome), v_digits, 'pendente', 'publico'
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'inicio', p_inicio);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_agenda_publica_criar(TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_agenda_publica_criar(TEXT, TEXT, TEXT, TIMESTAMPTZ) TO anon, authenticated;
