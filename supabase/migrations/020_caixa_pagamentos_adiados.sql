-- ============================================================
-- GARBO Movelaria — Caixa de Pagamentos Adiados
-- ============================================================

-- ── Destinatários do Caixa ──────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_caixa_destinatarios (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome            TEXT NOT NULL,
  tipo            TEXT NOT NULL CHECK (tipo IN ('marceneiro', 'fornecedor', 'funcionario', 'outros')),
  dados_bancarios JSONB DEFAULT '{}',
  observacoes     TEXT,
  ativo           BOOLEAN DEFAULT true,
  criado_em       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Movimentações de Caixa ──────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_caixa_movimentacoes (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario_id    UUID NOT NULL REFERENCES movelaria_caixa_destinatarios(id) ON DELETE CASCADE,
  tipo_movimentacao  TEXT NOT NULL CHECK (tipo_movimentacao IN ('reserva', 'pagamento')),
  valor              NUMERIC(12,2) NOT NULL,
  data_movimentacao  DATE NOT NULL DEFAULT CURRENT_DATE,
  data_vencimento    DATE,
  mes_referencia     INTEGER NOT NULL CHECK (mes_referencia BETWEEN 1 AND 12),
  ano_referencia     INTEGER NOT NULL CHECK (ano_referencia >= 2020),
  descricao          TEXT,
  comprovante_url    TEXT,
  criado_por         UUID REFERENCES auth.users(id),
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Saldo Acumulado (Materializado por Trigger) ──────────────
CREATE TABLE IF NOT EXISTS movelaria_caixa_saldo_acumulado (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  destinatario_id UUID NOT NULL REFERENCES movelaria_caixa_destinatarios(id) ON DELETE CASCADE,
  mes_referencia  INTEGER NOT NULL,
  ano_referencia  INTEGER NOT NULL,
  total_reservado NUMERIC(12,2) DEFAULT 0,
  total_pago      NUMERIC(12,2) DEFAULT 0,
  saldo           NUMERIC(12,2) DEFAULT 0,
  UNIQUE(destinatario_id, mes_referencia, ano_referencia)
);

-- ── Trigger Recalcular Saldo ─────────────────────────────────
CREATE OR REPLACE FUNCTION movelaria_recalcular_saldo_caixa()
RETURNS TRIGGER AS $$
DECLARE
    target_destinatario_id UUID;
    target_mes INTEGER;
    target_ano INTEGER;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        target_destinatario_id := OLD.destinatario_id;
        target_mes := OLD.mes_referencia;
        target_ano := OLD.ano_referencia;
    ELSE
        target_destinatario_id := NEW.destinatario_id;
        target_mes := NEW.mes_referencia;
        target_ano := NEW.ano_referencia;
    END IF;

    INSERT INTO movelaria_caixa_saldo_acumulado (destinatario_id, mes_referencia, ano_referencia, total_reservado, total_pago, saldo)
    SELECT 
        destinatario_id, 
        mes_referencia, 
        ano_referencia,
        SUM(CASE WHEN tipo_movimentacao = 'reserva' THEN valor ELSE 0 END) as total_reservado,
        SUM(CASE WHEN tipo_movimentacao = 'pagamento' THEN valor ELSE 0 END) as total_pago,
        SUM(CASE WHEN tipo_movimentacao = 'reserva' THEN valor ELSE -valor END) as saldo
    FROM movelaria_caixa_movimentacoes
    WHERE destinatario_id = target_destinatario_id 
      AND mes_referencia = target_mes 
      AND ano_referencia = target_ano
    GROUP BY destinatario_id, mes_referencia, ano_referencia
    ON CONFLICT (destinatario_id, mes_referencia, ano_referencia) DO UPDATE SET
        total_reservado = EXCLUDED.total_reservado,
        total_pago = EXCLUDED.total_pago,
        saldo = EXCLUDED.saldo;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_movelaria_recalcular_saldo_caixa
AFTER INSERT OR UPDATE OR DELETE ON movelaria_caixa_movimentacoes
FOR EACH ROW EXECUTE FUNCTION movelaria_recalcular_saldo_caixa();

-- ── RLS ──────────────────────────────────────────────────────
ALTER TABLE movelaria_caixa_destinatarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE movelaria_caixa_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE movelaria_caixa_saldo_acumulado ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all to authenticated" ON movelaria_caixa_destinatarios FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON movelaria_caixa_movimentacoes FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Allow all to authenticated" ON movelaria_caixa_saldo_acumulado FOR ALL TO authenticated USING (true) WITH CHECK (true);
