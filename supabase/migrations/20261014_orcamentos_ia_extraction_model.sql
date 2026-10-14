-- Seletor dinâmico de modelo de visão/extração por análise (custo LLM).
ALTER TABLE public.quote_analyses
  ADD COLUMN IF NOT EXISTS extraction_model text NOT NULL DEFAULT 'claude-sonnet';

ALTER TABLE public.quote_analyses
  DROP CONSTRAINT IF EXISTS quote_analyses_extraction_model_check;

ALTER TABLE public.quote_analyses
  ADD CONSTRAINT quote_analyses_extraction_model_check
  CHECK (extraction_model IN ('claude-sonnet', 'claude-opus', 'gpt-4o'));

COMMENT ON COLUMN public.quote_analyses.extraction_model IS
  'Modelo de visão/extração: claude-sonnet (default econômico), claude-opus, gpt-4o';
