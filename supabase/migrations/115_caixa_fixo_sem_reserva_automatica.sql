-- ============================================================
-- GARBO Movelaria — Fixo montador NÃO reserva automaticamente no caixa
-- Migration 115
--
-- Problema: ao gerar contas "Fixo montador" de meses futuros, o trigger
-- criava RESERVA no caixa mesmo com a conta ainda pendente. O filtro
-- "Próx. mês" mostrava valores reservados sem nenhum pagamento real.
--
-- Correção:
-- 1) Parar de criar reserva na geração do fixo (só comissão de obra segue)
-- 2) No pagamento do fixo, criar reserva + pagamento se ainda não existirem
-- 3) Limpar reservas fantasma de fixo (conta pendente/inexistente, sem pagamento)
-- ============================================================

-- ── 1. Geração: não reservar fixo montador ───────────────────
CREATE OR REPLACE FUNCTION movelaria_sync_comissao_gerada_para_caixa()
RETURNS TRIGGER AS $$
DECLARE
  v_destinatario_id UUID;
  v_mes             INTEGER;
  v_ano             INTEGER;
BEGIN
  IF NEW.prestador_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Fixo montador: só cria a conta a pagar; reserva nasce no pagamento real
  IF COALESCE(NEW.descricao, '') LIKE 'Fixo montador:%' THEN
    RETURN NEW;
  END IF;

  IF NEW.obra_id IS NULL
     AND COALESCE(NEW.descricao, '') NOT LIKE 'Comissão:%' THEN
    RETURN NEW;
  END IF;

  v_destinatario_id := movelaria_resolver_caixa_destinatario_prestador(
    NEW.fornecedor_nome,
    NEW.prestador_id
  );

  IF v_destinatario_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM movelaria_caixa_movimentacoes
    WHERE conta_pagar_id = NEW.id
      AND tipo_movimentacao = 'reserva'
  ) THEN
    RETURN NEW;
  END IF;

  v_mes := EXTRACT(MONTH FROM NEW.data_vencimento)::INTEGER;
  v_ano := EXTRACT(YEAR  FROM NEW.data_vencimento)::INTEGER;

  INSERT INTO movelaria_caixa_movimentacoes (
    destinatario_id,
    tipo_movimentacao,
    valor,
    data_movimentacao,
    data_vencimento,
    mes_referencia,
    ano_referencia,
    descricao,
    conta_pagar_id
  ) VALUES (
    v_destinatario_id,
    'reserva',
    NEW.valor_parcela,
    CURRENT_DATE,
    NEW.data_vencimento,
    v_mes,
    v_ano,
    'Reserva comissão obra: ' || COALESCE(NEW.descricao, 'Sem descrição'),
    NEW.id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 2. Pagamento: fixo/comissão sem reserva prévia ainda registra no caixa ─
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

  -- ── 3. Pagamento completo (status → pago) ───────────────────
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

        -- Garante reserva (fixo não cria mais na geração)
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

        IF NOT EXISTS (
          SELECT 1 FROM movelaria_caixa_movimentacoes
          WHERE conta_pagar_id = NEW.id AND tipo_movimentacao = 'pagamento'
        ) THEN
          INSERT INTO movelaria_caixa_movimentacoes (
            destinatario_id, tipo_movimentacao, valor,
            data_movimentacao, mes_referencia, ano_referencia,
            descricao, conta_pagar_id
          ) VALUES (
            v_destinatario_id, 'pagamento', NEW.valor_parcela,
            COALESCE(NEW.data_pagamento, CURRENT_DATE), v_mes, v_ano,
            CASE
              WHEN COALESCE(NEW.descricao, '') LIKE 'Fixo montador:%'
                THEN 'Pagamento fixo montador: ' || COALESCE(NEW.descricao, 'Sem descrição')
              ELSE 'Pagamento comissão: ' || COALESCE(NEW.descricao, 'Sem descrição')
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

-- ── 3. Limpeza: reservas fantasma de fixo (pendente / órfã / sem pagamento) ─
DELETE FROM movelaria_caixa_movimentacoes m
WHERE m.tipo_movimentacao = 'reserva'
  AND COALESCE(m.descricao, '') LIKE 'Reserva fixo montador:%'
  AND NOT EXISTS (
    SELECT 1
    FROM movelaria_caixa_movimentacoes p
    WHERE p.conta_pagar_id IS NOT NULL
      AND p.conta_pagar_id = m.conta_pagar_id
      AND p.tipo_movimentacao = 'pagamento'
  )
  AND (
    m.conta_pagar_id IS NULL
    OR NOT EXISTS (
      SELECT 1 FROM movelaria_contas_pagar cp WHERE cp.id = m.conta_pagar_id
    )
    OR EXISTS (
      SELECT 1
      FROM movelaria_contas_pagar cp
      WHERE cp.id = m.conta_pagar_id
        AND cp.status = 'pendente'
    )
  );

NOTIFY pgrst, 'reload schema';
