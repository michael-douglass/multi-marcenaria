-- Realtime: Cobranças atualizam sem recarregar a página

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'movelaria_contas_receber'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE movelaria_contas_receber;
  END IF;
END $$;
