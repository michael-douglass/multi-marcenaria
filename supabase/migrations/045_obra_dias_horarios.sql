-- ============================================================
-- GARBO Movelaria — Dias e Horários de Trabalho por Obra
-- Migration 045
-- ============================================================

ALTER TABLE movelaria_obras
  ADD COLUMN IF NOT EXISTS dias_trabalho  INTEGER[],
  ADD COLUMN IF NOT EXISTS horario_inicio TEXT,
  ADD COLUMN IF NOT EXISTS horario_fim    TEXT;

-- Recria movelaria_listar_obras com todos os campos (inclui correção
-- dos campos descricao/pedido_material_feito omitidos na 044)
DROP FUNCTION IF EXISTS movelaria_listar_obras();
CREATE OR REPLACE FUNCTION movelaria_listar_obras()
RETURNS TABLE (
  id                   UUID,
  origem_orcamento_id  UUID,
  origem_lead_id       TEXT,
  cliente_id           UUID,
  cliente_nome         TEXT,
  lousa                TEXT,
  descricao            TEXT,
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
  pedido_material_feito BOOLEAN,
  criado_em            TIMESTAMPTZ,
  atualizado_em        TIMESTAMPTZ,
  comissao_habilitada  BOOLEAN,
  comissao_total       NUMERIC,
  comissao_gerada      BOOLEAN,
  dias_trabalho        INTEGER[],
  horario_inicio       TEXT,
  horario_fim          TEXT
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
    o.dias_trabalho, o.horario_inicio, o.horario_fim
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

REVOKE ALL ON FUNCTION movelaria_listar_obras() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_listar_obras() TO authenticated;
