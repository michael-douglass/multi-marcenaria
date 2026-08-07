-- ============================================================
-- GARBO Movelaria — Listar fixo sem WRITE (PostgREST read-only)
-- Migration 152
--
-- Problema: movelaria_listar_fixo_montadores era STABLE (leitura)
-- mas chamava movelaria_expandir_fixo_montador (INSERT/UPDATE).
-- PostgREST abre transação read-only → erro 25006 e a tela
-- de Métricas ficava vazia ("Selecione um montador...").
--
-- Solução: listar só lê status/cobranças; a expansão continua
-- em movelaria_expandir_* (ao salvar ou em Contas a Pagar).
-- ============================================================

CREATE OR REPLACE FUNCTION movelaria_listar_fixo_montadores(
  p_mes INTEGER,
  p_ano INTEGER
)
RETURNS TABLE (
  montador_id             UUID,
  montador_nome           TEXT,
  valor_fixo_mensal       NUMERIC,
  primeiro_vencimento     DATE,
  status_mes              TEXT,
  conta_pagar_id          UUID
) AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  r        RECORD;
  v_cp_id  UUID;
  v_status TEXT;
BEGIN
  IF v_perfil NOT IN ('administrador', 'administrador_obras', 'financeiro', 'montador_admin') THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  FOR r IN
    SELECT u.id,
           COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1)) AS nome,
           u.valor_fixo_mensal,
           u.fixo_primeiro_vencimento
    FROM movelaria_usuarios u
    WHERE u.perfil IN ('montador', 'montador_admin')
      AND u.ativo = true
    ORDER BY u.nome NULLS LAST, u.email
  LOOP
    v_cp_id := NULL;
    v_status := 'sem_fixo';

    IF COALESCE(r.valor_fixo_mensal, 0) > 0
      AND movelaria_fixo_mes_elegivel(r.fixo_primeiro_vencimento, p_mes, p_ano) THEN
      SELECT cp.id, cp.status
      INTO v_cp_id, v_status
      FROM movelaria_contas_pagar cp
      WHERE cp.prestador_id = r.id
        AND COALESCE(cp.descricao, '') LIKE 'Fixo montador:%'
        AND EXTRACT(MONTH FROM cp.data_vencimento) = p_mes
        AND EXTRACT(YEAR  FROM cp.data_vencimento) = p_ano
      ORDER BY cp.criado_em ASC, cp.id ASC
      LIMIT 1;

      IF v_cp_id IS NULL THEN
        v_status := 'pendente';
      ELSIF v_status = 'pago' THEN
        v_status := 'pago';
      ELSE
        v_status := 'pendente';
      END IF;
    END IF;

    montador_id         := r.id;
    montador_nome       := r.nome;
    valor_fixo_mensal   := COALESCE(r.valor_fixo_mensal, 0);
    primeiro_vencimento := r.fixo_primeiro_vencimento;
    status_mes          := v_status;
    conta_pagar_id      := v_cp_id;
    RETURN NEXT;
  END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_listar_fixo_montadores(INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_listar_fixo_montadores(INTEGER, INTEGER) TO authenticated;

NOTIFY pgrst, 'reload schema';
