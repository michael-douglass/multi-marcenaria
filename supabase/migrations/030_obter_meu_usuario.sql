-- Busca perfil do usuário logado via RPC (evita travamentos no client)
DROP FUNCTION IF EXISTS movelaria_obter_meu_usuario();
CREATE OR REPLACE FUNCTION movelaria_obter_meu_usuario()
RETURNS TABLE (
  id            UUID,
  email         TEXT,
  nome          TEXT,
  perfil        TEXT,
  ativo         BOOLEAN,
  criado_em     TIMESTAMPTZ,
  atualizado_em TIMESTAMPTZ
) AS $$
  SELECT u.id, u.email, u.nome, u.perfil, u.ativo, u.criado_em, u.atualizado_em
  FROM movelaria_usuarios u
  WHERE u.id = auth.uid()
    AND u.ativo = true;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

REVOKE ALL ON FUNCTION movelaria_obter_meu_usuario() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_obter_meu_usuario() TO authenticated;
