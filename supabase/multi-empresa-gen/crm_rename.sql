-- GERADO por scripts/multi-empresa/gerar-crm-rename.mjs — M08: emp_garbo → crm.

alter schema emp_garbo rename to crm;

-- 96 funções reescritas (texto 'emp_garbo' → 'crm'; regex de schema aceita 'crm').
-- emp_garbo.match_lead_knowledge
CREATE OR REPLACE FUNCTION crm.match_lead_knowledge(p_lead_id bigint, query_embedding vector, match_count integer DEFAULT 10, match_threshold double precision DEFAULT 0.5)
 RETURNS TABLE(id uuid, content text, source_type text, metadata jsonb, similarity double precision)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'crm', 'public'
AS $function$
        SELECT
          c.id,
          c.content,
          c.source_type,
          c.metadata,
          1 - (c.embedding <=> query_embedding) AS similarity
        FROM crm.lead_ai_knowledge_chunks c
        WHERE c.lead_id = p_lead_id
          AND c.embedding IS NOT NULL
          AND 1 - (c.embedding <=> query_embedding) >= match_threshold
        ORDER BY c.embedding <=> query_embedding
        LIMIT GREATEST(match_count, 1);
      $function$;

-- emp_garbo.me_can_access_producao
CREATE OR REPLACE FUNCTION crm.me_can_access_producao(p_uid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
  SELECT
    p_uid IS NOT NULL
    AND (
      public.me_is_super_admin(p_uid)
      OR public.me_get_empresa_role('crm', p_uid) = 'admin'
      OR public.me_empresa_has_any_role('crm', ARRAY['vendedor','projetista','projetista_admin'], p_uid)
      OR public.movelaria_meu_perfil() = 'montador_admin'
    );
$function$;

-- emp_garbo.me_can_config_producao
CREATE OR REPLACE FUNCTION crm.me_can_config_producao(p_uid uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
  SELECT
    p_uid IS NOT NULL
    AND (
      public.me_is_super_admin(p_uid)
      OR public.me_get_empresa_role('crm', p_uid) = 'admin'
      OR public.me_empresa_has_any_role('crm', ARRAY['projetista_admin'], p_uid)
      OR public.movelaria_meu_perfil() = 'montador_admin'
    );
$function$;

-- emp_garbo.trg_pontua_comissao_cria_conta_pagar
CREATE OR REPLACE FUNCTION crm.trg_pontua_comissao_cria_conta_pagar()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
DECLARE
  v_conta_id UUID;
BEGIN
  IF NEW.status IS DISTINCT FROM 'aguardando_liberacao' THEN
    RETURN NEW;
  END IF;

  IF NEW.conta_pagar_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_conta_id := public.movelaria_criar_conta_pagar_pontua_garbo(
    NEW.id,
    NEW.prestador_id,
    NEW.lead_id,
    NEW.valor_comissao
  );

  IF v_conta_id IS NOT NULL THEN
    NEW.conta_pagar_id := v_conta_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- public._form_orcamento_schema_ok
CREATE OR REPLACE FUNCTION public._form_orcamento_schema_ok(p_schema text)
 RETURNS boolean
 LANGUAGE sql
 STABLE
AS $function$
  SELECT p_schema IS NOT NULL
    AND p_schema ~ '^(crm|emp_[a-z0-9_]+)$'
    AND EXISTS (
      SELECT 1 FROM information_schema.schemata
      WHERE schema_name = p_schema
    );
$function$;

-- public.me_empresa_has_any_role
CREATE OR REPLACE FUNCTION public.me_empresa_has_any_role(_schema text, _roles text[], _user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_found boolean := false;
BEGIN
  IF _user_id IS NULL OR _schema IS NULL OR _schema !~ '^(crm|emp_[a-z0-9_]+)$' THEN
    RETURN false;
  END IF;
  EXECUTE format(
    'SELECT EXISTS (SELECT 1 FROM %I.user_roles WHERE user_id = $1 AND role::text = ANY($2))',
    _schema
  )
  INTO v_found
  USING _user_id, _roles;
  RETURN COALESCE(v_found, false);
END;
$function$;

-- public.me_ensure_super_admin_in_empresa
CREATE OR REPLACE FUNCTION public.me_ensure_super_admin_in_empresa(_schema_nome text, _user_id uuid DEFAULT auth.uid())
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_nome TEXT;
  v_email TEXT;
  v_empresa_id UUID;
BEGIN
  IF NOT public.me_is_super_admin(_user_id) THEN
    RETURN;
  END IF;

  IF _schema_nome IS NULL OR _schema_nome !~ '^(crm|emp_[a-z0-9_]+)$' THEN
    RETURN;
  END IF;

  SELECT nome, email
  INTO v_nome, v_email
  FROM public."CRM-multi-empresas>usuarios<"
  WHERE id = _user_id;

  IF v_nome IS NULL THEN
    SELECT
      COALESCE(raw_user_meta_data->>'full_name', raw_user_meta_data->>'name', split_part(email, '@', 1)),
      email
    INTO v_nome, v_email
    FROM auth.users
    WHERE id = _user_id;
  END IF;

  EXECUTE format(
    $sql$
      INSERT INTO %I.usuarios (id, nome, email, status_convite)
      VALUES ($1, $2, $3, 'ATIVO')
      ON CONFLICT (id) DO UPDATE SET
        nome = EXCLUDED.nome,
        email = EXCLUDED.email,
        status_convite = 'ATIVO',
        atualizado_em = now()
    $sql$,
    _schema_nome
  ) USING _user_id, v_nome, v_email;

  EXECUTE format(
    $sql$
      INSERT INTO %I.user_roles (user_id, role)
      VALUES ($1, 'admin'::public.selletos_crm_app_role)
      ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role
    $sql$,
    _schema_nome
  ) USING _user_id;

  SELECT id INTO v_empresa_id
  FROM public."CRM-multi-empresas>empresas<"
  WHERE schema_nome = _schema_nome
  LIMIT 1;

  IF v_empresa_id IS NOT NULL THEN
    INSERT INTO public."CRM-multi-empresas>usuario_empresa<" (user_id, empresa_id)
    VALUES (_user_id, v_empresa_id)
    ON CONFLICT (user_id, empresa_id) DO NOTHING;
  END IF;
END;
$function$;

-- public.me_get_empresa_role
CREATE OR REPLACE FUNCTION public.me_get_empresa_role(_schema text, _user_id uuid DEFAULT auth.uid())
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_roles public.selletos_crm_app_role[];
BEGIN
  IF _schema IS NULL OR _schema !~ '^(crm|emp_[a-z0-9_]+)$' THEN
    RETURN NULL;
  END IF;

  EXECUTE format(
    'SELECT COALESCE(ARRAY_AGG(role), ARRAY[]::public.selletos_crm_app_role[]) FROM %I.user_roles WHERE user_id = $1',
    _schema
  )
  INTO v_roles
  USING _user_id;

  RETURN public.me_pick_primary_role(v_roles)::text;
END;
$function$;

-- public.me_lead_linked_to_prestador
CREATE OR REPLACE FUNCTION public.me_lead_linked_to_prestador(_schema text, _lead_id bigint, _user_id uuid DEFAULT auth.uid())
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_linked BOOLEAN;
BEGIN
  IF _schema IS NULL OR _lead_id IS NULL OR _user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF _schema !~ '^(crm|emp_[a-z0-9_]+)$' THEN
    RETURN FALSE;
  END IF;

  EXECUTE format(
    $q$
    SELECT EXISTS (
      SELECT 1
      FROM %I.usuarios u
      WHERE u.id = $2
        AND u.tipo_usuario = 'prestador_servico'
    )
    AND EXISTS (
      SELECT 1
      FROM %I.lead_custom_field_values v
      INNER JOIN %I.lead_custom_field_definitions d ON d.id = v.field_id
      WHERE v.lead_id = $1
        AND d.tipo = 'usuario_sistema'
        AND d.ativo = true
        AND v.valor = $2::text
        AND (
          d.config_pontua_garbo IS NULL
          OR COALESCE((d.config_pontua_garbo->>'ativo')::boolean, true) IS TRUE
        )
    )
    $q$,
    _schema,
    _schema,
    _schema
  )
  INTO v_linked
  USING _lead_id, _user_id;

  RETURN COALESCE(v_linked, FALSE);
END;
$function$;

-- public.movelaria_atualizar_contrato
CREATE OR REPLACE FUNCTION public.movelaria_atualizar_contrato(p_id uuid, p_cliente_nome text, p_identificador text, p_campos_valores jsonb, p_status text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
      UPDATE crm.contratos
      SET cliente_nome  = p_cliente_nome,
          identificador = p_identificador,
          campos_valores = p_campos_valores,
          status = COALESCE(p_status, status)
      WHERE id = p_id;
    $function$;

-- public.movelaria_atualizar_ficha_crm
CREATE OR REPLACE FUNCTION public.movelaria_atualizar_ficha_crm(p_id uuid, p_tipo_usuario text, p_roles text[] DEFAULT '{}'::text[], p_horario_inicio text DEFAULT NULL::text, p_horario_fim text DEFAULT NULL::text, p_status_convite text DEFAULT 'ATIVO'::text, p_titulo text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_email   TEXT;
  v_nome    TEXT;
  v_tipo    TEXT;
  v_status  TEXT;
  v_role    TEXT;
  v_inicio  TIME;
  v_fim     TIME;
BEGIN
  IF public.movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem editar a ficha CRM';
  END IF;

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Usuário obrigatório.';
  END IF;

  v_tipo := NULLIF(btrim(COALESCE(p_tipo_usuario, '')), '');
  IF v_tipo IS NULL OR v_tipo = 'nenhum' THEN
    UPDATE crm.usuarios
    SET status_convite = 'INATIVO',
        atualizado_em = NOW()
    WHERE id = p_id;
    DELETE FROM crm.user_roles WHERE user_id = p_id;
    RETURN;
  END IF;

  IF v_tipo NOT IN ('colaborador', 'prestador_servico', 'lead') THEN
    RAISE EXCEPTION 'Tipo CRM inválido: %', v_tipo;
  END IF;

  v_status := COALESCE(NULLIF(btrim(p_status_convite), ''), 'ATIVO');
  IF v_status NOT IN ('ATIVO', 'INATIVO', 'PENDENTE') THEN
    RAISE EXCEPTION 'Status de convite inválido: %', v_status;
  END IF;

  v_inicio := NULLIF(btrim(COALESCE(p_horario_inicio, '')), '')::TIME;
  v_fim := NULLIF(btrim(COALESCE(p_horario_fim, '')), '')::TIME;

  SELECT COALESCE(m.email, c.email), COALESCE(m.nome, c.nome)
  INTO v_email, v_nome
  FROM (SELECT p_id AS id) x
  LEFT JOIN public.movelaria_usuarios m ON m.id = p_id
  LEFT JOIN crm.usuarios c ON c.id = p_id;

  IF v_email IS NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = p_id;
  END IF;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Não encontrei e-mail para este usuário.';
  END IF;

  INSERT INTO crm.usuarios (
    id, nome, email, tipo_usuario, status_convite,
    horario_acesso_inicio, horario_acesso_fim, titulo, atualizado_em
  )
  VALUES (
    p_id,
    COALESCE(NULLIF(btrim(v_nome), ''), split_part(v_email, '@', 1)),
    v_email,
    v_tipo,
    v_status,
    v_inicio,
    v_fim,
    NULLIF(btrim(COALESCE(p_titulo, '')), ''),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
    SET tipo_usuario = EXCLUDED.tipo_usuario,
        status_convite = EXCLUDED.status_convite,
        horario_acesso_inicio = EXCLUDED.horario_acesso_inicio,
        horario_acesso_fim = EXCLUDED.horario_acesso_fim,
        titulo = COALESCE(EXCLUDED.titulo, crm.usuarios.titulo),
        nome = COALESCE(EXCLUDED.nome, crm.usuarios.nome),
        email = COALESCE(EXCLUDED.email, crm.usuarios.email),
        atualizado_em = NOW();

  DELETE FROM crm.user_roles WHERE user_id = p_id;

  IF p_roles IS NOT NULL THEN
    FOREACH v_role IN ARRAY p_roles LOOP
      v_role := lower(btrim(v_role));
      IF v_role IN ('admin', 'vendedor', 'marketing', 'projetista', 'projetista_admin') THEN
        INSERT INTO crm.user_roles (user_id, role)
        VALUES (p_id, v_role::selletos_crm_app_role)
        ON CONFLICT (user_id, role) DO NOTHING;
      END IF;
    END LOOP;
  END IF;
END;
$function$;

-- public.movelaria_buscar_contrato
CREATE OR REPLACE FUNCTION public.movelaria_buscar_contrato(p_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
      SELECT
        to_jsonb(c) ||
        jsonb_build_object(
          'variaveis',
          COALESCE(
            (SELECT jsonb_agg(to_jsonb(v) ORDER BY v.ordem, v.nome)
             FROM crm.contratos_variaveis v),
            '[]'::jsonb
          )
        )
      FROM crm.contratos c WHERE c.id = p_id;
    $function$;

-- public.movelaria_criar_conta_pagar_pontua_garbo
CREATE OR REPLACE FUNCTION public.movelaria_criar_conta_pagar_pontua_garbo(p_liberacao_id uuid, p_prestador_id uuid, p_lead_id integer, p_valor_comissao numeric)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
DECLARE
  v_arquiteto TEXT;
  v_lead_nome TEXT;
  v_descricao TEXT;
  v_valor NUMERIC(12, 2);
  v_conta_id UUID;
  v_obs TEXT;
BEGIN
  IF p_liberacao_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_valor := ROUND(COALESCE(p_valor_comissao, 0)::NUMERIC, 2);
  IF v_valor <= 0 THEN
    RETURN NULL;
  END IF;

  -- Já existe conta ligada a esta liberação?
  SELECT id INTO v_conta_id
  FROM movelaria_contas_pagar
  WHERE observacao LIKE '%pontua_liberacao:' || p_liberacao_id::TEXT || '%'
  LIMIT 1;

  IF v_conta_id IS NOT NULL THEN
    RETURN v_conta_id;
  END IF;

  SELECT NULLIF(btrim(u.nome), '') INTO v_arquiteto
  FROM crm.usuarios u
  WHERE u.id = p_prestador_id;

  SELECT NULLIF(btrim(l.nome), '') INTO v_lead_nome
  FROM crm.leads l
  WHERE l.id = p_lead_id;

  v_arquiteto := COALESCE(v_arquiteto, 'Arquiteto');
  v_descricao := v_arquiteto || ' — Pontua Garbo';
  v_obs := 'Lead: ' || COALESCE(v_lead_nome, '#' || p_lead_id::TEXT)
        || E'\npontua_liberacao:' || p_liberacao_id::TEXT;

  INSERT INTO movelaria_contas_pagar (
    fornecedor_nome,
    descricao,
    observacao,
    valor_total,
    numero_parcela,
    total_parcelas,
    valor_parcela,
    data_vencimento,
    status,
    valor_pago,
    grupo_lancamento_id
  ) VALUES (
    v_arquiteto,
    v_descricao,
    v_obs,
    v_valor,
    1,
    1,
    v_valor,
    CURRENT_DATE,
    'pendente',
    0,
    gen_random_uuid()
  )
  RETURNING id INTO v_conta_id;

  RETURN v_conta_id;
END;
$function$;

-- public.movelaria_criar_markup_orcamento_lead
CREATE OR REPLACE FUNCTION public.movelaria_criar_markup_orcamento_lead(p_lead_id text, p_titulo text, p_linhas jsonb)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
DECLARE
  v_id UUID;
  v_linhas JSONB;
  v_sum NUMERIC;
  v_fator NUMERIC;
  v_ajustado NUMERIC;
  v_modulos JSONB;
BEGIN
  IF NOT movelaria_usuario_tem_qualquer_perfil(ARRAY['administrador', 'financeiro']) THEN
    RAISE EXCEPTION 'Acesso negado: somente administrador ou financeiro criam markup.';
  END IF;

  IF p_lead_id IS NULL OR btrim(p_lead_id) = '' THEN
    RAISE EXCEPTION 'Lead obrigatório.';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      (elem
        || jsonb_build_object(
          'quantidade', COALESCE((elem->>'quantidade')::NUMERIC, 0),
          'valor_unitario', COALESCE((elem->>'valor_unitario')::NUMERIC, 0),
          'valor_total', ROUND(
            COALESCE((elem->>'quantidade')::NUMERIC, 0)
            * COALESCE((elem->>'valor_unitario')::NUMERIC, 0)
          , 2),
          'ativo', COALESCE((elem->>'ativo')::BOOLEAN, true)
        )
      )
    ),
    '[]'::JSONB
  )
  INTO v_linhas
  FROM jsonb_array_elements(COALESCE(p_linhas, '[]'::JSONB)) AS elem;

  SELECT COALESCE(SUM(
    CASE
      WHEN COALESCE((elem->>'ativo')::BOOLEAN, true)
        THEN COALESCE((elem->>'valor_total')::NUMERIC, 0)
      ELSE 0
    END
  ), 0)
  INTO v_sum
  FROM jsonb_array_elements(v_linhas) AS elem;

  SELECT COALESCE(fator_sobras, 1) INTO v_fator
  FROM crm.markup_config
  LIMIT 1;

  v_ajustado := ROUND(v_sum * COALESCE(v_fator, 1), 2);
  v_modulos := jsonb_build_object(
    'materiais', jsonb_build_object('linhas', v_linhas),
    'totais', jsonb_build_object(
      'custo_materiais', v_sum,
      'custo_materiais_ajustado', v_ajustado,
      'custo_servicos', 0,
      'custo_despesas', 0,
      'preco_final', 0
    )
  );

  INSERT INTO crm.markup_orcamentos (
    lead_id, titulo, status, modulos, preco_final, atualizado_em
  )
  VALUES (
    p_lead_id::BIGINT,
    COALESCE(NULLIF(btrim(p_titulo), ''), 'Pedido de materiais'),
    'rascunho',
    v_modulos,
    0,
    NOW()
  )
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- public.movelaria_criar_obra_de_orcamento
CREATE OR REPLACE FUNCTION public.movelaria_criar_obra_de_orcamento(p_orcamento_id uuid, p_cliente_id uuid, p_cliente_nome text, p_lead_id text DEFAULT NULL::text, p_lousa text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
DECLARE
  v_id UUID;
  v_lead BIGINT;
BEGIN
  INSERT INTO movelaria_obras (
    origem_orcamento_id, origem_lead_id,
    cliente_id, cliente_nome, lousa, status_kanban
  ) VALUES (
    p_orcamento_id, p_lead_id,
    p_cliente_id, p_cliente_nome, p_lousa, 'datas_em_aberto'
  )
  RETURNING id INTO v_id;

  BEGIN
    IF p_lead_id IS NOT NULL AND btrim(p_lead_id) <> '' THEN
      v_lead := p_lead_id::BIGINT;
      PERFORM public.movelaria_criar_obra_producao(v_id, v_lead);
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'obra_producao não criada: %', SQLERRM;
  END;

  RETURN v_id;
END;
$function$;

-- public.movelaria_criar_obra_producao
CREATE OR REPLACE FUNCTION public.movelaria_criar_obra_producao(p_obra_id uuid, p_lead_id bigint)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
DECLARE
  v_id UUID;
  v_stage UUID;
BEGIN
  SELECT id INTO v_id FROM crm.obra_producao WHERE obra_id = p_obra_id;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT id INTO v_stage
  FROM crm.producao_stages
  WHERE ativo = true
  ORDER BY ordem ASC
  LIMIT 1;

  IF v_stage IS NULL THEN
    RAISE EXCEPTION 'Nenhuma coluna de produção configurada';
  END IF;

  INSERT INTO crm.obra_producao (obra_id, lead_id, stage_id)
  VALUES (p_obra_id, p_lead_id, v_stage)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- public.movelaria_crm_agenda_boot
CREATE OR REPLACE FUNCTION public.movelaria_crm_agenda_boot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_config JSONB; v_reunioes JSONB; v_leads JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_venda() THEN RAISE EXCEPTION 'Acesso negado à agenda comercial'; END IF;
  SELECT to_jsonb(c) INTO v_config FROM crm.agenda_config c LIMIT 1;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'titulo', r.titulo, 'descricao', r.descricao,
    'data_hora_inicio', r.data_hora_inicio, 'data_hora_fim', r.data_hora_fim,
    'duracao_minutos', r.duracao_minutos, 'convidado_nome', r.convidado_nome,
    'convidado_whatsapp', r.convidado_whatsapp, 'convidado_email', r.convidado_email,
    'status', r.status, 'tipo', r.tipo, 'lead_id', r.lead_id, 'lead_nome', l.nome,
    'observacoes', r.observacoes, 'link_video_conferencia', r.link_video_conferencia
  ) ORDER BY r.data_hora_inicio DESC), '[]'::JSONB)
  INTO v_reunioes
  FROM crm.agenda_reunioes r
  LEFT JOIN crm.leads l ON l.id = r.lead_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', l.id, 'nome', l.nome) ORDER BY l.nome), '[]'::JSONB)
  INTO v_leads FROM crm.leads l;
  RETURN jsonb_build_object(
    'config', COALESCE(v_config, '{}'::JSONB),
    'reunioes', COALESCE(v_reunioes, '[]'::JSONB),
    'leads', COALESCE(v_leads, '[]'::JSONB)
  );
END;
$function$;

-- public.movelaria_crm_agenda_criar
CREATE OR REPLACE FUNCTION public.movelaria_crm_agenda_criar(p_titulo text, p_inicio timestamp with time zone, p_fim timestamp with time zone, p_convidado text, p_whatsapp text, p_lead_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id UUID; v_row JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_venda() THEN RAISE EXCEPTION 'Acesso negado à agenda comercial'; END IF;
  IF NULLIF(BTRIM(p_titulo), '') IS NULL OR p_inicio IS NULL THEN
    RAISE EXCEPTION 'Título e horário são obrigatórios';
  END IF;
  INSERT INTO crm.agenda_reunioes (
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
  ) INTO v_row FROM crm.agenda_reunioes r WHERE r.id = v_id;
  RETURN v_row;
END;
$function$;

-- public.movelaria_crm_agenda_publica
CREATE OR REPLACE FUNCTION public.movelaria_crm_agenda_publica(p_slug text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cfg crm.agenda_config%ROWTYPE;
  v_ocupados JSONB;
BEGIN
  SELECT * INTO v_cfg
  FROM crm.agenda_config
  WHERE slug = NULLIF(btrim(p_slug), '') AND ativo = TRUE
  LIMIT 1;
  IF v_cfg.id IS NULL THEN
    RAISE EXCEPTION 'Agenda não encontrada';
  END IF;

  SELECT COALESCE(jsonb_agg(r.data_hora_inicio ORDER BY r.data_hora_inicio), '[]'::JSONB)
  INTO v_ocupados
  FROM crm.agenda_reunioes r
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
$function$;

-- public.movelaria_crm_agenda_publica_criar
CREATE OR REPLACE FUNCTION public.movelaria_crm_agenda_publica_criar(p_slug text, p_nome text, p_whatsapp text, p_inicio timestamp with time zone)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_cfg crm.agenda_config%ROWTYPE;
  v_id UUID;
  v_fim TIMESTAMPTZ;
  v_digits TEXT := regexp_replace(COALESCE(p_whatsapp, ''), '\D', '', 'g');
BEGIN
  SELECT * INTO v_cfg
  FROM crm.agenda_config
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
    SELECT 1 FROM crm.agenda_reunioes r
    WHERE r.status IS DISTINCT FROM 'cancelado'
      AND r.data_hora_inicio = p_inicio
  ) THEN
    RAISE EXCEPTION 'Este horário já foi reservado';
  END IF;

  v_fim := p_inicio + make_interval(mins => GREATEST(15, v_cfg.duracao_minutos));

  INSERT INTO crm.agenda_reunioes (
    titulo, data_hora_inicio, data_hora_fim, duracao_minutos,
    convidado_nome, convidado_whatsapp, status, tipo
  ) VALUES (
    'Agendamento: ' || btrim(p_nome),
    p_inicio, v_fim, GREATEST(15, v_cfg.duracao_minutos),
    btrim(p_nome), v_digits, 'pendente', 'publico'
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id, 'inicio', p_inicio);
END;
$function$;

-- public.movelaria_crm_agenda_salvar
CREATE OR REPLACE FUNCTION public.movelaria_crm_agenda_salvar(p_id uuid, p_titulo text, p_inicio timestamp with time zone, p_fim timestamp with time zone, p_convidado text, p_whatsapp text, p_status text, p_lead_id bigint, p_observacoes text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_row JSONB; v_status TEXT;
BEGIN
  IF NOT public.movelaria_crm_pode_venda() THEN RAISE EXCEPTION 'Acesso negado à agenda comercial'; END IF;
  IF p_id IS NULL OR NULLIF(BTRIM(p_titulo), '') IS NULL OR p_inicio IS NULL THEN
    RAISE EXCEPTION 'Título e horário são obrigatórios';
  END IF;
  v_status := COALESCE(NULLIF(BTRIM(p_status), ''), 'pendente');
  UPDATE crm.agenda_reunioes SET
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
  ) INTO v_row FROM crm.agenda_reunioes r WHERE r.id = p_id;
  RETURN v_row;
END;
$function$;

-- public.movelaria_crm_automacoes_boot
CREATE OR REPLACE FUNCTION public.movelaria_crm_automacoes_boot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  INTO v_atalhos FROM crm.atalhos a;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', n.id, 'telefone', n."numeroTelefone"
  ) ORDER BY n.id DESC), '[]'::JSONB)
  INTO v_neg FROM crm.negativacao_numeros n;

  RETURN jsonb_build_object(
    'atalhos', COALESCE(v_atalhos, '[]'::JSONB),
    'negativados', COALESCE(v_neg, '[]'::JSONB)
  );
END;
$function$;

-- public.movelaria_crm_automacoes_salvar_atalho
CREATE OR REPLACE FUNCTION public.movelaria_crm_automacoes_salvar_atalho(p_id bigint, p_titulo text, p_mensagem text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id BIGINT;
BEGIN
  IF NOT public.movelaria_crm_pode_automacao_mkt() THEN
    RAISE EXCEPTION 'Acesso negado às automações';
  END IF;
  IF NULLIF(btrim(p_titulo), '') IS NULL THEN RAISE EXCEPTION 'Informe o título'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO crm.atalhos (titulo, mensagem, user_auth, all_can_see)
    VALUES (btrim(p_titulo), COALESCE(p_mensagem, ''), auth.uid(), TRUE)
    RETURNING id INTO v_id;
  ELSE
    UPDATE crm.atalhos SET titulo = btrim(p_titulo), mensagem = COALESCE(p_mensagem, '')
    WHERE id = p_id RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END;
$function$;

-- public.movelaria_crm_automacoes_salvar_negativado
CREATE OR REPLACE FUNCTION public.movelaria_crm_automacoes_salvar_negativado(p_telefone bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id BIGINT;
BEGIN
  IF NOT (public.movelaria_crm_colaborador_roles() && ARRAY['admin', 'vendedor']::TEXT[]) THEN
    RAISE EXCEPTION 'Acesso negado à negativação';
  END IF;
  IF p_telefone IS NULL THEN RAISE EXCEPTION 'Informe o telefone'; END IF;
  INSERT INTO crm.negativacao_numeros ("numeroTelefone") VALUES (p_telefone)
  RETURNING id INTO v_id;
  RETURN jsonb_build_object('id', v_id);
END;
$function$;

-- public.movelaria_crm_chat_boot
CREATE OR REPLACE FUNCTION public.movelaria_crm_chat_boot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  INTO v_contatos FROM crm.chat_contatos c;

  RETURN jsonb_build_object('contatos', COALESCE(v_contatos, '[]'::JSONB));
END;
$function$;

-- public.movelaria_crm_colaborador_roles
CREATE OR REPLACE FUNCTION public.movelaria_crm_colaborador_roles()
 RETURNS text[]
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo   TEXT;
  v_status TEXT;
  v_roles  TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN RETURN '{}'::TEXT[]; END IF;
  SELECT c.tipo_usuario, c.status_convite INTO v_tipo, v_status
  FROM crm.usuarios c WHERE c.id = auth.uid();
  IF v_tipo IS DISTINCT FROM 'colaborador' OR v_status IS DISTINCT FROM 'ATIVO' THEN
    RETURN '{}'::TEXT[];
  END IF;
  SELECT COALESCE(array_agg(r.role::TEXT), '{}'::TEXT[])
  INTO v_roles
  FROM crm.user_roles r
  WHERE r.user_id = auth.uid();
  RETURN v_roles;
END;
$function$;

-- public.movelaria_crm_contrato_criar
CREATE OR REPLACE FUNCTION public.movelaria_crm_contrato_criar(p_identificador text, p_cliente_nome text, p_lead_id bigint, p_campos jsonb, p_conteudo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_id UUID; v_row JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_venda() THEN RAISE EXCEPTION 'Acesso negado aos contratos'; END IF;
  INSERT INTO crm.contratos (identificador, cliente_nome, status, lead_id, campos_valores, conteudo_final, criado_por)
  VALUES (
    COALESCE(NULLIF(BTRIM(p_identificador), ''), 'Rascunho'),
    COALESCE(NULLIF(BTRIM(p_cliente_nome), ''), 'Rascunho'),
    'rascunho', p_lead_id, COALESCE(p_campos, '{}'::JSONB), COALESCE(p_conteudo, ''), auth.uid()
  ) RETURNING id INTO v_id;
  SELECT jsonb_build_object(
    'id', c.id, 'identificador', c.identificador, 'cliente_nome', c.cliente_nome,
    'status', c.status, 'lead_id', c.lead_id, 'campos_valores', COALESCE(c.campos_valores, '{}'::JSONB),
    'conteudo_final', COALESCE(c.conteudo_final, ''), 'created_at', c.created_at
  ) INTO v_row FROM crm.contratos c WHERE c.id = v_id;
  RETURN v_row;
END;
$function$;

-- public.movelaria_crm_contrato_salvar
CREATE OR REPLACE FUNCTION public.movelaria_crm_contrato_salvar(p_id uuid, p_identificador text, p_cliente_nome text, p_status text, p_lead_id bigint, p_campos jsonb, p_conteudo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_row JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_venda() THEN RAISE EXCEPTION 'Acesso negado aos contratos'; END IF;
  IF p_id IS NULL OR NULLIF(BTRIM(p_identificador), '') IS NULL THEN
    RAISE EXCEPTION 'Identificador é obrigatório';
  END IF;
  UPDATE crm.contratos SET
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
  ) INTO v_row FROM crm.contratos c WHERE c.id = p_id;
  RETURN v_row;
END;
$function$;

-- public.movelaria_crm_contratos_boot
CREATE OR REPLACE FUNCTION public.movelaria_crm_contratos_boot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FROM crm.contratos c
  LEFT JOIN crm.leads l ON l.id = c.lead_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', m.id, 'nome', m.nome, 'conteudo', m.conteudo, 'ativo', m.ativo
  ) ORDER BY m.nome), '[]'::JSONB)
  INTO v_modelos FROM crm.contratos_modelos m;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', v.id, 'nome', v.nome, 'label', v.label, 'tipo', v.tipo,
    'obrigatorio', v.obrigatorio, 'ordem', v.ordem
  ) ORDER BY v.ordem, v.nome), '[]'::JSONB)
  INTO v_variaveis FROM crm.contratos_variaveis v;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', l.id, 'nome', l.nome) ORDER BY l.nome), '[]'::JSONB)
  INTO v_leads FROM crm.leads l;

  RETURN jsonb_build_object(
    'contratos', COALESCE(v_contratos, '[]'::JSONB),
    'modelos', COALESCE(v_modelos, '[]'::JSONB),
    'variaveis', COALESCE(v_variaveis, '[]'::JSONB),
    'leads', COALESCE(v_leads, '[]'::JSONB)
  );
END;
$function$;

-- public.movelaria_crm_criar_lead
CREATE OR REPLACE FUNCTION public.movelaria_crm_criar_lead(p_nome text, p_telefone text, p_origem text)
 RETURNS bigint
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FROM crm.pipeline_custom_stages s
  WHERE s.ativo IS TRUE
  ORDER BY s.ordem, s.nome
  LIMIT 1;

  INSERT INTO crm.leads (nome, telefone, origem, status, vendedor_responsavel_id)
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
$function$;

-- public.movelaria_crm_eventos_boot
CREATE OR REPLACE FUNCTION public.movelaria_crm_eventos_boot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  INTO v_eventos FROM crm.eventos e;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.id, 'evento_id', p.evento_id, 'secao', p.secao,
    'titulo', p.titulo, 'corpo', p.corpo, 'ordem', p.ordem
  ) ORDER BY p.ordem, p.titulo), '[]'::JSONB)
  INTO v_paginas FROM crm.evento_paginas p;

  RETURN jsonb_build_object(
    'eventos', COALESCE(v_eventos, '[]'::JSONB),
    'paginas', COALESCE(v_paginas, '[]'::JSONB)
  );
END;
$function$;

-- public.movelaria_crm_gastos_boot
CREATE OR REPLACE FUNCTION public.movelaria_crm_gastos_boot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  INTO v_fontes FROM crm.mkt_fontes f;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id, 'fonte_id', s.fonte_id, 'nome', s.nome, 'descricao', s.descricao, 'ativo', COALESCE(s.ativo, TRUE), 'ordem', s.ordem
  ) ORDER BY s.ordem, s.nome), '[]'::JSONB)
  INTO v_subs FROM crm.mkt_sub_fontes s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'sub_fonte_id', c.sub_fonte_id, 'nome', c.nome, 'tipo', c.tipo, 'ordem', c.ordem
  ) ORDER BY c.ordem, c.nome), '[]'::JSONB)
  INTO v_cols FROM crm.mkt_config_colunas c;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id, 'coluna_id', l.coluna_id, 'data', l.data, 'valor_numerico', l.valor_numerico, 'observacao', l.observacao
  ) ORDER BY l.data DESC), '[]'::JSONB)
  INTO v_lanc FROM crm.mkt_lancamentos l;

  RETURN jsonb_build_object(
    'fontes', COALESCE(v_fontes, '[]'::JSONB),
    'sub_fontes', COALESCE(v_subs, '[]'::JSONB),
    'colunas', COALESCE(v_cols, '[]'::JSONB),
    'lancamentos', COALESCE(v_lanc, '[]'::JSONB)
  );
END;
$function$;

-- public.movelaria_crm_gastos_salvar_fonte
CREATE OR REPLACE FUNCTION public.movelaria_crm_gastos_salvar_fonte(p_id uuid, p_nome text, p_cor text DEFAULT '#f2d892'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
  v_ordem INT;
BEGIN
  IF NOT public.movelaria_crm_pode_gastos() THEN
    RAISE EXCEPTION 'Acesso negado ao controle de gastos';
  END IF;
  IF NULLIF(btrim(p_nome), '') IS NULL THEN RAISE EXCEPTION 'Informe o nome da fonte'; END IF;
  IF p_id IS NULL THEN
    SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_ordem FROM crm.mkt_fontes;
    INSERT INTO crm.mkt_fontes (nome, cor, icone, ativo, ordem)
    VALUES (btrim(p_nome), COALESCE(NULLIF(btrim(p_cor), ''), '#f2d892'), 'wallet', TRUE, v_ordem)
    RETURNING id INTO v_id;
  ELSE
    UPDATE crm.mkt_fontes SET nome = btrim(p_nome), cor = COALESCE(NULLIF(btrim(p_cor), ''), cor), atualizado_em = NOW()
    WHERE id = p_id RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END;
$function$;

-- public.movelaria_crm_gastos_salvar_lancamento
CREATE OR REPLACE FUNCTION public.movelaria_crm_gastos_salvar_lancamento(p_id uuid, p_coluna_id uuid, p_data date, p_valor numeric, p_observacao text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.movelaria_crm_pode_gastos() THEN
    RAISE EXCEPTION 'Acesso negado ao controle de gastos';
  END IF;
  IF p_coluna_id IS NULL OR p_data IS NULL THEN RAISE EXCEPTION 'Informe a coluna e a data'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO crm.mkt_lancamentos (coluna_id, data, valor_numerico, observacao)
    VALUES (p_coluna_id, p_data, COALESCE(p_valor, 0), NULLIF(btrim(p_observacao), ''))
    RETURNING id INTO v_id;
  ELSE
    UPDATE crm.mkt_lancamentos
    SET valor_numerico = COALESCE(p_valor, 0), observacao = NULLIF(btrim(p_observacao), ''), atualizado_em = NOW()
    WHERE id = p_id RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END;
$function$;

-- public.movelaria_crm_gastos_salvar_subfonte
CREATE OR REPLACE FUNCTION public.movelaria_crm_gastos_salvar_subfonte(p_id uuid, p_fonte_id uuid, p_nome text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_ordem FROM crm.mkt_sub_fontes WHERE fonte_id = p_fonte_id;
    INSERT INTO crm.mkt_sub_fontes (fonte_id, nome, ativo, ordem)
    VALUES (p_fonte_id, btrim(p_nome), TRUE, v_ordem)
    RETURNING id INTO v_id;
    INSERT INTO crm.mkt_config_colunas (sub_fonte_id, nome, tipo, ordem, largura, editavel)
    VALUES (v_id, 'Valor', 'currency', 1, 140, TRUE)
    RETURNING id INTO v_col;
  ELSE
    UPDATE crm.mkt_sub_fontes SET nome = btrim(p_nome), atualizado_em = NOW()
    WHERE id = p_id RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END;
$function$;

-- public.movelaria_crm_lead_ia_boot
CREATE OR REPLACE FUNCTION public.movelaria_crm_lead_ia_boot(p_lead_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    FROM crm.lead_ai_analises a
    WHERE a.lead_id = p_lead_id
    ORDER BY a.criado_em DESC
    LIMIT 12
  ) x;

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::JSONB)
  INTO v_renders
  FROM (
    SELECT r.id, r.output_public_url, r.vision_model, r.image_model, r.criado_em, r.edit_notas
    FROM crm.lead_ai_renders r
    WHERE r.lead_id = p_lead_id
    ORDER BY r.criado_em DESC
    LIMIT 12
  ) x;

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::JSONB)
  INTO v_chat
  FROM (
    SELECT m.id, m.role, m.content, m.modelo, m.criado_em
    FROM crm.lead_ai_chat_messages m
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
$function$;

-- public.movelaria_crm_lousa_boot
CREATE OR REPLACE FUNCTION public.movelaria_crm_lousa_boot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
      (SELECT COUNT(*)::INT FROM crm.lead_whiteboard_drawings d WHERE d.lead_id = i.lead_id) AS tracos
    FROM crm.lead_whiteboard_images i
    LEFT JOIN crm.leads l ON l.id = i.lead_id
    GROUP BY i.lead_id, l.nome
  ) q;
  RETURN jsonb_build_object('leads', COALESCE(v_leads, '[]'::JSONB));
END;
$function$;

-- public.movelaria_crm_lousa_obter
CREATE OR REPLACE FUNCTION public.movelaria_crm_lousa_obter(p_lead_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE v_lead TEXT; v_images JSONB; v_drawings JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_pipeline() THEN RAISE EXCEPTION 'Acesso negado à lousa do lead'; END IF;
  IF p_lead_id IS NULL THEN RAISE EXCEPTION 'Lead inválido'; END IF;
  SELECT nome INTO v_lead FROM crm.leads WHERE id = p_lead_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', i.id, 'file_url', i.file_url, 'file_name', i.file_name,
    'position_x', i.position_x, 'position_y', i.position_y,
    'width', i.width, 'height', i.height, 'z_index', i.z_index
  ) ORDER BY i.z_index, i.criado_em), '[]'::JSONB)
  INTO v_images FROM crm.lead_whiteboard_images i WHERE i.lead_id = p_lead_id;
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id, 'path_data', d.path_data, 'cor', d.cor, 'stroke_width', d.stroke_width
  ) ORDER BY d.criado_em), '[]'::JSONB)
  INTO v_drawings FROM crm.lead_whiteboard_drawings d WHERE d.lead_id = p_lead_id;
  RETURN jsonb_build_object(
    'lead_id', p_lead_id, 'lead_nome', v_lead,
    'images', COALESCE(v_images, '[]'::JSONB),
    'drawings', COALESCE(v_drawings, '[]'::JSONB)
  );
END;
$function$;

-- public.movelaria_crm_marketing_boot
CREATE OR REPLACE FUNCTION public.movelaria_crm_marketing_boot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  INTO v_cols FROM crm.marketing_columns c;

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
  INTO v_cards FROM crm.marketing_content_cards x;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', f.id, 'nome', f.nome, 'descricao', f.descricao, 'total', COALESCE(cnt.n, 0)
  ) ORDER BY f.nome), '[]'::JSONB)
  INTO v_folders
  FROM crm.marketing_media_folders f
  LEFT JOIN (
    SELECT folder_id, COUNT(*)::INT AS n
    FROM crm.marketing_medias
    GROUP BY folder_id
  ) cnt ON cnt.folder_id = f.id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', n.id, 'titulo', n.titulo, 'conteudo', n.conteudo,
    'classificacao', n.classificacao, 'enviado_producao', COALESCE(n.enviado_producao, FALSE),
    'card_id', n.card_id, 'criado_em', n.criado_em
  ) ORDER BY n.criado_em DESC), '[]'::JSONB)
  INTO v_nodes FROM crm.marketing_planning_nodes n;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', t.id, 'titulo', t.titulo, 'descricao', t.descricao,
    'status', t.status, 'data_agendada', t.data_agendada, 'hora_agendada', t.hora_agendada,
    'content_card_id', t.content_card_id
  ) ORDER BY t.data_agendada NULLS LAST, t.titulo), '[]'::JSONB)
  INTO v_tasks FROM crm.marketing_tasks t;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', a.id, 'nome', a.nome, 'slug', a.slug, 'ativo', COALESCE(a.ativo, TRUE)
  ) ORDER BY a.ordem, a.nome), '[]'::JSONB)
  INTO v_agents FROM crm.marketing_ai_agents a;

  RETURN jsonb_build_object(
    'colunas', COALESCE(v_cols, '[]'::JSONB),
    'cards', COALESCE(v_cards, '[]'::JSONB),
    'pastas', COALESCE(v_folders, '[]'::JSONB),
    'sem_pasta', (SELECT COUNT(*)::INT FROM crm.marketing_medias WHERE folder_id IS NULL),
    'total_midias', (SELECT COUNT(*)::INT FROM crm.marketing_medias),
    'nodes', COALESCE(v_nodes, '[]'::JSONB),
    'tarefas', COALESCE(v_tasks, '[]'::JSONB),
    'agentes', COALESCE(v_agents, '[]'::JSONB)
  );
END;
$function$;

-- public.movelaria_crm_marketing_excluir_card
CREATE OR REPLACE FUNCTION public.movelaria_crm_marketing_excluir_card(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.movelaria_crm_pode_marketing() THEN
    RAISE EXCEPTION 'Acesso negado ao marketing';
  END IF;
  DELETE FROM crm.marketing_content_cards WHERE id = p_id;
  RETURN jsonb_build_object('ok', TRUE);
END;
$function$;

-- public.movelaria_crm_marketing_medias
CREATE OR REPLACE FUNCTION public.movelaria_crm_marketing_medias(p_folder_id uuid DEFAULT NULL::uuid, p_busca text DEFAULT NULL::text, p_limit integer DEFAULT 48, p_offset integer DEFAULT 0, p_sem_pasta boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FROM crm.marketing_medias m
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
    FROM crm.marketing_medias m
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
$function$;

-- public.movelaria_crm_marketing_mover_card
CREATE OR REPLACE FUNCTION public.movelaria_crm_marketing_mover_card(p_id uuid, p_column_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.movelaria_crm_pode_marketing() THEN
    RAISE EXCEPTION 'Acesso negado ao marketing';
  END IF;
  UPDATE crm.marketing_content_cards
  SET column_id = p_column_id, atualizado_em = NOW()
  WHERE id = p_id;
  RETURN jsonb_build_object('ok', TRUE);
END;
$function$;

-- public.movelaria_crm_marketing_salvar_card
CREATE OR REPLACE FUNCTION public.movelaria_crm_marketing_salvar_card(p_id uuid, p_titulo text, p_script_copy text, p_column_id uuid, p_urgente boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    FROM crm.marketing_content_cards WHERE column_id = p_column_id;
    INSERT INTO crm.marketing_content_cards (titulo, script_copy, column_id, urgente, ordem)
    VALUES (btrim(p_titulo), NULLIF(btrim(p_script_copy), ''), p_column_id, COALESCE(p_urgente, FALSE), v_ordem)
    RETURNING id INTO v_id;
  ELSE
    UPDATE crm.marketing_content_cards
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
$function$;

-- public.movelaria_crm_marketing_salvar_coluna
CREATE OR REPLACE FUNCTION public.movelaria_crm_marketing_salvar_coluna(p_id uuid, p_nome text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
  v_ordem INT;
BEGIN
  IF NOT public.movelaria_crm_pode_marketing() THEN
    RAISE EXCEPTION 'Acesso negado ao marketing';
  END IF;
  IF NULLIF(btrim(p_nome), '') IS NULL THEN RAISE EXCEPTION 'Informe o nome da coluna'; END IF;

  IF p_id IS NULL THEN
    SELECT COALESCE(MAX(ordem), 0) + 1 INTO v_ordem FROM crm.marketing_columns;
    INSERT INTO crm.marketing_columns (nome, ordem)
    VALUES (btrim(p_nome), v_ordem)
    RETURNING id INTO v_id;
  ELSE
    UPDATE crm.marketing_columns SET nome = btrim(p_nome), atualizado_em = NOW()
    WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END;
$function$;

-- public.movelaria_crm_marketing_salvar_node
CREATE OR REPLACE FUNCTION public.movelaria_crm_marketing_salvar_node(p_id uuid, p_titulo text, p_conteudo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.movelaria_crm_pode_marketing() THEN
    RAISE EXCEPTION 'Acesso negado ao marketing';
  END IF;
  IF NULLIF(btrim(p_titulo), '') IS NULL THEN RAISE EXCEPTION 'Informe o título'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO crm.marketing_planning_nodes (titulo, conteudo, classificacao, position_x, position_y)
    VALUES (btrim(p_titulo), NULLIF(btrim(p_conteudo), ''), 'planejamento_central', 40, 40)
    RETURNING id INTO v_id;
  ELSE
    UPDATE crm.marketing_planning_nodes
    SET titulo = btrim(p_titulo), conteudo = NULLIF(btrim(p_conteudo), ''), atualizado_em = NOW()
    WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END;
$function$;

-- public.movelaria_crm_marketing_salvar_tarefa
CREATE OR REPLACE FUNCTION public.movelaria_crm_marketing_salvar_tarefa(p_id uuid, p_titulo text, p_data date, p_status text DEFAULT 'pendente'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.movelaria_crm_pode_marketing() THEN
    RAISE EXCEPTION 'Acesso negado ao marketing';
  END IF;
  IF NULLIF(btrim(p_titulo), '') IS NULL THEN RAISE EXCEPTION 'Informe o título'; END IF;
  IF p_data IS NULL THEN RAISE EXCEPTION 'Informe a data'; END IF;
  IF p_id IS NULL THEN
    INSERT INTO crm.marketing_tasks (titulo, data_agendada, status, criado_por, destinatario_id, tipo)
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
    UPDATE crm.marketing_tasks
    SET titulo = btrim(p_titulo), data_agendada = p_data,
        status = COALESCE(NULLIF(btrim(p_status), ''), status), atualizado_em = NOW()
    WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;
  RETURN jsonb_build_object('id', v_id);
END;
$function$;

-- public.movelaria_crm_markup_boot
CREATE OR REPLACE FUNCTION public.movelaria_crm_markup_boot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FROM crm.markup_orcamentos m
  LEFT JOIN crm.leads l ON l.id = m.lead_id;

  SELECT to_jsonb(c)
  INTO v_config
  FROM crm.markup_config c
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
  FROM crm.markup_categorias c;

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
  FROM crm.markup_produtos p
  LEFT JOIN crm.markup_categorias c ON c.id = p.categoria_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'nome', d.nome,
    'valor_padrao', d.valor_padrao,
    'ordem', d.ordem,
    'ativo', d.ativo
  ) ORDER BY d.ordem, d.nome), '[]'::JSONB)
  INTO v_despesas
  FROM crm.markup_despesa_templates d;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', s.id,
    'nome', s.nome,
    'valor_hora_padrao', s.valor_hora_padrao,
    'ordem', s.ordem,
    'ativo', s.ativo
  ) ORDER BY s.ordem, s.nome), '[]'::JSONB)
  INTO v_servicos
  FROM crm.markup_servico_templates s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'nome', l.nome
  ) ORDER BY l.nome), '[]'::JSONB)
  INTO v_leads
  FROM crm.leads l;

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
$function$;

-- public.movelaria_crm_markup_criar
CREATE OR REPLACE FUNCTION public.movelaria_crm_markup_criar(p_lead_id bigint, p_titulo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id    UUID;
  v_nome  TEXT;
  v_row   JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_markup() THEN
    RAISE EXCEPTION 'Acesso negado ao markup';
  END IF;

  IF p_lead_id IS NOT NULL THEN
    SELECT nome INTO v_nome FROM crm.leads WHERE id = p_lead_id;
  END IF;

  INSERT INTO crm.markup_orcamentos (
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
  FROM crm.markup_orcamentos m
  LEFT JOIN crm.leads l ON l.id = m.lead_id
  WHERE m.id = v_id;

  RETURN v_row;
END;
$function$;

-- public.movelaria_crm_markup_obter
CREATE OR REPLACE FUNCTION public.movelaria_crm_markup_obter(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FROM crm.markup_orcamentos m
  LEFT JOIN crm.leads l ON l.id = m.lead_id
  WHERE m.id = p_id;

  IF v_row IS NULL THEN
    RAISE EXCEPTION 'Markup não encontrado';
  END IF;

  RETURN v_row;
END;
$function$;

-- public.movelaria_crm_markup_resumos
CREATE OR REPLACE FUNCTION public.movelaria_crm_markup_resumos()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    FROM crm.markup_orcamentos m
    WHERE m.lead_id IS NOT NULL
    ORDER BY m.lead_id, m.atualizado_em DESC NULLS LAST
  ) q
  WHERE q.preco_final > 0;

  RETURN COALESCE(v_rows, '[]'::JSONB);
END;
$function$;

-- public.movelaria_crm_markup_salvar
CREATE OR REPLACE FUNCTION public.movelaria_crm_markup_salvar(p_id uuid, p_titulo text, p_status text, p_modulos jsonb, p_observacoes text, p_lead_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  UPDATE crm.markup_orcamentos
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
    UPDATE crm.leads
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
  FROM crm.markup_orcamentos m
  WHERE m.id = p_id;

  RETURN v_row;
END;
$function$;

-- public.movelaria_crm_markup_salvar_categoria
CREATE OR REPLACE FUNCTION public.movelaria_crm_markup_salvar_categoria(p_id uuid, p_nome text, p_ordem integer, p_ativo boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    INSERT INTO crm.markup_categorias (nome, slug, ordem, ativo)
    VALUES (BTRIM(p_nome), v_slug, COALESCE(p_ordem, 0), COALESCE(p_ativo, TRUE));
  ELSE
    UPDATE crm.markup_categorias
    SET nome = BTRIM(p_nome),
        slug = v_slug,
        ordem = COALESCE(p_ordem, ordem),
        ativo = COALESCE(p_ativo, ativo)
    WHERE id = p_id;
  END IF;
END;
$function$;

-- public.movelaria_crm_markup_salvar_config
CREATE OR REPLACE FUNCTION public.movelaria_crm_markup_salvar_config(p_valor_hora numeric, p_fator_sobras numeric, p_margem_lucro numeric, p_percentual_imposto numeric, p_taxas_financeiras numeric, p_custo_frete numeric, p_rodape text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  IF NOT public.movelaria_crm_pode_markup() THEN
    RAISE EXCEPTION 'Acesso negado ao markup';
  END IF;

  SELECT id INTO v_id FROM crm.markup_config ORDER BY atualizado_em DESC NULLS LAST LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO crm.markup_config (
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
    UPDATE crm.markup_config
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
$function$;

-- public.movelaria_crm_markup_salvar_despesa
CREATE OR REPLACE FUNCTION public.movelaria_crm_markup_salvar_despesa(p_id uuid, p_nome text, p_valor_padrao numeric, p_ordem integer, p_ativo boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.movelaria_crm_pode_markup() THEN
    RAISE EXCEPTION 'Acesso negado ao markup';
  END IF;
  IF NULLIF(BTRIM(p_nome), '') IS NULL THEN
    RAISE EXCEPTION 'Nome da despesa é obrigatório';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO crm.markup_despesa_templates (nome, valor_padrao, ordem, ativo)
    VALUES (BTRIM(p_nome), COALESCE(p_valor_padrao, 0), COALESCE(p_ordem, 0), COALESCE(p_ativo, TRUE));
  ELSE
    UPDATE crm.markup_despesa_templates
    SET nome = BTRIM(p_nome),
        valor_padrao = COALESCE(p_valor_padrao, valor_padrao),
        ordem = COALESCE(p_ordem, ordem),
        ativo = COALESCE(p_ativo, ativo)
    WHERE id = p_id;
  END IF;
END;
$function$;

-- public.movelaria_crm_markup_salvar_produto
CREATE OR REPLACE FUNCTION public.movelaria_crm_markup_salvar_produto(p_id uuid, p_categoria_id uuid, p_nome text, p_variacao text, p_preco_unitario numeric, p_unidade text, p_quantidade_padrao numeric, p_ativo boolean, p_ordem integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.movelaria_crm_pode_markup() THEN
    RAISE EXCEPTION 'Acesso negado ao markup';
  END IF;
  IF NULLIF(BTRIM(p_nome), '') IS NULL THEN
    RAISE EXCEPTION 'Nome do produto é obrigatório';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO crm.markup_produtos (
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
    UPDATE crm.markup_produtos
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
$function$;

-- public.movelaria_crm_markup_salvar_servico
CREATE OR REPLACE FUNCTION public.movelaria_crm_markup_salvar_servico(p_id uuid, p_nome text, p_valor_hora numeric, p_ordem integer, p_ativo boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.movelaria_crm_pode_markup() THEN
    RAISE EXCEPTION 'Acesso negado ao markup';
  END IF;
  IF NULLIF(BTRIM(p_nome), '') IS NULL THEN
    RAISE EXCEPTION 'Nome do serviço é obrigatório';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO crm.markup_servico_templates (nome, valor_hora_padrao, ordem, ativo)
    VALUES (BTRIM(p_nome), COALESCE(p_valor_hora, 0), COALESCE(p_ordem, 0), COALESCE(p_ativo, TRUE));
  ELSE
    UPDATE crm.markup_servico_templates
    SET nome = BTRIM(p_nome),
        valor_hora_padrao = COALESCE(p_valor_hora, valor_hora_padrao),
        ordem = COALESCE(p_ordem, ordem),
        ativo = COALESCE(p_ativo, ativo)
    WHERE id = p_id;
  END IF;
END;
$function$;

-- public.movelaria_crm_mover_lead
CREATE OR REPLACE FUNCTION public.movelaria_crm_mover_lead(p_lead_id bigint, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.movelaria_crm_pode_pipeline() THEN
    RAISE EXCEPTION 'Acesso negado ao pipeline comercial';
  END IF;
  IF p_lead_id IS NULL OR NULLIF(BTRIM(p_status), '') IS NULL THEN
    RAISE EXCEPTION 'Lead e etapa são obrigatórios';
  END IF;

  UPDATE crm.leads
  SET status = BTRIM(p_status),
      atualizado_em = NOW()
  WHERE id = p_lead_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Lead não encontrado';
  END IF;
END;
$function$;

-- public.movelaria_crm_notificacao_ler
CREATE OR REPLACE FUNCTION public.movelaria_crm_notificacao_ler(p_id uuid, p_todas boolean DEFAULT false)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.movelaria_crm_pode_comunicacao() THEN
    RAISE EXCEPTION 'Acesso negado às notificações do CRM';
  END IF;
  IF COALESCE(p_todas, FALSE) THEN
    UPDATE crm.notifications SET read = TRUE
    WHERE user_id = auth.uid() AND read = FALSE;
  ELSE
    IF p_id IS NULL THEN RAISE EXCEPTION 'Informe a notificação'; END IF;
    UPDATE crm.notifications SET read = TRUE
    WHERE id = p_id AND user_id = auth.uid();
  END IF;
  RETURN jsonb_build_object('ok', TRUE);
END;
$function$;

-- public.movelaria_crm_notificacoes
CREATE OR REPLACE FUNCTION public.movelaria_crm_notificacoes(p_limit integer DEFAULT 40, p_offset integer DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FROM crm.notifications n
  WHERE n.user_id = auth.uid();

  SELECT COALESCE(jsonb_agg(row_to_json(x)), '[]'::JSONB)
  INTO v_items
  FROM (
    SELECT n.id, n.lead_id, n.vendor_name, n.notification_type, n.message, n.read, n.created_at
    FROM crm.notifications n
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
$function$;

-- public.movelaria_crm_pipeline_boot
CREATE OR REPLACE FUNCTION public.movelaria_crm_pipeline_boot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FROM crm.pipeline_custom_stages s
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
            FROM crm.kanban_column_sources f
            WHERE f.coluna_id = c.id
          ), '[]'::JSONB),
          'overrides', COALESCE((
            SELECT jsonb_agg(jsonb_build_object(
              'leadId', o.lead_id,
              'acao', o.acao
            ))
            FROM crm.kanban_card_overrides o
            WHERE o.coluna_id = c.id AND o.ativo IS TRUE
          ), '[]'::JSONB)
        ) ORDER BY c.ordem, c.nome)
        FROM crm.kanban_columns c
        WHERE c.pagina_id = p.id AND c.ativo IS TRUE
      ), '[]'::JSONB)
    ) AS pagina
    FROM crm.kanban_pages p
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
  FROM crm.leads l
  LEFT JOIN crm.usuarios v ON v.id = l.vendedor_responsavel_id;

  RETURN jsonb_build_object(
    'etapas', v_stages,
    'quadros', v_pages,
    'leads', v_leads
  );
END;
$function$;

-- public.movelaria_crm_pode_markup
CREATE OR REPLACE FUNCTION public.movelaria_crm_pode_markup()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FROM crm.usuarios c
  WHERE c.id = auth.uid();

  IF v_tipo IS DISTINCT FROM 'colaborador' OR v_status IS DISTINCT FROM 'ATIVO' THEN
    RETURN FALSE;
  END IF;

  SELECT COALESCE(array_agg(r.role::TEXT), '{}'::TEXT[])
  INTO v_roles
  FROM crm.user_roles r
  WHERE r.user_id = auth.uid();

  RETURN v_roles && ARRAY['admin', 'projetista', 'projetista_admin'];
END;
$function$;

-- public.movelaria_crm_pode_pipeline
CREATE OR REPLACE FUNCTION public.movelaria_crm_pode_pipeline()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FROM crm.usuarios c
  WHERE c.id = auth.uid();

  IF v_tipo IS DISTINCT FROM 'colaborador' OR v_status IS DISTINCT FROM 'ATIVO' THEN
    RETURN FALSE;
  END IF;

  SELECT COALESCE(array_agg(r.role::TEXT), '{}'::TEXT[])
  INTO v_roles
  FROM crm.user_roles r
  WHERE r.user_id = auth.uid();

  RETURN v_roles && ARRAY['admin', 'vendedor', 'projetista', 'projetista_admin'];
END;
$function$;

-- public.movelaria_crm_pode_prestador
CREATE OR REPLACE FUNCTION public.movelaria_crm_pode_prestador()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo   TEXT;
  v_status TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  SELECT c.tipo_usuario, c.status_convite INTO v_tipo, v_status
  FROM crm.usuarios c WHERE c.id = auth.uid();
  RETURN v_tipo IS NOT DISTINCT FROM 'prestador_servico' AND v_status IS NOT DISTINCT FROM 'ATIVO';
END;
$function$;

-- public.movelaria_crm_pode_venda
CREATE OR REPLACE FUNCTION public.movelaria_crm_pode_venda()
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_tipo   TEXT;
  v_status TEXT;
  v_roles  TEXT[];
BEGIN
  IF auth.uid() IS NULL THEN RETURN FALSE; END IF;
  SELECT c.tipo_usuario, c.status_convite INTO v_tipo, v_status
  FROM crm.usuarios c WHERE c.id = auth.uid();
  IF v_tipo IS DISTINCT FROM 'colaborador' OR v_status IS DISTINCT FROM 'ATIVO' THEN
    RETURN FALSE;
  END IF;
  SELECT COALESCE(array_agg(r.role::TEXT), '{}'::TEXT[]) INTO v_roles
  FROM crm.user_roles r WHERE r.user_id = auth.uid();
  RETURN v_roles && ARRAY['admin', 'vendedor'];
END;
$function$;

-- public.movelaria_crm_pontua_admin_boot
CREATE OR REPLACE FUNCTION public.movelaria_crm_pontua_admin_boot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FROM crm.usuarios u
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
  FROM crm.prestador_saque_pedidos s;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id, 'lead_id', l.lead_id, 'prestador_id', l.prestador_id, 'status', l.status, 'field_id', l.field_id
  ) ORDER BY l.criado_em DESC NULLS LAST), '[]'::JSONB)
  INTO v_libs
  FROM crm.pontua_garbo_comissao_liberacoes l
  WHERE l.status = 'aguardando_liberacao';

  RETURN jsonb_build_object(
    'prestadores', COALESCE(v_prest, '[]'::JSONB),
    'saques', COALESCE(v_saques, '[]'::JSONB),
    'liberacoes', COALESCE(v_libs, '[]'::JSONB)
  );
END;
$function$;

-- public.movelaria_crm_pontua_aprovar_saque
CREATE OR REPLACE FUNCTION public.movelaria_crm_pontua_aprovar_saque(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row crm.prestador_saque_pedidos%ROWTYPE;
BEGIN
  IF NOT (public.movelaria_crm_colaborador_roles() && ARRAY['admin']::TEXT[]) THEN
    RAISE EXCEPTION 'Só o admin do CRM aprova saque';
  END IF;
  SELECT * INTO v_row FROM crm.prestador_saque_pedidos WHERE id = p_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'Pedido não encontrado'; END IF;
  IF v_row.status IS DISTINCT FROM 'pendente' THEN RAISE EXCEPTION 'Pedido já processado'; END IF;

  INSERT INTO crm.pontua_garbo_lancamentos (prestador_id, tipo, valor, descricao, criado_por, saque_pedido_id)
  VALUES (v_row.prestador_id, 'saque', v_row.valor_solicitado,
          'Retirada PIX: ' || COALESCE(v_row.chave_pix, ''), auth.uid(), v_row.id);

  UPDATE crm.prestador_saque_pedidos
  SET status = 'aprovado', processado_em = NOW(), processado_por = auth.uid()
  WHERE id = p_id;

  RETURN jsonb_build_object('ok', TRUE);
END;
$function$;

-- public.movelaria_crm_pontua_liberar_comissao
CREATE OR REPLACE FUNCTION public.movelaria_crm_pontua_liberar_comissao(p_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.movelaria_crm_colaborador_roles() && ARRAY['admin']::TEXT[]) THEN
    RAISE EXCEPTION 'Só o admin do CRM libera comissão';
  END IF;
  UPDATE crm.pontua_garbo_comissao_liberacoes
  SET status = 'liberada'
  WHERE id = p_id AND status = 'aguardando_liberacao';
  IF NOT FOUND THEN RAISE EXCEPTION 'Liberação não encontrada'; END IF;
  RETURN jsonb_build_object('ok', TRUE);
END;
$function$;

-- public.movelaria_crm_pontua_rejeitar_saque
CREATE OR REPLACE FUNCTION public.movelaria_crm_pontua_rejeitar_saque(p_id uuid, p_obs text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT (public.movelaria_crm_colaborador_roles() && ARRAY['admin']::TEXT[]) THEN
    RAISE EXCEPTION 'Só o admin do CRM rejeita saque';
  END IF;
  UPDATE crm.prestador_saque_pedidos
  SET status = 'rejeitado', obs_admin = NULLIF(btrim(p_obs), ''), processado_em = NOW(), processado_por = auth.uid()
  WHERE id = p_id AND status = 'pendente';
  IF NOT FOUND THEN RAISE EXCEPTION 'Pedido não encontrado ou já processado'; END IF;
  RETURN jsonb_build_object('ok', TRUE);
END;
$function$;

-- public.movelaria_crm_portal_boot
CREATE OR REPLACE FUNCTION public.movelaria_crm_portal_boot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FROM crm.usuarios c
  WHERE c.id = v_uid;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id,
    'nome', d.nome,
    'ativo', d.ativo,
    'config_pontua_garbo', COALESCE(d.config_pontua_garbo, '{}'::JSONB)
  ) ORDER BY d.ordem, d.nome), '[]'::JSONB)
  INTO v_defs
  FROM crm.lead_custom_field_definitions d
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
  FROM crm.lead_custom_field_values v
  JOIN crm.lead_custom_field_definitions d ON d.id = v.field_id
  JOIN crm.leads l ON l.id = v.lead_id
  LEFT JOIN crm.pontua_garbo_comissao_liberacoes lib
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
  FROM crm.lead_prestador_permissoes p
  WHERE p.prestador_id = v_uid;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', x.id, 'tipo', x.tipo, 'valor', x.valor, 'descricao', x.descricao, 'criado_em', x.criado_em
  ) ORDER BY x.criado_em DESC), '[]'::JSONB)
  INTO v_lancamentos
  FROM crm.pontua_garbo_lancamentos x
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
  FROM crm.prestador_saque_pedidos s
  WHERE s.prestador_id = v_uid;

  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', t.id, 'nome', t.nome) ORDER BY t.nome), '[]'::JSONB)
  INTO v_titulos
  FROM crm.prestador_titulos t;

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
$function$;

-- public.movelaria_crm_portal_lead
CREATE OR REPLACE FUNCTION public.movelaria_crm_portal_lead(p_lead_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid UUID := auth.uid();
  v_perm crm.lead_prestador_permissoes%ROWTYPE;
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
  FROM crm.lead_prestador_permissoes
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
    FROM crm.leads l
    WHERE l.id = p_lead_id;
  ELSE
    SELECT jsonb_build_object('id', l.id, 'nome', l.nome, 'status', l.status)
    INTO v_lead
    FROM crm.leads l
    WHERE l.id = p_lead_id;
  END IF;

  IF COALESCE(v_perm.pode_ver_lousa, FALSE) OR COALESCE(v_perm.pode_ver_fotos, FALSE) THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', i.id, 'file_url', i.file_url, 'file_name', i.file_name,
      'position_x', i.position_x, 'position_y', i.position_y,
      'width', i.width, 'height', i.height, 'z_index', i.z_index
    ) ORDER BY i.z_index, i.criado_em), '[]'::JSONB)
    INTO v_lousa_images
    FROM crm.lead_whiteboard_images i
    WHERE i.lead_id = p_lead_id;

    SELECT COALESCE(jsonb_agg(jsonb_build_object(
      'id', d.id, 'path_data', d.path_data, 'cor', d.cor, 'stroke_width', d.stroke_width
    ) ORDER BY d.criado_em), '[]'::JSONB)
    INTO v_lousa_drawings
    FROM crm.lead_whiteboard_drawings d
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
    FROM crm.orcamento_slides s
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
$function$;

-- public.movelaria_crm_portal_saldo_sacar
CREATE OR REPLACE FUNCTION public.movelaria_crm_portal_saldo_sacar(p_uid uuid)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FROM crm.lead_custom_field_values v
  JOIN crm.lead_custom_field_definitions d ON d.id = v.field_id
  JOIN crm.leads l ON l.id = v.lead_id
  JOIN crm.pontua_garbo_comissao_liberacoes lib
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
  FROM crm.pontua_garbo_lancamentos
  WHERE prestador_id = p_uid;

  RETURN GREATEST(0, ROUND((v_liberado + v_ajustes - v_saques)::NUMERIC, 2));
END;
$function$;

-- public.movelaria_crm_portal_salvar_perfil
CREATE OR REPLACE FUNCTION public.movelaria_crm_portal_salvar_perfil(p_telefone text, p_chave_pix text, p_tipo_chave_pix text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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

  UPDATE crm.usuarios
  SET telefone = NULLIF(btrim(p_telefone), ''),
      chave_pix = NULLIF(btrim(p_chave_pix), ''),
      tipo_chave_pix = v_tipo,
      atualizado_em = NOW()
  WHERE id = v_uid;

  RETURN jsonb_build_object('ok', TRUE);
END;
$function$;

-- public.movelaria_crm_portal_solicitar_saque
CREATE OR REPLACE FUNCTION public.movelaria_crm_portal_solicitar_saque(p_valor numeric, p_chave_pix text, p_tipo_chave_pix text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FROM crm.prestador_saque_pedidos
  WHERE prestador_id = v_uid AND status = 'pendente';
  v_disponivel := GREATEST(0, ROUND((v_saldo - v_pendente)::NUMERIC, 2));

  IF v_valor > v_disponivel THEN
    RAISE EXCEPTION 'Saldo insuficiente. Disponível para sacar: %', v_disponivel;
  END IF;

  INSERT INTO crm.prestador_saque_pedidos (
    prestador_id, valor_solicitado, chave_pix, tipo_chave_pix, status
  ) VALUES (
    v_uid, v_valor, v_chave, v_tipo, 'pendente'
  )
  RETURNING id INTO v_id;

  UPDATE crm.usuarios
  SET chave_pix = v_chave, tipo_chave_pix = v_tipo, atualizado_em = NOW()
  WHERE id = v_uid;

  RETURN jsonb_build_object('id', v_id, 'status', 'pendente');
END;
$function$;

-- public.movelaria_crm_salvar_lead
CREATE OR REPLACE FUNCTION public.movelaria_crm_salvar_lead(p_lead_id bigint, p_nome text, p_telefone text, p_email text, p_origem text, p_observacoes text, p_valor_negocio numeric, p_status text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.movelaria_crm_pode_pipeline() THEN
    RAISE EXCEPTION 'Acesso negado ao pipeline comercial';
  END IF;
  IF p_lead_id IS NULL OR NULLIF(BTRIM(p_nome), '') IS NULL THEN
    RAISE EXCEPTION 'Nome do lead é obrigatório';
  END IF;

  UPDATE crm.leads
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
$function$;

-- public.movelaria_crm_slide_criar
CREATE OR REPLACE FUNCTION public.movelaria_crm_slide_criar(p_cliente_nome text, p_lead_id bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT nome INTO v_nome FROM crm.leads WHERE id = p_lead_id;
  END IF;

  v_nome := COALESCE(NULLIF(BTRIM(p_cliente_nome), ''), NULLIF(BTRIM(v_nome), ''), 'Cliente');
  v_ident := 'RASC-' || upper(regexp_replace(v_nome, '[^a-zA-Z0-9]+', '-', 'g'))
    || '-' || substr(replace(gen_random_uuid()::TEXT, '-', ''), 1, 4);

  INSERT INTO crm.orcamento_slides (
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
  FROM crm.orcamento_slides s
  WHERE s.id = v_id;

  RETURN v_row;
END;
$function$;

-- public.movelaria_crm_slide_salvar
CREATE OR REPLACE FUNCTION public.movelaria_crm_slide_salvar(p_id uuid, p_cliente_nome text, p_identificador text, p_lead_id bigint, p_status text, p_dados jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_row JSONB;
BEGIN
  IF NOT public.movelaria_crm_pode_slides() THEN
    RAISE EXCEPTION 'Acesso negado aos slides de orçamento';
  END IF;
  IF p_id IS NULL OR NULLIF(BTRIM(p_cliente_nome), '') IS NULL THEN
    RAISE EXCEPTION 'Nome do cliente é obrigatório';
  END IF;

  UPDATE crm.orcamento_slides
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
  FROM crm.orcamento_slides s
  WHERE s.id = p_id;

  RETURN v_row;
END;
$function$;

-- public.movelaria_crm_slides_boot
CREATE OR REPLACE FUNCTION public.movelaria_crm_slides_boot()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  FROM crm.orcamento_slides s
  LEFT JOIN crm.leads l ON l.id = s.lead_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id,
    'nome', l.nome
  ) ORDER BY l.nome), '[]'::JSONB)
  INTO v_leads
  FROM crm.leads l;

  RETURN jsonb_build_object(
    'slides', COALESCE(v_slides, '[]'::JSONB),
    'leads', COALESCE(v_leads, '[]'::JSONB)
  );
END;
$function$;

-- public.movelaria_crm_whatsapp_historico
CREATE OR REPLACE FUNCTION public.movelaria_crm_whatsapp_historico(p_telefone text)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    FROM crm.chat_mensagens m
    WHERE regexp_replace(m.telefone, '\D', '', 'g') = v_digits
       OR regexp_replace(m.telefone, '\D', '', 'g') = ('55' || v_digits)
       OR ('55' || regexp_replace(m.telefone, '\D', '', 'g')) = v_digits
    ORDER BY m.criado_em DESC
    LIMIT 80
  ) x;

  RETURN jsonb_build_object('items', COALESCE(v_items, '[]'::JSONB));
END;
$function$;

-- public.movelaria_crm_whatsapp_registrar
CREATE OR REPLACE FUNCTION public.movelaria_crm_whatsapp_registrar(p_telefone text, p_conteudo text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_digits TEXT := regexp_replace(COALESCE(p_telefone, ''), '\D', '', 'g');
  v_id UUID;
BEGIN
  IF NOT public.movelaria_crm_pode_venda() THEN
    RAISE EXCEPTION 'Acesso negado para enviar WhatsApp';
  END IF;
  IF v_digits IS NULL OR length(v_digits) < 8 THEN RAISE EXCEPTION 'Informe o telefone'; END IF;
  IF NULLIF(btrim(p_conteudo), '') IS NULL THEN RAISE EXCEPTION 'Escreva a mensagem'; END IF;

  INSERT INTO crm.chat_mensagens (
    telefone, tipo_remetente, usuario_id, tipo_mensagem, conteudo, origem, enviada, lida
  ) VALUES (
    v_digits, 'atendente', auth.uid(), 'texto', btrim(p_conteudo), 'crm', TRUE, TRUE
  ) RETURNING id INTO v_id;

  RETURN jsonb_build_object('id', v_id);
END;
$function$;

-- public.movelaria_excluir_lead_ganho
CREATE OR REPLACE FUNCTION public.movelaria_excluir_lead_ganho(p_lead_id text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
DECLARE
  v_lead_id TEXT := NULLIF(trim(COALESCE(p_lead_id, '')), '');
BEGIN
  IF v_lead_id IS NULL THEN
    RAISE EXCEPTION 'Lead inválido para exclusão.';
  END IF;

  INSERT INTO movelaria_leads_ganhos_excluidos (lead_id)
  VALUES (v_lead_id)
  ON CONFLICT (lead_id) DO NOTHING;
END;
$function$;

-- public.movelaria_get_leads_ganhos
CREATE OR REPLACE FUNCTION public.movelaria_get_leads_ganhos()
 RETURNS TABLE(id text, nome text, telefone text, email text, origem text, status text, valor_orcamento numeric, observacoes text, criado_em timestamp with time zone, ja_processado boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    l.id::TEXT,
    l.nome,
    NULLIF(trim(COALESCE(l.telefone, '')), ''),
    NULLIF(trim(COALESCE(l.email, '')), ''),
    l.origem,
    l.status,
    (SELECT CASE
      WHEN COALESCE(raw_val, '') ~ '^-?[0-9]{1,3}(\.[0-9]{3})+(,[0-9]{1,2})?$'
        THEN REPLACE(REPLACE(raw_val, '.', ''), ',', '.')::NUMERIC
      WHEN COALESCE(raw_val, '') ~ '^-?[0-9]+([.][0-9]+)?$'
        THEN raw_val::NUMERIC
      WHEN COALESCE(raw_val, '') ~ '^-?[0-9]+(,[0-9]+)?$'
        THEN REPLACE(raw_val, ',', '.')::NUMERIC
      ELSE NULL
    END
    FROM (
      SELECT NULLIF(trim(COALESCE(
        NULLIF(trim(to_jsonb(l) ->> 'valor_negocio'), ''),
        NULLIF(trim(to_jsonb(l) ->> 'valor_orcamento'), '')
      )), '') AS raw_val
    ) v
    ) AS valor_orcamento,
    COALESCE(
      NULLIF(trim(COALESCE(to_jsonb(l) ->> 'observacoes', '')), ''),
      NULLIF(trim(COALESCE(to_jsonb(l) ->> 'observacao',  '')), '')
    ) AS observacoes,
    l.criado_em,
    (
      EXISTS (
        SELECT 1 FROM movelaria_orcamentos_fechados o WHERE o.lead_id = l.id::TEXT
      )
      OR
      EXISTS (
        SELECT 1 FROM movelaria_leads_ganhos_excluidos e WHERE e.lead_id = l.id::TEXT
      )
    ) AS ja_processado
  FROM crm.leads l
  WHERE l.status = 'Orçamentos ganhos'
  ORDER BY l.criado_em DESC;
END;
$function$;

-- public.movelaria_lead_midias_por_leads
CREATE OR REPLACE FUNCTION public.movelaria_lead_midias_por_leads(p_lead_ids text[])
 RETURNS TABLE(id text, lead_id text, tipo text, titulo text, file_name text, file_url text, folder_nome text, criado_em timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
DECLARE
  v_pode_docs BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL OR movelaria_meu_perfil() IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM movelaria_usuarios u
    WHERE u.id = auth.uid()
      AND u.ativo = true
      AND (
        u.perfil IN ('montador_admin', 'administrador', 'administrador_obras')
        OR 'montador_admin' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
        OR 'administrador' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
        OR 'administrador_obras' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
      )
  ) INTO v_pode_docs;

  IF p_lead_ids IS NULL OR cardinality(p_lead_ids) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    m.id::TEXT,
    m.lead_id::TEXT,
    m.tipo,
    m.titulo,
    m.file_name,
    m.file_url,
    f.nome,
    m.criado_em
  FROM crm.marketing_medias m
  LEFT JOIN crm.marketing_media_folders f ON f.id = m.folder_id
  WHERE m.lead_id IS NOT NULL
    AND m.lead_id::TEXT = ANY (p_lead_ids)
    AND (
      m.tipo = 'imagem'
      OR (v_pode_docs AND m.tipo = 'pdf')
    )
  ORDER BY m.criado_em DESC NULLS LAST;
END;
$function$;

-- public.movelaria_listar_contratos
CREATE OR REPLACE FUNCTION public.movelaria_listar_contratos()
 RETURNS TABLE(id uuid, identificador text, cliente_nome text, status text, created_at timestamp with time zone, lead_id bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
      SELECT id, identificador, cliente_nome, status, created_at, lead_id
      FROM crm.contratos
      ORDER BY created_at DESC;
    $function$;

-- public.movelaria_listar_identidades
CREATE OR REPLACE FUNCTION public.movelaria_listar_identidades()
 RETURNS TABLE(id uuid, email text, nome text, perfil text, perfis_extras text[], ativo boolean, criado_em timestamp with time zone, tem_movelaria boolean, crm_tipo_usuario text, crm_status_convite text, crm_roles text[], crm_horario_inicio text, crm_horario_fim text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF public.movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem listar usuários';
  END IF;

  RETURN QUERY
  WITH ids AS (
    SELECT m.id FROM public.movelaria_usuarios m
    UNION
    SELECT c.id FROM crm.usuarios c
  )
  SELECT
    i.id,
    COALESCE(m.email, c.email, ''),
    COALESCE(m.nome, c.nome),
    m.perfil,
    COALESCE(m.perfis_extras, '{}'::TEXT[]),
    COALESCE(m.ativo, c.status_convite = 'ATIVO', false),
    COALESCE(m.criado_em, c.criado_em, NOW()),
    (m.id IS NOT NULL),
    c.tipo_usuario,
    c.status_convite,
    COALESCE((
      SELECT array_agg(r.role::TEXT ORDER BY r.role::TEXT)
      FROM crm.user_roles r
      WHERE r.user_id = i.id
    ), '{}'::TEXT[]),
    to_char(c.horario_acesso_inicio, 'HH24:MI'),
    to_char(c.horario_acesso_fim, 'HH24:MI')
  FROM ids i
  LEFT JOIN public.movelaria_usuarios m ON m.id = i.id
  LEFT JOIN crm.usuarios c ON c.id = i.id
  ORDER BY COALESCE(m.nome, c.nome, m.email, c.email);
END;
$function$;

-- public.movelaria_listar_titulares_agenda
CREATE OR REPLACE FUNCTION public.movelaria_listar_titulares_agenda()
 RETURNS TABLE(id uuid, nome text, avatar_url text, perfil_casa text, crm_roles text[], grupo text)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid        UUID := auth.uid();
  v_perfil     TEXT;
  v_crm_colab  BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  v_perfil := public.movelaria_meu_perfil();

  SELECT EXISTS (
    SELECT 1
    FROM crm.usuarios c
    WHERE c.id = v_uid
      AND c.status_convite = 'ATIVO'
      AND c.tipo_usuario = 'colaborador'
  )
  INTO v_crm_colab;

  IF v_perfil IS NULL AND NOT v_crm_colab THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_perfil = 'visualizador' AND NOT v_crm_colab THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  WITH ids AS (
    SELECT m.id
    FROM public.movelaria_usuarios m
    WHERE m.ativo = true
      AND m.perfil IS DISTINCT FROM 'visualizador'
    UNION
    SELECT c.id
    FROM crm.usuarios c
    WHERE c.status_convite = 'ATIVO'
      AND c.tipo_usuario = 'colaborador'
  )
  SELECT
    i.id,
    COALESCE(NULLIF(btrim(m.nome), ''), NULLIF(btrim(c.nome), ''), split_part(COALESCE(m.email, c.email, ''), '@', 1), 'Usuário') AS nome,
    c.avatar_url,
    m.perfil AS perfil_casa,
    COALESCE((
      SELECT array_agg(r.role::TEXT ORDER BY r.role::TEXT)
      FROM crm.user_roles r
      WHERE r.user_id = i.id
        AND r.role::TEXT <> 'nenhum'
    ), '{}'::TEXT[]) AS crm_roles,
    CASE
      WHEN m.perfil IN ('montador', 'montador_admin') THEN 'montador'
      ELSE 'equipe'
    END AS grupo
  FROM ids i
  LEFT JOIN public.movelaria_usuarios m ON m.id = i.id
  LEFT JOIN crm.usuarios c ON c.id = i.id
  ORDER BY
    CASE WHEN m.perfil IN ('montador', 'montador_admin') THEN 1 ELSE 0 END,
    COALESCE(m.nome, c.nome, m.email, c.email);
END;
$function$;

-- public.movelaria_markup_catalogo_categorias
CREATE OR REPLACE FUNCTION public.movelaria_markup_catalogo_categorias()
 RETURNS TABLE(id uuid, nome text, ordem integer, ativo boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
BEGIN
  IF NOT movelaria_usuario_tem_qualquer_perfil(ARRAY['administrador', 'financeiro']) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT c.id, c.nome, c.ordem, c.ativo
  FROM crm.markup_categorias c
  ORDER BY c.ordem, c.nome;
END;
$function$;

-- public.movelaria_markup_catalogo_listar
CREATE OR REPLACE FUNCTION public.movelaria_markup_catalogo_listar()
 RETURNS TABLE(id uuid, categoria_id uuid, categoria_nome text, nome text, variacao text, preco_unitario numeric, unidade text, quantidade_padrao numeric, ativo boolean, ordem integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
BEGIN
  IF NOT movelaria_usuario_tem_qualquer_perfil(ARRAY['administrador', 'financeiro']) THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    p.id,
    p.categoria_id,
    c.nome,
    p.nome,
    p.variacao,
    p.preco_unitario,
    p.unidade,
    p.quantidade_padrao,
    p.ativo,
    p.ordem
  FROM crm.markup_produtos p
  LEFT JOIN crm.markup_categorias c ON c.id = p.categoria_id
  ORDER BY COALESCE(c.ordem, 999), p.ordem, p.nome;
END;
$function$;

-- public.movelaria_markup_catalogo_salvar_categoria
CREATE OR REPLACE FUNCTION public.movelaria_markup_catalogo_salvar_categoria(p_id uuid, p_nome text, p_ordem integer, p_ativo boolean)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
DECLARE
  v_id UUID;
  v_slug TEXT;
BEGIN
  IF NOT movelaria_usuario_tem_qualquer_perfil(ARRAY['administrador', 'financeiro']) THEN
    RAISE EXCEPTION 'Acesso negado: somente administrador ou financeiro editam categorias.';
  END IF;

  IF p_nome IS NULL OR btrim(p_nome) = '' THEN
    RAISE EXCEPTION 'Nome da categoria é obrigatório.';
  END IF;

  v_slug := lower(regexp_replace(btrim(p_nome), '[^a-zA-Z0-9]+', '-', 'g'));

  IF p_id IS NULL THEN
    INSERT INTO crm.markup_categorias (nome, slug, ordem, ativo)
    VALUES (
      btrim(p_nome),
      NULLIF(v_slug, ''),
      COALESCE(p_ordem, 0),
      COALESCE(p_ativo, true)
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE crm.markup_categorias
    SET
      nome = btrim(p_nome),
      ordem = COALESCE(p_ordem, 0),
      ativo = COALESCE(p_ativo, true)
    WHERE id = p_id
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$function$;

-- public.movelaria_markup_catalogo_salvar_produto
CREATE OR REPLACE FUNCTION public.movelaria_markup_catalogo_salvar_produto(p_id uuid, p_categoria_id uuid, p_nome text, p_variacao text, p_preco_unitario numeric, p_unidade text, p_quantidade_padrao numeric, p_ativo boolean, p_ordem integer)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  IF NOT movelaria_usuario_tem_qualquer_perfil(ARRAY['administrador', 'financeiro']) THEN
    RAISE EXCEPTION 'Acesso negado: somente administrador ou financeiro editam o catálogo.';
  END IF;

  IF p_nome IS NULL OR btrim(p_nome) = '' THEN
    RAISE EXCEPTION 'Nome do produto é obrigatório.';
  END IF;

  IF p_id IS NULL THEN
    INSERT INTO crm.markup_produtos (
      categoria_id, nome, variacao, preco_unitario, unidade,
      quantidade_padrao, ativo, ordem, atualizado_em
    )
    VALUES (
      p_categoria_id,
      btrim(p_nome),
      NULLIF(btrim(COALESCE(p_variacao, '')), ''),
      COALESCE(p_preco_unitario, 0),
      COALESCE(NULLIF(btrim(p_unidade), ''), 'un'),
      p_quantidade_padrao,
      COALESCE(p_ativo, true),
      COALESCE(p_ordem, 0),
      NOW()
    )
    RETURNING id INTO v_id;
  ELSE
    UPDATE crm.markup_produtos
    SET
      categoria_id = p_categoria_id,
      nome = btrim(p_nome),
      variacao = NULLIF(btrim(COALESCE(p_variacao, '')), ''),
      preco_unitario = COALESCE(p_preco_unitario, 0),
      unidade = COALESCE(NULLIF(btrim(p_unidade), ''), 'un'),
      quantidade_padrao = p_quantidade_padrao,
      ativo = COALESCE(p_ativo, true),
      ordem = COALESCE(p_ordem, 0),
      atualizado_em = NOW()
    WHERE id = p_id
    RETURNING id INTO v_id;

    IF v_id IS NULL THEN
      RAISE EXCEPTION 'Produto não encontrado.';
    END IF;
  END IF;

  RETURN v_id;
END;
$function$;

-- public.movelaria_markup_custos_por_leads
CREATE OR REPLACE FUNCTION public.movelaria_markup_custos_por_leads(p_lead_ids text[])
 RETURNS TABLE(lead_id text, custo_materiais numeric, custo_servicos numeric, custo_despesas numeric, preco_final numeric)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM movelaria_usuarios u
    WHERE u.id = auth.uid()
      AND u.ativo = true
      AND (
        u.perfil IN ('administrador', 'financeiro')
        OR 'administrador' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
        OR 'financeiro' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
      )
  ) THEN
    RETURN;
  END IF;

  IF p_lead_ids IS NULL OR cardinality(p_lead_ids) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (m.lead_id)
    m.lead_id::TEXT,
    COALESCE((m.modulos->'totais'->>'custo_materiais')::NUMERIC, 0),
    COALESCE((m.modulos->'totais'->>'custo_servicos')::NUMERIC, 0),
    COALESCE((m.modulos->'totais'->>'custo_despesas')::NUMERIC, 0),
    COALESCE(
      NULLIF((m.modulos->'totais'->>'preco_final')::NUMERIC, NULL),
      m.preco_final,
      0
    )
  FROM crm.markup_orcamentos m
  WHERE m.lead_id IS NOT NULL
    AND m.lead_id::TEXT = ANY (p_lead_ids)
  ORDER BY m.lead_id, m.atualizado_em DESC NULLS LAST;
END;
$function$;

-- public.movelaria_markup_itens_por_leads
CREATE OR REPLACE FUNCTION public.movelaria_markup_itens_por_leads(p_lead_ids text[])
 RETURNS TABLE(lead_id text, orcamento_id uuid, titulo text, custo_materiais numeric, custo_servicos numeric, custo_despesas numeric, preco_final numeric, linhas jsonb)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
BEGIN
  IF NOT movelaria_usuario_tem_qualquer_perfil(
    ARRAY['administrador', 'financeiro', 'administrador_obras', 'montador_admin']
  ) THEN
    RETURN;
  END IF;

  IF p_lead_ids IS NULL OR cardinality(p_lead_ids) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT DISTINCT ON (m.lead_id)
    m.lead_id::TEXT,
    m.id,
    m.titulo,
    COALESCE((m.modulos->'totais'->>'custo_materiais')::NUMERIC, 0),
    COALESCE((m.modulos->'totais'->>'custo_servicos')::NUMERIC, 0),
    COALESCE((m.modulos->'totais'->>'custo_despesas')::NUMERIC, 0),
    COALESCE(
      NULLIF((m.modulos->'totais'->>'preco_final')::NUMERIC, NULL),
      m.preco_final,
      0
    ),
    COALESCE(m.modulos->'materiais'->'linhas', '[]'::JSONB)
  FROM crm.markup_orcamentos m
  WHERE m.lead_id IS NOT NULL
    AND m.lead_id::TEXT = ANY (p_lead_ids)
  ORDER BY m.lead_id, m.atualizado_em DESC NULLS LAST;
END;
$function$;

-- public.movelaria_obter_minha_identidade
CREATE OR REPLACE FUNCTION public.movelaria_obter_minha_identidade()
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid   UUID := auth.uid();
  v_mov   JSONB;
  v_crm   JSONB;
  v_roles TEXT[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('movelaria', NULL, 'crm', NULL);
  END IF;

  SELECT jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'nome', u.nome,
    'perfil', u.perfil,
    'perfis_extras', COALESCE(u.perfis_extras, '{}'::TEXT[]),
    'ativo', u.ativo,
    'criado_em', u.criado_em
  )
  INTO v_mov
  FROM public.movelaria_usuarios u
  WHERE u.id = v_uid;

  SELECT COALESCE(array_agg(r.role::TEXT ORDER BY r.role::TEXT), '{}'::TEXT[])
  INTO v_roles
  FROM crm.user_roles r
  WHERE r.user_id = v_uid;

  SELECT jsonb_build_object(
    'id', c.id,
    'nome', c.nome,
    'email', c.email,
    'tipo_usuario', c.tipo_usuario,
    'status_convite', c.status_convite,
    'roles', COALESCE(v_roles, '{}'::TEXT[]),
    'horario_acesso_inicio', to_char(c.horario_acesso_inicio, 'HH24:MI'),
    'horario_acesso_fim', to_char(c.horario_acesso_fim, 'HH24:MI'),
    'titulo', c.titulo,
    'comissao_ativa', c.comissao_ativa
  )
  INTO v_crm
  FROM crm.usuarios c
  WHERE c.id = v_uid;

  RETURN jsonb_build_object(
    'movelaria', v_mov,
    'crm', v_crm
  );
END;
$function$;

-- public.movelaria_puxar_lead_producao
CREATE OR REPLACE FUNCTION public.movelaria_puxar_lead_producao(p_lead_id bigint)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
DECLARE
  v_id UUID;
  v_stage UUID;
  v_obra UUID;
BEGIN
  IF NOT crm.me_can_access_producao(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado à produção';
  END IF;

  SELECT id INTO v_id FROM crm.obra_producao WHERE lead_id = p_lead_id;
  IF v_id IS NOT NULL THEN
    RETURN v_id;
  END IF;

  SELECT id INTO v_stage
  FROM crm.producao_stages
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

  INSERT INTO crm.obra_producao (obra_id, lead_id, stage_id)
  VALUES (v_obra, p_lead_id, v_stage)
  RETURNING id INTO v_id;

  RETURN v_id;
END;
$function$;

-- public.movelaria_salvar_markup_itens
CREATE OR REPLACE FUNCTION public.movelaria_salvar_markup_itens(p_orcamento_id uuid, p_linhas jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
DECLARE
  v_modulos JSONB;
  v_linhas JSONB;
  v_sum NUMERIC;
  v_fator NUMERIC;
  v_ajustado NUMERIC;
BEGIN
  IF NOT movelaria_usuario_tem_qualquer_perfil(ARRAY['administrador', 'financeiro']) THEN
    RAISE EXCEPTION 'Acesso negado: somente administrador ou financeiro editam o markup.';
  END IF;

  IF p_linhas IS NULL OR jsonb_typeof(p_linhas) <> 'array' THEN
    RAISE EXCEPTION 'Linhas inválidas.';
  END IF;

  SELECT COALESCE(
    jsonb_agg(
      (elem
        || jsonb_build_object(
          'quantidade', COALESCE((elem->>'quantidade')::NUMERIC, 0),
          'valor_unitario', COALESCE((elem->>'valor_unitario')::NUMERIC, 0),
          'valor_total', ROUND(
            COALESCE((elem->>'quantidade')::NUMERIC, 0)
            * COALESCE((elem->>'valor_unitario')::NUMERIC, 0)
          , 2),
          'ativo', COALESCE((elem->>'ativo')::BOOLEAN, true)
        )
      )
    ),
    '[]'::JSONB
  )
  INTO v_linhas
  FROM jsonb_array_elements(p_linhas) AS elem;

  SELECT COALESCE(SUM(
    CASE
      WHEN COALESCE((elem->>'ativo')::BOOLEAN, true)
        THEN COALESCE((elem->>'valor_total')::NUMERIC, 0)
      ELSE 0
    END
  ), 0)
  INTO v_sum
  FROM jsonb_array_elements(v_linhas) AS elem;

  SELECT COALESCE(fator_sobras, 1) INTO v_fator
  FROM crm.markup_config
  LIMIT 1;

  v_ajustado := ROUND(v_sum * COALESCE(v_fator, 1), 2);

  SELECT COALESCE(modulos, '{}'::JSONB)
  INTO v_modulos
  FROM crm.markup_orcamentos
  WHERE id = p_orcamento_id;

  IF v_modulos IS NULL THEN
    RAISE EXCEPTION 'Orçamento de markup não encontrado.';
  END IF;

  IF v_modulos->'materiais' IS NULL THEN
    v_modulos := jsonb_set(v_modulos, '{materiais}', '{"linhas":[]}'::JSONB, true);
  END IF;
  IF v_modulos->'totais' IS NULL THEN
    v_modulos := jsonb_set(v_modulos, '{totais}', '{}'::JSONB, true);
  END IF;

  v_modulos := jsonb_set(v_modulos, '{materiais,linhas}', v_linhas, true);
  v_modulos := jsonb_set(v_modulos, '{totais,custo_materiais}', to_jsonb(v_sum), true);
  v_modulos := jsonb_set(v_modulos, '{totais,custo_materiais_ajustado}', to_jsonb(v_ajustado), true);

  UPDATE crm.markup_orcamentos
  SET
    modulos = v_modulos,
    atualizado_em = NOW()
  WHERE id = p_orcamento_id;

  RETURN jsonb_build_object(
    'orcamento_id', p_orcamento_id,
    'custo_materiais', v_sum,
    'custo_materiais_ajustado', v_ajustado,
    'linhas', v_linhas
  );
END;
$function$;

-- public.movelaria_sync_cliente_lead_trigger
CREATE OR REPLACE FUNCTION public.movelaria_sync_cliente_lead_trigger()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
BEGIN
  PERFORM public.movelaria_upsert_cliente_from_lead(
    NEW.nome,
    NEW.telefone,
    NEW.email,
    NEW.origem,
    COALESCE(NEW.data_chegada, NEW.criado_em::date, CURRENT_DATE)
  );
  RETURN NEW;
END;
$function$;

-- public.movelaria_sync_clientes_from_leads
CREATE OR REPLACE FUNCTION public.movelaria_sync_clientes_from_leads()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'crm'
AS $function$
DECLARE
  v_inserted INTEGER := 0;
  v_updated INTEGER := 0;
BEGIN
  -- Atualiza clientes já existentes (match por telefone ou email).
  WITH leads_norm AS (
    SELECT
      trim(nome) AS nome,
      NULLIF(trim(telefone), '') AS telefone,
      NULLIF(trim(email), '') AS email,
      COALESCE(NULLIF(trim(origem), ''), 'Lead Garbo') AS origem,
      COALESCE(data_chegada, criado_em::date, CURRENT_DATE) AS data_cadastro
    FROM crm.leads
    WHERE NULLIF(trim(nome), '') IS NOT NULL
  ),
  updated_rows AS (
    UPDATE movelaria_clientes c
    SET
      nome = COALESCE(NULLIF(ln.nome, ''), c.nome),
      telefone = COALESCE(ln.telefone, c.telefone),
      email = COALESCE(ln.email, c.email),
      origem = COALESCE(ln.origem, c.origem),
      data_cadastro = COALESCE(ln.data_cadastro, c.data_cadastro),
      atualizado_em = NOW()
    FROM leads_norm ln
    WHERE (
      (ln.telefone IS NOT NULL AND c.telefone = ln.telefone)
      OR (ln.email IS NOT NULL AND c.email = ln.email)
    )
    RETURNING c.id
  )
  SELECT COUNT(*) INTO v_updated FROM updated_rows;

  -- Insere apenas quem ainda não existe por telefone/email.
  WITH leads_norm AS (
    SELECT
      trim(nome) AS nome,
      NULLIF(trim(telefone), '') AS telefone,
      NULLIF(trim(email), '') AS email,
      COALESCE(NULLIF(trim(origem), ''), 'Lead Garbo') AS origem,
      COALESCE(data_chegada, criado_em::date, CURRENT_DATE) AS data_cadastro
    FROM crm.leads
    WHERE NULLIF(trim(nome), '') IS NOT NULL
  ),
  inserted_rows AS (
    INSERT INTO movelaria_clientes (
      nome,
      telefone,
      email,
      origem,
      data_cadastro
    )
    SELECT
      ln.nome,
      ln.telefone,
      ln.email,
      ln.origem,
      ln.data_cadastro
    FROM leads_norm ln
    WHERE NOT EXISTS (
      SELECT 1
      FROM movelaria_clientes c
      WHERE
        (ln.telefone IS NOT NULL AND c.telefone = ln.telefone)
        OR (ln.email IS NOT NULL AND c.email = ln.email)
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted_rows;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated
  );
END;
$function$;

-- 37 policies com 'emp_garbo' nas expressões.
alter policy "contratos_admin_all" on "crm"."contratos" using ((me_get_empresa_role('crm'::text, auth.uid()) = ANY (ARRAY['admin'::text, 'super_admin'::text]))) with check ((me_get_empresa_role('crm'::text, auth.uid()) = ANY (ARRAY['admin'::text, 'super_admin'::text])));
alter policy "contratos_vendedor_all" on "crm"."contratos" using ((me_get_empresa_role('crm'::text, auth.uid()) = 'vendedor'::text)) with check ((me_get_empresa_role('crm'::text, auth.uid()) = 'vendedor'::text));
alter policy "contratos_anexos_admin_all" on "crm"."contratos_anexos" using ((me_get_empresa_role('crm'::text, auth.uid()) = ANY (ARRAY['admin'::text, 'super_admin'::text]))) with check ((me_get_empresa_role('crm'::text, auth.uid()) = ANY (ARRAY['admin'::text, 'super_admin'::text])));
alter policy "contratos_anexos_auth_sel" on "crm"."contratos_anexos" using ((me_get_empresa_role('crm'::text, auth.uid()) IS NOT NULL));
alter policy "contratos_anexos_vendedor_all" on "crm"."contratos_anexos" using ((me_get_empresa_role('crm'::text, auth.uid()) = 'vendedor'::text)) with check ((me_get_empresa_role('crm'::text, auth.uid()) = 'vendedor'::text));
alter policy "contratos_modelos_admin_all" on "crm"."contratos_modelos" using ((me_get_empresa_role('crm'::text, auth.uid()) = ANY (ARRAY['admin'::text, 'super_admin'::text]))) with check ((me_get_empresa_role('crm'::text, auth.uid()) = ANY (ARRAY['admin'::text, 'super_admin'::text])));
alter policy "contratos_modelos_auth_sel" on "crm"."contratos_modelos" using ((me_get_empresa_role('crm'::text, auth.uid()) IS NOT NULL));
alter policy "contratos_modelos_vendedor_all" on "crm"."contratos_modelos" using ((me_get_empresa_role('crm'::text, auth.uid()) = 'vendedor'::text)) with check ((me_get_empresa_role('crm'::text, auth.uid()) = 'vendedor'::text));
alter policy "contratos_var_admin_all" on "crm"."contratos_variaveis" using ((me_get_empresa_role('crm'::text, auth.uid()) = ANY (ARRAY['admin'::text, 'super_admin'::text]))) with check ((me_get_empresa_role('crm'::text, auth.uid()) = ANY (ARRAY['admin'::text, 'super_admin'::text])));
alter policy "contratos_var_auth_sel" on "crm"."contratos_variaveis" using ((me_get_empresa_role('crm'::text, auth.uid()) IS NOT NULL));
alter policy "contratos_var_vendedor_all" on "crm"."contratos_variaveis" using ((me_get_empresa_role('crm'::text, auth.uid()) = 'vendedor'::text)) with check ((me_get_empresa_role('crm'::text, auth.uid()) = 'vendedor'::text));
alter policy "me_lead_projeto_notas_insert" on "crm"."lead_projeto_notas" with check (((autor_id = ( SELECT auth.uid() AS uid)) AND (me_is_super_admin(( SELECT auth.uid() AS uid)) OR (me_get_empresa_role('crm'::text, ( SELECT auth.uid() AS uid)) = 'admin'::text) OR me_empresa_has_any_role('crm'::text, ARRAY['vendedor'::text], ( SELECT auth.uid() AS uid)) OR me_empresa_has_any_role('crm'::text, ARRAY['projetista'::text, 'projetista_admin'::text], ( SELECT auth.uid() AS uid)))));
alter policy "me_lead_projeto_notas_select" on "crm"."lead_projeto_notas" using ((me_is_super_admin(( SELECT auth.uid() AS uid)) OR (me_get_empresa_role('crm'::text, ( SELECT auth.uid() AS uid)) = 'admin'::text) OR me_empresa_has_any_role('crm'::text, ARRAY['vendedor'::text], ( SELECT auth.uid() AS uid)) OR me_empresa_has_any_role('crm'::text, ARRAY['projetista'::text, 'projetista_admin'::text], ( SELECT auth.uid() AS uid))));
alter policy "me_lead_projetos_insert" on "crm"."lead_projetos" with check ((me_is_super_admin(( SELECT auth.uid() AS uid)) OR (me_get_empresa_role('crm'::text, ( SELECT auth.uid() AS uid)) = 'admin'::text) OR me_empresa_has_any_role('crm'::text, ARRAY['vendedor'::text], ( SELECT auth.uid() AS uid)) OR me_empresa_has_any_role('crm'::text, ARRAY['projetista'::text, 'projetista_admin'::text], ( SELECT auth.uid() AS uid))));
alter policy "me_lead_projetos_select" on "crm"."lead_projetos" using ((me_is_super_admin(( SELECT auth.uid() AS uid)) OR (me_get_empresa_role('crm'::text, ( SELECT auth.uid() AS uid)) = 'admin'::text) OR me_empresa_has_any_role('crm'::text, ARRAY['vendedor'::text], ( SELECT auth.uid() AS uid)) OR me_empresa_has_any_role('crm'::text, ARRAY['projetista'::text, 'projetista_admin'::text], ( SELECT auth.uid() AS uid))));
alter policy "me_lead_projetos_update" on "crm"."lead_projetos" using ((me_is_super_admin(( SELECT auth.uid() AS uid)) OR (me_get_empresa_role('crm'::text, ( SELECT auth.uid() AS uid)) = 'admin'::text) OR me_empresa_has_any_role('crm'::text, ARRAY['vendedor'::text], ( SELECT auth.uid() AS uid)) OR me_empresa_has_any_role('crm'::text, ARRAY['projetista'::text, 'projetista_admin'::text], ( SELECT auth.uid() AS uid)))) with check ((me_is_super_admin(( SELECT auth.uid() AS uid)) OR (me_get_empresa_role('crm'::text, ( SELECT auth.uid() AS uid)) = 'admin'::text) OR me_empresa_has_any_role('crm'::text, ARRAY['vendedor'::text], ( SELECT auth.uid() AS uid)) OR me_empresa_has_any_role('crm'::text, ARRAY['projetista'::text, 'projetista_admin'::text], ( SELECT auth.uid() AS uid))));
alter policy "emp_leads_admin_delete" on "crm"."leads" using ((me_get_empresa_role('crm'::text, ( SELECT auth.uid() AS uid)) = 'admin'::text));
alter policy "emp_leads_admin_insert" on "crm"."leads" with check ((me_get_empresa_role('crm'::text, ( SELECT auth.uid() AS uid)) = 'admin'::text));
alter policy "emp_leads_admin_update" on "crm"."leads" using ((me_get_empresa_role('crm'::text, ( SELECT auth.uid() AS uid)) = 'admin'::text)) with check ((me_get_empresa_role('crm'::text, ( SELECT auth.uid() AS uid)) = 'admin'::text));
alter policy "emp_leads_projetista_insert" on "crm"."leads" with check ((me_empresa_has_any_role('crm'::text, ARRAY['projetista'::text, 'projetista_admin'::text], ( SELECT auth.uid() AS uid)) AND (vendedor_responsavel_id = ( SELECT auth.uid() AS uid))));
alter policy "emp_leads_projetista_select" on "crm"."leads" using (me_empresa_has_any_role('crm'::text, ARRAY['projetista'::text, 'projetista_admin'::text], ( SELECT auth.uid() AS uid)));
alter policy "emp_leads_projetista_update" on "crm"."leads" using (me_empresa_has_any_role('crm'::text, ARRAY['projetista'::text, 'projetista_admin'::text], ( SELECT auth.uid() AS uid))) with check (me_empresa_has_any_role('crm'::text, ARRAY['projetista'::text, 'projetista_admin'::text], ( SELECT auth.uid() AS uid)));
alter policy "emp_leads_select_unificada" on "crm"."leads" using ((me_is_super_admin(( SELECT auth.uid() AS uid)) OR (me_get_empresa_role('crm'::text, ( SELECT auth.uid() AS uid)) = 'admin'::text) OR ((me_get_empresa_role('crm'::text, ( SELECT auth.uid() AS uid)) = 'vendedor'::text) AND (me_role_has_permission('vendedor'::text, 'all_leads'::text, 'view'::text) OR (vendedor_responsavel_id = ( SELECT auth.uid() AS uid)) OR (vendedor_responsavel_id IS NULL))) OR me_lead_linked_to_prestador('crm'::text, id, ( SELECT auth.uid() AS uid))));
alter policy "emp_leads_titular_lembrete_select" on "crm"."leads" using ((EXISTS ( SELECT 1
   FROM crm.lead_lembretes l
  WHERE ((l.lead_id = leads.id) AND (( SELECT auth.uid() AS uid) = ANY (l.titular_ids))))));
alter policy "emp_leads_vendedor_insert" on "crm"."leads" with check (((me_get_empresa_role('crm'::text, ( SELECT auth.uid() AS uid)) = 'vendedor'::text) AND me_role_has_permission('vendedor'::text, 'leads'::text, 'edit'::text)));
alter policy "emp_leads_vendedor_update" on "crm"."leads" using (((me_get_empresa_role('crm'::text, ( SELECT auth.uid() AS uid)) = 'vendedor'::text) AND me_role_has_permission('vendedor'::text, 'leads'::text, 'edit'::text) AND (me_role_has_permission('vendedor'::text, 'all_leads'::text, 'view'::text) OR (vendedor_responsavel_id = ( SELECT auth.uid() AS uid)) OR (vendedor_responsavel_id IS NULL))));
alter policy "obra_producao_delete" on "crm"."obra_producao" using (crm.me_can_config_producao(auth.uid()));
alter policy "obra_producao_insert" on "crm"."obra_producao" with check (crm.me_can_access_producao(auth.uid()));
alter policy "obra_producao_select" on "crm"."obra_producao" using (crm.me_can_access_producao(auth.uid()));
alter policy "obra_producao_update" on "crm"."obra_producao" using (crm.me_can_access_producao(auth.uid())) with check (crm.me_can_access_producao(auth.uid()));
alter policy "obra_producao_notas_delete" on "crm"."obra_producao_notas" using ((crm.me_can_config_producao(auth.uid()) OR (autor_id = auth.uid())));
alter policy "obra_producao_notas_insert" on "crm"."obra_producao_notas" with check ((crm.me_can_access_producao(auth.uid()) AND (autor_id = auth.uid())));
alter policy "obra_producao_notas_select" on "crm"."obra_producao_notas" using (crm.me_can_access_producao(auth.uid()));
alter policy "producao_stages_delete" on "crm"."producao_stages" using (crm.me_can_config_producao(auth.uid()));
alter policy "producao_stages_insert" on "crm"."producao_stages" with check (crm.me_can_config_producao(auth.uid()));
alter policy "producao_stages_select" on "crm"."producao_stages" using (crm.me_can_access_producao(auth.uid()));
alter policy "producao_stages_update" on "crm"."producao_stages" using (crm.me_can_config_producao(auth.uid())) with check (crm.me_can_config_producao(auth.uid()));

update public."CRM-multi-empresas>empresas<" set schema_nome = 'crm' where id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd';

grant usage on schema crm to anon, authenticated, service_role, app_tenant_definer;
