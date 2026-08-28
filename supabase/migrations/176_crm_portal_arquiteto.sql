-- ============================================================
-- CRM Garbo: portal do arquiteto / parceiro (prestador_servico)
-- ============================================================

CREATE OR REPLACE FUNCTION public.movelaria_crm_pode_prestador()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_tipo   TEXT;
  v_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  SELECT c.tipo_usuario, c.status_convite INTO v_tipo, v_status
  FROM emp_garbo.usuarios c WHERE c.id = auth.uid();
  RETURN v_tipo IS NOT DISTINCT FROM 'prestador_servico' AND v_status IS NOT DISTINCT FROM 'ATIVO';
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_pode_prestador() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_pode_prestador() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_portal_status_e_ganho(p_status TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN p_status IS NULL OR btrim(p_status) = '' THEN FALSE
    WHEN p_status ILIKE '%perdid%' THEN FALSE
    WHEN p_status ILIKE '%venda realizada%' THEN TRUE
    WHEN p_status ILIKE '%ganh%' THEN TRUE
    ELSE FALSE
  END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_portal_status_e_ganho(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_portal_status_e_ganho(TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_portal_saldo_sacar(p_uid UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_liberado NUMERIC := 0;
  v_ajustes  NUMERIC := 0;
  v_saques   NUMERIC := 0;
BEGIN
  IF p_uid IS DISTINCT FROM auth.uid() OR NOT public.movelaria_crm_pode_prestador() THEN
    RAISE EXCEPTION 'Acesso negado ao portal do parceiro';
  END IF;

  SELECT COALESCE(SUM(
    (
      CASE
        WHEN public.movelaria_crm_portal_status_e_ganho(l.status)
          THEN COALESCE(NULLIF(l.valor_negocio, 0), COALESCE(l.valor_orcamento, 0), 0)
        ELSE COALESCE(l.valor_orcamento, 0)
      END
      * COALESCE(v.pontua_garbo_percentual, NULLIF((d.config_pontua_garbo->>'percentual_padrao')::NUMERIC, 0), 5)
      / 100.0
    )
  ), 0)
  INTO v_liberado
  FROM emp_garbo.lead_custom_field_values v
  JOIN emp_garbo.lead_custom_field_definitions d ON d.id = v.field_id
  JOIN emp_garbo.leads l ON l.id = v.lead_id
  JOIN emp_garbo.pontua_garbo_comissao_liberacoes lib
    ON lib.lead_id = v.lead_id
   AND lib.field_id = v.field_id
   AND lib.prestador_id = p_uid
   AND lib.status = 'liberada'
  WHERE v.valor = p_uid::TEXT
    AND d.tipo = 'usuario_sistema'
    AND COALESCE(d.ativo, TRUE)
    AND COALESCE((d.config_pontua_garbo->>'ativo')::BOOLEAN, TRUE)
    AND public.movelaria_crm_portal_status_e_ganho(l.status);

  SELECT COALESCE(SUM(CASE WHEN tipo = 'ajuste' THEN valor ELSE 0 END), 0),
         COALESCE(SUM(CASE WHEN tipo = 'saque' THEN valor ELSE 0 END), 0)
  INTO v_ajustes, v_saques
  FROM emp_garbo.pontua_garbo_lancamentos
  WHERE prestador_id = p_uid;

  RETURN GREATEST(0, ROUND((v_liberado + v_ajustes - v_saques)::NUMERIC, 2));
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_portal_saldo_sacar(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_portal_saldo_sacar(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_portal_boot()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_uid          UUID := auth.uid();
  v_perfil       JSONB;
  v_leads        JSONB;
  v_permissoes   JSONB;
  v_lancamentos  JSONB;
  v_saques       JSONB;
  v_titulos      JSONB;
  v_defs         JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_prestador() THEN
    RAISE EXCEPTION 'Acesso negado ao portal do parceiro';
  END IF;

  SELECT jsonb_build_object(
    'id', c.id,
    'nome', c.nome,
    'email', c.email,
    'telefone', c.telefone,
    'avatar_url', c.avatar_url,
    'titulo', COALESCE(c.titulo, 'Prestador de Serviço'),
    'comissao_ativa', COALESCE(c.comissao_ativa, FALSE),
    'chave_pix', c.chave_pix,
    'tipo_chave_pix', COALESCE(c.tipo_chave_pix, 'cpf')
  )
  INTO v_perfil
  FROM emp_garbo.usuarios c
  WHERE c.id = v_uid;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'nome', d.nome,
    'ativo', d.ativo,
    'config_pontua_garbo', COALESCE(d.config_pontua_garbo, '{}'::JSONB)
  ) ORDER BY d.ordem, d.nome), '[]'::JSONB)
  INTO v_defs
  FROM emp_garbo.lead_custom_field_definitions d
  WHERE d.tipo = 'usuario_sistema';

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'lead_id', l.id,
    'lead_nome', l.nome,
    'lead_status', l.status,
    'valor_orcamento', COALESCE(l.valor_orcamento, 0),
    'valor_negocio', COALESCE(l.valor_negocio, 0),
    'field_id', v.field_id,
    'field_nome', d.nome,
    'percentual', COALESCE(v.pontua_garbo_percentual, NULLIF((d.config_pontua_garbo->>'percentual_padrao')::NUMERIC, 0), 5),
    'venda_realizada_em', l.venda_realizada_em,
    'data_chegada', l.data_chegada,
    'criado_em', l.criado_em,
    'lead_email', l.email,
    'lead_telefone', l.telefone,
    'lead_empresa', l.empresa,
    'lead_origem', l.origem,
    'lead_regiao', l.regiao,
    'liberacao_id', lib.id,
    'liberacao_status', lib.status
  ) ORDER BY COALESCE(l.venda_realizada_em, l.criado_em) DESC NULLS LAST), '[]'::JSONB)
  INTO v_leads
  FROM emp_garbo.lead_custom_field_values v
  JOIN emp_garbo.lead_custom_field_definitions d ON d.id = v.field_id
  JOIN emp_garbo.leads l ON l.id = v.lead_id
  LEFT JOIN emp_garbo.pontua_garbo_comissao_liberacoes lib
    ON lib.lead_id = v.lead_id
   AND lib.field_id = v.field_id
   AND lib.prestador_id = v_uid
  WHERE v.valor = v_uid::TEXT
    AND d.tipo = 'usuario_sistema'
    AND COALESCE(d.ativo, TRUE);

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'lead_id', p.lead_id,
    'prestador_id', p.prestador_id,
    'pode_ver_detalhes', COALESCE(p.pode_ver_detalhes, FALSE),
    'pode_ver_lousa', COALESCE(p.pode_ver_lousa, FALSE),
    'pode_ver_anotacoes', COALESCE(p.pode_ver_anotacoes, FALSE),
    'pode_ver_anexos', COALESCE(p.pode_ver_anexos, FALSE),
    'pode_ver_fotos', COALESCE(p.pode_ver_fotos, FALSE),
    'pode_ver_pdfs', COALESCE(p.pode_ver_pdfs, FALSE),
    'anexos_visiveis', p.anexos_visiveis,
    'pode_ver_orcamento', COALESCE(p.pode_ver_orcamento, FALSE),
    'orcamentos_visiveis', p.orcamentos_visiveis
  )), '[]'::JSONB)
  INTO v_permissoes
  FROM emp_garbo.lead_prestador_permissoes p
  WHERE p.prestador_id = v_uid;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', x.id, 'tipo', x.tipo, 'valor', x.valor, 'descricao', x.descricao, 'criado_em', x.criado_em
  ) ORDER BY x.criado_em DESC), '[]'::JSONB)
  INTO v_lancamentos
  FROM emp_garbo.pontua_garbo_lancamentos x
  WHERE x.prestador_id = v_uid;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'valor_solicitado', s.valor_solicitado,
    'chave_pix', s.chave_pix,
    'tipo_chave_pix', s.tipo_chave_pix,
    'status', s.status,
    'obs_admin', s.obs_admin,
    'criado_em', s.criado_em,
    'processado_em', s.processado_em
  ) ORDER BY s.criado_em DESC), '[]'::JSONB)
  INTO v_saques
  FROM emp_garbo.prestador_saque_pedidos s
  WHERE s.prestador_id = v_uid;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome) ORDER BY t.nome), '[]'::JSONB)
  INTO v_titulos
  FROM emp_garbo.prestador_titulos t;

  RETURN jsonb_build_object(
    'perfil', v_perfil,
    'defs', COALESCE(v_defs, '[]'::JSONB),
    'leads', COALESCE(v_leads, '[]'::JSONB),
    'permissoes', COALESCE(v_permissoes, '[]'::JSONB),
    'lancamentos', COALESCE(v_lancamentos, '[]'::JSONB),
    'saques', COALESCE(v_saques, '[]'::JSONB),
    'titulos', COALESCE(v_titulos, '[]'::JSONB)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_portal_boot() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_portal_boot() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_portal_lead(p_lead_id BIGINT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_perm emp_garbo.lead_prestador_permissoes%ROWTYPE;
  v_lead JSONB;
  v_lousa_images JSONB;
  v_lousa_drawings JSONB;
  v_slides JSONB;
  v_aberto BOOLEAN;
BEGIN
  IF NOT public.movelaria_crm_pode_prestador() THEN
    RAISE EXCEPTION 'Acesso negado ao portal do parceiro';
  END IF;
  IF p_lead_id IS NULL THEN RAISE EXCEPTION 'Lead inválido'; END IF;

  SELECT * INTO v_perm
  FROM emp_garbo.lead_prestador_permissoes
  WHERE lead_id = p_lead_id AND prestador_id = v_uid;

  v_aberto := COALESCE(v_perm.pode_ver_detalhes, FALSE)
    OR COALESCE(v_perm.pode_ver_lousa, FALSE)
    OR COALESCE(v_perm.pode_ver_fotos, FALSE)
    OR COALESCE(v_perm.pode_ver_pdfs, FALSE)
    OR COALESCE(v_perm.pode_ver_anexos, FALSE)
    OR COALESCE(v_perm.pode_ver_orcamento, FALSE);

  IF NOT v_aberto THEN
    RAISE EXCEPTION 'Visualização não liberada para este lead';
  END IF;

  IF COALESCE(v_perm.pode_ver_detalhes, FALSE) THEN
    SELECT jsonb_build_object(
      'id', l.id,
      'nome', l.nome,
      'empresa', l.empresa,
      'email', l.email,
      'telefone', l.telefone,
      'origem', l.origem,
      'status', l.status,
      'valor_orcamento', COALESCE(l.valor_orcamento, 0),
      'valor_negocio', COALESCE(l.valor_negocio, 0),
      'data_chegada', l.data_chegada,
      'regiao', l.regiao,
      'observacoes', CASE WHEN COALESCE(v_perm.pode_ver_anotacoes, FALSE) THEN l.observacoes ELSE NULL END
    )
    INTO v_lead
    FROM emp_garbo.leads l
    WHERE l.id = p_lead_id;
  ELSE
    SELECT jsonb_build_object('id', l.id, 'nome', l.nome, 'status', l.status)
    INTO v_lead
    FROM emp_garbo.leads l
    WHERE l.id = p_lead_id;
  END IF;

  IF COALESCE(v_perm.pode_ver_lousa, FALSE) OR COALESCE(v_perm.pode_ver_fotos, FALSE) THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', i.id, 'file_url', i.file_url, 'file_name', i.file_name,
      'position_x', i.position_x, 'position_y', i.position_y,
      'width', i.width, 'height', i.height, 'z_index', i.z_index
    ) ORDER BY i.z_index, i.criado_em), '[]'::JSONB)
    INTO v_lousa_images
    FROM emp_garbo.lead_whiteboard_images i
    WHERE i.lead_id = p_lead_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', d.id, 'path_data', d.path_data, 'cor', d.cor, 'stroke_width', d.stroke_width
    ) ORDER BY d.criado_em), '[]'::JSONB)
    INTO v_lousa_drawings
    FROM emp_garbo.lead_whiteboard_drawings d
    WHERE d.lead_id = p_lead_id;
  ELSE
    v_lousa_images := '[]'::JSONB;
    v_lousa_drawings := '[]'::JSONB;
  END IF;

  IF COALESCE(v_perm.pode_ver_orcamento, FALSE) THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', s.id,
      'identificador', s.identificador,
      'cliente_nome', s.cliente_nome,
      'status', s.status
    ) ORDER BY s.atualizado_em DESC NULLS LAST), '[]'::JSONB)
    INTO v_slides
    FROM emp_garbo.orcamento_slides s
    WHERE s.lead_id = p_lead_id
      AND (
        v_perm.orcamentos_visiveis IS NULL
        OR s.id = ANY (v_perm.orcamentos_visiveis)
      );
  ELSE
    v_slides := '[]'::JSONB;
  END IF;

  RETURN jsonb_build_object(
    'lead', v_lead,
    'pode_ver_detalhes', COALESCE(v_perm.pode_ver_detalhes, FALSE),
    'pode_ver_lousa', COALESCE(v_perm.pode_ver_lousa, FALSE),
    'pode_ver_anotacoes', COALESCE(v_perm.pode_ver_anotacoes, FALSE),
    'pode_ver_fotos', COALESCE(v_perm.pode_ver_fotos, FALSE),
    'pode_ver_pdfs', COALESCE(v_perm.pode_ver_pdfs, FALSE),
    'pode_ver_orcamento', COALESCE(v_perm.pode_ver_orcamento, FALSE),
    'lousa_images', COALESCE(v_lousa_images, '[]'::JSONB),
    'lousa_drawings', COALESCE(v_lousa_drawings, '[]'::JSONB),
    'slides', COALESCE(v_slides, '[]'::JSONB)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_portal_lead(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_portal_lead(BIGINT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_portal_salvar_perfil(
  p_telefone TEXT,
  p_chave_pix TEXT,
  p_tipo_chave_pix TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_tipo TEXT;
BEGIN
  IF NOT public.movelaria_crm_pode_prestador() THEN
    RAISE EXCEPTION 'Acesso negado ao portal do parceiro';
  END IF;
  v_tipo := COALESCE(NULLIF(btrim(p_tipo_chave_pix), ''), 'cpf');
  IF v_tipo NOT IN ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria') THEN
    RAISE EXCEPTION 'Tipo de chave PIX inválido';
  END IF;

  UPDATE emp_garbo.usuarios
  SET telefone = NULLIF(btrim(p_telefone), ''),
      chave_pix = NULLIF(btrim(p_chave_pix), ''),
      tipo_chave_pix = v_tipo,
      atualizado_em = NOW()
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', TRUE);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_portal_salvar_perfil(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_portal_salvar_perfil(TEXT, TEXT, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_crm_portal_solicitar_saque(
  p_valor NUMERIC,
  p_chave_pix TEXT,
  p_tipo_chave_pix TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_tipo TEXT;
  v_chave TEXT;
  v_valor NUMERIC;
  v_saldo NUMERIC;
  v_pendente NUMERIC;
  v_disponivel NUMERIC;
  v_id UUID;
BEGIN
  IF NOT public.movelaria_crm_pode_prestador() THEN
    RAISE EXCEPTION 'Acesso negado ao portal do parceiro';
  END IF;

  v_chave := NULLIF(btrim(p_chave_pix), '');
  IF v_chave IS NULL THEN RAISE EXCEPTION 'Informe a chave PIX'; END IF;
  v_tipo := COALESCE(NULLIF(btrim(p_tipo_chave_pix), ''), 'cpf');
  IF v_tipo NOT IN ('cpf', 'cnpj', 'email', 'telefone', 'aleatoria') THEN
    RAISE EXCEPTION 'Tipo de chave PIX inválido';
  END IF;
  v_valor := ROUND(COALESCE(p_valor, 0), 2);
  IF v_valor <= 0 THEN RAISE EXCEPTION 'Informe um valor válido maior que zero.'; END IF;

  v_saldo := public.movelaria_crm_portal_saldo_sacar(v_uid);
  SELECT COALESCE(SUM(valor_solicitado), 0) INTO v_pendente
  FROM emp_garbo.prestador_saque_pedidos
  WHERE prestador_id = v_uid AND status = 'pendente';
  v_disponivel := GREATEST(0, ROUND((v_saldo - v_pendente)::NUMERIC, 2));

  IF v_valor > v_disponivel THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível para sacar: %', v_disponivel;
  END IF;

  INSERT INTO emp_garbo.prestador_saque_pedidos (
    prestador_id, valor_solicitado, chave_pix, tipo_chave_pix, status
  ) VALUES (
    v_uid, v_valor, v_chave, v_tipo, 'pendente'
  )
  RETURNING id INTO v_id;

  UPDATE emp_garbo.usuarios
  SET chave_pix = v_chave, tipo_chave_pix = v_tipo, atualizado_em = NOW()
  WHERE id = v_uid;

  RETURN jsonb_build_object('id', v_id, 'status', 'pendente');
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_crm_portal_solicitar_saque(NUMERIC, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_crm_portal_solicitar_saque(NUMERIC, TEXT, TEXT) TO authenticated;
