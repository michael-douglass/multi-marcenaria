-- Orçamentos IA — status PROCESSING (Fase 3) + Realtime já existente
ALTER TABLE public.quote_analyses
  DROP CONSTRAINT IF EXISTS quote_analyses_status_check;

ALTER TABLE public.quote_analyses
  ADD CONSTRAINT quote_analyses_status_check
  CHECK (status IN (
    'PENDING',
    'PROCESSING',
    'CONVERTING_PAGES',
    'READING_LAYOUT',
    'EXTRACTING_MODULES',
    'FETCHING_MARKET_PRICES',
    'AUDITING_REVISION',
    'COMPLETED',
    'FAILED'
  ));
