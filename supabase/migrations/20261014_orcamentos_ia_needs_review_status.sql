-- v12 Circuit Breaker: status NEEDS_REVIEW quando auditoria financeira/construtiva falha
ALTER TABLE public.quote_analyses
  DROP CONSTRAINT IF EXISTS quote_analyses_status_check;

ALTER TABLE public.quote_analyses
  ADD CONSTRAINT quote_analyses_status_check
  CHECK (
    status = ANY (
      ARRAY[
        'PENDING'::text,
        'PROCESSING'::text,
        'CONVERTING_PAGES'::text,
        'READING_LAYOUT'::text,
        'EXTRACTING_MODULES'::text,
        'FETCHING_MARKET_PRICES'::text,
        'AUDITING_REVISION'::text,
        'NEEDS_REVIEW'::text,
        'COMPLETED'::text,
        'FAILED'::text
      ]
    )
  );
