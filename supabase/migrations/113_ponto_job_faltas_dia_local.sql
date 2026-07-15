-- Migration 113: corrige dia da falta automática no job noturno
-- Antes: NOW() - 1 day em UTC caía no dia civil errado em America/Sao_Paulo
-- Agora: se ainda é noite (horário SP < 06h), fecha o dia anterior; senão fecha o dia atual

CREATE OR REPLACE FUNCTION movelaria_ponto_job_faltas()
RETURNS void AS $$
DECLARE
  v_agora_sp TIMESTAMP := (NOW() AT TIME ZONE 'America/Sao_Paulo');
  v_data DATE;
BEGIN
  -- Cron sobe às 23:59 SP (02:59 UTC): fecha o dia que está terminando.
  -- Se o job atrasar e virar após meia-noite SP, fecha o dia que acabou.
  IF EXTRACT(HOUR FROM v_agora_sp) < 6 THEN
    v_data := v_agora_sp::DATE - 1;
  ELSE
    v_data := v_agora_sp::DATE;
  END IF;

  PERFORM movelaria_ponto_detectar_faltas(v_data);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
