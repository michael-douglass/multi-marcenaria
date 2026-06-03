-- Vincula reservas do caixa à conta a pagar e permite reverter pagamento (pago → pendente)

ALTER TABLE movelaria_caixa_movimentacoes
  ADD COLUMN IF NOT EXISTS conta_pagar_id UUID
    REFERENCES movelaria_contas_pagar(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_caixa_mov_conta_pagar
  ON movelaria_caixa_movimentacoes(conta_pagar_id)
  WHERE conta_pagar_id IS NOT NULL;

CREATE OR REPLACE FUNCTION movelaria_sync_pagamento_para_caixa()
RETURNS TRIGGER AS $$
DECLARE
    v_destinatario_id UUID;
    v_mes INTEGER;
    v_ano INTEGER;
    v_descricao_reserva TEXT;
BEGIN
    v_descricao_reserva := 'Reserva automática via pagamento: ' || COALESCE(NEW.descricao, 'Sem descrição');

    -- Status voltou de pago para pendente: remove reserva ligada à conta
    IF (OLD.status = 'pago' AND NEW.status = 'pendente') THEN
        DELETE FROM movelaria_caixa_movimentacoes
        WHERE tipo_movimentacao = 'reserva'
          AND (
            conta_pagar_id = OLD.id
            OR (
              conta_pagar_id IS NULL
              AND valor = OLD.valor_parcela
              AND descricao = v_descricao_reserva
              AND destinatario_id IN (
                SELECT id FROM movelaria_caixa_destinatarios
                WHERE LOWER(TRIM(nome)) = LOWER(TRIM(COALESCE(OLD.fornecedor_nome, '')))
                  AND ativo = true
              )
            )
          );
        RETURN NEW;
    END IF;

    -- Status mudou para pago: cria reserva no caixa de pagamentos adiados
    IF (NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago')) THEN
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

        IF (v_destinatario_id IS NOT NULL) THEN
            v_mes := EXTRACT(MONTH FROM NEW.data_vencimento);
            v_ano := EXTRACT(YEAR FROM NEW.data_vencimento);

            INSERT INTO movelaria_caixa_movimentacoes (
                destinatario_id,
                tipo_movimentacao,
                valor,
                data_movimentacao,
                mes_referencia,
                ano_referencia,
                descricao,
                conta_pagar_id
            ) VALUES (
                v_destinatario_id,
                'reserva',
                NEW.valor_parcela,
                COALESCE(NEW.data_pagamento, CURRENT_DATE),
                v_mes,
                v_ano,
                v_descricao_reserva,
                NEW.id
            );
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
