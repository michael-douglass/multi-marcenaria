-- Migration 112: RPC resumo de ponto por período (semana / mês / ano)
-- Hora extra = minutos após jornada.hora_saida na batida tipo 'saida'
-- Faltas = ocorrências tipo 'falta' no período
-- Chegadas = batidas tipo 'entrada' no período

CREATE OR REPLACE FUNCTION movelaria_ponto_resumo_periodo(p_periodo TEXT DEFAULT 'semana')
RETURNS JSONB AS $$
DECLARE
  v_hoje DATE := movelaria_ponto_data_local();
  v_inicio DATE;
  v_fim DATE;
  v_periodo TEXT := lower(trim(COALESCE(p_periodo, 'semana')));
  v_funcionarios JSONB;
  v_he_empresa INT;
  v_faltas_empresa INT;
BEGIN
  IF movelaria_meu_perfil() NOT IN ('administrador', 'financeiro') THEN
    RAISE EXCEPTION 'Sem permissão para visualizar o resumo de ponto.';
  END IF;

  IF v_periodo NOT IN ('semana', 'mes', 'ano') THEN
    RAISE EXCEPTION 'Período inválido. Use semana, mes ou ano.';
  END IF;

  IF v_periodo = 'semana' THEN
    v_inicio := v_hoje - ((EXTRACT(ISODOW FROM v_hoje)::INT) - 1);
    v_fim := v_inicio + 6;
  ELSIF v_periodo = 'mes' THEN
    v_inicio := date_trunc('month', v_hoje)::DATE;
    v_fim := (date_trunc('month', v_hoje) + INTERVAL '1 month - 1 day')::DATE;
  ELSE
    v_inicio := date_trunc('year', v_hoje)::DATE;
    v_fim := (date_trunc('year', v_hoje) + INTERVAL '1 year - 1 day')::DATE;
  END IF;

  SELECT COALESCE(jsonb_agg(row ORDER BY row->>'nome'), '[]'::jsonb)
  INTO v_funcionarios
  FROM (
    SELECT jsonb_build_object(
      'funcionario_id', f.id,
      'nome', f.nome,
      'tipo', f.tipo,
      'hora_extra_minutos', COALESCE((
        SELECT SUM(
          GREATEST(
            0,
            FLOOR(
              EXTRACT(
                EPOCH FROM (
                  movelaria_ponto_hora_local(m.registrado_em) - j.hora_saida
                )
              ) / 60
            )::INT
          )
        )::INT
        FROM movelaria_funcionario_ponto_marcacoes m
        INNER JOIN movelaria_funcionario_jornada j
          ON j.funcionario_id = f.id AND j.ativo = true
        WHERE m.funcionario_id = f.id
          AND m.tipo = 'saida'
          AND movelaria_ponto_data_local(m.registrado_em) BETWEEN v_inicio AND v_fim
      ), 0),
      'faltas', COALESCE((
        SELECT COUNT(*)::INT
        FROM movelaria_funcionario_ponto_ocorrencias o
        WHERE o.funcionario_id = f.id
          AND o.tipo = 'falta'
          AND o.data BETWEEN v_inicio AND v_fim
      ), 0),
      'faltas_datas', COALESCE((
        SELECT jsonb_agg(o.data ORDER BY o.data)
        FROM movelaria_funcionario_ponto_ocorrencias o
        WHERE o.funcionario_id = f.id
          AND o.tipo = 'falta'
          AND o.data BETWEEN v_inicio AND v_fim
      ), '[]'::jsonb),
      'chegadas', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'data', movelaria_ponto_data_local(m.registrado_em),
            'hora', to_char(movelaria_ponto_hora_local(m.registrado_em), 'HH24:MI'),
            'atraso_minutos', COALESCE(m.atraso_minutos, 0)
          )
          ORDER BY m.registrado_em
        )
        FROM movelaria_funcionario_ponto_marcacoes m
        WHERE m.funcionario_id = f.id
          AND m.tipo = 'entrada'
          AND movelaria_ponto_data_local(m.registrado_em) BETWEEN v_inicio AND v_fim
      ), '[]'::jsonb)
    ) AS row
    FROM movelaria_funcionarios f
    WHERE f.ativo = true
      AND f.tipo IN ('montador', 'montador_admin', 'administrador_obras')
  ) sub;

  SELECT COALESCE(SUM((f->>'hora_extra_minutos')::INT), 0)::INT
  INTO v_he_empresa
  FROM jsonb_array_elements(v_funcionarios) f;

  SELECT COALESCE(SUM((f->>'faltas')::INT), 0)::INT
  INTO v_faltas_empresa
  FROM jsonb_array_elements(v_funcionarios) f;

  RETURN jsonb_build_object(
    'periodo', v_periodo,
    'inicio', v_inicio,
    'fim', v_fim,
    'empresa', jsonb_build_object(
      'hora_extra_minutos', v_he_empresa,
      'faltas_total', v_faltas_empresa
    ),
    'funcionarios', v_funcionarios
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;
