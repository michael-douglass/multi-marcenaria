-- ============================================================
-- GARBO Movelaria — Pagar consolidado usa só o valor novo
-- Migration 164
--
-- Ajuste fino da 163: o sync ainda somava TODOS os pagamentos
-- do mês e, em contas ainda abertas, quitava o restante de uma
-- vez (ex.: teste de R$ 1,00 quitou Fechamento Junho).
--
-- Agora o consolidado aloca apenas NEW.valor.
-- Também restaura JR Fechamento Junho para parcial R$ 4.000.
-- ============================================================

CREATE OR REPLACE FUNCTION movelaria_sync_caixa_pagamento_para_conta()
RETURNS TRIGGER AS $$
DECLARE
  v_cp RECORD;
  v_pago NUMERIC(12,2);
  v_total_faltante NUMERIC(12,2);
  v_faltante NUMERIC(12,2);
  v_alocado NUMERIC(12,2);
  v_novo_pago NUMERIC(12,2);
  v_novo_status TEXT;
  v_ja_pago NUMERIC(12,2);
BEGIN
  IF NEW.tipo_movimentacao IS DISTINCT FROM 'pagamento' THEN
    RETURN NEW;
  END IF;

  -- 1) Pagamento ligado diretamente à conta
  IF NEW.conta_pagar_id IS NOT NULL THEN
    SELECT COALESCE(SUM(valor), 0) INTO v_pago
    FROM movelaria_caixa_movimentacoes
    WHERE conta_pagar_id = NEW.conta_pagar_id
      AND tipo_movimentacao = 'pagamento';

    SELECT * INTO v_cp FROM movelaria_contas_pagar WHERE id = NEW.conta_pagar_id;
    IF FOUND THEN
      IF v_cp.status = 'pago'
         AND COALESCE(v_cp.valor_pago, 0) >= v_cp.valor_parcela - 0.009 THEN
        RETURN NEW;
      END IF;

      v_novo_pago := GREATEST(COALESCE(v_cp.valor_pago, 0), v_pago);
      IF v_novo_pago >= v_cp.valor_parcela - 0.009 THEN
        UPDATE movelaria_contas_pagar
        SET status = 'pago',
            valor_pago = v_cp.valor_parcela,
            data_pagamento = COALESCE(NEW.data_movimentacao, CURRENT_DATE),
            atualizado_em = NOW()
        WHERE id = v_cp.id;
      ELSIF v_novo_pago > 0.009 THEN
        UPDATE movelaria_contas_pagar
        SET status = 'parcialmente_pago',
            valor_pago = v_novo_pago,
            data_pagamento = COALESCE(NEW.data_movimentacao, CURRENT_DATE),
            atualizado_em = NOW()
        WHERE id = v_cp.id;
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  -- 2) Pagamento consolidado do destinatário no mês (Caixa "Pagar")
  IF NEW.destinatario_id IS NULL
     OR NEW.mes_referencia IS NULL
     OR NEW.ano_referencia IS NULL THEN
    RETURN NEW;
  END IF;

  -- Apenas o valor deste lançamento
  v_pago := COALESCE(NEW.valor, 0);

  IF v_pago <= 0.009 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(
    GREATEST(cp.valor_parcela - COALESCE(cp.valor_pago, 0), 0)
  ), 0)
  INTO v_total_faltante
  FROM movelaria_contas_pagar cp
  WHERE cp.id IN (
    SELECT m.conta_pagar_id
    FROM movelaria_caixa_movimentacoes m
    WHERE m.destinatario_id = NEW.destinatario_id
      AND m.mes_referencia = NEW.mes_referencia
      AND m.ano_referencia = NEW.ano_referencia
      AND m.tipo_movimentacao = 'reserva'
      AND m.conta_pagar_id IS NOT NULL
  )
  AND NOT (
    cp.status = 'pago'
    AND COALESCE(cp.valor_pago, 0) >= cp.valor_parcela - 0.009
  )
  AND NOT EXISTS (
    SELECT 1 FROM movelaria_caixa_movimentacoes p
    WHERE p.conta_pagar_id = cp.id
      AND p.tipo_movimentacao = 'pagamento'
  );

  IF v_total_faltante <= 0.009 THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('movelaria.skip_caixa_cleanup', '1', true);

  FOR v_cp IN
    SELECT cp.*
    FROM movelaria_contas_pagar cp
    WHERE cp.id IN (
      SELECT m.conta_pagar_id
      FROM movelaria_caixa_movimentacoes m
      WHERE m.destinatario_id = NEW.destinatario_id
        AND m.mes_referencia = NEW.mes_referencia
        AND m.ano_referencia = NEW.ano_referencia
        AND m.tipo_movimentacao = 'reserva'
        AND m.conta_pagar_id IS NOT NULL
    )
    AND NOT (
      cp.status = 'pago'
      AND COALESCE(cp.valor_pago, 0) >= cp.valor_parcela - 0.009
    )
    AND NOT EXISTS (
      SELECT 1 FROM movelaria_caixa_movimentacoes p
      WHERE p.conta_pagar_id = cp.id
        AND p.tipo_movimentacao = 'pagamento'
    )
    ORDER BY cp.data_vencimento NULLS LAST, cp.criado_em NULLS LAST, cp.id
  LOOP
    v_ja_pago := COALESCE(v_cp.valor_pago, 0);
    v_faltante := GREATEST(v_cp.valor_parcela - v_ja_pago, 0);
    IF v_faltante <= 0.009 THEN
      CONTINUE;
    END IF;

    IF v_pago >= v_total_faltante - 0.009 THEN
      v_alocado := v_faltante;
    ELSE
      v_alocado := ROUND((v_faltante / v_total_faltante) * v_pago, 2);
    END IF;

    IF v_alocado <= 0.009 THEN
      CONTINUE;
    END IF;

    v_novo_pago := ROUND(v_ja_pago + v_alocado, 2);
    IF v_novo_pago < v_ja_pago THEN
      CONTINUE;
    END IF;

    IF v_novo_pago >= v_cp.valor_parcela - 0.009 THEN
      v_novo_pago := v_cp.valor_parcela;
      v_novo_status := 'pago';
    ELSE
      v_novo_status := 'parcialmente_pago';
    END IF;

    UPDATE movelaria_contas_pagar
    SET status = v_novo_status,
        valor_pago = v_novo_pago,
        data_pagamento = COALESCE(NEW.data_movimentacao, CURRENT_DATE),
        atualizado_em = NOW()
    WHERE id = v_cp.id
      AND NOT (
        status = 'pago'
        AND COALESCE(valor_pago, 0) >= valor_parcela - 0.009
      )
      AND COALESCE(valor_pago, 0) <= v_novo_pago + 0.009;
  END LOOP;

  PERFORM set_config('movelaria.skip_caixa_cleanup', '0', true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Restaura Junho (quitada por acidente no teste com lógica da 163)
DO $$
BEGIN
  PERFORM set_config('movelaria.skip_caixa_cleanup', '1', true);

  UPDATE movelaria_contas_pagar
  SET status = 'parcialmente_pago',
      valor_pago = 4000.00,
      data_pagamento = COALESCE(data_pagamento, '2026-08-17'),
      atualizado_em = NOW()
  WHERE id = '197ac048-6e40-429e-9843-cfa2d4c84a4c';

  -- Garante reserva alinhada a 4000
  UPDATE movelaria_caixa_movimentacoes
  SET valor = 4000.00
  WHERE conta_pagar_id = '197ac048-6e40-429e-9843-cfa2d4c84a4c'
    AND tipo_movimentacao = 'reserva'
    AND ABS(valor - 4000.00) > 0.009;

  PERFORM set_config('movelaria.skip_caixa_cleanup', '0', true);
END $$;

NOTIFY pgrst, 'reload schema';
