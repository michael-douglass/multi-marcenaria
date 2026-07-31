-- ============================================================
-- GARBO Movelaria — Reabre comissões indevidamente pagas
-- Migration 136
--
-- A migração 135 marcou comissões como PAGO só porque valor_pago
-- espelhava a reserva, sem pagamento real no Caixa.
-- Também trata Contabilidade de ago/2026 indevida na lista.
-- ============================================================

ALTER TABLE movelaria_contas_pagar DISABLE TRIGGER trg_movelaria_sync_pagamento_para_caixa;
ALTER TABLE movelaria_contas_pagar DISABLE TRIGGER trg_funcionario_recibo_ao_pagar_cp;

-- 1) Comissões sem pagamento real no Caixa → voltam a PENDENTE
UPDATE movelaria_contas_pagar cp
SET
  status = 'pendente',
  valor_pago = 0,
  data_pagamento = NULL,
  atualizado_em = NOW()
WHERE cp.fornecedor_nome LIKE 'Comissão:%'
  AND cp.status = 'pago'
  AND NOT EXISTS (
    SELECT 1
    FROM movelaria_caixa_movimentacoes m
    WHERE m.conta_pagar_id = cp.id
      AND m.tipo_movimentacao = 'pagamento'
  )
  -- Se o destinatário/mês já tem Já pago cobrindo as reservas, mantém paga
  AND NOT EXISTS (
    SELECT 1
    FROM movelaria_caixa_movimentacoes r
    WHERE r.conta_pagar_id = cp.id
      AND r.tipo_movimentacao = 'reserva'
      AND (
        SELECT COALESCE(SUM(CASE WHEN x.tipo_movimentacao = 'pagamento' THEN x.valor ELSE 0 END), 0)
        FROM movelaria_caixa_movimentacoes x
        WHERE x.destinatario_id = r.destinatario_id
          AND x.mes_referencia = r.mes_referencia
          AND x.ano_referencia = r.ano_referencia
      ) >= (
        SELECT COALESCE(SUM(CASE WHEN y.tipo_movimentacao = 'reserva' THEN y.valor ELSE 0 END), 0)
        FROM movelaria_caixa_movimentacoes y
        WHERE y.destinatario_id = r.destinatario_id
          AND y.mes_referencia = r.mes_referencia
          AND y.ano_referencia = r.ano_referencia
      ) - 0.009
      AND (
        SELECT COALESCE(SUM(CASE WHEN x.tipo_movimentacao = 'pagamento' THEN x.valor ELSE 0 END), 0)
        FROM movelaria_caixa_movimentacoes x
        WHERE x.destinatario_id = r.destinatario_id
          AND x.mes_referencia = r.mes_referencia
          AND x.ano_referencia = r.ano_referencia
      ) > 0.009
  );

-- 2) Recria reservas das comissões reabertas (no destinatário Comissão: Prestador)
INSERT INTO movelaria_caixa_movimentacoes (
  destinatario_id, tipo_movimentacao, valor,
  data_movimentacao, data_vencimento, mes_referencia, ano_referencia,
  descricao, conta_pagar_id
)
SELECT
  d.id,
  'reserva',
  cp.valor_parcela,
  CURRENT_DATE,
  cp.data_vencimento,
  EXTRACT(MONTH FROM cp.data_vencimento)::INTEGER,
  EXTRACT(YEAR FROM cp.data_vencimento)::INTEGER,
  'Reserva comissão: ' || COALESCE(cp.fornecedor_nome, cp.descricao, 'Sem descrição'),
  cp.id
FROM movelaria_contas_pagar cp
JOIN movelaria_caixa_destinatarios d
  ON LOWER(TRIM(d.nome)) = LOWER(TRIM(cp.fornecedor_nome))
 AND d.ativo = true
WHERE cp.fornecedor_nome LIKE 'Comissão:%'
  AND cp.status = 'pendente'
  AND NOT EXISTS (
    SELECT 1 FROM movelaria_caixa_movimentacoes m
    WHERE m.conta_pagar_id = cp.id AND m.tipo_movimentacao = 'reserva'
  );

-- 3) Contabilidade indevida (ago/2026 R$ 650) — não deve ficar aberta na lista
UPDATE movelaria_contas_pagar
SET
  status = 'pago',
  valor_pago = valor_parcela,
  data_pagamento = COALESCE(data_pagamento, data_vencimento, CURRENT_DATE),
  atualizado_em = NOW()
WHERE id = 'ad222fd8-b1c7-4a04-94ac-7683f25ca91c'
  AND fornecedor_nome = 'Contabilidade'
  AND status = 'pendente';

-- 4) (UI) Total inflado de recorrência mensal corrigido no frontend
--    (getValorTotalLancamento não soma meses futuros).

ALTER TABLE movelaria_contas_pagar ENABLE TRIGGER trg_movelaria_sync_pagamento_para_caixa;
ALTER TABLE movelaria_contas_pagar ENABLE TRIGGER trg_funcionario_recibo_ao_pagar_cp;

NOTIFY pgrst, 'reload schema';
