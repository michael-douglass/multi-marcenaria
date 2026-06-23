-- ============================================================
-- GARBO Movelaria — Briefing: perfis extras + permissões
-- Migration 081
-- ============================================================

-- Considera perfil principal e perfis_extras (alinhado ao frontend useAuth.roles)
CREATE OR REPLACE FUNCTION movelaria_usuario_tem_perfil(p_perfil TEXT)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM movelaria_usuarios u
    WHERE u.id = auth.uid()
      AND u.ativo = true
      AND (u.perfil = p_perfil OR p_perfil = ANY(u.perfis_extras))
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION movelaria_usuario_tem_algum_perfil(p_perfis TEXT[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM movelaria_usuarios u
    WHERE u.id = auth.uid()
      AND u.ativo = true
      AND (
        u.perfil = ANY(p_perfis)
        OR u.perfis_extras && p_perfis
      )
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER;

REVOKE ALL ON FUNCTION movelaria_usuario_tem_perfil(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_usuario_tem_perfil(TEXT) TO authenticated;
REVOKE ALL ON FUNCTION movelaria_usuario_tem_algum_perfil(TEXT[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_usuario_tem_algum_perfil(TEXT[]) TO authenticated;

-- Acesso à obra (administrador de obras em perfil extra)
CREATE OR REPLACE FUNCTION movelaria_usuario_acessa_obra(p_obra_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN false; END IF;

  IF movelaria_usuario_tem_algum_perfil(ARRAY['administrador', 'financeiro', 'administrador_obras', 'visualizador']) THEN
    RETURN EXISTS (SELECT 1 FROM movelaria_obras WHERE id = p_obra_id);
  END IF;

  IF movelaria_usuario_tem_perfil('montador_admin') THEN
    RETURN EXISTS (
      SELECT 1 FROM movelaria_obras o
      WHERE o.id = p_obra_id
        AND movelaria_montador_admin_pode_acessar_obra(o.montador_admin_id, o.grupo_obra_id, v_uid)
    );
  END IF;

  IF movelaria_usuario_tem_perfil('montador') THEN
    RETURN movelaria_montador_acessa_obra(p_obra_id, v_uid);
  END IF;

  RETURN false;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION movelaria_usuario_edita_briefing_obra()
RETURNS BOOLEAN AS $$
  SELECT movelaria_usuario_tem_algum_perfil(ARRAY['administrador', 'administrador_obras', 'montador_admin']);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION movelaria_usuario_config_briefing_modelos()
RETURNS BOOLEAN AS $$
  SELECT movelaria_usuario_tem_algum_perfil(ARRAY['administrador', 'administrador_obras', 'montador_admin']);
$$ LANGUAGE sql STABLE SECURITY DEFINER;

CREATE OR REPLACE FUNCTION movelaria_usuario_exclui_briefing_modelos()
RETURNS BOOLEAN AS $$
  SELECT movelaria_usuario_tem_algum_perfil(ARRAY['administrador', 'administrador_obras']);
$$ LANGUAGE sql STABLE SECURITY DEFINER;
