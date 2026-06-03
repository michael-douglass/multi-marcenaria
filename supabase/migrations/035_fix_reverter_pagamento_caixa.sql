-- Corrige reversão: remove apenas a reserva da parcela revertida (nunca outras do mesmo fornecedor)

CREATE OR REPLACE FUNCTION movelaria_sync_pagamento_para_caixa()
RETURNS TRIGGER AS $$
DECLARE
    v_destinatario_id UUID;
    v_mes INTEGER;
    v_ano INTEGER;
    v_descricao_reserva TEXT;
    v_descricao_old TEXT;
BEGIN
    v_descricao_reserva := 'Reserva automática via pagamento: ' || COALESCE(NEW.descricao, 'Sem descrição');
    v_descricao_old := 'Reserva automática via pagamento: ' || COALESCE(OLD.descricao, 'Sem descrição');

    -- pago → pendente: apaga no máximo UMA reserva desta parcela
    IF (OLD.status = 'pago' AND NEW.status = 'pendente') THEN
        DELETE FROM movelaria_caixa_movimentacoes
        WHERE id IN (
            SELECT m.id
            FROM movelaria_caixa_movimentacoes m
            WHERE m.tipo_movimentacao = 'reserva'
              AND (
                m.conta_pagar_id = OLD.id
                OR (
                  m.conta_pagar_id IS NULL
                  AND m.valor = OLD.valor_parcela
                  AND m.descricao = v_descricao_old
                  AND m.mes_referencia = EXTRACT(MONTH FROM OLD.data_vencimento)::INTEGER
                  AND m.ano_referencia = EXTRACT(YEAR FROM OLD.data_vencimento)::INTEGER
                  AND m.destinatario_id IN (
                    SELECT id FROM movelaria_caixa_destinatarios
                    WHERE LOWER(TRIM(nome)) = LOWER(TRIM(COALESCE(OLD.fornecedor_nome, '')))
                      AND ativo = true
                  )
                )
              )
            ORDER BY
              CASE WHEN m.conta_pagar_id = OLD.id THEN 0 ELSE 1 END,
              m.criado_em DESC
            LIMIT 1
        );
        RETURN NEW;
    END IF;

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
