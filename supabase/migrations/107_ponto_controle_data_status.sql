-- Migration 107: status do controle diário respeita a data selecionada + jornada completa

CREATE OR REPLACE FUNCTION movelaria_ponto_status_dia(
  p_funcionario_id UUID DEFAULT NULL,
  p_data DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_func_id UUID;
  v_data DATE := COALESCE(p_data, movelaria_ponto_data_local());
  v_jornada movelaria_funcionario_jornada%ROWTYPE;
  v_proximo TEXT;
  v_ocorrencia TEXT;
  v_marcacoes JSONB;
  v_status_dia TEXT := 'pendente';
BEGIN
  IF p_funcionario_id IS NULL THEN
    SELECT id INTO v_func_id FROM movelaria_funcionarios
    WHERE usuario_id = auth.uid() AND ativo = true;
  ELSE
    v_func_id := p_funcionario_id;
  END IF;

  IF v_func_id IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO v_jornada FROM movelaria_funcionario_jornada
  WHERE funcionario_id = v_func_id;

  SELECT tipo INTO v_ocorrencia FROM movelaria_funcionario_ponto_ocorrencias
  WHERE funcionario_id = v_func_id AND data = v_data
  ORDER BY criado_em DESC LIMIT 1;

  v_proximo := movelaria_ponto_proximo_tipo(v_func_id, v_data);

  SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.registrado_em), '[]'::jsonb)
  INTO v_marcacoes
  FROM movelaria_funcionario_ponto_marcacoes m
  WHERE m.funcionario_id = v_func_id AND movelaria_ponto_data_local(m.registrado_em) = v_data;

  IF v_ocorrencia = 'folga' THEN v_status_dia := 'folga';
  ELSIF v_ocorrencia = 'falta' THEN v_status_dia := 'falta';
  ELSIF EXISTS (SELECT 1 FROM jsonb_array_elements(v_marcacoes) e WHERE e->>'status' = 'atraso') THEN v_status_dia := 'atraso';
  ELSIF v_proximo IS NULL AND jsonb_array_length(v_marcacoes) > 0 THEN v_status_dia := 'completo';
  ELSIF jsonb_array_length(v_marcacoes) > 0 THEN v_status_dia := 'em_dia';
  END IF;

  RETURN jsonb_build_object(
    'funcionario_id', v_func_id,
    'data', v_data,
    'jornada', CASE WHEN v_jornada.id IS NOT NULL THEN to_jsonb(v_jornada) ELSE NULL END,
    'proximo_tipo', v_proximo,
    'ocorrencia', v_ocorrencia,
    'status_dia', v_status_dia,
    'marcacoes', v_marcacoes
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION movelaria_ponto_controle_diario(p_data DATE DEFAULT movelaria_ponto_data_local())
RETURNS JSONB AS $$
BEGIN
  IF movelaria_meu_perfil() NOT IN ('administrador', 'financeiro') THEN
    RAISE EXCEPTION 'Sem permissão para visualizar o controle de ponto.';
  END IF;

  RETURN COALESCE((
    SELECT jsonb_agg(row ORDER BY row->>'nome')
    FROM (
      SELECT jsonb_build_object(
        'funcionario_id', f.id,
        'nome', f.nome,
        'tipo', f.tipo,
        'hora_prevista', j.hora_entrada,
        'jornada', CASE WHEN j.id IS NOT NULL THEN jsonb_build_object(
          'hora_entrada', j.hora_entrada,
          'hora_saida_intervalo', j.hora_saida_intervalo,
          'hora_retorno_intervalo', j.hora_retorno_intervalo,
          'hora_saida', j.hora_saida
        ) ELSE NULL END,
        'status_dia', COALESCE(
          (movelaria_ponto_status_dia(f.id, p_data)->>'status_dia'),
          'pendente'
        ),
        'ocorrencia', (movelaria_ponto_status_dia(f.id, p_data)->>'ocorrencia'),
        'entrada', (
          SELECT to_jsonb(m)
          FROM movelaria_funcionario_ponto_marcacoes m
          WHERE m.funcionario_id = f.id
            AND m.tipo = 'entrada'
            AND movelaria_ponto_data_local(m.registrado_em) = p_data
          ORDER BY m.registrado_em DESC
          LIMIT 1
        ),
        'marcacoes', COALESCE((
          SELECT jsonb_agg(to_jsonb(m) ORDER BY m.registrado_em)
          FROM movelaria_funcionario_ponto_marcacoes m
          WHERE m.funcionario_id = f.id
            AND movelaria_ponto_data_local(m.registrado_em) = p_data
        ), '[]'::jsonb)
      ) AS row
      FROM movelaria_funcionarios f
      LEFT JOIN movelaria_funcionario_jornada j ON j.funcionario_id = f.id AND j.ativo = true
      WHERE f.ativo = true
        AND f.tipo IN ('montador', 'montador_admin', 'administrador_obras')
    ) sub
  ), '[]'::jsonb);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;
