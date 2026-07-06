-- Remove ambiguidade entre overloads (PostgREST não consegue escolher a assinatura).
-- Aceita qualquer senha com pelo menos 6 caracteres (inclui só números).

DROP FUNCTION IF EXISTS public.movelaria_redefinir_senha(UUID, TEXT);
DROP FUNCTION IF EXISTS public.movelaria_redefinir_senha(UUID, TEXT, TEXT, TEXT);

CREATE OR REPLACE FUNCTION public.movelaria_redefinir_senha(
  p_id    UUID,
  p_senha TEXT
)
RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = extensions, auth, public;

REVOKE ALL ON FUNCTION public.movelaria_redefinir_senha(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.movelaria_redefinir_senha(UUID, TEXT) TO authenticated;
