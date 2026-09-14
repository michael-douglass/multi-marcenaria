-- ============================================================
-- GARBO Movelaria — Obras: respeitar perfis_extras na listagem/RLS
-- Migration 189
--
-- Problema: movelaria_listar_obras() e as policies de movelaria_obras
-- usavam só movelaria_meu_perfil() (coluna perfil). Quem tem
-- administrador_obras / montador_admin em perfis_extras via o app
-- com os menus certos, mas o banco filtrava como se fosse só o
-- perfil principal (ex.: montador) e as obras sumiam.
-- ============================================================

-- ── 1. Listagem de obras considera multi-perfil ───────────────
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
  comissao_ocultos        BOOLEAN[],
  montadores_execucao     JSONB
) AS $$
DECLARE
  v_uid                 UUID := auth.uid();
  v_ve_todas            BOOLEAN := movelaria_usuario_tem_algum_perfil(
    ARRAY['administrador', 'financeiro', 'administrador_obras', 'visualizador']
  );
  v_eh_montador_admin   BOOLEAN := movelaria_usuario_tem_perfil('montador_admin');
  v_eh_montador         BOOLEAN := movelaria_usuario_tem_perfil('montador');
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
    COALESCE(com.ocultos, ARRAY[]::BOOLEAN[]),
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
      array_agg(ci.valor ORDER BY ci.criado_em) AS valores,
      array_agg(COALESCE(ci.oculto_prestador, false) ORDER BY ci.criado_em) AS ocultos
    FROM movelaria_obra_comissao_itens ci
    JOIN movelaria_usuarios pu ON pu.id = ci.prestador_id
    WHERE ci.obra_id = o.id
      AND ci.valor > 0
      AND (
        v_ve_todas
        OR NOT (COALESCE(ci.oculto_prestador, false) AND ci.prestador_id = v_uid)
      )
  ) com ON true
  WHERE (
    v_ve_todas
    OR (v_eh_montador_admin AND movelaria_montador_admin_acessa_obra(o.id, v_uid))
    OR (v_eh_montador AND movelaria_montador_acessa_obra(o.id, v_uid))
  )
  ORDER BY o.criado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_listar_obras() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_listar_obras() TO authenticated;

-- ── 2. Policies de obras também consideram perfis_extras ──────
DROP POLICY IF EXISTS "obras_select_admin" ON movelaria_obras;
CREATE POLICY "obras_select_admin" ON movelaria_obras
  FOR SELECT TO authenticated
  USING (
    movelaria_usuario_tem_algum_perfil(
      ARRAY['administrador', 'financeiro', 'administrador_obras', 'visualizador']
    )
  );

DROP POLICY IF EXISTS "obras_select_montador_admin" ON movelaria_obras;
CREATE POLICY "obras_select_montador_admin" ON movelaria_obras
  FOR SELECT TO authenticated
  USING (
    movelaria_usuario_tem_perfil('montador_admin')
    AND movelaria_montador_admin_pode_acessar_obra(montador_admin_id, grupo_obra_id, auth.uid())
  );

DROP POLICY IF EXISTS "obras_select_montador" ON movelaria_obras;
CREATE POLICY "obras_select_montador" ON movelaria_obras
  FOR SELECT TO authenticated
  USING (
    movelaria_usuario_tem_perfil('montador')
    AND movelaria_montador_acessa_obra(id, auth.uid())
  );

DROP POLICY IF EXISTS "obras_insert" ON movelaria_obras;
CREATE POLICY "obras_insert" ON movelaria_obras
  FOR INSERT TO authenticated
  WITH CHECK (
    movelaria_usuario_tem_algum_perfil(
      ARRAY['administrador', 'montador_admin', 'financeiro', 'administrador_obras']
    )
  );

DROP POLICY IF EXISTS "obras_update_admin" ON movelaria_obras;
CREATE POLICY "obras_update_admin" ON movelaria_obras
  FOR UPDATE TO authenticated
  USING (
    movelaria_usuario_tem_algum_perfil(
      ARRAY['administrador', 'financeiro', 'administrador_obras']
    )
    OR (
      movelaria_usuario_tem_perfil('montador_admin')
      AND movelaria_montador_admin_pode_acessar_obra(montador_admin_id, grupo_obra_id, auth.uid())
    )
  )
  WITH CHECK (
    movelaria_usuario_tem_algum_perfil(
      ARRAY['administrador', 'financeiro', 'administrador_obras']
    )
    OR (
      movelaria_usuario_tem_perfil('montador_admin')
      AND movelaria_montador_admin_pode_acessar_obra(montador_admin_id, grupo_obra_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "obras_update_montador" ON movelaria_obras;
CREATE POLICY "obras_update_montador" ON movelaria_obras
  FOR UPDATE TO authenticated
  USING (
    movelaria_usuario_tem_perfil('montador')
    AND movelaria_montador_acessa_obra(id, auth.uid())
  )
  WITH CHECK (
    movelaria_usuario_tem_perfil('montador')
    AND movelaria_montador_acessa_obra(id, auth.uid())
  );

DROP POLICY IF EXISTS "obras_delete" ON movelaria_obras;
CREATE POLICY "obras_delete" ON movelaria_obras
  FOR DELETE TO authenticated
  USING (
    movelaria_usuario_tem_algum_perfil(
      ARRAY['administrador', 'administrador_obras']
    )
  );

-- ── 3. Trigger de vínculo do montador admin (perfil extra) ────
CREATE OR REPLACE FUNCTION movelaria_obra_before_update_montador_admin()
RETURNS TRIGGER AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF movelaria_usuario_tem_perfil('montador_admin')
     AND NOT movelaria_usuario_tem_algum_perfil(
       ARRAY['administrador', 'financeiro', 'administrador_obras']
     )
     AND v_uid IS NOT NULL
  THEN
    IF EXISTS (
      SELECT 1
      FROM movelaria_grupos_obra g
      WHERE g.id = NEW.grupo_obra_id
        AND g.montador_admin_id = v_uid
    ) THEN
      NEW.montador_admin_id := v_uid;
    ELSIF NEW.montador_admin_id IS NULL THEN
      NEW.montador_admin_id := v_uid;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

NOTIFY pgrst, 'reload schema';
