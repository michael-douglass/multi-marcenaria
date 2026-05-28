DROP POLICY IF EXISTS "orcamentos_fechados_select" ON movelaria_orcamentos_fechados;
CREATE POLICY "orcamentos_fechados_select" ON movelaria_orcamentos_fechados
  FOR SELECT TO authenticated
  USING (movelaria_meu_perfil() IS NOT NULL);

DROP POLICY IF EXISTS "orcamentos_fechados_insert" ON movelaria_orcamentos_fechados;
CREATE POLICY "orcamentos_fechados_insert" ON movelaria_orcamentos_fechados
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

DROP POLICY IF EXISTS "orcamentos_fechados_update" ON movelaria_orcamentos_fechados;
CREATE POLICY "orcamentos_fechados_update" ON movelaria_orcamentos_fechados
  FOR UPDATE TO authenticated
  USING (movelaria_meu_perfil() IN ('administrador', 'financeiro'))
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

DROP POLICY IF EXISTS "orcamentos_fechados_delete" ON movelaria_orcamentos_fechados;
CREATE POLICY "orcamentos_fechados_delete" ON movelaria_orcamentos_fechados
  FOR DELETE TO authenticated
  USING (movelaria_meu_perfil() = 'administrador');

