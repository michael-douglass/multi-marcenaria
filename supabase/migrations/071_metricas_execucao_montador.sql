-- ============================================================
-- GARBO Movelaria — Início/fim por montador (métricas de obras)
-- Migration 071
-- ============================================================

ALTER TABLE movelaria_obra_responsaveis
  ADD COLUMN IF NOT EXISTS iniciado_em   TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finalizado_em TIMESTAMPTZ;

-- Retroativo: timestamps da obra → cada montador responsável
UPDATE movelaria_obra_responsaveis r
SET
  iniciado_em   = COALESCE(r.iniciado_em, o.iniciado_em),
  finalizado_em = COALESCE(r.finalizado_em, o.finalizado_em)
FROM movelaria_obras o
WHERE o.id = r.obra_id
  AND (o.iniciado_em IS NOT NULL OR o.finalizado_em IS NOT NULL);

INSERT INTO movelaria_obra_responsaveis (obra_id, montador_id, iniciado_em, finalizado_em)
SELECT o.id, o.montador_id, o.iniciado_em, o.finalizado_em
FROM movelaria_obras o
WHERE o.montador_id IS NOT NULL
ON CONFLICT (obra_id, montador_id) DO UPDATE
SET
  iniciado_em   = COALESCE(movelaria_obra_responsaveis.iniciado_em, EXCLUDED.iniciado_em),
  finalizado_em = COALESCE(movelaria_obra_responsaveis.finalizado_em, EXCLUDED.finalizado_em);

CREATE OR REPLACE FUNCTION movelaria_registrar_inicio_montador(
  p_obra_id UUID,
  p_montador_id UUID
)
RETURNS void AS $$
BEGIN
  INSERT INTO movelaria_obra_responsaveis (obra_id, montador_id, iniciado_em)
  VALUES (p_obra_id, p_montador_id, NOW())
  ON CONFLICT (obra_id, montador_id)
  DO UPDATE SET iniciado_em = COALESCE(movelaria_obra_responsaveis.iniciado_em, NOW());
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION movelaria_registrar_fim_montador(
  p_obra_id UUID,
  p_montador_id UUID
)
RETURNS void AS $$
BEGIN
  INSERT INTO movelaria_obra_responsaveis (obra_id, montador_id, finalizado_em)
  VALUES (p_obra_id, p_montador_id, NOW())
  ON CONFLICT (obra_id, montador_id)
  DO UPDATE SET finalizado_em = COALESCE(movelaria_obra_responsaveis.finalizado_em, NOW());
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION movelaria_obra_todos_montadores_concluiram(p_obra_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_total INT;
  v_pendentes INT;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE r.finalizado_em IS NULL)
  INTO v_total, v_pendentes
  FROM movelaria_obra_responsaveis r
  WHERE r.obra_id = p_obra_id;

  IF v_total = 0 THEN
    RETURN true;
  END IF;

  RETURN v_pendentes = 0;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_obra_todos_montadores_concluiram(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_obra_todos_montadores_concluiram(UUID) TO authenticated;

-- ── Iniciar obra: marca o montador logado + primeira vez na obra ──
DROP FUNCTION IF EXISTS movelaria_iniciar_obra(UUID);
CREATE OR REPLACE FUNCTION movelaria_iniciar_obra(p_obra_id UUID)
RETURNS void AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_uid    UUID := auth.uid();
BEGIN
  IF v_perfil = 'montador' AND NOT movelaria_montador_acessa_obra(p_obra_id, v_uid) THEN
    RAISE EXCEPTION 'Acesso negado: obra não atribuída a você';
  END IF;

  IF v_perfil IN ('montador', 'montador_admin')
     AND v_uid IS NOT NULL
     AND movelaria_montador_acessa_obra(p_obra_id, v_uid) THEN
    PERFORM movelaria_registrar_inicio_montador(p_obra_id, v_uid);
  END IF;

  UPDATE movelaria_obras
  SET iniciado_em   = COALESCE(iniciado_em, NOW()),
      status_kanban = CASE
        WHEN status_kanban NOT IN ('concluida', 'cancelada') THEN 'em_andamento'
        ELSE status_kanban
      END,
      atualizado_em = NOW()
  WHERE id = p_obra_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_iniciar_obra(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_iniciar_obra(UUID) TO authenticated;

-- ── Concluir obra: marca o montador; obra só fecha quando todos concluírem ──
CREATE OR REPLACE FUNCTION movelaria_concluir_obra(p_obra_id UUID)
RETURNS void AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_uid    UUID := auth.uid();
  v_inicio TIMESTAMPTZ;
  v_fim    TIMESTAMPTZ;
  v_montador_conclui BOOLEAN := false;
BEGIN
  IF v_perfil = 'montador' AND NOT movelaria_montador_acessa_obra(p_obra_id, v_uid) THEN
    RAISE EXCEPTION 'Acesso negado: obra não atribuída a você';
  END IF;

  IF v_perfil IN ('montador', 'montador_admin')
     AND v_uid IS NOT NULL
     AND movelaria_montador_acessa_obra(p_obra_id, v_uid) THEN
    PERFORM movelaria_registrar_inicio_montador(p_obra_id, v_uid);
    PERFORM movelaria_registrar_fim_montador(p_obra_id, v_uid);
    v_montador_conclui := true;
  END IF;

  IF NOT v_montador_conclui OR movelaria_obra_todos_montadores_concluiram(p_obra_id) THEN
    SELECT MIN(r.iniciado_em), MAX(r.finalizado_em)
    INTO v_inicio, v_fim
    FROM movelaria_obra_responsaveis r
    WHERE r.obra_id = p_obra_id
      AND r.iniciado_em IS NOT NULL;

    IF v_inicio IS NULL THEN
      SELECT iniciado_em INTO v_inicio FROM movelaria_obras WHERE id = p_obra_id;
    END IF;

    UPDATE movelaria_obras
    SET iniciado_em        = COALESCE(v_inicio, iniciado_em, NOW()),
        finalizado_em      = COALESCE(v_fim, NOW()),
        status_kanban      = 'concluida',
        duracao_real_horas = ROUND(
          EXTRACT(EPOCH FROM (COALESCE(v_fim, NOW()) - COALESCE(v_inicio, NOW()))) / 3600.0, 4
        ),
        atualizado_em      = NOW()
    WHERE id = p_obra_id
      AND finalizado_em IS NULL;

    PERFORM movelaria_aplicar_comissao_obra_interno(p_obra_id);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_concluir_obra(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_concluir_obra(UUID) TO authenticated;

-- ── Histórico por obra + montador ─────────────────────────────
DROP FUNCTION IF EXISTS movelaria_metricas_obras_por_obra(INTEGER, INTEGER);
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
BEGIN
  IF movelaria_meu_perfil() IS NULL THEN
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
  ORDER BY r.finalizado_em DESC NULLS LAST, r.iniciado_em DESC NULLS LAST, o.criado_em DESC, u.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_metricas_obras_por_obra(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_metricas_obras_por_obra(INTEGER, INTEGER) TO authenticated;

-- ── Listar obras: inclui execução por montador ────────────────
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
  comissao_valores        NUMERIC[],
  montadores_execucao     JSONB
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
    COALESCE(com.valores, ARRAY[]::NUMERIC[]),
    COALESCE(exec.data, '[]'::jsonb)
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
    SELECT jsonb_agg(
      jsonb_build_object(
        'montador_id', r.montador_id,
        'iniciado_em', r.iniciado_em,
        'finalizado_em', r.finalizado_em
      ) ORDER BY r.criado_em
    ) AS data
    FROM movelaria_obra_responsaveis r
    WHERE r.obra_id = o.id
  ) exec ON true
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
