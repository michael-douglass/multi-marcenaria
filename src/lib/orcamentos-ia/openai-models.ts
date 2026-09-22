import { createOpenAI } from '@ai-sdk/openai'

/** Modelos oficiais do módulo Orçamentos IA (PRD v8). */
export const ORCAMENTOS_IA_MODELS = {
  extractorVision: 'gpt-4o',
  parser: 'gpt-4o-mini',
  supervisorAuditor: 'o3-mini',
  embedding: 'text-embedding-3-small',
} as const

/**
 * Factory do Vercel AI SDK / OpenAI.
 * Use apenas em Edge Functions ou scripts Node — nunca no browser com a API key.
 */
export function createOrcamentosOpenAI(apiKey: string) {
  return createOpenAI({ apiKey })
}
