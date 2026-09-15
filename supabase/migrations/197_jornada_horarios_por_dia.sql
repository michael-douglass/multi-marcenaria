-- ============================================================
-- GARBO Movelaria — Jornada com horários por dia da semana
-- Migration 197
-- ============================================================

ALTER TABLE movelaria_funcionario_jornada
  ADD COLUMN IF NOT EXISTS horarios_semana JSONB;

COMMENT ON COLUMN movelaria_funcionario_jornada.horarios_semana IS
  'Grade por dia (mesma estrutura de admissao_dados.horarios_semana). Flat hora_* continua como fallback.';

-- Backfill a partir da admissão
UPDATE movelaria_funcionario_jornada j
SET horarios_semana = f.admissao_dados->'horarios_semana',
    atualizado_em = NOW()
FROM movelaria_funcionarios f
WHERE f.id = j.funcionario_id
  AND j.horarios_semana IS NULL
  AND f.admissao_dados ? 'horarios_semana'
  AND jsonb_typeof(f.admissao_dados->'horarios_semana') = 'object'
  AND f.admissao_dados->'horarios_semana' <> '{}'::jsonb;

-- Hora prevista no dia (ISODOW 1=seg … 7=dom), respeitando a grade por dia.
CREATE OR REPLACE FUNCTION movelaria_jornada_hora_no_dia(
  p_jornada movelaria_funcionario_jornada,
  p_dow INT,
  p_campo TEXT
)
RETURNS TIME
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
  v_dia TEXT;
  v_raw TEXT;
  v_semana JSONB := COALESCE(p_jornada.horarios_semana, '{}'::JSONB);
BEGIN
  v_dia := movelaria_isodow_to_dia_admissao(p_dow);
  IF v_dia IS NOT NULL AND v_semana ? v_dia THEN
    v_raw := NULLIF(trim(COALESCE(v_semana->v_dia->>p_campo, '')), '');
    IF v_raw IS NOT NULL THEN
      RETURN v_raw::TIME;
    END IF;
  END IF;

  RETURN CASE p_campo
    WHEN 'chegada' THEN p_jornada.hora_entrada
    WHEN 'saida_almoco' THEN p_jornada.hora_saida_intervalo
    WHEN 'retorno_almoco' THEN p_jornada.hora_retorno_intervalo
    WHEN 'saida_servico' THEN p_jornada.hora_saida
    ELSE NULL
  END;
END;
$$;

-- Trigger: admissão → jornada (preserva grade completa)
CREATE OR REPLACE FUNCTION movelaria_sync_jornada_from_admissao_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_jornada RECORD;
  v_semana JSONB;
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

  v_semana := NEW.admissao_dados->'horarios_semana';

  PERFORM set_config('movelaria.sync_horarios', '1', true);

  INSERT INTO movelaria_funcionario_jornada (
    funcionario_id, hora_entrada, hora_saida_intervalo,
    hora_retorno_intervalo, hora_saida, tolerancia_minutos, dias_uteis, ativo,
    horarios_semana
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
    ),
    v_semana
  )
  ON CONFLICT (funcionario_id) DO UPDATE SET
    hora_entrada = EXCLUDED.hora_entrada,
    hora_saida_intervalo = EXCLUDED.hora_saida_intervalo,
    hora_retorno_intervalo = EXCLUDED.hora_retorno_intervalo,
    hora_saida = EXCLUDED.hora_saida,
    dias_uteis = EXCLUDED.dias_uteis,
    horarios_semana = COALESCE(EXCLUDED.horarios_semana, movelaria_funcionario_jornada.horarios_semana),
    atualizado_em = NOW();

  RETURN NEW;
END;
$$;

-- Salvar jornada do ponto: aceita grade por dia (não achata todos os dias)
DROP FUNCTION IF EXISTS movelaria_ponto_salvar_jornada(UUID, TIME, TIME, TIME, TIME, INT, INT[], BOOLEAN);

CREATE OR REPLACE FUNCTION movelaria_ponto_salvar_jornada(
  p_funcionario_id UUID,
  p_hora_entrada TIME,
  p_hora_saida_intervalo TIME,
  p_hora_retorno_intervalo TIME,
  p_hora_saida TIME,
  p_tolerancia_minutos INT DEFAULT 5,
  p_dias_uteis INT[] DEFAULT ARRAY[1, 2, 3, 4, 5],
  p_ativo BOOLEAN DEFAULT true,
  p_grade JSONB DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_row movelaria_funcionario_jornada%ROWTYPE;
  v_patch JSONB;
  v_semana JSONB;
  v_ativos JSONB;
BEGIN
  IF NOT movelaria_usuario_tem_algum_perfil(
    ARRAY['administrador', 'financeiro', 'administrador_obras']
  ) THEN
    RAISE EXCEPTION 'Sem permissão para configurar jornada.';
  END IF;

  PERFORM set_config('movelaria.sync_horarios', '1', true);

  IF p_grade IS NOT NULL AND p_grade ? 'horarios_semana' THEN
    v_semana := p_grade->'horarios_semana';
    v_ativos := COALESCE(p_grade->'horarios_dias_ativos', '[]'::JSONB);
  ELSE
    v_semana := NULL;
    v_ativos := NULL;
  END IF;

  INSERT INTO movelaria_funcionario_jornada (
    funcionario_id, hora_entrada, hora_saida_intervalo,
    hora_retorno_intervalo, hora_saida, tolerancia_minutos, dias_uteis, ativo,
    horarios_semana
  ) VALUES (
    p_funcionario_id, p_hora_entrada, p_hora_saida_intervalo,
    p_hora_retorno_intervalo, p_hora_saida, p_tolerancia_minutos, p_dias_uteis, p_ativo,
    v_semana
  )
  ON CONFLICT (funcionario_id) DO UPDATE SET
    hora_entrada = EXCLUDED.hora_entrada,
    hora_saida_intervalo = EXCLUDED.hora_saida_intervalo,
    hora_retorno_intervalo = EXCLUDED.hora_retorno_intervalo,
    hora_saida = EXCLUDED.hora_saida,
    tolerancia_minutos = EXCLUDED.tolerancia_minutos,
    dias_uteis = EXCLUDED.dias_uteis,
    ativo = EXCLUDED.ativo,
    horarios_semana = COALESCE(EXCLUDED.horarios_semana, movelaria_funcionario_jornada.horarios_semana),
    atualizado_em = NOW()
  RETURNING * INTO v_row;

  IF v_semana IS NOT NULL THEN
    v_patch := jsonb_build_object(
      'horarios_semana', v_semana,
      'horarios_dias_ativos', COALESCE(v_ativos, '[]'::JSONB)
    );
  ELSIF v_row.horarios_semana IS NOT NULL AND v_row.horarios_semana <> '{}'::JSONB THEN
    -- Atualiza só os dias marcados, sem forçar o mesmo horário em todos
    v_patch := jsonb_build_object(
      'horarios_semana', v_row.horarios_semana,
      'horarios_dias_ativos', (
        SELECT COALESCE(jsonb_agg(movelaria_isodow_to_dia_admissao(d) ORDER BY d), '[]'::JSONB)
        FROM unnest(v_row.dias_uteis) AS d
      )
    );
  ELSE
    v_patch := movelaria_horarios_admissao_from_jornada(
      v_row.hora_entrada,
      v_row.hora_saida_intervalo,
      v_row.hora_retorno_intervalo,
      v_row.hora_saida,
      v_row.dias_uteis
    );
  END IF;

  UPDATE movelaria_funcionarios
  SET
    admissao_dados = COALESCE(admissao_dados, '{}'::JSONB) || v_patch,
    atualizado_em = NOW()
  WHERE id = p_funcionario_id;

  RETURN to_jsonb(v_row);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION movelaria_ponto_salvar_jornada(UUID, TIME, TIME, TIME, TIME, INT, INT[], BOOLEAN, JSONB) TO authenticated;
