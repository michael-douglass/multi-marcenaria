import { supabase } from '@/lib/supabase'
import { ORCAMENTOS_IA_MODELS } from '@/lib/orcamentos-ia/openai-models'

export interface AiMemoryMatch {
  id: string
  category: string
  user_instruction: string
  similarity: number
}

export interface AiMemoryRow {
  id: string
  company_id: string
  category: string
  user_instruction: string
  created_at: string
}

export interface SaveCompanyMemoryParams {
  companyId: string
  category: string
  userInstruction: string
}

export interface GetCompanyMemoriesParams {
  companyId: string
  query: string
  matchThreshold?: number
  matchCount?: number
}

/**
 * Busca memórias RAG da empresa (embedding + RPC `match_ai_memories`).
 * A vetorização roda na Edge Function (chave OpenAI só no servidor).
 */
export async function getCompanyMemories(
  params: GetCompanyMemoriesParams,
): Promise<{ memories: AiMemoryMatch[]; error?: string }> {
  const { data, error } = await supabase.functions.invoke('orcamentos-ia-memory', {
    body: {
      action: 'match',
      companyId: params.companyId,
      query: params.query,
      matchThreshold: params.matchThreshold ?? 0.7,
      matchCount: params.matchCount ?? 10,
      embeddingModel: ORCAMENTOS_IA_MODELS.embedding,
    },
  })

  if (error) return { memories: [], error: error.message }
  const payload = data as { ok?: boolean; error?: string; memories?: AiMemoryMatch[] }
  if (!payload?.ok) return { memories: [], error: payload?.error || 'Falha ao buscar memórias.' }
  return { memories: payload.memories ?? [] }
}

/** Lista todas as memórias da empresa (sem embedding — só leitura na UI). */
export async function listCompanyMemories(
  companyId: string,
): Promise<{ memories: AiMemoryRow[]; error?: string }> {
  if (!companyId) return { memories: [], error: 'Empresa não identificada.' }
  const { data, error } = await supabase
    .from('ai_memories')
    .select('id, company_id, category, user_instruction, created_at')
    .eq('company_id', companyId)
    .order('created_at', { ascending: false })
    .limit(200)
  if (error) return { memories: [], error: error.message }
  return { memories: (data ?? []) as AiMemoryRow[] }
}

export async function deleteCompanyMemory(id: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('ai_memories').delete().eq('id', id)
  if (error) return { error: error.message }
  return {}
}

/**
 * Gera embedding `text-embedding-3-small` da correção e grava em `ai_memories`.
 */
export async function saveCompanyMemory(
  params: SaveCompanyMemoryParams,
): Promise<{ id?: string; error?: string }> {
  const instruction = params.userInstruction.trim()
  if (!instruction) return { error: 'Explique a correção para a IA aprender.' }
  if (!params.companyId) return { error: 'Empresa não identificada.' }

  const { data, error } = await supabase.functions.invoke('orcamentos-ia-memory', {
    body: {
      action: 'save',
      companyId: params.companyId,
      category: params.category || 'correcao_auditoria',
      userInstruction: instruction,
      embeddingModel: ORCAMENTOS_IA_MODELS.embedding,
    },
  })

  if (error) return { error: error.message }
  const payload = data as { ok?: boolean; error?: string; id?: string }
  if (!payload?.ok) return { error: payload?.error || 'Falha ao salvar memória.' }
  return { id: payload.id }
}

/** Texto pronto para injetar no System Prompt do Extrator. */
export function formatMemoriesForPrompt(memories: AiMemoryMatch[]): string {
  if (!memories.length) return ''
  const lines = memories.map(
    (m, i) =>
      `${i + 1}. [${m.category}] (sim=${m.similarity.toFixed(2)}) ${m.user_instruction}`,
  )
  return [
    '## Regras aprendidas com correções anteriores desta marcenaria (RAG)',
    'Aplique estas instruções com prioridade sobre heurísticas genéricas:',
    ...lines,
  ].join('\n')
}

export interface AskMaxParams {
  companyId: string
  analysisId: string
  question: string
  selectionSummary?: string
}

export async function askMaxChat(
  params: AskMaxParams,
): Promise<{ answer?: string; error?: string }> {
  const question = params.question.trim()
  if (!question) return { error: 'Digite uma pergunta.' }
  if (!params.companyId || !params.analysisId) {
    return { error: 'Contexto do orçamento incompleto.' }
  }

  const { data, error } = await supabase.functions.invoke('orcamentos-ia-chat', {
    body: {
      companyId: params.companyId,
      analysisId: params.analysisId,
      question,
      selectionSummary: params.selectionSummary ?? null,
    },
  })

  if (error) return { error: error.message }
  const payload = data as { ok?: boolean; error?: string; answer?: string }
  if (!payload?.ok) return { error: payload?.error || 'Falha no chat com o Max.' }
  return { answer: payload.answer ?? '' }
}
