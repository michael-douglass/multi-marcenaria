/**
 * Modelos oficiais do módulo Orçamentos IA.
 * Constantes seguras para o browser — a Edge resolve o provider real via chaves.
 *
 * Chaves de UI (`ExtractionModelKey`) são estáveis; IDs de API podem evoluir.
 */

/** Chaves do seletor na UI / coluna quote_analyses.extraction_model */
export const EXTRACTION_MODEL_KEYS = ['claude-sonnet', 'claude-opus', 'gpt-4o'] as const
export type ExtractionModelKey = (typeof EXTRACTION_MODEL_KEYS)[number]

export const DEFAULT_EXTRACTION_MODEL: ExtractionModelKey = 'claude-sonnet'

/** IDs canônicos enviados à API (Anthropic / OpenAI). */
export const EXTRACTION_MODEL_API_IDS = {
  'claude-sonnet': 'claude-sonnet-4-5',
  'claude-opus': 'claude-opus-5-5',
  'gpt-4o': 'gpt-4o',
} as const satisfies Record<ExtractionModelKey, string>

export const EXTRACTION_MODEL_LABELS: Record<
  ExtractionModelKey,
  { label: string; hint: string }
> = {
  'claude-sonnet': {
    label: 'Sonnet (econômico)',
    hint: 'Rápido e barato — padrão recomendado',
  },
  'claude-opus': {
    label: 'Opus (alta complexidade)',
    hint: 'Força bruta para cadernos densos',
  },
  'gpt-4o': {
    label: 'GPT-4o (OpenAI)',
    hint: 'Alternativa sem Anthropic',
  },
}

export function isExtractionModelKey(value: unknown): value is ExtractionModelKey {
  return (
    typeof value === 'string' &&
    (EXTRACTION_MODEL_KEYS as readonly string[]).includes(value)
  )
}

export function resolveExtractionApiModel(key: ExtractionModelKey | string): string {
  if (isExtractionModelKey(key)) return EXTRACTION_MODEL_API_IDS[key]
  return EXTRACTION_MODEL_API_IDS[DEFAULT_EXTRACTION_MODEL]
}

export function isClaudeExtractionKey(key: ExtractionModelKey | string): boolean {
  return key === 'claude-sonnet' || key === 'claude-opus'
}

/**
 * Constantes legadas / informativas no body do client.
 * A Edge usa resolveOrcamentosModels(+ extraction_model) como fonte da verdade.
 */
export const ORCAMENTOS_IA_MODELS = {
  /** Default econômico (visão) */
  extractorVision: EXTRACTION_MODEL_API_IDS['claude-sonnet'],
  parser: 'gpt-4o-mini',
  supervisorAuditor: EXTRACTION_MODEL_API_IDS['claude-sonnet'],
  embedding: 'text-embedding-3-small',
  claudeSonnet: EXTRACTION_MODEL_API_IDS['claude-sonnet'],
  claudeOpus: EXTRACTION_MODEL_API_IDS['claude-opus'],
  extractorVisionOpenAi: 'gpt-4o',
  supervisorAuditorOpenAi: 'o3-mini',
} as const

export type OrcamentosIaModelId =
  (typeof ORCAMENTOS_IA_MODELS)[keyof typeof ORCAMENTOS_IA_MODELS]

export const ORCAMENTOS_IA_LLM_PROVIDERS = ['openai', 'anthropic'] as const

export function isClaudeModel(model: string): boolean {
  return model.startsWith('claude-')
}
