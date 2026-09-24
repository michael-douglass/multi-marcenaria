-- Orçamentos IA: módulos fora do escopo de marcenaria (pedra, alvenaria, decoração).
-- Listados à parte no Audit Workspace e excluídos do custo.
ALTER TABLE public.quote_modules
  ADD COLUMN IF NOT EXISTS out_of_scope boolean NOT NULL DEFAULT false;
