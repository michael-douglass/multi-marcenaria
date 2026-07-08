-- Migration 102: Recibo só pode ser assinado quando a conta a pagar estiver paga

CREATE OR REPLACE FUNCTION movelaria_funcionario_recibo_assinar(
  p_recibo_id UUID,
  p_assinatura_path TEXT
)
RETURNS void AS $$
DECLARE
  v_funcionario_id UUID;
BEGIN
  SELECT r.funcionario_id INTO v_funcionario_id
  FROM movelaria_funcionario_recibos r
  JOIN movelaria_funcionarios f ON f.id = r.funcionario_id
  JOIN movelaria_contas_pagar cp ON cp.id = r.conta_pagar_id
  WHERE r.id = p_recibo_id
    AND r.status IN ('gerado', 'aguardando_assinatura')
    AND cp.status = 'pago'
    AND f.usuario_id = auth.uid();

  IF v_funcionario_id IS NULL AND movelaria_meu_perfil() NOT IN ('administrador', 'financeiro') THEN
    RAISE EXCEPTION 'Recibo não disponível para assinatura.';
  END IF;

  UPDATE movelaria_funcionario_recibos r
  SET
    status = 'assinado',
    arquivo_assinado_path = p_assinatura_path,
    assinado_em = NOW(),
    atualizado_em = NOW()
  FROM movelaria_contas_pagar cp
  WHERE r.id = p_recibo_id
    AND cp.id = r.conta_pagar_id
    AND cp.status = 'pago'
    AND r.status IN ('gerado', 'aguardando_assinatura');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recibo não encontrado, já assinado ou pagamento ainda não confirmado no financeiro.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';
