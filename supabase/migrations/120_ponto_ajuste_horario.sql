-- Migration 120: ajuste de horário pelo RH (mantém batida original para AFD)

ALTER TABLE movelaria_funcionario_ponto_marcacoes
  ADD COLUMN IF NOT EXISTS registrado_em_ajustado TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ajuste_motivo TEXT,
  ADD COLUMN IF NOT EXISTS ajustado_por UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS ajustado_em TIMESTAMPTZ;

CREATE OR REPLACE FUNCTION movelaria_ponto_hora_efetiva(p_marcacao movelaria_funcionario_ponto_marcacoes)
RETURNS TIMESTAMPTZ AS $$
  SELECT COALESCE(p_marcacao.registrado_em_ajustado, p_marcacao.registrado_em);
$$ LANGUAGE sql IMMUTABLE SET search_path = public;

-- Permite atualizar colunas de ajuste + status/atraso recalculados; mantém imutabilidade REP do original
CREATE OR REPLACE FUNCTION movelaria_ponto_marcacao_guard_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.nsr IS DISTINCT FROM NEW.nsr
    OR OLD.funcionario_id IS DISTINCT FROM NEW.funcionario_id
    OR OLD.usuario_id IS DISTINCT FROM NEW.usuario_id
    OR OLD.tipo IS DISTINCT FROM NEW.tipo
    OR OLD.registrado_em IS DISTINCT FROM NEW.registrado_em
    OR OLD.latitude IS DISTINCT FROM NEW.latitude
    OR OLD.longitude IS DISTINCT FROM NEW.longitude
    OR OLD.foto_path IS DISTINCT FROM NEW.foto_path
    OR OLD.assinatura_path IS DISTINCT FROM NEW.assinatura_path
    OR OLD.hash_sha256 IS DISTINCT FROM NEW.hash_sha256
  THEN
    RAISE EXCEPTION 'Marcações de ponto são imutáveis (REP-P).';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION movelaria_ponto_ajustar_marcacao(
  p_marcacao_id UUID,
  p_hora TIME,
  p_motivo TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_marc movelaria_funcionario_ponto_marcacoes%ROWTYPE;
  v_jornada movelaria_funcionario_jornada%ROWTYPE;
  v_data DATE;
  v_ajustado TIMESTAMPTZ;
  v_hora TIME;
  v_hora_ref TIME;
  v_atraso INT := 0;
  v_status TEXT := 'normal';
  v_motivo TEXT := trim(COALESCE(p_motivo, ''));
BEGIN
  IF movelaria_meu_perfil() NOT IN ('administrador', 'financeiro') THEN
    RAISE EXCEPTION 'Sem permissão para ajustar horário de ponto.';
  END IF;

  IF p_hora IS NULL THEN
    RAISE EXCEPTION 'Informe o novo horário.';
  END IF;

  IF length(v_motivo) < 3 THEN
    RAISE EXCEPTION 'Informe o motivo do ajuste (mínimo 3 caracteres).';
  END IF;

  SELECT * INTO v_marc
  FROM movelaria_funcionario_ponto_marcacoes
  WHERE id = p_marcacao_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Marcação não encontrada.';
  END IF;

  v_data := movelaria_ponto_data_local(v_marc.registrado_em);
  v_ajustado := ((v_data + p_hora) AT TIME ZONE 'America/Sao_Paulo');
  v_hora := p_hora;

  SELECT * INTO v_jornada
  FROM movelaria_funcionario_jornada
  WHERE funcionario_id = v_marc.funcionario_id AND ativo = true;

  IF FOUND THEN
    IF v_marc.tipo = 'entrada' THEN
      v_hora_ref := v_jornada.hora_entrada;
    ELSIF v_marc.tipo = 'retorno_intervalo' THEN
      v_hora_ref := v_jornada.hora_retorno_intervalo;
    END IF;

    IF v_hora_ref IS NOT NULL THEN
      v_atraso := GREATEST(0,
        EXTRACT(EPOCH FROM (v_hora - v_hora_ref)) / 60 - v_jornada.tolerancia_minutos
      )::INT;
      IF v_atraso > 0 THEN v_status := 'atraso'; END IF;
    END IF;
  END IF;

  UPDATE movelaria_funcionario_ponto_marcacoes
  SET
    registrado_em_ajustado = v_ajustado,
    ajuste_motivo = v_motivo,
    ajustado_por = auth.uid(),
    ajustado_em = NOW(),
    atraso_minutos = v_atraso,
    status = v_status
  WHERE id = p_marcacao_id
  RETURNING * INTO v_marc;

  RETURN to_jsonb(v_marc);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION movelaria_ponto_ajustar_marcacao(UUID, TIME, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
