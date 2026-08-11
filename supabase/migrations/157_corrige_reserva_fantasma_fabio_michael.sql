-- ============================================================
-- GARBO Movelaria — Corrige reserva fantasma R$ 20.000
-- Migration 157
--
-- Problema (ago/2026):
--   Pro labore Fabio e Michael Douglas mostravam R$ 20.000
--   "reservados" no Caixa, mas a reserva automática usou o
--   valor cheio da parcela (não o que realmente foi reservado).
--
-- Correção:
--   Alinha a reserva ao total já pago no Caixa do mês,
--   zerando o saldo "disponível" fantasma (4.350 / 13.000).
-- ============================================================

DO $$
DECLARE
  v_pago NUMERIC(12,2);
  v_mov_id UUID;
BEGIN
  -- Pro labore Fabio (ago/2026)
  SELECT COALESCE(SUM(m.valor), 0) INTO v_pago
  FROM movelaria_caixa_movimentacoes m
  JOIN movelaria_caixa_destinatarios d ON d.id = m.destinatario_id
  WHERE LOWER(TRIM(d.nome)) = 'pro labore fabio'
    AND m.mes_referencia = 8
    AND m.ano_referencia = 2026
    AND m.tipo_movimentacao = 'pagamento';

  SELECT m.id INTO v_mov_id
  FROM movelaria_caixa_movimentacoes m
  JOIN movelaria_caixa_destinatarios d ON d.id = m.destinatario_id
  WHERE LOWER(TRIM(d.nome)) = 'pro labore fabio'
    AND m.mes_referencia = 8
    AND m.ano_referencia = 2026
    AND m.tipo_movimentacao = 'reserva'
    AND m.conta_pagar_id = 'e5ddeb9a-9d41-461d-9057-6366aa586393'
  ORDER BY m.criado_em DESC
  LIMIT 1;

  IF v_mov_id IS NOT NULL THEN
    IF v_pago > 0.009 THEN
      UPDATE movelaria_caixa_movimentacoes
      SET valor = v_pago,
          descricao = 'Reserva alinhada ao pago (correção reserva fantasma)'
      WHERE id = v_mov_id;
    ELSE
      DELETE FROM movelaria_caixa_movimentacoes WHERE id = v_mov_id;
    END IF;
  END IF;

  -- Michael Douglas (ago/2026)
  v_mov_id := NULL;
  SELECT COALESCE(SUM(m.valor), 0) INTO v_pago
  FROM movelaria_caixa_movimentacoes m
  JOIN movelaria_caixa_destinatarios d ON d.id = m.destinatario_id
  WHERE LOWER(TRIM(d.nome)) = 'michael douglas'
    AND m.mes_referencia = 8
    AND m.ano_referencia = 2026
    AND m.tipo_movimentacao = 'pagamento';

  SELECT m.id INTO v_mov_id
  FROM movelaria_caixa_movimentacoes m
  JOIN movelaria_caixa_destinatarios d ON d.id = m.destinatario_id
  WHERE LOWER(TRIM(d.nome)) = 'michael douglas'
    AND m.mes_referencia = 8
    AND m.ano_referencia = 2026
    AND m.tipo_movimentacao = 'reserva'
    AND m.conta_pagar_id = 'd8e093f2-f102-43ac-9182-b3ab3471153c'
  ORDER BY m.criado_em DESC
  LIMIT 1;

  IF v_mov_id IS NOT NULL THEN
    IF v_pago > 0.009 THEN
      UPDATE movelaria_caixa_movimentacoes
      SET valor = v_pago,
          descricao = 'Reserva alinhada ao pago (correção reserva fantasma)'
      WHERE id = v_mov_id;
    ELSE
      DELETE FROM movelaria_caixa_movimentacoes WHERE id = v_mov_id;
    END IF;
  END IF;
END $$;
