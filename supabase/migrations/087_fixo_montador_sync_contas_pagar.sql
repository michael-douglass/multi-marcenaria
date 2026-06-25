-- ============================================================
-- GARBO Movelaria — Sincronizar alterações de fixo em Contas a Pagar
-- Migration 087
-- Ao mudar valor ou data no painel Métricas, replica nas parcelas pendentes.
-- ============================================================

CREATE OR REPLACE FUNCTION movelaria_atualizar_fixo_montador(
  p_montador_id          UUID,
  p_valor                NUMERIC,
  p_primeiro_vencimento  DATE DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_perfil          TEXT := movelaria_meu_perfil();
  v_recorrencia_id  UUID;
  v_nome            TEXT;
  v_valor           NUMERIC(12, 2);
  v_valor_anterior  NUMERIC(12, 2);
  v_data_anterior   DATE;
  v_vencimento      DATE;
  v_valor_mudou     BOOLEAN;
  v_data_mudou      BOOLEAN;
BEGIN
  IF v_perfil NOT IN ('administrador', 'administrador_obras') THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem alterar o fixo do montador';
  END IF;

  IF p_valor IS NULL OR p_valor < 0 THEN
    RAISE EXCEPTION 'Valor fixo inválido';
  END IF;

  IF p_primeiro_vencimento IS NOT NULL AND p_primeiro_vencimento < CURRENT_DATE - INTERVAL '5 years' THEN
    RAISE EXCEPTION 'Data de pagamento inválida';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM movelaria_usuarios u
    WHERE u.id = p_montador_id
      AND u.perfil IN ('montador', 'montador_admin')
      AND u.ativo = true
  ) THEN
    RAISE EXCEPTION 'Montador não encontrado';
  END IF;

  v_valor := ROUND(p_valor::NUMERIC, 2);
  v_vencimento := p_primeiro_vencimento;

  SELECT u.fixo_recorrencia_id,
         COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1)),
         u.valor_fixo_mensal,
         u.fixo_primeiro_vencimento
  INTO v_recorrencia_id, v_nome, v_valor_anterior, v_data_anterior
  FROM movelaria_usuarios u
  WHERE u.id = p_montador_id;

  IF v_valor <= 0 THEN
    IF v_recorrencia_id IS NOT NULL THEN
      DELETE FROM movelaria_caixa_movimentacoes cm
      WHERE cm.conta_pagar_id IN (
        SELECT cp.id
        FROM movelaria_contas_pagar cp
        WHERE cp.recorrencia_id = v_recorrencia_id
          AND cp.status = 'pendente'
      );

      UPDATE movelaria_contas_pagar
      SET recorrencia_encerramento = CURRENT_DATE,
          atualizado_em = NOW()
      WHERE recorrencia_id = v_recorrencia_id
        AND status = 'pendente';
    END IF;

    UPDATE movelaria_usuarios
    SET valor_fixo_mensal = 0,
        fixo_recorrencia_id = NULL,
        fixo_primeiro_vencimento = NULL,
        atualizado_em = NOW()
    WHERE id = p_montador_id;

    RETURN;
  END IF;

  IF v_vencimento IS NULL AND v_recorrencia_id IS NULL THEN
    v_vencimento := movelaria_fixo_vencimento_mes(
      CURRENT_DATE,
      EXTRACT(YEAR  FROM CURRENT_DATE)::INTEGER,
      EXTRACT(MONTH FROM CURRENT_DATE)::INTEGER
    );
    IF v_vencimento < CURRENT_DATE THEN
      v_vencimento := movelaria_fixo_vencimento_mes(
        CURRENT_DATE,
        EXTRACT(YEAR  FROM (CURRENT_DATE + INTERVAL '1 month'))::INTEGER,
        EXTRACT(MONTH FROM (CURRENT_DATE + INTERVAL '1 month'))::INTEGER
      );
    END IF;
  END IF;

  v_valor_mudou := v_valor IS DISTINCT FROM COALESCE(v_valor_anterior, 0);
  v_data_mudou := v_vencimento IS NOT NULL
    AND v_vencimento IS DISTINCT FROM v_data_anterior;

  UPDATE movelaria_usuarios
  SET valor_fixo_mensal = v_valor,
      fixo_primeiro_vencimento = COALESCE(v_vencimento, fixo_primeiro_vencimento),
      atualizado_em = NOW()
  WHERE id = p_montador_id;

  IF v_recorrencia_id IS NOT NULL THEN
    IF v_data_mudou THEN
      DELETE FROM movelaria_caixa_movimentacoes cm
      WHERE cm.conta_pagar_id IN (
        SELECT cp.id
        FROM movelaria_contas_pagar cp
        WHERE cp.recorrencia_id = v_recorrencia_id
          AND cp.status = 'pendente'
      );

      DELETE FROM movelaria_contas_pagar cp
      WHERE cp.recorrencia_id = v_recorrencia_id
        AND cp.status = 'pendente';
    ELSE
      UPDATE movelaria_contas_pagar cp
      SET valor_parcela = v_valor,
          valor_total = v_valor,
          recorrencia_valor_base = v_valor,
          recorrencia_encerramento = NULL,
          fornecedor_nome = v_nome,
          descricao = 'Fixo montador: ' || v_nome,
          atualizado_em = NOW()
      WHERE cp.recorrencia_id = v_recorrencia_id
        AND cp.status = 'pendente';

      IF v_valor_mudou THEN
        UPDATE movelaria_caixa_movimentacoes cm
        SET valor = v_valor
        FROM movelaria_contas_pagar cp
        WHERE cm.conta_pagar_id = cp.id
          AND cp.recorrencia_id = v_recorrencia_id
          AND cp.status = 'pendente'
          AND cm.tipo_movimentacao = 'reserva';
      END IF;
    END IF;
  END IF;

  PERFORM movelaria_expandir_fixo_montador(p_montador_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_atualizar_fixo_montador(UUID, NUMERIC, DATE) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_atualizar_fixo_montador(UUID, NUMERIC, DATE) TO authenticated;

NOTIFY pgrst, 'reload schema';
