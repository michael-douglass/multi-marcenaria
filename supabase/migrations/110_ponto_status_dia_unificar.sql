-- Migration 110: remove overload ambíguo de movelaria_ponto_status_dia (quebrava o RPC no app)

DROP FUNCTION IF EXISTS movelaria_ponto_status_dia(uuid);

-- Garante jornada padrão para funcionários de campo (necessário para bater ponto)
INSERT INTO movelaria_funcionario_jornada (
  funcionario_id,
  hora_entrada,
  hora_saida_intervalo,
  hora_retorno_intervalo,
  hora_saida,
  tolerancia_minutos,
  dias_uteis,
  ativo
)
SELECT
  f.id,
  '07:00',
  '12:00',
  '13:00',
  '17:00',
  5,
  ARRAY[1, 2, 3, 4, 5],
  true
FROM movelaria_funcionarios f
WHERE f.ativo = true
  AND f.tipo IN ('montador', 'montador_admin', 'administrador_obras')
  AND NOT EXISTS (
    SELECT 1 FROM movelaria_funcionario_jornada j WHERE j.funcionario_id = f.id
  );

CREATE OR REPLACE FUNCTION movelaria_sync_funcionario_de_usuario()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tipo TEXT;
  v_nome TEXT;
  v_existing UUID;
  v_func_id UUID;
BEGIN
  v_tipo := CASE NEW.perfil
    WHEN 'marceneiro' THEN 'marceneiro'
    WHEN 'financeiro' THEN 'financeiro'
    WHEN 'montador' THEN 'montador'
    WHEN 'montador_admin' THEN 'montador_admin'
    WHEN 'administrador_obras' THEN 'administrador_obras'
    ELSE NULL
  END;

  v_nome := COALESCE(NULLIF(TRIM(NEW.nome), ''), split_part(NEW.email, '@', 1));

  IF v_tipo IS NULL OR NOT COALESCE(NEW.ativo, false) THEN
    UPDATE movelaria_funcionarios
    SET ativo = false, atualizado_em = NOW()
    WHERE usuario_id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT id INTO v_existing
  FROM movelaria_funcionarios
  WHERE usuario_id = NEW.id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    UPDATE movelaria_funcionarios
    SET
      nome = v_nome,
      email = NEW.email,
      tipo = v_tipo,
      ativo = true,
      atualizado_em = NOW()
    WHERE id = v_existing;
    v_func_id := v_existing;
  ELSE
    SELECT id INTO v_existing
    FROM movelaria_funcionarios
    WHERE usuario_id IS NULL
      AND email IS NOT NULL
      AND lower(email) = lower(NEW.email)
    LIMIT 1;

    IF v_existing IS NOT NULL THEN
      UPDATE movelaria_funcionarios
      SET
        usuario_id = NEW.id,
        nome = v_nome,
        email = NEW.email,
        tipo = v_tipo,
        ativo = true,
        atualizado_em = NOW()
      WHERE id = v_existing;
      v_func_id := v_existing;
    ELSE
      INSERT INTO movelaria_funcionarios (nome, email, tipo, usuario_id, admissao_status, ativo)
      VALUES (v_nome, NEW.email, v_tipo, NEW.id, 'pendente', true)
      RETURNING id INTO v_func_id;
    END IF;
  END IF;

  IF v_tipo IN ('montador', 'montador_admin', 'administrador_obras') THEN
    INSERT INTO movelaria_funcionario_jornada (
      funcionario_id,
      hora_entrada,
      hora_saida_intervalo,
      hora_retorno_intervalo,
      hora_saida,
      tolerancia_minutos,
      dias_uteis,
      ativo
    )
    VALUES (
      v_func_id,
      '07:00',
      '12:00',
      '13:00',
      '17:00',
      5,
      ARRAY[1, 2, 3, 4, 5],
      true
    )
    ON CONFLICT (funcionario_id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

NOTIFY pgrst, 'reload schema';
