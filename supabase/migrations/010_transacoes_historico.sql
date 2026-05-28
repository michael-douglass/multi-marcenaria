CREATE TABLE IF NOT EXISTS movelaria_transacoes_historico (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tabela_origem TEXT NOT NULL,
  registro_id UUID,
  acao TEXT NOT NULL CHECK (acao IN ('insert', 'update', 'delete')),
  dados_antes JSONB,
  dados_depois JSONB,
  usuario_id UUID,
  usuario_email TEXT,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mov_hist_tabela_data
  ON movelaria_transacoes_historico (tabela_origem, criado_em DESC);

CREATE INDEX IF NOT EXISTS idx_mov_hist_registro
  ON movelaria_transacoes_historico (registro_id, criado_em DESC);

ALTER TABLE movelaria_transacoes_historico ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "read_movelaria_transacoes_historico" ON movelaria_transacoes_historico;
CREATE POLICY "read_movelaria_transacoes_historico" ON movelaria_transacoes_historico
  FOR SELECT TO authenticated
  USING (movelaria_meu_perfil() IS NOT NULL);

DROP POLICY IF EXISTS "insert_movelaria_transacoes_historico" ON movelaria_transacoes_historico;
CREATE POLICY "insert_movelaria_transacoes_historico" ON movelaria_transacoes_historico
  FOR INSERT TO authenticated
  WITH CHECK (movelaria_meu_perfil() IN ('administrador', 'financeiro'));

CREATE OR REPLACE FUNCTION movelaria_registrar_historico_transacao()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := auth.uid();
  v_user_email TEXT;
  v_registro_id UUID;
BEGIN
  IF v_user_id IS NOT NULL THEN
    SELECT email INTO v_user_email
    FROM movelaria_usuarios
    WHERE id = v_user_id;
  END IF;

  IF TG_OP = 'INSERT' THEN
    v_registro_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_registro_id := NEW.id;
  ELSE
    v_registro_id := OLD.id;
  END IF;

  INSERT INTO movelaria_transacoes_historico (
    tabela_origem,
    registro_id,
    acao,
    dados_antes,
    dados_depois,
    usuario_id,
    usuario_email
  ) VALUES (
    TG_TABLE_NAME,
    v_registro_id,
    lower(TG_OP),
    CASE WHEN TG_OP IN ('UPDATE', 'DELETE') THEN to_jsonb(OLD) ELSE NULL END,
    CASE WHEN TG_OP IN ('INSERT', 'UPDATE') THEN to_jsonb(NEW) ELSE NULL END,
    v_user_id,
    v_user_email
  );

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_hist_contas_receber ON movelaria_contas_receber;
CREATE TRIGGER trg_hist_contas_receber
AFTER INSERT OR UPDATE OR DELETE ON movelaria_contas_receber
FOR EACH ROW EXECUTE FUNCTION movelaria_registrar_historico_transacao();

DROP TRIGGER IF EXISTS trg_hist_orcamentos_fechados ON movelaria_orcamentos_fechados;
CREATE TRIGGER trg_hist_orcamentos_fechados
AFTER INSERT OR UPDATE OR DELETE ON movelaria_orcamentos_fechados
FOR EACH ROW EXECUTE FUNCTION movelaria_registrar_historico_transacao();

