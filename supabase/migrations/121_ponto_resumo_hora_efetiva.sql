-- Migration 121: resumo e telas usam horário efetivo (ajustado pelo RH)

CREATE OR REPLACE FUNCTION movelaria_ponto_ts_efetivo(
  p_registrado TIMESTAMPTZ,
  p_ajustado TIMESTAMPTZ
)
RETURNS TIMESTAMPTZ AS $$
  SELECT COALESCE(p_ajustado, p_registrado);
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE SET search_path = public;

CREATE OR REPLACE FUNCTION movelaria_ponto_resumo_periodo(p_periodo TEXT DEFAULT 'mes')
RETURNS JSONB AS $$
DECLARE
  v_hoje DATE := movelaria_ponto_data_local();
  v_faltas_ate DATE := movelaria_ponto_data_faltas_ate();
  v_inicio DATE;
  v_fim DATE;
  v_periodo TEXT := lower(trim(COALESCE(p_periodo, 'mes')));
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

  PERFORM movelaria_ponto_sincronizar_faltas_periodo(v_inicio, v_fim);

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
                  movelaria_ponto_hora_local(
                    movelaria_ponto_ts_efetivo(m.registrado_em, m.registrado_em_ajustado)
                  ) - j.hora_saida
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
      'faltas_datas', COALESCE((
        SELECT jsonb_agg(to_char(d.dia, 'YYYY-MM-DD') ORDER BY d.dia)
        FROM generate_series(
          GREATEST(
            v_inicio,
            COALESCE(
              NULLIF(f.admissao_dados->>'data_admissao', '')::DATE,
              movelaria_ponto_data_local(f.criado_em)
            )
          ),
          LEAST(v_fim, v_faltas_ate),
          INTERVAL '1 day'
        ) AS d(dia)
        INNER JOIN movelaria_funcionario_jornada j
          ON j.funcionario_id = f.id AND j.ativo = true
        WHERE EXTRACT(ISODOW FROM d.dia)::INT = ANY(j.dias_uteis)
          AND NOT EXISTS (
            SELECT 1 FROM movelaria_funcionario_ponto_marcacoes m
            WHERE m.funcionario_id = f.id
              AND movelaria_ponto_data_local(m.registrado_em) = d.dia
          )
          AND NOT EXISTS (
            SELECT 1 FROM movelaria_funcionario_ponto_ocorrencias o
            WHERE o.funcionario_id = f.id
              AND o.data = d.dia
              AND o.tipo IN ('folga', 'abono')
          )
      ), '[]'::jsonb),
      'faltas', COALESCE((
        SELECT COUNT(*)::INT
        FROM generate_series(
          GREATEST(
            v_inicio,
            COALESCE(
              NULLIF(f.admissao_dados->>'data_admissao', '')::DATE,
              movelaria_ponto_data_local(f.criado_em)
            )
          ),
          LEAST(v_fim, v_faltas_ate),
          INTERVAL '1 day'
        ) AS d(dia)
        INNER JOIN movelaria_funcionario_jornada j
          ON j.funcionario_id = f.id AND j.ativo = true
        WHERE EXTRACT(ISODOW FROM d.dia)::INT = ANY(j.dias_uteis)
          AND NOT EXISTS (
            SELECT 1 FROM movelaria_funcionario_ponto_marcacoes m
            WHERE m.funcionario_id = f.id
              AND movelaria_ponto_data_local(m.registrado_em) = d.dia
          )
          AND NOT EXISTS (
            SELECT 1 FROM movelaria_funcionario_ponto_ocorrencias o
            WHERE o.funcionario_id = f.id
              AND o.data = d.dia
              AND o.tipo IN ('folga', 'abono')
          )
      ), 0),
      'chegadas', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'data', to_char(movelaria_ponto_data_local(m.registrado_em), 'YYYY-MM-DD'),
            'hora', to_char(
              movelaria_ponto_hora_local(
                movelaria_ponto_ts_efetivo(m.registrado_em, m.registrado_em_ajustado)
              ),
              'HH24:MI'
            ),
            'atraso_minutos', COALESCE(m.atraso_minutos, 0),
            'tipo', m.tipo
          )
          ORDER BY movelaria_ponto_ts_efetivo(m.registrado_em, m.registrado_em_ajustado)
        )
        FROM movelaria_funcionario_ponto_marcacoes m
        WHERE m.funcionario_id = f.id
          AND m.tipo IN ('entrada', 'retorno_intervalo')
          AND movelaria_ponto_data_local(m.registrado_em) BETWEEN v_inicio AND v_fim
      ), '[]'::jsonb),
      'saidas', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'data', to_char(movelaria_ponto_data_local(m.registrado_em), 'YYYY-MM-DD'),
            'hora', to_char(
              movelaria_ponto_hora_local(
                movelaria_ponto_ts_efetivo(m.registrado_em, m.registrado_em_ajustado)
              ),
              'HH24:MI'
            ),
            'atraso_minutos', COALESCE(m.atraso_minutos, 0),
            'tipo', m.tipo
          )
          ORDER BY movelaria_ponto_ts_efetivo(m.registrado_em, m.registrado_em_ajustado)
        )
        FROM movelaria_funcionario_ponto_marcacoes m
        WHERE m.funcionario_id = f.id
          AND m.tipo IN ('saida_intervalo', 'saida')
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
    'inicio', to_char(v_inicio, 'YYYY-MM-DD'),
    'fim', to_char(v_fim, 'YYYY-MM-DD'),
    'empresa', jsonb_build_object(
      'hora_extra_minutos', v_he_empresa,
      'faltas_total', v_faltas_empresa
    ),
    'funcionarios', v_funcionarios
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';
