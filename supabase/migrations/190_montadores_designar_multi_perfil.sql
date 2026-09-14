-- ============================================================
-- GARBO Movelaria — Designar montadores com perfis_extras
-- Migration 190
--
-- Problema: listar/sincronizar montadores e RLS de
-- movelaria_obra_responsaveis usavam só movelaria_meu_perfil()
-- (coluna perfil). Quem tem montador_admin / administrador_obras
-- em perfis_extras via o app, mas o banco negava acesso
-- (ex.: Rafaela — perfil principal "montador").
-- ============================================================

-- ── 1. Lista de montadores respeita cargos extras ─────────────
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
      u.nome,
      CASE
        WHEN u.perfil = 'montador_admin'
          OR 'montador_admin' = ANY (COALESCE(u.perfis_extras, ARRAY[]::text[]))
          THEN 'montador_admin'::text
        ELSE 'montador'::text
      END,
      u.ativo
    FROM movelaria_usuarios u
    WHERE u.ativo = true
      AND (
        u.perfil IN ('montador', 'montador_admin')
        OR COALESCE(u.perfis_extras, ARRAY[]::text[])
           && ARRAY['montador', 'montador_admin']
      )
    ORDER BY u.nome NULLS LAST, u.email;
END;
$$;

REVOKE ALL ON FUNCTION movelaria_listar_montadores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_listar_montadores() TO authenticated;

-- ── 2. Sincronizar montadores da obra (cargos extras) ─────────
CREATE OR REPLACE FUNCTION movelaria_sincronizar_obra_montadores(
  p_obra_id uuid,
  p_montador_ids uuid[]
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ids UUID[] := ARRAY[]::UUID[];
  v_id  UUID;
BEGIN
  IF NOT movelaria_usuario_tem_algum_perfil(
    ARRAY['administrador', 'montador_admin', 'administrador_obras', 'financeiro']
  ) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM movelaria_obras WHERE id = p_obra_id) THEN
    RAISE EXCEPTION 'Obra não encontrada';
  END IF;

  IF p_montador_ids IS NOT NULL THEN
    FOREACH v_id IN ARRAY p_montador_ids LOOP
      IF v_id IS NOT NULL AND NOT (v_id = ANY (v_ids)) THEN
        v_ids := array_append(v_ids, v_id);
      END IF;
    END LOOP;
  END IF;

  DELETE FROM movelaria_obra_responsaveis WHERE obra_id = p_obra_id;

  IF coalesce(array_length(v_ids, 1), 0) > 0 THEN
    INSERT INTO movelaria_obra_responsaveis (obra_id, montador_id)
    SELECT p_obra_id, unnest(v_ids);
  END IF;

  UPDATE movelaria_obras
  SET montador_id   = CASE
                        WHEN coalesce(array_length(v_ids, 1), 0) > 0 THEN v_ids[1]
                        ELSE NULL
                      END,
      atualizado_em = NOW()
  WHERE id = p_obra_id;
END;
$$;

REVOKE ALL ON FUNCTION movelaria_sincronizar_obra_montadores(uuid, uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_sincronizar_obra_montadores(uuid, uuid[]) TO authenticated;

-- ── 3. RLS dos responsáveis também considera extras ──────────
DROP POLICY IF EXISTS "obra_resp_insert" ON movelaria_obra_responsaveis;
CREATE POLICY "obra_resp_insert" ON movelaria_obra_responsaveis
  FOR INSERT TO authenticated
  WITH CHECK (
    movelaria_usuario_tem_algum_perfil(
      ARRAY['administrador', 'montador_admin', 'administrador_obras']
    )
  );

DROP POLICY IF EXISTS "obra_resp_delete" ON movelaria_obra_responsaveis;
CREATE POLICY "obra_resp_delete" ON movelaria_obra_responsaveis
  FOR DELETE TO authenticated
  USING (
    movelaria_usuario_tem_algum_perfil(
      ARRAY['administrador', 'montador_admin', 'administrador_obras']
    )
  );

NOTIFY pgrst, 'reload schema';
