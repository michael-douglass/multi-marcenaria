-- ============================================================
-- Identidade unificada: ficha Movelaria + ficha CRM (emp_garbo)
-- ============================================================

CREATE OR REPLACE FUNCTION public.movelaria_obter_minha_identidade()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_mov   JSONB;
  v_crm   JSONB;
  v_roles TEXT[];
BEGIN
  IF v_uid IS NULL THEN
    RETURN jsonb_build_object('movelaria', NULL, 'crm', NULL);
  END IF;

  SELECT jsonb_build_object(
    'id', u.id,
    'email', u.email,
    'nome', u.nome,
    'perfil', u.perfil,
    'perfis_extras', COALESCE(u.perfis_extras, '{}'::TEXT[]),
    'ativo', u.ativo,
    'criado_em', u.criado_em
  )
  INTO v_mov
  FROM public.movelaria_usuarios u
  WHERE u.id = v_uid;

  SELECT COALESCE(array_agg(r.role::TEXT ORDER BY r.role::TEXT), '{}'::TEXT[])
  INTO v_roles
  FROM emp_garbo.user_roles r
  WHERE r.user_id = v_uid;

  SELECT jsonb_build_object(
    'id', c.id,
    'nome', c.nome,
    'email', c.email,
    'tipo_usuario', c.tipo_usuario,
    'status_convite', c.status_convite,
    'roles', COALESCE(v_roles, '{}'::TEXT[]),
    'horario_acesso_inicio', to_char(c.horario_acesso_inicio, 'HH24:MI'),
    'horario_acesso_fim', to_char(c.horario_acesso_fim, 'HH24:MI'),
    'titulo', c.titulo,
    'comissao_ativa', c.comissao_ativa
  )
  INTO v_crm
  FROM emp_garbo.usuarios c
  WHERE c.id = v_uid;

  RETURN jsonb_build_object(
    'movelaria', v_mov,
    'crm', v_crm
  );
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_obter_minha_identidade() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_obter_minha_identidade() TO authenticated;

-- Lista união das duas fichas (só administrador Movelaria)
CREATE OR REPLACE FUNCTION public.movelaria_listar_identidades()
RETURNS TABLE (
  id                     UUID,
  email                  TEXT,
  nome                   TEXT,
  perfil                 TEXT,
  perfis_extras          TEXT[],
  ativo                  BOOLEAN,
  criado_em              TIMESTAMPTZ,
  tem_movelaria          BOOLEAN,
  crm_tipo_usuario       TEXT,
  crm_status_convite     TEXT,
  crm_roles              TEXT[],
  crm_horario_inicio     TEXT,
  crm_horario_fim        TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
BEGIN
  IF public.movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem listar usuários';
  END IF;

  RETURN QUERY
  WITH ids AS (
    SELECT m.id FROM public.movelaria_usuarios m
    UNION
    SELECT c.id FROM emp_garbo.usuarios c
  )
  SELECT
    i.id,
    COALESCE(m.email, c.email, ''),
    COALESCE(m.nome, c.nome),
    m.perfil,
    COALESCE(m.perfis_extras, '{}'::TEXT[]),
    COALESCE(m.ativo, c.status_convite = 'ATIVO', false),
    COALESCE(m.criado_em, c.criado_em, NOW()),
    (m.id IS NOT NULL),
    c.tipo_usuario,
    c.status_convite,
    COALESCE((
      SELECT array_agg(r.role::TEXT ORDER BY r.role::TEXT)
      FROM emp_garbo.user_roles r
      WHERE r.user_id = i.id
    ), '{}'::TEXT[]),
    to_char(c.horario_acesso_inicio, 'HH24:MI'),
    to_char(c.horario_acesso_fim, 'HH24:MI')
  FROM ids i
  LEFT JOIN public.movelaria_usuarios m ON m.id = i.id
  LEFT JOIN emp_garbo.usuarios c ON c.id = i.id
  ORDER BY COALESCE(m.nome, c.nome, m.email, c.email);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_listar_identidades() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_listar_identidades() TO authenticated;

CREATE OR REPLACE FUNCTION public.movelaria_atualizar_ficha_crm(
  p_id              UUID,
  p_tipo_usuario    TEXT,
  p_roles           TEXT[] DEFAULT '{}',
  p_horario_inicio  TEXT DEFAULT NULL,
  p_horario_fim     TEXT DEFAULT NULL,
  p_status_convite  TEXT DEFAULT 'ATIVO',
  p_titulo          TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email   TEXT;
  v_nome    TEXT;
  v_tipo    TEXT;
  v_status  TEXT;
  v_role    TEXT;
  v_inicio  TIME;
  v_fim     TIME;
BEGIN
  IF public.movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem editar a ficha CRM';
  END IF;

  IF p_id IS NULL THEN
    RAISE EXCEPTION 'Usuário obrigatório.';
  END IF;

  v_tipo := NULLIF(btrim(COALESCE(p_tipo_usuario, '')), '');
  IF v_tipo IS NULL OR v_tipo = 'nenhum' THEN
    UPDATE emp_garbo.usuarios
    SET status_convite = 'INATIVO',
        atualizado_em = NOW()
    WHERE id = p_id;
    DELETE FROM emp_garbo.user_roles WHERE user_id = p_id;
    RETURN;
  END IF;

  IF v_tipo NOT IN ('colaborador', 'prestador_servico', 'lead') THEN
    RAISE EXCEPTION 'Tipo CRM inválido: %', v_tipo;
  END IF;

  v_status := COALESCE(NULLIF(btrim(p_status_convite), ''), 'ATIVO');
  IF v_status NOT IN ('ATIVO', 'INATIVO', 'PENDENTE') THEN
    RAISE EXCEPTION 'Status de convite inválido: %', v_status;
  END IF;

  v_inicio := NULLIF(btrim(COALESCE(p_horario_inicio, '')), '')::TIME;
  v_fim := NULLIF(btrim(COALESCE(p_horario_fim, '')), '')::TIME;

  SELECT COALESCE(m.email, c.email), COALESCE(m.nome, c.nome)
  INTO v_email, v_nome
  FROM (SELECT p_id AS id) x
  LEFT JOIN public.movelaria_usuarios m ON m.id = p_id
  LEFT JOIN emp_garbo.usuarios c ON c.id = p_id;

  IF v_email IS NULL THEN
    SELECT email INTO v_email FROM auth.users WHERE id = p_id;
  END IF;

  IF v_email IS NULL THEN
    RAISE EXCEPTION 'Não encontrei e-mail para este usuário.';
  END IF;

  INSERT INTO emp_garbo.usuarios (
    id, nome, email, tipo_usuario, status_convite,
    horario_acesso_inicio, horario_acesso_fim, titulo, atualizado_em
  )
  VALUES (
    p_id,
    COALESCE(NULLIF(btrim(v_nome), ''), split_part(v_email, '@', 1)),
    v_email,
    v_tipo,
    v_status,
    v_inicio,
    v_fim,
    NULLIF(btrim(COALESCE(p_titulo, '')), ''),
    NOW()
  )
  ON CONFLICT (id) DO UPDATE
    SET tipo_usuario = EXCLUDED.tipo_usuario,
        status_convite = EXCLUDED.status_convite,
        horario_acesso_inicio = EXCLUDED.horario_acesso_inicio,
        horario_acesso_fim = EXCLUDED.horario_acesso_fim,
        titulo = COALESCE(EXCLUDED.titulo, emp_garbo.usuarios.titulo),
        nome = COALESCE(EXCLUDED.nome, emp_garbo.usuarios.nome),
        email = COALESCE(EXCLUDED.email, emp_garbo.usuarios.email),
        atualizado_em = NOW();

  DELETE FROM emp_garbo.user_roles WHERE user_id = p_id;

  IF p_roles IS NOT NULL THEN
    FOREACH v_role IN ARRAY p_roles LOOP
      v_role := lower(btrim(v_role));
      IF v_role IN ('admin', 'vendedor', 'marketing', 'projetista', 'projetista_admin') THEN
        INSERT INTO emp_garbo.user_roles (user_id, role)
        VALUES (p_id, v_role::selletos_crm_app_role)
        ON CONFLICT (user_id, role) DO NOTHING;
      END IF;
    END LOOP;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_atualizar_ficha_crm(UUID, TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_atualizar_ficha_crm(UUID, TEXT, TEXT[], TEXT, TEXT, TEXT, TEXT) TO authenticated;
