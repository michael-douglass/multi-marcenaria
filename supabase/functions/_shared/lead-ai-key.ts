export const LEAD_AI_KEY_MISSING =
  'Chave da OpenAI do Lead não configurada. Defina em Configurações IA.'

export const CONTRATO_AI_KEY_MISSING =
  'Chave da OpenAI de Contratos não configurada. Defina em Configurações IA.'

/** Lê só a chave do Lead (sem fallback de secret de ambiente). */
export function resolveLeadOpenAiKey(
  configRow: { openai_api_key?: string | null } | null | undefined,
): string {
  return configRow?.openai_api_key?.trim() || ''
}

/** Lê só a chave de Contratos (sem fallback Lead/env). */
export function resolveContratoOpenAiKey(
  configRow: { contrato_openai_api_key?: string | null } | null | undefined,
): string {
  return configRow?.contrato_openai_api_key?.trim() || ''
}
