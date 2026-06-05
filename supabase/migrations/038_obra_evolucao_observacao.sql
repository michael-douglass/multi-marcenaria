-- Observação opcional ao registrar progresso da obra (foto/PDF)

ALTER TABLE movelaria_obra_evolucao
  ADD COLUMN IF NOT EXISTS observacao TEXT;

COMMENT ON COLUMN movelaria_obra_evolucao.observacao IS
  'Comentário do montador ao enviar foto de evolução da obra.';

DROP FUNCTION IF EXISTS movelaria_painel_evolucao(TIMESTAMPTZ, TIMESTAMPTZ);
CREATE OR REPLACE FUNCTION movelaria_painel_evolucao(
  p_inicio TIMESTAMPTZ,
  p_fim    TIMESTAMPTZ
)
RETURNS TABLE (
  id           UUID,
  obra_id      UUID,
  obra_nome    TEXT,
  nome_arquivo TEXT,
  kind         TEXT,
  storage_path TEXT,
  preview_path TEXT,
  tirado_em    TIMESTAMPTZ,
  criado_por   UUID,
  criador_nome TEXT,
  observacao   TEXT
) AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_uid    UUID := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    e.id, e.obra_id, o.cliente_nome,
    e.nome_arquivo, e.kind,
    e.storage_path, e.preview_path,
    e.tirado_em, e.criado_por,
    u.nome,
    NULLIF(TRIM(e.observacao), '')
  FROM movelaria_obra_evolucao e
  JOIN movelaria_obras o ON o.id = e.obra_id
  LEFT JOIN movelaria_usuarios u ON u.id = e.criado_por
  WHERE e.tirado_em >= p_inicio
    AND e.tirado_em <= p_fim
    AND (
      v_perfil IN ('administrador', 'financeiro', 'administrador_obras')
      OR (v_perfil = 'montador_admin' AND o.montador_admin_id = v_uid)
      OR (v_perfil = 'montador' AND movelaria_montador_acessa_obra(o.id, v_uid))
    )
  ORDER BY e.tirado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_painel_evolucao(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_painel_evolucao(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
