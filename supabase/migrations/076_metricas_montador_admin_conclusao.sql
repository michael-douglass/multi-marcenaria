-- ============================================================
-- GARBO Movelaria — Métricas por obra: escopo por perfil
-- Migration 076
-- Montador admin vê todos os montadores das obras do seu grupo.
-- ============================================================

CREATE OR REPLACE FUNCTION movelaria_metricas_obras_por_obra(
  p_mes INTEGER DEFAULT EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER,
  p_ano INTEGER DEFAULT EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER
)
RETURNS TABLE (
  obra_id              UUID,
  montador_id          UUID,
  montador_nome        TEXT,
  cliente_nome         TEXT,
  tipo_obra_nome       TEXT,
  status_kanban        TEXT,
  iniciado_em          TIMESTAMPTZ,
  finalizado_em        TIMESTAMPTZ,
  duracao_horas        NUMERIC,
  duracao_em_andamento BOOLEAN,
  mes_referencia       DATE,
  comissao_habilitada  BOOLEAN,
  comissao_valor       NUMERIC
) AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_uid    UUID := auth.uid();
BEGIN
  IF v_perfil IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  SELECT
    o.id,
    r.montador_id,
    COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1)),
    o.cliente_nome,
    t.nome,
    o.status_kanban,
    r.iniciado_em,
    r.finalizado_em,
    CASE
      WHEN r.finalizado_em IS NOT NULL AND r.iniciado_em IS NOT NULL
        THEN ROUND(EXTRACT(EPOCH FROM (r.finalizado_em - r.iniciado_em)) / 3600.0, 4)
      WHEN r.iniciado_em IS NOT NULL AND r.finalizado_em IS NULL
        THEN ROUND(EXTRACT(EPOCH FROM (NOW() - r.iniciado_em)) / 3600.0, 4)
      ELSE NULL
    END,
    (r.iniciado_em IS NOT NULL AND r.finalizado_em IS NULL),
    movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em),
    o.comissao_habilitada,
    COALESCE((
      SELECT ci.valor
      FROM movelaria_obra_comissao_itens ci
      WHERE ci.obra_id = o.id
        AND ci.prestador_id = r.montador_id
        AND ci.valor > 0
    ), 0)
  FROM movelaria_obras o
  JOIN movelaria_obra_responsaveis r ON r.obra_id = o.id
  JOIN movelaria_usuarios u ON u.id = r.montador_id
  LEFT JOIN movelaria_tipos_obra t ON t.id = o.tipo_obra_id
  WHERE o.status_kanban != 'cancelada'
    AND (
      (
        EXTRACT(MONTH FROM movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_mes
        AND EXTRACT(YEAR  FROM movelaria_obra_data_referencia(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_ano
      )
      OR (
        r.finalizado_em IS NOT NULL
        AND EXTRACT(MONTH FROM r.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_mes
        AND EXTRACT(YEAR  FROM r.finalizado_em AT TIME ZONE 'America/Sao_Paulo') = p_ano
      )
      OR (
        r.iniciado_em IS NOT NULL
        AND EXTRACT(MONTH FROM r.iniciado_em AT TIME ZONE 'America/Sao_Paulo') = p_mes
        AND EXTRACT(YEAR  FROM r.iniciado_em AT TIME ZONE 'America/Sao_Paulo') = p_ano
      )
    )
    AND (
      v_perfil IN ('administrador', 'financeiro', 'administrador_obras', 'visualizador')
      OR (v_perfil = 'montador_admin' AND movelaria_montador_admin_acessa_obra(o.id, v_uid))
      OR (v_perfil = 'montador' AND movelaria_montador_acessa_obra(o.id, v_uid))
    )
  ORDER BY r.finalizado_em DESC NULLS LAST, r.iniciado_em DESC NULLS LAST, o.criado_em DESC, u.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_metricas_obras_por_obra(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_metricas_obras_por_obra(INTEGER, INTEGER) TO authenticated;
