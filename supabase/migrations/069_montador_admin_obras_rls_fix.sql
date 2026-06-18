-- Reforça permissões do Montador Admin ao criar/editar obras.
-- 1) Sempre vincula a obra ao admin logado no INSERT.
-- 2) SELECT sem subconsulta na própria tabela (evita falha no INSERT ... RETURNING).
-- 3) UPDATE restrito às obras que o montador admin gerencia.

CREATE OR REPLACE FUNCTION movelaria_obra_before_insert_defaults()
RETURNS TRIGGER AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_uid    UUID := auth.uid();
BEGIN
  IF v_perfil = 'montador_admin' AND v_uid IS NOT NULL THEN
    NEW.montador_admin_id := v_uid;

    IF NEW.grupo_obra_id IS NULL THEN
      SELECT g.id
      INTO NEW.grupo_obra_id
      FROM movelaria_grupos_obra g
      WHERE g.montador_admin_id = v_uid
        AND g.ativo = true
      ORDER BY g.nome
      LIMIT 1;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION movelaria_montador_admin_pode_acessar_obra(
  p_montador_admin_id UUID,
  p_grupo_obra_id UUID,
  p_uid UUID
)
RETURNS BOOLEAN AS $$
  SELECT
    p_montador_admin_id = p_uid
    OR EXISTS (
      SELECT 1
      FROM movelaria_grupos_obra g
      WHERE g.id = p_grupo_obra_id
        AND g.montador_admin_id = p_uid
    );
$$ LANGUAGE sql STABLE;

REVOKE ALL ON FUNCTION movelaria_montador_admin_pode_acessar_obra(UUID, UUID, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_montador_admin_pode_acessar_obra(UUID, UUID, UUID) TO authenticated;

DROP POLICY IF EXISTS "obras_select_montador_admin" ON movelaria_obras;
CREATE POLICY "obras_select_montador_admin" ON movelaria_obras
  FOR SELECT TO authenticated
  USING (
    movelaria_meu_perfil() = 'montador_admin'
    AND movelaria_montador_admin_pode_acessar_obra(montador_admin_id, grupo_obra_id, auth.uid())
  );

DROP POLICY IF EXISTS "obras_update_admin" ON movelaria_obras;
CREATE POLICY "obras_update_admin" ON movelaria_obras
  FOR UPDATE TO authenticated
  USING (
    movelaria_meu_perfil() IN ('administrador', 'financeiro', 'administrador_obras')
    OR (
      movelaria_meu_perfil() = 'montador_admin'
      AND movelaria_montador_admin_pode_acessar_obra(montador_admin_id, grupo_obra_id, auth.uid())
    )
  )
  WITH CHECK (
    movelaria_meu_perfil() IN ('administrador', 'financeiro', 'administrador_obras')
    OR (
      movelaria_meu_perfil() = 'montador_admin'
      AND montador_admin_id = auth.uid()
    )
  );
