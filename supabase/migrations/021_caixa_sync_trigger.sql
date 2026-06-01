-- ============================================================
-- GARBO Movelaria — Sincronização Automática Caixa
-- ============================================================

-- ── Trigger para sincronizar pagamentos de despesas como reserva no caixa ──
CREATE OR REPLACE FUNCTION movelaria_sync_pagamento_para_caixa()
RETURNS TRIGGER AS $$
DECLARE
    v_destinatario_id UUID;
    v_mes INTEGER;
    v_ano INTEGER;
BEGIN
    -- Só age quando o status muda para 'pago'
    IF (NEW.status = 'pago' AND (OLD.status IS NULL OR OLD.status != 'pago')) THEN
        -- Resolve destinatário pelo nome do fornecedor (case-insensitive trim)
        SELECT id INTO v_destinatario_id
        FROM movelaria_caixa_destinatarios
        WHERE LOWER(TRIM(nome)) = LOWER(TRIM(NEW.fornecedor_nome))
        AND ativo = true
        LIMIT 1;

        -- Se não encontrar, cria um automaticamente como 'fornecedor'
        IF (v_destinatario_id IS NULL AND NEW.fornecedor_nome IS NOT NULL AND TRIM(NEW.fornecedor_nome) != '') THEN
            INSERT INTO movelaria_caixa_destinatarios (nome, tipo)
            VALUES (TRIM(NEW.fornecedor_nome), 'fornecedor')
            RETURNING id INTO v_destinatario_id;
        END IF;

        IF (v_destinatario_id IS NOT NULL) THEN
            -- Competência baseada na data de vencimento da conta
            v_mes := EXTRACT(MONTH FROM NEW.data_vencimento);
            v_ano := EXTRACT(YEAR FROM NEW.data_vencimento);

            INSERT INTO movelaria_caixa_movimentacoes (
                destinatario_id,
                tipo_movimentacao,
                valor,
                data_movimentacao,
                mes_referencia,
                ano_referencia,
                descricao
            ) VALUES (
                v_destinatario_id,
                'reserva',
                NEW.valor_parcela,
                COALESCE(NEW.data_pagamento, CURRENT_DATE),
                v_mes,
                v_ano,
                'Reserva automática via pagamento: ' || COALESCE(NEW.descricao, 'Sem descrição')
            );
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remove se já existir para evitar erro em re-execução
DROP TRIGGER IF EXISTS trg_movelaria_sync_pagamento_para_caixa ON movelaria_contas_pagar;

CREATE TRIGGER trg_movelaria_sync_pagamento_para_caixa
AFTER UPDATE ON movelaria_contas_pagar
FOR EACH ROW
EXECUTE FUNCTION movelaria_sync_pagamento_para_caixa();
