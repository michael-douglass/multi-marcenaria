-- Migration 105: Job noturno para detectar faltas automaticamente
-- Requer extensão pg_cron habilitada no projeto Supabase

CREATE OR REPLACE FUNCTION movelaria_ponto_job_faltas()
RETURNS void AS $$
BEGIN
  PERFORM movelaria_ponto_detectar_faltas(movelaria_ponto_data_local(NOW() - INTERVAL '1 day'));
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Agendar às 23:59 America/Sao_Paulo (02:59 UTC) se pg_cron disponível
DO $cron$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    PERFORM cron.unschedule(jobid)
    FROM cron.job
    WHERE jobname = 'movelaria_ponto_faltas_diario';

    PERFORM cron.schedule(
      'movelaria_ponto_faltas_diario',
      '59 2 * * *',
      $$SELECT movelaria_ponto_job_faltas()$$
    );
  END IF;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'pg_cron indisponível — execute movelaria_ponto_detectar_faltas() manualmente ou via Edge Function cron.';
END;
$cron$;
