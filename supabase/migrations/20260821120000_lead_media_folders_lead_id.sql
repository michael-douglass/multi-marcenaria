-- Pastas de mídia por lead (ambientes, anexos da lousa, biblioteca)
-- lead_id nulo = pasta geral da biblioteca da empresa

DO $$
DECLARE
  rec record;
BEGIN
  FOR rec IN
    SELECT table_schema, table_name
    FROM information_schema.tables
    WHERE table_name IN ('marketing_media_folders', 'crm_multiempresas_marketing_media_folders')
  LOOP
    EXECUTE format(
      'ALTER TABLE %I.%I ADD COLUMN IF NOT EXISTS lead_id bigint',
      rec.table_schema,
      rec.table_name
    );
    EXECUTE format(
      'CREATE INDEX IF NOT EXISTS %I ON %I.%I (lead_id)',
      rec.table_schema || '_' || rec.table_name || '_lead_id_idx',
      rec.table_schema,
      rec.table_name
    );
  END LOOP;
END $$;
