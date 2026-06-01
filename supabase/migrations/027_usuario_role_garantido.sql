-- ============================================================
-- Migration 027 — Garante user role em todas as operações
-- ============================================================

-- ── 1. Redefinir senha + criar role se não existir ───────────
CREATE OR REPLACE FUNCTION movelaria_redefinir_senha(
  p_id     UUID,
  p_senha  TEXT,
  p_perfil TEXT    DEFAULT NULL,
  p_nome   TEXT    DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_email TEXT;
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Atualiza senha com cost 10
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(p_senha, extensions.gen_salt('bf', 10)),
      -- Garante tokens como string vazia (GoTrue exige)
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

  -- Cria/atualiza movelaria_usuarios se perfil foi informado
  IF p_perfil IS NOT NULL AND v_email IS NOT NULL THEN
    INSERT INTO public.movelaria_usuarios (id, email, nome, perfil, ativo)
    VALUES (p_id, v_email, p_nome, p_perfil, true)
    ON CONFLICT (id) DO UPDATE
      SET perfil = EXCLUDED.perfil,
          nome   = COALESCE(EXCLUDED.nome, public.movelaria_usuarios.nome),
          ativo  = true,
          atualizado_em = NOW();

    -- Garante identity para login via email
    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (gen_random_uuid(), p_id, v_email,
      jsonb_build_object('sub', p_id::text, 'email', v_email, 'email_verified', true),
      'email', NOW(), NOW(), NOW())
    ON CONFLICT (provider, provider_id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = extensions, auth, public;

REVOKE ALL ON FUNCTION movelaria_redefinir_senha(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_redefinir_senha(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- Mantém assinatura antiga (2 params) como alias
DROP FUNCTION IF EXISTS movelaria_redefinir_senha(UUID, TEXT);
CREATE OR REPLACE FUNCTION movelaria_redefinir_senha(p_id UUID, p_senha TEXT)
RETURNS void AS $$
BEGIN
  PERFORM movelaria_redefinir_senha(p_id, p_senha, NULL, NULL);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = extensions, auth, public;

REVOKE ALL ON FUNCTION movelaria_redefinir_senha(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_redefinir_senha(UUID, TEXT) TO authenticated;

-- ── 2. Registrar existente + senha opcional ──────────────────
CREATE OR REPLACE FUNCTION movelaria_registrar_usuario_existente(
  p_email  TEXT,
  p_nome   TEXT    DEFAULT NULL,
  p_perfil TEXT    DEFAULT 'marceneiro',
  p_senha  TEXT    DEFAULT NULL
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

  SELECT id INTO v_id FROM auth.users WHERE lower(email) = lower(p_email);
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'Nenhum usuário encontrado com o e-mail "%"', p_email;
  END IF;

  -- Cria/atualiza movelaria_usuarios
  INSERT INTO public.movelaria_usuarios (id, email, nome, perfil, ativo)
  VALUES (v_id, lower(p_email), p_nome, p_perfil, true)
  ON CONFLICT (id) DO UPDATE
    SET nome   = COALESCE(EXCLUDED.nome, public.movelaria_usuarios.nome),
        perfil = EXCLUDED.perfil,
        ativo  = true,
        atualizado_em = NOW();

  -- Define senha se fornecida + corrige tokens
  IF p_senha IS NOT NULL AND p_senha <> '' THEN
    UPDATE auth.users
    SET encrypted_password     = extensions.crypt(p_senha, extensions.gen_salt('bf', 10)),
        confirmation_token     = COALESCE(confirmation_token, ''),
        recovery_token         = COALESCE(recovery_token, ''),
        email_change_token_new = COALESCE(email_change_token_new, ''),
        email_change           = COALESCE(email_change, ''),
        email_change_token_current = COALESCE(email_change_token_current, ''),
        phone_change_token     = COALESCE(phone_change_token, ''),
        reauthentication_token = COALESCE(reauthentication_token, ''),
        updated_at             = NOW()
    WHERE id = v_id;
  END IF;

  -- Garante identity para email/password login
  INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  VALUES (gen_random_uuid(), v_id, lower(p_email),
    jsonb_build_object('sub', v_id::text, 'email', lower(p_email), 'email_verified', true),
    'email', NOW(), NOW(), NOW())
  ON CONFLICT (provider, provider_id) DO NOTHING;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = extensions, auth, public;

REVOKE ALL ON FUNCTION movelaria_registrar_usuario_existente(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_registrar_usuario_existente(TEXT, TEXT, TEXT, TEXT) TO authenticated;
