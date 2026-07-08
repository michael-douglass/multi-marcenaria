-- Migration 100: Marceneiro não possui pasta em Funcionários

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
BEGIN
  v_tipo := CASE NEW.perfil
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
    RETURN NEW;
  END IF;

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
    RETURN NEW;
  END IF;

  INSERT INTO movelaria_funcionarios (nome, email, tipo, usuario_id, admissao_status, ativo)
  VALUES (v_nome, NEW.email, v_tipo, NEW.id, 'pendente', true);

  RETURN NEW;
END;
$$;

-- Desativa pastas criadas erroneamente para marceneiros
UPDATE movelaria_funcionarios f
SET ativo = false, atualizado_em = NOW()
FROM movelaria_usuarios u
WHERE f.usuario_id = u.id
  AND u.perfil = 'marceneiro';

UPDATE movelaria_funcionarios
SET ativo = false, atualizado_em = NOW()
WHERE tipo = 'marceneiro';

NOTIFY pgrst, 'reload schema';
