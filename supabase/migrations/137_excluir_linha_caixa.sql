-- ============================================================
-- GARBO Movelaria — Excluir linha / movimentação do Caixa
-- Migration 137
--
-- Funções usadas pela tela /caixa para apagar com segurança:
-- 1) Linha consolidada (movimentações + Contas a Pagar do mês)
-- 2) Uma movimentação isolada
-- ============================================================

CREATE OR REPLACE FUNCTION public.movelaria_excluir_linha_caixa(
  p_destinatario_id   TEXT,
  p_destinatario_nome TEXT,
  p_mes               INTEGER,
  p_ano               INTEGER
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perfil          TEXT;
  v_nome_key        TEXT;
  v_dest_uuid       UUID;
  v_start           DATE;
  v_end             DATE;
  v_mov_apagadas    INTEGER := 0;
  v_cp_apagadas     INTEGER := 0;
  v_is_virtual      BOOLEAN;
BEGIN
  v_perfil := movelaria_meu_perfil();
  IF v_perfil IS DISTINCT FROM 'administrador'
     AND v_perfil IS DISTINCT FROM 'financeiro' THEN
    RAISE EXCEPTION 'Acesso negado: somente administrador ou financeiro podem excluir do Caixa.';
  END IF;

  IF p_mes IS NULL OR p_mes < 1 OR p_mes > 12 OR p_ano IS NULL OR p_ano < 2000 THEN
    RAISE EXCEPTION 'Mês/ano inválidos.';
  END IF;

  v_nome_key := lower(trim(COALESCE(p_destinatario_nome, '')));
  IF v_nome_key = '' THEN
    RAISE EXCEPTION 'Destinatário inválido.';
  END IF;

  v_is_virtual := COALESCE(p_destinatario_id, '') LIKE '__virtual__:%';
  v_start := make_date(p_ano, p_mes, 1);
  v_end   := (v_start + INTERVAL '1 month' - INTERVAL '1 day')::DATE;

  IF NOT v_is_virtual THEN
    BEGIN
      v_dest_uuid := p_destinatario_id::UUID;
    EXCEPTION WHEN others THEN
      RAISE EXCEPTION 'Destinatário inválido.';
    END;

    DELETE FROM movelaria_caixa_movimentacoes
    WHERE destinatario_id = v_dest_uuid
      AND mes_referencia = p_mes
      AND ano_referencia = p_ano;
    GET DIAGNOSTICS v_mov_apagadas = ROW_COUNT;
  END IF;

  WITH alvo AS (
    SELECT cp.id
    FROM movelaria_contas_pagar cp
    WHERE cp.data_vencimento >= v_start
      AND cp.data_vencimento <= v_end
      AND lower(trim(COALESCE(cp.fornecedor_nome, ''))) = v_nome_key
  ),
  del AS (
    DELETE FROM movelaria_contas_pagar cp
    USING alvo
    WHERE cp.id = alvo.id
    RETURNING cp.id
  )
  SELECT COUNT(*)::INTEGER INTO v_cp_apagadas FROM del;

  RETURN jsonb_build_object(
    'ok', true,
    'movimentacoes_apagadas', v_mov_apagadas,
    'contas_pagar_apagadas', v_cp_apagadas
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.movelaria_excluir_movimentacao_caixa(
  p_movimentacao_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_perfil TEXT;
  v_count  INTEGER := 0;
BEGIN
  v_perfil := movelaria_meu_perfil();
  IF v_perfil IS DISTINCT FROM 'administrador'
     AND v_perfil IS DISTINCT FROM 'financeiro' THEN
    RAISE EXCEPTION 'Acesso negado: somente administrador ou financeiro podem excluir do Caixa.';
  END IF;

  IF p_movimentacao_id IS NULL THEN
    RAISE EXCEPTION 'Movimentação inválida.';
  END IF;

  DELETE FROM movelaria_caixa_movimentacoes
  WHERE id = p_movimentacao_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF v_count = 0 THEN
    RAISE EXCEPTION 'Movimentação não encontrada.';
  END IF;

  RETURN jsonb_build_object('ok', true, 'movimentacoes_apagadas', v_count);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_excluir_linha_caixa(TEXT, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_excluir_linha_caixa(TEXT, TEXT, INTEGER, INTEGER) TO authenticated;

REVOKE ALL ON FUNCTION public.movelaria_excluir_movimentacao_caixa(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_excluir_movimentacao_caixa(UUID) TO authenticated;
