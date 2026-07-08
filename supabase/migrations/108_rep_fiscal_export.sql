-- Migration 108: exportação fiscal REP-P (AFD/AEJ)

-- Permite arquivos .txt e assinaturas .p7s no bucket de documentos
UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'application/pdf',
  'text/plain',
  'application/pkcs7-signature'
]
WHERE id = 'movelaria-funcionario-documentos';

ALTER TABLE movelaria_rep_arquivos
  ADD COLUMN IF NOT EXISTS funcionario_id UUID REFERENCES movelaria_funcionarios(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_rep_arquivos_funcionario
  ON movelaria_rep_arquivos(funcionario_id, criado_em DESC);

CREATE OR REPLACE FUNCTION movelaria_rep_salvar_config(
  p_razao_social TEXT,
  p_cnpj TEXT,
  p_inpi_registro TEXT DEFAULT NULL,
  p_versao_software TEXT DEFAULT '1.0.0',
  p_certificado_valido_ate DATE DEFAULT NULL
)
RETURNS JSONB AS $$
DECLARE
  v_row movelaria_rep_config%ROWTYPE;
  v_cnpj TEXT := regexp_replace(COALESCE(p_cnpj, ''), '\D', '', 'g');
BEGIN
  IF movelaria_meu_perfil() <> 'administrador' THEN
    RAISE EXCEPTION 'Somente administradores podem alterar a configuração REP-P.';
  END IF;

  IF length(v_cnpj) <> 14 THEN
    RAISE EXCEPTION 'CNPJ inválido. Informe 14 dígitos.';
  END IF;

  IF trim(COALESCE(p_razao_social, '')) = '' THEN
    RAISE EXCEPTION 'Razão social é obrigatória.';
  END IF;

  UPDATE movelaria_rep_config
  SET
    razao_social = trim(p_razao_social),
    cnpj = v_cnpj,
    inpi_registro = NULLIF(trim(COALESCE(p_inpi_registro, '')), ''),
    versao_software = COALESCE(NULLIF(trim(p_versao_software), ''), '1.0.0'),
    certificado_valido_ate = p_certificado_valido_ate,
    atualizado_em = NOW()
  WHERE ativo = true
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    INSERT INTO movelaria_rep_config (
      razao_social, cnpj, inpi_registro, versao_software, certificado_valido_ate, ativo
    ) VALUES (
      trim(p_razao_social), v_cnpj,
      NULLIF(trim(COALESCE(p_inpi_registro, '')), ''),
      COALESCE(NULLIF(trim(p_versao_software), ''), '1.0.0'),
      p_certificado_valido_ate,
      true
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN to_jsonb(v_row);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
