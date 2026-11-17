-- M14 (SQL) — Funções de usuário que continuam com o postgres (tocam auth.*) ganham checagem de empresa.
-- Elas ignoram RLS, então a empresa precisa ser conferida explicitamente.

-- Empresa a que um usuário pertence (null = sem vínculo).
create or replace function public.app_empresa_do_usuario(p_user_id uuid)
returns uuid language sql stable security definer set search_path = public, pg_temp as $$
  select empresa_id from "CRM-multi-empresas>usuario_empresa<" where user_id = p_user_id;
$$;
revoke all on function public.app_empresa_do_usuario(uuid) from public, anon, authenticated;

-- Aborta se quem chama não puder gerenciar o usuário alvo.
-- Master: qualquer um. Admin de empresa: só usuários da própria empresa (ou ainda sem vínculo),
-- e nunca o master.
create or replace function public.app_assert_usuario_gerenciavel(p_user_id uuid)
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_emp uuid;
begin
  if public.app_is_master() then return; end if;
  if public.me_is_super_admin(p_user_id) then
    raise exception 'Acesso negado: usuário master' using errcode = '42501';
  end if;
  v_emp := public.app_empresa_do_usuario(p_user_id);
  if v_emp is not null and v_emp is distinct from public.app_empresa_atual() then
    raise exception 'Acesso negado: usuário de outra empresa' using errcode = '42501';
  end if;
end $$;
revoke all on function public.app_assert_usuario_gerenciavel(uuid) from public, anon;
grant execute on function public.app_assert_usuario_gerenciavel(uuid) to authenticated, app_tenant_definer;

-- Vincula o usuário à empresa atual (se ainda não tiver vínculo).
create or replace function public.app_vincular_usuario_empresa_atual(p_user_id uuid)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_emp uuid := public.app_empresa_atual();
begin
  if v_emp is null then
    raise exception 'Sem empresa no contexto para vincular o usuário' using errcode = '42501';
  end if;
  if public.me_is_super_admin(p_user_id) then return; end if;
  insert into "CRM-multi-empresas>usuario_empresa<" (user_id, empresa_id) values (p_user_id, v_emp)
  on conflict (user_id) do nothing;
end $$;
revoke all on function public.app_vincular_usuario_empresa_atual(uuid) from public, anon, authenticated;

-- criar usuário ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.movelaria_criar_usuario(p_email text, p_senha text, p_nome text DEFAULT NULL::text, p_perfil text DEFAULT 'marceneiro'::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'extensions', 'auth', 'public'
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
    PERFORM public.app_assert_usuario_gerenciavel(v_id);

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

  PERFORM public.app_vincular_usuario_empresa_atual(v_id);
  RETURN v_id;
END;
$function$;

-- registrar usuário existente (2 assinaturas) ------------------------------------------------
CREATE OR REPLACE FUNCTION public.movelaria_registrar_usuario_existente(p_email text, p_nome text DEFAULT NULL::text, p_perfil text DEFAULT 'marceneiro'::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'extensions', 'auth', 'public'
AS $function$
BEGIN
  RETURN public.movelaria_registrar_usuario_existente(p_email, p_nome, p_perfil, NULL::text);
END;
$function$;

CREATE OR REPLACE FUNCTION public.movelaria_registrar_usuario_existente(p_email text, p_nome text DEFAULT NULL::text, p_perfil text DEFAULT 'marceneiro'::text, p_senha text DEFAULT NULL::text)
 RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'extensions', 'auth', 'public'
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
  PERFORM public.app_assert_usuario_gerenciavel(v_id);

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

  PERFORM public.app_vincular_usuario_empresa_atual(v_id);
  RETURN v_id;
END;
$function$;

-- excluir usuário -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.movelaria_excluir_usuario(p_id uuid)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'auth', 'public'
AS $function$
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem excluir usuários';
  END IF;
  IF p_id = auth.uid() THEN
    RAISE EXCEPTION 'Não é possível excluir o próprio usuário';
  END IF;
  PERFORM public.app_assert_usuario_gerenciavel(p_id);
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

  -- Remove o login (cascateia o perfil e o vínculo com a empresa)
  DELETE FROM auth.users WHERE id = p_id;
END;
$function$;

-- redefinir senha -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.movelaria_redefinir_senha(p_id uuid, p_senha text)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'extensions', 'auth', 'public'
AS $function$
DECLARE
  v_email TEXT;
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  PERFORM public.app_assert_usuario_gerenciavel(p_id);

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
$function$;

-- ficha do CRM: confere a empresa antes de gravar (a função ignora RLS) -----------------------
DO $$
DECLARE v_def text;
BEGIN
  SELECT pg_get_functiondef('public.movelaria_atualizar_ficha_crm(uuid,text,text[],text,text,text,text)'::regprocedure)
    INTO v_def;
  v_def := replace(v_def,
    E'  IF p_id IS NULL THEN\n    RAISE EXCEPTION ''Usuário obrigatório.'';\n  END IF;\n',
    E'  IF p_id IS NULL THEN\n    RAISE EXCEPTION ''Usuário obrigatório.'';\n  END IF;\n  PERFORM public.app_assert_usuario_gerenciavel(p_id);\n  PERFORM public.app_vincular_usuario_empresa_atual(p_id);\n');
  IF position('app_assert_usuario_gerenciavel' in v_def) = 0 THEN
    RAISE EXCEPTION 'Não consegui inserir a checagem de empresa em movelaria_atualizar_ficha_crm';
  END IF;
  EXECUTE v_def;
END $$;

-- métricas de sessão: só a empresa atual (master vê a empresa em que está) --------------------
CREATE OR REPLACE FUNCTION public.get_session_metrics(p_data_inicio timestamp with time zone, p_data_fim timestamp with time zone)
 RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  resultado JSON;
  v_emp UUID := public.app_empresa_atual();
BEGIN
  WITH sess AS (
    SELECT s.created_at, s.user_id
      FROM auth.sessions s
      JOIN "CRM-multi-empresas>usuario_empresa<" ue ON ue.user_id = s.user_id
     WHERE ue.empresa_id = v_emp
       AND s.created_at BETWEEN p_data_inicio AND p_data_fim
  ),
  acessos_por_dia AS (
    SELECT DATE(created_at AT TIME ZONE 'America/Sao_Paulo') as dia, COUNT(*) as total
      FROM sess GROUP BY 1 ORDER BY dia DESC
  ),
  totais AS (
    SELECT COUNT(DISTINCT user_id) as total_usuarios_unicos FROM sess
  )
  SELECT json_build_object(
    'acessos_hoje', COALESCE(
      (SELECT total FROM acessos_por_dia WHERE dia = (CURRENT_TIMESTAMP AT TIME ZONE 'America/Sao_Paulo')::date), 0
    ),
    'usuarios_unicos', (SELECT total_usuarios_unicos FROM totais),
    'media_sessoes_dia', COALESCE((SELECT AVG(total)::numeric(10,1) FROM acessos_por_dia), 0),
    'acessos_por_dia', COALESCE(
      (SELECT json_agg(json_build_object('dia', dia::text, 'total', total) ORDER BY dia DESC) FROM acessos_por_dia),
      '[]'::json
    )
  ) INTO resultado;
  RETURN resultado;
END;
$function$;

-- Legado do schema por empresa: fora de uso (a criação de empresa passa a ser master-criar-empresa).
revoke execute on function public.me_criar_empresa(text, text, text) from public, anon, authenticated;
revoke execute on function public.me_vincular_usuario_empresa(text, text, text, text) from public, anon, authenticated;
