-- Administrador de grupo de obras vê todas as obras do grupo
-- (ex.: admin do grupo "bruno" enxerga todas as obras com grupo_obra_id desse grupo)

CREATE OR REPLACE FUNCTION movelaria_montador_admin_acessa_obra(p_obra_id UUID, p_uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM movelaria_obras o
    WHERE o.id = p_obra_id
      AND (
        o.montador_admin_id = p_uid
        OR EXISTS (
          SELECT 1
          FROM movelaria_grupos_obra g
          WHERE g.id = o.grupo_obra_id
            AND g.montador_admin_id = p_uid
        )
      )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_montador_admin_acessa_obra(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_montador_admin_acessa_obra(UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "obras_select_montador_admin" ON movelaria_obras;
CREATE POLICY "obras_select_montador_admin" ON movelaria_obras
  FOR SELECT TO authenticated
  USING (
    movelaria_meu_perfil() = 'montador_admin'
    AND movelaria_montador_admin_acessa_obra(id, auth.uid())
  );

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
    o.data_entrega_pedido,
    o.numero_pedido_cort_claud,
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
    OR (v_perfil = 'montador_admin' AND movelaria_montador_admin_acessa_obra(o.id, v_uid))
    OR (v_perfil = 'montador' AND movelaria_montador_acessa_obra(o.id, v_uid))
  )
  ORDER BY o.criado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_listar_obras() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_listar_obras() TO authenticated;

DROP FUNCTION IF EXISTS movelaria_painel_evolucao(TIMESTAMPTZ, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION movelaria_painel_evolucao(
  p_inicio TIMESTAMPTZ,
  p_fim    TIMESTAMPTZ
)
RETURNS TABLE (
  id           UUID,
  obra_id      UUID,
  obra_nome    TEXT,
  nome_arquivo TEXT,
  kind         TEXT,
  storage_path TEXT,
  preview_path TEXT,
  tirado_em    TIMESTAMPTZ,
  criado_por   UUID,
  criador_nome TEXT,
  observacao   TEXT
) AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_uid    UUID := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    e.id, e.obra_id, o.cliente_nome,
    e.nome_arquivo, e.kind,
    e.storage_path, e.preview_path,
    e.tirado_em, e.criado_por,
    u.nome,
    NULLIF(TRIM(e.observacao), '')
  FROM movelaria_obra_evolucao e
  JOIN movelaria_obras o ON o.id = e.obra_id
  LEFT JOIN movelaria_usuarios u ON u.id = e.criado_por
  WHERE e.tirado_em >= p_inicio
    AND e.tirado_em <= p_fim
    AND (
      v_perfil IN ('administrador', 'financeiro', 'administrador_obras')
      OR (v_perfil = 'montador_admin' AND movelaria_montador_admin_acessa_obra(o.id, v_uid))
      OR (v_perfil = 'montador' AND movelaria_montador_acessa_obra(o.id, v_uid))
    )
  ORDER BY e.tirado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_painel_evolucao(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_painel_evolucao(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
