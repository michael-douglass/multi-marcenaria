-- ============================================================
-- GARBO Movelaria — Unifica "Kaique" → "Kayke Santos"
-- Migration 141
--
-- O destinatário "Kaique" (tipo fornecedor) é um cadastro errado /
-- duplicata do montador "Kayke Santos". Séries recorrentes sob o
-- nome "Kaique" inflavam o Valor real no Caixa (ex.: ago/2026 =
-- R$ 12.000). Em Métricas de Obras o prestador correto é Kayke Santos.
--
-- Esta migração:
-- 1) move histórico do Caixa (movimentações + saldos) para Kayke
-- 2) remove todas as contas a pagar "Kaique"
-- 3) cria fixo jun/jul/2026 em Kayke para bater com o já pago
-- 4) desativa o destinatário "Kaique"
-- ============================================================

ALTER TABLE movelaria_contas_pagar DISABLE TRIGGER trg_movelaria_sync_pagamento_para_caixa;
ALTER TABLE movelaria_contas_pagar DISABLE TRIGGER trg_funcionario_recibo_ao_pagar_cp;

DO $$
DECLARE
  v_kaique    UUID := '20688829-c7e9-4e10-a979-a729f71000e7';
  v_kayke     UUID := 'ff58109d-bcaf-4e14-8bcd-e86a6d7c57fe';
  v_prestador UUID := '9a429102-2737-483c-9ed7-0690d62e5970';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM movelaria_caixa_destinatarios WHERE id = v_kaique
  ) THEN
    RAISE NOTICE 'Destinatário Kaique já inexistente — nada a unificar.';
    RETURN;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM movelaria_caixa_destinatarios WHERE id = v_kayke
  ) THEN
    RAISE EXCEPTION 'Destinatário Kayke Santos (%) não encontrado.', v_kayke;
  END IF;

  -- 1) Desvincula movimentações das contas Kaique (FK)
  UPDATE movelaria_caixa_movimentacoes m
  SET conta_pagar_id = NULL
  WHERE m.conta_pagar_id IN (
    SELECT cp.id
    FROM movelaria_contas_pagar cp
    WHERE cp.fornecedor_nome ILIKE 'Kaique'
  );

  -- 2) Move movimentações do Caixa para Kayke Santos.
  --    Triggers do Caixa já reconstroem o saldo do Kayke — NÃO somar
  --    manualmente o saldo do Kaique (isso dobraria jun/jul).
  UPDATE movelaria_caixa_movimentacoes
  SET
    destinatario_id = v_kayke,
    descricao = CASE
      WHEN descricao ILIKE '%Kaique%' THEN
        regexp_replace(descricao, 'Kaique', 'Kayke Santos', 'gi')
      ELSE descricao
    END
  WHERE destinatario_id = v_kaique;

  -- 3) Remove saldos órfãos do Kaique (já refletidos no Kayke via trigger)
  DELETE FROM movelaria_caixa_saldo_acumulado
  WHERE destinatario_id = v_kaique;

  -- 4) Remove contas a pagar fantasma "Kaique"
  DELETE FROM movelaria_contas_pagar
  WHERE fornecedor_nome ILIKE 'Kaique';

  -- 5) Garante fixo histórico jun/jul (valores já pagos no Caixa)
  IF NOT EXISTS (
    SELECT 1 FROM movelaria_contas_pagar
    WHERE fornecedor_nome = 'Kayke Santos'
      AND data_vencimento = '2026-06-05'
      AND descricao ILIKE 'Fixo montador:%'
  ) THEN
    INSERT INTO movelaria_contas_pagar (
      fornecedor_nome, descricao, valor_total, numero_parcela, total_parcelas,
      valor_parcela, data_vencimento, status, data_pagamento, valor_pago,
      prestador_id, criado_em, atualizado_em
    ) VALUES (
      'Kayke Santos', 'Fixo montador: Kayke Santos', 1900, 1, 1,
      1900, '2026-06-05', 'pago', '2026-06-05', 1900,
      v_prestador, NOW(), NOW()
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM movelaria_contas_pagar
    WHERE fornecedor_nome = 'Kayke Santos'
      AND data_vencimento = '2026-07-05'
      AND descricao ILIKE 'Fixo montador:%'
  ) THEN
    INSERT INTO movelaria_contas_pagar (
      fornecedor_nome, descricao, valor_total, numero_parcela, total_parcelas,
      valor_parcela, data_vencimento, status, data_pagamento, valor_pago,
      prestador_id, criado_em, atualizado_em
    ) VALUES (
      'Kayke Santos', 'Fixo montador: Kayke Santos', 2200, 1, 1,
      2200, '2026-07-05', 'pago', '2026-07-05', 2200,
      v_prestador, NOW(), NOW()
    );
  END IF;

  -- 6) Desativa destinatário errado
  UPDATE movelaria_caixa_destinatarios
  SET
    ativo = false,
    observacoes = COALESCE(observacoes || E'\n', '')
      || 'Inativado em 2026-07-31: unificado em Kayke Santos (migração 141).',
    atualizado_em = NOW()
  WHERE id = v_kaique;
END $$;

ALTER TABLE movelaria_contas_pagar ENABLE TRIGGER trg_movelaria_sync_pagamento_para_caixa;
ALTER TABLE movelaria_contas_pagar ENABLE TRIGGER trg_funcionario_recibo_ao_pagar_cp;

NOTIFY pgrst, 'reload schema';
