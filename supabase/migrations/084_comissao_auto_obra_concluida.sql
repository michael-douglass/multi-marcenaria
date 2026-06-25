-- ============================================================
-- GARBO Movelaria — Comissão automática em obra já concluída
-- Migration 084
-- Ao salvar comissão depois da conclusão, gera Contas a Pagar.
-- ============================================================

CREATE OR REPLACE FUNCTION movelaria_sincronizar_obra_comissao(
  p_obra_id        UUID,
  p_habilitada     BOOLEAN,
  p_prestador_ids  UUID[],
  p_valores        NUMERIC[]
)
RETURNS void AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_gerada BOOLEAN;
  v_concluida BOOLEAN;
  i        INTEGER;
BEGIN
  IF v_perfil NOT IN ('administrador', 'financeiro', 'administrador_obras') THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores ou financeiro podem configurar comissões';
  END IF;

  SELECT comissao_gerada,
         (status_kanban = 'concluida' OR finalizado_em IS NOT NULL)
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

  DELETE FROM movelaria_obra_comissao_itens WHERE obra_id = p_obra_id;

  IF p_habilitada AND array_length(p_prestador_ids, 1) > 0 THEN
    FOR i IN 1..array_length(p_prestador_ids, 1) LOOP
      IF COALESCE(p_valores[i], 0) > 0 THEN
        INSERT INTO movelaria_obra_comissao_itens (obra_id, prestador_id, valor)
        VALUES (p_obra_id, p_prestador_ids[i], ROUND(p_valores[i], 2));
      END IF;
    END LOOP;
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Obras concluídas com comissão configurada mas ainda não gerada
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT o.id
    FROM movelaria_obras o
    WHERE o.comissao_habilitada = true
      AND o.comissao_gerada = false
      AND (o.status_kanban = 'concluida' OR o.finalizado_em IS NOT NULL)
      AND EXISTS (
        SELECT 1 FROM movelaria_obra_comissao_itens ci
        WHERE ci.obra_id = o.id AND ci.valor > 0
      )
  LOOP
    PERFORM movelaria_aplicar_comissao_obra_interno(r.id);
  END LOOP;
END;
$$;
