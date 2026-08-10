-- Dismiss de lembrete por dia: amanhã a lista “zera” e só entram contas do novo dia.

ALTER TABLE movelaria_contas_pagar_notif_dismiss
  ADD COLUMN IF NOT EXISTS dia_referencia DATE;

UPDATE movelaria_contas_pagar_notif_dismiss
SET dia_referencia = (dismissed_at AT TIME ZONE 'America/Sao_Paulo')::date
WHERE dia_referencia IS NULL;

ALTER TABLE movelaria_contas_pagar_notif_dismiss
  ALTER COLUMN dia_referencia SET DEFAULT CURRENT_DATE,
  ALTER COLUMN dia_referencia SET NOT NULL;

ALTER TABLE movelaria_contas_pagar_notif_dismiss
  DROP CONSTRAINT IF EXISTS movelaria_contas_pagar_notif_dismiss_usuario_id_conta_pagar_id_key;

ALTER TABLE movelaria_contas_pagar_notif_dismiss
  DROP CONSTRAINT IF EXISTS movelaria_contas_pagar_notif_dism_usuario_id_conta_pagar_id_key;

ALTER TABLE movelaria_contas_pagar_notif_dismiss
  DROP CONSTRAINT IF EXISTS movelaria_contas_pagar_notif_dismiss_user_conta_dia_key;

ALTER TABLE movelaria_contas_pagar_notif_dismiss
  ADD CONSTRAINT movelaria_contas_pagar_notif_dismiss_user_conta_dia_key
  UNIQUE (usuario_id, conta_pagar_id, dia_referencia);

CREATE INDEX IF NOT EXISTS idx_contas_pagar_notif_dismiss_usuario_dia
  ON movelaria_contas_pagar_notif_dismiss (usuario_id, dia_referencia);
