-- ============================================================
-- GARBO Movelaria — Remove usuários "fantasma" do Auth compartilhado
-- Migration 160
--
-- O Auth do Supabase é compartilhado com outros sistemas. Um trigger
-- antigo (trg_movelaria_novo_usuario) criava automaticamente um perfil
-- marceneiro (sem nome) em movelaria_usuarios para CADA conta nova.
-- Esses perfis aparecem em Configurações > Usuários, mas não são
-- usuários da Movelaria.
--
-- Correção:
-- 1) Garante que o trigger automático não exista mais
-- 2) Remove perfis fantasma (marceneiro sem nome)
-- 3) Remove pastas de funcionário inativas criadas por engano
-- ============================================================

-- ── 1. Desliga o auto-cadastro em todo auth.users ─────────────
DROP TRIGGER IF EXISTS trg_movelaria_novo_usuario ON auth.users;

-- Função vira no-op: se alguém recriar o trigger por engano, não polui a lista
CREATE OR REPLACE FUNCTION movelaria_ao_criar_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Intencional: usuários da Movelaria só entram via
  -- movelaria_criar_usuario / movelaria_registrar_usuario_existente.
  -- Não cadastrar automaticamente contas de outros sistemas.
  RETURN NEW;
END;
$$;

-- ── 2. Remove pastas de funcionário criadas pelos fantasmas ───
DELETE FROM movelaria_funcionarios f
USING movelaria_usuarios u
WHERE f.usuario_id = u.id
  AND u.perfil = 'marceneiro'
  AND (u.nome IS NULL OR btrim(u.nome) = '')
  AND COALESCE(f.ativo, false) = false
  AND f.tipo = 'marceneiro';

-- ── 3. Remove os perfis fantasma (não apaga auth.users) ───────
-- Login de outros sistemas continua intacto; só some da Movelaria.
DELETE FROM movelaria_usuarios
WHERE perfil = 'marceneiro'
  AND (nome IS NULL OR btrim(nome) = '');

NOTIFY pgrst, 'reload schema';
