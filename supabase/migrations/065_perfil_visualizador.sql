-- Perfil Visualizador: acesso somente leitura ao painel de visualização

CREATE OR REPLACE FUNCTION movelaria_perfis_validos()
RETURNS TEXT[] LANGUAGE sql IMMUTABLE AS $$
  SELECT ARRAY[
    'administrador', 'financeiro', 'marceneiro', 'montador',
    'montador_admin', 'administrador_obras', 'visualizador'
  ]::TEXT[];
$$;

-- Atualizar validação de perfis (admin)
CREATE OR REPLACE FUNCTION movelaria_atualizar_perfil_usuario(
  p_id            UUID,
  p_perfil        TEXT,
  p_nome          TEXT     DEFAULT NULL,
  p_ativo         BOOLEAN  DEFAULT NULL,
  p_perfis_extras TEXT[]   DEFAULT NULL
)
RETURNS void AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Criar usuário: aceita visualizador
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
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = extensions, auth, public;

-- Visualizador lê todas as obras (somente leitura via RPC)
DROP FUNCTION IF EXISTS movelaria_listar_obras();
CREATE OR REPLACE FUNCTION movelaria_listar_obras()
RETURNS TABLE (
  id                      UUID,
  origem_orcamento_id     UUID,
  origem_lead_id          TEXT,
  cliente_id              UUID,
  cliente_nome            TEXT,
  lousa                   TEXT,
  descricao               TEXT,
  endereco_obra           TEXT,
  tipo_obra_id            UUID,
  tipo_obra_nome          TEXT,
  grupo_obra_id           UUID,
  grupo_obra_nome         TEXT,
  montador_admin_id       UUID,
  montador_admin_nome     TEXT,
  montador_id             UUID,
  montador_nome           TEXT,
  montador_ids            UUID[],
  montador_nomes          TEXT[],
  data_prevista_inicio    DATE,
  data_prevista_fim       DATE,
  tempo_maximo_horas      NUMERIC,
  status_kanban           TEXT,
  iniciado_em             TIMESTAMPTZ,
  finalizado_em           TIMESTAMPTZ,
  concluido_em_atraso     BOOLEAN,
  pedido_material_feito   BOOLEAN,
  data_entrega_pedido     DATE,
  numero_pedido_cort_claud TEXT,
  criado_em               TIMESTAMPTZ,
  atualizado_em           TIMESTAMPTZ,
  comissao_habilitada     BOOLEAN,
  comissao_total          NUMERIC,
  comissao_gerada         BOOLEAN,
  dias_trabalho           INTEGER[],
  horario_inicio          TEXT,
  horario_fim             TEXT,
  comissao_prestador_ids  UUID[],
  comissao_prestador_nomes TEXT[],
  comissao_valores        NUMERIC[]
) AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_uid    UUID := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    o.id, o.origem_orcamento_id, o.origem_lead_id, o.cliente_id,
    o.cliente_nome, o.lousa, o.descricao, o.endereco_obra,
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
    COALESCE(resp.ids,   ARRAY[]::UUID[]),
    COALESCE(resp.nomes, ARRAY[]::TEXT[]),
    o.data_prevista_inicio, o.data_prevista_fim, o.tempo_maximo_horas,
    o.status_kanban, o.iniciado_em, o.finalizado_em, o.concluido_em_atraso,
    COALESCE(o.pedido_material_feito, false),
    o.data_entrega_pedido,
    o.numero_pedido_cort_claud,
    o.criado_em, o.atualizado_em,
    o.comissao_habilitada, o.comissao_total, o.comissao_gerada,
    o.dias_trabalho, o.horario_inicio, o.horario_fim,
    COALESCE(com.ids,   ARRAY[]::UUID[]),
    COALESCE(com.nomes, ARRAY[]::TEXT[]),
    COALESCE(com.valores, ARRAY[]::NUMERIC[])
  FROM movelaria_obras o
  LEFT JOIN movelaria_tipos_obra t  ON t.id = o.tipo_obra_id
  LEFT JOIN movelaria_grupos_obra g ON g.id = o.grupo_obra_id
  LEFT JOIN movelaria_usuarios um   ON um.id = o.montador_id
  LEFT JOIN movelaria_usuarios uma  ON uma.id = o.montador_admin_id
  LEFT JOIN LATERAL (
    SELECT
      array_agg(r.montador_id ORDER BY r.criado_em) AS ids,
      array_agg(
        COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1))
        ORDER BY r.criado_em
      ) AS nomes
    FROM movelaria_obra_responsaveis r
    JOIN movelaria_usuarios u ON u.id = r.montador_id
    WHERE r.obra_id = o.id
  ) resp ON true
  LEFT JOIN LATERAL (
    SELECT
      array_agg(ci.prestador_id ORDER BY ci.criado_em) AS ids,
      array_agg(
        COALESCE(NULLIF(TRIM(pu.nome), ''), split_part(pu.email, '@', 1))
        ORDER BY ci.criado_em
      ) AS nomes,
      array_agg(ci.valor ORDER BY ci.criado_em) AS valores
    FROM movelaria_obra_comissao_itens ci
    JOIN movelaria_usuarios pu ON pu.id = ci.prestador_id
    WHERE ci.obra_id = o.id AND ci.valor > 0
  ) com ON true
  WHERE (
    v_perfil IN ('administrador', 'financeiro', 'administrador_obras', 'visualizador')
    OR (v_perfil = 'montador_admin' AND movelaria_montador_admin_acessa_obra(o.id, v_uid))
    OR (v_perfil = 'montador' AND movelaria_montador_acessa_obra(o.id, v_uid))
  )
  ORDER BY o.criado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_listar_obras() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_listar_obras() TO authenticated;

DROP POLICY IF EXISTS "obras_select_admin" ON movelaria_obras;
CREATE POLICY "obras_select_admin" ON movelaria_obras
  FOR SELECT TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro', 'administrador_obras', 'visualizador'));
