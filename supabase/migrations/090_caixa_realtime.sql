-- Realtime: Caixa atualiza sem recarregar a página

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'movelaria_caixa_movimentacoes'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE movelaria_caixa_movimentacoes;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'movelaria_caixa_saldo_acumulado'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE movelaria_caixa_saldo_acumulado;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'movelaria_caixa_destinatarios'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE movelaria_caixa_destinatarios;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'movelaria_contas_pagar'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE movelaria_contas_pagar;
  END IF;
END $$;
