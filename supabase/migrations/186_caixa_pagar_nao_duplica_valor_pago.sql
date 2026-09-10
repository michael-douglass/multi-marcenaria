-- ============================================================
-- GARBO Movelaria — Pagar no Caixa não duplica valor_pago
-- Migration 186
--
-- Bug:
-- 1) Em Contas a Pagar, marcar parcial cria reserva e grava valor_pago.
-- 2) No Caixa, "Pagar" consolidado somava de novo o mesmo valor em
--    valor_pago (ex.: pró-labore Fábio 8.374 → 16.748).
--
-- Correção:
-- - No consolidado, só aumenta valor_pago pelo que ainda falta
--   cobrir da RESERVA (já refletido em Contas a Pagar não entra).
-- - Contas com valor_pago >= reserva ficam de fora da alocação.
-- - Backfill: alinha valor_pago à reserva quando ficou inflado.
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
  v_reservado NUMERIC(12,2);
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

  v_pago := COALESCE(NEW.valor, 0);

  IF v_pago <= 0.009 THEN
    RETURN NEW;
  END IF;

  -- Falta cobrir = min(parcela aberta, reserva ainda não refletida em valor_pago).
  -- Se Contas a Pagar já registrou o mesmo valor da reserva, não aloca de novo.
  SELECT COALESCE(SUM(
    LEAST(
      GREATEST(cp.valor_parcela - COALESCE(cp.valor_pago, 0), 0),
      GREATEST(movelaria_reserva_da_conta(cp.id) - COALESCE(cp.valor_pago, 0), 0)
    )
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
    v_reservado := movelaria_reserva_da_conta(v_cp.id);

    -- Já espelhado em Contas a Pagar até o valor reservado → não soma de novo
    IF v_ja_pago >= v_reservado - 0.009 THEN
      CONTINUE;
    END IF;

    v_faltante := LEAST(
      GREATEST(v_cp.valor_parcela - v_ja_pago, 0),
      GREATEST(v_reservado - v_ja_pago, 0)
    );
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

-- Corrige só o padrão "dobrou": valor_pago ≈ 2 × reserva
-- (ex.: marcou 8.374 em Contas a Pagar e o Caixa somou de novo).
-- Não mexe em diferenças pequenas (ex.: pago 3200 / reserva 3180).
DO $$
BEGIN
  PERFORM set_config('movelaria.skip_caixa_cleanup', '1', true);

  UPDATE movelaria_contas_pagar cp
  SET
    valor_pago = r.reservado,
    status = CASE
      WHEN r.reservado >= cp.valor_parcela - 0.009 THEN 'pago'
      WHEN r.reservado > 0.009 THEN 'parcialmente_pago'
      ELSE cp.status
    END,
    data_pagamento = CASE
      WHEN r.reservado > 0.009 THEN COALESCE(cp.data_pagamento, CURRENT_DATE)
      ELSE cp.data_pagamento
    END,
    atualizado_em = NOW()
  FROM (
    SELECT
      m.conta_pagar_id AS id,
      SUM(m.valor)::NUMERIC(12,2) AS reservado
    FROM movelaria_caixa_movimentacoes m
    WHERE m.tipo_movimentacao = 'reserva'
      AND m.conta_pagar_id IS NOT NULL
    GROUP BY m.conta_pagar_id
  ) r
  WHERE cp.id = r.id
    AND cp.status IN ('parcialmente_pago', 'pago')
    AND r.reservado > 0.009
    AND ABS(COALESCE(cp.valor_pago, 0) - (2 * r.reservado)) < 0.02
    AND NOT EXISTS (
      SELECT 1
      FROM movelaria_caixa_movimentacoes p
      WHERE p.conta_pagar_id = cp.id
        AND p.tipo_movimentacao = 'pagamento'
    );

  PERFORM set_config('movelaria.skip_caixa_cleanup', '0', true);
END $$;

NOTIFY pgrst, 'reload schema';
