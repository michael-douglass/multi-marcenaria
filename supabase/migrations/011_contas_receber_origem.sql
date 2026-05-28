ALTER TABLE movelaria_contas_receber
  ADD COLUMN IF NOT EXISTS origem_tipo TEXT DEFAULT 'manual'
    CHECK (origem_tipo IN ('manual', 'orcamento_fechado')),
  ADD COLUMN IF NOT EXISTS origem_lead_id TEXT;

CREATE INDEX IF NOT EXISTS idx_mov_contas_receber_origem_lead
  ON movelaria_contas_receber(origem_lead_id);

