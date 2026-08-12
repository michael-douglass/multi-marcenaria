-- ============================================================
-- GARBO Movelaria — Comissão em previsão para obra reaberta
-- Migration 161
--
-- Problema: obra com status em andamento (ex.: datas_definidas)
-- mas finalizado_em antigo (reabertura / drag no kanban) ficava
-- fora de "concluída" E de "previsão" no Meu Financeiro.
-- ============================================================

-- 1) Limpa finalização fantasma de obras que não estão concluídas
UPDATE movelaria_obras
SET finalizado_em = NULL,
    atualizado_em = NOW()
WHERE status_kanban IS DISTINCT FROM 'concluida'
  AND finalizado_em IS NOT NULL;

-- 2) Ao sair de concluída, zera finalizado_em (evita órfãos futuros)
CREATE OR REPLACE FUNCTION movelaria_obra_before_update_limpa_finalizacao()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status_kanban IS DISTINCT FROM 'concluida'
     AND COALESCE(NEW.finalizado_em, OLD.finalizado_em) IS NOT NULL THEN
    NEW.finalizado_em := NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_obra_before_update_limpa_finalizacao ON movelaria_obras;
CREATE TRIGGER trg_obra_before_update_limpa_finalizacao
  BEFORE UPDATE OF status_kanban, finalizado_em ON movelaria_obras
  FOR EACH ROW
  EXECUTE FUNCTION movelaria_obra_before_update_limpa_finalizacao();

-- 3) Sync de comissão: só tenta gerar CP se realmente concluída
CREATE OR REPLACE FUNCTION movelaria_sincronizar_obra_comissao(
  p_obra_id        UUID,
  p_habilitada     BOOLEAN,
  p_prestador_ids  UUID[],
  p_valores        NUMERIC[],
  p_ocultos        BOOLEAN[] DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_gerada BOOLEAN;
  v_concluida BOOLEAN;
  i        INTEGER;
  v_oculto BOOLEAN;
BEGIN
  IF v_perfil NOT IN ('administrador', 'financeiro', 'administrador_obras') THEN
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_sincronizar_obra_comissao(UUID, BOOLEAN, UUID[], NUMERIC[], BOOLEAN[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_sincronizar_obra_comissao(UUID, BOOLEAN, UUID[], NUMERIC[], BOOLEAN[]) TO authenticated;

-- 4) Métricas por montador: previsão pelo status (não exige finalizado_em nulo)
CREATE OR REPLACE FUNCTION movelaria_metricas_obras_por_montador(
  p_mes INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
  p_ano INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS TABLE (
  montador_id        UUID,
  montador_nome      TEXT,
  comissao_concluida NUMERIC,
  comissao_em_aberto NUMERIC,
  comissao_gerada    NUMERIC,
  obras_concluidas   BIGINT,
  obras_em_aberto    BIGINT
) AS $$
BEGIN
  IF movelaria_meu_perfil() IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  WITH montadores AS (
    SELECT
      u.id,
      COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1)) AS nome
    FROM movelaria_usuarios u
    WHERE u.perfil IN ('montador', 'montador_admin')
      AND u.ativo = true
  ),
  concluida AS (
    SELECT
      ci.prestador_id,
      SUM(ci.valor) AS valor,
      COUNT(DISTINCT o.id) AS qtd
    FROM movelaria_obra_comissao_itens ci
    JOIN movelaria_obras o ON o.id = ci.obra_id
    WHERE o.status_kanban = 'concluida'
      AND o.finalizado_em IS NOT NULL
      AND o.comissao_habilitada = true
      AND ci.valor > 0
      AND EXTRACT(MONTH FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_mes
      AND EXTRACT(YEAR  FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_ano
    GROUP BY ci.prestador_id
  ),
  em_aberto AS (
    SELECT
      ci.prestador_id,
      SUM(ci.valor) AS valor,
      COUNT(DISTINCT o.id) AS qtd
    FROM movelaria_obra_comissao_itens ci
    JOIN movelaria_obras o ON o.id = ci.obra_id
    WHERE o.status_kanban NOT IN ('concluida', 'cancelada')
      AND o.comissao_habilitada = true
      AND ci.valor > 0
      AND EXTRACT(MONTH FROM movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_mes
      AND EXTRACT(YEAR  FROM movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_ano
    GROUP BY ci.prestador_id
  ),
  gerada AS (
    SELECT
      cp.prestador_id,
      SUM(cp.valor_parcela) AS valor
    FROM movelaria_contas_pagar cp
    WHERE cp.prestador_id IS NOT NULL
      AND (
        cp.prestador_id IS NOT NULL
        OR cp.descricao ILIKE 'Comissão:%'
        OR cp.obra_id IS NOT NULL
      )
      AND EXTRACT(MONTH FROM cp.data_vencimento AT TIME ZONE 'America/Sao_Paulo') = p_mes
      AND EXTRACT(YEAR  FROM cp.data_vencimento AT TIME ZONE 'America/Sao_Paulo') = p_ano
    GROUP BY cp.prestador_id
  )
  SELECT
    m.id,
    m.nome,
    COALESCE(c.valor, 0),
    COALESCE(a.valor, 0),
    COALESCE(g.valor, 0),
    COALESCE(c.qtd, 0),
    COALESCE(a.qtd, 0)
  FROM montadores m
  LEFT JOIN concluida c ON c.prestador_id = m.id
  LEFT JOIN em_aberto a ON a.prestador_id = m.id
  LEFT JOIN gerada g ON g.prestador_id = m.id
  WHERE COALESCE(c.valor, 0) > 0
     OR COALESCE(a.valor, 0) > 0
     OR COALESCE(g.valor, 0) > 0
  ORDER BY (COALESCE(c.valor, 0) + COALESCE(a.valor, 0) + COALESCE(g.valor, 0)) DESC, m.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_metricas_obras_por_montador(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_metricas_obras_por_montador(INTEGER, INTEGER) TO authenticated;

-- 5) Detalhe Meu Financeiro / métricas: mesma regra de previsão
DROP FUNCTION IF EXISTS movelaria_metricas_comissao_obras_montador(INTEGER, INTEGER, UUID);

CREATE OR REPLACE FUNCTION movelaria_metricas_comissao_obras_montador(
  p_mes INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
  p_ano INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER,
  p_montador_id UUID DEFAULT NULL
)
RETURNS TABLE (
  obra_id          UUID,
  cliente_nome     TEXT,
  tipo_obra_nome   TEXT,
  status_kanban    TEXT,
  comissao_valor   NUMERIC,
  situacao         TEXT,
  oculto_prestador BOOLEAN
) AS $$
DECLARE
  v_perfil         TEXT := movelaria_meu_perfil();
  v_uid            UUID := auth.uid();
  v_filtrar_oculto BOOLEAN;
BEGIN
  IF v_perfil IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF p_montador_id IS NULL THEN
    RAISE EXCEPTION 'Montador não informado';
  END IF;

  IF v_perfil = 'montador' AND p_montador_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  v_filtrar_oculto := (
    v_perfil = 'montador'
    OR (v_perfil = 'montador_admin' AND p_montador_id = v_uid)
  );

  RETURN QUERY
  SELECT
    o.id,
    o.cliente_nome,
    t.nome,
    o.status_kanban,
    ci.valor,
    'concluida'::TEXT,
    COALESCE(ci.oculto_prestador, false)
  FROM movelaria_obra_comissao_itens ci
  JOIN movelaria_obras o ON o.id = ci.obra_id
  LEFT JOIN movelaria_tipos_obra t ON t.id = o.tipo_obra_id
  WHERE ci.prestador_id = p_montador_id
    AND (NOT v_filtrar_oculto OR NOT COALESCE(ci.oculto_prestador, false))
    AND o.status_kanban = 'concluida'
    AND o.finalizado_em IS NOT NULL
    AND o.comissao_habilitada = true
    AND ci.valor > 0
    AND EXTRACT(MONTH FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_mes
    AND EXTRACT(YEAR  FROM o.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_ano

  UNION ALL

  SELECT
    o.id,
    o.cliente_nome,
    t.nome,
    o.status_kanban,
    ci.valor,
    'em_aberto'::TEXT,
    COALESCE(ci.oculto_prestador, false)
  FROM movelaria_obra_comissao_itens ci
  JOIN movelaria_obras o ON o.id = ci.obra_id
  LEFT JOIN movelaria_tipos_obra t ON t.id = o.tipo_obra_id
  WHERE ci.prestador_id = p_montador_id
    AND (NOT v_filtrar_oculto OR NOT COALESCE(ci.oculto_prestador, false))
    AND o.status_kanban NOT IN ('concluida', 'cancelada')
    AND o.comissao_habilitada = true
    AND ci.valor > 0
    AND EXTRACT(MONTH FROM movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_mes
    AND EXTRACT(YEAR  FROM movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_ano

  ORDER BY 6, 2;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_metricas_comissao_obras_montador(INTEGER, INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_metricas_comissao_obras_montador(INTEGER, INTEGER, UUID) TO authenticated;
