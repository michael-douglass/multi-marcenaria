-- Lembretes dispensados do sino de Contas a Pagar (por usuário).
-- Não altera status financeiro da conta — só esconde o aviso na UI.

CREATE TABLE IF NOT EXISTS movelaria_contas_pagar_notif_dismiss (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id      UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conta_pagar_id  UUID NOT NULL REFERENCES movelaria_contas_pagar(id) ON DELETE CASCADE,
  dismissed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (usuario_id, conta_pagar_id)
);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_notif_dismiss_usuario
  ON movelaria_contas_pagar_notif_dismiss (usuario_id);

ALTER TABLE movelaria_contas_pagar_notif_dismiss ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own contas pagar notif dismiss" ON movelaria_contas_pagar_notif_dismiss;
CREATE POLICY "Users manage own contas pagar notif dismiss"
  ON movelaria_contas_pagar_notif_dismiss
  FOR ALL
  TO authenticated
  USING (auth.uid() = usuario_id)
  WITH CHECK (auth.uid() = usuario_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON movelaria_contas_pagar_notif_dismiss TO authenticated;
