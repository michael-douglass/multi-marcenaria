-- Migration 148: faltas incluem ocorrências registradas + HE por batida de saída

CREATE OR REPLACE FUNCTION movelaria_ponto_resumo_periodo(
  p_periodo TEXT DEFAULT 'mes',
  p_referencia TEXT DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_hoje DATE := movelaria_ponto_data_local();
  v_faltas_ate DATE := movelaria_ponto_data_faltas_ate();
  v_inicio DATE;
  v_fim DATE;
  v_periodo TEXT := lower(trim(COALESCE(p_periodo, 'mes')));
  v_ref TEXT := NULLIF(trim(COALESCE(p_referencia, '')), '');
  v_ref_date DATE;
  v_funcionarios JSONB;
  v_he_empresa INT;
  v_faltas_empresa INT;
BEGIN
  IF movelaria_meu_perfil() NOT IN ('administrador', 'financeiro') THEN
    RAISE EXCEPTION 'Sem permissão para visualizar o resumo de ponto.';
  END IF;

  IF v_periodo = 'mes_passado' THEN
    v_periodo := 'mes';
    IF v_ref IS NULL THEN
      v_ref := to_char(date_trunc('month', v_hoje) - INTERVAL '1 month', 'YYYY-MM');
    END IF;
  END IF;

  IF v_periodo NOT IN ('semana', 'mes', 'ano') THEN
    RAISE EXCEPTION 'Período inválido. Use semana, mes ou ano.';
  END IF;

  IF v_periodo = 'semana' THEN
    v_inicio := v_hoje - ((EXTRACT(ISODOW FROM v_hoje)::INT) - 1);
    v_fim := v_inicio + 6;
  ELSIF v_periodo = 'mes' THEN
    IF v_ref IS NOT NULL THEN
      BEGIN
        v_ref_date := (v_ref || '-01')::DATE;
      EXCEPTION WHEN OTHERS THEN
        RAISE EXCEPTION 'Referência de mês inválida. Use YYYY-MM (ex.: 2026-07).';
      END;
      v_inicio := date_trunc('month', v_ref_date)::DATE;
      v_fim := (date_trunc('month', v_ref_date) + INTERVAL '1 month - 1 day')::DATE;
    ELSE
      v_inicio := date_trunc('month', v_hoje)::DATE;
      v_fim := (date_trunc('month', v_hoje) + INTERVAL '1 month - 1 day')::DATE;
    END IF;
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
      -- Dias sem ponto (jornada) UNION faltas registradas em ocorrências
      'faltas_datas', COALESCE((
        SELECT jsonb_agg(to_char(x.dia, 'YYYY-MM-DD') ORDER BY x.dia)
        FROM (
          SELECT d.dia::date AS dia
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
          UNION
          SELECT o.data AS dia
          FROM movelaria_funcionario_ponto_ocorrencias o
          WHERE o.funcionario_id = f.id
            AND o.tipo = 'falta'
            AND o.data BETWEEN v_inicio AND LEAST(v_fim, v_faltas_ate)
        ) x
      ), '[]'::jsonb),
      'faltas', COALESCE((
        SELECT COUNT(*)::INT
        FROM (
          SELECT d.dia::date AS dia
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
          UNION
          SELECT o.data AS dia
          FROM movelaria_funcionario_ponto_ocorrencias o
          WHERE o.funcionario_id = f.id
            AND o.tipo = 'falta'
            AND o.data BETWEEN v_inicio AND LEAST(v_fim, v_faltas_ate)
        ) x
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
            'hora_extra_minutos', 0,
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
            'hora_extra_minutos', CASE
              WHEN m.tipo = 'saida' THEN COALESCE((
                SELECT GREATEST(
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
                FROM movelaria_funcionario_jornada j
                WHERE j.funcionario_id = f.id AND j.ativo = true
                LIMIT 1
              ), 0)
              ELSE 0
            END,
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
    'referencia', CASE
      WHEN v_periodo = 'mes' THEN to_char(v_inicio, 'YYYY-MM')
      ELSE NULL
    END,
    'empresa', jsonb_build_object(
      'hora_extra_minutos', v_he_empresa,
      'faltas_total', v_faltas_empresa
    ),
    'funcionarios', v_funcionarios
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';
