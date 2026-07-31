-- ============================================================
-- GARBO Movelaria — Corrige contas sumidas / valor errado
-- Migration 138
--
-- Efeitos colaterais das migrações 134–136:
-- 1) Contas marcadas PAGO só porque valor_pago espelhava reserva
--    (sem pagamento real no Caixa) → voltam a PENDENTE
-- 2) Remove série lixo Contabilidade R$ 450 (duplicatas)
-- ============================================================

ALTER TABLE movelaria_contas_pagar DISABLE TRIGGER trg_movelaria_sync_pagamento_para_caixa;
ALTER TABLE movelaria_contas_pagar DISABLE TRIGGER trg_funcionario_recibo_ao_pagar_cp;

-- 1) Reabre contas operacionais marcadas pagas sem pagamento no Caixa
UPDATE movelaria_contas_pagar
SET
  status = 'pendente',
  valor_pago = 0,
  data_pagamento = NULL,
  atualizado_em = NOW()
WHERE id IN (
  '367ca21c-9e52-4628-9410-3fb2a1942f58', -- Aluguel - Aloísio 850
  '4bd93198-1ef4-4b7f-a075-d0ea2ed7bf32', -- Cartão Inter Michael 100
  '643e57f1-fe49-468c-b623-bac2548879aa', -- Consórcio 1398
  'ad222fd8-b1c7-4a04-94ac-7683f25ca91c', -- Contabilidade ago/2026 650
  '9dbbe271-24d7-4f76-9c87-6546f43924c1', -- Conta de água 100
  'f85b23db-b03e-45db-9cbe-d101d7915683', -- Conta de Luz 300
  '6a5c331d-9864-4bf2-b82d-b9a7c5d7ce14', -- Curso marketing 300
  'b56f60df-ac3c-4d50-bbb9-ea5b51c4c0a9', -- Formobile 800
  '885fde58-a0c1-4753-8b65-b2cf95413540', -- Internet 100
  '4345f528-248c-4df1-8e01-eab612ea0961', -- JR Fechamento jun 8805.40
  'ac48fcf9-5bdd-45a5-a253-f4ca08afe510', -- JR R1-0158026-2/5 728.53
  'bb772808-eeaf-44b2-b087-e5a870f04984'  -- Sistema banco de dados 400
);

-- 2) Remove Contabilidade fantasma R$ 450 (série duplicada criada em 31/07)
DELETE FROM movelaria_caixa_movimentacoes m
USING movelaria_contas_pagar cp
WHERE m.conta_pagar_id = cp.id
  AND cp.fornecedor_nome = 'Contabilidade'
  AND cp.recorrencia_id = '1630ba96-5651-4410-bf7c-1ff721f74d69';

DELETE FROM movelaria_contas_pagar
WHERE fornecedor_nome = 'Contabilidade'
  AND recorrencia_id = '1630ba96-5651-4410-bf7c-1ff721f74d69';

ALTER TABLE movelaria_contas_pagar ENABLE TRIGGER trg_movelaria_sync_pagamento_para_caixa;
ALTER TABLE movelaria_contas_pagar ENABLE TRIGGER trg_funcionario_recibo_ao_pagar_cp;

NOTIFY pgrst, 'reload schema';
