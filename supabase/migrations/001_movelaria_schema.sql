-- ============================================================
-- GARBO Movelaria — Schema principal
-- Todas as tabelas utilizam o prefixo: movelaria_
-- ============================================================

-- ── Fornecedores ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_fornecedores (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome         TEXT        NOT NULL,
  cnpj_cpf     TEXT,
  telefone     TEXT,
  email        TEXT,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Produtos ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_produtos (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id   UUID REFERENCES movelaria_fornecedores(id) ON DELETE SET NULL,
  descricao       TEXT           NOT NULL,
  unidade_medida  TEXT           NOT NULL DEFAULT 'unidade',
  especificacoes  TEXT,
  preco_unitario  NUMERIC(12, 2) NOT NULL DEFAULT 0,
  criado_em       TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  atualizado_em   TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── Pedidos de Compra ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_pedidos (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fornecedor_id UUID REFERENCES movelaria_fornecedores(id) ON DELETE SET NULL,
  status        TEXT           NOT NULL DEFAULT 'aguardando_aprovacao'
                  CHECK (status IN ('aguardando_aprovacao', 'aprovado', 'recusado')),
  total         NUMERIC(12, 2) NOT NULL DEFAULT 0,
  data_pedido   DATE           NOT NULL DEFAULT CURRENT_DATE,
  criado_em     TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── Itens do Pedido ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_pedidos_itens (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id      UUID           NOT NULL REFERENCES movelaria_pedidos(id) ON DELETE CASCADE,
  produto_id     UUID           REFERENCES movelaria_produtos(id) ON DELETE SET NULL,
  quantidade     NUMERIC(12, 3) NOT NULL,
  valor_unitario NUMERIC(12, 2) NOT NULL,
  valor_total    NUMERIC(12, 2) NOT NULL,
  criado_em      TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── Contas a Pagar ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_contas_pagar (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id        UUID           REFERENCES movelaria_pedidos(id) ON DELETE SET NULL,
  fornecedor_id    UUID           REFERENCES movelaria_fornecedores(id) ON DELETE SET NULL,
  fornecedor_nome  TEXT,
  descricao        TEXT,
  valor_total      NUMERIC(12, 2),
  numero_parcela   INTEGER        NOT NULL,
  total_parcelas   INTEGER        NOT NULL,
  valor_parcela    NUMERIC(12, 2) NOT NULL,
  data_vencimento  DATE           NOT NULL,
  status           TEXT           NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente', 'pago')),
  data_pagamento   DATE,
  criado_em        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── Clientes ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_clientes (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome          TEXT        NOT NULL,
  cpf           TEXT,
  telefone      TEXT,
  endereco      TEXT,
  criado_em     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Contas a Receber ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_contas_receber (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id       UUID           REFERENCES movelaria_clientes(id) ON DELETE SET NULL,
  cliente_nome     TEXT,
  valor_total      NUMERIC(12, 2),
  numero_parcela   INTEGER        NOT NULL,
  total_parcelas   INTEGER        NOT NULL,
  valor_parcela    NUMERIC(12, 2) NOT NULL,
  data_vencimento  DATE           NOT NULL,
  forma_pagamento  TEXT           NOT NULL DEFAULT 'pix'
                     CHECK (forma_pagamento IN ('pix', 'dinheiro', 'cheque', 'boleto')),
  status           TEXT           NOT NULL DEFAULT 'pendente'
                     CHECK (status IN ('pendente', 'recebido')),
  data_recebimento DATE,
  criado_em        TIMESTAMPTZ    NOT NULL DEFAULT NOW(),
  atualizado_em    TIMESTAMPTZ    NOT NULL DEFAULT NOW()
);

-- ── Índices ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_mov_produtos_fornecedor    ON movelaria_produtos(fornecedor_id);
CREATE INDEX IF NOT EXISTS idx_mov_pedidos_status         ON movelaria_pedidos(status);
CREATE INDEX IF NOT EXISTS idx_mov_pedidos_itens_pedido   ON movelaria_pedidos_itens(pedido_id);
CREATE INDEX IF NOT EXISTS idx_mov_contas_pagar_status    ON movelaria_contas_pagar(status);
CREATE INDEX IF NOT EXISTS idx_mov_contas_pagar_venc      ON movelaria_contas_pagar(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_mov_contas_receber_status  ON movelaria_contas_receber(status);
CREATE INDEX IF NOT EXISTS idx_mov_contas_receber_venc    ON movelaria_contas_receber(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_mov_contas_receber_cliente ON movelaria_contas_receber(cliente_id);

-- ── RLS (Row Level Security) ──────────────────────────────────
ALTER TABLE movelaria_fornecedores  ENABLE ROW LEVEL SECURITY;
ALTER TABLE movelaria_produtos      ENABLE ROW LEVEL SECURITY;
ALTER TABLE movelaria_pedidos       ENABLE ROW LEVEL SECURITY;
ALTER TABLE movelaria_pedidos_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE movelaria_contas_pagar  ENABLE ROW LEVEL SECURITY;
ALTER TABLE movelaria_clientes      ENABLE ROW LEVEL SECURITY;
ALTER TABLE movelaria_contas_receber ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas (anon + authenticated) para fase de desenvolvimento
-- DROP antes para evitar erro em re-execução
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'movelaria_fornecedores','movelaria_produtos','movelaria_pedidos',
    'movelaria_pedidos_itens','movelaria_contas_pagar',
    'movelaria_clientes','movelaria_contas_receber'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    -- Remove política anterior se existir
    EXECUTE format('DROP POLICY IF EXISTS "allow_all_%s" ON %I', t, t);
    -- Cria política permissiva
    EXECUTE format(
      'CREATE POLICY "allow_all_%s" ON %I FOR ALL TO anon, authenticated USING (true) WITH CHECK (true)',
      t, t
    );
  END LOOP;
END $$;
