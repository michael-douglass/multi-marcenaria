-- Migration 156: mídias do lead (CRM) nos cards de obra
-- Fotos (tipo=imagem) para quem vê obras; PDFs/documentos só para montador_admin
-- (e gestores de obras: administrador / administrador_obras).

CREATE OR REPLACE FUNCTION movelaria_lead_midias_por_leads(p_lead_ids TEXT[])
RETURNS TABLE (
  id          TEXT,
  lead_id     TEXT,
  tipo        TEXT,
  titulo      TEXT,
  file_name   TEXT,
  file_url    TEXT,
  folder_nome TEXT,
  criado_em   TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, emp_garbo
AS $$
DECLARE
  v_pode_docs BOOLEAN := false;
BEGIN
  IF auth.uid() IS NULL OR movelaria_meu_perfil() IS NULL THEN
    RETURN;
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM movelaria_usuarios u
    WHERE u.id = auth.uid()
      AND u.ativo = true
      AND (
        u.perfil IN ('montador_admin', 'administrador', 'administrador_obras')
        OR 'montador_admin' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
        OR 'administrador' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
        OR 'administrador_obras' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
      )
  ) INTO v_pode_docs;

  IF p_lead_ids IS NULL OR cardinality(p_lead_ids) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    m.id::TEXT,
    m.lead_id::TEXT,
    m.tipo,
    m.titulo,
    m.file_name,
    m.file_url,
    f.nome,
    m.criado_em
  FROM emp_garbo.marketing_medias m
  LEFT JOIN emp_garbo.marketing_media_folders f ON f.id = m.folder_id
  WHERE m.lead_id IS NOT NULL
    AND m.lead_id::TEXT = ANY (p_lead_ids)
    AND (
      m.tipo = 'imagem'
      OR (v_pode_docs AND m.tipo = 'pdf')
    )
  ORDER BY m.criado_em DESC NULLS LAST;
END;
$$;

REVOKE ALL ON FUNCTION movelaria_lead_midias_por_leads(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_lead_midias_por_leads(TEXT[]) TO authenticated;
