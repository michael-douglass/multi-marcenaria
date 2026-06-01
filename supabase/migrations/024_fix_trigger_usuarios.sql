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

-- ── 3. Corrigir movelaria_criar_usuario (se email já existe, registra) ──
CREATE OR REPLACE FUNCTION movelaria_criar_usuario(
  p_email  TEXT,
  p_senha  TEXT,
  p_nome   TEXT    DEFAULT NULL,
  p_perfil TEXT    DEFAULT 'marceneiro'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem criar usuários';
  END IF;
  IF p_perfil NOT IN ('administrador','financeiro','marceneiro','montador','montador_admin') THEN
    RAISE EXCEPTION 'Perfil inválido: %', p_perfil;
  END IF;

  -- Verifica se o e-mail já existe em auth.users
  SELECT id INTO v_id FROM auth.users WHERE lower(email) = lower(p_email);

  IF v_id IS NOT NULL THEN
    -- Usuário já existe no auth: apenas registra/atualiza o perfil movelaria
    INSERT INTO public.movelaria_usuarios (id, email, nome, perfil, ativo)
    VALUES (v_id, p_email, p_nome, p_perfil, true)
    ON CONFLICT (id) DO UPDATE
      SET nome          = COALESCE(EXCLUDED.nome, public.movelaria_usuarios.nome),
          perfil        = EXCLUDED.perfil,
          ativo         = true,
          atualizado_em = NOW();

    -- Atualiza senha se fornecida
    IF p_senha IS NOT NULL AND p_senha <> '' THEN
      UPDATE auth.users
      SET encrypted_password = crypt(p_senha, gen_salt('bf')), updated_at = NOW()
      WHERE id = v_id;
    END IF;
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
      lower(p_email),
      crypt(p_senha, gen_salt('bf')),
      NOW(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      '{}'::jsonb,
      false, false,
      NOW(), NOW()
    );

    -- Atualiza perfil criado pelo trigger (ou cria se trigger falhou)
    INSERT INTO public.movelaria_usuarios (id, email, nome, perfil, ativo)
    VALUES (v_id, lower(p_email), p_nome, p_perfil, true)
    ON CONFLICT (id) DO UPDATE
      SET nome = p_nome, perfil = p_perfil, ativo = true, atualizado_em = NOW();
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = extensions, auth, public;

REVOKE ALL ON FUNCTION movelaria_criar_usuario(TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_criar_usuario(TEXT, TEXT, TEXT, TEXT) TO authenticated;
