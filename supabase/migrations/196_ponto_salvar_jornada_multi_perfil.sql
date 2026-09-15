-- ============================================================
-- GARBO Movelaria — Permissão multi-perfil ao salvar jornada
-- Migration 196
-- ============================================================

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
  IF NOT movelaria_usuario_tem_algum_perfil(
    ARRAY['administrador', 'financeiro', 'administrador_obras']
  ) THEN
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

GRANT EXECUTE ON FUNCTION movelaria_ponto_salvar_jornada(UUID, TIME, TIME, TIME, TIME, INT, INT[], BOOLEAN) TO authenticated;
