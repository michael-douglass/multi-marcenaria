-- ============================================================
-- Markup IA — Epic 3 (prd-markup-ia-composicao-visual.md):
-- regras construtivas editáveis (chapa, dobradiça, corrediça, perdas)
-- + dimensões físicas no catálogo, para o motor de cálculo determinístico.
-- Schema emp_garbo (mesmo padrão de markup_config/markup_produtos).
-- ============================================================

CREATE TABLE IF NOT EXISTS emp_garbo.markup_regras_construtivas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_movel TEXT NOT NULL,
  espessura_corpo_mm NUMERIC NOT NULL DEFAULT 15,
  espessura_porta_mm NUMERIC NOT NULL DEFAULT 18,
  espessura_fundo_mm NUMERIC NOT NULL DEFAULT 6,
  rebaixo_fundo_mm NUMERIC NOT NULL DEFAULT 10,
  -- Faixas de altura de porta (mm) → quantidade de dobradiças. Ordem crescente,
  -- altura_max_mm null = "sem limite" (última faixa). Direto da seção 4.1 do
  -- documento de referência do usuário (docs/sistemadeprecificacaocomia.md).
  regra_dobradicas JSONB NOT NULL DEFAULT '[
    {"altura_max_mm": 1000, "qtd": 2},
    {"altura_max_mm": 1600, "qtd": 3},
    {"altura_max_mm": 2200, "qtd": 4},
    {"altura_max_mm": null, "qtd": 5}
  ]'::JSONB,
  folga_corredica_mm NUMERIC NOT NULL DEFAULT 50,
  folga_puxador_mm NUMERIC NOT NULL DEFAULT 20,
  perda_chapa_pct NUMERIC NOT NULL DEFAULT 20,
  perda_fita_borda_pct NUMERIC NOT NULL DEFAULT 15,
  area_chapa_padrao_m2 NUMERIC NOT NULL DEFAULT 5.06,
  ordem INTEGER NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  atualizado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS markup_regras_construtivas_tipo_movel_key
  ON emp_garbo.markup_regras_construtivas (tipo_movel)
  WHERE ativo;

ALTER TABLE emp_garbo.markup_regras_construtivas ENABLE ROW LEVEL SECURITY;

-- Mesma política das tabelas-irmãs (markup_config/markup_categorias/markup_produtos):
-- controle de acesso ao módulo markup fica na aplicação, não em RLS por papel.
DROP POLICY IF EXISTS auth_all_markup_regras_construtivas ON emp_garbo.markup_regras_construtivas;
CREATE POLICY auth_all_markup_regras_construtivas ON emp_garbo.markup_regras_construtivas
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON emp_garbo.markup_regras_construtivas TO authenticated;

-- Dimensões físicas do produto de catálogo — necessário pro motor de cálculo saber
-- quantas chapas inteiras cabem numa peça (área da chapa padrão / área de corte).
-- Nullable: produto sem dimensão continua funcionando como hoje (preço por unidade),
-- só não participa do cálculo de "chapas inteiras" do Epic 3.
ALTER TABLE emp_garbo.markup_produtos
  ADD COLUMN IF NOT EXISTS espessura_mm NUMERIC,
  ADD COLUMN IF NOT EXISTS largura_mm NUMERIC,
  ADD COLUMN IF NOT EXISTS comprimento_mm NUMERIC;
