-- ============================================================
-- 205 — Pontua Garbo: ao entrar em "aguardando liberação",
-- cria automaticamente uma conta a pagar no financeiro.
-- Descrição: "{Nome do Arquiteto} — Pontua Garbo"
-- ============================================================

-- 1) Vínculo liberação → conta a pagar (evita duplicar)
ALTER TABLE emp_garbo.pontua_garbo_comissao_liberacoes
  ADD COLUMN IF NOT EXISTS conta_pagar_id UUID;

ALTER TABLE "CRM-multi-empresas>pontua_garbo_comissao_liberacoes<"
  ADD COLUMN IF NOT EXISTS conta_pagar_id UUID;

CREATE INDEX IF NOT EXISTS idx_pontua_lib_conta_pagar
  ON emp_garbo.pontua_garbo_comissao_liberacoes (conta_pagar_id)
  WHERE conta_pagar_id IS NOT NULL;

-- 2) Função: cria conta a pagar e devolve o id
CREATE OR REPLACE FUNCTION public.movelaria_criar_conta_pagar_pontua_garbo(
  p_liberacao_id UUID,
  p_prestador_id UUID,
  p_lead_id INTEGER,
  p_valor_comissao NUMERIC
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, emp_garbo
AS $$
DECLARE
  v_arquiteto TEXT;
  v_lead_nome TEXT;
  v_descricao TEXT;
  v_valor NUMERIC(12, 2);
  v_conta_id UUID;
  v_obs TEXT;
BEGIN
  IF p_liberacao_id IS NULL THEN
    RETURN NULL;
  END IF;

  v_valor := ROUND(COALESCE(p_valor_comissao, 0)::NUMERIC, 2);
  IF v_valor <= 0 THEN
    RETURN NULL;
  END IF;

  -- Já existe conta ligada a esta liberação?
  SELECT id INTO v_conta_id
  FROM movelaria_contas_pagar
  WHERE observacao LIKE '%pontua_liberacao:' || p_liberacao_id::TEXT || '%'
  LIMIT 1;

  IF v_conta_id IS NOT NULL THEN
    RETURN v_conta_id;
  END IF;

  SELECT NULLIF(btrim(u.nome), '') INTO v_arquiteto
  FROM emp_garbo.usuarios u
  WHERE u.id = p_prestador_id;

  SELECT NULLIF(btrim(l.nome), '') INTO v_lead_nome
  FROM emp_garbo.leads l
  WHERE l.id = p_lead_id;

  v_arquiteto := COALESCE(v_arquiteto, 'Arquiteto');
  v_descricao := v_arquiteto || ' — Pontua Garbo';
  v_obs := 'Lead: ' || COALESCE(v_lead_nome, '#' || p_lead_id::TEXT)
        || E'\npontua_liberacao:' || p_liberacao_id::TEXT;

  INSERT INTO movelaria_contas_pagar (
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
    v_arquiteto,
    v_descricao,
    v_obs,
    v_valor,
    1,
    1,
    v_valor,
    CURRENT_DATE,
    'pendente',
    0,
    gen_random_uuid()
  )
  RETURNING id INTO v_conta_id;

  RETURN v_conta_id;
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_criar_conta_pagar_pontua_garbo(UUID, UUID, INTEGER, NUMERIC) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_criar_conta_pagar_pontua_garbo(UUID, UUID, INTEGER, NUMERIC) TO authenticated;
GRANT EXECUTE ON FUNCTION public.movelaria_criar_conta_pagar_pontua_garbo(UUID, UUID, INTEGER, NUMERIC) TO service_role;

-- 3) Trigger: ao ficar aguardando_liberacao sem conta vinculada, gera a conta
CREATE OR REPLACE FUNCTION emp_garbo.trg_pontua_comissao_cria_conta_pagar()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, emp_garbo
AS $$
DECLARE
  v_conta_id UUID;
BEGIN
  IF NEW.status IS DISTINCT FROM 'aguardando_liberacao' THEN
    RETURN NEW;
  END IF;

  IF NEW.conta_pagar_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  v_conta_id := public.movelaria_criar_conta_pagar_pontua_garbo(
    NEW.id,
    NEW.prestador_id,
    NEW.lead_id,
    NEW.valor_comissao
  );

  IF v_conta_id IS NOT NULL THEN
    NEW.conta_pagar_id := v_conta_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_pontua_comissao_cria_conta_pagar
  ON emp_garbo.pontua_garbo_comissao_liberacoes;

CREATE TRIGGER trg_pontua_comissao_cria_conta_pagar
  BEFORE INSERT OR UPDATE OF status, valor_comissao, prestador_id, conta_pagar_id
  ON emp_garbo.pontua_garbo_comissao_liberacoes
  FOR EACH ROW
  EXECUTE FUNCTION emp_garbo.trg_pontua_comissao_cria_conta_pagar();

-- 4) Backfill: comissões já aguardando liberação sem conta a pagar
DO $$
DECLARE
  r RECORD;
  v_conta_id UUID;
BEGIN
  FOR r IN
    SELECT l.id, l.prestador_id, l.lead_id, l.valor_comissao
    FROM emp_garbo.pontua_garbo_comissao_liberacoes l
    WHERE l.status = 'aguardando_liberacao'
      AND l.conta_pagar_id IS NULL
      AND COALESCE(l.valor_comissao, 0) > 0
  LOOP
    v_conta_id := public.movelaria_criar_conta_pagar_pontua_garbo(
      r.id,
      r.prestador_id,
      r.lead_id,
      r.valor_comissao
    );

    IF v_conta_id IS NOT NULL THEN
      -- UPDATE dispara o trigger; conta_pagar_id já preenchido pela função,
      -- então setamos direto (trigger vê NEW.conta_pagar_id e não duplica).
      UPDATE emp_garbo.pontua_garbo_comissao_liberacoes
      SET conta_pagar_id = v_conta_id
      WHERE id = r.id
        AND conta_pagar_id IS NULL;
    END IF;
  END LOOP;
END;
$$;
