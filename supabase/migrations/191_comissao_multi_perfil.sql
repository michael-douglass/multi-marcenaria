-- ============================================================
-- GARBO Movelaria — Comissão respeita perfis_extras
-- Migration 191
--
-- Problema: ao salvar obra (ex.: designar montadores), o app
-- chama movelaria_sincronizar_obra_comissao quando o usuário
-- tem Administrador de Obras / Financeiro em roles (inclui
-- perfis_extras). A RPC e a RLS de comissão usavam só
-- movelaria_meu_perfil() (coluna perfil) e negavam quem tem
-- administrador_obras só nos extras (ex.: Rafaela — perfil
-- principal "montador").
-- ============================================================

-- ── 1. Sincronizar comissão da obra ───────────────────────────
CREATE OR REPLACE FUNCTION movelaria_sincronizar_obra_comissao(
  p_obra_id        UUID,
  p_habilitada     BOOLEAN,
  p_prestador_ids  UUID[],
  p_valores        NUMERIC[],
  p_ocultos        BOOLEAN[] DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_gerada BOOLEAN;
  v_concluida BOOLEAN;
  i        INTEGER;
  v_oculto BOOLEAN;
BEGIN
  IF NOT movelaria_usuario_tem_algum_perfil(
    ARRAY['administrador', 'financeiro', 'administrador_obras']
  ) THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores ou financeiro podem configurar comissões';
  END IF;

  SELECT comissao_gerada,
         (status_kanban = 'concluida' AND finalizado_em IS NOT NULL)
  INTO v_gerada, v_concluida
  FROM movelaria_obras
  WHERE id = p_obra_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Obra não encontrada';
  END IF;
  IF v_gerada THEN
    RAISE EXCEPTION 'Comissão já foi gerada para esta obra e não pode ser alterada';
  END IF;

  IF p_prestador_ids IS NULL OR p_valores IS NULL THEN
    RAISE EXCEPTION 'Listas de prestadores e valores são obrigatórias';
  END IF;

  IF array_length(p_prestador_ids, 1) IS DISTINCT FROM array_length(p_valores, 1) THEN
    RAISE EXCEPTION 'Quantidade de prestadores e valores deve ser igual';
  END IF;

  IF p_ocultos IS NOT NULL
     AND array_length(p_ocultos, 1) IS DISTINCT FROM array_length(p_prestador_ids, 1) THEN
    RAISE EXCEPTION 'Quantidade de flags ocultos deve ser igual à de prestadores';
  END IF;

  DELETE FROM movelaria_obra_comissao_itens ci
  WHERE ci.obra_id = p_obra_id
    AND NOT (ci.prestador_id = ANY(p_prestador_ids));

  IF p_habilitada AND array_length(p_prestador_ids, 1) > 0 THEN
    FOR i IN 1..array_length(p_prestador_ids, 1) LOOP
      IF COALESCE(p_valores[i], 0) > 0 THEN
        v_oculto := CASE
          WHEN p_ocultos IS NULL THEN false
          ELSE COALESCE(p_ocultos[i], false)
        END;

        INSERT INTO movelaria_obra_comissao_itens (obra_id, prestador_id, valor, oculto_prestador)
        VALUES (p_obra_id, p_prestador_ids[i], ROUND(p_valores[i], 2), v_oculto)
        ON CONFLICT (obra_id, prestador_id) DO UPDATE
          SET valor = EXCLUDED.valor,
              oculto_prestador = CASE
                WHEN p_ocultos IS NULL THEN movelaria_obra_comissao_itens.oculto_prestador
                ELSE EXCLUDED.oculto_prestador
              END,
              atualizado_em = NOW();
      ELSE
        DELETE FROM movelaria_obra_comissao_itens ci
        WHERE ci.obra_id = p_obra_id
          AND ci.prestador_id = p_prestador_ids[i];
      END IF;
    END LOOP;
  ELSE
    DELETE FROM movelaria_obra_comissao_itens WHERE obra_id = p_obra_id;
  END IF;

  UPDATE movelaria_obras
  SET comissao_habilitada = p_habilitada,
      comissao_total = COALESCE((
        SELECT SUM(ci.valor) FROM movelaria_obra_comissao_itens ci WHERE ci.obra_id = p_obra_id
      ), 0),
      atualizado_em = NOW()
  WHERE id = p_obra_id;

  IF v_concluida AND p_habilitada THEN
    PERFORM movelaria_aplicar_comissao_obra_interno(p_obra_id);
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION movelaria_sincronizar_obra_comissao(UUID, BOOLEAN, UUID[], NUMERIC[], BOOLEAN[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_sincronizar_obra_comissao(UUID, BOOLEAN, UUID[], NUMERIC[], BOOLEAN[]) TO authenticated;

-- ── 2. Aplicar comissão ───────────────────────────────────────
CREATE OR REPLACE FUNCTION movelaria_aplicar_comissao_obra(p_obra_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_ok BOOLEAN;
BEGIN
  IF NOT movelaria_usuario_tem_algum_perfil(
    ARRAY['administrador', 'financeiro', 'administrador_obras']
  ) THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores ou financeiro podem aplicar comissões';
  END IF;

  v_ok := movelaria_aplicar_comissao_obra_interno(p_obra_id);

  IF NOT v_ok THEN
    RAISE EXCEPTION 'Não foi possível gerar comissão: verifique se está habilitada e possui valores definidos';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION movelaria_aplicar_comissao_obra(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_aplicar_comissao_obra(uuid) TO authenticated;

-- ── 3. Ocultar comissão do prestador ──────────────────────────
CREATE OR REPLACE FUNCTION movelaria_toggle_comissao_oculta_prestador(
  p_obra_id uuid,
  p_prestador_id uuid,
  p_oculto boolean
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT movelaria_usuario_tem_algum_perfil(
    ARRAY['administrador', 'financeiro', 'administrador_obras']
  ) THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores ou financeiro podem ocultar comissões';
  END IF;

  UPDATE movelaria_obra_comissao_itens ci
  SET oculto_prestador = COALESCE(p_oculto, false),
      atualizado_em = NOW()
  WHERE ci.obra_id = p_obra_id
    AND ci.prestador_id = p_prestador_id
    AND ci.valor > 0;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Comissão não encontrada para esta obra e prestador';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION movelaria_toggle_comissao_oculta_prestador(uuid, uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_toggle_comissao_oculta_prestador(uuid, uuid, boolean) TO authenticated;

-- ── 4. RLS dos itens de comissão ──────────────────────────────
DROP POLICY IF EXISTS "obra_comissao_write" ON movelaria_obra_comissao_itens;
CREATE POLICY "obra_comissao_write" ON movelaria_obra_comissao_itens
  FOR ALL TO authenticated
  USING (
    movelaria_usuario_tem_algum_perfil(
      ARRAY['administrador', 'financeiro', 'administrador_obras']
    )
  )
  WITH CHECK (
    movelaria_usuario_tem_algum_perfil(
      ARRAY['administrador', 'financeiro', 'administrador_obras']
    )
  );

NOTIFY pgrst, 'reload schema';
