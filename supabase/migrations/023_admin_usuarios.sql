-- ============================================================
-- GARBO Movelaria — Gestão de Usuários pelo Admin
-- Migration 023
-- ============================================================

-- ── Criar usuário diretamente no auth.users ──────────────────
CREATE OR REPLACE FUNCTION movelaria_criar_usuario(
  p_email  TEXT,
  p_senha  TEXT,
  p_nome   TEXT    DEFAULT NULL,
  p_perfil TEXT    DEFAULT 'marceneiro'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID := gen_random_uuid();
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem criar usuários';
  END IF;
  IF p_perfil NOT IN ('administrador','financeiro','marceneiro','montador','montador_admin') THEN
    RAISE EXCEPTION 'Perfil inválido: %', p_perfil;
  END IF;

  -- Insere na tabela de autenticação do Supabase
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
    p_email,
    crypt(p_senha, gen_salt('bf')),
    NOW(),
    '{"provider":"email","providers":["email"]}'::jsonb,
    '{}'::jsonb,
    false, false,
    NOW(), NOW()
  );

  -- O trigger trg_movelaria_novo_usuario criou o perfil com 'marceneiro'.
  -- Atualiza para o perfil e nome desejados.
  UPDATE movelaria_usuarios
  SET perfil = p_perfil, nome = p_nome, atualizado_em = NOW()
  WHERE id = v_id;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = extensions, auth, public;

REVOKE ALL ON FUNCTION movelaria_criar_usuario(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_criar_usuario(TEXT, TEXT, TEXT, TEXT) TO authenticated;

-- ── Excluir usuário (remove de auth.users; cascateia para movelaria_usuarios) ──
CREATE OR REPLACE FUNCTION movelaria_excluir_usuario(p_id UUID)
RETURNS void AS $$
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem excluir usuários';
  END IF;
  IF p_id = auth.uid() THEN
    RAISE EXCEPTION 'Não é possível excluir o próprio usuário';
  END IF;
  DELETE FROM auth.users WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = auth, public;

REVOKE ALL ON FUNCTION movelaria_excluir_usuario(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_excluir_usuario(UUID) TO authenticated;

-- ── Redefinir senha de um usuário ─────────────────────────────
CREATE OR REPLACE FUNCTION movelaria_redefinir_senha(p_id UUID, p_senha TEXT)
RETURNS void AS $$
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  UPDATE auth.users
  SET encrypted_password = crypt(p_senha, gen_salt('bf')),
      updated_at = NOW()
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = extensions, auth, public;

REVOKE ALL ON FUNCTION movelaria_redefinir_senha(UUID, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_redefinir_senha(UUID, TEXT) TO authenticated;
