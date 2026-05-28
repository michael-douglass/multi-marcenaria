-- Sincroniza leads da Garbo (CRM multi-empresas) com clientes da Movelaria

ALTER TABLE movelaria_clientes
  ADD COLUMN IF NOT EXISTS email TEXT,
  ADD COLUMN IF NOT EXISTS origem TEXT,
  ADD COLUMN IF NOT EXISTS data_cadastro DATE;

CREATE INDEX IF NOT EXISTS idx_mov_clientes_telefone ON movelaria_clientes(telefone);
CREATE INDEX IF NOT EXISTS idx_mov_clientes_email ON movelaria_clientes(email);

CREATE OR REPLACE FUNCTION public.movelaria_sync_clientes_from_leads()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, emp_garbo
AS $$
DECLARE
  v_inserted INTEGER := 0;
  v_updated INTEGER := 0;
BEGIN
  -- Atualiza clientes já existentes (match por telefone ou email).
  WITH leads_norm AS (
    SELECT
      trim(nome) AS nome,
      NULLIF(trim(telefone), '') AS telefone,
      NULLIF(trim(email), '') AS email,
      COALESCE(NULLIF(trim(origem), ''), 'Lead Garbo') AS origem,
      COALESCE(data_chegada, criado_em::date, CURRENT_DATE) AS data_cadastro
    FROM emp_garbo.leads
    WHERE NULLIF(trim(nome), '') IS NOT NULL
  ),
  updated_rows AS (
    UPDATE movelaria_clientes c
    SET
      nome = COALESCE(NULLIF(ln.nome, ''), c.nome),
      telefone = COALESCE(ln.telefone, c.telefone),
      email = COALESCE(ln.email, c.email),
      origem = COALESCE(ln.origem, c.origem),
      data_cadastro = COALESCE(ln.data_cadastro, c.data_cadastro),
      atualizado_em = NOW()
    FROM leads_norm ln
    WHERE (
      (ln.telefone IS NOT NULL AND c.telefone = ln.telefone)
      OR (ln.email IS NOT NULL AND c.email = ln.email)
    )
    RETURNING c.id
  )
  SELECT COUNT(*) INTO v_updated FROM updated_rows;

  -- Insere apenas quem ainda não existe por telefone/email.
  WITH leads_norm AS (
    SELECT
      trim(nome) AS nome,
      NULLIF(trim(telefone), '') AS telefone,
      NULLIF(trim(email), '') AS email,
      COALESCE(NULLIF(trim(origem), ''), 'Lead Garbo') AS origem,
      COALESCE(data_chegada, criado_em::date, CURRENT_DATE) AS data_cadastro
    FROM emp_garbo.leads
    WHERE NULLIF(trim(nome), '') IS NOT NULL
  ),
  inserted_rows AS (
    INSERT INTO movelaria_clientes (
      nome,
      telefone,
      email,
      origem,
      data_cadastro
    )
    SELECT
      ln.nome,
      ln.telefone,
      ln.email,
      ln.origem,
      ln.data_cadastro
    FROM leads_norm ln
    WHERE NOT EXISTS (
      SELECT 1
      FROM movelaria_clientes c
      WHERE
        (ln.telefone IS NOT NULL AND c.telefone = ln.telefone)
        OR (ln.email IS NOT NULL AND c.email = ln.email)
    )
    RETURNING id
  )
  SELECT COUNT(*) INTO v_inserted FROM inserted_rows;

  RETURN jsonb_build_object(
    'inserted', v_inserted,
    'updated', v_updated
  );
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_sync_clientes_from_leads() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_sync_clientes_from_leads() TO authenticated;
