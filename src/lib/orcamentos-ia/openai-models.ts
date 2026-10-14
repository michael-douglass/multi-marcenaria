/**
 * Modelos oficiais do módulo Orçamentos IA (PRD v12).
 * Constantes seguras para o browser — a Edge resolve o provider real via ANTHROPIC_API_KEY.
 * Modo max: visão/extração/auditor = Claude Opus; parser leve permanece OpenAI.
 */
export const ORCAMENTOS_IA_MODELS = {
  /** Visão + extração (modo max) — Anthropic */
  extractorVision: 'claude-opus-5-5',
  /** De-para / JSON leve (OpenAI) */
  parser: 'gpt-4o-mini',
  /** Auditor supervisor (modo max) — Anthropic */
  supervisorAuditor: 'claude-opus-5-5',
  embedding: 'text-embedding-3-small',
  /** Alias explícito Claude Opus */
  claudeOpus: 'claude-opus-5-5',
  /** Fallback OpenAI se Anthropic indisponível (só modo pro / emergência) */
  extractorVisionOpenAi: 'gpt-4o',
  supervisorAuditorOpenAi: 'o3-mini',
} as const

export type OrcamentosIaModelId =
  (typeof ORCAMENTOS_IA_MODELS)[keyof typeof ORCAMENTOS_IA_MODELS]

/** Providers ativos no módulo. */
export const ORCAMENTOS_IA_LLM_PROVIDERS = ['openai', 'anthropic'] as const

/** True se o model id é da família Claude. */
export function isClaudeModel(model: string): boolean {
  return model.startsWith('claude-')
}
