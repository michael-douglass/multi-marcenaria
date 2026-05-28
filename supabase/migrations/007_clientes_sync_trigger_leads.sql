-- Sincronismo automático no banco:
-- sempre que entrar/atualizar lead em emp_garbo.leads, reflete em movelaria_clientes.

CREATE OR REPLACE FUNCTION public.movelaria_upsert_cliente_from_lead(
  p_nome TEXT,
  p_telefone TEXT,
  p_email TEXT,
  p_origem TEXT,
  p_data_cadastro DATE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NULLIF(trim(p_nome), '') IS NULL THEN
    RETURN;
  END IF;

  UPDATE movelaria_clientes c
  SET
    nome = COALESCE(NULLIF(trim(p_nome), ''), c.nome),
    telefone = COALESCE(NULLIF(trim(p_telefone), ''), c.telefone),
    email = COALESCE(NULLIF(trim(p_email), ''), c.email),
    origem = COALESCE(NULLIF(trim(p_origem), ''), c.origem),
    data_cadastro = COALESCE(p_data_cadastro, c.data_cadastro),
    atualizado_em = NOW()
  WHERE (
    (NULLIF(trim(p_telefone), '') IS NOT NULL AND c.telefone = NULLIF(trim(p_telefone), ''))
    OR (NULLIF(trim(p_email), '') IS NOT NULL AND c.email = NULLIF(trim(p_email), ''))
  );

  IF NOT FOUND THEN
    INSERT INTO movelaria_clientes (nome, telefone, email, origem, data_cadastro)
    VALUES (
      trim(p_nome),
      NULLIF(trim(p_telefone), ''),
      NULLIF(trim(p_email), ''),
      COALESCE(NULLIF(trim(p_origem), ''), 'Lead Garbo'),
      COALESCE(p_data_cadastro, CURRENT_DATE)
    );
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.movelaria_sync_cliente_lead_trigger()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, emp_garbo
AS $$
BEGIN
  PERFORM public.movelaria_upsert_cliente_from_lead(
    NEW.nome,
    NEW.telefone,
    NEW.email,
    NEW.origem,
    COALESCE(NEW.data_chegada, NEW.criado_em::date, CURRENT_DATE)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_movelaria_sync_cliente_lead ON emp_garbo.leads;
CREATE TRIGGER trg_movelaria_sync_cliente_lead
AFTER INSERT OR UPDATE ON emp_garbo.leads
FOR EACH ROW
EXECUTE FUNCTION public.movelaria_sync_cliente_lead_trigger();

REVOKE ALL ON FUNCTION public.movelaria_upsert_cliente_from_lead(TEXT, TEXT, TEXT, TEXT, DATE) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.movelaria_sync_cliente_lead_trigger() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_upsert_cliente_from_lead(TEXT, TEXT, TEXT, TEXT, DATE) TO authenticated;
