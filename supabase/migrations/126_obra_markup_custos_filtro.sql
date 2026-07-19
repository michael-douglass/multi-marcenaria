-- Preferências de categorias do markup por obra (compartilhadas entre usuários).
-- Cada obra guarda se Materiais / Serviços / Despesas entram no "Pedido a fazer".

CREATE TABLE IF NOT EXISTS movelaria_obra_markup_custos_filtro (
  obra_id            UUID PRIMARY KEY REFERENCES movelaria_obras(id) ON DELETE CASCADE,
  incluir_materiais  BOOLEAN NOT NULL DEFAULT true,
  incluir_servicos   BOOLEAN NOT NULL DEFAULT true,
  incluir_despesas   BOOLEAN NOT NULL DEFAULT true,
  atualizado_por     UUID REFERENCES movelaria_usuarios(id) ON DELETE SET NULL,
  criado_em          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  atualizado_em      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE movelaria_obra_markup_custos_filtro IS
  'Categorias do markup marcadas por obra na Agenda (compartilhado: Admin/Financeiro).';

CREATE INDEX IF NOT EXISTS idx_obra_markup_custos_filtro_atualizado
  ON movelaria_obra_markup_custos_filtro (atualizado_em DESC);

ALTER TABLE movelaria_obra_markup_custos_filtro ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "obra_markup_custos_filtro_select" ON movelaria_obra_markup_custos_filtro;
CREATE POLICY "obra_markup_custos_filtro_select"
  ON movelaria_obra_markup_custos_filtro
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM movelaria_usuarios u
      WHERE u.id = auth.uid()
        AND u.ativo = true
        AND (
          u.perfil IN ('administrador', 'financeiro')
          OR 'administrador' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
          OR 'financeiro' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
        )
    )
  );

DROP POLICY IF EXISTS "obra_markup_custos_filtro_insert" ON movelaria_obra_markup_custos_filtro;
CREATE POLICY "obra_markup_custos_filtro_insert"
  ON movelaria_obra_markup_custos_filtro
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM movelaria_usuarios u
      WHERE u.id = auth.uid()
        AND u.ativo = true
        AND (
          u.perfil IN ('administrador', 'financeiro')
          OR 'administrador' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
          OR 'financeiro' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
        )
    )
  );

DROP POLICY IF EXISTS "obra_markup_custos_filtro_update" ON movelaria_obra_markup_custos_filtro;
CREATE POLICY "obra_markup_custos_filtro_update"
  ON movelaria_obra_markup_custos_filtro
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM movelaria_usuarios u
      WHERE u.id = auth.uid()
        AND u.ativo = true
        AND (
          u.perfil IN ('administrador', 'financeiro')
          OR 'administrador' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
          OR 'financeiro' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM movelaria_usuarios u
      WHERE u.id = auth.uid()
        AND u.ativo = true
        AND (
          u.perfil IN ('administrador', 'financeiro')
          OR 'administrador' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
          OR 'financeiro' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
        )
    )
  );

DROP POLICY IF EXISTS "obra_markup_custos_filtro_delete" ON movelaria_obra_markup_custos_filtro;
CREATE POLICY "obra_markup_custos_filtro_delete"
  ON movelaria_obra_markup_custos_filtro
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM movelaria_usuarios u
      WHERE u.id = auth.uid()
        AND u.ativo = true
        AND (
          u.perfil IN ('administrador', 'financeiro')
          OR 'administrador' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
          OR 'financeiro' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
        )
    )
  );

-- Upsert atômico usado pela Agenda ao marcar/desmarcar categorias no card.
CREATE OR REPLACE FUNCTION movelaria_salvar_obra_markup_custos_filtro(
  p_obra_id UUID,
  p_materiais BOOLEAN,
  p_servicos BOOLEAN,
  p_despesas BOOLEAN
)
RETURNS movelaria_obra_markup_custos_filtro
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row movelaria_obra_markup_custos_filtro;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM movelaria_usuarios u
    WHERE u.id = auth.uid()
      AND u.ativo = true
      AND (
        u.perfil IN ('administrador', 'financeiro')
        OR 'administrador' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
        OR 'financeiro' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
      )
  ) THEN
    RAISE EXCEPTION 'Acesso negado: somente Administrador ou Financeiro podem alterar o filtro de custos.';
  END IF;

  IF p_obra_id IS NULL THEN
    RAISE EXCEPTION 'obra_id é obrigatório';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM movelaria_obras o WHERE o.id = p_obra_id) THEN
    RAISE EXCEPTION 'Obra não encontrada';
  END IF;

  INSERT INTO movelaria_obra_markup_custos_filtro AS t (
    obra_id,
    incluir_materiais,
    incluir_servicos,
    incluir_despesas,
    atualizado_por,
    atualizado_em
  )
  VALUES (
    p_obra_id,
    COALESCE(p_materiais, true),
    COALESCE(p_servicos, true),
    COALESCE(p_despesas, true),
    auth.uid(),
    NOW()
  )
  ON CONFLICT (obra_id) DO UPDATE
  SET
    incluir_materiais = EXCLUDED.incluir_materiais,
    incluir_servicos = EXCLUDED.incluir_servicos,
    incluir_despesas = EXCLUDED.incluir_despesas,
    atualizado_por = EXCLUDED.atualizado_por,
    atualizado_em = NOW()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION movelaria_salvar_obra_markup_custos_filtro(UUID, BOOLEAN, BOOLEAN, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_salvar_obra_markup_custos_filtro(UUID, BOOLEAN, BOOLEAN, BOOLEAN) TO authenticated;

-- Realtime para todos verem a mesma seleção ao vivo.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'movelaria_obra_markup_custos_filtro'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE movelaria_obra_markup_custos_filtro;
  END IF;
END;
$$;
