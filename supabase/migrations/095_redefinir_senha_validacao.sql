-- Valida redefinição de senha: falha se usuário não existir ou senha vazia

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

  IF p_senha IS NULL OR length(trim(p_senha)) < 6 THEN
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

  IF p_perfil IS NOT NULL THEN
    INSERT INTO public.movelaria_usuarios (id, email, nome, perfil, ativo)
    VALUES (p_id, v_email, p_nome, p_perfil, true)
    ON CONFLICT (id) DO UPDATE
      SET perfil = EXCLUDED.perfil,
          nome   = COALESCE(EXCLUDED.nome, public.movelaria_usuarios.nome),
          ativo  = true,
          atualizado_em = NOW();

    INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
    VALUES (
      gen_random_uuid(), p_id, v_email,
      jsonb_build_object('sub', p_id::text, 'email', v_email, 'email_verified', true),
      'email', NOW(), NOW(), NOW()
    )
    ON CONFLICT (provider, provider_id) DO NOTHING;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = extensions, auth, public;

REVOKE ALL ON FUNCTION movelaria_redefinir_senha(UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_redefinir_senha(UUID, TEXT, TEXT, TEXT) TO authenticated;

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
