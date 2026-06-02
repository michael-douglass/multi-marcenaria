-- ============================================================
-- GARBO Movelaria — Zoom por página (preferência do usuário)
-- Migration 033
-- ============================================================

CREATE TABLE IF NOT EXISTS movelaria_page_zoom (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id    UUID        NOT NULL REFERENCES movelaria_usuarios(id) ON DELETE CASCADE,
  page_key      TEXT        NOT NULL,
  zoom_percent  INTEGER     NOT NULL DEFAULT 100
                CHECK (zoom_percent >= 50 AND zoom_percent <= 200),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, page_key)
);

CREATE INDEX IF NOT EXISTS idx_page_zoom_usuario ON movelaria_page_zoom(usuario_id);

ALTER TABLE movelaria_page_zoom ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "page_zoom_select_own" ON movelaria_page_zoom;
CREATE POLICY "page_zoom_select_own" ON movelaria_page_zoom
  FOR SELECT TO authenticated
  USING (usuario_id = auth.uid());

DROP POLICY IF EXISTS "page_zoom_insert_own" ON movelaria_page_zoom;
CREATE POLICY "page_zoom_insert_own" ON movelaria_page_zoom
  FOR INSERT TO authenticated
  WITH CHECK (usuario_id = auth.uid());

DROP POLICY IF EXISTS "page_zoom_update_own" ON movelaria_page_zoom;
CREATE POLICY "page_zoom_update_own" ON movelaria_page_zoom
  FOR UPDATE TO authenticated
  USING (usuario_id = auth.uid())
  WITH CHECK (usuario_id = auth.uid());

DROP TRIGGER IF EXISTS trg_page_zoom_atualizado ON movelaria_page_zoom;
CREATE TRIGGER trg_page_zoom_atualizado
  BEFORE UPDATE ON movelaria_page_zoom
  FOR EACH ROW EXECUTE FUNCTION movelaria_touch_atualizado_em();
