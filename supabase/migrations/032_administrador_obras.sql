-- ============================================================
-- GARBO Movelaria — Perfil Administrador de Obras
-- Migration 032
-- ============================================================

-- ── 1. Ampliar CHECK de perfil ────────────────────────────────
ALTER TABLE movelaria_usuarios
  DROP CONSTRAINT IF EXISTS movelaria_usuarios_perfil_check;

ALTER TABLE movelaria_usuarios
  ADD CONSTRAINT movelaria_usuarios_perfil_check
  CHECK (perfil IN (
    'administrador', 'financeiro', 'marceneiro', 'montador', 'montador_admin', 'administrador_obras'
  ));

-- ── 2. Funções de gestão de usuários ─────────────────────────
CREATE OR REPLACE FUNCTION movelaria_atualizar_perfil_usuario(
  p_id     UUID,
  p_perfil TEXT,
  p_nome   TEXT    DEFAULT NULL,
  p_ativo  BOOLEAN DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem alterar perfis';
  END IF;
  IF p_perfil IS NOT NULL AND p_perfil NOT IN (
    'administrador','financeiro','marceneiro','montador','montador_admin','administrador_obras'
  ) THEN
    RAISE EXCEPTION 'Perfil inválido: %', p_perfil;
  END IF;
  UPDATE movelaria_usuarios
  SET
    perfil        = COALESCE(p_perfil, perfil),
    nome          = COALESCE(p_nome, nome),
    ativo         = COALESCE(p_ativo, ativo),
    atualizado_em = NOW()
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

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
  IF p_perfil NOT IN ('administrador','financeiro','marceneiro','montador','montador_admin','administrador_obras') THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = extensions, auth, public;

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
  IF p_perfil NOT IN ('administrador','financeiro','marceneiro','montador','montador_admin','administrador_obras') THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = extensions, auth, public;

-- ── 3. RLS — Grupos e Tipos de Obra ──────────────────────────
DROP POLICY IF EXISTS "grupos_obra_insert" ON movelaria_grupos_obra;
CREATE POLICY "grupos_obra_insert" ON movelaria_grupos_obra
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'administrador_obras'));

DROP POLICY IF EXISTS "grupos_obra_update" ON movelaria_grupos_obra;
CREATE POLICY "grupos_obra_update" ON movelaria_grupos_obra
  FOR UPDATE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'administrador_obras'))
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'administrador_obras'));

DROP POLICY IF EXISTS "grupos_obra_delete" ON movelaria_grupos_obra;
CREATE POLICY "grupos_obra_delete" ON movelaria_grupos_obra
  FOR DELETE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'administrador_obras'));

DROP POLICY IF EXISTS "tipos_obra_insert" ON movelaria_tipos_obra;
CREATE POLICY "tipos_obra_insert" ON movelaria_tipos_obra
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'administrador_obras'));

DROP POLICY IF EXISTS "tipos_obra_update" ON movelaria_tipos_obra;
CREATE POLICY "tipos_obra_update" ON movelaria_tipos_obra
  FOR UPDATE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'administrador_obras'))
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'administrador_obras'));

DROP POLICY IF EXISTS "tipos_obra_delete" ON movelaria_tipos_obra;
CREATE POLICY "tipos_obra_delete" ON movelaria_tipos_obra
  FOR DELETE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'administrador_obras'));

-- ── 4. RLS — Obras ───────────────────────────────────────────
DROP POLICY IF EXISTS "obras_select_admin" ON movelaria_obras;
CREATE POLICY "obras_select_admin" ON movelaria_obras
  FOR SELECT TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro', 'administrador_obras'));

DROP POLICY IF EXISTS "obras_insert" ON movelaria_obras;
CREATE POLICY "obras_insert" ON movelaria_obras
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador','montador_admin','financeiro','administrador_obras'));

DROP POLICY IF EXISTS "obras_update_admin" ON movelaria_obras;
CREATE POLICY "obras_update_admin" ON movelaria_obras
  FOR UPDATE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador','montador_admin','financeiro','administrador_obras'))
  WITH CHECK (movelaria_meu_perfil() IN ('administrador','montador_admin','financeiro','administrador_obras'));

DROP POLICY IF EXISTS "obras_delete" ON movelaria_obras;
CREATE POLICY "obras_delete" ON movelaria_obras
  FOR DELETE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'administrador_obras'));

-- ── 5. RLS — Responsáveis, Kanban, Arquivos, Evolução ────────
DROP POLICY IF EXISTS "obra_resp_insert" ON movelaria_obra_responsaveis;
CREATE POLICY "obra_resp_insert" ON movelaria_obra_responsaveis
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador','montador_admin','administrador_obras'));

DROP POLICY IF EXISTS "obra_resp_delete" ON movelaria_obra_responsaveis;
CREATE POLICY "obra_resp_delete" ON movelaria_obra_responsaveis
  FOR DELETE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador','montador_admin','administrador_obras'));

DROP POLICY IF EXISTS "kanban_cols_insert" ON movelaria_kanban_colunas_obra;
CREATE POLICY "kanban_cols_insert" ON movelaria_kanban_colunas_obra
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'administrador_obras'));

DROP POLICY IF EXISTS "kanban_cols_update" ON movelaria_kanban_colunas_obra;
CREATE POLICY "kanban_cols_update" ON movelaria_kanban_colunas_obra
  FOR UPDATE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'administrador_obras'))
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'administrador_obras'));

DROP POLICY IF EXISTS "kanban_cols_delete" ON movelaria_kanban_colunas_obra;
CREATE POLICY "kanban_cols_delete" ON movelaria_kanban_colunas_obra
  FOR DELETE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'administrador_obras'));

DROP POLICY IF EXISTS "obra_arq_insert" ON storage.objects;
CREATE POLICY "obra_arq_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'movelaria-obra-arquivos'
    AND movelaria_meu_perfil() IN ('administrador','montador_admin','administrador_obras')
  );

DROP POLICY IF EXISTS "obra_arq_delete" ON storage.objects;
CREATE POLICY "obra_arq_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'movelaria-obra-arquivos'
    AND movelaria_meu_perfil() IN ('administrador','montador_admin','administrador_obras')
  );

DROP POLICY IF EXISTS "obra_arq_meta_insert" ON movelaria_obra_arquivos;
CREATE POLICY "obra_arq_meta_insert" ON movelaria_obra_arquivos
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador','montador_admin','administrador_obras'));

DROP POLICY IF EXISTS "obra_arq_meta_delete" ON movelaria_obra_arquivos;
CREATE POLICY "obra_arq_meta_delete" ON movelaria_obra_arquivos
  FOR DELETE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador','montador_admin','administrador_obras'));

DROP POLICY IF EXISTS "evolucao_meta_insert" ON movelaria_obra_evolucao;
CREATE POLICY "evolucao_meta_insert" ON movelaria_obra_evolucao
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador','montador_admin','montador','administrador_obras'));

DROP POLICY IF EXISTS "evolucao_meta_delete" ON movelaria_obra_evolucao;
CREATE POLICY "evolucao_meta_delete" ON movelaria_obra_evolucao
  FOR DELETE TO authenticated
  USING (
    movelaria_meu_perfil() IN ('administrador','montador_admin','administrador_obras')
    OR (movelaria_meu_perfil() = 'montador' AND criado_por = auth.uid())
  );

-- Storage — evolução de obra
DROP POLICY IF EXISTS "evolucao_insert" ON storage.objects;
CREATE POLICY "evolucao_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'movelaria-obra-evolucao'
    AND movelaria_meu_perfil() IN ('administrador','montador_admin','montador','administrador_obras')
  );

DROP POLICY IF EXISTS "evolucao_delete" ON storage.objects;
CREATE POLICY "evolucao_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'movelaria-obra-evolucao'
    AND movelaria_meu_perfil() IN ('administrador','montador_admin','administrador_obras')
  );

-- ── 6. Funções SECURITY DEFINER ──────────────────────────────
DROP FUNCTION IF EXISTS movelaria_listar_montadores();
CREATE OR REPLACE FUNCTION movelaria_listar_montadores()
RETURNS TABLE (id UUID, email TEXT, nome TEXT, perfil TEXT, ativo BOOLEAN) AS $$
BEGIN
  IF movelaria_meu_perfil() NOT IN ('administrador','montador_admin','administrador_obras') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN QUERY
    SELECT u.id, u.email, u.nome, u.perfil, u.ativo
    FROM   movelaria_usuarios u
    WHERE  u.perfil IN ('montador','montador_admin') AND u.ativo = true
    ORDER  BY u.nome NULLS LAST, u.email;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_listar_montadores() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_listar_montadores() TO authenticated;

DROP FUNCTION IF EXISTS movelaria_listar_obras();
CREATE OR REPLACE FUNCTION movelaria_listar_obras()
RETURNS TABLE (
  id                   UUID,
  origem_orcamento_id  UUID,
  origem_lead_id       TEXT,
  cliente_id           UUID,
  cliente_nome         TEXT,
  lousa                TEXT,
  endereco_obra        TEXT,
  tipo_obra_id         UUID,
  tipo_obra_nome       TEXT,
  grupo_obra_id        UUID,
  grupo_obra_nome      TEXT,
  montador_admin_id    UUID,
  montador_admin_nome  TEXT,
  montador_id          UUID,
  montador_nome        TEXT,
  data_prevista_inicio DATE,
  data_prevista_fim    DATE,
  tempo_maximo_horas   NUMERIC,
  status_kanban        TEXT,
  iniciado_em          TIMESTAMPTZ,
  finalizado_em        TIMESTAMPTZ,
  concluido_em_atraso  BOOLEAN,
  criado_em            TIMESTAMPTZ,
  atualizado_em        TIMESTAMPTZ
) AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_uid    UUID := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    o.id, o.origem_orcamento_id, o.origem_lead_id, o.cliente_id,
    o.cliente_nome, o.lousa, o.endereco_obra,
    o.tipo_obra_id, t.nome,
    o.grupo_obra_id, g.nome,
    o.montador_admin_id,
    CASE
      WHEN uma.id IS NULL THEN NULL
      ELSE COALESCE(NULLIF(TRIM(uma.nome), ''), split_part(uma.email, '@', 1))
    END,
    o.montador_id,
    CASE
      WHEN um.id IS NULL THEN NULL
      ELSE COALESCE(NULLIF(TRIM(um.nome), ''), split_part(um.email, '@', 1))
    END,
    o.data_prevista_inicio, o.data_prevista_fim, o.tempo_maximo_horas,
    o.status_kanban, o.iniciado_em, o.finalizado_em, o.concluido_em_atraso,
    o.criado_em, o.atualizado_em
  FROM movelaria_obras o
  LEFT JOIN movelaria_tipos_obra t  ON t.id = o.tipo_obra_id
  LEFT JOIN movelaria_grupos_obra g ON g.id = o.grupo_obra_id
  LEFT JOIN movelaria_usuarios um   ON um.id = o.montador_id
  LEFT JOIN movelaria_usuarios uma  ON uma.id = o.montador_admin_id
  WHERE (
    v_perfil IN ('administrador','financeiro','administrador_obras')
    OR (v_perfil = 'montador_admin' AND o.montador_admin_id = v_uid)
    OR (v_perfil = 'montador'       AND o.montador_id       = v_uid)
  )
  ORDER BY o.criado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_listar_obras() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_listar_obras() TO authenticated;

DROP FUNCTION IF EXISTS movelaria_painel_evolucao(TIMESTAMPTZ, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION movelaria_painel_evolucao(
  p_inicio TIMESTAMPTZ,
  p_fim    TIMESTAMPTZ
)
RETURNS TABLE (
  id           UUID,
  obra_id      UUID,
  obra_nome    TEXT,
  nome_arquivo TEXT,
  kind         TEXT,
  storage_path TEXT,
  preview_path TEXT,
  tirado_em    TIMESTAMPTZ,
  criado_por   UUID,
  criador_nome TEXT
) AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_uid    UUID := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    e.id, e.obra_id, o.cliente_nome,
    e.nome_arquivo, e.kind,
    e.storage_path, e.preview_path,
    e.tirado_em, e.criado_por,
    u.nome
  FROM movelaria_obra_evolucao e
  JOIN movelaria_obras o ON o.id = e.obra_id
  LEFT JOIN movelaria_usuarios u ON u.id = e.criado_por
  WHERE e.tirado_em >= p_inicio
    AND e.tirado_em <= p_fim
    AND (
      v_perfil IN ('administrador','financeiro','administrador_obras') OR
      (v_perfil = 'montador_admin' AND o.montador_admin_id = v_uid) OR
      (v_perfil = 'montador'       AND o.montador_id       = v_uid)
    )
  ORDER BY e.tirado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_painel_evolucao(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_painel_evolucao(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
