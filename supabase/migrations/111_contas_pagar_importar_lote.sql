-- Migration 111: importação em lote de contas a pagar (planilha)

CREATE OR REPLACE FUNCTION movelaria_normalizar_import_texto(p_texto TEXT)
RETURNS TEXT AS $$
BEGIN
  RETURN lower(
    regexp_replace(
      translate(
        COALESCE(p_texto, ''),
        'áàâãäéèêëíìîïóòôõöúùûüçñÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇÑ',
        'aaaaaeeeeiiiiooooouuuucnAAAAAEEEEIIIIOOOOOUUUUCN'
      ),
      '[^a-z0-9]',
      '',
      'g'
    )
  );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

CREATE OR REPLACE FUNCTION movelaria_importar_contas_pagar_lote(p_itens JSONB)
RETURNS JSONB AS $$
DECLARE
  v_item JSONB;
  v_inseridas INTEGER := 0;
  v_ignoradas INTEGER := 0;
  v_fornecedor_nome TEXT;
  v_descricao TEXT;
  v_observacao TEXT;
  v_vencimento DATE;
  v_valor NUMERIC(12, 2);
  v_fornecedor_id UUID;
  v_chave TEXT;
  v_id UUID;
  v_ids UUID[] := ARRAY[]::UUID[];
BEGIN
  IF movelaria_meu_perfil() NOT IN ('administrador', 'financeiro') THEN
    RAISE EXCEPTION 'Sem permissão para importar contas a pagar.';
  END IF;

  IF p_itens IS NULL OR jsonb_typeof(p_itens) <> 'array' THEN
    RAISE EXCEPTION 'Lista de itens inválida para importação.';
  END IF;

  CREATE TEMP TABLE IF NOT EXISTS _import_contas_pagar_chaves (
    chave TEXT PRIMARY KEY
  ) ON COMMIT DROP;

  TRUNCATE _import_contas_pagar_chaves;

  FOR v_item IN
    SELECT value FROM jsonb_array_elements(p_itens) AS t(value)
  LOOP
    v_fornecedor_nome := btrim(COALESCE(v_item->>'fornecedor_nome', ''));
    v_descricao := btrim(COALESCE(v_item->>'descricao', ''));
    v_observacao := nullif(btrim(COALESCE(v_item->>'observacao', '')), '');
    v_vencimento := NULLIF(v_item->>'vencimento', '')::DATE;
    v_valor := NULLIF(v_item->>'valor', '')::NUMERIC(12, 2);

    BEGIN
      v_fornecedor_id := NULLIF(v_item->>'fornecedor_id', '')::UUID;
    EXCEPTION
      WHEN invalid_text_representation THEN
        v_fornecedor_id := NULL;
    END;

    IF v_fornecedor_nome = ''
      OR v_descricao = ''
      OR v_vencimento IS NULL
      OR v_valor IS NULL
      OR v_valor <= 0
    THEN
      v_ignoradas := v_ignoradas + 1;
      CONTINUE;
    END IF;

    v_chave :=
      movelaria_normalizar_import_texto(v_fornecedor_nome) || '|' ||
      movelaria_normalizar_import_texto(v_descricao) || '|' ||
      v_vencimento::TEXT || '|' ||
      to_char(v_valor, 'FM999999990.00');

    IF EXISTS (SELECT 1 FROM _import_contas_pagar_chaves k WHERE k.chave = v_chave) THEN
      v_ignoradas := v_ignoradas + 1;
      CONTINUE;
    END IF;

    IF EXISTS (
      SELECT 1
      FROM movelaria_contas_pagar cp
      WHERE movelaria_normalizar_import_texto(COALESCE(cp.fornecedor_nome, '')) =
            movelaria_normalizar_import_texto(v_fornecedor_nome)
        AND movelaria_normalizar_import_texto(COALESCE(cp.descricao, '')) =
            movelaria_normalizar_import_texto(v_descricao)
        AND cp.data_vencimento = v_vencimento
        AND cp.valor_parcela = v_valor
    ) THEN
      v_ignoradas := v_ignoradas + 1;
      CONTINUE;
    END IF;

    INSERT INTO movelaria_contas_pagar (
      fornecedor_id,
      fornecedor_nome,
      descricao,
      observacao,
      valor_total,
      numero_parcela,
      total_parcelas,
      valor_parcela,
      data_vencimento,
      status,
      valor_pago,
      grupo_lancamento_id
    ) VALUES (
      v_fornecedor_id,
      v_fornecedor_nome,
      v_descricao,
      v_observacao,
      v_valor,
      1,
      1,
      v_valor,
      v_vencimento,
      'pendente',
      0,
      gen_random_uuid()
    )
    RETURNING id INTO v_id;

    INSERT INTO _import_contas_pagar_chaves (chave) VALUES (v_chave);
    v_inseridas := v_inseridas + 1;
    v_ids := array_append(v_ids, v_id);
  END LOOP;

  RETURN jsonb_build_object(
    'inseridas', v_inseridas,
    'ignoradas', v_ignoradas,
    'ids', to_jsonb(v_ids)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION movelaria_importar_contas_pagar_lote(JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_importar_contas_pagar_lote(JSONB) TO authenticated;
