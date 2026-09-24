-- ============================================================
-- GARBO Movelaria — Desconsiderar falta (4 batidas pontuais)
-- Migration 201
-- ============================================================
-- Remove a ocorrência de falta do dia e lança as batidas oficiais
-- (rh_manual) nos horários previstos da jornada, todos pontuais.
-- ============================================================

CREATE OR REPLACE FUNCTION movelaria_ponto_desconsiderar_falta(
  p_funcionario_id UUID,
  p_data DATE,
  p_motivo TEXT
)
RETURNS JSONB AS $$
DECLARE
  v_funcionario movelaria_funcionarios%ROWTYPE;
  v_jornada movelaria_funcionario_jornada%ROWTYPE;
  v_motivo TEXT := trim(COALESCE(p_motivo, ''));
  v_dow INT;
  v_hora_entrada TIME;
  v_hora_saida_intervalo TIME;
  v_hora_retorno_intervalo TIME;
  v_hora_saida TIME;
  v_tipos TEXT[];
  v_horas TIME[];
  v_i INT;
  v_tipo TEXT;
  v_hora TIME;
  v_registrado TIMESTAMPTZ;
  v_hash TEXT;
  v_marc movelaria_funcionario_ponto_marcacoes%ROWTYPE;
  v_marcacoes JSONB := '[]'::JSONB;
  v_ultimo_nsr BIGINT := 0;
BEGIN
  IF movelaria_meu_perfil() NOT IN ('administrador', 'financeiro') THEN
    RAISE EXCEPTION 'Sem permissão para desconsiderar falta.';
  END IF;

  IF p_funcionario_id IS NULL THEN
    RAISE EXCEPTION 'Informe o funcionário.';
  END IF;

  IF p_data IS NULL THEN
    RAISE EXCEPTION 'Informe a data da falta.';
  END IF;

  IF length(v_motivo) < 3 THEN
    RAISE EXCEPTION 'Informe o motivo (mínimo 3 caracteres).';
  END IF;

  IF p_data > movelaria_ponto_data_local() THEN
    RAISE EXCEPTION 'Não é possível desconsiderar falta em data futura.';
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

  IF EXISTS (
    SELECT 1 FROM movelaria_funcionario_ponto_ocorrencias
    WHERE funcionario_id = v_funcionario.id
      AND data = p_data
      AND tipo IN ('folga', 'abono')
  ) THEN
    RAISE EXCEPTION 'Não é possível desconsiderar: há folga ou abono neste dia.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM movelaria_funcionario_ponto_marcacoes
    WHERE funcionario_id = v_funcionario.id
      AND movelaria_ponto_data_local(registrado_em) = p_data
  ) THEN
    RAISE EXCEPTION 'Já existem batidas neste dia — não é possível desconsiderar a falta.';
  END IF;

  v_hora_entrada := movelaria_jornada_hora_no_dia(v_jornada, v_dow, 'chegada');
  v_hora_saida_intervalo := movelaria_jornada_hora_no_dia(v_jornada, v_dow, 'saida_almoco');
  v_hora_retorno_intervalo := movelaria_jornada_hora_no_dia(v_jornada, v_dow, 'retorno_almoco');
  v_hora_saida := movelaria_jornada_hora_no_dia(v_jornada, v_dow, 'saida_servico');

  IF v_hora_entrada IS NULL OR v_hora_saida IS NULL THEN
    RAISE EXCEPTION 'Jornada incompleta: faltam horário de entrada ou saída.';
  END IF;

  IF v_hora_saida_intervalo IS NOT NULL AND v_hora_retorno_intervalo IS NOT NULL THEN
    v_tipos := ARRAY['entrada', 'saida_intervalo', 'retorno_intervalo', 'saida'];
    v_horas := ARRAY[v_hora_entrada, v_hora_saida_intervalo, v_hora_retorno_intervalo, v_hora_saida];
  ELSE
    v_tipos := ARRAY['entrada', 'saida'];
    v_horas := ARRAY[v_hora_entrada, v_hora_saida];
  END IF;

  -- Remove qualquer falta do dia (automática ou justificada / abatida)
  DELETE FROM movelaria_funcionario_ponto_ocorrencias
  WHERE funcionario_id = v_funcionario.id
    AND data = p_data
    AND tipo = 'falta';

  FOR v_i IN 1 .. array_length(v_tipos, 1) LOOP
    v_tipo := v_tipos[v_i];
    v_hora := v_horas[v_i];
    v_registrado := ((p_data + v_hora) AT TIME ZONE 'America/Sao_Paulo');

    v_hash := encode(
      extensions.digest(
        (
          'rh_manual|desconsiderar|' || v_funcionario.id::text || '|' || v_tipo || '|' ||
          p_data::text || '|' || v_hora::text || '|' || v_motivo || '|' ||
          COALESCE(auth.uid()::text, '') || '|' || clock_timestamp()::text || '|' || v_i::text
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
      v_hash, 'normal', 0, false,
      'rh_manual', v_motivo,
      'Desconsiderar falta: ' || v_motivo, auth.uid(), NOW()
    )
    RETURNING * INTO v_marc;

    v_ultimo_nsr := v_marc.nsr;
    v_marcacoes := v_marcacoes || jsonb_build_array(to_jsonb(v_marc));
  END LOOP;

  UPDATE movelaria_rep_config
  SET nsr_atual = v_ultimo_nsr, atualizado_em = NOW()
  WHERE ativo = true;

  RETURN jsonb_build_object(
    'funcionario_id', v_funcionario.id,
    'data', to_char(p_data, 'YYYY-MM-DD'),
    'motivo', v_motivo,
    'marcacoes', v_marcacoes,
    'nsr_ultimo', v_ultimo_nsr
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION movelaria_ponto_desconsiderar_falta(UUID, DATE, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
