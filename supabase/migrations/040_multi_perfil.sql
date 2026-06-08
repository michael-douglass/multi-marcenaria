-- ============================================================
-- GARBO Movelaria — Multi-perfil por usuário
-- Migration 040
-- ============================================================

-- ── 1. Coluna perfis_extras ───────────────────────────────────
ALTER TABLE movelaria_usuarios
  ADD COLUMN IF NOT EXISTS perfis_extras TEXT[] NOT NULL DEFAULT '{}';

-- ── 2. movelaria_listar_usuarios: inclui perfis_extras ────────
DROP FUNCTION IF EXISTS movelaria_listar_usuarios();
CREATE OR REPLACE FUNCTION movelaria_listar_usuarios()
RETURNS TABLE (
  id            UUID,
  email         TEXT,
  nome          TEXT,
  perfil        TEXT,
  perfis_extras TEXT[],
  ativo         BOOLEAN,
  criado_em     TIMESTAMPTZ
) AS $$
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem listar usuários';
  END IF;
  RETURN QUERY
    SELECT u.id, u.email, u.nome, u.perfil, u.perfis_extras, u.ativo, u.criado_em
    FROM   movelaria_usuarios u
    ORDER BY u.criado_em ASC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_listar_usuarios() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_listar_usuarios() TO authenticated;

-- ── 3. movelaria_atualizar_perfil_usuario: aceita perfis_extras ─
DROP FUNCTION IF EXISTS movelaria_atualizar_perfil_usuario(UUID, TEXT, TEXT, BOOLEAN);
CREATE OR REPLACE FUNCTION movelaria_atualizar_perfil_usuario(
  p_id            UUID,
  p_perfil        TEXT,
  p_nome          TEXT     DEFAULT NULL,
  p_ativo         BOOLEAN  DEFAULT NULL,
  p_perfis_extras TEXT[]   DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_valid TEXT[] := ARRAY[
    'administrador','financeiro','marceneiro','montador','montador_admin','administrador_obras'
  ];
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

REVOKE ALL ON FUNCTION movelaria_atualizar_perfil_usuario(UUID, TEXT, TEXT, BOOLEAN, TEXT[]) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_atualizar_perfil_usuario(UUID, TEXT, TEXT, BOOLEAN, TEXT[]) TO authenticated;

-- ── 4. movelaria_obter_meu_usuario: inclui perfis_extras ──────
DROP FUNCTION IF EXISTS movelaria_obter_meu_usuario();
CREATE OR REPLACE FUNCTION movelaria_obter_meu_usuario()
RETURNS TABLE (
  id            UUID,
  email         TEXT,
  nome          TEXT,
  perfil        TEXT,
  perfis_extras TEXT[],
  ativo         BOOLEAN,
  criado_em     TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
    SELECT u.id, u.email, u.nome, u.perfil, u.perfis_extras, u.ativo, u.criado_em
    FROM   movelaria_usuarios u
    WHERE  u.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_obter_meu_usuario() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_obter_meu_usuario() TO authenticated;
