-- ============================================================
-- GARBO Movelaria — Reserva acompanha pagamento completo
-- Migration 143
--
-- Bug: ao pagar o restante de uma conta parcialmente_pago,
-- o status vira "pago" e valor_pago fica integral, mas a
-- reserva no Caixa permanece no valor parcial (ex.: JR
-- R$ 728,53 pago com só R$ 100 reservados → Caixa mostra
-- R$ 1.640,36 em vez de R$ 2.986,64).
--
-- Correção:
-- 1) Trigger: ao marcar pago, sempre alinha a reserva ao
--    valor_pago / valor_parcela (não ignora se já existir).
-- 2) Backfill: completa reservas incompletas de contas pagas.
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

      -- Sempre realinha a reserva ao valor quitado (corrige parcial → integral).
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

-- Backfill: contas pagas com reserva menor que o valor quitado
DO $$
DECLARE
  r RECORD;
  v_dest UUID;
  v_mes INTEGER;
  v_ano INTEGER;
  v_valor NUMERIC(12,2);
  v_desc TEXT;
BEGIN
  FOR r IN
    SELECT
      cp.id,
      cp.fornecedor_nome,
      cp.descricao,
      cp.valor_parcela,
      cp.valor_pago,
      cp.data_vencimento,
      cp.data_pagamento,
      cp.prestador_id,
      COALESCE((
        SELECT SUM(m.valor)
        FROM movelaria_caixa_movimentacoes m
        WHERE m.conta_pagar_id = cp.id AND m.tipo_movimentacao = 'reserva'
      ), 0) AS reservado
    FROM movelaria_contas_pagar cp
    WHERE cp.status = 'pago'
      AND COALESCE(cp.valor_pago, cp.valor_parcela, 0) > 0.009
      AND COALESCE((
        SELECT SUM(m.valor)
        FROM movelaria_caixa_movimentacoes m
        WHERE m.conta_pagar_id = cp.id AND m.tipo_movimentacao = 'reserva'
      ), 0) + 0.009 < COALESCE(cp.valor_pago, cp.valor_parcela)
  LOOP
    v_valor := COALESCE(NULLIF(r.valor_pago, 0), r.valor_parcela);
    v_mes := EXTRACT(MONTH FROM r.data_vencimento)::INTEGER;
    v_ano := EXTRACT(YEAR FROM r.data_vencimento)::INTEGER;
    v_desc := 'Reserva automática via pagamento: ' || COALESCE(r.descricao, 'Sem descrição');

    SELECT id INTO v_dest
    FROM movelaria_caixa_destinatarios
    WHERE LOWER(TRIM(nome)) = LOWER(TRIM(COALESCE(r.fornecedor_nome, '')))
      AND ativo = true
    LIMIT 1;

    IF v_dest IS NULL AND r.fornecedor_nome IS NOT NULL AND TRIM(r.fornecedor_nome) != '' THEN
      INSERT INTO movelaria_caixa_destinatarios (nome, tipo)
      VALUES (TRIM(r.fornecedor_nome), 'fornecedor')
      RETURNING id INTO v_dest;
    END IF;

    IF v_dest IS NULL THEN
      CONTINUE;
    END IF;

    DELETE FROM movelaria_caixa_movimentacoes
    WHERE conta_pagar_id = r.id AND tipo_movimentacao = 'reserva';

    INSERT INTO movelaria_caixa_movimentacoes (
      destinatario_id, tipo_movimentacao, valor,
      data_movimentacao, mes_referencia, ano_referencia,
      descricao, conta_pagar_id
    ) VALUES (
      v_dest, 'reserva', v_valor,
      COALESCE(r.data_pagamento, CURRENT_DATE), v_mes, v_ano,
      v_desc, r.id
    );
  END LOOP;
END;
$$;
