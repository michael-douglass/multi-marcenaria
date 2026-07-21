-- Migration 128: Meu Perfil — devolver preview_paths (todas as páginas do PDF)

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
        'preview_paths', d.preview_paths,
        'criado_em', d.criado_em
      ) ORDER BY d.criado_em)
      FROM movelaria_funcionario_documentos d
      WHERE d.funcionario_id = v_row.id
        AND d.origem IN ('funcionario_publico', 'funcionario_sistema')
    ), '[]'::jsonb)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE SET search_path = public;

NOTIFY pgrst, 'reload schema';
