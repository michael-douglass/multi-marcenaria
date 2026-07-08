import { supabase } from '@/lib/supabase'
import type { RepConfig, RepConfigInput } from '@/types'

export const REP_CONFIG_BUCKET = 'movelaria-rep-config'

const CERT_STORAGE_PATH = 'certificado-digital.pfx'

export async function fetchRepConfig(): Promise<RepConfig | null> {
  const { data, error } = await supabase.rpc('movelaria_rep_obter_config')
  if (error) throw new Error(error.message)
  return (data as RepConfig | null) ?? null
}

export async function salvarRepConfig(
  input: RepConfigInput,
  options?: { atualizarSenha?: boolean },
): Promise<RepConfig> {
  const { data, error } = await supabase.rpc('movelaria_rep_salvar_config', {
    p_razao_social: input.razao_social,
    p_cnpj: input.cnpj,
    p_inpi_registro: input.inpi_registro ?? null,
    p_versao_software: input.versao_software,
    p_certificado_valido_ate: input.certificado_valido_ate ?? null,
    p_certificado_path: input.certificado_path ?? null,
    p_certificado_senha: input.certificado_senha ?? null,
    p_atualizar_senha: options?.atualizarSenha ?? false,
  })
  if (error) throw new Error(error.message)
  return data as RepConfig
}

export async function uploadRepCertificado(file: File): Promise<string> {
  const ext = file.name.toLowerCase().endsWith('.p12') ? 'p12' : 'pfx'
  const path = ext === 'p12' ? 'certificado-digital.p12' : CERT_STORAGE_PATH
  const mime = file.type || 'application/x-pkcs12'

  const { error } = await supabase.storage
    .from(REP_CONFIG_BUCKET)
    .upload(path, file, { contentType: mime, upsert: true })

  if (error) throw new Error(error.message)
  return path
}

export async function removerRepCertificado(): Promise<void> {
  const paths = [CERT_STORAGE_PATH, 'certificado-digital.p12']
  await supabase.storage.from(REP_CONFIG_BUCKET).remove(paths)
}
