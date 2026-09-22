-- ============================================================
-- Orçamentos IA (PRD v8 / Planilha 4.0 Premium) — Fase 1
-- Extensão pgvector, tabelas do módulo, RPC RAG, RLS e seeds.
-- company_id referencia o ID da empresa CRM (sem tabela companies).
-- ============================================================

-- 1) Extensão de busca vetorial (OpenAI text-embedding-3-small = 1536 dims)
CREATE EXTENSION IF NOT EXISTS vector;

-- ------------------------------------------------------------
-- 2) Configurações construtivas (Central de Informações 4.0)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.company_standards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL UNIQUE,
  box_thickness text NOT NULL DEFAULT '15mm',
  back_panel_thickness text NOT NULL DEFAULT '6mm',
  assembly_method text NOT NULL DEFAULT 'minifix_cavilha',
  bottom_fixing text NOT NULL DEFAULT 'rebaixo',
  tamponamento_rule text NOT NULL DEFAULT 'empresa_25mm',
  door_handle_discount_mm integer NOT NULL DEFAULT 35,
  handle_bar_length_m numeric(3, 1) NOT NULL DEFAULT 3.0,
  constructive_method text NOT NULL DEFAULT 'metodo_a',
  shelf_support text NOT NULL DEFAULT 'suporte_2_furos',
  wall_fixing text NOT NULL DEFAULT 'cantoneira_3_furos',
  drawer_slide text NOT NULL DEFAULT 'telescopica_450_45kg',
  scope_rules jsonb NOT NULL DEFAULT '{"led":"incluir","serralheria":"nao_faz","pedras":"nao_faz"}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS company_standards_company_id_idx
  ON public.company_standards (company_id);

-- ------------------------------------------------------------
-- 3) Cadastro de estoque / insumos (de-para + preços internos)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid,
  category text NOT NULL,
  name text NOT NULL,
  sku text,
  unit text NOT NULL DEFAULT 'un',
  unit_price numeric(10, 2),
  price_per_m2 numeric(10, 2),
  price_per_sheet numeric(10, 2),
  sheet_area_m2 numeric(8, 3),
  thickness_mm numeric(6, 2),
  width_mm numeric(8, 2),
  length_mm numeric(8, 2),
  loss_pct numeric(5, 2) DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT inventory_items_category_check CHECK (
    category IN (
      'chapa',
      'fita_borda',
      'ferragem',
      'puxador',
      'consumivel',
      'servico',
      'mao_obra',
      'outro'
    )
  )
);

CREATE INDEX IF NOT EXISTS inventory_items_category_idx
  ON public.inventory_items (category);
CREATE INDEX IF NOT EXISTS inventory_items_company_id_idx
  ON public.inventory_items (company_id);
CREATE INDEX IF NOT EXISTS inventory_items_name_idx
  ON public.inventory_items (name);

-- ------------------------------------------------------------
-- 4) Preços de referência de mercado (fallback)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.market_reference_prices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  item_pattern text NOT NULL,
  unit text NOT NULL DEFAULT 'un',
  estimated_market_price numeric(10, 2) NOT NULL,
  notes text,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT market_reference_prices_category_check CHECK (
    category IN (
      'chapa',
      'fita_borda',
      'ferragem',
      'puxador',
      'consumivel',
      'servico',
      'mao_obra',
      'outro'
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS market_reference_prices_pattern_uidx
  ON public.market_reference_prices (category, item_pattern);

-- ------------------------------------------------------------
-- 5) Memória dinâmica / aprendizado por correção (RAG)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.ai_memories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  category text NOT NULL,
  user_instruction text NOT NULL,
  embedding vector(1536) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ai_memories_company_id_idx
  ON public.ai_memories (company_id);

-- IVFFlat exige dados para treinar listas; em tabela vazia a criação falha.
-- Cria quando possível; se ainda não houver linhas, a busca RAG usa scan sequencial
-- até uma migration futura recriar o índice (ou rode o bloco abaixo após as primeiras memórias).
DO $$
BEGIN
  CREATE INDEX IF NOT EXISTS ai_memories_embedding_ivfflat_idx
    ON public.ai_memories
    USING ivfflat (embedding vector_cosine_ops)
    WITH (lists = 100);
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Índice ivfflat em ai_memories adiado (normal sem embeddings ainda): %', SQLERRM;
END $$;

-- ------------------------------------------------------------
-- 6) Orçamento / análise assíncrona
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.quote_analyses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL,
  mode text NOT NULL DEFAULT 'max',
  status text NOT NULL DEFAULT 'PENDING',
  source_pdf_path text,
  error_message text,
  pricing_modality text,
  pricing_params jsonb NOT NULL DEFAULT '{}'::jsonb,
  totals jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT quote_analyses_status_check CHECK (
    status IN (
      'PENDING',
      'CONVERTING_PAGES',
      'READING_LAYOUT',
      'EXTRACTING_MODULES',
      'FETCHING_MARKET_PRICES',
      'AUDITING_REVISION',
      'COMPLETED',
      'FAILED'
    )
  ),
  CONSTRAINT quote_analyses_mode_check CHECK (mode IN ('fast', 'max'))
);

CREATE INDEX IF NOT EXISTS quote_analyses_company_id_idx
  ON public.quote_analyses (company_id);
CREATE INDEX IF NOT EXISTS quote_analyses_status_idx
  ON public.quote_analyses (status);

CREATE TABLE IF NOT EXISTS public.quote_environments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analysis_id uuid NOT NULL REFERENCES public.quote_analyses (id) ON DELETE CASCADE,
  name text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_environments_analysis_id_idx
  ON public.quote_environments (analysis_id);

CREATE TABLE IF NOT EXISTS public.quote_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  environment_id uuid NOT NULL REFERENCES public.quote_environments (id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  dimensions jsonb NOT NULL DEFAULT '{}'::jsonb,
  bounding_box jsonb,
  page_number integer,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_modules_environment_id_idx
  ON public.quote_modules (environment_id);

CREATE TABLE IF NOT EXISTS public.quote_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id uuid NOT NULL REFERENCES public.quote_modules (id) ON DELETE CASCADE,
  raw_name text NOT NULL,
  category text NOT NULL,
  system_material_id uuid REFERENCES public.inventory_items (id) ON DELETE SET NULL,
  using_market_price boolean NOT NULL DEFAULT false,
  market_price_confirmed boolean NOT NULL DEFAULT false,
  unit_price numeric(10, 2) NOT NULL DEFAULT 0,
  exact_quantity numeric(12, 3) NOT NULL DEFAULT 0,
  full_units_quantity integer NOT NULL DEFAULT 0,
  unit_measure text NOT NULL DEFAULT 'un',
  bounding_box jsonb,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS quote_materials_module_id_idx
  ON public.quote_materials (module_id);
CREATE INDEX IF NOT EXISTS quote_materials_system_material_id_idx
  ON public.quote_materials (system_material_id);

-- ------------------------------------------------------------
-- 7) RPC — busca semântica de memórias (RAG)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.match_ai_memories (
  query_embedding vector(1536),
  filter_company_id uuid,
  match_threshold float DEFAULT 0.7,
  match_count int DEFAULT 10
)
RETURNS TABLE (
  id uuid,
  category text,
  user_instruction text,
  similarity float
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    ai_memories.id,
    ai_memories.category,
    ai_memories.user_instruction,
    (1 - (ai_memories.embedding <=> query_embedding))::float AS similarity
  FROM public.ai_memories
  WHERE ai_memories.company_id = filter_company_id
    AND 1 - (ai_memories.embedding <=> query_embedding) > match_threshold
  ORDER BY ai_memories.embedding <=> query_embedding
  LIMIT match_count;
$$;

GRANT EXECUTE ON FUNCTION public.match_ai_memories (vector, uuid, float, int) TO authenticated;
GRANT EXECUTE ON FUNCTION public.match_ai_memories (vector, uuid, float, int) TO service_role;

-- ------------------------------------------------------------
-- 8) RLS permissiva (tenant filtrado na aplicação via company_id)
-- ------------------------------------------------------------
ALTER TABLE public.company_standards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.market_reference_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_memories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_environments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_modules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.quote_materials ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS orcamentos_ia_company_standards_auth_all ON public.company_standards;
CREATE POLICY orcamentos_ia_company_standards_auth_all
  ON public.company_standards
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS orcamentos_ia_inventory_items_auth_all ON public.inventory_items;
CREATE POLICY orcamentos_ia_inventory_items_auth_all
  ON public.inventory_items
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS orcamentos_ia_market_reference_prices_auth_all ON public.market_reference_prices;
CREATE POLICY orcamentos_ia_market_reference_prices_auth_all
  ON public.market_reference_prices
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS orcamentos_ia_ai_memories_auth_all ON public.ai_memories;
CREATE POLICY orcamentos_ia_ai_memories_auth_all
  ON public.ai_memories
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS orcamentos_ia_quote_analyses_auth_all ON public.quote_analyses;
CREATE POLICY orcamentos_ia_quote_analyses_auth_all
  ON public.quote_analyses
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS orcamentos_ia_quote_environments_auth_all ON public.quote_environments;
CREATE POLICY orcamentos_ia_quote_environments_auth_all
  ON public.quote_environments
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS orcamentos_ia_quote_modules_auth_all ON public.quote_modules;
CREATE POLICY orcamentos_ia_quote_modules_auth_all
  ON public.quote_modules
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS orcamentos_ia_quote_materials_auth_all ON public.quote_materials;
CREATE POLICY orcamentos_ia_quote_materials_auth_all
  ON public.quote_materials
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_standards TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.inventory_items TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.market_reference_prices TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_memories TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_analyses TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_environments TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_modules TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quote_materials TO authenticated;

GRANT ALL ON public.company_standards TO service_role;
GRANT ALL ON public.inventory_items TO service_role;
GRANT ALL ON public.market_reference_prices TO service_role;
GRANT ALL ON public.ai_memories TO service_role;
GRANT ALL ON public.quote_analyses TO service_role;
GRANT ALL ON public.quote_environments TO service_role;
GRANT ALL ON public.quote_modules TO service_role;
GRANT ALL ON public.quote_materials TO service_role;

-- ------------------------------------------------------------
-- 9) SEED — inventory_items (Planilha 4.0 Premium)
-- company_id NULL = catálogo global compartilhado
-- ------------------------------------------------------------
INSERT INTO public.inventory_items (
  category, name, sku, unit,
  unit_price, price_per_m2, price_per_sheet, sheet_area_m2,
  thickness_mm, width_mm, length_mm, loss_pct, metadata
)
VALUES
  -- Chapas MDF (área padrão ~2,75 m × 1,84 m = 5,06 m²)
  (
    'chapa', 'MDF Branco TX 15mm', 'CHAPA-MDF-BTX-15', 'chapa',
    NULL, 78.50, 397.21, 5.060,
    15, 2750, 1840, 20,
    '{"acabamento":"TX","cor":"branco","fonte":"Planilha 4.0 Cad. chapas e bordas"}'::jsonb
  ),
  (
    'chapa', 'MDF Branco TX 6mm (fundo)', 'CHAPA-MDF-BTX-06', 'chapa',
    NULL, 52.00, 263.12, 5.060,
    6, 2750, 1840, 20,
    '{"acabamento":"TX","cor":"branco","uso":"fundo","fonte":"Planilha 4.0 Cad. chapas e bordas"}'::jsonb
  ),
  (
    'chapa', 'MDF Louro Freijó 15mm', 'CHAPA-MDF-FREIJO-15', 'chapa',
    NULL, 112.00, 566.72, 5.060,
    15, 2750, 1840, 20,
    '{"acabamento":"madeirado","padrao":"Louro Freijo","fonte":"Planilha 4.0 Cad. chapas e bordas"}'::jsonb
  ),
  (
    'chapa', 'MDF Toronto 15mm', 'CHAPA-MDF-TORONTO-15', 'chapa',
    NULL, 105.00, 531.30, 5.060,
    15, 2750, 1840, 20,
    '{"acabamento":"madeirado","padrao":"Toronto","fonte":"Planilha 4.0 Cad. chapas e bordas"}'::jsonb
  ),

  -- Fitas de borda (preço por metro linear; unit_price = R$/m)
  (
    'fita_borda', 'Fita de Borda Branco TX 22mm', 'FITAB-BTX-22', 'm',
    1.85, NULL, NULL, NULL,
    NULL, 22, NULL, 15,
    '{"altura_mm":22,"cor":"branco TX","fonte":"Planilha 4.0 Cad. chapas e bordas"}'::jsonb
  ),
  (
    'fita_borda', 'Fita de Borda Aço Corten 22mm', 'FITAB-CORTEN-22', 'm',
    3.40, NULL, NULL, NULL,
    NULL, 22, NULL, 15,
    '{"altura_mm":22,"cor":"aco corten","fonte":"Planilha 4.0 Cad. chapas e bordas"}'::jsonb
  ),
  (
    'fita_borda', 'Fita de Borda Carvalho Avelã 22mm', 'FITAB-CARV-AVELA-22', 'm',
    2.90, NULL, NULL, NULL,
    NULL, 22, NULL, 15,
    '{"altura_mm":22,"cor":"carvalho avela","fonte":"Planilha 4.0 Cad. chapas e bordas"}'::jsonb
  ),

  -- Ferragens e acessórios — ESTRITAMENTE por unidade
  (
    'ferragem', 'Dobradiça com amortecedor', 'FERR-DOB-AMORT', 'un',
    8.90, NULL, NULL, NULL,
    NULL, NULL, NULL, 0,
    '{"regra_unidade":"individual","fonte":"Planilha 4.0 Cad. Acessorios"}'::jsonb
  ),
  (
    'ferragem', 'Corrediça Telescópica 450mm 45kg HF', 'FERR-CORR-TEL-450-45', 'un',
    28.50, NULL, NULL, NULL,
    NULL, NULL, 450, 0,
    '{"capacidade_kg":45,"regra_unidade":"par_conta_como_un_no_cadastro","fonte":"Planilha 4.0 Cad. Acessorios"}'::jsonb
  ),
  (
    'ferragem', 'Minifix (conjunto)', 'FERR-MINIFIX', 'un',
    1.20, NULL, NULL, NULL,
    NULL, NULL, NULL, 0,
    '{"regra_unidade":"individual","fonte":"Planilha 4.0 Cad. Acessorios"}'::jsonb
  ),
  (
    'ferragem', 'VB35', 'FERR-VB35', 'un',
    0.95, NULL, NULL, NULL,
    NULL, NULL, NULL, 0,
    '{"regra_unidade":"individual","fonte":"Planilha 4.0 Cad. Acessorios"}'::jsonb
  ),
  (
    'ferragem', 'Cantoneira 3 furos', 'FERR-CANT-3F', 'un',
    2.40, NULL, NULL, NULL,
    NULL, NULL, NULL, 0,
    '{"furos":3,"regra_unidade":"individual","fonte":"Planilha 4.0 Cad. Acessorios"}'::jsonb
  ),
  (
    'ferragem', 'Parafuso 40x4', 'FERR-PARAF-40X4', 'un',
    0.12, NULL, NULL, NULL,
    NULL, NULL, NULL, 0,
    '{"regra_unidade":"individual","fonte":"Planilha 4.0 Cad. Acessorios"}'::jsonb
  ),
  (
    'consumivel', 'Cola Granulada 1kg', 'CONS-COLA-GRAN-1KG', 'un',
    42.00, NULL, NULL, NULL,
    NULL, NULL, NULL, 0,
    '{"embalagem":"1kg","regra_unidade":"embalagem_individual","fonte":"Planilha 4.0 Cad. Acessorios"}'::jsonb
  ),

  -- Puxadores perfil — barra de 3m (nunca 6m) + referência de tampinha
  (
    'puxador', 'Puxador Perfil 3m Champanhe', 'PUX-PERF-3M-CHAMP', 'barra',
    68.00, NULL, NULL, NULL,
    NULL, NULL, 3000, 0,
    '{"barra_m":3,"cor":"champanhe","tampinha_lateral":true,"fonte":"Planilha 4.0 Central / Cad. Acessorios"}'::jsonb
  ),
  (
    'puxador', 'Puxador Perfil 3m Preto', 'PUX-PERF-3M-PRETO', 'barra',
    72.00, NULL, NULL, NULL,
    NULL, NULL, 3000, 0,
    '{"barra_m":3,"cor":"preto","tampinha_lateral":true,"fonte":"Planilha 4.0 Central / Cad. Acessorios"}'::jsonb
  ),
  (
    'puxador', 'Tampinha lateral puxador perfil', 'PUX-TAMP-LAT', 'un',
    1.50, NULL, NULL, NULL,
    NULL, NULL, NULL, 0,
    '{"uso":"acabamento_extremidade_barra","regra_unidade":"individual","fonte":"Planilha 4.0"}'::jsonb
  );

-- Evita duplicar seeds globais se a migration for reaplicada manualmente
DELETE FROM public.inventory_items a
USING public.inventory_items b
WHERE a.company_id IS NULL
  AND b.company_id IS NULL
  AND a.sku IS NOT NULL
  AND a.sku = b.sku
  AND a.ctid < b.ctid;

-- ------------------------------------------------------------
-- 10) SEED — market_reference_prices (fallback de mercado)
-- ------------------------------------------------------------
INSERT INTO public.market_reference_prices (category, item_pattern, unit, estimated_market_price, notes)
VALUES
  ('chapa', 'MDF Branco TX 15mm', 'm2', 85.00, 'Referência mercado / m² — Planilha 4.0'),
  ('chapa', 'MDF Branco TX 6mm', 'm2', 58.00, 'Fundo — referência mercado / m²'),
  ('chapa', 'MDF Louro Freijó 15mm', 'm2', 125.00, 'Madeirado premium — referência mercado / m²'),
  ('chapa', 'MDF Toronto 15mm', 'm2', 118.00, 'Madeirado — referência mercado / m²'),
  ('chapa', 'MDF Branco TX 15mm chapa inteira', 'chapa', 430.00, 'Chapa 2750x1840 — fallback compra'),
  ('fita_borda', 'Fita de Borda Branco TX 22mm', 'm', 2.20, 'Referência mercado / metro linear'),
  ('fita_borda', 'Fita de Borda Aço Corten 22mm', 'm', 3.90, 'Referência mercado / metro linear'),
  ('fita_borda', 'Fita de Borda Carvalho Avelã 22mm', 'm', 3.30, 'Referência mercado / metro linear'),
  ('ferragem', 'Dobradiça com amortecedor', 'un', 9.80, 'Preço unitário — nunca por caixa'),
  ('ferragem', 'Corrediça Telescópica 450mm 45kg', 'un', 32.00, 'Preço unitário HF'),
  ('ferragem', 'Minifix', 'un', 1.45, 'Conjunto unitário'),
  ('ferragem', 'VB35', 'un', 1.10, 'Unidade individual'),
  ('ferragem', 'Cantoneira 3 furos', 'un', 2.90, 'Unidade individual'),
  ('ferragem', 'Parafuso 40x4', 'un', 0.18, 'Unidade individual'),
  ('consumivel', 'Cola Granulada 1kg', 'un', 48.00, 'Embalagem 1kg'),
  ('puxador', 'Puxador Perfil 3m Champanhe', 'barra', 78.00, 'Barra estrita de 3m'),
  ('puxador', 'Puxador Perfil 3m Preto', 'barra', 82.00, 'Barra estrita de 3m'),
  ('puxador', 'Tampinha lateral puxador perfil', 'un', 1.80, 'Por extremidade da barra')
ON CONFLICT (category, item_pattern) DO UPDATE
SET
  unit = EXCLUDED.unit,
  estimated_market_price = EXCLUDED.estimated_market_price,
  notes = EXCLUDED.notes,
  updated_at = now();
