-- Migration 098: Meu Perfil — documentos e admissão autenticados (sem link público)

ALTER TABLE movelaria_funcionarios
  ADD COLUMN IF NOT EXISTS foto_perfil_path TEXT;

-- Permite origem de documentos enviados pelo próprio funcionário logado
ALTER TABLE movelaria_funcionario_documentos
  DROP CONSTRAINT IF EXISTS movelaria_funcionario_documentos_origem_check;

ALTER TABLE movelaria_funcionario_documentos
  ADD CONSTRAINT movelaria_funcionario_documentos_origem_check
  CHECK (origem IN ('admin', 'funcionario_publico', 'funcionario_sistema'));

-- Prestador pode inserir documentos na própria pasta
DROP POLICY IF EXISTS "func_doc_insert_prestador" ON movelaria_funcionario_documentos;
CREATE POLICY "func_doc_insert_prestador" ON movelaria_funcionario_documentos
  FOR INSERT TO authenticated
  WITH CHECK (
    movelaria_meu_perfil() IN ('administrador', 'financeiro')
    OR EXISTS (
      SELECT 1 FROM movelaria_funcionarios f
      WHERE f.id = funcionario_id AND f.usuario_id = auth.uid()
    )
  );

-- Prestador pode excluir/substituir próprios documentos de admissão
DROP POLICY IF EXISTS "func_doc_delete_prestador" ON movelaria_funcionario_documentos;
CREATE POLICY "func_doc_delete_prestador" ON movelaria_funcionario_documentos
  FOR DELETE TO authenticated
  USING (
    movelaria_meu_perfil() IN ('administrador', 'financeiro')
    OR EXISTS (
      SELECT 1 FROM movelaria_funcionarios f
      WHERE f.id = funcionario_id AND f.usuario_id = auth.uid()
    )
  );

-- Storage: prestador autenticado pode enviar arquivos na própria pasta
DROP POLICY IF EXISTS "storage_func_doc_prestador_insert" ON storage.objects;
CREATE POLICY "storage_func_doc_prestador_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'movelaria-funcionario-documentos'
    AND EXISTS (
      SELECT 1 FROM movelaria_funcionarios f
      WHERE f.id::text = split_part(name, '/', 1) AND f.usuario_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "storage_func_doc_prestador_update" ON storage.objects;
CREATE POLICY "storage_func_doc_prestador_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'movelaria-funcionario-documentos'
    AND EXISTS (
      SELECT 1 FROM movelaria_funcionarios f
      WHERE f.id::text = split_part(name, '/', 1) AND f.usuario_id = auth.uid()
    )
  );

-- RPCs autenticadas para Meu Perfil
CREATE OR REPLACE FUNCTION movelaria_funcionario_meu_obter()
RETURNS JSONB AS $$
DECLARE
  v_row movelaria_funcionarios%ROWTYPE;
BEGIN
  SELECT * INTO v_row
  FROM movelaria_funcionarios
  WHERE usuario_id = auth.uid() AND ativo = true;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'nome', v_row.nome,
    'tipo', v_row.tipo,
    'cpf', v_row.cpf,
    'telefone', v_row.telefone,
    'email', v_row.email,
    'admissao_status', v_row.admissao_status,
    'admissao_dados', v_row.admissao_dados,
    'foto_perfil_path', v_row.foto_perfil_path,
    'documentos', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'id', d.id,
        'tipo_documento', d.tipo_documento,
        'nome_arquivo', d.nome_arquivo,
        'kind', d.kind,
        'storage_path', d.storage_path,
        'preview_path', d.preview_path,
        'criado_em', d.criado_em
      ) ORDER BY d.criado_em)
      FROM movelaria_funcionario_documentos d
      WHERE d.funcionario_id = v_row.id
        AND d.origem IN ('funcionario_publico', 'funcionario_sistema')
    ), '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

CREATE OR REPLACE FUNCTION movelaria_funcionario_meu_salvar(
  p_dados JSONB,
  p_finalizar BOOLEAN DEFAULT false
)
RETURNS JSONB AS $$
DECLARE
  v_row movelaria_funcionarios%ROWTYPE;
  v_status TEXT;
BEGIN
  SELECT * INTO v_row
  FROM movelaria_funcionarios
  WHERE usuario_id = auth.uid() AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhum cadastro de funcionário vinculado ao seu usuário.';
  END IF;

  IF v_row.admissao_status = 'completo' AND p_finalizar THEN
    RAISE EXCEPTION 'Admissão já foi concluída pelo RH.';
  END IF;

  v_status := CASE
    WHEN p_finalizar THEN 'preenchido_funcionario'
    ELSE CASE WHEN v_row.admissao_status = 'completo' THEN 'completo' ELSE v_row.admissao_status END
  END;

  UPDATE movelaria_funcionarios
  SET
    admissao_dados = COALESCE(admissao_dados, '{}'::jsonb) || COALESCE(p_dados, '{}'::jsonb),
    admissao_status = v_status,
    cpf = COALESCE(NULLIF(p_dados->>'cpf', ''), cpf),
    telefone = COALESCE(NULLIF(p_dados->>'telefone', ''), telefone),
    email = COALESCE(NULLIF(p_dados->>'email', ''), COALESCE(NULLIF(p_dados->>'email_pessoal', ''), email)),
    atualizado_em = NOW()
  WHERE id = v_row.id
  RETURNING * INTO v_row;

  RETURN jsonb_build_object('ok', true, 'admissao_status', v_row.admissao_status);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION movelaria_funcionario_meu_atualizar_foto(p_foto_path TEXT)
RETURNS void AS $$
BEGIN
  UPDATE movelaria_funcionarios
  SET foto_perfil_path = p_foto_path, atualizado_em = NOW()
  WHERE usuario_id = auth.uid() AND ativo = true;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Nenhum cadastro de funcionário vinculado ao seu usuário.';
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE ALL ON FUNCTION movelaria_funcionario_meu_obter() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_funcionario_meu_obter() TO authenticated;

REVOKE ALL ON FUNCTION movelaria_funcionario_meu_salvar(JSONB, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_funcionario_meu_salvar(JSONB, BOOLEAN) TO authenticated;

REVOKE ALL ON FUNCTION movelaria_funcionario_meu_atualizar_foto(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION movelaria_funcionario_meu_atualizar_foto(TEXT) TO authenticated;

-- Remove acesso anônimo às RPCs públicas de admissão
REVOKE EXECUTE ON FUNCTION movelaria_admissao_publica_obter(UUID) FROM anon;
REVOKE EXECUTE ON FUNCTION movelaria_admissao_publica_salvar(UUID, JSONB, BOOLEAN) FROM anon;
REVOKE EXECUTE ON FUNCTION movelaria_admissao_publica_registrar_doc(UUID, TEXT, TEXT, TEXT, TEXT, TEXT) FROM anon;

NOTIFY pgrst, 'reload schema';
