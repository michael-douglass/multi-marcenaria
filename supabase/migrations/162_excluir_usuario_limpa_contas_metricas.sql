-- ============================================================
-- GARBO Movelaria — Excluir usuário limpa métricas e contas
-- Migration 162
--
-- Problema: movelaria_excluir_usuario só apagava auth.users.
-- O montador continuava em:
--   - Métricas de Obras (lista de fixo / comissão)
--   - Contas a Pagar (parcelas "Fixo montador" em aberto)
-- E a exclusão falhava se existisse batida de ponto
-- (usuario_id ON DELETE RESTRICT + imutabilidade REP-P).
--
-- Correção:
-- 1) Ponto: histórico fica no funcionário; o login pode ser desvinculado
-- 2) Exclusão remove contas em aberto e dispensa a pasta de funcionário
-- ============================================================

-- ── 1. Ponto: permite desvincular o login sem apagar a batida ─
ALTER TABLE movelaria_funcionario_ponto_marcacoes
  ALTER COLUMN usuario_id DROP NOT NULL;

ALTER TABLE movelaria_funcionario_ponto_marcacoes
  DROP CONSTRAINT IF EXISTS movelaria_funcionario_ponto_marcacoes_usuario_id_fkey;

ALTER TABLE movelaria_funcionario_ponto_marcacoes
  ADD CONSTRAINT movelaria_funcionario_ponto_marcacoes_usuario_id_fkey
  FOREIGN KEY (usuario_id) REFERENCES movelaria_usuarios(id) ON DELETE SET NULL;

ALTER TABLE movelaria_funcionario_ponto_marcacoes
  DROP CONSTRAINT IF EXISTS movelaria_funcionario_ponto_marcacoes_ajustado_por_fkey;

ALTER TABLE movelaria_funcionario_ponto_marcacoes
  ADD CONSTRAINT movelaria_funcionario_ponto_marcacoes_ajustado_por_fkey
  FOREIGN KEY (ajustado_por) REFERENCES auth.users(id) ON DELETE SET NULL;

-- Imutabilidade REP-P: único campo que pode ir a NULL é o login excluído
CREATE OR REPLACE FUNCTION movelaria_ponto_marcacao_guard_update()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.nsr IS DISTINCT FROM NEW.nsr
    OR OLD.funcionario_id IS DISTINCT FROM NEW.funcionario_id
    OR OLD.tipo IS DISTINCT FROM NEW.tipo
    OR OLD.registrado_em IS DISTINCT FROM NEW.registrado_em
    OR OLD.latitude IS DISTINCT FROM NEW.latitude
    OR OLD.longitude IS DISTINCT FROM NEW.longitude
    OR OLD.foto_path IS DISTINCT FROM NEW.foto_path
    OR OLD.assinatura_path IS DISTINCT FROM NEW.assinatura_path
    OR OLD.hash_sha256 IS DISTINCT FROM NEW.hash_sha256
    OR OLD.origem IS DISTINCT FROM NEW.origem
    OR OLD.registro_motivo IS DISTINCT FROM NEW.registro_motivo
    OR (OLD.usuario_id IS DISTINCT FROM NEW.usuario_id AND NEW.usuario_id IS NOT NULL)
  THEN
    RAISE EXCEPTION 'Marcações de ponto são imutáveis (REP-P).';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ── 2. Exclusão completa do usuário da Movelaria ──────────────
CREATE OR REPLACE FUNCTION movelaria_excluir_usuario(p_id UUID)
RETURNS void AS $$
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Acesso negado: somente administradores podem excluir usuários';
  END IF;
  IF p_id = auth.uid() THEN
    RAISE EXCEPTION 'Não é possível excluir o próprio usuário';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM movelaria_usuarios WHERE id = p_id) THEN
    RAISE EXCEPTION 'Usuário não encontrado';
  END IF;

  -- Contas em aberto (fixo/comissão) saem de Contas a Pagar
  DELETE FROM movelaria_contas_pagar
  WHERE prestador_id = p_id
    AND status <> 'pago';

  -- Contas já pagas: desvincula, mantém o histórico financeiro
  UPDATE movelaria_contas_pagar
  SET prestador_id = NULL
  WHERE prestador_id = p_id;

  -- Pasta de funcionário: dispensa e solta o login (ponto permanece)
  UPDATE movelaria_funcionarios
  SET
    ativo = false,
    usuario_id = NULL,
    dispensado_em = COALESCE(dispensado_em, NOW()),
    atualizado_em = NOW()
  WHERE usuario_id = p_id;

  -- Remove o login (cascateia o perfil; ponto.usuario_id vira NULL)
  DELETE FROM auth.users WHERE id = p_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
   SET search_path = auth, public;

REVOKE ALL ON FUNCTION movelaria_excluir_usuario(UUID) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION movelaria_excluir_usuario(UUID) TO authenticated;

NOTIFY pgrst, 'reload schema';
