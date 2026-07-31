-- ============================================================
-- GARBO Movelaria — Comissão: descrição = nome do prestador
-- Migration 130
--
-- Pedido: na descrição deve aparecer o nome do prestador
-- (Bruno, João, Kayke…), não o rótulo "Marceneiro/Montador".
--
-- Layout Contas a Pagar:
--   Fornecedor: Comissão: {cliente}
--   Descrição:  {nome do prestador}
--
-- Caixa: destinatário resolve pelo prestador_id (nome real).
-- Não altera fórmulas de valor/vencimento.
-- ============================================================

-- ── 1. Resolver destinatário do caixa pelo prestador ─────────
CREATE OR REPLACE FUNCTION movelaria_resolver_caixa_destinatario_prestador(
  p_nome TEXT,
  p_prestador_id UUID DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
  v_id   UUID;
  v_nome TEXT;
BEGIN
  IF p_prestador_id IS NOT NULL THEN
    SELECT COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1))
    INTO v_nome
    FROM movelaria_usuarios u
    WHERE u.id = p_prestador_id;
  END IF;

  v_nome := COALESCE(
    NULLIF(TRIM(v_nome), ''),
    NULLIF(TRIM(p_nome), '')
  );

  IF v_nome IS NULL THEN
    RETURN NULL;
  END IF;

  IF (v_nome ILIKE 'Comissão:%' OR v_nome ILIKE 'Fixo montador:%') AND p_prestador_id IS NULL THEN
    RETURN NULL;
  END IF;

  IF v_nome ILIKE 'Comissão:%' OR v_nome ILIKE 'Fixo montador:%' THEN
    SELECT COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1))
    INTO v_nome
    FROM movelaria_usuarios u
    WHERE u.id = p_prestador_id;

    IF NULLIF(TRIM(v_nome), '') IS NULL THEN
      RETURN NULL;
    END IF;
  END IF;

  SELECT id INTO v_id
  FROM movelaria_caixa_destinatarios
  WHERE LOWER(TRIM(nome)) = LOWER(v_nome)
    AND ativo = true
  LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO movelaria_caixa_destinatarios (nome, tipo, observacoes)
    VALUES (
      v_nome,
      'marceneiro',
      CASE WHEN p_prestador_id IS NOT NULL
        THEN 'Prestador obra — ' || p_prestador_id::TEXT
        ELSE 'Prestador obra'
      END
    )
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ── 2. Geração de comissão: descrição = nome do prestador ────
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
      'Comissão: ' || v_cliente_nome,
      v_montador_nome,
      NULL,
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

-- ── 3. Backfill Contas a Pagar ────────────────────────────────
UPDATE movelaria_contas_pagar cp
SET
  fornecedor_nome = 'Comissão: ' || COALESCE(
    (SELECT NULLIF(TRIM(o.cliente_nome), '') FROM movelaria_obras o WHERE o.id = cp.obra_id),
    NULLIF(TRIM(regexp_replace(COALESCE(cp.descricao, ''), '^[Cc]omissão:\s*', '')), ''),
    NULLIF(TRIM(regexp_replace(COALESCE(cp.fornecedor_nome, ''), '^[Cc]omissão:\s*', '')), ''),
    'Obra'
  ),
  descricao = COALESCE(
    NULLIF(TRIM(u.nome), ''),
    split_part(u.email, '@', 1),
    cp.descricao
  ),
  observacao = CASE
    WHEN cp.observacao ILIKE 'Montador:%' THEN NULL
    ELSE cp.observacao
  END,
  atualizado_em = NOW()
FROM movelaria_usuarios u
WHERE u.id = cp.prestador_id
  AND cp.prestador_id IS NOT NULL
  AND COALESCE(cp.descricao, '') NOT LIKE 'Fixo montador:%'
  AND (
    cp.descricao ILIKE 'Comissão:%'
    OR cp.fornecedor_nome ILIKE 'Comissão:%'
    OR cp.observacao ILIKE 'Montador:%'
    OR cp.obra_id IS NOT NULL
  );

-- ── 4. Remapear movimentações do caixa para o prestador ──────
DO $$
DECLARE
  r RECORD;
  v_dest UUID;
  v_nome TEXT;
BEGIN
  FOR r IN
    SELECT
      m.id AS mov_id,
      m.descricao AS mov_desc,
      cp.descricao AS prestador_nome,
      cp.fornecedor_nome AS comissao_label,
      cp.prestador_id
    FROM movelaria_caixa_movimentacoes m
    JOIN movelaria_contas_pagar cp ON cp.id = m.conta_pagar_id
    WHERE cp.prestador_id IS NOT NULL
      AND COALESCE(cp.descricao, '') NOT LIKE 'Fixo montador:%'
  LOOP
    v_nome := NULLIF(TRIM(r.prestador_nome), '');
    IF v_nome IS NULL OR v_nome ILIKE 'Comissão:%' THEN
      CONTINUE;
    END IF;

    v_dest := movelaria_resolver_caixa_destinatario_prestador(v_nome, r.prestador_id);

    IF v_dest IS NOT NULL THEN
      UPDATE movelaria_caixa_movimentacoes
      SET
        destinatario_id = v_dest,
        descricao = CASE
          WHEN tipo_movimentacao = 'pagamento' THEN
            'Pagamento comissão: ' || COALESCE(r.comissao_label, r.mov_desc)
          WHEN tipo_movimentacao = 'reserva' THEN
            'Reserva comissão obra: ' || COALESCE(r.comissao_label, r.mov_desc)
          ELSE descricao
        END
      WHERE id = r.mov_id;
    END IF;
  END LOOP;
END $$;

UPDATE movelaria_caixa_destinatarios d
SET ativo = false
WHERE d.nome ILIKE 'Comissão:%'
  AND NOT EXISTS (
    SELECT 1 FROM movelaria_caixa_movimentacoes m WHERE m.destinatario_id = d.id
  );

NOTIFY pgrst, 'reload schema';
