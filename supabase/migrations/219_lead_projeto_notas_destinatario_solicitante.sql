-- Chat do ateliê: respostas do ateliê vão para quem pediu (não para o titular do projeto).
-- Regra (espelha resolverDestinatarioNota no front):
--   titular escreve            → arquiteto (NULL = fila do ateliê)
--   ateliê/arquiteto escreve   → último solicitante do fio (não-ateliê), senão titular
--   outro usuário do CRM       → arquiteto (pedido ao ateliê)
--   demais (ex.: produção)     → mantém
-- Autores que não existem mais em auth.users são tratados como ateliê.

DO $$
DECLARE
  v_schema text;
BEGIN
  FOR v_schema IN
    SELECT schema_name
    FROM information_schema.schemata
    WHERE schema_name LIKE 'emp\_%' ESCAPE '\'
  LOOP
    IF to_regclass(format('%I.lead_projeto_notas', v_schema)) IS NULL
       OR to_regclass(format('%I.lead_projetos', v_schema)) IS NULL
       OR to_regclass(format('%I.user_roles', v_schema)) IS NULL THEN
      CONTINUE;
    END IF;

    EXECUTE format(
      $sql$
      WITH atelie AS (
        SELECT DISTINCT user_id FROM %1$I.user_roles
        WHERE role::text IN ('projetista', 'projetista_admin')
      ),
      crm AS (
        SELECT DISTINCT user_id FROM %1$I.user_roles
      ),
      base AS (
        SELECT
          n.id,
          n.autor_id,
          n.destinatario_id AS atual,
          lp.titular_id,
          lp.arquiteto_id,
          (
            n.autor_id IN (SELECT user_id FROM atelie)
            OR NOT EXISTS (SELECT 1 FROM auth.users a WHERE a.id = n.autor_id)
          ) AS eh_atelie,
          n.autor_id IN (SELECT user_id FROM crm) AS tem_crm,
          (
            SELECT p.autor_id
            FROM %1$I.lead_projeto_notas p
            WHERE p.lead_id = n.lead_id
              AND p.autor_id <> n.autor_id
              AND p.criado_em < n.criado_em
              AND p.autor_id NOT IN (SELECT user_id FROM atelie)
              AND EXISTS (SELECT 1 FROM auth.users a WHERE a.id = p.autor_id)
            ORDER BY p.criado_em DESC
            LIMIT 1
          ) AS ultimo_solicitante
        FROM %1$I.lead_projeto_notas n
        JOIN %1$I.lead_projetos lp ON lp.lead_id = n.lead_id
      ),
      novo AS (
        SELECT
          id,
          atual,
          CASE
            WHEN titular_id IS NOT NULL AND autor_id = titular_id THEN arquiteto_id
            WHEN (arquiteto_id IS NOT NULL AND autor_id = arquiteto_id) OR eh_atelie
              THEN COALESCE(ultimo_solicitante, titular_id)
            WHEN tem_crm THEN arquiteto_id
            ELSE atual
          END AS novo_dest
        FROM base
      )
      UPDATE %1$I.lead_projeto_notas n
      SET destinatario_id = novo.novo_dest
      FROM novo
      WHERE novo.id = n.id
        AND novo.novo_dest IS DISTINCT FROM novo.atual
      $sql$,
      v_schema
    );
  END LOOP;
END $$;
