-- Múltiplos montadores por obra (movelaria_obra_responsaveis já existia; integração completa)

-- Backfill: montador principal também entra na tabela de responsáveis
INSERT INTO movelaria_obra_responsaveis (obra_id, montador_id)
SELECT o.id, o.montador_id
FROM movelaria_obras o
WHERE o.montador_id IS NOT NULL
ON CONFLICT (obra_id, montador_id) DO NOTHING;

-- Helper: montador tem acesso à obra (principal ou na lista de responsáveis)
CREATE OR REPLACE FUNCTION movelaria_montador_acessa_obra(p_obra_id UUID, p_uid UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM movelaria_obras o
    WHERE o.id = p_obra_id
      AND (
        o.montador_id = p_uid
        OR EXISTS (
          SELECT 1
          FROM movelaria_obra_responsaveis r
          WHERE r.obra_id = o.id AND r.montador_id = p_uid
        )
      )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_montador_acessa_obra(UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_montador_acessa_obra(UUID, UUID) TO authenticated;

-- Sincroniza lista de montadores (transação única)
CREATE OR REPLACE FUNCTION movelaria_sincronizar_obra_montadores(
  p_obra_id UUID,
  p_montador_ids UUID[]
)
RETURNS void AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_ids    UUID[] := ARRAY[]::UUID[];
  v_id     UUID;
BEGIN
  IF v_perfil NOT IN ('administrador', 'montador_admin', 'administrador_obras', 'financeiro') THEN
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
  SET montador_id   = CASE WHEN coalesce(array_length(v_ids, 1), 0) > 0 THEN v_ids[1] ELSE NULL END,
      atualizado_em = NOW()
  WHERE id = p_obra_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_sincronizar_obra_montadores(UUID, UUID[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_sincronizar_obra_montadores(UUID, UUID[]) TO authenticated;

-- RLS: montador vê obra se estiver na lista de responsáveis
DROP POLICY IF EXISTS "obras_select_montador" ON movelaria_obras;
CREATE POLICY "obras_select_montador" ON movelaria_obras
  FOR SELECT TO authenticated
  USING (
    movelaria_meu_perfil() = 'montador'
    AND movelaria_montador_acessa_obra(id, auth.uid())
  );

DROP POLICY IF EXISTS "obras_update_montador" ON movelaria_obras;
CREATE POLICY "obras_update_montador" ON movelaria_obras
  FOR UPDATE TO authenticated
  USING (
    movelaria_meu_perfil() = 'montador'
    AND movelaria_montador_acessa_obra(id, auth.uid())
  )
  WITH CHECK (
    movelaria_meu_perfil() = 'montador'
    AND movelaria_montador_acessa_obra(id, auth.uid())
  );

-- Responsáveis: quem edita obras pode gerenciar a lista
DROP POLICY IF EXISTS "obra_resp_insert" ON movelaria_obra_responsaveis;
CREATE POLICY "obra_resp_insert" ON movelaria_obra_responsaveis
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'montador_admin', 'administrador_obras', 'financeiro'));

DROP POLICY IF EXISTS "obra_resp_delete" ON movelaria_obra_responsaveis;
CREATE POLICY "obra_resp_delete" ON movelaria_obra_responsaveis
  FOR DELETE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'montador_admin', 'administrador_obras', 'financeiro'));

-- Listar obras com arrays de montadores
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
  atualizado_em        TIMESTAMPTZ
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
    o.criado_em, o.atualizado_em
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
GRANT EXECUTE ON FUNCTION movelaria_listar_obras() TO authenticated;

-- Painel evolução: montadores da lista também veem fotos
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
  criador_nome TEXT
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
    u.nome
  FROM movelaria_obra_evolucao e
  JOIN movelaria_obras o ON o.id = e.obra_id
  LEFT JOIN movelaria_usuarios u ON u.id = e.criado_por
  WHERE e.tirado_em >= p_inicio
    AND e.tirado_em <= p_fim
    AND (
      v_perfil IN ('administrador', 'financeiro', 'administrador_obras')
      OR (v_perfil = 'montador_admin' AND o.montador_admin_id = v_uid)
      OR (v_perfil = 'montador' AND movelaria_montador_acessa_obra(o.id, v_uid))
    )
  ORDER BY e.tirado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_painel_evolucao(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_painel_evolucao(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;

-- Iniciar / finalizar obra: qualquer montador da lista pode agir
DROP FUNCTION IF EXISTS movelaria_iniciar_obra(UUID);
CREATE OR REPLACE FUNCTION movelaria_iniciar_obra(p_obra_id UUID)
RETURNS void AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
BEGIN
  IF v_perfil = 'montador' AND NOT movelaria_montador_acessa_obra(p_obra_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: obra não atribuída a você';
  END IF;
  UPDATE movelaria_obras
  SET iniciado_em   = NOW(),
      status_kanban = 'em_andamento',
      atualizado_em = NOW()
  WHERE id = p_obra_id AND iniciado_em IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_iniciar_obra(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_iniciar_obra(UUID) TO authenticated;

DROP FUNCTION IF EXISTS movelaria_finalizar_obra(UUID);
CREATE OR REPLACE FUNCTION movelaria_finalizar_obra(p_obra_id UUID)
RETURNS void AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
BEGIN
  IF v_perfil = 'montador' AND NOT movelaria_montador_acessa_obra(p_obra_id, auth.uid()) THEN
    RAISE EXCEPTION 'Acesso negado: obra não atribuída a você';
  END IF;
  UPDATE movelaria_obras
  SET finalizado_em = NOW(),
      status_kanban = 'concluida',
      atualizado_em = NOW()
  WHERE id = p_obra_id AND finalizado_em IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_finalizar_obra(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_finalizar_obra(UUID) TO authenticated;
