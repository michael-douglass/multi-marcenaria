-- ============================================================
-- GARBO Movelaria — Falta injustificada debita o banco de horas
-- Migration 222
-- ============================================================
-- Regra:
--   • Falta sem justificativa real → debita a carga do dia (caixa)
--   • Justificativa escrita / folga / abono → remove o débito
-- ============================================================

COMMENT ON COLUMN movelaria_funcionario_ponto_ocorrencias.abater_banco_horas IS
  'Se true, a falta (injustificada) desconta a carga do dia no saldo HE − atrasos do período.';
COMMENT ON COLUMN movelaria_funcionario_ponto_ocorrencias.minutos_abatidos IS
  'Minutos da jornada do dia gravados no débito (NULL se justificada ou sem abater).';

-- Motivo real (≠ vazio e ≠ texto automático do detector)
CREATE OR REPLACE FUNCTION movelaria_ponto_falta_tem_justificativa(p_observacao TEXT)
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT NULLIF(trim(COALESCE(p_observacao, '')), '') IS NOT NULL
    AND trim(p_observacao) <> 'Falta detectada automaticamente.';
$$;

-- Detector: falta automática já nasce debitando o caixa
CREATE OR REPLACE FUNCTION movelaria_ponto_detectar_faltas(
  p_data DATE DEFAULT movelaria_ponto_data_local(NOW() - INTERVAL '1 day')
)
RETURNS INT AS $$
DECLARE
  v_count INT := 0;
  v_rec RECORD;
  v_hora_sp INT := EXTRACT(HOUR FROM (NOW() AT TIME ZONE 'America/Sao_Paulo'))::INT;
  v_minutos INT;
BEGIN
  IF p_data > movelaria_ponto_data_local() THEN
    RETURN 0;
  END IF;
  IF p_data = movelaria_ponto_data_local() AND v_hora_sp < 23 THEN
    RETURN 0;
  END IF;

  FOR v_rec IN
    SELECT j.funcionario_id
    FROM movelaria_funcionario_jornada j
    JOIN movelaria_funcionarios f ON f.id = j.funcionario_id AND f.ativo = true
    WHERE j.ativo = true
      AND f.tipo IN ('montador', 'montador_admin', 'administrador_obras')
      AND EXTRACT(ISODOW FROM p_data)::INT = ANY(j.dias_uteis)
      AND p_data >= movelaria_ponto_data_inicio_vinculo(f.id)
      AND p_data <= movelaria_ponto_data_local()
      AND NOT EXISTS (
        SELECT 1 FROM movelaria_funcionario_ponto_marcacoes m
        WHERE m.funcionario_id = j.funcionario_id
          AND movelaria_ponto_data_local(m.registrado_em) = p_data
      )
      AND NOT EXISTS (
        SELECT 1 FROM movelaria_funcionario_ponto_ocorrencias o
        WHERE o.funcionario_id = j.funcionario_id
          AND o.data = p_data
          AND o.tipo IN ('folga', 'abono', 'falta')
      )
  LOOP
    v_minutos := movelaria_jornada_minutos_no_dia(v_rec.funcionario_id, p_data);

    INSERT INTO movelaria_funcionario_ponto_ocorrencias (
      funcionario_id, data, tipo, observacao, automatica,
      abater_banco_horas, minutos_abatidos
    ) VALUES (
      v_rec.funcionario_id, p_data, 'falta', 'Falta detectada automaticamente.', true,
      true, NULLIF(v_minutos, 0)
    )
    ON CONFLICT (funcionario_id, data, tipo) DO NOTHING;
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Salvar ocorrência: justificativa zera débito; injustificada debita;
-- folga/abono remove falta do dia.
DROP FUNCTION IF EXISTS movelaria_ponto_salvar_ocorrencia(UUID, DATE, TEXT, TEXT);
DROP FUNCTION IF EXISTS movelaria_ponto_salvar_ocorrencia(UUID, DATE, TEXT, TEXT, BOOLEAN);

CREATE OR REPLACE FUNCTION movelaria_ponto_salvar_ocorrencia(
  p_funcionario_id UUID,
  p_data DATE,
  p_tipo TEXT,
  p_observacao TEXT DEFAULT NULL,
  p_abater_banco_horas BOOLEAN DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_row movelaria_funcionario_ponto_ocorrencias%ROWTYPE;
  v_abater BOOLEAN := false;
  v_minutos INT := NULL;
  v_justificada BOOLEAN := false;
  v_obs TEXT := NULLIF(trim(COALESCE(p_observacao, '')), '');
BEGIN
  IF movelaria_meu_perfil() NOT IN ('administrador', 'financeiro') THEN
    RAISE EXCEPTION 'Sem permissão.';
  END IF;

  IF p_tipo NOT IN ('folga', 'falta', 'abono') THEN
    RAISE EXCEPTION 'Tipo de ocorrência inválido.';
  END IF;

  -- Folga/abono: tira a falta do dia (some da lista e do débito)
  IF p_tipo IN ('folga', 'abono') THEN
    DELETE FROM movelaria_funcionario_ponto_ocorrencias
    WHERE funcionario_id = p_funcionario_id
      AND data = p_data
      AND tipo = 'falta';

    INSERT INTO movelaria_funcionario_ponto_ocorrencias (
      funcionario_id, data, tipo, observacao, registrado_por,
      abater_banco_horas, minutos_abatidos, automatica
    ) VALUES (
      p_funcionario_id, p_data, p_tipo, v_obs, auth.uid(),
      false, NULL, false
    )
    ON CONFLICT (funcionario_id, data, tipo) DO UPDATE SET
      observacao = EXCLUDED.observacao,
      registrado_por = auth.uid(),
      abater_banco_horas = false,
      minutos_abatidos = NULL,
      automatica = false
    RETURNING * INTO v_row;

    RETURN to_jsonb(v_row);
  END IF;

  -- Falta: justificativa real remove débito; sem justificativa debita
  v_justificada := movelaria_ponto_falta_tem_justificativa(v_obs);

  IF v_justificada THEN
    v_abater := false;
    v_minutos := NULL;
  ELSE
    -- Injustificada: debita por padrão (NULL ou true); só false evita
    v_abater := COALESCE(p_abater_banco_horas, true);
    IF v_abater THEN
      v_minutos := NULLIF(movelaria_jornada_minutos_no_dia(p_funcionario_id, p_data), 0);
    END IF;
  END IF;

  INSERT INTO movelaria_funcionario_ponto_ocorrencias (
    funcionario_id, data, tipo, observacao, registrado_por,
    abater_banco_horas, minutos_abatidos, automatica
  ) VALUES (
    p_funcionario_id, p_data, 'falta',
    COALESCE(v_obs, 'Falta detectada automaticamente.'),
    auth.uid(),
    v_abater, v_minutos, false
  )
  ON CONFLICT (funcionario_id, data, tipo) DO UPDATE SET
    observacao = EXCLUDED.observacao,
    registrado_por = auth.uid(),
    abater_banco_horas = EXCLUDED.abater_banco_horas,
    minutos_abatidos = EXCLUDED.minutos_abatidos,
    automatica = CASE
      WHEN movelaria_funcionario_ponto_ocorrencias.automatica
        AND movelaria_ponto_falta_tem_justificativa(EXCLUDED.observacao)
      THEN false
      WHEN EXCLUDED.observacao = 'Falta detectada automaticamente.'
        AND EXCLUDED.abater_banco_horas
      THEN true
      ELSE movelaria_funcionario_ponto_ocorrencias.automatica
    END
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION movelaria_ponto_salvar_ocorrencia(UUID, DATE, TEXT, TEXT, BOOLEAN) TO authenticated;
GRANT EXECUTE ON FUNCTION movelaria_ponto_falta_tem_justificativa(TEXT) TO authenticated;

-- Backfill 1: faltas já justificadas deixam de debitar
UPDATE movelaria_funcionario_ponto_ocorrencias o
SET
  abater_banco_horas = false,
  minutos_abatidos = NULL
WHERE o.tipo = 'falta'
  AND o.abater_banco_horas = true
  AND movelaria_ponto_falta_tem_justificativa(o.observacao);

-- Backfill 2: faltas injustificadas (automáticas / sem motivo) passam a debitar
UPDATE movelaria_funcionario_ponto_ocorrencias o
SET
  abater_banco_horas = true,
  minutos_abatidos = NULLIF(movelaria_jornada_minutos_no_dia(o.funcionario_id, o.data), 0)
WHERE o.tipo = 'falta'
  AND o.abater_banco_horas = false
  AND NOT movelaria_ponto_falta_tem_justificativa(o.observacao);

NOTIFY pgrst, 'reload schema';
