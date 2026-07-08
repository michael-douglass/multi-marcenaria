-- Migration 101: Recibo automático aguardando assinatura + backfill pagamentos já feitos

CREATE OR REPLACE FUNCTION movelaria_funcionario_recibo_ao_pagar_cp()
RETURNS TRIGGER AS $$
DECLARE
  v_funcionario_id UUID;
  v_texto TEXT;
  v_valor NUMERIC;
BEGIN
  IF NEW.prestador_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.status <> 'pago' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'pago' THEN
    RETURN NEW;
  END IF;

  SELECT id INTO v_funcionario_id
  FROM movelaria_funcionarios
  WHERE usuario_id = NEW.prestador_id AND ativo = true
  LIMIT 1;

  IF v_funcionario_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF EXISTS (
    SELECT 1 FROM movelaria_funcionario_recibos
    WHERE conta_pagar_id = NEW.id
  ) THEN
    RETURN NEW;
  END IF;

  v_valor := COALESCE(NEW.valor_pago, NEW.valor_parcela, NEW.valor_total, 0);

  v_texto := movelaria_gerar_texto_recibo_prestador(
    NEW.prestador_id,
    v_valor,
    COALESCE(NEW.data_pagamento, CURRENT_DATE),
    COALESCE(NEW.descricao, NEW.fornecedor_nome, 'Pagamento')
  );

  INSERT INTO movelaria_funcionario_recibos (
    funcionario_id,
    conta_pagar_id,
    status,
    texto_recibo,
    valor,
    data_pagamento,
    enviado_em
  ) VALUES (
    v_funcionario_id,
    NEW.id,
    'aguardando_assinatura',
    v_texto,
    v_valor,
    COALESCE(NEW.data_pagamento, CURRENT_DATE),
    NOW()
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Recibos pendentes antigos ficam disponíveis para assinatura
UPDATE movelaria_funcionario_recibos
SET
  status = 'aguardando_assinatura',
  enviado_em = COALESCE(enviado_em, NOW()),
  atualizado_em = NOW()
WHERE status = 'gerado';

-- Gera recibos para pagamentos já concluídos sem recibo
INSERT INTO movelaria_funcionario_recibos (
  funcionario_id,
  conta_pagar_id,
  status,
  texto_recibo,
  valor,
  data_pagamento,
  enviado_em
)
SELECT
  f.id,
  cp.id,
  'aguardando_assinatura',
  movelaria_gerar_texto_recibo_prestador(
    cp.prestador_id,
    COALESCE(cp.valor_pago, cp.valor_parcela, cp.valor_total, 0),
    COALESCE(cp.data_pagamento, CURRENT_DATE),
    COALESCE(cp.descricao, cp.fornecedor_nome, 'Pagamento')
  ),
  COALESCE(cp.valor_pago, cp.valor_parcela, cp.valor_total, 0),
  COALESCE(cp.data_pagamento, CURRENT_DATE),
  NOW()
FROM movelaria_contas_pagar cp
JOIN movelaria_funcionarios f ON f.usuario_id = cp.prestador_id AND f.ativo = true
WHERE cp.status = 'pago'
  AND cp.prestador_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM movelaria_funcionario_recibos r WHERE r.conta_pagar_id = cp.id
  );

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
  WHERE r.id = p_recibo_id
    AND r.status IN ('gerado', 'aguardando_assinatura')
    AND f.usuario_id = auth.uid();

  IF v_funcionario_id IS NULL AND movelaria_meu_perfil() NOT IN ('administrador', 'financeiro') THEN
    RAISE EXCEPTION 'Recibo não disponível para assinatura.';
  END IF;

  UPDATE movelaria_funcionario_recibos
  SET
    status = 'assinado',
    arquivo_assinado_path = p_assinatura_path,
    assinado_em = NOW(),
    atualizado_em = NOW()
  WHERE id = p_recibo_id
    AND status IN ('gerado', 'aguardando_assinatura');

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Recibo não encontrado ou já assinado.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

NOTIFY pgrst, 'reload schema';
