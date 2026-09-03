-- ============================================================
-- GARBO Movelaria — Tipos de pasta RH: Design, Projetista, etc.
-- Migration 185
-- ============================================================

ALTER TABLE movelaria_funcionarios
  DROP CONSTRAINT IF EXISTS movelaria_funcionarios_tipo_check;

ALTER TABLE movelaria_funcionarios
  ADD CONSTRAINT movelaria_funcionarios_tipo_check
  CHECK (tipo IN (
    'montador',
    'montador_admin',
    'administrador_obras',
    'marceneiro',
    'financeiro',
    'design',
    'projetista',
    'administrativo',
    'outro'
  ));

NOTIFY pgrst, 'reload schema';
