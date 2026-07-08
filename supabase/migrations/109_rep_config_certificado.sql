-- Migration 109: certificado digital REP-P em Configurações

ALTER TABLE movelaria_rep_config
  ADD COLUMN IF NOT EXISTS certificado_path TEXT,
  ADD COLUMN IF NOT EXISTS certificado_senha TEXT;

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'movelaria-rep-config',
  'movelaria-rep-config',
  false,
  5242880,
  ARRAY['application/x-pkcs12', 'application/octet-stream', 'application/pkcs7-signature']
)
ON CONFLICT (id) DO UPDATE SET
  allowed_mime_types = EXCLUDED.allowed_mime_types,
  file_size_limit = EXCLUDED.file_size_limit;

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
  'text/plain', 'application/pkcs7-signature',
  'application/x-pkcs12', 'application/octet-stream'
]
WHERE id = 'movelaria-funcionario-documentos';

DROP POLICY IF EXISTS "storage_rep_config_select" ON storage.objects;
CREATE POLICY "storage_rep_config_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'movelaria-rep-config'
    AND movelaria_meu_perfil() = 'administrador'
  );

DROP POLICY IF EXISTS "storage_rep_config_insert" ON storage.objects;
CREATE POLICY "storage_rep_config_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'movelaria-rep-config'
    AND movelaria_meu_perfil() = 'administrador'
  );

DROP POLICY IF EXISTS "storage_rep_config_update" ON storage.objects;
CREATE POLICY "storage_rep_config_update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'movelaria-rep-config'
    AND movelaria_meu_perfil() = 'administrador'
  );

DROP POLICY IF EXISTS "storage_rep_config_delete" ON storage.objects;
CREATE POLICY "storage_rep_config_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'movelaria-rep-config'
    AND movelaria_meu_perfil() = 'administrador'
  );

CREATE OR REPLACE FUNCTION movelaria_rep_obter_config()
RETURNS JSONB AS $$
DECLARE
  v_row movelaria_rep_config%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM movelaria_rep_config WHERE ativo = true LIMIT 1;
  IF NOT FOUND THEN RETURN NULL; END IF;

  RETURN jsonb_build_object(
    'id', v_row.id,
    'razao_social', v_row.razao_social,
    'cnpj', v_row.cnpj,
    'inpi_registro', v_row.inpi_registro,
    'versao_software', v_row.versao_software,
    'certificado_valido_ate', v_row.certificado_valido_ate,
    'nsr_atual', v_row.nsr_atual,
    'ativo', v_row.ativo,
    'certificado_configurado', v_row.certificado_path IS NOT NULL AND v_row.certificado_path <> '',
    'certificado_senha_configurada', v_row.certificado_senha IS NOT NULL AND v_row.certificado_senha <> '',
    'certificado_nome', CASE
      WHEN v_row.certificado_path IS NULL OR v_row.certificado_path = '' THEN NULL
      ELSE regexp_replace(v_row.certificado_path, '^.*[/\\]', '')
    END
  );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION movelaria_rep_salvar_config(
  p_razao_social TEXT,
  p_cnpj TEXT,
  p_inpi_registro TEXT DEFAULT NULL,
  p_versao_software TEXT DEFAULT '1.0.0',
  p_certificado_valido_ate DATE DEFAULT NULL,
  p_certificado_path TEXT DEFAULT NULL,
  p_certificado_senha TEXT DEFAULT NULL,
  p_atualizar_senha BOOLEAN DEFAULT false
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
    certificado_path = COALESCE(NULLIF(trim(p_certificado_path), ''), certificado_path),
    certificado_senha = CASE
      WHEN p_atualizar_senha THEN NULLIF(trim(COALESCE(p_certificado_senha, '')), '')
      ELSE certificado_senha
    END,
    atualizado_em = NOW()
  WHERE ativo = true
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    INSERT INTO movelaria_rep_config (
      razao_social, cnpj, inpi_registro, versao_software,
      certificado_valido_ate, certificado_path, certificado_senha, ativo
    ) VALUES (
      trim(p_razao_social), v_cnpj,
      NULLIF(trim(COALESCE(p_inpi_registro, '')), ''),
      COALESCE(NULLIF(trim(p_versao_software), ''), '1.0.0'),
      p_certificado_valido_ate,
      NULLIF(trim(COALESCE(p_certificado_path, '')), ''),
      NULLIF(trim(COALESCE(p_certificado_senha, '')), ''),
      true
    )
    RETURNING * INTO v_row;
  END IF;

  RETURN movelaria_rep_obter_config();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
