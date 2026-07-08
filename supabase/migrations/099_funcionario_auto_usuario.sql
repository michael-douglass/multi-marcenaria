-- Migration 099: pasta de funcionário automática por perfil de usuário

ALTER TABLE movelaria_funcionarios
  DROP CONSTRAINT IF EXISTS movelaria_funcionarios_tipo_check;

ALTER TABLE movelaria_funcionarios
  ADD CONSTRAINT movelaria_funcionarios_tipo_check
  CHECK (tipo IN (
    'montador', 'montador_admin', 'administrador_obras', 'marceneiro', 'financeiro'
  ));

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

DROP TRIGGER IF EXISTS trg_sync_funcionario_usuario ON movelaria_usuarios;
CREATE TRIGGER trg_sync_funcionario_usuario
  AFTER INSERT OR UPDATE OF perfil, nome, email, ativo ON movelaria_usuarios
  FOR EACH ROW
  EXECUTE FUNCTION movelaria_sync_funcionario_de_usuario();

-- Vincula pastas manuais existentes pelo e-mail
UPDATE movelaria_funcionarios f
SET
  usuario_id = u.id,
  tipo = u.perfil,
  nome = COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1)),
  email = u.email,
  ativo = u.ativo,
  atualizado_em = NOW()
FROM movelaria_usuarios u
WHERE f.usuario_id IS NULL
  AND f.email IS NOT NULL
  AND lower(f.email) = lower(u.email)
  AND u.perfil IN ('marceneiro', 'financeiro', 'montador', 'montador_admin', 'administrador_obras')
  AND u.ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM movelaria_funcionarios f2 WHERE f2.usuario_id = u.id
  );

-- Cria pastas para usuários que ainda não têm
INSERT INTO movelaria_funcionarios (nome, email, tipo, usuario_id, admissao_status, ativo)
SELECT
  COALESCE(NULLIF(TRIM(u.nome), ''), split_part(u.email, '@', 1)),
  u.email,
  u.perfil,
  u.id,
  'pendente',
  u.ativo
FROM movelaria_usuarios u
WHERE u.perfil IN ('marceneiro', 'financeiro', 'montador', 'montador_admin', 'administrador_obras')
  AND u.ativo = true
  AND NOT EXISTS (
    SELECT 1 FROM movelaria_funcionarios f WHERE f.usuario_id = u.id
  );

NOTIFY pgrst, 'reload schema';
