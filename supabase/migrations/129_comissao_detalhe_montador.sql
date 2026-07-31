-- ============================================================
-- GARBO Movelaria — Comissão: detalhar o montador beneficiário
-- Migration 129
--
-- Não altera fórmulas de valor/vencimento.
-- Apenas:
-- 1) Grava nos detalhes (observacao) quem recebe a comissão
-- 2) Corrige contas já existentes em que o nome do montador
--    foi sobrescrito por "Comissão: cliente"
-- ============================================================

-- ── 1. Geração futura: acrescenta montador na observação ─────
CREATE OR REPLACE FUNCTION movelaria_aplicar_comissao_obra_interno(p_obra_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_habilitada      BOOLEAN;
  v_gerada          BOOLEAN;
  v_cliente_nome    TEXT;
  v_finalizado_em   TIMESTAMPTZ;
  v_data_vencimento DATE;
  v_qtd_itens       INTEGER;
  v_montador_nome   TEXT;
  r                 RECORD;
BEGIN
  SELECT comissao_habilitada, comissao_gerada, cliente_nome, finalizado_em
  INTO v_habilitada, v_gerada, v_cliente_nome, v_finalizado_em
  FROM movelaria_obras
  WHERE id = p_obra_id;

  IF NOT FOUND OR NOT v_habilitada OR v_gerada THEN
    RETURN false;
  END IF;

  SELECT COUNT(*)::INTEGER INTO v_qtd_itens
  FROM movelaria_obra_comissao_itens
  WHERE obra_id = p_obra_id AND valor > 0;

  IF v_qtd_itens = 0 THEN
    RETURN false;
  END IF;

  v_data_vencimento := COALESCE(
    (v_finalizado_em AT TIME ZONE 'America/Sao_Paulo')::DATE,
    CURRENT_DATE
  );

  FOR r IN
    SELECT ci.prestador_id, ci.valor, u.nome, u.email
    FROM movelaria_obra_comissao_itens ci
    JOIN movelaria_usuarios u ON u.id = ci.prestador_id
    WHERE ci.obra_id = p_obra_id AND ci.valor > 0
  LOOP
    v_montador_nome := COALESCE(NULLIF(TRIM(r.nome), ''), split_part(r.email, '@', 1));

    INSERT INTO movelaria_contas_pagar (
      prestador_id,
      obra_id,
      fornecedor_nome,
      descricao,
      observacao,
      valor_total,
      numero_parcela,
      total_parcelas,
      valor_parcela,
      data_vencimento,
      status
    ) VALUES (
      r.prestador_id,
      p_obra_id,
      v_montador_nome,
      'Comissão: ' || v_cliente_nome,
      'Montador: ' || v_montador_nome,
      r.valor,
      1,
      1,
      r.valor,
      v_data_vencimento,
      'pendente'
    );
  END LOOP;

  UPDATE movelaria_obras
  SET comissao_gerada = true,
      atualizado_em = NOW()
  WHERE id = p_obra_id;

  RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_aplicar_comissao_obra_interno(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_aplicar_comissao_obra_interno(UUID) TO authenticated;

-- ── 2. Backfill: comissões já existentes ─────────────────────
UPDATE movelaria_contas_pagar cp
SET
  fornecedor_nome = COALESCE(
    NULLIF(TRIM(u.nome), ''),
    split_part(u.email, '@', 1),
    cp.fornecedor_nome
  ),
  observacao = CASE
    WHEN NULLIF(TRIM(COALESCE(cp.observacao, '')), '') IS NULL
      OR TRIM(cp.observacao) ILIKE 'Montador:%'
    THEN 'Montador: ' || COALESCE(
      NULLIF(TRIM(u.nome), ''),
      split_part(u.email, '@', 1),
      '—'
    )
    ELSE cp.observacao
  END,
  atualizado_em = NOW()
FROM movelaria_usuarios u
WHERE u.id = cp.prestador_id
  AND cp.prestador_id IS NOT NULL
  AND (
    cp.descricao ILIKE 'Comissão:%'
    OR cp.obra_id IS NOT NULL
  )
  AND COALESCE(cp.descricao, '') NOT LIKE 'Fixo montador:%'
  AND (
    cp.fornecedor_nome IS NULL
    OR TRIM(cp.fornecedor_nome) = ''
    OR cp.fornecedor_nome ILIKE 'Comissão:%'
    OR NULLIF(TRIM(COALESCE(cp.observacao, '')), '') IS NULL
    OR TRIM(cp.observacao) ILIKE 'Montador:%'
  );

NOTIFY pgrst, 'reload schema';
