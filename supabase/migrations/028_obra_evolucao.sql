-- ============================================================
-- GARBO Movelaria — Evolução de Obra (fotos periódicas)
-- Migration 028
-- ============================================================

-- ── 1. Bucket de storage ──────────────────────────────────────
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'movelaria-obra-evolucao',
  'movelaria-obra-evolucao',
  false,
  20971520,
  ARRAY['image/jpeg','image/png','image/webp','image/gif','application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Políticas de storage
DROP POLICY IF EXISTS "evolucao_select" ON storage.objects;
CREATE POLICY "evolucao_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'movelaria-obra-evolucao' AND movelaria_meu_perfil() IS NOT NULL);

DROP POLICY IF EXISTS "evolucao_insert" ON storage.objects;
CREATE POLICY "evolucao_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'movelaria-obra-evolucao'
    AND movelaria_meu_perfil() IN ('administrador','montador_admin','montador')
  );

DROP POLICY IF EXISTS "evolucao_delete" ON storage.objects;
CREATE POLICY "evolucao_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'movelaria-obra-evolucao'
    AND movelaria_meu_perfil() IN ('administrador','montador_admin')
  );

-- ── 2. Tabela de registros de evolução ────────────────────────
CREATE TABLE IF NOT EXISTS movelaria_obra_evolucao (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  obra_id      UUID        NOT NULL REFERENCES movelaria_obras(id) ON DELETE CASCADE,
  nome_arquivo TEXT        NOT NULL,
  tipo_mime    TEXT        NOT NULL,
  kind         TEXT        NOT NULL CHECK (kind IN ('image','pdf')),
  storage_path TEXT        NOT NULL,
  preview_path TEXT,
  tirado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  criado_por   UUID        REFERENCES movelaria_usuarios(id) ON DELETE SET NULL,
  criado_em    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evolucao_obra     ON movelaria_obra_evolucao(obra_id);
CREATE INDEX IF NOT EXISTS idx_evolucao_tirado   ON movelaria_obra_evolucao(tirado_em DESC);
CREATE INDEX IF NOT EXISTS idx_evolucao_criado   ON movelaria_obra_evolucao(criado_por);

ALTER TABLE movelaria_obra_evolucao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evolucao_meta_select" ON movelaria_obra_evolucao;
CREATE POLICY "evolucao_meta_select" ON movelaria_obra_evolucao
  FOR SELECT TO authenticated USING (movelaria_meu_perfil() IS NOT NULL);

DROP POLICY IF EXISTS "evolucao_meta_insert" ON movelaria_obra_evolucao;
CREATE POLICY "evolucao_meta_insert" ON movelaria_obra_evolucao
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador','montador_admin','montador'));

DROP POLICY IF EXISTS "evolucao_meta_delete" ON movelaria_obra_evolucao;
CREATE POLICY "evolucao_meta_delete" ON movelaria_obra_evolucao
  FOR DELETE TO authenticated
  USING (
    movelaria_meu_perfil() IN ('administrador','montador_admin')
    OR (movelaria_meu_perfil() = 'montador' AND criado_por = auth.uid())
  );

-- ── 3. Função para painel de evolução (com filtro de data) ────
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
  criador_nome TEXT
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
    u.nome
  FROM movelaria_obra_evolucao e
  JOIN movelaria_obras o ON o.id = e.obra_id
  LEFT JOIN movelaria_usuarios u ON u.id = e.criado_por
  WHERE e.tirado_em >= p_inicio
    AND e.tirado_em <= p_fim
    AND (
      v_perfil IN ('administrador','financeiro') OR
      (v_perfil = 'montador_admin' AND o.montador_admin_id = v_uid) OR
      (v_perfil = 'montador'       AND o.montador_id       = v_uid)
    )
  ORDER BY e.tirado_em DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_painel_evolucao(TIMESTAMPTZ, TIMESTAMPTZ) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_painel_evolucao(TIMESTAMPTZ, TIMESTAMPTZ) TO authenticated;
