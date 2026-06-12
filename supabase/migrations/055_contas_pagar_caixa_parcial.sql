-- Atualiza trigger para refletir pagamentos parciais no caixa de pagamentos adiados
-- Agora cria/atualiza reserva para cada pagamento parcial, não só quando totalmente pago

CREATE OR REPLACE FUNCTION movelaria_sync_pagamento_para_caixa()
RETURNS TRIGGER AS $$
DECLARE
    v_destinatario_id UUID;
    v_mes             INTEGER;
    v_ano             INTEGER;
    v_descricao_reserva TEXT;
    v_descricao_old     TEXT;
    v_tipo_dest         TEXT;
    v_valor_reserva     NUMERIC;
BEGIN
    v_descricao_reserva := 'Reserva automática via pagamento: ' || COALESCE(NEW.descricao, 'Sem descrição');
    v_descricao_old     := 'Reserva automática via pagamento: ' || COALESCE(OLD.descricao, 'Sem descrição');

    -- ── 1. Reversão para pendente: remove todas as reservas desta conta ─────
    IF (NEW.status = 'pendente' AND OLD.status IN ('pago', 'parcialmente_pago')) THEN
        DELETE FROM movelaria_caixa_movimentacoes
        WHERE id IN (
            SELECT m.id
            FROM movelaria_caixa_movimentacoes m
            WHERE m.tipo_movimentacao IN ('reserva', 'pagamento')
              AND (
                m.conta_pagar_id = OLD.id
                OR (
                  m.conta_pagar_id IS NULL
                  AND m.valor = OLD.valor_parcela
                  AND m.descricao = v_descricao_old
                  AND m.mes_referencia = EXTRACT(MONTH FROM OLD.data_vencimento)::INTEGER
                  AND m.ano_referencia = EXTRACT(YEAR  FROM OLD.data_vencimento)::INTEGER
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

    -- ── 2. Pagamento parcial: cria/atualiza reserva para valor_pago ─────────
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

            -- Remove reserva anterior (caso seja 2º, 3º pagamento parcial)
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

    -- ── 3. Pagamento completo (status → pago) ───────────────────────────────
    IF (NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago')) THEN

        -- 3a. Comissão de prestador com reserva já gerada: cria 'pagamento'
        IF NEW.prestador_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM movelaria_caixa_movimentacoes
            WHERE conta_pagar_id = NEW.id AND tipo_movimentacao = 'reserva'
        ) THEN
            SELECT id INTO v_destinatario_id
            FROM movelaria_caixa_destinatarios
            WHERE LOWER(TRIM(nome)) = LOWER(TRIM(NEW.fornecedor_nome))
              AND ativo = true
            LIMIT 1;

            IF v_destinatario_id IS NOT NULL THEN
                v_mes := EXTRACT(MONTH FROM NEW.data_vencimento);
                v_ano := EXTRACT(YEAR  FROM NEW.data_vencimento);

                INSERT INTO movelaria_caixa_movimentacoes (
                    destinatario_id, tipo_movimentacao, valor,
                    data_movimentacao, mes_referencia, ano_referencia,
                    descricao, conta_pagar_id
                ) VALUES (
                    v_destinatario_id, 'pagamento', NEW.valor_parcela,
                    COALESCE(NEW.data_pagamento, CURRENT_DATE), v_mes, v_ano,
                    'Pagamento comissão: ' || COALESCE(NEW.descricao, 'Sem descrição'),
                    NEW.id
                );
            END IF;
            RETURN NEW;
        END IF;

        -- 3b. Conta a pagar comum: cria/substitui reserva pelo valor total da parcela
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

            -- Remove reserva parcial anterior (se houver) para não duplicar
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
