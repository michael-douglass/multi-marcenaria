-- Corrige edição de obras pelo Montador Admin (drag de cards, formulário, etc.).
-- O USING já permitia obras do grupo; o WITH CHECK exigia montador_admin_id = auth.uid()
-- e bloqueava UPDATE quando a obra estava no grupo mas com outro admin_id legado.

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
      AND movelaria_montador_admin_pode_acessar_obra(montador_admin_id, grupo_obra_id, auth.uid())
    )
  );

-- Ao editar, vincula a obra ao Montador Admin logado se ela for do grupo dele.
CREATE OR REPLACE FUNCTION movelaria_obra_before_update_montador_admin()
RETURNS TRIGGER AS $$
DECLARE
  v_perfil TEXT := movelaria_meu_perfil();
  v_uid    UUID := auth.uid();
BEGIN
  IF v_perfil = 'montador_admin' AND v_uid IS NOT NULL THEN
    IF EXISTS (
      SELECT 1
      FROM movelaria_grupos_obra g
      WHERE g.id = NEW.grupo_obra_id
        AND g.montador_admin_id = v_uid
    ) THEN
      NEW.montador_admin_id := v_uid;
    ELSIF NEW.montador_admin_id IS NULL THEN
      NEW.montador_admin_id := v_uid;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_obra_before_update_montador_admin ON movelaria_obras;
CREATE TRIGGER trg_obra_before_update_montador_admin
  BEFORE UPDATE ON movelaria_obras
  FOR EACH ROW
  EXECUTE FUNCTION movelaria_obra_before_update_montador_admin();
