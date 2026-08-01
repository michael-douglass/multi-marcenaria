-- ============================================================
-- GARBO Movelaria — Remove contas pagas duplicadas
-- Migration 144
--
-- A expansão de recorrência rodou em paralelo e criou várias
-- cópias no mesmo vencimento (Bruno 5x, Deverson 6x, João 8x),
-- depois marcadas como pagas com reserva no Caixa.
--
-- 1) Mantém a conta mais antiga de cada grupo
-- 2) Apaga clones + movimentações de caixa ligadas
-- 3) Impede nova duplicata: UNIQUE (recorrencia_id, vencimento)
-- ============================================================

-- Contas pagas duplicadas (mesmo fornecedor/desc/venc/valor)
CREATE TEMP TABLE tmp_contas_pagas_duplicadas ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY
        COALESCE(fornecedor_nome, ''),
        COALESCE(descricao, ''),
        data_vencimento,
        valor_parcela
      ORDER BY criado_em ASC NULLS LAST, id ASC
    ) AS rn
  FROM movelaria_contas_pagar
  WHERE status = 'pago'
)
SELECT id
FROM ranked
WHERE rn > 1;

DELETE FROM movelaria_caixa_movimentacoes m
USING tmp_contas_pagas_duplicadas d
WHERE m.conta_pagar_id = d.id;

ALTER TABLE movelaria_contas_pagar DISABLE TRIGGER trg_movelaria_sync_pagamento_para_caixa;
ALTER TABLE movelaria_contas_pagar DISABLE TRIGGER trg_funcionario_recibo_ao_pagar_cp;

DELETE FROM movelaria_contas_pagar cp
USING tmp_contas_pagas_duplicadas d
WHERE cp.id = d.id;

ALTER TABLE movelaria_contas_pagar ENABLE TRIGGER trg_movelaria_sync_pagamento_para_caixa;
ALTER TABLE movelaria_contas_pagar ENABLE TRIGGER trg_funcionario_recibo_ao_pagar_cp;

-- Duplicatas restantes na mesma série/vencimento (qualquer status)
CREATE TEMP TABLE tmp_contas_recorr_duplicadas ON COMMIT DROP AS
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY recorrencia_id, data_vencimento
      ORDER BY criado_em ASC NULLS LAST, id ASC
    ) AS rn
  FROM movelaria_contas_pagar
  WHERE recorrencia_id IS NOT NULL
)
SELECT id FROM ranked WHERE rn > 1;

DELETE FROM movelaria_caixa_movimentacoes m
USING tmp_contas_recorr_duplicadas d
WHERE m.conta_pagar_id = d.id;

ALTER TABLE movelaria_contas_pagar DISABLE TRIGGER trg_movelaria_sync_pagamento_para_caixa;
ALTER TABLE movelaria_contas_pagar DISABLE TRIGGER trg_funcionario_recibo_ao_pagar_cp;

DELETE FROM movelaria_contas_pagar cp
USING tmp_contas_recorr_duplicadas d
WHERE cp.id = d.id;

ALTER TABLE movelaria_contas_pagar ENABLE TRIGGER trg_movelaria_sync_pagamento_para_caixa;
ALTER TABLE movelaria_contas_pagar ENABLE TRIGGER trg_funcionario_recibo_ao_pagar_cp;

CREATE UNIQUE INDEX IF NOT EXISTS uq_movelaria_contas_pagar_recorrencia_vencimento
  ON movelaria_contas_pagar (recorrencia_id, data_vencimento)
  WHERE recorrencia_id IS NOT NULL;
