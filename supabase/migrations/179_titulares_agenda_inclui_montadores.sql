-- Titulares da agenda: equipe do sistema + montadores (sem prestador/visualizador).
-- Quem cria tarefa no card do lead precisa ver montadores para designar.

CREATE OR REPLACE FUNCTION public.movelaria_listar_titulares_agenda()
RETURNS TABLE (
  id           UUID,
  nome         TEXT,
  avatar_url   TEXT,
  perfil_casa  TEXT,
  crm_roles    TEXT[],
  grupo        TEXT
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
DECLARE
  v_uid        UUID := auth.uid();
  v_perfil     TEXT;
  v_crm_colab  BOOLEAN;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  v_perfil := public.movelaria_meu_perfil();

  SELECT EXISTS (
    SELECT 1
    FROM emp_garbo.usuarios c
    WHERE c.id = v_uid
      AND c.status_convite = 'ATIVO'
      AND c.tipo_usuario = 'colaborador'
  )
  INTO v_crm_colab;

  IF v_perfil IS NULL AND NOT v_crm_colab THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  IF v_perfil = 'visualizador' AND NOT v_crm_colab THEN
    RAISE EXCEPTION 'Acesso negado';
  END IF;

  RETURN QUERY
  WITH ids AS (
    SELECT m.id
    FROM public.movelaria_usuarios m
    WHERE m.ativo = true
      AND m.perfil IS DISTINCT FROM 'visualizador'
    UNION
    SELECT c.id
    FROM emp_garbo.usuarios c
    WHERE c.status_convite = 'ATIVO'
      AND c.tipo_usuario = 'colaborador'
  )
  SELECT
    i.id,
    COALESCE(NULLIF(btrim(m.nome), ''), NULLIF(btrim(c.nome), ''), split_part(COALESCE(m.email, c.email, ''), '@', 1), 'Usuário') AS nome,
    c.avatar_url,
    m.perfil AS perfil_casa,
    COALESCE((
      SELECT array_agg(r.role::TEXT ORDER BY r.role::TEXT)
      FROM emp_garbo.user_roles r
      WHERE r.user_id = i.id
        AND r.role::TEXT <> 'nenhum'
    ), '{}'::TEXT[]) AS crm_roles,
    CASE
      WHEN m.perfil IN ('montador', 'montador_admin') THEN 'montador'
      ELSE 'equipe'
    END AS grupo
  FROM ids i
  LEFT JOIN public.movelaria_usuarios m ON m.id = i.id
  LEFT JOIN emp_garbo.usuarios c ON c.id = i.id
  ORDER BY
    CASE WHEN m.perfil IN ('montador', 'montador_admin') THEN 1 ELSE 0 END,
    COALESCE(m.nome, c.nome, m.email, c.email);
END;
$$;

REVOKE ALL ON FUNCTION public.movelaria_listar_titulares_agenda() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.movelaria_listar_titulares_agenda() TO authenticated;

-- Montador titular do lembrete precisa ver o nome do lead na agenda.
DROP POLICY IF EXISTS emp_leads_titular_lembrete_select ON emp_garbo.leads;
CREATE POLICY emp_leads_titular_lembrete_select
  ON emp_garbo.leads
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM emp_garbo.lead_lembretes l
      WHERE l.lead_id = leads.id
        AND (SELECT auth.uid()) = ANY (l.titular_ids)
    )
  );

NOTIFY pgrst, 'reload schema';
