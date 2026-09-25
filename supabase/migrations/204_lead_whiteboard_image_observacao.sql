-- Notas/observações por foto na lousa do lead (CRM).
-- Espelha o comportamento da Lousa da Obra (observacao ao lado da imagem).

ALTER TABLE emp_garbo.lead_whiteboard_images
  ADD COLUMN IF NOT EXISTS observacao TEXT;

COMMENT ON COLUMN emp_garbo.lead_whiteboard_images.observacao IS
  'Nota textual vinculada à foto da lousa — exibida ao lado da imagem.';

ALTER TABLE public.crm_multiempresas_lead_whiteboard_images
  ADD COLUMN IF NOT EXISTS observacao TEXT;

DO $$
DECLARE
  v_schema text;
BEGIN
  FOR v_schema IN
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name LIKE 'emp\_%' ESCAPE '\'
      AND schema_name <> 'emp_garbo'
  LOOP
    IF to_regclass(format('%I.lead_whiteboard_images', v_schema)) IS NOT NULL THEN
      EXECUTE format(
        'ALTER TABLE %I.lead_whiteboard_images
           ADD COLUMN IF NOT EXISTS observacao TEXT',
        v_schema
      );
    END IF;
  END LOOP;
END $$;
