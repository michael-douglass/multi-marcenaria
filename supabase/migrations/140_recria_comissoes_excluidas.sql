-- ============================================================
-- GARBO Movelaria — Recria comissões excluídas
-- Migration 140
--
-- Contas de Comissão (Bruno Henrique e João Pedro Braga) foram
-- apagadas, mas os itens de obra continuam. Recria Contas a Pagar
-- pendentes no mesmo padrão das comissões restantes (Kayke / Paulo).
-- NÃO cria reserva no Caixa.
-- ============================================================

ALTER TABLE movelaria_contas_pagar DISABLE TRIGGER trg_movelaria_sync_pagamento_para_caixa;
ALTER TABLE movelaria_contas_pagar DISABLE TRIGGER trg_funcionario_recibo_ao_pagar_cp;
ALTER TABLE movelaria_contas_pagar DISABLE TRIGGER trg_movelaria_sync_comissao_gerada_caixa;

INSERT INTO movelaria_contas_pagar (
  prestador_id,
  obra_id,
  fornecedor_nome,
  descricao,
  observacao,
  valor_total,
  numero_parcela,
  total_parcelas,
  valor_parcela,
  valor_pago,
  data_vencimento,
  status
)
SELECT
  ci.prestador_id,
  ci.obra_id,
  'Comissão: ' || COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1)),
  COALESCE(NULLIF(TRIM(o.cliente_nome), ''), 'Obra'),
  NULL,
  ci.valor,
  1,
  1,
  ci.valor,
  0,
  COALESCE(
    (
      SELECT MIN(cp.data_vencimento)
      FROM movelaria_contas_pagar cp
      WHERE cp.obra_id = ci.obra_id
        AND cp.fornecedor_nome LIKE 'Comissão:%'
    ),
    date_trunc('month', (o.finalizado_em AT TIME ZONE 'America/Sao_Paulo')::DATE)
      + INTERVAL '1 month' - INTERVAL '1 day'
  )::DATE,
  'pendente'
FROM movelaria_obra_comissao_itens ci
JOIN movelaria_obras o ON o.id = ci.obra_id
JOIN movelaria_usuarios u ON u.id = ci.prestador_id
WHERE ci.valor > 0
  AND COALESCE(o.comissao_habilitada, false) = true
  AND COALESCE(o.comissao_gerada, false) = true
  AND NOT EXISTS (
    SELECT 1
    FROM movelaria_contas_pagar cp
    WHERE cp.obra_id = ci.obra_id
      AND cp.prestador_id = ci.prestador_id
      AND cp.fornecedor_nome LIKE 'Comissão:%'
  );

-- Garante destinatários no Caixa (sem movimentação/reserva)
INSERT INTO movelaria_caixa_destinatarios (nome, tipo, ativo)
SELECT DISTINCT
  'Comissão: ' || COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1)),
  'marceneiro',
  true
FROM movelaria_obra_comissao_itens ci
JOIN movelaria_usuarios u ON u.id = ci.prestador_id
WHERE ci.valor > 0
  AND u.nome IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM movelaria_caixa_destinatarios d
    WHERE lower(trim(d.nome)) = lower(trim(
      'Comissão: ' || COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1))
    ))
  );

ALTER TABLE movelaria_contas_pagar ENABLE TRIGGER trg_movelaria_sync_pagamento_para_caixa;
ALTER TABLE movelaria_contas_pagar ENABLE TRIGGER trg_funcionario_recibo_ao_pagar_cp;
ALTER TABLE movelaria_contas_pagar ENABLE TRIGGER trg_movelaria_sync_comissao_gerada_caixa;

NOTIFY pgrst, 'reload schema';
