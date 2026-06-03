-- Ao apagar a última movimentação do mês, zera o saldo (antes ficava valor antigo)

CREATE OR REPLACE FUNCTION movelaria_recalcular_saldo_caixa()
RETURNS TRIGGER AS $$
DECLARE
    target_destinatario_id UUID;
    target_mes INTEGER;
    target_ano INTEGER;
    v_rows INTEGER;
BEGIN
    IF (TG_OP = 'DELETE') THEN
        target_destinatario_id := OLD.destinatario_id;
        target_mes := OLD.mes_referencia;
        target_ano := OLD.ano_referencia;
    ELSE
        target_destinatario_id := NEW.destinatario_id;
        target_mes := NEW.mes_referencia;
        target_ano := NEW.ano_referencia;
    END IF;

    INSERT INTO movelaria_caixa_saldo_acumulado (destinatario_id, mes_referencia, ano_referencia, total_reservado, total_pago, saldo)
    SELECT
        destinatario_id,
        mes_referencia,
        ano_referencia,
        COALESCE(SUM(CASE WHEN tipo_movimentacao = 'reserva' THEN valor ELSE 0 END), 0) AS total_reservado,
        COALESCE(SUM(CASE WHEN tipo_movimentacao = 'pagamento' THEN valor ELSE 0 END), 0) AS total_pago,
        COALESCE(SUM(CASE WHEN tipo_movimentacao = 'reserva' THEN valor ELSE -valor END), 0) AS saldo
    FROM movelaria_caixa_movimentacoes
    WHERE destinatario_id = target_destinatario_id
      AND mes_referencia = target_mes
      AND ano_referencia = target_ano
    GROUP BY destinatario_id, mes_referencia, ano_referencia
    ON CONFLICT (destinatario_id, mes_referencia, ano_referencia) DO UPDATE SET
        total_reservado = EXCLUDED.total_reservado,
        total_pago = EXCLUDED.total_pago,
        saldo = EXCLUDED.saldo;

    GET DIAGNOSTICS v_rows = ROW_COUNT;

    IF v_rows = 0 THEN
        UPDATE movelaria_caixa_saldo_acumulado
        SET total_reservado = 0, total_pago = 0, saldo = 0
        WHERE destinatario_id = target_destinatario_id
          AND mes_referencia = target_mes
          AND ano_referencia = target_ano;
    END IF;

    RETURN NULL;
END;
$$ LANGUAGE plpgsql;
