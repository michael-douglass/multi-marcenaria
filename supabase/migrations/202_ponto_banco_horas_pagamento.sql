-- ============================================================
-- GARBO Movelaria — Banco de horas: pagamentos HE + saldo acumulado
-- Migration 202
-- ============================================================

-- Movimentos que consomem horas extras (pagamento → Conta a Pagar)
CREATE TABLE IF NOT EXISTS movelaria_ponto_banco_movimentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  funcionario_id UUID NOT NULL REFERENCES movelaria_funcionarios(id) ON DELETE CASCADE,
  tipo TEXT NOT NULL CHECK (tipo IN ('pagamento_he')),
  minutos INT NOT NULL CHECK (minutos > 0),
  valor_hora NUMERIC(12, 4) NOT NULL CHECK (valor_hora >= 0),
  valor_total NUMERIC(12, 2) NOT NULL CHECK (valor_total >= 0),
  conta_pagar_id UUID REFERENCES movelaria_contas_pagar(id) ON DELETE SET NULL,
  observacao TEXT,
  criado_por UUID REFERENCES auth.users(id),
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ponto_banco_mov_func
  ON movelaria_ponto_banco_movimentos (funcionario_id, criado_em DESC);

COMMENT ON TABLE movelaria_ponto_banco_movimentos IS
  'Lançamentos do banco de horas (ex.: HE convertida em Conta a Pagar).';

ALTER TABLE movelaria_ponto_banco_movimentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ponto_banco_mov_select" ON movelaria_ponto_banco_movimentos;
CREATE POLICY "ponto_banco_mov_select" ON movelaria_ponto_banco_movimentos
  FOR SELECT TO authenticated
  USING (
    movelaria_meu_perfil() IN ('administrador', 'financeiro', 'montador_admin')
    OR EXISTS (
      SELECT 1 FROM movelaria_funcionarios f
      WHERE f.id = funcionario_id AND f.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "ponto_banco_mov_write" ON movelaria_ponto_banco_movimentos;
CREATE POLICY "ponto_banco_mov_write" ON movelaria_ponto_banco_movimentos
  FOR ALL TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro'))
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

-- Componentes do banco (HE, atrasos, faltas abatidas, HE pagas) em um intervalo
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

  SELECT COALESCE(SUM(COALESCE(o.minutos_abatidos, 0)), 0)::INT
  INTO v_faltas
  FROM movelaria_funcionario_ponto_ocorrencias o
  WHERE o.funcionario_id = p_funcionario_id
    AND o.tipo = 'falta'
    AND o.abater_banco_horas = true
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

-- Saldo acumulado desde o início do ponto (2026-07-01) até hoje
CREATE OR REPLACE FUNCTION movelaria_ponto_saldo_acumulado(p_funcionario_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje DATE := movelaria_ponto_data_local();
  v_inicio DATE := DATE '2026-07-01';
  v_comp JSONB;
  v_jornada movelaria_funcionario_jornada%ROWTYPE;
  v_min_ref INT := 0;
  v_dow INT;
  v_data_ref DATE;
  v_func RECORD;
  v_fixo NUMERIC(12, 2) := 0;
BEGIN
  IF movelaria_meu_perfil() NOT IN ('administrador', 'financeiro', 'montador_admin') THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;

  SELECT f.id, f.nome, f.usuario_id, COALESCE(f.valor_fixo_mensal, 0) AS valor_fixo_mensal
  INTO v_func
  FROM movelaria_funcionarios f
  WHERE f.id = p_funcionario_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Funcionário não encontrado.';
  END IF;

  v_fixo := COALESCE(v_func.valor_fixo_mensal, 0);
  v_comp := movelaria_ponto_banco_componentes(p_funcionario_id, v_inicio, v_hoje);

  SELECT * INTO v_jornada
  FROM movelaria_funcionario_jornada
  WHERE funcionario_id = p_funcionario_id AND ativo = true
  LIMIT 1;

  IF FOUND AND v_jornada.dias_uteis IS NOT NULL AND array_length(v_jornada.dias_uteis, 1) > 0 THEN
    v_dow := v_jornada.dias_uteis[1];
    -- Encontra a próxima data com esse ISODOW a partir de hoje (ou hoje se bater)
    v_data_ref := v_hoje + ((v_dow - EXTRACT(ISODOW FROM v_hoje)::INT + 7) % 7);
    v_min_ref := movelaria_jornada_minutos_no_dia(p_funcionario_id, v_data_ref);
  END IF;

  IF v_min_ref <= 0 THEN
    v_min_ref := 480; -- fallback 8h
  END IF;

  RETURN jsonb_build_object(
    'funcionario_id', p_funcionario_id,
    'nome', v_func.nome,
    'usuario_id', v_func.usuario_id,
    'valor_fixo_mensal', v_fixo,
    'inicio', to_char(v_inicio, 'YYYY-MM-DD'),
    'fim', to_char(v_hoje, 'YYYY-MM-DD'),
    'hora_extra_minutos', COALESCE((v_comp->>'hora_extra_minutos')::INT, 0),
    'atrasos_minutos', COALESCE((v_comp->>'atrasos_minutos')::INT, 0),
    'faltas_banco_minutos', COALESCE((v_comp->>'faltas_banco_minutos')::INT, 0),
    'he_pagas_minutos', COALESCE((v_comp->>'he_pagas_minutos')::INT, 0),
    'saldo_minutos', COALESCE((v_comp->>'saldo_minutos')::INT, 0),
    'minutos_jornada_ref', v_min_ref,
    'dias_uteis', COALESCE(v_jornada.dias_uteis, ARRAY[1,2,3,4,5]::INT[])
  );
END;
$$;

-- Converte minutos de HE em Conta a Pagar e consome do banco
CREATE OR REPLACE FUNCTION movelaria_ponto_pagar_hora_extra(
  p_funcionario_id UUID,
  p_minutos INT,
  p_valor_hora NUMERIC,
  p_data_vencimento DATE,
  p_observacao TEXT DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hoje DATE := movelaria_ponto_data_local();
  v_inicio DATE := DATE '2026-07-01';
  v_comp JSONB;
  v_saldo INT;
  v_minutos INT := GREATEST(0, FLOOR(COALESCE(p_minutos, 0))::INT);
  v_valor_hora NUMERIC(12, 4) := COALESCE(p_valor_hora, 0);
  v_valor_total NUMERIC(12, 2);
  v_func RECORD;
  v_cp_id UUID;
  v_mov_id UUID;
  v_desc TEXT;
  v_h INT;
  v_m INT;
BEGIN
  IF movelaria_meu_perfil() NOT IN ('administrador', 'financeiro') THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;

  IF v_minutos <= 0 THEN
    RAISE EXCEPTION 'Informe minutos positivos para pagar.';
  END IF;

  IF v_valor_hora < 0 THEN
    RAISE EXCEPTION 'Valor/hora inválido.';
  END IF;

  IF p_data_vencimento IS NULL THEN
    RAISE EXCEPTION 'Informe a data de vencimento.';
  END IF;

  SELECT f.id, f.nome, f.usuario_id
  INTO v_func
  FROM movelaria_funcionarios f
  WHERE f.id = p_funcionario_id AND f.ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Funcionário não encontrado.';
  END IF;

  v_comp := movelaria_ponto_banco_componentes(p_funcionario_id, v_inicio, v_hoje);
  v_saldo := COALESCE((v_comp->>'saldo_minutos')::INT, 0);

  IF v_minutos > v_saldo THEN
    RAISE EXCEPTION 'Minutos (%) excedem o saldo disponível (%).', v_minutos, v_saldo;
  END IF;

  v_valor_total := ROUND((v_minutos::NUMERIC / 60.0) * v_valor_hora, 2);
  v_h := v_minutos / 60;
  v_m := v_minutos % 60;
  v_desc := format(
    'Horas extras — %sh %smin (R$ %s/h)',
    v_h,
    lpad(v_m::TEXT, 2, '0'),
    trim(to_char(v_valor_hora, 'FM999999990.00'))
  );

  INSERT INTO movelaria_contas_pagar (
    prestador_id,
    fornecedor_nome,
    descricao,
    observacao,
    valor_total,
    numero_parcela,
    total_parcelas,
    valor_parcela,
    data_vencimento,
    status,
    valor_pago,
    grupo_lancamento_id
  ) VALUES (
    v_func.usuario_id,
    v_func.nome,
    v_desc,
    NULLIF(trim(COALESCE(p_observacao, '')), ''),
    v_valor_total,
    1,
    1,
    v_valor_total,
    p_data_vencimento,
    'pendente',
    0,
    gen_random_uuid()
  )
  RETURNING id INTO v_cp_id;

  INSERT INTO movelaria_ponto_banco_movimentos (
    funcionario_id, tipo, minutos, valor_hora, valor_total,
    conta_pagar_id, observacao, criado_por
  ) VALUES (
    p_funcionario_id, 'pagamento_he', v_minutos, v_valor_hora, v_valor_total,
    v_cp_id, NULLIF(trim(COALESCE(p_observacao, '')), ''), auth.uid()
  )
  RETURNING id INTO v_mov_id;

  RETURN jsonb_build_object(
    'movimento_id', v_mov_id,
    'conta_pagar_id', v_cp_id,
    'minutos', v_minutos,
    'valor_hora', v_valor_hora,
    'valor_total', v_valor_total,
    'saldo_restante_minutos', v_saldo - v_minutos,
    'descricao', v_desc
  );
END;
$$;

-- Resumo do período: inclui he_pagas_minutos no JSON de cada funcionário
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
            o.observacao,
            COALESCE(o.abater_banco_horas, false) AS abater_banco_horas,
            o.minutos_abatidos
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
            COALESCE(o.abater_banco_horas, false) AS abater_banco_horas,
            o.minutos_abatidos
          FROM movelaria_funcionario_ponto_ocorrencias o
          WHERE o.funcionario_id = f.id
            AND o.tipo = 'falta'
            AND o.data BETWEEN v_inicio AND LEAST(v_fim, v_faltas_ate)
        ) x
      ), '[]'::jsonb),
      'faltas_banco_minutos', COALESCE((
        SELECT SUM(COALESCE(o.minutos_abatidos, 0))::INT
        FROM movelaria_funcionario_ponto_ocorrencias o
        WHERE o.funcionario_id = f.id
          AND o.tipo = 'falta'
          AND o.abater_banco_horas = true
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

NOTIFY pgrst, 'reload schema';
