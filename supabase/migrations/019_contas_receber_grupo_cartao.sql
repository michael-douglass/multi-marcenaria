-- Adiciona grupo_id para agrupamento de cobranças manuais
ALTER TABLE movelaria_contas_receber
  ADD COLUMN IF NOT EXISTS grupo_id TEXT;

CREATE INDEX IF NOT EXISTS idx_mov_contas_receber_grupo_id
  ON movelaria_contas_receber(grupo_id);

-- Atualiza constraint de forma_pagamento para incluir 'cartao'
ALTER TABLE movelaria_contas_receber
  DROP CONSTRAINT IF EXISTS movelaria_contas_receber_forma_pagamento_check;

ALTER TABLE movelaria_contas_receber
  ADD CONSTRAINT movelaria_contas_receber_forma_pagamento_check
    CHECK (forma_pagamento IN ('pix', 'dinheiro', 'cheque', 'boleto', 'cartao'));
