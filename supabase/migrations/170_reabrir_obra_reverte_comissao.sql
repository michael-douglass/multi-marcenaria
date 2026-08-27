-- ============================================================
-- GARBO Movelaria — Reabrir obra concluída e reverter comissão
-- Migration 170
--
-- Ao concluir, a comissão definida vira Contas a Pagar (gerada).
-- Reabrir devolve a obra ao andamento e a comissão à previsão:
-- os lançamentos gerados somem; os valores definidos na obra ficam.
-- Montador admin, administrador e administrador de obras podem executar.
-- ============================================================

CREATE OR REPLACE FUNCTION movelaria_reabrir_obra(
  p_obra_id UUID,
  p_status_destino TEXT DEFAULT NULL
)
RETURNS void AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_uid    UUID := auth.uid();
  v_status TEXT;
  v_status_atual TEXT;
  v_iniciado TIMESTAMPTZ;
  v_data_inicio DATE;
  v_data_fim DATE;
  v_hoje DATE := (NOW() AT TIME ZONE 'America/Sao_Paulo')::DATE;
BEGIN
  IF v_perfil IS NULL THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_perfil NOT IN ('administrador', 'administrador_obras', 'montador_admin') THEN
    RAISE EXCEPTION 'Acesso negado: somente montador administrativo ou administradores podem reabrir a obra';
  END IF;

  IF v_perfil = 'montador_admin' AND NOT movelaria_montador_admin_acessa_obra(p_obra_id, v_uid) THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  SELECT status_kanban, iniciado_em, data_prevista_inicio, data_prevista_fim
  INTO v_status_atual, v_iniciado, v_data_inicio, v_data_fim
  FROM movelaria_obras
  WHERE id = p_obra_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Obra não encontrada';
  END IF;

  IF v_status_atual IS DISTINCT FROM 'concluida' THEN
    RAISE EXCEPTION 'Só é possível reabrir uma obra marcada como concluída';
  END IF;

  IF p_status_destino IS NOT NULL THEN
    IF p_status_destino NOT IN ('datas_em_aberto', 'datas_em_atraso', 'datas_definidas', 'em_andamento') THEN
      RAISE EXCEPTION 'Status de destino inválido para reabrir a obra';
    END IF;
    v_status := p_status_destino;
  ELSIF v_iniciado IS NOT NULL THEN
    v_status := 'em_andamento';
  ELSIF v_data_fim IS NOT NULL AND v_data_fim < v_hoje THEN
    v_status := 'datas_em_atraso';
  ELSIF v_data_inicio IS NOT NULL OR v_data_fim IS NOT NULL THEN
    v_status := 'datas_definidas';
  ELSE
    v_status := 'datas_em_aberto';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM movelaria_contas_pagar cp
    WHERE cp.obra_id = p_obra_id
      AND cp.fornecedor_nome ILIKE 'Comissão:%'
      AND (
        cp.status IN ('pago', 'parcialmente_pago')
        OR COALESCE(cp.valor_pago, 0) > 0.009
      )
  ) THEN
    RAISE EXCEPTION 'Não é possível reabrir: a comissão desta obra já foi paga. Estorne o pagamento em Contas a Pagar primeiro.';
  END IF;

  -- Remove reservas/pagamentos ligados às comissões geradas desta obra
  DELETE FROM movelaria_caixa_movimentacoes m
  WHERE m.conta_pagar_id IN (
    SELECT cp.id
    FROM movelaria_contas_pagar cp
    WHERE cp.obra_id = p_obra_id
      AND cp.fornecedor_nome ILIKE 'Comissão:%'
  );

  -- Remove os lançamentos gerados; os valores definidos na obra permanecem
  DELETE FROM movelaria_contas_pagar
  WHERE obra_id = p_obra_id
    AND fornecedor_nome ILIKE 'Comissão:%';

  UPDATE movelaria_obra_responsaveis
  SET finalizado_em = NULL
  WHERE obra_id = p_obra_id
    AND finalizado_em IS NOT NULL;

  UPDATE movelaria_obras
  SET status_kanban      = v_status,
      finalizado_em      = NULL,
      duracao_real_horas = NULL,
      comissao_gerada    = false,
      atualizado_em      = NOW()
  WHERE id = p_obra_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_reabrir_obra(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_reabrir_obra(UUID, TEXT) TO authenticated;

NOTIFY pgrst, 'reload schema';
