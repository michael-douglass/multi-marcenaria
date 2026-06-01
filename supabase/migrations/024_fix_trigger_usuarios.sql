-- ============================================================
-- GARBO Movelaria — Corrige trigger de usuários + registra existentes
-- Migration 024
-- ============================================================

-- ── 1. Corrigir trigger (adiciona search_path) ────────────────
CREATE OR REPLACE FUNCTION movelaria_ao_criar_usuario()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.movelaria_usuarios (id, email, perfil)
  VALUES (NEW.id, NEW.email, 'marceneiro')
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = public;

-- ── 2. Registrar usuário auth.users existente no movelaria ────
-- Útil para usuários do CRM que precisam de acesso ao Movelaria.
CREATE OR REPLACE FUNCTION movelaria_registrar_usuario_existente(
  p_email  TEXT,
  p_nome   TEXT    DEFAULT NULL,
  p_perfil TEXT    DEFAULT 'marceneiro'
)
RETURNS UUID AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = extensions, auth, public;

REVOKE ALL ON FUNCTION movelaria_registrar_usuario_existente(TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_registrar_usuario_existente(TEXT, TEXT, TEXT) TO authenticated;

-- ── 3. Corrigir movelaria_criar_usuario (cria identity + perfil) ──
CREATE OR REPLACE FUNCTION movelaria_criar_usuario(
  p_email  TEXT,
  p_senha  TEXT,
  p_nome   TEXT    DEFAULT NULL,
  p_perfil TEXT    DEFAULT 'marceneiro'
)
RETURNS UUID AS $$
DECLARE
  v_id    UUID;
  v_email TEXT := lower(trim(p_email));
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem criar usuários';
  END IF;
  IF p_perfil NOT IN ('administrador','financeiro','marceneiro','montador','montador_admin') THEN
    RAISE EXCEPTION 'Perfil inválido: %', p_perfil;
  END IF;

  -- Verifica se o e-mail já existe em auth.users
  SELECT id INTO v_id FROM auth.users WHERE lower(email) = v_email;

  IF v_id IS NOT NULL THEN
    -- Usuário já existe: apenas registra/atualiza o perfil movelaria
    INSERT INTO public.movelaria_usuarios (id, email, nome, perfil, ativo)
    VALUES (v_id, v_email, p_nome, p_perfil, true)
    ON CONFLICT (id) DO UPDATE
      SET nome = COALESCE(EXCLUDED.nome, public.movelaria_usuarios.nome),
          perfil = EXCLUDED.perfil,
          ativo = true,
          atualizado_em = NOW();

    -- Atualiza senha se fornecida
    IF p_senha IS NOT NULL AND p_senha <> '' THEN
      UPDATE auth.users
      SET encrypted_password = crypt(p_senha, gen_salt('bf')), updated_at = NOW()
      WHERE id = v_id;
    END IF;

    -- Garante que existe identity (pode estar faltando em usuários antigos)
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), v_id, v_email,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
      'email', NOW(), NOW(), NOW()
    )
    ON CONFLICT (provider, provider_id) DO NOTHING;

  ELSE
    -- Cria novo usuário no auth
    v_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password,
      email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      is_sso_user, is_anonymous,
      created_at, updated_at
    ) VALUES (
      v_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated', 'authenticated',
      v_email,
      crypt(p_senha, gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      false, false,
      NOW(), NOW()
    );

    -- Cria a identity (obrigatória para o GoTrue autenticar)
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), v_id, v_email,
      jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
      'email', NOW(), NOW(), NOW()
    );

    -- Cria ou atualiza perfil movelaria
    INSERT INTO public.movelaria_usuarios (id, email, nome, perfil, ativo)
    VALUES (v_id, v_email, p_nome, p_perfil, true)
    ON CONFLICT (id) DO UPDATE
      SET nome = p_nome, perfil = p_perfil, ativo = true, atualizado_em = NOW();
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = extensions, auth, public;

REVOKE ALL ON FUNCTION movelaria_criar_usuario(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_criar_usuario(TEXT, TEXT, TEXT, TEXT) TO authenticated;
