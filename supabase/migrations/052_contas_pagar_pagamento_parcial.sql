-- Adiciona suporte a pagamento parcial em contas a pagar
-- Novo campo valor_pago acumula pagamentos; status 'parcialmente_pago' indica conta em processo

ALTER TABLE movelaria_contas_pagar
  ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(12, 2) NOT NULL DEFAULT 0;

-- Atualiza constraint de status para incluir 'parcialmente_pago'
ALTER TABLE movelaria_contas_pagar
  DROP CONSTRAINT IF EXISTS movelaria_contas_pagar_status_check;

ALTER TABLE movelaria_contas_pagar
  ADD CONSTRAINT movelaria_contas_pagar_status_check
  CHECK (status IN ('pendente', 'parcialmente_pago', 'pago'));

-- Atualiza trigger de reversão para também tratar parcialmente_pago → pendente
CREATE OR REPLACE FUNCTION movelaria_sync_pagamento_para_caixa()
RETURNS TRIGGER AS $$
DECLARE
    v_destinatario_id UUID;
    v_mes INTEGER;
    v_ano INTEGER;
    v_descricao_reserva TEXT;
BEGIN
    v_descricao_reserva := 'Reserva automática via pagamento: ' || COALESCE(NEW.descricao, 'Sem descrição');

    -- Status voltou de pago/parcialmente_pago para pendente: remove reserva ligada à conta
    IF (OLD.status IN ('pago', 'parcialmente_pago') AND NEW.status = 'pendente') THEN
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
