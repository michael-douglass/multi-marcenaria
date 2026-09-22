-- Referência visual: path da página PNG no Storage para cada material
ALTER TABLE public.quote_materials
  ADD COLUMN IF NOT EXISTS page_image_path text;

ALTER TABLE public.quote_modules
  ADD COLUMN IF NOT EXISTS page_image_path text;

CREATE INDEX IF NOT EXISTS quote_materials_page_image_path_idx
  ON public.quote_materials (page_image_path)
  WHERE page_image_path IS NOT NULL;
