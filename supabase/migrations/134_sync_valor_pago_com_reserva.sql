-- ============================================================
-- GARBO Movelaria — Valor pago espelha reserva (sem pagamento real)
-- Migration 134
--
-- Problema: ao reservar no Caixa, Contas a Pagar zerava valor_pago
-- e Michael Douglas (R$ 7.370 reservado) "não constava".
--
-- Regra:
-- - Sem pagamento real no Caixa → NÃO marca como pago
-- - Com reserva parcial → parcialmente_pago + valor_pago = reservado
-- - Com reserva total (adiantar) → pendente + valor_pago = reservado
-- ============================================================

CREATE OR REPLACE FUNCTION movelaria_reserva_da_conta(p_conta_id UUID)
RETURNS NUMERIC(12,2) AS $$
  SELECT COALESCE(SUM(valor), 0)::NUMERIC(12,2)
  FROM movelaria_caixa_movimentacoes
  WHERE conta_pagar_id = p_conta_id
    AND tipo_movimentacao = 'reserva';
$$ LANGUAGE sql STABLE;

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
  v_reservado         NUMERIC(12,2);
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

  -- ── 1. Reversão para pendente ────────────────────────────────
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

  -- ── 2. Pagamento parcial ────────────────────────────────────
  IF (NEW.status = 'parcialmente_pago' AND COALESCE(NEW.valor_pago, 0) > 0) THEN
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

    -- Sem pagamento real: mantém parcialmente_pago (reserva parcial "consta")
    RETURN NEW;
  END IF;

  -- ── 3. Pagamento completo (adiantar / reservar) ─────────────
  IF (NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago')) THEN
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

      IF NOT EXISTS (
        SELECT 1 FROM movelaria_caixa_movimentacoes
        WHERE conta_pagar_id = NEW.id AND tipo_movimentacao = 'reserva'
      ) THEN
        IF v_is_prestador_flow OR v_is_fixo OR v_is_comissao THEN
          INSERT INTO movelaria_caixa_movimentacoes (
            destinatario_id, tipo_movimentacao, valor,
            data_movimentacao, data_vencimento, mes_referencia, ano_referencia,
            descricao, conta_pagar_id
          ) VALUES (
            v_destinatario_id, 'reserva', NEW.valor_parcela,
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
          DELETE FROM movelaria_caixa_movimentacoes
          WHERE conta_pagar_id = NEW.id AND tipo_movimentacao = 'reserva';

          INSERT INTO movelaria_caixa_movimentacoes (
            destinatario_id, tipo_movimentacao, valor,
            data_movimentacao, mes_referencia, ano_referencia,
            descricao, conta_pagar_id
          ) VALUES (
            v_destinatario_id, 'reserva', NEW.valor_parcela,
            COALESCE(NEW.data_pagamento, CURRENT_DATE), v_mes, v_ano,
            v_descricao_reserva, NEW.id
          );
        END IF;
      END IF;
    END IF;

    -- Sem pagamento real → PENDENTE, mas valor_pago = reservado (aparece na lista)
    IF NOT EXISTS (
      SELECT 1 FROM movelaria_caixa_movimentacoes
      WHERE conta_pagar_id = NEW.id AND tipo_movimentacao = 'pagamento'
    ) THEN
      v_reservado := movelaria_reserva_da_conta(NEW.id);
      PERFORM set_config('movelaria.skip_caixa_cleanup', '1', true);
      UPDATE movelaria_contas_pagar
      SET status = 'pendente',
          valor_pago = v_reservado,
          data_pagamento = CASE WHEN v_reservado > 0.009 THEN COALESCE(NEW.data_pagamento, CURRENT_DATE) ELSE NULL END,
          atualizado_em = NOW()
      WHERE id = NEW.id;
      PERFORM set_config('movelaria.skip_caixa_cleanup', '0', true);
    END IF;

    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Backfill sem disparar efeitos colaterais
ALTER TABLE movelaria_contas_pagar DISABLE TRIGGER trg_movelaria_sync_pagamento_para_caixa;
ALTER TABLE movelaria_contas_pagar DISABLE TRIGGER trg_funcionario_recibo_ao_pagar_cp;

UPDATE movelaria_contas_pagar cp
SET
  valor_pago = r.reservado,
  status = CASE
    WHEN r.reservado >= cp.valor_parcela - 0.009 THEN 'pendente'
    WHEN r.reservado > 0.009 THEN 'parcialmente_pago'
    ELSE cp.status
  END,
  data_pagamento = CASE
    WHEN r.reservado > 0.009 THEN COALESCE(cp.data_pagamento, CURRENT_DATE)
    ELSE cp.data_pagamento
  END,
  atualizado_em = NOW()
FROM (
  SELECT m.conta_pagar_id, SUM(m.valor) AS reservado
  FROM movelaria_caixa_movimentacoes m
  WHERE m.tipo_movimentacao = 'reserva'
    AND m.conta_pagar_id IS NOT NULL
  GROUP BY m.conta_pagar_id
) r
WHERE cp.id = r.conta_pagar_id
  AND NOT EXISTS (
    SELECT 1 FROM movelaria_caixa_movimentacoes p
    WHERE p.conta_pagar_id = cp.id AND p.tipo_movimentacao = 'pagamento'
  )
  AND cp.status IN ('pendente', 'parcialmente_pago', 'pago');

ALTER TABLE movelaria_contas_pagar ENABLE TRIGGER trg_movelaria_sync_pagamento_para_caixa;
ALTER TABLE movelaria_contas_pagar ENABLE TRIGGER trg_funcionario_recibo_ao_pagar_cp;

NOTIFY pgrst, 'reload schema';
