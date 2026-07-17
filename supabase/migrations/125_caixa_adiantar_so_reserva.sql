-- ============================================================
-- GARBO Movelaria — Adiantar conta = só reserva no caixa
-- Migration 125
--
-- Problema: ao marcar Fixo montador / Comissão como "pago" em
-- Contas a Pagar (adiantar / separar o dinheiro), o trigger criava
-- RESERVA + PAGAMENTO. O caixa já mostrava como pago sem ter
-- saído o dinheiro de verdade.
--
-- Correção:
-- 1) Prestador (fixo/comissão): ao adiantar, cria só RESERVA
-- 2) Pagamento real continua só pelo Caixa (botão pagar reserva)
-- 3) Reversão limpa todas as movimentações daquela conta
-- ============================================================

CREATE OR REPLACE FUNCTION movelaria_sync_pagamento_para_caixa()
RETURNS TRIGGER AS $$
DECLARE
  v_destinatario_id   UUID;
  v_mes               INTEGER;
  v_ano               INTEGER;
  v_descricao_reserva TEXT;
  v_descricao_old     TEXT;
  v_tipo_dest         TEXT;
  v_is_prestador_flow BOOLEAN;
BEGIN
  v_descricao_reserva := 'Reserva automática via pagamento: ' || COALESCE(NEW.descricao, 'Sem descrição');
  v_descricao_old     := 'Reserva automática via pagamento: ' || COALESCE(OLD.descricao, 'Sem descrição');

  -- ── 1. Reversão para pendente ────────────────────────────────
  IF (NEW.status = 'pendente' AND OLD.status IN ('pago', 'parcialmente_pago')) THEN
    -- Remove reserva e pagamento ligados à conta (e legado sem conta_pagar_id)
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

  -- ── 2. Pagamento parcial: cria/atualiza reserva para valor_pago ─
  IF (NEW.status = 'parcialmente_pago' AND COALESCE(NEW.valor_pago, 0) > 0) THEN
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

    IF v_destinatario_id IS NOT NULL THEN
      v_mes := EXTRACT(MONTH FROM NEW.data_vencimento);
      v_ano := EXTRACT(YEAR  FROM NEW.data_vencimento);

      DELETE FROM movelaria_caixa_movimentacoes
      WHERE conta_pagar_id = NEW.id
        AND tipo_movimentacao = 'reserva';

      INSERT INTO movelaria_caixa_movimentacoes (
        destinatario_id, tipo_movimentacao, valor,
        data_movimentacao, mes_referencia, ano_referencia,
        descricao, conta_pagar_id
      ) VALUES (
        v_destinatario_id, 'reserva', NEW.valor_pago,
        CURRENT_DATE, v_mes, v_ano,
        v_descricao_reserva, NEW.id
      );
    END IF;

    RETURN NEW;
  END IF;

  -- ── 3. Pagamento completo (status → pago) = adiantar / reservar ─
  IF (NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago')) THEN
    v_is_prestador_flow :=
      NEW.prestador_id IS NOT NULL
      AND (
        NEW.obra_id IS NOT NULL
        OR COALESCE(NEW.descricao, '') LIKE 'Comissão:%'
        OR COALESCE(NEW.descricao, '') LIKE 'Fixo montador:%'
        OR EXISTS (
          SELECT 1 FROM movelaria_caixa_movimentacoes
          WHERE conta_pagar_id = NEW.id AND tipo_movimentacao = 'reserva'
        )
      );

    IF v_is_prestador_flow THEN
      v_destinatario_id := movelaria_resolver_caixa_destinatario_prestador(
        NEW.fornecedor_nome,
        NEW.prestador_id
      );

      IF v_destinatario_id IS NOT NULL THEN
        v_mes := EXTRACT(MONTH FROM NEW.data_vencimento);
        v_ano := EXTRACT(YEAR  FROM NEW.data_vencimento);

        -- Só reserva: o pagamento real sai pelo Caixa
        IF NOT EXISTS (
          SELECT 1 FROM movelaria_caixa_movimentacoes
          WHERE conta_pagar_id = NEW.id AND tipo_movimentacao = 'reserva'
        ) THEN
          INSERT INTO movelaria_caixa_movimentacoes (
            destinatario_id, tipo_movimentacao, valor,
            data_movimentacao, data_vencimento, mes_referencia, ano_referencia,
            descricao, conta_pagar_id
          ) VALUES (
            v_destinatario_id, 'reserva', NEW.valor_parcela,
            COALESCE(NEW.data_pagamento, CURRENT_DATE), NEW.data_vencimento, v_mes, v_ano,
            CASE
              WHEN COALESCE(NEW.descricao, '') LIKE 'Fixo montador:%'
                THEN 'Reserva fixo montador: ' || COALESCE(NEW.descricao, 'Sem descrição')
              ELSE 'Reserva comissão obra: ' || COALESCE(NEW.descricao, 'Sem descrição')
            END,
            NEW.id
          );
        END IF;
      END IF;

      RETURN NEW;
    END IF;

    -- 3b. Conta a pagar comum: cria/substitui reserva pelo valor da parcela
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

    IF v_destinatario_id IS NOT NULL THEN
      v_mes := EXTRACT(MONTH FROM NEW.data_vencimento);
      v_ano := EXTRACT(YEAR  FROM NEW.data_vencimento);

      DELETE FROM movelaria_caixa_movimentacoes
      WHERE conta_pagar_id = NEW.id
        AND tipo_movimentacao = 'reserva';

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

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
