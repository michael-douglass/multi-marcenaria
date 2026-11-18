CREATE OR REPLACE FUNCTION public.get_session_metrics(p_data_inicio timestamp with time zone, p_data_fim timestamp with time zone)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  resultado JSON;
BEGIN
  WITH acessos_por_dia AS (
    SELECT 
      DATE(created_at AT TIME ZONE 'America/Sao_Paulo') as dia,
      COUNT(*) as total
    FROM auth.sessions
    WHERE created_at BETWEEN p_data_inicio AND p_data_fim
    GROUP BY DATE(created_at AT TIME ZONE 'America/Sao_Paulo')
    ORDER BY dia DESC
  ),
  totais AS (
    SELECT 
      COUNT(DISTINCT user_id) as total_usuarios_unicos
    FROM auth.sessions
    WHERE created_at BETWEEN p_data_inicio AND p_data_fim
  )
  SELECT json_build_object(
    'acessos_hoje', COALESCE(
      (SELECT total FROM acessos_por_dia WHERE dia = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date), 0
    ),
    'usuarios_unicos', (SELECT total_usuarios_unicos FROM totais),
    'media_sessoes_dia', COALESCE(
      (SELECT AVG(total)::numeric(10,1) FROM acessos_por_dia), 0
    ),
    'acessos_por_dia', COALESCE(
      (SELECT json_agg(json_build_object('dia', dia::text, 'total', total) ORDER BY dia DESC)
       FROM acessos_por_dia),
      '[]'::json
    )
  ) INTO resultado;
  
  RETURN resultado;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.me_limpar_vinculos_auth_user(_user_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
DECLARE
  r record;
  cleared integer := 0;
  def text;
  is_nullable boolean;
BEGIN
  IF _user_id IS NULL THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT
      nsp.nspname AS schema_name,
      cls.relname AS table_name,
      att.attname AS column_name,
      pg_get_constraintdef(c.oid) AS constraint_def
    FROM pg_constraint c
    JOIN pg_class cls ON cls.oid = c.conrelid
    JOIN pg_namespace nsp ON nsp.oid = cls.relnamespace
    JOIN pg_attribute att ON att.attrelid = c.conrelid
      AND att.attnum = ANY (c.conkey)
      AND NOT att.attisdropped
    WHERE c.confrelid = 'auth.users'::regclass
      AND c.contype = 'f'
      AND nsp.nspname = 'public'
  LOOP
    def := r.constraint_def;
    IF def LIKE '%ON DELETE CASCADE%' OR def LIKE '%ON DELETE SET NULL%' THEN
      CONTINUE;
    END IF;

    SELECT a.is_nullable = 'YES'
    INTO is_nullable
    FROM information_schema.columns a
    WHERE a.table_schema = r.schema_name
      AND a.table_name = r.table_name
      AND a.column_name = r.column_name;

    BEGIN
      IF is_nullable THEN
        EXECUTE format(
          'UPDATE %I.%I SET %I = NULL WHERE %I = $1',
          r.schema_name, r.table_name, r.column_name, r.column_name
        ) USING _user_id;
      ELSE
        EXECUTE format(
          'DELETE FROM %I.%I WHERE %I = $1',
          r.schema_name, r.table_name, r.column_name
        ) USING _user_id;
      END IF;
      cleared := cleared + 1;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'me_limpar_vinculos_auth_user %.%: %',
        r.schema_name, r.table_name, SQLERRM;
    END;
  END LOOP;

  RETURN cleared;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.me_vincular_usuario_empresa(p_email text, p_empresa_slug text, p_role text DEFAULT 'vendedor'::text, p_nome text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_user_id UUID;
  v_empresa_id UUID;
  v_schema TEXT;
  v_nome TEXT;
BEGIN
  IF NOT me_is_super_admin(auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: apenas super admins';
  END IF;

  SELECT id INTO v_user_id
  FROM auth.users
  WHERE lower(email) = lower(trim(p_email))
  LIMIT 1;

  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado no Auth: %', p_email;
  END IF;

  SELECT id, schema_nome INTO v_empresa_id, v_schema
  FROM public."CRM-multi-empresas>empresas<"
  WHERE slug = p_empresa_slug OR schema_nome = 'emp_' || p_empresa_slug
  LIMIT 1;

  IF v_empresa_id IS NULL THEN
    RAISE EXCEPTION 'Empresa não encontrada: %', p_empresa_slug;
  END IF;

  v_nome := COALESCE(NULLIF(trim(p_nome), ''), split_part(p_email, '@', 1));

  EXECUTE format(
    $sql$
      INSERT INTO %I.usuarios (id, nome, email, status_convite)
      VALUES ($1, $2, $3, 'ATIVO')
      ON CONFLICT (id) DO UPDATE SET
        nome = EXCLUDED.nome,
        email = EXCLUDED.email,
        status_convite = 'ATIVO'
    $sql$,
    v_schema
  ) USING v_user_id, v_nome, lower(trim(p_email));

  EXECUTE format(
    $sql$
      INSERT INTO %I.user_roles (user_id, role)
      VALUES ($1, $2::app_role)
      ON CONFLICT (user_id) DO UPDATE SET role = EXCLUDED.role
    $sql$,
    v_schema
  ) USING v_user_id, p_role;

  INSERT INTO public."CRM-multi-empresas>usuario_empresa<" (user_id, empresa_id)
  VALUES (v_user_id, v_empresa_id)
  ON CONFLICT (user_id, empresa_id) DO NOTHING;

  RETURN v_user_id;
END;
$function$

;
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
$function$

;
CREATE OR REPLACE FUNCTION public.movelaria_atualizar_perfil_usuario(p_id uuid, p_perfil text, p_ativo boolean DEFAULT NULL::boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem alterar perfis';
  END IF;

  UPDATE movelaria_usuarios
  SET
    perfil        = COALESCE(p_perfil, perfil),
    ativo         = COALESCE(p_ativo, ativo),
    atualizado_em = NOW()
  WHERE id = p_id;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.movelaria_atualizar_perfil_usuario(p_id uuid, p_perfil text, p_nome text DEFAULT NULL::text, p_ativo boolean DEFAULT NULL::boolean, p_perfis_extras text[] DEFAULT NULL::text[])
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_valid TEXT[] := movelaria_perfis_validos();
  v_extra TEXT;
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem alterar perfis';
  END IF;
  IF p_perfil IS NOT NULL AND NOT (p_perfil = ANY(v_valid)) THEN
    RAISE EXCEPTION 'Perfil inválido: %', p_perfil;
  END IF;
  IF p_perfis_extras IS NOT NULL THEN
    FOREACH v_extra IN ARRAY p_perfis_extras LOOP
      IF NOT (v_extra = ANY(v_valid)) THEN
        RAISE EXCEPTION 'Perfil extra inválido: %', v_extra;
      END IF;
    END LOOP;
  END IF;

  UPDATE movelaria_usuarios
  SET
    perfil        = COALESCE(p_perfil, perfil),
    nome          = COALESCE(p_nome, nome),
    ativo         = COALESCE(p_ativo, ativo),
    perfis_extras = COALESCE(p_perfis_extras, perfis_extras),
    atualizado_em = NOW()
  WHERE id = p_id;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.movelaria_criar_usuario(p_email text, p_senha text, p_nome text DEFAULT NULL::text, p_perfil text DEFAULT 'marceneiro'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'extensions', 'auth', 'public'
AS $function$
DECLARE
  v_id    UUID;
  v_email TEXT := lower(trim(p_email));
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF NOT (p_perfil = ANY(movelaria_perfis_validos())) THEN
    RAISE EXCEPTION 'Perfil inválido: %', p_perfil;
  END IF;

  SELECT id INTO v_id FROM auth.users WHERE lower(email) = v_email;

  IF v_id IS NOT NULL THEN
    INSERT INTO public.movelaria_usuarios (id, email, nome, perfil, ativo)
    VALUES (v_id, v_email, p_nome, p_perfil, true)
    ON CONFLICT (id) DO UPDATE
      SET nome   = COALESCE(EXCLUDED.nome, public.movelaria_usuarios.nome),
          perfil = EXCLUDED.perfil,
          ativo  = true,
          atualizado_em = NOW();

    IF p_senha IS NOT NULL AND p_senha <> '' THEN
      UPDATE auth.users
      SET encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf', 10)),
          updated_at = NOW()
      WHERE id = v_id;
    END IF;

    UPDATE auth.users
    SET
      confirmation_token         = COALESCE(confirmation_token, ''),
      recovery_token             = COALESCE(recovery_token, ''),
      email_change_token_new     = COALESCE(email_change_token_new, ''),
      email_change               = COALESCE(email_change, ''),
      email_change_token_current = COALESCE(email_change_token_current, ''),
      phone_change_token         = COALESCE(phone_change_token, ''),
      reauthentication_token     = COALESCE(reauthentication_token, '')
    WHERE id = v_id;

    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), v_id, v_email,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
      'email', NOW(), NOW(), NOW()
    )
    ON CONFLICT (provider, provider_id) DO NOTHING;

  ELSE
    v_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      is_sso_user, is_anonymous,
      created_at, updated_at,
      confirmation_token, recovery_token,
      email_change_token_new, email_change,
      email_change_token_current, phone_change_token,
      reauthentication_token
    ) VALUES (
      v_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      v_email,
      extensions.crypt(p_senha, extensions.gen_salt('bf', 10)),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      false, false,
      NOW(), NOW(),
      '', '', '', '', '', '', ''
    );

    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), v_id, v_email,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
      'email', NOW(), NOW(), NOW()
    );

    INSERT INTO public.movelaria_usuarios (id, email, nome, perfil, ativo)
    VALUES (v_id, v_email, p_nome, p_perfil, true)
    ON CONFLICT (id) DO UPDATE
      SET nome = p_nome, perfil = p_perfil, ativo = true, atualizado_em = NOW();
  END IF;

  RETURN v_id;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.movelaria_excluir_usuario(p_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'auth', 'public'
AS $function$
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem excluir usuários';
  END IF;
  IF p_id = auth.uid() THEN
    RAISE EXCEPTION 'Não é possível excluir o próprio usuário';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM movelaria_usuarios WHERE id = p_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  -- Contas em aberto (fixo/comissão) saem de Contas a Pagar
  DELETE FROM movelaria_contas_pagar
  WHERE prestador_id = p_id
    AND status <> 'pago';

  -- Contas já pagas: desvincula, mantém o histórico financeiro
  UPDATE movelaria_contas_pagar
  SET prestador_id = NULL
  WHERE prestador_id = p_id;

  -- Pasta de funcionário: dispensa e solta o login (ponto permanece)
  UPDATE movelaria_funcionarios
  SET
    ativo = false,
    usuario_id = NULL,
    dispensado_em = COALESCE(dispensado_em, NOW()),
    atualizado_em = NOW()
  WHERE usuario_id = p_id;

  -- Remove o login (cascateia o perfil; ponto.usuario_id vira NULL)
  DELETE FROM auth.users WHERE id = p_id;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.movelaria_redefinir_senha(p_id uuid, p_senha text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'extensions', 'auth', 'public'
AS $function$
DECLARE
  v_email TEXT;
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_senha IS NULL OR length(p_senha) < 6 THEN
    RAISE EXCEPTION 'Senha inválida: mínimo de 6 caracteres';
  END IF;

  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf', 10)),
      confirmation_token         = COALESCE(confirmation_token, ''),
      recovery_token             = COALESCE(recovery_token, ''),
      email_change_token_new     = COALESCE(email_change_token_new, ''),
      email_change               = COALESCE(email_change, ''),
      email_change_token_current = COALESCE(email_change_token_current, ''),
      phone_change_token         = COALESCE(phone_change_token, ''),
      reauthentication_token     = COALESCE(reauthentication_token, ''),
      updated_at = NOW()
  WHERE id = p_id
  RETURNING email INTO v_email;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.movelaria_registrar_usuario_existente(p_email text, p_nome text DEFAULT NULL::text, p_perfil text DEFAULT 'marceneiro'::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'extensions', 'auth', 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF p_perfil NOT IN ('administrador','financeiro','marceneiro','montador','montador_admin') THEN
    RAISE EXCEPTION 'Perfil inválido: %', p_perfil;
  END IF;

  -- Busca por email em auth.users (case-insensitive)
  SELECT id INTO v_id
  FROM auth.users
  WHERE lower(email) = lower(p_email)
  LIMIT 1;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário encontrado com o e-mail "%"', p_email;
  END IF;

  -- Cria ou atualiza o perfil movelaria
  INSERT INTO public.movelaria_usuarios (id, email, nome, perfil, ativo)
  VALUES (v_id, p_email, p_nome, p_perfil, true)
  ON CONFLICT (id) DO UPDATE
    SET nome          = COALESCE(EXCLUDED.nome, public.movelaria_usuarios.nome),
        perfil        = EXCLUDED.perfil,
        ativo         = true,
        atualizado_em = NOW();

  RETURN v_id;
END;
$function$

;
CREATE OR REPLACE FUNCTION public.movelaria_registrar_usuario_existente(p_email text, p_nome text DEFAULT NULL::text, p_perfil text DEFAULT 'marceneiro'::text, p_senha text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'extensions', 'auth', 'public'
AS $function$
DECLARE
  v_id UUID;
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF NOT (p_perfil = ANY(movelaria_perfis_validos())) THEN
    RAISE EXCEPTION 'Perfil inválido: %', p_perfil;
  END IF;

  SELECT id INTO v_id FROM auth.users WHERE lower(email) = lower(p_email);
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário encontrado com o e-mail "%"', p_email;
  END IF;

  INSERT INTO public.movelaria_usuarios (id, email, nome, perfil, ativo)
  VALUES (v_id, lower(p_email), p_nome, p_perfil, true)
  ON CONFLICT (id) DO UPDATE
    SET nome   = COALESCE(EXCLUDED.nome, public.movelaria_usuarios.nome),
        perfil = EXCLUDED.perfil,
        ativo  = true,
        atualizado_em = NOW();

  IF p_senha IS NOT NULL AND p_senha <> '' THEN
    UPDATE auth.users
    SET encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf', 10)),
        updated_at = NOW()
    WHERE id = v_id;
  END IF;

  RETURN v_id;
END;
$function$
