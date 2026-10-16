-- ============================================================
-- GARBO Movelaria — Débito de falta injustificada com minutos
-- Migration 223
-- ============================================================
-- Problemas corrigidos:
-- 1) Faltas com abater=true mas minutos_abatidos NULL não entravam no saldo
-- 2) faltas_detalhe usava COALESCE(abater, false) → dia sem linha parecia "justificada"
-- 3) Injustificada sem flag ainda deve debitar a jornada
-- ============================================================

-- Minutos a debitar: flag OU sem justificativa real; fallback = jornada do dia
CREATE OR REPLACE FUNCTION movelaria_ponto_falta_minutos_debito(
  p_funcionario_id UUID,
  p_data DATE,
  p_abater BOOLEAN,
  p_minutos INT,
  p_observacao TEXT
)
RETURNS INT
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_debita BOOLEAN;
BEGIN
  v_debita := COALESCE(p_abater, false)
    OR NOT movelaria_ponto_falta_tem_justificativa(p_observacao);
  IF NOT v_debita THEN
    RETURN 0;
  END IF;
  RETURN GREATEST(
    0,
    COALESCE(
      NULLIF(p_minutos, 0),
      movelaria_jornada_minutos_no_dia(p_funcionario_id, p_data),
      0
    )
  );
END;
$$;

-- Flag efetiva para UI: debita se marcado OU se injustificada
CREATE OR REPLACE FUNCTION movelaria_ponto_falta_debita_caixa(
  p_abater BOOLEAN,
  p_observacao TEXT
)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT COALESCE(p_abater, false)
    OR NOT movelaria_ponto_falta_tem_justificativa(p_observacao);
$$;

CREATE OR REPLACE FUNCTION movelaria_ponto_banco_componentes(
  p_funcionario_id UUID,
  p_inicio DATE,
  p_fim DATE
)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  v_he INT := 0;
  v_atrasos INT := 0;
  v_faltas INT := 0;
  v_pagas INT := 0;
BEGIN
  IF p_inicio IS NULL OR p_fim IS NULL OR p_fim < p_inicio THEN
    RETURN jsonb_build_object(
      'hora_extra_minutos', 0,
      'atrasos_minutos', 0,
      'faltas_banco_minutos', 0,
      'he_pagas_minutos', 0,
      'saldo_minutos', 0
    );
  END IF;

  SELECT COALESCE(SUM(
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
  ), 0)::INT
  INTO v_he
  FROM movelaria_funcionario_ponto_marcacoes m
  INNER JOIN movelaria_funcionario_jornada j
    ON j.funcionario_id = p_funcionario_id AND j.ativo = true
  WHERE m.funcionario_id = p_funcionario_id
    AND m.tipo = 'saida'
    AND movelaria_ponto_data_local(m.registrado_em) BETWEEN p_inicio AND p_fim;

  SELECT COALESCE(SUM(GREATEST(0, COALESCE(m.atraso_minutos, 0))), 0)::INT
  INTO v_atrasos
  FROM movelaria_funcionario_ponto_marcacoes m
  WHERE m.funcionario_id = p_funcionario_id
    AND m.tipo = 'entrada'
    AND movelaria_ponto_data_local(m.registrado_em) BETWEEN p_inicio AND p_fim;

  SELECT COALESCE(SUM(
    movelaria_ponto_falta_minutos_debito(
      o.funcionario_id, o.data, o.abater_banco_horas, o.minutos_abatidos, o.observacao
    )
  ), 0)::INT
  INTO v_faltas
  FROM movelaria_funcionario_ponto_ocorrencias o
  WHERE o.funcionario_id = p_funcionario_id
    AND o.tipo = 'falta'
    AND o.data BETWEEN p_inicio AND p_fim;

  SELECT COALESCE(SUM(bm.minutos), 0)::INT
  INTO v_pagas
  FROM movelaria_ponto_banco_movimentos bm
  WHERE bm.funcionario_id = p_funcionario_id
    AND bm.tipo = 'pagamento_he'
    AND movelaria_ponto_data_local(bm.criado_em) BETWEEN p_inicio AND p_fim;

  RETURN jsonb_build_object(
    'hora_extra_minutos', v_he,
    'atrasos_minutos', v_atrasos,
    'faltas_banco_minutos', v_faltas,
    'he_pagas_minutos', v_pagas,
    'saldo_minutos', v_he - v_atrasos - v_faltas - v_pagas
  );
END;
$$;

-- Reparo: injustificadas passam a debitar com minutos da jornada
UPDATE movelaria_funcionario_ponto_ocorrencias o
SET
  abater_banco_horas = true,
  minutos_abatidos = NULLIF(movelaria_jornada_minutos_no_dia(o.funcionario_id, o.data), 0)
WHERE o.tipo = 'falta'
  AND NOT movelaria_ponto_falta_tem_justificativa(o.observacao)
  AND (
    o.abater_banco_horas = false
    OR o.minutos_abatidos IS NULL
    OR o.minutos_abatidos = 0
  );

-- Reparo: já marcadas para debitar mas sem minutos gravados
UPDATE movelaria_funcionario_ponto_ocorrencias o
SET minutos_abatidos = NULLIF(movelaria_jornada_minutos_no_dia(o.funcionario_id, o.data), 0)
WHERE o.tipo = 'falta'
  AND o.abater_banco_horas = true
  AND (o.minutos_abatidos IS NULL OR o.minutos_abatidos = 0);

-- Resumo: faltas_detalhe e faltas_banco_minutos usam a regra efetiva
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
  IF movelaria_meu_perfil() NOT IN ('administrador', 'financeiro', 'montador_admin') THEN
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
      'faltas_detalhe', COALESCE((
        SELECT jsonb_agg(
          jsonb_build_object(
            'data', to_char(x.dia, 'YYYY-MM-DD'),
            'observacao', x.observacao,
            'abater_banco_horas', x.abater_banco_horas,
            'minutos_abatidos', x.minutos_abatidos
          )
          ORDER BY x.dia
        )
        FROM (
          SELECT
            d.dia::date AS dia,
            COALESCE(o.observacao, 'Falta detectada automaticamente.') AS observacao,
            movelaria_ponto_falta_debita_caixa(
              COALESCE(o.abater_banco_horas, false),
              o.observacao
            ) AS abater_banco_horas,
            NULLIF(
              movelaria_ponto_falta_minutos_debito(
                f.id,
                d.dia::date,
                COALESCE(o.abater_banco_horas, false),
                o.minutos_abatidos,
                o.observacao
              ),
              0
            ) AS minutos_abatidos
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
          LEFT JOIN movelaria_funcionario_ponto_ocorrencias o
            ON o.funcionario_id = f.id
            AND o.data = d.dia
            AND o.tipo = 'falta'
          WHERE EXTRACT(ISODOW FROM d.dia)::INT = ANY(j.dias_uteis)
            AND NOT EXISTS (
              SELECT 1 FROM movelaria_funcionario_ponto_marcacoes m
              WHERE m.funcionario_id = f.id
                AND movelaria_ponto_data_local(m.registrado_em) = d.dia
            )
            AND NOT EXISTS (
              SELECT 1 FROM movelaria_funcionario_ponto_ocorrencias ox
              WHERE ox.funcionario_id = f.id
                AND ox.data = d.dia
                AND ox.tipo IN ('folga', 'abono')
            )
          UNION
          SELECT
            o.data AS dia,
            o.observacao,
            movelaria_ponto_falta_debita_caixa(o.abater_banco_horas, o.observacao),
            NULLIF(
              movelaria_ponto_falta_minutos_debito(
                o.funcionario_id, o.data, o.abater_banco_horas, o.minutos_abatidos, o.observacao
              ),
              0
            )
          FROM movelaria_funcionario_ponto_ocorrencias o
          WHERE o.funcionario_id = f.id
            AND o.tipo = 'falta'
            AND o.data BETWEEN v_inicio AND LEAST(v_fim, v_faltas_ate)
        ) x
      ), '[]'::jsonb),
      'faltas_banco_minutos', COALESCE((
        SELECT SUM(
          movelaria_ponto_falta_minutos_debito(
            o.funcionario_id, o.data, o.abater_banco_horas, o.minutos_abatidos, o.observacao
          )
        )::INT
        FROM movelaria_funcionario_ponto_ocorrencias o
        WHERE o.funcionario_id = f.id
          AND o.tipo = 'falta'
          AND o.data BETWEEN v_inicio AND LEAST(v_fim, v_faltas_ate)
      ), 0),
      'he_pagas_minutos', COALESCE((
        SELECT SUM(bm.minutos)::INT
        FROM movelaria_ponto_banco_movimentos bm
        WHERE bm.funcionario_id = f.id
          AND bm.tipo = 'pagamento_he'
          AND movelaria_ponto_data_local(bm.criado_em) BETWEEN v_inicio AND v_fim
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

GRANT EXECUTE ON FUNCTION movelaria_ponto_falta_minutos_debito(UUID, DATE, BOOLEAN, INT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION movelaria_ponto_falta_debita_caixa(BOOLEAN, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
