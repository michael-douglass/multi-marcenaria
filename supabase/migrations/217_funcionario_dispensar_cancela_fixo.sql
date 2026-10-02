-- Migration 217: ao dispensar, cancela salário fixo a partir do próximo mês
-- (mantém o fixo do mês atual; remove cobranças pendentes futuras)

CREATE OR REPLACE FUNCTION movelaria_funcionario_cancelar_fixo_proximo_mes(
  p_funcionario_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_recorrencia_id UUID;
  v_usuario_id     UUID;
  v_fim_mes_atual  DATE;
  v_inicio_prox    DATE;
BEGIN
  v_fim_mes_atual := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month' - INTERVAL '1 day')::DATE;
  v_inicio_prox   := (date_trunc('month', CURRENT_DATE) + INTERVAL '1 month')::DATE;

  SELECT f.fixo_recorrencia_id, f.usuario_id
  INTO v_recorrencia_id, v_usuario_id
  FROM movelaria_funcionarios f
  WHERE f.id = p_funcionario_id;

  IF NOT FOUND THEN
    RETURN;
  END IF;

  -- Se a pasta não tem recorrência, tenta a do usuário montador ligado
  IF v_recorrencia_id IS NULL AND v_usuario_id IS NOT NULL THEN
    SELECT u.fixo_recorrencia_id
    INTO v_recorrencia_id
    FROM movelaria_usuarios u
    WHERE u.id = v_usuario_id;
  END IF;

  IF v_recorrencia_id IS NOT NULL THEN
    -- Remove reservas de caixa das parcelas futuras pendentes
    DELETE FROM movelaria_caixa_movimentacoes cm
    WHERE cm.conta_pagar_id IN (
      SELECT cp.id
      FROM movelaria_contas_pagar cp
      WHERE cp.recorrencia_id = v_recorrencia_id
        AND cp.status = 'pendente'
        AND cp.data_vencimento >= v_inicio_prox
    );

    -- Apaga cobranças de fixo do próximo mês em diante
    DELETE FROM movelaria_contas_pagar cp
    WHERE cp.recorrencia_id = v_recorrencia_id
      AND cp.status = 'pendente'
      AND cp.data_vencimento >= v_inicio_prox;

    -- Marca o fim da série no último dia do mês atual (mês corrente permanece)
    UPDATE movelaria_contas_pagar
    SET recorrencia_encerramento = v_fim_mes_atual,
        atualizado_em = NOW()
    WHERE recorrencia_id = v_recorrencia_id;
  END IF;

  UPDATE movelaria_funcionarios
  SET valor_fixo_mensal = 0,
      fixo_recorrencia_id = NULL,
      fixo_primeiro_vencimento = NULL,
      atualizado_em = NOW()
  WHERE id = p_funcionario_id;

  -- Mantém o salário da ficha de admissão alinhado (sem fixo)
  PERFORM movelaria_sync_admissao_salario_fixo(p_funcionario_id, 0);

  IF v_usuario_id IS NOT NULL THEN
    UPDATE movelaria_usuarios
    SET valor_fixo_mensal = 0,
        fixo_recorrencia_id = NULL,
        fixo_primeiro_vencimento = NULL,
        atualizado_em = NOW()
    WHERE id = v_usuario_id;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION movelaria_funcionario_cancelar_fixo_proximo_mes(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_funcionario_cancelar_fixo_proximo_mes(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION movelaria_funcionario_dispensar(p_funcionario_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_row movelaria_funcionarios%ROWTYPE;
BEGIN
  IF movelaria_meu_perfil() != 'administrador' THEN
    RAISE EXCEPTION 'Somente administrador pode dispensar funcionário.';
  END IF;

  SELECT * INTO v_row
    FROM movelaria_funcionarios
    WHERE id = p_funcionario_id
    FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Funcionário não encontrado.';
  END IF;

  IF NOT v_row.ativo THEN
    RAISE EXCEPTION 'Este funcionário já está dispensado.';
  END IF;

  UPDATE movelaria_funcionarios
  SET
    ativo = false,
    dispensado_em = NOW(),
    dispensado_por = auth.uid(),
    atualizado_em = NOW()
  WHERE id = p_funcionario_id;

  UPDATE movelaria_funcionario_jornada
  SET ativo = false, atualizado_em = NOW()
  WHERE funcionario_id = p_funcionario_id;

  -- Cancela salário fixo a partir do próximo mês (mantém o mês atual)
  PERFORM movelaria_funcionario_cancelar_fixo_proximo_mes(p_funcionario_id);

  SELECT * INTO v_row FROM movelaria_funcionarios WHERE id = p_funcionario_id;
  RETURN to_jsonb(v_row);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Retroativo: quem já foi dispensado e ainda tem fixo ativo
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT f.id
    FROM movelaria_funcionarios f
    WHERE f.ativo = false
      AND (
        COALESCE(f.valor_fixo_mensal, 0) > 0
        OR f.fixo_recorrencia_id IS NOT NULL
      )
  LOOP
    PERFORM movelaria_funcionario_cancelar_fixo_proximo_mes(r.id);
  END LOOP;
END;
$$;
