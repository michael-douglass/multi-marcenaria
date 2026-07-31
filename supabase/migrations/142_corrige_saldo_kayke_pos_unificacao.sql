-- ============================================================
-- GARBO Movelaria — Corrige saldos duplicados pós-unificação
-- Migration 142
--
-- A 141 moveu movimentações Kaique → Kayke (triggers do Caixa
-- já atualizaram o saldo) e depois somou o saldo do Kaique de
-- novo. Jun/jul 2026 ficaram com o dobro.
-- Corrige recalculando a partir das movimentações.
-- ============================================================

UPDATE movelaria_caixa_saldo_acumulado s
SET
  total_reservado = COALESCE(x.sum_reservas, 0),
  total_pago      = COALESCE(x.sum_pagos, 0),
  saldo           = COALESCE(x.sum_reservas, 0) - COALESCE(x.sum_pagos, 0)
FROM (
  SELECT
    m.destinatario_id,
    m.mes_referencia,
    m.ano_referencia,
    SUM(CASE WHEN m.tipo_movimentacao = 'reserva' THEN m.valor ELSE 0 END) AS sum_reservas,
    SUM(CASE WHEN m.tipo_movimentacao = 'pagamento' THEN m.valor ELSE 0 END) AS sum_pagos
  FROM movelaria_caixa_movimentacoes m
  WHERE m.destinatario_id = 'ff58109d-bcaf-4e14-8bcd-e86a6d7c57fe'
    AND m.ano_referencia = 2026
    AND m.mes_referencia IN (6, 7)
  GROUP BY m.destinatario_id, m.mes_referencia, m.ano_referencia
) x
WHERE s.destinatario_id = x.destinatario_id
  AND s.mes_referencia = x.mes_referencia
  AND s.ano_referencia = x.ano_referencia;

NOTIFY pgrst, 'reload schema';
