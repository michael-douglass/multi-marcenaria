-- Migration 158: RH registra ponto esquecido (batida oficial com NSR)

ALTER TABLE movelaria_funcionario_ponto_marcacoes
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'app'
    CHECK (origem IN ('app', 'rh_manual')),
  ADD COLUMN IF NOT EXISTS registro_motivo TEXT;

COMMENT ON COLUMN movelaria_funcionario_ponto_marcacoes.origem IS
  'app = batida pelo funcionário; rh_manual = lançamento oficial pelo RH.';

COMMENT ON COLUMN movelaria_funcionario_ponto_marcacoes.registro_motivo IS
  'Motivo obrigatório quando origem = rh_manual.';

-- Imutabilidade: origem e registro_motivo também não mudam após o insert
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
    OR OLD.origem IS DISTINCT FROM NEW.origem
    OR OLD.registro_motivo IS DISTINCT FROM NEW.registro_motivo
  THEN
    RAISE EXCEPTION 'Marcações de ponto são imutáveis (REP-P).';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION movelaria_ponto_registrar_manual(
  p_funcionario_id UUID,
  p_data DATE,
  p_tipo TEXT,
  p_hora TIME,
  p_motivo TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_funcionario movelaria_funcionarios%ROWTYPE;
  v_jornada movelaria_funcionario_jornada%ROWTYPE;
  v_motivo TEXT := trim(COALESCE(p_motivo, ''));
  v_tipo TEXT := lower(trim(COALESCE(p_tipo, '')));
  v_registrado TIMESTAMPTZ;
  v_hora TIME;
  v_hora_ref TIME;
  v_atraso INT := 0;
  v_status TEXT := 'normal';
  v_marc movelaria_funcionario_ponto_marcacoes%ROWTYPE;
  v_hash TEXT;
  v_dow INT;
BEGIN
  IF movelaria_meu_perfil() NOT IN ('administrador', 'financeiro') THEN
    RAISE EXCEPTION 'Sem permissão para registrar ponto manualmente.';
  END IF;

  IF p_funcionario_id IS NULL THEN
    RAISE EXCEPTION 'Informe o funcionário.';
  END IF;

  IF p_data IS NULL THEN
    RAISE EXCEPTION 'Informe a data do ponto.';
  END IF;

  IF p_hora IS NULL THEN
    RAISE EXCEPTION 'Informe o horário da batida.';
  END IF;

  IF length(v_motivo) < 3 THEN
    RAISE EXCEPTION 'Informe o motivo do registro (mínimo 3 caracteres).';
  END IF;

  IF v_tipo NOT IN ('entrada', 'saida_intervalo', 'retorno_intervalo', 'saida') THEN
    RAISE EXCEPTION 'Tipo de batida inválido.';
  END IF;

  IF p_data > movelaria_ponto_data_local() THEN
    RAISE EXCEPTION 'Não é possível registrar ponto em data futura.';
  END IF;

  SELECT * INTO v_funcionario
  FROM movelaria_funcionarios
  WHERE id = p_funcionario_id AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Funcionário não encontrado ou inativo.';
  END IF;

  IF v_funcionario.usuario_id IS NULL THEN
    RAISE EXCEPTION 'Funcionário sem usuário vinculado — não é possível gerar batida oficial.';
  END IF;

  IF v_funcionario.tipo NOT IN ('montador', 'montador_admin', 'administrador_obras') THEN
    RAISE EXCEPTION 'Este perfil de funcionário não usa ponto eletrônico.';
  END IF;

  SELECT * INTO v_jornada
  FROM movelaria_funcionario_jornada
  WHERE funcionario_id = v_funcionario.id AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Jornada de trabalho não configurada para este funcionário.';
  END IF;

  v_dow := EXTRACT(ISODOW FROM p_data)::INT;
  IF NOT (v_dow = ANY(v_jornada.dias_uteis)) THEN
    RAISE EXCEPTION 'A data informada não é dia útil na jornada deste funcionário.';
  END IF;

  -- Remove falta automática: ao registrar batida, a pessoa não pode continuar como faltosa
  DELETE FROM movelaria_funcionario_ponto_ocorrencias
  WHERE funcionario_id = v_funcionario.id
    AND data = p_data
    AND tipo = 'falta'
    AND COALESCE(automatica, false) = true;

  IF EXISTS (
    SELECT 1 FROM movelaria_funcionario_ponto_ocorrencias
    WHERE funcionario_id = v_funcionario.id
      AND data = p_data
      AND (
        tipo = 'folga'
        OR (tipo = 'falta' AND COALESCE(automatica, false) = false)
      )
  ) THEN
    RAISE EXCEPTION 'Não é possível registrar ponto: há folga ou falta lançada pelo RH neste dia.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM movelaria_funcionario_ponto_marcacoes
    WHERE funcionario_id = v_funcionario.id
      AND movelaria_ponto_data_local(registrado_em) = p_data
      AND tipo = v_tipo
  ) THEN
    RAISE EXCEPTION 'Já existe batida de % neste dia.', v_tipo;
  END IF;

  v_registrado := ((p_data + p_hora) AT TIME ZONE 'America/Sao_Paulo');
  v_hora := p_hora;

  IF v_tipo = 'entrada' THEN
    v_hora_ref := v_jornada.hora_entrada;
  ELSIF v_tipo = 'retorno_intervalo' THEN
    v_hora_ref := v_jornada.hora_retorno_intervalo;
  END IF;

  IF v_hora_ref IS NOT NULL THEN
    v_atraso := GREATEST(0,
      EXTRACT(EPOCH FROM (v_hora - v_hora_ref)) / 60 - v_jornada.tolerancia_minutos
    )::INT;
    IF v_atraso > 0 THEN v_status := 'atraso'; END IF;
  END IF;

  v_hash := encode(
    extensions.digest(
      (
        'rh_manual|' || v_funcionario.id::text || '|' || v_tipo || '|' ||
        p_data::text || '|' || v_hora::text || '|' || v_motivo || '|' ||
        COALESCE(auth.uid()::text, '') || '|' || clock_timestamp()::text
      )::bytea,
      'sha256'
    ),
    'hex'
  );

  INSERT INTO movelaria_funcionario_ponto_marcacoes (
    funcionario_id, usuario_id, tipo, registrado_em,
    hash_sha256, status, atraso_minutos, offline,
    origem, registro_motivo,
    ajuste_motivo, ajustado_por, ajustado_em
  ) VALUES (
    v_funcionario.id, v_funcionario.usuario_id, v_tipo, v_registrado,
    v_hash, v_status, v_atraso, false,
    'rh_manual', v_motivo,
    'Registro RH: ' || v_motivo, auth.uid(), NOW()
  )
  RETURNING * INTO v_marc;

  UPDATE movelaria_rep_config SET nsr_atual = v_marc.nsr, atualizado_em = NOW()
  WHERE ativo = true;

  RETURN to_jsonb(v_marc);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION movelaria_ponto_registrar_manual(UUID, DATE, TEXT, TIME, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
