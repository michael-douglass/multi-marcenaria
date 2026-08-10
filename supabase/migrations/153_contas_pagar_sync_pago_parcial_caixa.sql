-- ============================================================
-- GARBO Movelaria — Contas a Pagar: não quitar no total se o
-- Caixa só pagou parcial
-- Migration 153
--
-- Bug (Pro labore Fabio ago/2026):
--   Caixa: reservado 20.000 | pago 15.650 | saldo 4.350
--   Contas a Pagar: status pago + valor_pago 20.000 (errado)
--
-- Causa: trigger movelaria_sync_caixa_pagamento_para_conta
-- marcava a conta como PAGA (valor_parcela inteiro) quando o
-- total pago do mês cobria só as RESERVAS — não o valor real.
--
-- Correção isolada:
-- 1) Só marca PAGO se o pago do Caixa cobre a SOMA das parcelas.
-- 2) Se pagou menos, espelha parcialmente_pago + valor_pago real.
-- 3) Skip de espelhamento Conta→Caixa no sync/backfill (reserva intacta).
-- ============================================================

-- Skip também nos ramos parcial/pago (antes só no revert para pendente),
-- para o sync Caixa→Conta não reescrever reservas corretas.
CREATE OR REPLACE FUNCTION movelaria_sync_pagamento_para_caixa()
RETURNS TRIGGER AS $$
DECLARE
  v_destinatario_id   UUID;
  v_mes               INTEGER;
  v_ano               INTEGER;
  v_descricao_reserva TEXT;
  v_descricao_old     TEXT;
  v_tipo_dest         TEXT;
  v_is_fixo           BOOLEAN;
  v_is_comissao       BOOLEAN;
  v_is_prestador_flow BOOLEAN;
  v_dest_nome         TEXT;
  v_valor_reserva     NUMERIC(12,2);
BEGIN
  v_descricao_reserva := 'Reserva automática via pagamento: ' || COALESCE(NEW.descricao, 'Sem descrição');
  v_descricao_old     := 'Reserva automática via pagamento: ' || COALESCE(OLD.descricao, 'Sem descrição');

  v_is_fixo :=
    COALESCE(NEW.descricao, '') LIKE 'Fixo montador:%'
    OR COALESCE(NEW.fornecedor_nome, '') LIKE 'Fixo montador:%';

  v_is_comissao :=
    NEW.prestador_id IS NOT NULL
    AND NOT v_is_fixo
    AND (
      NEW.obra_id IS NOT NULL
      OR COALESCE(NEW.fornecedor_nome, '') LIKE 'Comissão:%'
      OR COALESCE(NEW.descricao, '') LIKE 'Comissão:%'
    );

  IF (NEW.status = 'pendente' AND OLD.status IN ('pago', 'parcialmente_pago')) THEN
    IF movelaria_caixa_skip_cleanup() THEN
      RETURN NEW;
    END IF;

    DELETE FROM movelaria_caixa_movimentacoes
    WHERE tipo_movimentacao IN ('reserva', 'pagamento')
      AND (
        conta_pagar_id = OLD.id
        OR (
          conta_pagar_id IS NULL
          AND valor = OLD.valor_parcela
          AND descricao = v_descricao_old
          AND mes_referencia = EXTRACT(MONTH FROM OLD.data_vencimento)::INTEGER
          AND ano_referencia = EXTRACT(YEAR  FROM OLD.data_vencimento)::INTEGER
          AND destinatario_id IN (
            SELECT id FROM movelaria_caixa_destinatarios
            WHERE LOWER(TRIM(nome)) = LOWER(TRIM(COALESCE(OLD.fornecedor_nome, '')))
              AND ativo = true
          )
        )
      );
    RETURN NEW;
  END IF;

  IF (NEW.status = 'parcialmente_pago' AND COALESCE(NEW.valor_pago, 0) > 0) THEN
    -- Sync Caixa→Conta pediu para não mexer na reserva
    IF movelaria_caixa_skip_cleanup() THEN
      RETURN NEW;
    END IF;

    IF v_is_comissao THEN
      v_dest_nome := movelaria_nome_destinatario_prestador(NEW.prestador_id, true);
      v_destinatario_id := movelaria_resolver_caixa_destinatario_prestador(v_dest_nome, NEW.prestador_id);
    ELSIF v_is_fixo OR NEW.prestador_id IS NOT NULL THEN
      v_dest_nome := movelaria_nome_destinatario_prestador(NEW.prestador_id, false);
      v_destinatario_id := movelaria_resolver_caixa_destinatario_prestador(
        COALESCE(v_dest_nome, NEW.fornecedor_nome),
        NEW.prestador_id
      );
    ELSE
      SELECT id INTO v_destinatario_id
      FROM movelaria_caixa_destinatarios
      WHERE LOWER(TRIM(nome)) = LOWER(TRIM(NEW.fornecedor_nome))
        AND ativo = true
      LIMIT 1;

      IF (v_destinatario_id IS NULL AND NEW.fornecedor_nome IS NOT NULL AND TRIM(NEW.fornecedor_nome) != '') THEN
        INSERT INTO movelaria_caixa_destinatarios (nome, tipo)
        VALUES (TRIM(NEW.fornecedor_nome), 'fornecedor')
        RETURNING id INTO v_destinatario_id;
      END IF;
    END IF;

    IF v_destinatario_id IS NOT NULL THEN
      v_mes := EXTRACT(MONTH FROM NEW.data_vencimento);
      v_ano := EXTRACT(YEAR  FROM NEW.data_vencimento);

      DELETE FROM movelaria_caixa_movimentacoes
      WHERE conta_pagar_id = NEW.id AND tipo_movimentacao = 'reserva';

      INSERT INTO movelaria_caixa_movimentacoes (
        destinatario_id, tipo_movimentacao, valor,
        data_movimentacao, mes_referencia, ano_referencia,
        descricao, conta_pagar_id
      ) VALUES (
        v_destinatario_id, 'reserva', NEW.valor_pago,
        CURRENT_DATE, v_mes, v_ano, v_descricao_reserva, NEW.id
      );
    END IF;

    RETURN NEW;
  END IF;

  IF (NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago' OR COALESCE(OLD.valor_pago, 0) IS DISTINCT FROM COALESCE(NEW.valor_pago, 0))) THEN
    IF movelaria_caixa_skip_cleanup() THEN
      RETURN NEW;
    END IF;

    v_is_prestador_flow :=
      NEW.prestador_id IS NOT NULL
      AND (
        v_is_fixo
        OR v_is_comissao
        OR EXISTS (
          SELECT 1 FROM movelaria_caixa_movimentacoes
          WHERE conta_pagar_id = NEW.id AND tipo_movimentacao = 'reserva'
        )
      );

    IF v_is_comissao THEN
      v_dest_nome := movelaria_nome_destinatario_prestador(NEW.prestador_id, true);
      v_destinatario_id := movelaria_resolver_caixa_destinatario_prestador(v_dest_nome, NEW.prestador_id);
    ELSIF v_is_fixo OR v_is_prestador_flow THEN
      v_dest_nome := movelaria_nome_destinatario_prestador(NEW.prestador_id, false);
      v_destinatario_id := movelaria_resolver_caixa_destinatario_prestador(
        COALESCE(v_dest_nome, NEW.fornecedor_nome),
        NEW.prestador_id
      );
    ELSE
      v_tipo_dest := CASE WHEN NEW.prestador_id IS NOT NULL THEN 'marceneiro' ELSE 'fornecedor' END;
      SELECT id INTO v_destinatario_id
      FROM movelaria_caixa_destinatarios
      WHERE LOWER(TRIM(nome)) = LOWER(TRIM(NEW.fornecedor_nome))
        AND ativo = true
      LIMIT 1;

      IF (v_destinatario_id IS NULL AND NEW.fornecedor_nome IS NOT NULL AND TRIM(NEW.fornecedor_nome) != '') THEN
        INSERT INTO movelaria_caixa_destinatarios (nome, tipo)
        VALUES (TRIM(NEW.fornecedor_nome), v_tipo_dest)
        RETURNING id INTO v_destinatario_id;
      END IF;
    END IF;

    IF v_destinatario_id IS NOT NULL THEN
      v_mes := EXTRACT(MONTH FROM NEW.data_vencimento);
      v_ano := EXTRACT(YEAR  FROM NEW.data_vencimento);
      v_valor_reserva := COALESCE(NULLIF(NEW.valor_pago, 0), NEW.valor_parcela);

      DELETE FROM movelaria_caixa_movimentacoes
      WHERE conta_pagar_id = NEW.id AND tipo_movimentacao = 'reserva';

      IF v_is_prestador_flow OR v_is_fixo OR v_is_comissao THEN
        INSERT INTO movelaria_caixa_movimentacoes (
          destinatario_id, tipo_movimentacao, valor,
          data_movimentacao, data_vencimento, mes_referencia, ano_referencia,
          descricao, conta_pagar_id
        ) VALUES (
          v_destinatario_id, 'reserva', v_valor_reserva,
          COALESCE(NEW.data_pagamento, CURRENT_DATE), NEW.data_vencimento, v_mes, v_ano,
          CASE
            WHEN v_is_fixo
              THEN 'Reserva fixo montador: ' || COALESCE(NEW.descricao, NEW.fornecedor_nome, 'Sem descrição')
            WHEN v_is_comissao
              THEN 'Reserva comissão: ' || COALESCE(NEW.fornecedor_nome, NEW.descricao, 'Sem descrição')
            ELSE v_descricao_reserva
          END,
          NEW.id
        );
      ELSE
        INSERT INTO movelaria_caixa_movimentacoes (
          destinatario_id, tipo_movimentacao, valor,
          data_movimentacao, mes_referencia, ano_referencia,
          descricao, conta_pagar_id
        ) VALUES (
          v_destinatario_id, 'reserva', v_valor_reserva,
          COALESCE(NEW.data_pagamento, CURRENT_DATE), v_mes, v_ano,
          v_descricao_reserva, NEW.id
        );
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION movelaria_sync_caixa_pagamento_para_conta()
RETURNS TRIGGER AS $$
DECLARE
  v_cp RECORD;
  v_pago NUMERIC(12,2);
  v_total_parcelas NUMERIC(12,2);
  v_novo_pago NUMERIC(12,2);
  v_novo_status TEXT;
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
      IF v_pago >= v_cp.valor_parcela - 0.009 THEN
        UPDATE movelaria_contas_pagar
        SET status = 'pago',
            valor_pago = v_cp.valor_parcela,
            data_pagamento = COALESCE(NEW.data_movimentacao, CURRENT_DATE),
            atualizado_em = NOW()
        WHERE id = v_cp.id;
      ELSIF v_pago > 0.009 THEN
        UPDATE movelaria_contas_pagar
        SET status = 'parcialmente_pago',
            valor_pago = v_pago,
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

  SELECT COALESCE(SUM(valor), 0) INTO v_pago
  FROM movelaria_caixa_movimentacoes
  WHERE destinatario_id = NEW.destinatario_id
    AND mes_referencia = NEW.mes_referencia
    AND ano_referencia = NEW.ano_referencia
    AND tipo_movimentacao = 'pagamento';

  IF v_pago <= 0.009 THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(SUM(cp.valor_parcela), 0) INTO v_total_parcelas
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
  AND NOT EXISTS (
    SELECT 1 FROM movelaria_caixa_movimentacoes p
    WHERE p.conta_pagar_id = cp.id
      AND p.tipo_movimentacao = 'pagamento'
  );

  IF v_total_parcelas <= 0.009 THEN
    RETURN NEW;
  END IF;

  -- Não deixar o espelhamento Conta→Caixa reduzir a reserva
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
    AND NOT EXISTS (
      SELECT 1 FROM movelaria_caixa_movimentacoes p
      WHERE p.conta_pagar_id = cp.id
        AND p.tipo_movimentacao = 'pagamento'
    )
  LOOP
    IF v_pago >= v_total_parcelas - 0.009 THEN
      v_novo_pago := v_cp.valor_parcela;
      v_novo_status := 'pago';
    ELSE
      v_novo_pago := ROUND((v_cp.valor_parcela / v_total_parcelas) * v_pago, 2);
      IF v_novo_pago >= v_cp.valor_parcela - 0.009 THEN
        v_novo_pago := v_cp.valor_parcela;
        v_novo_status := 'pago';
      ELSIF v_novo_pago > 0.009 THEN
        v_novo_status := 'parcialmente_pago';
      ELSE
        CONTINUE;
      END IF;
    END IF;

    UPDATE movelaria_contas_pagar
    SET status = v_novo_status,
        valor_pago = v_novo_pago,
        data_pagamento = COALESCE(NEW.data_movimentacao, CURRENT_DATE),
        atualizado_em = NOW()
    WHERE id = v_cp.id;
  END LOOP;

  PERFORM set_config('movelaria.skip_caixa_cleanup', '0', true);

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill: só contas "pagas" cujo Caixa do mês ainda deve saldo
DO $$
DECLARE
  r RECORD;
  v_pago NUMERIC(12,2);
BEGIN
  PERFORM set_config('movelaria.skip_caixa_cleanup', '1', true);

  FOR r IN
    SELECT
      cp.id,
      cp.valor_parcela,
      s.total_pago
    FROM movelaria_contas_pagar cp
    JOIN movelaria_caixa_destinatarios d
      ON LOWER(TRIM(d.nome)) = LOWER(TRIM(COALESCE(cp.fornecedor_nome, '')))
     AND d.ativo = true
    JOIN movelaria_caixa_saldo_acumulado s
      ON s.destinatario_id = d.id
     AND s.mes_referencia = EXTRACT(MONTH FROM cp.data_vencimento)::INTEGER
     AND s.ano_referencia = EXTRACT(YEAR FROM cp.data_vencimento)::INTEGER
    WHERE cp.status = 'pago'
      AND COALESCE(s.total_pago, 0) > 0.009
      AND COALESCE(s.total_pago, 0) + 0.009 < cp.valor_parcela
  LOOP
    v_pago := LEAST(r.total_pago, r.valor_parcela);

    UPDATE movelaria_contas_pagar
    SET status = CASE
          WHEN v_pago >= valor_parcela - 0.009 THEN 'pago'
          WHEN v_pago > 0.009 THEN 'parcialmente_pago'
          ELSE 'pendente'
        END,
        valor_pago = v_pago,
        atualizado_em = NOW()
    WHERE id = r.id;
  END LOOP;

  PERFORM set_config('movelaria.skip_caixa_cleanup', '0', true);
END $$;
