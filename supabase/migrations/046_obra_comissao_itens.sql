-- ============================================================
-- GARBO Movelaria — Comissões por prestador (valores individuais)
-- Migration 046
-- ============================================================

-- ── 1. Itens de comissão por prestador/obra ──────────────────
CREATE TABLE IF NOT EXISTS movelaria_obra_comissao_itens (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id       UUID NOT NULL REFERENCES movelaria_obras(id) ON DELETE CASCADE,
  prestador_id  UUID NOT NULL REFERENCES movelaria_usuarios(id) ON DELETE CASCADE,
  valor         NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (valor >= 0),
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (obra_id, prestador_id)
);

CREATE INDEX IF NOT EXISTS idx_obra_comissao_obra      ON movelaria_obra_comissao_itens(obra_id);
CREATE INDEX IF NOT EXISTS idx_obra_comissao_prestador ON movelaria_obra_comissao_itens(prestador_id);

ALTER TABLE movelaria_obra_comissao_itens ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obra_comissao_select" ON movelaria_obra_comissao_itens;
CREATE POLICY "obra_comissao_select" ON movelaria_obra_comissao_itens
  FOR SELECT TO authenticated
  USING (movelaria_meu_perfil() IS NOT NULL);

DROP POLICY IF EXISTS "obra_comissao_write" ON movelaria_obra_comissao_itens;
CREATE POLICY "obra_comissao_write" ON movelaria_obra_comissao_itens
  FOR ALL TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro', 'administrador_obras'))
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'financeiro', 'administrador_obras'));

-- ── 2. Rastrear origem da comissão em contas a pagar ─────────
ALTER TABLE movelaria_contas_pagar
  ADD COLUMN IF NOT EXISTS obra_id UUID REFERENCES movelaria_obras(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contas_pagar_obra ON movelaria_contas_pagar(obra_id);

-- ── 3. Sincronizar itens de comissão de uma obra ─────────────
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
  i        INTEGER;
BEGIN
  IF v_perfil NOT IN ('administrador', 'financeiro', 'administrador_obras') THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores ou financeiro podem configurar comissões';
  END IF;

  SELECT comissao_gerada INTO v_gerada FROM movelaria_obras WHERE id = p_obra_id;
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
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_sincronizar_obra_comissao(UUID, BOOLEAN, UUID[], NUMERIC[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_sincronizar_obra_comissao(UUID, BOOLEAN, UUID[], NUMERIC[]) TO authenticated;

-- ── 4. Aplicar comissão (gerar contas a pagar) ───────────────
CREATE OR REPLACE FUNCTION movelaria_aplicar_comissao_obra(p_obra_id UUID)
RETURNS void AS $$
DECLARE
  v_habilitada   BOOLEAN;
  v_gerada       BOOLEAN;
  v_cliente_nome TEXT;
  v_perfil       TEXT := movelaria_meu_perfil();
  v_qtd_itens    INTEGER;
  r              RECORD;
BEGIN
  IF v_perfil NOT IN ('administrador', 'financeiro', 'administrador_obras') THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores ou financeiro podem aplicar comissões';
  END IF;

  SELECT comissao_habilitada, comissao_gerada, cliente_nome
  INTO v_habilitada, v_gerada, v_cliente_nome
  FROM movelaria_obras
  WHERE id = p_obra_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Obra não encontrada';
  END IF;

  IF v_gerada THEN
    RAISE EXCEPTION 'Comissão já foi gerada para esta obra';
  END IF;

  IF NOT v_habilitada THEN
    RAISE EXCEPTION 'Comissão não está habilitada para esta obra';
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_qtd_itens
  FROM movelaria_obra_comissao_itens
  WHERE obra_id = p_obra_id AND valor > 0;

  IF v_qtd_itens = 0 THEN
    RAISE EXCEPTION 'Nenhum prestador com valor de comissão definido';
  END IF;

  FOR r IN
    SELECT ci.prestador_id, ci.valor, u.nome, u.email
    FROM movelaria_obra_comissao_itens ci
    JOIN movelaria_usuarios u ON u.id = ci.prestador_id
    WHERE ci.obra_id = p_obra_id AND ci.valor > 0
  LOOP
    INSERT INTO movelaria_contas_pagar (
      prestador_id,
      obra_id,
      fornecedor_nome,
      descricao,
      valor_total,
      numero_parcela,
      total_parcelas,
      valor_parcela,
      data_vencimento,
      status
    ) VALUES (
      r.prestador_id,
      p_obra_id,
      COALESCE(NULLIF(TRIM(r.nome), ''), split_part(r.email, '@', 1)),
      'Comissão: ' || v_cliente_nome,
      r.valor,
      1,
      1,
      r.valor,
      CURRENT_DATE,
      'pendente'
    );
  END LOOP;

  UPDATE movelaria_obras
  SET comissao_gerada = true,
      atualizado_em = NOW()
  WHERE id = p_obra_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_aplicar_comissao_obra(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_aplicar_comissao_obra(UUID) TO authenticated;

-- ── 5. Financeiro do prestador (mês/ano) ─────────────────────
CREATE OR REPLACE FUNCTION movelaria_prestador_financeiro(
  p_mes INTEGER,
  p_ano INTEGER
)
RETURNS TABLE (
  tipo              TEXT,
  obra_id           UUID,
  conta_pagar_id    UUID,
  cliente_nome      TEXT,
  descricao         TEXT,
  valor             NUMERIC,
  status            TEXT,
  data_referencia   DATE
) AS $$
DECLARE
  v_uid    UUID := auth.uid();
  v_perfil TEXT := movelaria_meu_perfil();
BEGIN
  IF v_perfil NOT IN ('montador', 'montador_admin', 'administrador', 'financeiro', 'administrador_obras') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Previsto: comissões configuradas mas ainda não geradas como pagamento
  RETURN QUERY
  SELECT
    'previsto'::TEXT,
    o.id,
    NULL::UUID,
    o.cliente_nome,
    'Comissão prevista — ' || o.cliente_nome,
    ci.valor,
    'previsto'::TEXT,
    COALESCE(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em::DATE)
  FROM movelaria_obra_comissao_itens ci
  JOIN movelaria_obras o ON o.id = ci.obra_id
  WHERE ci.prestador_id = v_uid
    AND o.comissao_habilitada = true
    AND o.comissao_gerada = false
    AND ci.valor > 0
    AND EXTRACT(MONTH FROM COALESCE(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_mes
    AND EXTRACT(YEAR  FROM COALESCE(o.data_prevista_fim, o.data_prevista_inicio, o.criado_em)) = p_ano

  UNION ALL

  -- Pagamentos gerados (contas a pagar)
  SELECT
    'pagamento'::TEXT,
    cp.obra_id,
    cp.id,
    COALESCE(
      (SELECT o2.cliente_nome FROM movelaria_obras o2 WHERE o2.id = cp.obra_id),
      split_part(cp.descricao, ': ', 2),
      cp.fornecedor_nome
    ),
    cp.descricao,
    cp.valor_parcela,
    cp.status,
    COALESCE(cp.data_pagamento, cp.data_vencimento)
  FROM movelaria_contas_pagar cp
  WHERE cp.prestador_id = v_uid
    AND EXTRACT(MONTH FROM cp.data_vencimento) = p_mes
    AND EXTRACT(YEAR  FROM cp.data_vencimento) = p_ano

  ORDER BY 8, 4;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_prestador_financeiro(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_prestador_financeiro(INTEGER, INTEGER) TO authenticated;

-- ── 6. Atualizar movelaria_listar_obras ─────────────────────
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
    v_perfil IN ('administrador', 'financeiro', 'administrador_obras')
    OR (v_perfil = 'montador_admin' AND o.montador_admin_id = v_uid)
    OR (v_perfil = 'montador' AND movelaria_montador_acessa_obra(o.id, v_uid))
  )
  ORDER BY o.criado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_listar_obras() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_listar_obras() TO authenticated;

-- ── 7. Métricas de obras (total de comissões pagas/geradas) ──
DROP FUNCTION IF EXISTS movelaria_metricas_obras();
CREATE OR REPLACE FUNCTION movelaria_metricas_obras()
RETURNS TABLE (
  tipo_obra_id               UUID,
  tipo_obra_nome             TEXT,
  total_obras                BIGINT,
  obras_concluidas           BIGINT,
  tempo_medio_real_horas     NUMERIC,
  tempo_maximo_horas_default NUMERIC,
  obras_em_atraso            BIGINT,
  total_comissoes            NUMERIC
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.nome,
    COUNT(o.id),
    COUNT(o.id) FILTER (WHERE o.status_kanban = 'concluida'),
    ROUND(
      AVG(EXTRACT(EPOCH FROM (o.finalizado_em - o.iniciado_em)) / 3600.0)
      FILTER (WHERE o.finalizado_em IS NOT NULL AND o.iniciado_em IS NOT NULL),
      2
    ),
    t.tempo_maximo_horas_default,
    COUNT(o.id) FILTER (WHERE o.concluido_em_atraso = true),
    COALESCE(SUM(o.comissao_total) FILTER (WHERE o.comissao_habilitada = true AND o.comissao_gerada = true), 0)
  FROM movelaria_tipos_obra t
  LEFT JOIN movelaria_obras o ON o.tipo_obra_id = t.id
  WHERE t.ativo = true
  GROUP BY t.id, t.nome, t.tempo_maximo_horas_default
  ORDER BY t.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_metricas_obras() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_metricas_obras() TO authenticated;
