-- ============================================================
-- GARBO Movelaria — Agenda de Obras
-- Migration 022 — Grupos, Tipos, Obras, Kanban
-- ============================================================

-- ── 1. Ampliar CHECK de perfil ────────────────────────────────
ALTER TABLE movelaria_usuarios
  DROP CONSTRAINT IF EXISTS movelaria_usuarios_perfil_check;

ALTER TABLE movelaria_usuarios
  ADD CONSTRAINT movelaria_usuarios_perfil_check
  CHECK (perfil IN (
    'administrador', 'financeiro', 'marceneiro', 'montador', 'montador_admin'
  ));

-- ── 2. Atualizar função de atualização de perfil ─────────────
CREATE OR REPLACE FUNCTION movelaria_atualizar_perfil_usuario(
  p_id     UUID,
  p_perfil TEXT,
  p_nome   TEXT    DEFAULT NULL,
  p_ativo  BOOLEAN DEFAULT NULL
)
RETURNS void AS $$
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem alterar perfis';
  END IF;
  IF p_perfil IS NOT NULL AND p_perfil NOT IN (
    'administrador','financeiro','marceneiro','montador','montador_admin'
  ) THEN
    RAISE EXCEPTION 'Perfil inválido: %', p_perfil;
  END IF;
  UPDATE movelaria_usuarios
  SET
    perfil        = COALESCE(p_perfil, perfil),
    nome          = COALESCE(p_nome, nome),
    ativo         = COALESCE(p_ativo, ativo),
    atualizado_em = NOW()
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 3. Trigger helper: toca atualizado_em ────────────────────
CREATE OR REPLACE FUNCTION movelaria_touch_atualizado_em()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 4. Grupos de Obra ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_grupos_obra (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome              TEXT        NOT NULL,
  descricao         TEXT,
  montador_admin_id UUID        REFERENCES movelaria_usuarios(id) ON DELETE SET NULL,
  ativo             BOOLEAN     NOT NULL DEFAULT true,
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_grupos_obra_atualizado ON movelaria_grupos_obra;
CREATE TRIGGER trg_grupos_obra_atualizado
  BEFORE UPDATE ON movelaria_grupos_obra
  FOR EACH ROW EXECUTE FUNCTION movelaria_touch_atualizado_em();

ALTER TABLE movelaria_grupos_obra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "grupos_obra_select" ON movelaria_grupos_obra;
CREATE POLICY "grupos_obra_select" ON movelaria_grupos_obra
  FOR SELECT TO authenticated USING (movelaria_meu_perfil() IS NOT NULL);

DROP POLICY IF EXISTS "grupos_obra_insert" ON movelaria_grupos_obra;
CREATE POLICY "grupos_obra_insert" ON movelaria_grupos_obra
  FOR INSERT TO authenticated WITH CHECK (movelaria_meu_perfil() = 'administrador');

DROP POLICY IF EXISTS "grupos_obra_update" ON movelaria_grupos_obra;
CREATE POLICY "grupos_obra_update" ON movelaria_grupos_obra
  FOR UPDATE TO authenticated
  USING (movelaria_meu_perfil() = 'administrador')
  WITH CHECK (movelaria_meu_perfil() = 'administrador');

DROP POLICY IF EXISTS "grupos_obra_delete" ON movelaria_grupos_obra;
CREATE POLICY "grupos_obra_delete" ON movelaria_grupos_obra
  FOR DELETE TO authenticated USING (movelaria_meu_perfil() = 'administrador');

-- ── 5. Tipos de Obra ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_tipos_obra (
  id                         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome                       TEXT        NOT NULL,
  descricao                  TEXT,
  tempo_medio_horas          NUMERIC(8,2),
  tempo_maximo_horas_default NUMERIC(8,2),
  ativo                      BOOLEAN     NOT NULL DEFAULT true,
  criado_em                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_tipos_obra_atualizado ON movelaria_tipos_obra;
CREATE TRIGGER trg_tipos_obra_atualizado
  BEFORE UPDATE ON movelaria_tipos_obra
  FOR EACH ROW EXECUTE FUNCTION movelaria_touch_atualizado_em();

ALTER TABLE movelaria_tipos_obra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tipos_obra_select" ON movelaria_tipos_obra;
CREATE POLICY "tipos_obra_select" ON movelaria_tipos_obra
  FOR SELECT TO authenticated USING (movelaria_meu_perfil() IS NOT NULL);

DROP POLICY IF EXISTS "tipos_obra_insert" ON movelaria_tipos_obra;
CREATE POLICY "tipos_obra_insert" ON movelaria_tipos_obra
  FOR INSERT TO authenticated WITH CHECK (movelaria_meu_perfil() = 'administrador');

DROP POLICY IF EXISTS "tipos_obra_update" ON movelaria_tipos_obra;
CREATE POLICY "tipos_obra_update" ON movelaria_tipos_obra
  FOR UPDATE TO authenticated
  USING (movelaria_meu_perfil() = 'administrador')
  WITH CHECK (movelaria_meu_perfil() = 'administrador');

DROP POLICY IF EXISTS "tipos_obra_delete" ON movelaria_tipos_obra;
CREATE POLICY "tipos_obra_delete" ON movelaria_tipos_obra
  FOR DELETE TO authenticated USING (movelaria_meu_perfil() = 'administrador');

-- ── 6. Obras ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_obras (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  origem_orcamento_id  UUID        REFERENCES movelaria_orcamentos_fechados(id) ON DELETE SET NULL,
  origem_lead_id       TEXT,
  cliente_id           UUID        REFERENCES movelaria_clientes(id) ON DELETE SET NULL,
  cliente_nome         TEXT        NOT NULL,
  lousa                TEXT,
  endereco_obra        TEXT,
  tipo_obra_id         UUID        REFERENCES movelaria_tipos_obra(id) ON DELETE SET NULL,
  grupo_obra_id        UUID        REFERENCES movelaria_grupos_obra(id) ON DELETE SET NULL,
  montador_admin_id    UUID        REFERENCES movelaria_usuarios(id) ON DELETE SET NULL,
  montador_id          UUID        REFERENCES movelaria_usuarios(id) ON DELETE SET NULL,
  data_prevista_inicio DATE,
  data_prevista_fim    DATE,
  tempo_maximo_horas   NUMERIC(8,2),
  status_kanban        TEXT        NOT NULL DEFAULT 'datas_em_aberto'
                         CHECK (status_kanban IN (
                           'datas_em_aberto','datas_em_atraso','datas_definidas',
                           'em_andamento','concluida','cancelada'
                         )),
  iniciado_em          TIMESTAMPTZ,
  finalizado_em        TIMESTAMPTZ,
  concluido_em_atraso  BOOLEAN     GENERATED ALWAYS AS (
    CASE
      WHEN finalizado_em IS NOT NULL
       AND iniciado_em IS NOT NULL
       AND tempo_maximo_horas IS NOT NULL
      THEN EXTRACT(EPOCH FROM (finalizado_em - iniciado_em)) / 3600.0 > tempo_maximo_horas
      ELSE NULL
    END
  ) STORED,
  criado_em            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DROP TRIGGER IF EXISTS trg_obras_atualizado ON movelaria_obras;
CREATE TRIGGER trg_obras_atualizado
  BEFORE UPDATE ON movelaria_obras
  FOR EACH ROW EXECUTE FUNCTION movelaria_touch_atualizado_em();

CREATE INDEX IF NOT EXISTS idx_obras_status    ON movelaria_obras(status_kanban);
CREATE INDEX IF NOT EXISTS idx_obras_cliente   ON movelaria_obras(cliente_id);
CREATE INDEX IF NOT EXISTS idx_obras_montador  ON movelaria_obras(montador_id);
CREATE INDEX IF NOT EXISTS idx_obras_grupo     ON movelaria_obras(grupo_obra_id);
CREATE INDEX IF NOT EXISTS idx_obras_datas     ON movelaria_obras(data_prevista_inicio, data_prevista_fim);

ALTER TABLE movelaria_obras ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obras_select_admin"          ON movelaria_obras;
DROP POLICY IF EXISTS "obras_select_montador_admin" ON movelaria_obras;
DROP POLICY IF EXISTS "obras_select_montador"       ON movelaria_obras;
DROP POLICY IF EXISTS "obras_insert"                ON movelaria_obras;
DROP POLICY IF EXISTS "obras_update_admin"          ON movelaria_obras;
DROP POLICY IF EXISTS "obras_update_montador"       ON movelaria_obras;
DROP POLICY IF EXISTS "obras_delete"                ON movelaria_obras;

CREATE POLICY "obras_select_admin" ON movelaria_obras
  FOR SELECT TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

CREATE POLICY "obras_select_montador_admin" ON movelaria_obras
  FOR SELECT TO authenticated
  USING (
    movelaria_meu_perfil() = 'montador_admin'
    AND montador_admin_id = auth.uid()
  );

CREATE POLICY "obras_select_montador" ON movelaria_obras
  FOR SELECT TO authenticated
  USING (
    movelaria_meu_perfil() = 'montador'
    AND montador_id = auth.uid()
  );

CREATE POLICY "obras_insert" ON movelaria_obras
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador','montador_admin','financeiro'));

CREATE POLICY "obras_update_admin" ON movelaria_obras
  FOR UPDATE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador','montador_admin','financeiro'))
  WITH CHECK (movelaria_meu_perfil() IN ('administrador','montador_admin','financeiro'));

CREATE POLICY "obras_update_montador" ON movelaria_obras
  FOR UPDATE TO authenticated
  USING (movelaria_meu_perfil() = 'montador' AND montador_id = auth.uid())
  WITH CHECK (movelaria_meu_perfil() = 'montador' AND montador_id = auth.uid());

CREATE POLICY "obras_delete" ON movelaria_obras
  FOR DELETE TO authenticated
  USING (movelaria_meu_perfil() = 'administrador');

-- ── 7. Obra Responsáveis (múltiplos montadores) ──────────────
CREATE TABLE IF NOT EXISTS movelaria_obra_responsaveis (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id     UUID        NOT NULL REFERENCES movelaria_obras(id) ON DELETE CASCADE,
  montador_id UUID        NOT NULL REFERENCES movelaria_usuarios(id) ON DELETE CASCADE,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (obra_id, montador_id)
);

CREATE INDEX IF NOT EXISTS idx_obra_resp_obra     ON movelaria_obra_responsaveis(obra_id);
CREATE INDEX IF NOT EXISTS idx_obra_resp_montador ON movelaria_obra_responsaveis(montador_id);

ALTER TABLE movelaria_obra_responsaveis ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obra_resp_select" ON movelaria_obra_responsaveis;
DROP POLICY IF EXISTS "obra_resp_insert" ON movelaria_obra_responsaveis;
DROP POLICY IF EXISTS "obra_resp_delete" ON movelaria_obra_responsaveis;

CREATE POLICY "obra_resp_select" ON movelaria_obra_responsaveis
  FOR SELECT TO authenticated USING (movelaria_meu_perfil() IS NOT NULL);
CREATE POLICY "obra_resp_insert" ON movelaria_obra_responsaveis
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador','montador_admin'));
CREATE POLICY "obra_resp_delete" ON movelaria_obra_responsaveis
  FOR DELETE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador','montador_admin'));

-- ── 8. Kanban Colunas (configuração) ─────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_kanban_colunas_obra (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  titulo     TEXT        NOT NULL,
  status_key TEXT        NOT NULL UNIQUE,
  cor        TEXT,
  ordem      INTEGER     NOT NULL DEFAULT 0,
  ativo      BOOLEAN     NOT NULL DEFAULT true,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE movelaria_kanban_colunas_obra ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "kanban_cols_select" ON movelaria_kanban_colunas_obra;
DROP POLICY IF EXISTS "kanban_cols_insert" ON movelaria_kanban_colunas_obra;
DROP POLICY IF EXISTS "kanban_cols_update" ON movelaria_kanban_colunas_obra;
DROP POLICY IF EXISTS "kanban_cols_delete" ON movelaria_kanban_colunas_obra;

CREATE POLICY "kanban_cols_select" ON movelaria_kanban_colunas_obra
  FOR SELECT TO authenticated USING (movelaria_meu_perfil() IS NOT NULL);
CREATE POLICY "kanban_cols_insert" ON movelaria_kanban_colunas_obra
  FOR INSERT TO authenticated WITH CHECK (movelaria_meu_perfil() = 'administrador');
CREATE POLICY "kanban_cols_update" ON movelaria_kanban_colunas_obra
  FOR UPDATE TO authenticated
  USING (movelaria_meu_perfil() = 'administrador')
  WITH CHECK (movelaria_meu_perfil() = 'administrador');
CREATE POLICY "kanban_cols_delete" ON movelaria_kanban_colunas_obra
  FOR DELETE TO authenticated USING (movelaria_meu_perfil() = 'administrador');

INSERT INTO movelaria_kanban_colunas_obra (titulo, status_key, cor, ordem) VALUES
  ('Datas em Aberto', 'datas_em_aberto', '#6b7280', 1),
  ('Datas em Atraso', 'datas_em_atraso', '#ef4444', 2),
  ('Datas Definidas', 'datas_definidas', '#3b82f6', 3),
  ('Em Andamento',    'em_andamento',    '#f59e0b', 4),
  ('Concluída',       'concluida',       '#10b981', 5),
  ('Cancelada',       'cancelada',       '#9ca3af', 6)
ON CONFLICT (status_key) DO NOTHING;

-- ── 9. Funções SECURITY DEFINER ───────────────────────────────

-- Lista montadores ativos (admin e montador_admin)
DROP FUNCTION IF EXISTS movelaria_listar_montadores();
CREATE OR REPLACE FUNCTION movelaria_listar_montadores()
RETURNS TABLE (id UUID, email TEXT, nome TEXT, perfil TEXT, ativo BOOLEAN) AS $$
BEGIN
  IF movelaria_meu_perfil() NOT IN ('administrador','montador_admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;
  RETURN QUERY
    SELECT u.id, u.email, u.nome, u.perfil, u.ativo
    FROM   movelaria_usuarios u
    WHERE  u.perfil IN ('montador','montador_admin') AND u.ativo = true
    ORDER  BY u.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_listar_montadores() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_listar_montadores() TO authenticated;

-- Lista obras com joins (respeitando papel do caller)
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
    o.montador_admin_id, uma.nome,
    o.montador_id, um.nome,
    o.data_prevista_inicio, o.data_prevista_fim, o.tempo_maximo_horas,
    o.status_kanban, o.iniciado_em, o.finalizado_em, o.concluido_em_atraso,
    o.criado_em, o.atualizado_em
  FROM movelaria_obras o
  LEFT JOIN movelaria_tipos_obra t  ON t.id = o.tipo_obra_id
  LEFT JOIN movelaria_grupos_obra g ON g.id = o.grupo_obra_id
  LEFT JOIN movelaria_usuarios um   ON um.id = o.montador_id
  LEFT JOIN movelaria_usuarios uma  ON uma.id = o.montador_admin_id
  WHERE (
    v_perfil IN ('administrador','financeiro')
    OR (v_perfil = 'montador_admin' AND o.montador_admin_id = v_uid)
    OR (v_perfil = 'montador'       AND o.montador_id       = v_uid)
  )
  ORDER BY o.criado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_listar_obras() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_listar_obras() TO authenticated;

-- Cria obra a partir de orçamento fechado
DROP FUNCTION IF EXISTS movelaria_criar_obra_de_orcamento(UUID, UUID, TEXT, TEXT, TEXT);
CREATE OR REPLACE FUNCTION movelaria_criar_obra_de_orcamento(
  p_orcamento_id UUID,
  p_cliente_id   UUID,
  p_cliente_nome TEXT,
  p_lead_id      TEXT    DEFAULT NULL,
  p_lousa        TEXT    DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO movelaria_obras (
    origem_orcamento_id, origem_lead_id,
    cliente_id, cliente_nome, lousa, status_kanban
  ) VALUES (
    p_orcamento_id, p_lead_id,
    p_cliente_id, p_cliente_nome, p_lousa, 'datas_em_aberto'
  )
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_criar_obra_de_orcamento(UUID, UUID, TEXT, TEXT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_criar_obra_de_orcamento(UUID, UUID, TEXT, TEXT, TEXT) TO authenticated;

-- Inicia obra
DROP FUNCTION IF EXISTS movelaria_iniciar_obra(UUID);
CREATE OR REPLACE FUNCTION movelaria_iniciar_obra(p_obra_id UUID)
RETURNS void AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
BEGIN
  IF v_perfil = 'montador' AND NOT EXISTS (
    SELECT 1 FROM movelaria_obras WHERE id = p_obra_id AND montador_id = auth.uid()
  ) THEN
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
GRANT  EXECUTE ON FUNCTION movelaria_iniciar_obra(UUID) TO authenticated;

-- Finaliza obra
DROP FUNCTION IF EXISTS movelaria_finalizar_obra(UUID);
CREATE OR REPLACE FUNCTION movelaria_finalizar_obra(p_obra_id UUID)
RETURNS void AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
BEGIN
  IF v_perfil = 'montador' AND NOT EXISTS (
    SELECT 1 FROM movelaria_obras WHERE id = p_obra_id AND montador_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Acesso negado: obra não atribuída a você';
  END IF;
  UPDATE movelaria_obras
  SET finalizado_em = NOW(),
      status_kanban = 'concluida',
      atualizado_em = NOW()
  WHERE id = p_obra_id AND iniciado_em IS NOT NULL AND finalizado_em IS NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_finalizar_obra(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_finalizar_obra(UUID) TO authenticated;

-- Métricas por tipo de obra
DROP FUNCTION IF EXISTS movelaria_metricas_obras();
CREATE OR REPLACE FUNCTION movelaria_metricas_obras()
RETURNS TABLE (
  tipo_obra_id               UUID,
  tipo_obra_nome             TEXT,
  total_obras                BIGINT,
  obras_concluidas           BIGINT,
  tempo_medio_real_horas     NUMERIC,
  tempo_maximo_horas_default NUMERIC,
  obras_em_atraso            BIGINT
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
    COUNT(o.id) FILTER (WHERE o.concluido_em_atraso = true)
  FROM movelaria_tipos_obra t
  LEFT JOIN movelaria_obras o ON o.tipo_obra_id = t.id
  WHERE t.ativo = true
  GROUP BY t.id, t.nome, t.tempo_maximo_horas_default
  ORDER BY t.nome;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_metricas_obras() FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_metricas_obras() TO authenticated;
