-- ============================================================
-- GARBO Movelaria — Montadores na obra via pasta de funcionário
-- Migration 192
--
-- Problema: a lista de montadores da obra olhava só o perfil
-- do login (movelaria_usuarios). Quem era cadastrado como
-- montador em Funcionários (pasta) mas o login ficou com outro
-- perfil (ex.: marceneiro) não aparecia no card da obra.
-- ============================================================

-- ── 1. Ao salvar pasta montador, garante cargo no login ───────
CREATE OR REPLACE FUNCTION movelaria_sync_usuario_de_funcionario_montador()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID;
  v_cargo TEXT;
  v_extras TEXT[];
  v_ja_vinculado UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NOT COALESCE(NEW.ativo, false) THEN
    RETURN NEW;
  END IF;

  IF NEW.tipo IS DISTINCT FROM 'montador'
     AND NEW.tipo IS DISTINCT FROM 'montador_admin' THEN
    RETURN NEW;
  END IF;

  v_cargo := NEW.tipo;
  v_uid := NEW.usuario_id;

  IF v_uid IS NULL AND NEW.email IS NOT NULL AND length(trim(NEW.email)) > 0 THEN
    SELECT u.id INTO v_uid
    FROM movelaria_usuarios u
    WHERE lower(u.email) = lower(trim(NEW.email))
      AND u.ativo = true
    ORDER BY u.criado_em DESC NULLS LAST
    LIMIT 1;

    -- Só vincula se o login ainda não tem outra pasta (índice único).
    IF v_uid IS NOT NULL AND NEW.usuario_id IS NULL THEN
      SELECT f.id INTO v_ja_vinculado
      FROM movelaria_funcionarios f
      WHERE f.usuario_id = v_uid
        AND f.id IS DISTINCT FROM NEW.id
      LIMIT 1;

      IF v_ja_vinculado IS NULL THEN
        NEW.usuario_id := v_uid;
      END IF;
    END IF;
  END IF;

  IF v_uid IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(u.perfis_extras, ARRAY[]::text[])
  INTO v_extras
  FROM movelaria_usuarios u
  WHERE u.id = v_uid;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  -- Já é montador/admin no perfil principal: nada a fazer.
  IF EXISTS (
    SELECT 1 FROM movelaria_usuarios u
    WHERE u.id = v_uid
      AND u.perfil IN ('montador', 'montador_admin')
  ) THEN
    RETURN NEW;
  END IF;

  -- Já tem o cargo nos extras.
  IF v_cargo = ANY (COALESCE(v_extras, ARRAY[]::text[])) THEN
    RETURN NEW;
  END IF;

  UPDATE movelaria_usuarios
  SET
    perfis_extras = (
      SELECT ARRAY(
        SELECT DISTINCT x
        FROM unnest(COALESCE(perfis_extras, ARRAY[]::text[]) || ARRAY[v_cargo]) AS t(x)
        WHERE x IS NOT NULL AND length(trim(x)) > 0
      )
    ),
    atualizado_em = NOW()
  WHERE id = v_uid;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_usuario_funcionario_montador ON movelaria_funcionarios;
CREATE TRIGGER trg_sync_usuario_funcionario_montador
  BEFORE INSERT OR UPDATE OF tipo, email, usuario_id, ativo
  ON movelaria_funcionarios
  FOR EACH ROW
  EXECUTE FUNCTION movelaria_sync_usuario_de_funcionario_montador();

-- ── 2. Lista de montadores também considera pasta Funcionários
CREATE OR REPLACE FUNCTION movelaria_listar_montadores()
RETURNS TABLE (
  id uuid,
  email text,
  nome text,
  perfil text,
  ativo boolean
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
BEGIN
  IF NOT movelaria_usuario_tem_algum_perfil(
    ARRAY['administrador', 'montador_admin', 'administrador_obras', 'financeiro']
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
    SELECT
      u.id,
      u.email,
      COALESCE(
        NULLIF(trim(u.nome), ''),
        (
          SELECT NULLIF(trim(f.nome), '')
          FROM movelaria_funcionarios f
          WHERE f.ativo = true
            AND f.tipo IN ('montador', 'montador_admin')
            AND (
              f.usuario_id = u.id
              OR (f.email IS NOT NULL AND lower(f.email) = lower(u.email))
            )
          ORDER BY
            CASE WHEN f.tipo = 'montador_admin' THEN 0 ELSE 1 END,
            f.atualizado_em DESC NULLS LAST
          LIMIT 1
        ),
        split_part(u.email, '@', 1)
      ) AS nome,
      CASE
        WHEN u.perfil = 'montador_admin'
          OR 'montador_admin' = ANY (COALESCE(u.perfis_extras, ARRAY[]::text[]))
          OR EXISTS (
            SELECT 1 FROM movelaria_funcionarios f
            WHERE f.ativo = true
              AND f.tipo = 'montador_admin'
              AND (
                f.usuario_id = u.id
                OR (f.email IS NOT NULL AND lower(f.email) = lower(u.email))
              )
          )
          THEN 'montador_admin'::text
        ELSE 'montador'::text
      END AS perfil,
      u.ativo
    FROM movelaria_usuarios u
    WHERE u.ativo = true
      AND (
        u.perfil IN ('montador', 'montador_admin')
        OR COALESCE(u.perfis_extras, ARRAY[]::text[])
           && ARRAY['montador', 'montador_admin']
        OR EXISTS (
          SELECT 1 FROM movelaria_funcionarios f
          WHERE f.ativo = true
            AND f.tipo IN ('montador', 'montador_admin')
            AND (
              f.usuario_id = u.id
              OR (f.email IS NOT NULL AND lower(f.email) = lower(u.email))
            )
          )
      )
    ORDER BY 3 NULLS LAST, u.email;
END;
$$;

REVOKE ALL ON FUNCTION movelaria_listar_montadores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_listar_montadores() TO authenticated;

-- ── 3. Reparo de dados ───────────────────────────────────────
-- 3a. Vincula pasta montador órfã só se o login ainda não tem pasta.
UPDATE movelaria_funcionarios f
SET
  usuario_id = u.id,
  atualizado_em = NOW()
FROM movelaria_usuarios u
WHERE f.usuario_id IS NULL
  AND f.ativo = true
  AND f.tipo IN ('montador', 'montador_admin')
  AND f.email IS NOT NULL
  AND length(trim(f.email)) > 0
  AND lower(f.email) = lower(u.email)
  AND u.ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM movelaria_funcionarios f2
    WHERE f2.usuario_id = u.id
  );

-- 3b. Se o login já tem pasta (ex.: marceneiro) e existe pasta montador
--     com o mesmo e-mail, promove a pasta vinculada para montador e
--     desativa a pasta montador duplicada órfã.
UPDATE movelaria_funcionarios f_vinculada
SET
  tipo = f_montador.tipo,
  categoria = COALESCE(NULLIF(f_vinculada.categoria, ''), 'montador'),
  atualizado_em = NOW()
FROM movelaria_usuarios u
JOIN movelaria_funcionarios f_montador
  ON f_montador.usuario_id IS NULL
 AND f_montador.ativo = true
 AND f_montador.tipo IN ('montador', 'montador_admin')
 AND f_montador.email IS NOT NULL
 AND lower(f_montador.email) = lower(u.email)
WHERE f_vinculada.usuario_id = u.id
  AND f_vinculada.ativo = true
  AND f_vinculada.tipo NOT IN ('montador', 'montador_admin')
  AND u.ativo = true;

UPDATE movelaria_funcionarios f_montador
SET
  ativo = false,
  atualizado_em = NOW()
FROM movelaria_usuarios u
JOIN movelaria_funcionarios f_vinculada
  ON f_vinculada.usuario_id = u.id
 AND f_vinculada.ativo = true
 AND f_vinculada.tipo IN ('montador', 'montador_admin')
WHERE f_montador.usuario_id IS NULL
  AND f_montador.ativo = true
  AND f_montador.tipo IN ('montador', 'montador_admin')
  AND f_montador.email IS NOT NULL
  AND lower(f_montador.email) = lower(u.email)
  AND u.ativo = true;

-- 3c. Libera cargo montador no login (perfis_extras) sempre que houver
--     pasta montador ativa com o mesmo e-mail ou vínculo.
UPDATE movelaria_usuarios u
SET
  perfis_extras = (
    SELECT ARRAY(
      SELECT DISTINCT x
      FROM unnest(
        COALESCE(u.perfis_extras, ARRAY[]::text[])
        || CASE
             WHEN EXISTS (
               SELECT 1 FROM movelaria_funcionarios f
               WHERE f.ativo = true
                 AND f.tipo = 'montador_admin'
                 AND (
                   f.usuario_id = u.id
                   OR (f.email IS NOT NULL AND lower(f.email) = lower(u.email))
                 )
             ) THEN ARRAY['montador_admin']::text[]
             ELSE ARRAY['montador']::text[]
           END
      ) AS t(x)
      WHERE x IS NOT NULL AND length(trim(x)) > 0
    )
  ),
  atualizado_em = NOW()
WHERE u.ativo = true
  AND u.perfil NOT IN ('montador', 'montador_admin')
  AND NOT (
    COALESCE(u.perfis_extras, ARRAY[]::text[])
    && ARRAY['montador', 'montador_admin']
  )
  AND EXISTS (
    SELECT 1 FROM movelaria_funcionarios f
    WHERE f.ativo = true
      AND f.tipo IN ('montador', 'montador_admin')
      AND (
        f.usuario_id = u.id
        OR (f.email IS NOT NULL AND lower(f.email) = lower(u.email))
      )
  );

NOTIFY pgrst, 'reload schema';
