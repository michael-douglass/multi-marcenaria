-- ============================================================
-- GARBO Movelaria — Simulador de caixa: sem Marceneiro
-- Migration 193
-- Dashboard/simulador fica só para Administrador e Financeiro.
-- ============================================================

CREATE OR REPLACE FUNCTION movelaria_pode_usar_simulador_caixa()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM movelaria_usuarios u
    WHERE u.id = auth.uid()
      AND u.ativo = true
      AND (
        u.perfil IN ('administrador', 'financeiro')
        OR 'administrador' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
        OR 'financeiro' = ANY (COALESCE(u.perfis_extras, '{}'::TEXT[]))
      )
  );
$$;

COMMENT ON FUNCTION movelaria_pode_usar_simulador_caixa() IS
  'Libera o simulador do Dashboard apenas para Administrador e Financeiro.';
