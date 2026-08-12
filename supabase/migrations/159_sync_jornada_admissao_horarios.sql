-- Migration 159: mantém horários da admissão e da jornada do ponto sincronizados

CREATE OR REPLACE FUNCTION movelaria_isodow_to_dia_admissao(p_dow INT)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE p_dow
    WHEN 1 THEN 'segunda'
    WHEN 2 THEN 'terca'
    WHEN 3 THEN 'quarta'
    WHEN 4 THEN 'quinta'
    WHEN 5 THEN 'sexta'
    WHEN 6 THEN 'sabado'
    WHEN 7 THEN 'domingo'
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION movelaria_dia_admissao_to_isodow(p_dia TEXT)
RETURNS INT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE lower(trim(COALESCE(p_dia, '')))
    WHEN 'segunda' THEN 1
    WHEN 'terca' THEN 2
    WHEN 'quarta' THEN 3
    WHEN 'quinta' THEN 4
    WHEN 'sexta' THEN 5
    WHEN 'sabado' THEN 6
    WHEN 'domingo' THEN 7
    ELSE NULL
  END;
$$;

CREATE OR REPLACE FUNCTION movelaria_fmt_hora_hhmm(p_hora TIME)
RETURNS TEXT
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT to_char(p_hora, 'HH24:MI');
$$;

-- Monta a grade da admissão a partir da jornada única do ponto.
CREATE OR REPLACE FUNCTION movelaria_horarios_admissao_from_jornada(
  p_hora_entrada TIME,
  p_hora_saida_intervalo TIME,
  p_hora_retorno_intervalo TIME,
  p_hora_saida TIME,
  p_dias_uteis INT[]
)
RETURNS JSONB
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_dias INT[];
  v_dia_nome TEXT;
  v_dow INT;
  v_ativos JSONB := '[]'::JSONB;
  v_semana JSONB := '{}'::JSONB;
  v_dia JSONB;
BEGIN
  SELECT COALESCE(ARRAY_AGG(d ORDER BY d), ARRAY[1, 2, 3, 4, 5])
  INTO v_dias
  FROM unnest(COALESCE(NULLIF(p_dias_uteis, '{}'), ARRAY[1, 2, 3, 4, 5])) AS d
  WHERE d BETWEEN 1 AND 7;

  v_dia := jsonb_build_object(
    'chegada', movelaria_fmt_hora_hhmm(p_hora_entrada),
    'saida_almoco', movelaria_fmt_hora_hhmm(COALESCE(p_hora_saida_intervalo, TIME '12:00')),
    'retorno_almoco', movelaria_fmt_hora_hhmm(COALESCE(p_hora_retorno_intervalo, TIME '13:00')),
    'saida_servico', movelaria_fmt_hora_hhmm(p_hora_saida)
  );

  FOREACH v_dow IN ARRAY v_dias
  LOOP
    v_dia_nome := movelaria_isodow_to_dia_admissao(v_dow);
    IF v_dia_nome IS NULL THEN
      CONTINUE;
    END IF;
    IF v_ativos @> jsonb_build_array(v_dia_nome) THEN
      CONTINUE;
    END IF;
    v_ativos := v_ativos || jsonb_build_array(v_dia_nome);
    v_semana := v_semana || jsonb_build_object(v_dia_nome, v_dia);
  END LOOP;

  RETURN jsonb_build_object(
    'horarios_dias_ativos', v_ativos,
    'horarios_semana', v_semana
  );
END;
$$;

-- Extrai a jornada do ponto a partir da grade da admissão.
CREATE OR REPLACE FUNCTION movelaria_jornada_from_admissao_dados(p_dados JSONB)
RETURNS TABLE (
  hora_entrada TIME,
  hora_saida_intervalo TIME,
  hora_retorno_intervalo TIME,
  hora_saida TIME,
  dias_uteis INT[]
)
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_semana JSONB := COALESCE(p_dados->'horarios_semana', '{}'::JSONB);
  v_ativos JSONB := COALESCE(p_dados->'horarios_dias_ativos', '[]'::JSONB);
  v_ordem TEXT[] := ARRAY['segunda','terca','quarta','quinta','sexta','sabado','domingo'];
  v_dia TEXT;
  v_base JSONB;
  v_dias INT[] := ARRAY[]::INT[];
  v_dow INT;
  v_chegada TEXT;
  v_saida TEXT;
BEGIN
  IF jsonb_typeof(v_ativos) = 'array' AND jsonb_array_length(v_ativos) > 0 THEN
    FOR v_dia IN SELECT jsonb_array_elements_text(v_ativos)
    LOOP
      v_dow := movelaria_dia_admissao_to_isodow(v_dia);
      IF v_dow IS NOT NULL AND NOT (v_dow = ANY (v_dias)) THEN
        v_dias := array_append(v_dias, v_dow);
      END IF;
    END LOOP;
  END IF;

  IF coalesce(array_length(v_dias, 1), 0) = 0 THEN
    FOREACH v_dia IN ARRAY v_ordem
    LOOP
      IF v_semana ? v_dia AND (
        NULLIF(trim(COALESCE(v_semana->v_dia->>'chegada', '')), '') IS NOT NULL
        OR NULLIF(trim(COALESCE(v_semana->v_dia->>'saida_servico', '')), '') IS NOT NULL
      ) THEN
        v_dias := array_append(v_dias, movelaria_dia_admissao_to_isodow(v_dia));
      END IF;
    END LOOP;
  END IF;

  IF coalesce(array_length(v_dias, 1), 0) = 0 THEN
    RETURN;
  END IF;

  v_dias := (SELECT ARRAY_AGG(d ORDER BY d) FROM unnest(v_dias) AS d);

  FOREACH v_dia IN ARRAY v_ordem
  LOOP
    IF movelaria_dia_admissao_to_isodow(v_dia) = ANY (v_dias)
      AND v_semana ? v_dia
      AND NULLIF(trim(COALESCE(v_semana->v_dia->>'chegada', '')), '') IS NOT NULL
      AND NULLIF(trim(COALESCE(v_semana->v_dia->>'saida_servico', '')), '') IS NOT NULL
    THEN
      v_base := v_semana->v_dia;
      EXIT;
    END IF;
  END LOOP;

  IF v_base IS NULL THEN
    RETURN;
  END IF;

  v_chegada := trim(v_base->>'chegada');
  v_saida := trim(v_base->>'saida_servico');

  RETURN QUERY SELECT
    v_chegada::TIME,
    COALESCE(NULLIF(trim(COALESCE(v_base->>'saida_almoco', '')), '')::TIME, TIME '12:00'),
    COALESCE(NULLIF(trim(COALESCE(v_base->>'retorno_almoco', '')), '')::TIME, TIME '13:00'),
    v_saida::TIME,
    v_dias;
END;
$$;

-- Ao salvar a jornada do ponto, espelha na admissão.
CREATE OR REPLACE FUNCTION movelaria_ponto_salvar_jornada(
  p_funcionario_id UUID,
  p_hora_entrada TIME,
  p_hora_saida_intervalo TIME,
  p_hora_retorno_intervalo TIME,
  p_hora_saida TIME,
  p_tolerancia_minutos INT DEFAULT 5,
  p_dias_uteis INT[] DEFAULT ARRAY[1, 2, 3, 4, 5],
  p_ativo BOOLEAN DEFAULT true
)
RETURNS JSONB AS $$
DECLARE
  v_row movelaria_funcionario_jornada%ROWTYPE;
  v_patch JSONB;
BEGIN
  IF movelaria_meu_perfil() NOT IN ('administrador', 'financeiro') THEN
    RAISE EXCEPTION 'Sem permissão para configurar jornada.';
  END IF;

  PERFORM set_config('movelaria.sync_horarios', '1', true);

  INSERT INTO movelaria_funcionario_jornada (
    funcionario_id, hora_entrada, hora_saida_intervalo,
    hora_retorno_intervalo, hora_saida, tolerancia_minutos, dias_uteis, ativo
  ) VALUES (
    p_funcionario_id, p_hora_entrada, p_hora_saida_intervalo,
    p_hora_retorno_intervalo, p_hora_saida, p_tolerancia_minutos, p_dias_uteis, p_ativo
  )
  ON CONFLICT (funcionario_id) DO UPDATE SET
    hora_entrada = EXCLUDED.hora_entrada,
    hora_saida_intervalo = EXCLUDED.hora_saida_intervalo,
    hora_retorno_intervalo = EXCLUDED.hora_retorno_intervalo,
    hora_saida = EXCLUDED.hora_saida,
    tolerancia_minutos = EXCLUDED.tolerancia_minutos,
    dias_uteis = EXCLUDED.dias_uteis,
    ativo = EXCLUDED.ativo,
    atualizado_em = NOW()
  RETURNING * INTO v_row;

  v_patch := movelaria_horarios_admissao_from_jornada(
    v_row.hora_entrada,
    v_row.hora_saida_intervalo,
    v_row.hora_retorno_intervalo,
    v_row.hora_saida,
    v_row.dias_uteis
  );

  UPDATE movelaria_funcionarios
  SET
    admissao_dados = COALESCE(admissao_dados, '{}'::JSONB) || v_patch,
    atualizado_em = NOW()
  WHERE id = p_funcionario_id;

  RETURN to_jsonb(v_row);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Quando a admissão muda os horários, espelha na jornada do ponto.
CREATE OR REPLACE FUNCTION movelaria_sync_jornada_from_admissao_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jornada RECORD;
BEGIN
  IF current_setting('movelaria.sync_horarios', true) = '1' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE'
    AND NEW.admissao_dados->'horarios_semana' IS NOT DISTINCT FROM OLD.admissao_dados->'horarios_semana'
    AND NEW.admissao_dados->'horarios_dias_ativos' IS NOT DISTINCT FROM OLD.admissao_dados->'horarios_dias_ativos'
  THEN
    RETURN NEW;
  END IF;

  SELECT * INTO v_jornada
  FROM movelaria_jornada_from_admissao_dados(NEW.admissao_dados);

  IF NOT FOUND OR v_jornada.hora_entrada IS NULL OR v_jornada.hora_saida IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM set_config('movelaria.sync_horarios', '1', true);

  INSERT INTO movelaria_funcionario_jornada (
    funcionario_id, hora_entrada, hora_saida_intervalo,
    hora_retorno_intervalo, hora_saida, tolerancia_minutos, dias_uteis, ativo
  ) VALUES (
    NEW.id,
    v_jornada.hora_entrada,
    v_jornada.hora_saida_intervalo,
    v_jornada.hora_retorno_intervalo,
    v_jornada.hora_saida,
    COALESCE(
      (SELECT tolerancia_minutos FROM movelaria_funcionario_jornada WHERE funcionario_id = NEW.id),
      5
    ),
    v_jornada.dias_uteis,
    COALESCE(
      (SELECT ativo FROM movelaria_funcionario_jornada WHERE funcionario_id = NEW.id),
      true
    )
  )
  ON CONFLICT (funcionario_id) DO UPDATE SET
    hora_entrada = EXCLUDED.hora_entrada,
    hora_saida_intervalo = EXCLUDED.hora_saida_intervalo,
    hora_retorno_intervalo = EXCLUDED.hora_retorno_intervalo,
    hora_saida = EXCLUDED.hora_saida,
    dias_uteis = EXCLUDED.dias_uteis,
    atualizado_em = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_movelaria_sync_jornada_from_admissao ON movelaria_funcionarios;
CREATE TRIGGER trg_movelaria_sync_jornada_from_admissao
  AFTER INSERT OR UPDATE OF admissao_dados ON movelaria_funcionarios
  FOR EACH ROW
  EXECUTE FUNCTION movelaria_sync_jornada_from_admissao_trigger();

-- Backfill: quem tem jornada e ainda não tem grade na admissão.
UPDATE movelaria_funcionarios f
SET
  admissao_dados = COALESCE(f.admissao_dados, '{}'::JSONB) || movelaria_horarios_admissao_from_jornada(
    j.hora_entrada,
    j.hora_saida_intervalo,
    j.hora_retorno_intervalo,
    j.hora_saida,
    j.dias_uteis
  ),
  atualizado_em = NOW()
FROM movelaria_funcionario_jornada j
WHERE j.funcionario_id = f.id
  AND j.ativo = true
  AND (
    f.admissao_dados->'horarios_semana' IS NULL
    OR f.admissao_dados->'horarios_semana' = '{}'::JSONB
    OR NULLIF(trim(COALESCE(f.admissao_dados->'horarios_semana'->'segunda'->>'chegada', '')), '') IS NULL
  );

-- Backfill: quem tem grade na admissão e ainda não tem jornada.
INSERT INTO movelaria_funcionario_jornada (
  funcionario_id, hora_entrada, hora_saida_intervalo,
  hora_retorno_intervalo, hora_saida, tolerancia_minutos, dias_uteis, ativo
)
SELECT
  f.id,
  j.hora_entrada,
  j.hora_saida_intervalo,
  j.hora_retorno_intervalo,
  j.hora_saida,
  5,
  j.dias_uteis,
  true
FROM movelaria_funcionarios f
CROSS JOIN LATERAL movelaria_jornada_from_admissao_dados(f.admissao_dados) j
WHERE f.ativo = true
  AND j.hora_entrada IS NOT NULL
  AND j.hora_saida IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM movelaria_funcionario_jornada x WHERE x.funcionario_id = f.id
  )
ON CONFLICT (funcionario_id) DO NOTHING;

GRANT EXECUTE ON FUNCTION movelaria_ponto_salvar_jornada(UUID, TIME, TIME, TIME, TIME, INT, INT[], BOOLEAN) TO authenticated;

NOTIFY pgrst, 'reload schema';
