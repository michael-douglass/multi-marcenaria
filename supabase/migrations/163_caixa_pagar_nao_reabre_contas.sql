-- ============================================================
-- GARBO Movelaria — Caixa "Pagar" não reabre / não quita errado
-- Migration 163
--
-- Incidente 17/08/2026 (J. R. FERRAGENS):
--   Ao registrar pagamento consolidado no Caixa, o trigger
--   movelaria_sync_caixa_pagamento_para_conta:
--   1) Redistribuía TODOS os pagamentos do mês nas contas com
--      reserva e PODIA REDUZIR valor_pago / reabrir status=pago.
--   2) Em cascata, Contas a Pagar "marcadas pagas" de novo
--      recriavam reserva cheia (ex.: Pro labore Fabio / Michael
--      Douglas com R$ 20.000 fantasma).
--
-- Correção do trigger:
--   - Nunca mexer em conta já 100% paga (status=pago).
--   - Nunca diminuir valor_pago.
--   - Alocar só o que ainda falta cobrir (parcela − já pago),
--     proporcional ao que falta — não ao valor cheio da parcela.
--   - Só marca pago se valor_pago cobrir a parcela.
--
-- Correção de dados (ago/2026):
--   - Michael / Fabio: parcialmente_pago + reserva = pago do Caixa
--   - JR Fechamento mes 07: volta a pago (foi reaberta)
--   - JR Fechamento Junho: valor_pago alinhado à reserva (4000)
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
      -- Não reabrir / reduzir conta já quitada
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

  -- Só o pagamento que acabou de entrar (não o total do mês).
  -- Usar o acumulado do mês reabria/quitava contas já cobertas.
  v_pago := COALESCE(NEW.valor, 0);

  IF v_pago <= 0.009 THEN
    RETURN NEW;
  END IF;

  -- Soma do que ainda falta nas contas com reserva (ignora já pagas)
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

  -- Não deixar o espelhamento Conta→Caixa reescrever reservas
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
    -- Nunca reduzir
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
      -- Travas finais contra regressão
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

-- ── Reparo dos dados do incidente ────────────────────────────
DO $$
DECLARE
  v_pago NUMERIC(12,2);
  v_mov_id UUID;
BEGIN
  PERFORM set_config('movelaria.skip_caixa_cleanup', '1', true);

  -- Michael Douglas (ago/2026): pago no Caixa = 7000, NÃO 20000
  SELECT COALESCE(SUM(m.valor), 0) INTO v_pago
  FROM movelaria_caixa_movimentacoes m
  JOIN movelaria_caixa_destinatarios d ON d.id = m.destinatario_id
  WHERE LOWER(TRIM(d.nome)) = 'michael douglas'
    AND m.mes_referencia = 8
    AND m.ano_referencia = 2026
    AND m.tipo_movimentacao = 'pagamento';

  UPDATE movelaria_contas_pagar
  SET status = CASE
        WHEN v_pago >= valor_parcela - 0.009 THEN 'pago'
        WHEN v_pago > 0.009 THEN 'parcialmente_pago'
        ELSE 'pendente'
      END,
      valor_pago = LEAST(v_pago, valor_parcela),
      data_pagamento = CASE WHEN v_pago > 0.009 THEN COALESCE(data_pagamento, CURRENT_DATE) ELSE NULL END,
      atualizado_em = NOW()
  WHERE id = 'd8e093f2-f102-43ac-9182-b3ab3471153c';

  SELECT m.id INTO v_mov_id
  FROM movelaria_caixa_movimentacoes m
  WHERE m.conta_pagar_id = 'd8e093f2-f102-43ac-9182-b3ab3471153c'
    AND m.tipo_movimentacao = 'reserva'
  ORDER BY m.criado_em DESC
  LIMIT 1;

  IF v_mov_id IS NOT NULL THEN
    IF v_pago > 0.009 THEN
      UPDATE movelaria_caixa_movimentacoes
      SET valor = v_pago,
          descricao = 'Reserva alinhada ao pago (correção pós Pagar JR)'
      WHERE id = v_mov_id;
    ELSE
      DELETE FROM movelaria_caixa_movimentacoes WHERE id = v_mov_id;
    END IF;
  END IF;

  -- Pro labore Fabio (ago/2026): pago no Caixa = 15650, NÃO 20000
  v_mov_id := NULL;
  SELECT COALESCE(SUM(m.valor), 0) INTO v_pago
  FROM movelaria_caixa_movimentacoes m
  JOIN movelaria_caixa_destinatarios d ON d.id = m.destinatario_id
  WHERE LOWER(TRIM(d.nome)) = 'pro labore fabio'
    AND m.mes_referencia = 8
    AND m.ano_referencia = 2026
    AND m.tipo_movimentacao = 'pagamento';

  UPDATE movelaria_contas_pagar
  SET status = CASE
        WHEN v_pago >= valor_parcela - 0.009 THEN 'pago'
        WHEN v_pago > 0.009 THEN 'parcialmente_pago'
        ELSE 'pendente'
      END,
      valor_pago = LEAST(v_pago, valor_parcela),
      data_pagamento = CASE WHEN v_pago > 0.009 THEN COALESCE(data_pagamento, CURRENT_DATE) ELSE NULL END,
      atualizado_em = NOW()
  WHERE id = 'e5ddeb9a-9d41-461d-9057-6366aa586393';

  SELECT m.id INTO v_mov_id
  FROM movelaria_caixa_movimentacoes m
  WHERE m.conta_pagar_id = 'e5ddeb9a-9d41-461d-9057-6366aa586393'
    AND m.tipo_movimentacao = 'reserva'
  ORDER BY m.criado_em DESC
  LIMIT 1;

  IF v_mov_id IS NOT NULL THEN
    IF v_pago > 0.009 THEN
      UPDATE movelaria_caixa_movimentacoes
      SET valor = v_pago,
          descricao = 'Reserva alinhada ao pago (correção pós Pagar JR)'
      WHERE id = v_mov_id;
    ELSE
      DELETE FROM movelaria_caixa_movimentacoes WHERE id = v_mov_id;
    END IF;
  END IF;

  -- JR: Fechamento mensal mes 07 — estava reservada integral; foi reaberta pelo sync
  UPDATE movelaria_contas_pagar
  SET status = 'pago',
      valor_pago = valor_parcela,
      data_pagamento = COALESCE(data_pagamento, '2026-08-17'),
      atualizado_em = NOW()
  WHERE id = '82ae4327-5e05-4a76-ab32-a7ba0de089dc'
    AND status IS DISTINCT FROM 'pago';

  -- JR: Fechamento Junho — reserva 4000; sync inflou valor_pago para 8137.85
  UPDATE movelaria_contas_pagar
  SET status = 'parcialmente_pago',
      valor_pago = 4000.00,
      data_pagamento = COALESCE(data_pagamento, '2026-08-17'),
      atualizado_em = NOW()
  WHERE id = '197ac048-6e40-429e-9843-cfa2d4c84a4c'
    AND ABS(COALESCE(valor_pago, 0) - 4000.00) > 0.009;

  PERFORM set_config('movelaria.skip_caixa_cleanup', '0', true);
END $$;

NOTIFY pgrst, 'reload schema';
