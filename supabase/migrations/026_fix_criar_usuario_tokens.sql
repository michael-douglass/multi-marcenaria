-- ============================================================
-- Migration 026 — Corrige movelaria_criar_usuario
-- Inclui tokens como '' e bcrypt cost 10 (GoTrue-compatível)
-- ============================================================

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
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  IF p_perfil NOT IN ('administrador','financeiro','marceneiro','montador','montador_admin') THEN
    RAISE EXCEPTION 'Perfil inválido: %', p_perfil;
  END IF;

  SELECT id INTO v_id FROM auth.users WHERE lower(email) = v_email;

  IF v_id IS NOT NULL THEN
    -- Usuário já existe: atualiza perfil + senha + garante identity
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

    -- Corrige tokens NULL → ''
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
    -- Novo usuário: cria com TODOS os campos que GoTrue espera
    v_id := gen_random_uuid();

    INSERT INTO auth.users (
      id, instance_id, aud, role,
      email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data,
      is_sso_user, is_anonymous,
      created_at, updated_at,
      -- Tokens como string vazia (GoTrue exige '', não NULL)
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
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = extensions, auth, public;

REVOKE ALL ON FUNCTION movelaria_criar_usuario(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_criar_usuario(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- Corrige movelaria_redefinir_senha para usar cost 10
CREATE OR REPLACE FUNCTION movelaria_redefinir_senha(p_id UUID, p_senha TEXT)
RETURNS void AS $$
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf', 10)),
      updated_at = NOW()
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = extensions, auth, public;

REVOKE ALL ON FUNCTION movelaria_redefinir_senha(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_redefinir_senha(UUID, TEXT) TO authenticated;

-- Corrige tokens NULL de usuários JÁ existentes
UPDATE auth.users
SET
  confirmation_token         = COALESCE(confirmation_token, ''),
  recovery_token             = COALESCE(recovery_token, ''),
  email_change_token_new     = COALESCE(email_change_token_new, ''),
  email_change               = COALESCE(email_change, ''),
  email_change_token_current = COALESCE(email_change_token_current, ''),
  phone_change_token         = COALESCE(phone_change_token, ''),
  reauthentication_token     = COALESCE(reauthentication_token, ''),
  updated_at                 = NOW()
WHERE id IN (SELECT id FROM public.movelaria_usuarios)
  AND (
    confirmation_token IS NULL OR
    recovery_token IS NULL OR
    email_change_token_new IS NULL
  );
