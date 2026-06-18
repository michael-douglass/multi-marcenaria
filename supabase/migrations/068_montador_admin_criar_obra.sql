-- Montador Admin: ao criar obra sem montador_admin_id, vincula automaticamente ao usuário logado.
-- Corrige falha de RLS no INSERT ... RETURNING (o admin só enxerga obras em que é responsável).

CREATE OR REPLACE FUNCTION movelaria_obra_before_insert_defaults()
RETURNS TRIGGER AS $$
BEGIN
  IF movelaria_meu_perfil() = 'montador_admin' AND NEW.montador_admin_id IS NULL THEN
    NEW.montador_admin_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_obra_before_insert_defaults ON movelaria_obras;
CREATE TRIGGER trg_obra_before_insert_defaults
  BEFORE INSERT ON movelaria_obras
  FOR EACH ROW
  EXECUTE FUNCTION movelaria_obra_before_insert_defaults();
