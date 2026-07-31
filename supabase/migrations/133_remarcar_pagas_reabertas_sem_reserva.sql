-- ============================================================
-- GARBO Movelaria — Remarca pagas reabertas sem reserva
-- Migration 133
--
-- A migração 132 reabriu (status=pendente) contas históricas
-- que estavam PAGO e NÃO tinham reserva no Caixa.
-- Isso encheu Contas a Pagar com Bruno/Kaique/João etc.
--
-- Correção: volta para PAGO apenas as reabertas SEM reserva.
-- Mantém PENDENTE as que têm reserva (Já pago = 0 no Caixa).
-- ============================================================

ALTER TABLE movelaria_contas_pagar DISABLE TRIGGER trg_movelaria_sync_pagamento_para_caixa;
ALTER TABLE movelaria_contas_pagar DISABLE TRIGGER trg_funcionario_recibo_ao_pagar_cp;

UPDATE movelaria_contas_pagar cp
SET
  status = 'pago',
  valor_pago = cp.valor_parcela,
  data_pagamento = COALESCE(cp.data_pagamento, cp.data_vencimento, CURRENT_DATE),
  atualizado_em = NOW()
WHERE cp.status = 'pendente'
  AND cp.atualizado_em >= '2026-07-30 20:00:00+00'
  AND cp.atualizado_em <= '2026-07-31 06:00:00+00'
  AND NOT EXISTS (
    SELECT 1
    FROM movelaria_caixa_movimentacoes m
    WHERE m.conta_pagar_id = cp.id
      AND m.tipo_movimentacao = 'reserva'
  );

ALTER TABLE movelaria_contas_pagar ENABLE TRIGGER trg_movelaria_sync_pagamento_para_caixa;
ALTER TABLE movelaria_contas_pagar ENABLE TRIGGER trg_funcionario_recibo_ao_pagar_cp;

NOTIFY pgrst, 'reload schema';
