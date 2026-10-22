import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'

export interface OrcamentosIaSecrets {
  openAiKey: string | null
  anthropicKey: string | null
}

/** Carrega chaves do Orçamentos IA salvas em Configurações IA (por company_id). */
export async function loadOrcamentosIaSecrets(
  admin: SupabaseClient,
  companyId: string,
): Promise<OrcamentosIaSecrets> {
  const { data, error } = await admin
    .from('orcamentos_ia_ai_secrets')
    .select('openai_api_key, anthropic_api_key')
    .eq('company_id', companyId)
    .maybeSingle()

  if (error) {
    console.error('orcamentos_ia_ai_secrets', error)
    throw new Error('Erro ao carregar chaves do Orçamentos IA.')
  }

  return {
    openAiKey: data?.openai_api_key?.trim() || null,
    anthropicKey: data?.anthropic_api_key?.trim() || null,
  }
}

export const ORCAMENTOS_IA_KEY_MISSING =
  'Chave da OpenAI do Orçamentos IA não configurada. Defina em Configurações IA.'

export const ORCAMENTOS_IA_ANY_KEY_MISSING =
  'Nenhuma chave de IA do Orçamentos configurada. Defina OpenAI e/ou Anthropic em Configurações IA.'
