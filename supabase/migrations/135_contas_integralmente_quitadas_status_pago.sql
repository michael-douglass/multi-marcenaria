-- ============================================================
-- GARBO Movelaria — Contas integralmente quitadas → status PAGO
-- Migration 135
--
-- Contas com valor_pago >= valor_parcela estavam "Pendentes"
-- na lista de Contas a Pagar. Corrige o status e o sync.
-- ============================================================

-- 1) Backfill: se já está integralmente coberto no valor_pago → PAGO
ALTER TABLE movelaria_contas_pagar DISABLE TRIGGER trg_movelaria_sync_pagamento_para_caixa;
ALTER TABLE movelaria_contas_pagar DISABLE TRIGGER trg_funcionario_recibo_ao_pagar_cp;

UPDATE movelaria_contas_pagar cp
SET
  status = 'pago',
  valor_pago = cp.valor_parcela,
  data_pagamento = COALESCE(cp.data_pagamento, cp.data_vencimento, CURRENT_DATE),
  atualizado_em = NOW()
WHERE cp.status IN ('pendente', 'parcialmente_pago')
  AND COALESCE(cp.valor_pago, 0) >= cp.valor_parcela - 0.009;

-- 2) Também: mês do destinatário já quitado no Caixa (Já pago cobre reservas)
WITH cobertos AS (
  SELECT DISTINCT m.conta_pagar_id AS id
  FROM movelaria_caixa_movimentacoes m
  WHERE m.tipo_movimentacao = 'reserva'
    AND m.conta_pagar_id IS NOT NULL
    AND (
      SELECT COALESCE(SUM(CASE WHEN x.tipo_movimentacao = 'pagamento' THEN x.valor ELSE 0 END), 0)
      FROM movelaria_caixa_movimentacoes x
      WHERE x.destinatario_id = m.destinatario_id
        AND x.mes_referencia = m.mes_referencia
        AND x.ano_referencia = m.ano_referencia
    ) >= (
      SELECT COALESCE(SUM(CASE WHEN y.tipo_movimentacao = 'reserva' THEN y.valor ELSE 0 END), 0)
      FROM movelaria_caixa_movimentacoes y
      WHERE y.destinatario_id = m.destinatario_id
        AND y.mes_referencia = m.mes_referencia
        AND y.ano_referencia = m.ano_referencia
    )
    - 0.009
    AND (
      SELECT COALESCE(SUM(CASE WHEN x.tipo_movimentacao = 'pagamento' THEN x.valor ELSE 0 END), 0)
      FROM movelaria_caixa_movimentacoes x
      WHERE x.destinatario_id = m.destinatario_id
        AND x.mes_referencia = m.mes_referencia
        AND x.ano_referencia = m.ano_referencia
    ) > 0.009
)
UPDATE movelaria_contas_pagar cp
SET
  status = 'pago',
  valor_pago = cp.valor_parcela,
  data_pagamento = COALESCE(cp.data_pagamento, cp.data_vencimento, CURRENT_DATE),
  atualizado_em = NOW()
FROM cobertos c
WHERE cp.id = c.id
  AND cp.status IN ('pendente', 'parcialmente_pago');

ALTER TABLE movelaria_contas_pagar ENABLE TRIGGER trg_movelaria_sync_pagamento_para_caixa;
ALTER TABLE movelaria_contas_pagar ENABLE TRIGGER trg_funcionario_recibo_ao_pagar_cp;

-- 3) Sync: marcar pago integral sem pagamento no Caixa → permanece PAGO
--    (reserva continua no Caixa; status da Conta a Pagar acompanha valor quitado)
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

    -- Integralmente quitada na Conta a Pagar → permanece PAGO
    -- (não rebaixa para pendente; reserva no Caixa continua)
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

NOTIFY pgrst, 'reload schema';
