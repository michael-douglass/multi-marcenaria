-- Migration 168: Montador Admin lê/edita registros de ponto de terceiros
-- (não altera o próprio ponto) e acessa a pasta só na aba Registros.

CREATE OR REPLACE FUNCTION movelaria_ponto_assert_edicao_registros(p_funcionario_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_uid UUID;
BEGIN
  IF v_perfil IN ('administrador', 'financeiro') THEN
    RETURN;
  END IF;

  IF v_perfil IS DISTINCT FROM 'montador_admin' THEN
    RAISE EXCEPTION 'Sem permissão para alterar registros de ponto.';
  END IF;

  SELECT usuario_id INTO v_uid
  FROM movelaria_funcionarios
  WHERE id = p_funcionario_id;

  IF v_uid IS NOT NULL AND v_uid = auth.uid() THEN
    RAISE EXCEPTION 'Ponto de sua titularidade não poderá ser alterado.';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION movelaria_ponto_assert_edicao_registros(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_ponto_assert_edicao_registros(UUID) TO authenticated;

DROP POLICY IF EXISTS "funcionarios_select" ON movelaria_funcionarios;
CREATE POLICY "funcionarios_select" ON movelaria_funcionarios
  FOR SELECT TO authenticated
  USING (
    movelaria_meu_perfil() IN ('administrador', 'financeiro')
    OR usuario_id = auth.uid()
    OR (
      movelaria_meu_perfil() = 'montador_admin'
      AND tipo IN ('montador', 'montador_admin', 'administrador_obras')
    )
  );

DROP POLICY IF EXISTS "ponto_jornada_select" ON movelaria_funcionario_jornada;
CREATE POLICY "ponto_jornada_select" ON movelaria_funcionario_jornada
  FOR SELECT TO authenticated
  USING (
    movelaria_meu_perfil() IN ('administrador', 'financeiro', 'montador_admin')
    OR EXISTS (
      SELECT 1 FROM movelaria_funcionarios f
      WHERE f.id = funcionario_id AND f.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ponto_marc_select" ON movelaria_funcionario_ponto_marcacoes;
CREATE POLICY "ponto_marc_select" ON movelaria_funcionario_ponto_marcacoes
  FOR SELECT TO authenticated
  USING (
    movelaria_meu_perfil() IN ('administrador', 'financeiro', 'montador_admin')
    OR EXISTS (
      SELECT 1 FROM movelaria_funcionarios f
      WHERE f.id = funcionario_id AND f.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ponto_ocor_select" ON movelaria_funcionario_ponto_ocorrencias;
CREATE POLICY "ponto_ocor_select" ON movelaria_funcionario_ponto_ocorrencias
  FOR SELECT TO authenticated
  USING (
    movelaria_meu_perfil() IN ('administrador', 'financeiro', 'montador_admin')
    OR EXISTS (
      SELECT 1 FROM movelaria_funcionarios f
      WHERE f.id = funcionario_id AND f.usuario_id = auth.uid()
    )
  );

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
  IF p_funcionario_id IS NULL THEN
    RAISE EXCEPTION 'Informe o funcionário.';
  END IF;

  PERFORM movelaria_ponto_assert_edicao_registros(p_funcionario_id);

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

  PERFORM movelaria_ponto_assert_edicao_registros(v_marc.funcionario_id);

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

GRANT EXECUTE ON FUNCTION movelaria_ponto_registrar_manual(UUID, DATE, TEXT, TIME, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION movelaria_ponto_ajustar_marcacao(UUID, TIME, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
