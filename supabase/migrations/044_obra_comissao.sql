-- ============================================================
-- GARBO Movelaria — Comissões de Obras
-- Migration 044 — Sistema de comissões para prestadores
-- ============================================================

-- ── 1. Adicionar campos de comissão em movelaria_obras ───────
ALTER TABLE movelaria_obras
  ADD COLUMN IF NOT EXISTS comissao_habilitada BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS comissao_total      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS comissao_gerada      BOOLEAN NOT NULL DEFAULT false;

-- ── 2. Adicionar campo de prestador em contas_pagar ──────────
ALTER TABLE movelaria_contas_pagar
  ADD COLUMN IF NOT EXISTS prestador_id UUID REFERENCES movelaria_usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_contas_pagar_prestador ON movelaria_contas_pagar(prestador_id);

-- ── 3. Função para aplicar comissão de uma obra ───────────────
CREATE OR REPLACE FUNCTION movelaria_aplicar_comissao_obra(p_obra_id UUID)
RETURNS void AS $$
DECLARE
  v_comissao_total NUMERIC(12, 2);
  v_montadores     UUID[];
  v_num_montadores INTEGER;
  v_valor_cada     NUMERIC(12, 2);
  v_cliente_nome   TEXT;
  v_perfil         TEXT := movelaria_meu_perfil();
BEGIN
  -- Verificar permissão
  IF v_perfil NOT IN ('administrador', 'financeiro') THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores ou financeiro podem aplicar comissões';
  END IF;

  -- Buscar dados da obra
  SELECT comissao_total, cliente_nome, comissao_gerada
  INTO v_comissao_total, v_cliente_nome, v_num_montadores -- reuso v_num_montadores temporariamente para gerada
  FROM movelaria_obras
  WHERE id = p_obra_id;

  IF v_num_montadores::BOOLEAN THEN -- se comissao_gerada for true
    RAISE EXCEPTION 'Comissão já foi gerada para esta obra';
  END IF;

  IF v_comissao_total <= 0 THEN
    RAISE EXCEPTION 'Valor da comissão deve ser maior que zero';
  END IF;

  -- Buscar montadores responsáveis
  SELECT array_agg(montador_id)
  INTO v_montadores
  FROM movelaria_obra_responsaveis
  WHERE obra_id = p_obra_id;

  v_num_montadores := coalesce(array_length(v_montadores, 1), 0);

  IF v_num_montadores = 0 THEN
    RAISE EXCEPTION 'Nenhum montador designado para esta obra';
  END IF;

  v_valor_cada := ROUND(v_comissao_total / v_num_montadores, 2);

  -- Criar lançamentos em contas_pagar
  INSERT INTO movelaria_contas_pagar (
    prestador_id,
    fornecedor_nome,
    descricao,
    valor_total,
    numero_parcela,
    total_parcelas,
    valor_parcela,
    data_vencimento,
    status
  )
  SELECT
    m_id,
    u.nome,
    'Comissão: ' || v_cliente_nome,
    v_valor_cada,
    1,
    1,
    v_valor_cada,
    CURRENT_DATE,
    'pendente'
  FROM unnest(v_montadores) AS m_id
  JOIN movelaria_usuarios u ON u.id = m_id;

  -- Marcar como gerada
  UPDATE movelaria_obras
  SET comissao_gerada = true,
      atualizado_em = NOW()
  WHERE id = p_obra_id;

END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_aplicar_comissao_obra(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_aplicar_comissao_obra(UUID) TO authenticated;

-- ── 4. Atualizar movelaria_listar_obras ───────────────────────
DROP FUNCTION IF EXISTS movelaria_listar_obras();
CREATE OR REPLACE FUNCTION movelaria_listar_obras()
RETURNS TABLE (
  id                   UUID,
  origem_orcamento_id  UUID,
  origem_lead_id       TEXT,
  cliente_id           UUID,
  cliente_nome         TEXT,
  lousa                TEXT,
  endereco_obra        TEXT,
  tipo_obra_id         UUID,
  tipo_obra_nome       TEXT,
  grupo_obra_id        UUID,
  grupo_obra_nome      TEXT,
  montador_admin_id    UUID,
  montador_admin_nome  TEXT,
  montador_id          UUID,
  montador_nome        TEXT,
  montador_ids         UUID[],
  montador_nomes       TEXT[],
  data_prevista_inicio DATE,
  data_prevista_fim    DATE,
  tempo_maximo_horas   NUMERIC,
  status_kanban        TEXT,
  iniciado_em          TIMESTAMPTZ,
  finalizado_em        TIMESTAMPTZ,
  concluido_em_atraso  BOOLEAN,
  criado_em            TIMESTAMPTZ,
  atualizado_em        TIMESTAMPTZ,
  comissao_habilitada  BOOLEAN,
  comissao_total       NUMERIC,
  comissao_gerada      BOOLEAN
) AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_uid    UUID := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    o.id, o.origem_orcamento_id, o.origem_lead_id, o.cliente_id,
    o.cliente_nome, o.lousa, o.endereco_obra,
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
    COALESCE(resp.ids, ARRAY[]::UUID[]),
    COALESCE(resp.nomes, ARRAY[]::TEXT[]),
    o.data_prevista_inicio, o.data_prevista_fim, o.tempo_maximo_horas,
    o.status_kanban, o.iniciado_em, o.finalizado_em, o.concluido_em_atraso,
    o.criado_em, o.atualizado_em,
    o.comissao_habilitada, o.comissao_total, o.comissao_gerada
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
  WHERE (
    v_perfil IN ('administrador', 'financeiro', 'administrador_obras')
    OR (v_perfil = 'montador_admin' AND o.montador_admin_id = v_uid)
    OR (v_perfil = 'montador' AND movelaria_montador_acessa_obra(o.id, v_uid))
  )
  ORDER BY o.criado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ── 5. Atualizar movelaria_metricas_obras ─────────────────────
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
    COALESCE(SUM(o.comissao_total) FILTER (WHERE o.comissao_habilitada = true), 0)
  FROM movelaria_tipos_obra t
  LEFT JOIN movelaria_obras o ON o.tipo_obra_id = t.id
  WHERE t.ativo = true
  GROUP BY t.id, t.nome, t.tempo_maximo_horas_default
  ORDER BY t.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;
