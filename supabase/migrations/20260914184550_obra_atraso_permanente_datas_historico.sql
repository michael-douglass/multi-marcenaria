-- ============================================================
-- GARBO Movelaria — Atraso permanente + histórico de datas
-- Migration 20260914184550
--
-- 1) Marca atraso_permanente na 1ª vez que o prazo vence (nunca limpa)
-- 2) Guarda data_prevista_*_original na 1ª definição
-- 3) Histórico de toda mudança de datas previstas
-- ============================================================

-- ── 1. Colunas em movelaria_obras ─────────────────────────────
ALTER TABLE movelaria_obras
  ADD COLUMN IF NOT EXISTS atraso_permanente boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS atraso_marcado_em timestamptz,
  ADD COLUMN IF NOT EXISTS data_prevista_inicio_original date,
  ADD COLUMN IF NOT EXISTS data_prevista_fim_original date;

COMMENT ON COLUMN movelaria_obras.atraso_permanente IS
  'Uma vez true (prazo vencido com obra aberta), nunca volta a false.';
COMMENT ON COLUMN movelaria_obras.data_prevista_inicio_original IS
  'Primeira data de início prevista definida; não sobrescrever.';
COMMENT ON COLUMN movelaria_obras.data_prevista_fim_original IS
  'Primeira data de fim prevista definida; não sobrescrever.';

-- ── 2. Tabela de histórico de datas ───────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_obras_datas_historico (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id                uuid NOT NULL REFERENCES movelaria_obras(id) ON DELETE CASCADE,
  data_inicio_anterior   date,
  data_fim_anterior      date,
  data_inicio_nova       date,
  data_fim_nova          date,
  alterado_em            timestamptz NOT NULL DEFAULT now(),
  alterado_por           uuid REFERENCES auth.users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_obras_datas_hist_obra
  ON movelaria_obras_datas_historico(obra_id, alterado_em DESC);

ALTER TABLE movelaria_obras_datas_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obras_datas_hist_select" ON movelaria_obras_datas_historico;
CREATE POLICY "obras_datas_hist_select" ON movelaria_obras_datas_historico
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM movelaria_obras o
      WHERE o.id = obra_id
        AND (
          movelaria_usuario_tem_algum_perfil(
            ARRAY['administrador', 'financeiro', 'administrador_obras', 'visualizador']
          )
          OR (
            movelaria_usuario_tem_perfil('montador_admin')
            AND movelaria_montador_admin_acessa_obra(o.id, auth.uid())
          )
          OR (
            movelaria_usuario_tem_perfil('montador')
            AND movelaria_montador_acessa_obra(o.id, auth.uid())
          )
        )
    )
  );

-- Inserts só via trigger (security definer); sem policy de INSERT para authenticated.

-- ── 3. Trigger: originais + atraso permanente + histórico ────
CREATE OR REPLACE FUNCTION movelaria_obra_datas_before_write()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.data_prevista_inicio IS NOT NULL AND NEW.data_prevista_inicio_original IS NULL THEN
      NEW.data_prevista_inicio_original := NEW.data_prevista_inicio;
    END IF;
    IF NEW.data_prevista_fim IS NOT NULL AND NEW.data_prevista_fim_original IS NULL THEN
      NEW.data_prevista_fim_original := NEW.data_prevista_fim;
    END IF;
  ELSE
    -- UPDATE: originais só na 1ª definição; nunca sobrescreve
    IF OLD.data_prevista_inicio_original IS NOT NULL THEN
      NEW.data_prevista_inicio_original := OLD.data_prevista_inicio_original;
    ELSIF NEW.data_prevista_inicio IS NOT NULL THEN
      NEW.data_prevista_inicio_original := NEW.data_prevista_inicio;
    END IF;

    IF OLD.data_prevista_fim_original IS NOT NULL THEN
      NEW.data_prevista_fim_original := OLD.data_prevista_fim_original;
    ELSIF NEW.data_prevista_fim IS NOT NULL THEN
      NEW.data_prevista_fim_original := NEW.data_prevista_fim;
    END IF;

    -- Impede limpar a marca (mesmo se o client tentar)
    IF COALESCE(OLD.atraso_permanente, false) THEN
      NEW.atraso_permanente := true;
      NEW.atraso_marcado_em := COALESCE(OLD.atraso_marcado_em, NEW.atraso_marcado_em, now());
    END IF;
  END IF;

  -- Atraso permanente: liga se o prazo (atual OU anterior no update) já venceu
  -- com obra aberta. Assim, reagendar para o futuro NÃO limpa o atraso.
  IF NEW.status_kanban IS DISTINCT FROM 'concluida'
     AND NEW.status_kanban IS DISTINCT FROM 'cancelada'
  THEN
    IF (
         (NEW.data_prevista_fim IS NOT NULL AND NEW.data_prevista_fim < CURRENT_DATE)
         OR (
           TG_OP = 'UPDATE'
           AND OLD.data_prevista_fim IS NOT NULL
           AND OLD.data_prevista_fim < CURRENT_DATE
         )
       )
       AND NOT COALESCE(NEW.atraso_permanente, false)
    THEN
      NEW.atraso_permanente := true;
      NEW.atraso_marcado_em := COALESCE(NEW.atraso_marcado_em, now());
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obra_datas_before_write ON movelaria_obras;
CREATE TRIGGER trg_obra_datas_before_write
  BEFORE INSERT OR UPDATE ON movelaria_obras
  FOR EACH ROW
  EXECUTE FUNCTION movelaria_obra_datas_before_write();

CREATE OR REPLACE FUNCTION movelaria_obra_datas_after_update_historico()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.data_prevista_inicio IS DISTINCT FROM OLD.data_prevista_inicio
     OR NEW.data_prevista_fim IS DISTINCT FROM OLD.data_prevista_fim
  THEN
    -- Só registra se já havia alguma data antes OU se ambas mudaram de null→valor
    -- (reajustes e primeiras definições posteriores a create parcial)
    INSERT INTO movelaria_obras_datas_historico (
      obra_id,
      data_inicio_anterior,
      data_fim_anterior,
      data_inicio_nova,
      data_fim_nova,
      alterado_por
    ) VALUES (
      NEW.id,
      OLD.data_prevista_inicio,
      OLD.data_prevista_fim,
      NEW.data_prevista_inicio,
      NEW.data_prevista_fim,
      auth.uid()
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_obra_datas_after_update_historico ON movelaria_obras;
CREATE TRIGGER trg_obra_datas_after_update_historico
  AFTER UPDATE ON movelaria_obras
  FOR EACH ROW
  EXECUTE FUNCTION movelaria_obra_datas_after_update_historico();

-- ── 4. Backfill ───────────────────────────────────────────────
UPDATE movelaria_obras
SET
  data_prevista_inicio_original = COALESCE(data_prevista_inicio_original, data_prevista_inicio),
  data_prevista_fim_original    = COALESCE(data_prevista_fim_original, data_prevista_fim)
WHERE data_prevista_inicio IS NOT NULL
   OR data_prevista_fim IS NOT NULL;

UPDATE movelaria_obras
SET
  atraso_permanente = true,
  atraso_marcado_em = COALESCE(atraso_marcado_em, now())
WHERE atraso_permanente = false
  AND status_kanban NOT IN ('concluida', 'cancelada')
  AND data_prevista_fim IS NOT NULL
  AND data_prevista_fim < CURRENT_DATE;

-- ── 5. Atualizar movelaria_listar_obras ────────────────────────
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
  comissao_ocultos        BOOLEAN[],
  montadores_execucao     JSONB,
  atraso_permanente       BOOLEAN,
  atraso_marcado_em       TIMESTAMPTZ,
  data_prevista_inicio_original DATE,
  data_prevista_fim_original    DATE
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
    COALESCE(exec.data, '[]'::jsonb),
    COALESCE(o.atraso_permanente, false),
    o.atraso_marcado_em,
    o.data_prevista_inicio_original,
    o.data_prevista_fim_original
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

NOTIFY pgrst, 'reload schema';
