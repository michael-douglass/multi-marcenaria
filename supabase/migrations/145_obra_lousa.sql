-- ============================================================
-- GARBO Movelaria — Lousa da Obra (fotos + anotações)
-- Migration 145
-- Anexar fotos (até 100 MB) e riscar/observar sobre cada foto
-- ============================================================

-- ── 1. Bucket de storage ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'movelaria-obra-lousa',
  'movelaria-obra-lousa',
  false,
  104857600, -- 100 MB
  ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'image/heic',
    'image/heif',
    'application/pdf'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ── 2. Helpers de edição ──────────────────────────────────────
CREATE OR REPLACE FUNCTION movelaria_usuario_edita_lousa_obra()
RETURNS BOOLEAN AS $$
  SELECT movelaria_meu_perfil() IN (
    'administrador',
    'administrador_obras',
    'montador_admin',
    'montador'
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_usuario_edita_lousa_obra() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_usuario_edita_lousa_obra() TO authenticated;

-- ── 3. Políticas de storage ───────────────────────────────────
DROP POLICY IF EXISTS "obra_lousa_select" ON storage.objects;
CREATE POLICY "obra_lousa_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'movelaria-obra-lousa'
    AND movelaria_meu_perfil() IS NOT NULL
  );

DROP POLICY IF EXISTS "obra_lousa_insert" ON storage.objects;
CREATE POLICY "obra_lousa_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'movelaria-obra-lousa'
    AND movelaria_usuario_edita_lousa_obra()
  );

DROP POLICY IF EXISTS "obra_lousa_update" ON storage.objects;
CREATE POLICY "obra_lousa_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'movelaria-obra-lousa'
    AND movelaria_usuario_edita_lousa_obra()
  )
  WITH CHECK (
    bucket_id = 'movelaria-obra-lousa'
    AND movelaria_usuario_edita_lousa_obra()
  );

DROP POLICY IF EXISTS "obra_lousa_delete" ON storage.objects;
CREATE POLICY "obra_lousa_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'movelaria-obra-lousa'
    AND movelaria_usuario_edita_lousa_obra()
  );

-- ── 4. Fotos da lousa ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_obra_lousa_images (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id       UUID NOT NULL REFERENCES movelaria_obras(id) ON DELETE CASCADE,
  file_url      TEXT NOT NULL,           -- storage_path no bucket
  file_name     TEXT NOT NULL,
  tipo_mime     TEXT NOT NULL DEFAULT 'image/jpeg',
  width         NUMERIC,
  height        NUMERIC,
  z_index       INTEGER NOT NULL DEFAULT 0,
  observacao    TEXT,                   -- observação textual da foto
  criado_por    UUID REFERENCES movelaria_usuarios(id) ON DELETE SET NULL,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obra_lousa_img_obra
  ON movelaria_obra_lousa_images(obra_id, z_index, criado_em);

ALTER TABLE movelaria_obra_lousa_images ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obra_lousa_img_select" ON movelaria_obra_lousa_images;
CREATE POLICY "obra_lousa_img_select" ON movelaria_obra_lousa_images
  FOR SELECT TO authenticated
  USING (movelaria_usuario_acessa_obra(obra_id));

DROP POLICY IF EXISTS "obra_lousa_img_insert" ON movelaria_obra_lousa_images;
CREATE POLICY "obra_lousa_img_insert" ON movelaria_obra_lousa_images
  FOR INSERT TO authenticated
  WITH CHECK (
    movelaria_usuario_edita_lousa_obra()
    AND movelaria_usuario_acessa_obra(obra_id)
  );

DROP POLICY IF EXISTS "obra_lousa_img_update" ON movelaria_obra_lousa_images;
CREATE POLICY "obra_lousa_img_update" ON movelaria_obra_lousa_images
  FOR UPDATE TO authenticated
  USING (
    movelaria_usuario_edita_lousa_obra()
    AND movelaria_usuario_acessa_obra(obra_id)
  )
  WITH CHECK (
    movelaria_usuario_edita_lousa_obra()
    AND movelaria_usuario_acessa_obra(obra_id)
  );

DROP POLICY IF EXISTS "obra_lousa_img_delete" ON movelaria_obra_lousa_images;
CREATE POLICY "obra_lousa_img_delete" ON movelaria_obra_lousa_images
  FOR DELETE TO authenticated
  USING (
    movelaria_usuario_edita_lousa_obra()
    AND movelaria_usuario_acessa_obra(obra_id)
  );

-- ── 5. Desenhos / anotações ───────────────────────────────────
-- path_data usa o contrato do PRD:
--   traço SVG | WB_JSON:{...} | WB_IMG:{imageId}:...
CREATE TABLE IF NOT EXISTS movelaria_obra_lousa_drawings (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id       UUID NOT NULL REFERENCES movelaria_obras(id) ON DELETE CASCADE,
  image_id      UUID REFERENCES movelaria_obra_lousa_images(id) ON DELETE CASCADE,
  path_data     TEXT NOT NULL,
  cor           TEXT NOT NULL DEFAULT '#e85d04',
  stroke_width  NUMERIC NOT NULL DEFAULT 3,
  criado_por    UUID REFERENCES movelaria_usuarios(id) ON DELETE SET NULL,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_obra_lousa_draw_obra
  ON movelaria_obra_lousa_drawings(obra_id, criado_em);
CREATE INDEX IF NOT EXISTS idx_obra_lousa_draw_image
  ON movelaria_obra_lousa_drawings(image_id);

ALTER TABLE movelaria_obra_lousa_drawings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obra_lousa_draw_select" ON movelaria_obra_lousa_drawings;
CREATE POLICY "obra_lousa_draw_select" ON movelaria_obra_lousa_drawings
  FOR SELECT TO authenticated
  USING (movelaria_usuario_acessa_obra(obra_id));

DROP POLICY IF EXISTS "obra_lousa_draw_insert" ON movelaria_obra_lousa_drawings;
CREATE POLICY "obra_lousa_draw_insert" ON movelaria_obra_lousa_drawings
  FOR INSERT TO authenticated
  WITH CHECK (
    movelaria_usuario_edita_lousa_obra()
    AND movelaria_usuario_acessa_obra(obra_id)
  );

DROP POLICY IF EXISTS "obra_lousa_draw_update" ON movelaria_obra_lousa_drawings;
CREATE POLICY "obra_lousa_draw_update" ON movelaria_obra_lousa_drawings
  FOR UPDATE TO authenticated
  USING (
    movelaria_usuario_edita_lousa_obra()
    AND movelaria_usuario_acessa_obra(obra_id)
  )
  WITH CHECK (
    movelaria_usuario_edita_lousa_obra()
    AND movelaria_usuario_acessa_obra(obra_id)
  );

DROP POLICY IF EXISTS "obra_lousa_draw_delete" ON movelaria_obra_lousa_drawings;
CREATE POLICY "obra_lousa_draw_delete" ON movelaria_obra_lousa_drawings
  FOR DELETE TO authenticated
  USING (
    movelaria_usuario_edita_lousa_obra()
    AND movelaria_usuario_acessa_obra(obra_id)
  );

-- ── 6. Config tipografia (singleton) ──────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_obra_lousa_text_config (
  singleton_key   TEXT PRIMARY KEY DEFAULT 'default' CHECK (singleton_key = 'default'),
  font_family     TEXT NOT NULL DEFAULT 'Inter, system-ui, sans-serif',
  font_size_px    INTEGER NOT NULL DEFAULT 18,
  text_color_hex  TEXT NOT NULL DEFAULT '#f2d892',
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_por  UUID REFERENCES movelaria_usuarios(id) ON DELETE SET NULL
);

INSERT INTO movelaria_obra_lousa_text_config (singleton_key)
VALUES ('default')
ON CONFLICT (singleton_key) DO NOTHING;

ALTER TABLE movelaria_obra_lousa_text_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obra_lousa_text_cfg_select" ON movelaria_obra_lousa_text_config;
CREATE POLICY "obra_lousa_text_cfg_select" ON movelaria_obra_lousa_text_config
  FOR SELECT TO authenticated
  USING (movelaria_meu_perfil() IS NOT NULL);

DROP POLICY IF EXISTS "obra_lousa_text_cfg_update" ON movelaria_obra_lousa_text_config;
CREATE POLICY "obra_lousa_text_cfg_update" ON movelaria_obra_lousa_text_config
  FOR UPDATE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'administrador_obras'))
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'administrador_obras'));

COMMENT ON TABLE movelaria_obra_lousa_images IS
  'Fotos da Lousa da Obra — cada foto pode ter observação textual e desenhos vinculados';
COMMENT ON TABLE movelaria_obra_lousa_drawings IS
  'Traços e anotações da Lousa (path SVG ou WB_JSON / WB_IMG conforme PRD)';
