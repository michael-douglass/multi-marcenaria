-- Realtime: prestadores veem novas obras e alterações sem recarregar a página

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'movelaria_obras'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE movelaria_obras;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'movelaria_obra_responsaveis'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE movelaria_obra_responsaveis;
  END IF;
END $$;
