-- Formas de pagamento configuráveis (Contas a Pagar)

CREATE TABLE IF NOT EXISTS movelaria_formas_pagamento_pagar (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome       TEXT        NOT NULL,
  ordem      INTEGER     NOT NULL DEFAULT 0,
  ativo      BOOLEAN     NOT NULL DEFAULT true,
  criado_em  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_forma_pagar_nome UNIQUE (nome)
);

ALTER TABLE movelaria_contas_pagar
  ADD COLUMN IF NOT EXISTS forma_pagamento_id UUID
    REFERENCES movelaria_formas_pagamento_pagar(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_mov_contas_pagar_forma
  ON movelaria_contas_pagar(forma_pagamento_id);

-- Padrões iniciais
INSERT INTO movelaria_formas_pagamento_pagar (nome, ordem) VALUES
  ('Pix', 1),
  ('Boleto', 2),
  ('Cheque', 3),
  ('Cheque de cliente', 4)
ON CONFLICT (nome) DO NOTHING;

ALTER TABLE movelaria_formas_pagamento_pagar ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "formas_pagar_select" ON movelaria_formas_pagamento_pagar;
CREATE POLICY "formas_pagar_select" ON movelaria_formas_pagamento_pagar
  FOR SELECT TO authenticated
  USING (movelaria_meu_perfil() IS NOT NULL);

DROP POLICY IF EXISTS "formas_pagar_insert" ON movelaria_formas_pagamento_pagar;
CREATE POLICY "formas_pagar_insert" ON movelaria_formas_pagamento_pagar
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

DROP POLICY IF EXISTS "formas_pagar_update" ON movelaria_formas_pagamento_pagar;
CREATE POLICY "formas_pagar_update" ON movelaria_formas_pagamento_pagar
  FOR UPDATE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro'))
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

DROP POLICY IF EXISTS "formas_pagar_delete" ON movelaria_formas_pagamento_pagar;
CREATE POLICY "formas_pagar_delete" ON movelaria_formas_pagamento_pagar
  FOR DELETE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro'));
