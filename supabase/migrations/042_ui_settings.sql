-- ── UI Settings ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_ui_settings (
  usuario_id   UUID NOT NULL,
  key          TEXT NOT NULL,
  value        JSONB NOT NULL,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (usuario_id, key)
);

-- RLS
ALTER TABLE movelaria_ui_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage their own UI settings" ON movelaria_ui_settings;
CREATE POLICY "Users can manage their own UI settings"
  ON movelaria_ui_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);
