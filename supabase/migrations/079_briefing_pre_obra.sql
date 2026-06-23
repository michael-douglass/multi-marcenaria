-- ============================================================
-- GARBO Movelaria — Briefing Pré-Obra
-- Migration 079
-- ============================================================

-- ── 1. Bucket de storage ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'movelaria-obra-briefing',
  'movelaria-obra-briefing',
  false,
  524288000, -- 500 MB (vídeos)
  ARRAY[
    'image/jpeg','image/png','image/webp','image/gif',
    'application/pdf',
    'video/mp4','video/webm','video/quicktime','video/x-msvideo','video/ogg','video/mpeg'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- ── 2. Helpers de acesso ──────────────────────────────────────
CREATE OR REPLACE FUNCTION movelaria_usuario_acessa_obra(p_obra_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_uid    UUID := auth.uid();
BEGIN
  IF v_perfil IS NULL OR v_uid IS NULL THEN RETURN false; END IF;

  IF v_perfil IN ('administrador', 'financeiro', 'administrador_obras', 'visualizador') THEN
    RETURN EXISTS (SELECT 1 FROM movelaria_obras WHERE id = p_obra_id);
  END IF;

  IF v_perfil = 'montador_admin' THEN
    RETURN EXISTS (
      SELECT 1 FROM movelaria_obras o
      WHERE o.id = p_obra_id
        AND movelaria_montador_admin_pode_acessar_obra(o.montador_admin_id, o.grupo_obra_id, v_uid)
    );
  END IF;

  IF v_perfil = 'montador' THEN
    RETURN movelaria_montador_acessa_obra(p_obra_id, v_uid);
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION movelaria_usuario_edita_briefing_obra()
RETURNS BOOLEAN AS $$
  SELECT movelaria_meu_perfil() IN ('administrador', 'administrador_obras', 'montador_admin');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION movelaria_usuario_config_briefing_modelos()
RETURNS BOOLEAN AS $$
  SELECT movelaria_meu_perfil() IN ('administrador', 'administrador_obras', 'montador_admin');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION movelaria_usuario_exclui_briefing_modelos()
RETURNS BOOLEAN AS $$
  SELECT movelaria_meu_perfil() IN ('administrador', 'administrador_obras');
$$ LANGUAGE sql STABLE SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_usuario_acessa_obra(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_usuario_acessa_obra(UUID) TO authenticated;
REVOKE ALL ON FUNCTION movelaria_usuario_edita_briefing_obra() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_usuario_edita_briefing_obra() TO authenticated;
REVOKE ALL ON FUNCTION movelaria_usuario_config_briefing_modelos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_usuario_config_briefing_modelos() TO authenticated;
REVOKE ALL ON FUNCTION movelaria_usuario_exclui_briefing_modelos() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_usuario_exclui_briefing_modelos() TO authenticated;

-- ── 3. Políticas de storage ───────────────────────────────────
DROP POLICY IF EXISTS "obra_briefing_select" ON storage.objects;
CREATE POLICY "obra_briefing_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'movelaria-obra-briefing'
    AND movelaria_meu_perfil() IS NOT NULL
  );

DROP POLICY IF EXISTS "obra_briefing_insert" ON storage.objects;
CREATE POLICY "obra_briefing_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'movelaria-obra-briefing'
    AND movelaria_usuario_edita_briefing_obra()
  );

DROP POLICY IF EXISTS "obra_briefing_delete" ON storage.objects;
CREATE POLICY "obra_briefing_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'movelaria-obra-briefing'
    AND movelaria_usuario_edita_briefing_obra()
  );

-- ── 4. Tabelas ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_briefing_modelos (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  nome        TEXT        NOT NULL,
  descricao   TEXT,
  ordem       INT         NOT NULL DEFAULT 0,
  ativo       BOOLEAN     NOT NULL DEFAULT true,
  criado_por  UUID        REFERENCES movelaria_usuarios(id) ON DELETE SET NULL,
  criado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movelaria_briefing_perguntas (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  modelo_id       UUID NOT NULL REFERENCES movelaria_briefing_modelos(id) ON DELETE CASCADE,
  enunciado       TEXT NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN (
    'texto', 'numero', 'multipla_escolha', 'desenho', 'fotos', 'videos', 'pdf'
  )),
  opcoes          JSONB,
  obrigatoria     BOOLEAN NOT NULL DEFAULT false,
  texto_ajuda     TEXT,
  unidade_padrao  TEXT,
  ordem           INT NOT NULL DEFAULT 0,
  ativo           BOOLEAN NOT NULL DEFAULT true,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS movelaria_obra_briefings (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id         UUID NOT NULL REFERENCES movelaria_obras(id) ON DELETE CASCADE,
  modelo_id       UUID NOT NULL REFERENCES movelaria_briefing_modelos(id) ON DELETE RESTRICT,
  status          TEXT NOT NULL DEFAULT 'rascunho' CHECK (status IN ('rascunho', 'concluido')),
  preenchido_por  UUID REFERENCES movelaria_usuarios(id) ON DELETE SET NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (obra_id, modelo_id)
);

CREATE TABLE IF NOT EXISTS movelaria_obra_briefing_respostas (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_briefing_id  UUID NOT NULL REFERENCES movelaria_obra_briefings(id) ON DELETE CASCADE,
  pergunta_id       UUID NOT NULL REFERENCES movelaria_briefing_perguntas(id) ON DELETE CASCADE,
  valor_texto       TEXT,
  valor_numero      NUMERIC,
  unidade           TEXT,
  valor_opcoes      TEXT[],
  criado_em         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (obra_briefing_id, pergunta_id)
);

CREATE TABLE IF NOT EXISTS movelaria_obra_briefing_anexos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resposta_id     UUID NOT NULL REFERENCES movelaria_obra_briefing_respostas(id) ON DELETE CASCADE,
  nome_arquivo    TEXT NOT NULL,
  tipo_mime       TEXT NOT NULL,
  kind            TEXT NOT NULL CHECK (kind IN ('image', 'pdf', 'video', 'drawing')),
  storage_path    TEXT NOT NULL,
  preview_path    TEXT,
  preview_paths   TEXT[],
  ordem           INT NOT NULL DEFAULT 0,
  criado_por      UUID REFERENCES movelaria_usuarios(id) ON DELETE SET NULL,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_briefing_perguntas_modelo ON movelaria_briefing_perguntas(modelo_id, ordem);
CREATE INDEX IF NOT EXISTS idx_obra_briefings_obra ON movelaria_obra_briefings(obra_id);
CREATE INDEX IF NOT EXISTS idx_obra_briefing_respostas_briefing ON movelaria_obra_briefing_respostas(obra_briefing_id);
CREATE INDEX IF NOT EXISTS idx_obra_briefing_anexos_resposta ON movelaria_obra_briefing_anexos(resposta_id);

-- ── 5. Triggers updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION movelaria_briefing_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_briefing_modelos_updated ON movelaria_briefing_modelos;
CREATE TRIGGER trg_briefing_modelos_updated
  BEFORE UPDATE ON movelaria_briefing_modelos
  FOR EACH ROW EXECUTE FUNCTION movelaria_briefing_touch_updated_at();

DROP TRIGGER IF EXISTS trg_briefing_perguntas_updated ON movelaria_briefing_perguntas;
CREATE TRIGGER trg_briefing_perguntas_updated
  BEFORE UPDATE ON movelaria_briefing_perguntas
  FOR EACH ROW EXECUTE FUNCTION movelaria_briefing_touch_updated_at();

DROP TRIGGER IF EXISTS trg_obra_briefings_updated ON movelaria_obra_briefings;
CREATE TRIGGER trg_obra_briefings_updated
  BEFORE UPDATE ON movelaria_obra_briefings
  FOR EACH ROW EXECUTE FUNCTION movelaria_briefing_touch_updated_at();

DROP TRIGGER IF EXISTS trg_obra_briefing_respostas_updated ON movelaria_obra_briefing_respostas;
CREATE TRIGGER trg_obra_briefing_respostas_updated
  BEFORE UPDATE ON movelaria_obra_briefing_respostas
  FOR EACH ROW EXECUTE FUNCTION movelaria_briefing_touch_updated_at();

-- ── 6. RLS ────────────────────────────────────────────────────
ALTER TABLE movelaria_briefing_modelos ENABLE ROW LEVEL SECURITY;
ALTER TABLE movelaria_briefing_perguntas ENABLE ROW LEVEL SECURITY;
ALTER TABLE movelaria_obra_briefings ENABLE ROW LEVEL SECURITY;
ALTER TABLE movelaria_obra_briefing_respostas ENABLE ROW LEVEL SECURITY;
ALTER TABLE movelaria_obra_briefing_anexos ENABLE ROW LEVEL SECURITY;

-- Modelos: leitura para usuários ativos
DROP POLICY IF EXISTS "briefing_modelos_select" ON movelaria_briefing_modelos;
CREATE POLICY "briefing_modelos_select" ON movelaria_briefing_modelos
  FOR SELECT TO authenticated
  USING (movelaria_meu_perfil() IS NOT NULL);

DROP POLICY IF EXISTS "briefing_modelos_insert" ON movelaria_briefing_modelos;
CREATE POLICY "briefing_modelos_insert" ON movelaria_briefing_modelos
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_usuario_config_briefing_modelos());

DROP POLICY IF EXISTS "briefing_modelos_update" ON movelaria_briefing_modelos;
CREATE POLICY "briefing_modelos_update" ON movelaria_briefing_modelos
  FOR UPDATE TO authenticated
  USING (movelaria_usuario_config_briefing_modelos())
  WITH CHECK (movelaria_usuario_config_briefing_modelos());

DROP POLICY IF EXISTS "briefing_modelos_delete" ON movelaria_briefing_modelos;
CREATE POLICY "briefing_modelos_delete" ON movelaria_briefing_modelos
  FOR DELETE TO authenticated
  USING (movelaria_usuario_exclui_briefing_modelos());

-- Perguntas dos modelos
DROP POLICY IF EXISTS "briefing_perguntas_select" ON movelaria_briefing_perguntas;
CREATE POLICY "briefing_perguntas_select" ON movelaria_briefing_perguntas
  FOR SELECT TO authenticated
  USING (movelaria_meu_perfil() IS NOT NULL);

DROP POLICY IF EXISTS "briefing_perguntas_insert" ON movelaria_briefing_perguntas;
CREATE POLICY "briefing_perguntas_insert" ON movelaria_briefing_perguntas
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_usuario_config_briefing_modelos());

DROP POLICY IF EXISTS "briefing_perguntas_update" ON movelaria_briefing_perguntas;
CREATE POLICY "briefing_perguntas_update" ON movelaria_briefing_perguntas
  FOR UPDATE TO authenticated
  USING (movelaria_usuario_config_briefing_modelos())
  WITH CHECK (movelaria_usuario_config_briefing_modelos());

DROP POLICY IF EXISTS "briefing_perguntas_delete" ON movelaria_briefing_perguntas;
CREATE POLICY "briefing_perguntas_delete" ON movelaria_briefing_perguntas
  FOR DELETE TO authenticated
  USING (movelaria_usuario_config_briefing_modelos());

-- Instâncias de briefing por obra
DROP POLICY IF EXISTS "obra_briefings_select" ON movelaria_obra_briefings;
CREATE POLICY "obra_briefings_select" ON movelaria_obra_briefings
  FOR SELECT TO authenticated
  USING (movelaria_usuario_acessa_obra(obra_id));

DROP POLICY IF EXISTS "obra_briefings_insert" ON movelaria_obra_briefings;
CREATE POLICY "obra_briefings_insert" ON movelaria_obra_briefings
  FOR INSERT TO authenticated
  WITH CHECK (
    movelaria_usuario_edita_briefing_obra()
    AND movelaria_usuario_acessa_obra(obra_id)
  );

DROP POLICY IF EXISTS "obra_briefings_update" ON movelaria_obra_briefings;
CREATE POLICY "obra_briefings_update" ON movelaria_obra_briefings
  FOR UPDATE TO authenticated
  USING (
    movelaria_usuario_edita_briefing_obra()
    AND movelaria_usuario_acessa_obra(obra_id)
  )
  WITH CHECK (
    movelaria_usuario_edita_briefing_obra()
    AND movelaria_usuario_acessa_obra(obra_id)
  );

DROP POLICY IF EXISTS "obra_briefings_delete" ON movelaria_obra_briefings;
CREATE POLICY "obra_briefings_delete" ON movelaria_obra_briefings
  FOR DELETE TO authenticated
  USING (
    movelaria_usuario_edita_briefing_obra()
    AND movelaria_usuario_acessa_obra(obra_id)
  );

-- Respostas (via briefing → obra)
DROP POLICY IF EXISTS "obra_briefing_respostas_select" ON movelaria_obra_briefing_respostas;
CREATE POLICY "obra_briefing_respostas_select" ON movelaria_obra_briefing_respostas
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM movelaria_obra_briefings b
      WHERE b.id = obra_briefing_id
        AND movelaria_usuario_acessa_obra(b.obra_id)
    )
  );

DROP POLICY IF EXISTS "obra_briefing_respostas_insert" ON movelaria_obra_briefing_respostas;
CREATE POLICY "obra_briefing_respostas_insert" ON movelaria_obra_briefing_respostas
  FOR INSERT TO authenticated
  WITH CHECK (
    movelaria_usuario_edita_briefing_obra()
    AND EXISTS (
      SELECT 1 FROM movelaria_obra_briefings b
      WHERE b.id = obra_briefing_id
        AND movelaria_usuario_acessa_obra(b.obra_id)
    )
  );

DROP POLICY IF EXISTS "obra_briefing_respostas_update" ON movelaria_obra_briefing_respostas;
CREATE POLICY "obra_briefing_respostas_update" ON movelaria_obra_briefing_respostas
  FOR UPDATE TO authenticated
  USING (
    movelaria_usuario_edita_briefing_obra()
    AND EXISTS (
      SELECT 1 FROM movelaria_obra_briefings b
      WHERE b.id = obra_briefing_id
        AND movelaria_usuario_acessa_obra(b.obra_id)
    )
  )
  WITH CHECK (
    movelaria_usuario_edita_briefing_obra()
    AND EXISTS (
      SELECT 1 FROM movelaria_obra_briefings b
      WHERE b.id = obra_briefing_id
        AND movelaria_usuario_acessa_obra(b.obra_id)
    )
  );

DROP POLICY IF EXISTS "obra_briefing_respostas_delete" ON movelaria_obra_briefing_respostas;
CREATE POLICY "obra_briefing_respostas_delete" ON movelaria_obra_briefing_respostas
  FOR DELETE TO authenticated
  USING (
    movelaria_usuario_edita_briefing_obra()
    AND EXISTS (
      SELECT 1 FROM movelaria_obra_briefings b
      WHERE b.id = obra_briefing_id
        AND movelaria_usuario_acessa_obra(b.obra_id)
    )
  );

-- Anexos (via resposta → briefing → obra)
DROP POLICY IF EXISTS "obra_briefing_anexos_select" ON movelaria_obra_briefing_anexos;
CREATE POLICY "obra_briefing_anexos_select" ON movelaria_obra_briefing_anexos
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM movelaria_obra_briefing_respostas r
      JOIN movelaria_obra_briefings b ON b.id = r.obra_briefing_id
      WHERE r.id = resposta_id
        AND movelaria_usuario_acessa_obra(b.obra_id)
    )
  );

DROP POLICY IF EXISTS "obra_briefing_anexos_insert" ON movelaria_obra_briefing_anexos;
CREATE POLICY "obra_briefing_anexos_insert" ON movelaria_obra_briefing_anexos
  FOR INSERT TO authenticated
  WITH CHECK (
    movelaria_usuario_edita_briefing_obra()
    AND EXISTS (
      SELECT 1 FROM movelaria_obra_briefing_respostas r
      JOIN movelaria_obra_briefings b ON b.id = r.obra_briefing_id
      WHERE r.id = resposta_id
        AND movelaria_usuario_acessa_obra(b.obra_id)
    )
  );

DROP POLICY IF EXISTS "obra_briefing_anexos_delete" ON movelaria_obra_briefing_anexos;
CREATE POLICY "obra_briefing_anexos_delete" ON movelaria_obra_briefing_anexos
  FOR DELETE TO authenticated
  USING (
    movelaria_usuario_edita_briefing_obra()
    AND EXISTS (
      SELECT 1 FROM movelaria_obra_briefing_respostas r
      JOIN movelaria_obra_briefings b ON b.id = r.obra_briefing_id
      WHERE r.id = resposta_id
        AND movelaria_usuario_acessa_obra(b.obra_id)
    )
  );

-- Seed inicial: ver src/lib/briefing-seed-data.ts (aplicado na primeira carga pelo app)
