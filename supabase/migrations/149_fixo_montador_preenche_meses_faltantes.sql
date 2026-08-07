-- ============================================================
-- GARBO Movelaria — Fixo montador: preencher meses faltantes
-- Migration 149
--
-- Problema: movelaria_expandir_fixo_montador só criava meses
-- DEPOIS da última cobrança existente. Se havia buracos no meio
-- (ex.: ago/set + jul/ago do ano seguinte), os meses do meio
-- nunca eram gerados — mesmo ao salvar o fixo nas Métricas.
--
-- Solução: percorrer mês a mês do 1º vencimento até o horizonte
-- (12 meses à frente) e inserir qualquer mês que ainda não tenha
-- cobrança "Fixo montador".
-- ============================================================

CREATE OR REPLACE FUNCTION movelaria_expandir_fixo_montador(p_montador_id UUID DEFAULT NULL)
RETURNS void AS $$
DECLARE
  v_montador_id           UUID := COALESCE(p_montador_id, auth.uid());
  v_valor                 NUMERIC(12, 2);
  v_recorrencia_id        UUID;
  v_nome                  TEXT;
  v_primeiro_vencimento   DATE;
  v_horizonte             DATE;
  v_encerramento          DATE;
  v_cursor                DATE;
  v_prox                  DATE;
  v_ano                   INTEGER;
  v_mes                   INTEGER;
BEGIN
  SELECT u.valor_fixo_mensal,
         u.fixo_recorrencia_id,
         u.fixo_primeiro_vencimento,
         COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1))
  INTO v_valor, v_recorrencia_id, v_primeiro_vencimento, v_nome
  FROM movelaria_usuarios u
  WHERE u.id = v_montador_id
    AND u.perfil IN ('montador', 'montador_admin')
    AND u.ativo = true;

  IF NOT FOUND OR COALESCE(v_valor, 0) <= 0 OR v_primeiro_vencimento IS NULL THEN
    RETURN;
  END IF;

  v_horizonte := (CURRENT_DATE + INTERVAL '12 months')::DATE;
  v_encerramento := NULL;

  IF v_recorrencia_id IS NULL THEN
    v_recorrencia_id := gen_random_uuid();

    UPDATE movelaria_usuarios
    SET fixo_recorrencia_id = v_recorrencia_id,
        fixo_primeiro_vencimento = COALESCE(fixo_primeiro_vencimento, v_primeiro_vencimento),
        atualizado_em = NOW()
    WHERE id = v_montador_id;
  END IF;

  SELECT cp.recorrencia_encerramento
  INTO v_encerramento
  FROM movelaria_contas_pagar cp
  WHERE cp.recorrencia_id = v_recorrencia_id
  ORDER BY cp.data_vencimento ASC
  LIMIT 1;

  IF v_encerramento IS NOT NULL AND v_encerramento < v_horizonte THEN
    v_horizonte := v_encerramento;
  END IF;

  -- Percorre cada mês do 1º vencimento até o horizonte, preenchendo lacunas.
  v_cursor := date_trunc('month', v_primeiro_vencimento)::DATE;

  WHILE v_cursor <= date_trunc('month', v_horizonte)::DATE LOOP
    v_ano := EXTRACT(YEAR FROM v_cursor)::INTEGER;
    v_mes := EXTRACT(MONTH FROM v_cursor)::INTEGER;
    v_prox := movelaria_fixo_vencimento_mes(v_primeiro_vencimento, v_ano, v_mes);

    IF v_prox >= v_primeiro_vencimento
       AND v_prox <= v_horizonte
       AND movelaria_fixo_mes_elegivel(v_primeiro_vencimento, v_mes, v_ano)
       AND NOT EXISTS (
         SELECT 1
         FROM movelaria_contas_pagar cp
         WHERE cp.prestador_id = v_montador_id
           AND COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
           AND EXTRACT(MONTH FROM cp.data_vencimento) = v_mes
           AND EXTRACT(YEAR  FROM cp.data_vencimento) = v_ano
       )
    THEN
      INSERT INTO movelaria_contas_pagar (
        prestador_id,
        fornecedor_nome,
        descricao,
        valor_total,
        numero_parcela,
        total_parcelas,
        valor_parcela,
        data_vencimento,
        status,
        recorrente,
        recorrencia_id,
        recorrencia_valor_base,
        recorrencia_encerramento
      ) VALUES (
        v_montador_id,
        v_nome,
        'Fixo montador: ' || v_nome,
        v_valor,
        1,
        1,
        v_valor,
        v_prox,
        'pendente',
        true,
        v_recorrencia_id,
        v_valor,
        v_encerramento
      );
    END IF;

    v_cursor := (v_cursor + INTERVAL '1 month')::DATE;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_expandir_fixo_montador(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_expandir_fixo_montador(UUID) TO authenticated;

-- Evita várias abas/usuários expandirem ao mesmo tempo (deadlock / timeout).
CREATE OR REPLACE FUNCTION movelaria_expandir_todos_fixo_montadores()
RETURNS INTEGER AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  r        RECORD;
  v_count  INTEGER := 0;
BEGIN
  IF v_perfil NOT IN ('administrador', 'administrador_obras', 'financeiro', 'montador_admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  -- Trava de sessão: se outra chamada já está rodando, sai em silêncio.
  IF NOT pg_try_advisory_xact_lock(hashtext('movelaria_expandir_todos_fixo_montadores')) THEN
    RETURN 0;
  END IF;

  FOR r IN
    SELECT u.id
    FROM movelaria_usuarios u
    WHERE u.perfil IN ('montador', 'montador_admin')
      AND u.ativo = true
      AND COALESCE(u.valor_fixo_mensal, 0) > 0
  LOOP
    PERFORM movelaria_expandir_fixo_montador(r.id);
    v_count := v_count + 1;
  END LOOP;

  RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_expandir_todos_fixo_montadores() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_expandir_todos_fixo_montadores() TO authenticated;

-- Reabre encerramento indevido e preenche meses faltantes de quem já tem fixo.
UPDATE movelaria_contas_pagar cp
SET recorrencia_encerramento = NULL,
    atualizado_em = NOW()
WHERE cp.descricao ILIKE 'Fixo montador:%'
  AND cp.recorrencia_encerramento IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM movelaria_usuarios u
    WHERE u.id = cp.prestador_id
      AND u.ativo = true
      AND COALESCE(u.valor_fixo_mensal, 0) > 0
  );

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT id
    FROM movelaria_usuarios
    WHERE ativo
      AND COALESCE(valor_fixo_mensal, 0) > 0
      AND perfil IN ('montador', 'montador_admin')
      AND fixo_primeiro_vencimento IS NOT NULL
  LOOP
    BEGIN
      PERFORM movelaria_expandir_fixo_montador(r.id);
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'Falha ao expandir fixo de %: %', r.id, SQLERRM;
    END;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
