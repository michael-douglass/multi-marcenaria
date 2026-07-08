-- Migration 109: dispensar funcionário (soft delete) mantendo histórico

ALTER TABLE movelaria_funcionarios
  ADD COLUMN IF NOT EXISTS dispensado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS dispensado_por UUID REFERENCES movelaria_usuarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_funcionarios_ativo
  ON movelaria_funcionarios(ativo);

CREATE OR REPLACE FUNCTION movelaria_funcionario_dispensar(p_funcionario_id UUID)
RETURNS JSONB AS $$
DECLARE
  v_row movelaria_funcionarios%ROWTYPE;
BEGIN
  IF movelaria_meu_perfil() != 'administrador' THEN
    RAISE EXCEPTION 'Somente administrador pode dispensar funcionário.';
  END IF;

  SELECT * INTO v_row
  FROM movelaria_funcionarios
  WHERE id = p_funcionario_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Funcionário não encontrado.';
  END IF;

  IF NOT v_row.ativo THEN
    RAISE EXCEPTION 'Este funcionário já está dispensado.';
  END IF;

  UPDATE movelaria_funcionarios
  SET
    ativo = false,
    dispensado_em = NOW(),
    dispensado_por = auth.uid(),
    atualizado_em = NOW()
  WHERE id = p_funcionario_id;

  UPDATE movelaria_funcionario_jornada
  SET ativo = false, atualizado_em = NOW()
  WHERE funcionario_id = p_funcionario_id;

  SELECT * INTO v_row FROM movelaria_funcionarios WHERE id = p_funcionario_id;
  RETURN to_jsonb(v_row);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Cards e listagens de ponto só para funcionários ativos
CREATE OR REPLACE VIEW movelaria_funcionario_ponto_resumo AS
SELECT
  f.id AS funcionario_id,
  j.hora_entrada,
  j.hora_saida,
  j.ativo AS jornada_ativa,
  (movelaria_ponto_status_dia(f.id, movelaria_ponto_data_local())::jsonb->>'status_dia') AS status_hoje,
  (
    SELECT COUNT(*)::INT FROM movelaria_funcionario_ponto_marcacoes m
    WHERE m.funcionario_id = f.id
      AND movelaria_ponto_data_local(m.registrado_em) >= date_trunc('month', movelaria_ponto_data_local())::DATE
  ) AS batidas_mes
FROM movelaria_funcionarios f
LEFT JOIN movelaria_funcionario_jornada j ON j.funcionario_id = f.id AND j.ativo = true
WHERE f.ativo = true;

GRANT SELECT ON movelaria_funcionario_ponto_resumo TO authenticated;
