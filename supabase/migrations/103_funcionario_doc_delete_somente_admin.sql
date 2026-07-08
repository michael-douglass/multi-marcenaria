-- Migration 103: Somente administrador pode excluir documentos de funcionários

DROP POLICY IF EXISTS "func_doc_delete_prestador" ON movelaria_funcionario_documentos;

DROP POLICY IF EXISTS "func_doc_delete" ON movelaria_funcionario_documentos;
CREATE POLICY "func_doc_delete" ON movelaria_funcionario_documentos
  FOR DELETE TO authenticated
  USING (movelaria_meu_perfil() = 'administrador');

DROP POLICY IF EXISTS "storage_func_doc_delete" ON storage.objects;
CREATE POLICY "storage_func_doc_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'movelaria-funcionario-documentos'
    AND movelaria_meu_perfil() = 'administrador'
  );

NOTIFY pgrst, 'reload schema';
