import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { corsHeaders } from '../_shared/cors.ts'
import {
  loadOrcamentosIaSecrets,
  ORCAMENTOS_IA_KEY_MISSING,
} from '../_shared/orcamentos-ia-secrets.ts'

const DEFAULT_MODEL = 'text-embedding-3-small'
const EMBEDDING_DIM = 1536

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

async function createEmbedding(apiKey: string, text: string, model: string): Promise<number[]> {
  const res = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: text,
      dimensions: EMBEDDING_DIM,
    }),
  })
  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`Embeddings OpenAI (${res.status}): ${errText.slice(0, 400)}`)
  }
  const data = await res.json()
  const embedding = data?.data?.[0]?.embedding as number[] | undefined
  if (!embedding?.length) throw new Error('Embedding vazio.')
  return embedding
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) return jsonResponse({ ok: false, error: 'Não autenticado.' }, 401)

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) {
      return jsonResponse({ ok: false, error: 'Sessão inválida.' }, 401)
    }

    const body = await req.json() as {
      action?: 'save' | 'match'
      companyId?: string
      category?: string
      userInstruction?: string
      query?: string
      matchThreshold?: number
      matchCount?: number
      embeddingModel?: string
    }

    const companyId = body.companyId?.trim()
    if (!companyId) return jsonResponse({ ok: false, error: 'companyId obrigatório.' }, 400)

    const model = body.embeddingModel?.trim() || DEFAULT_MODEL
    const admin = createClient(supabaseUrl, serviceKey)
    const { openAiKey } = await loadOrcamentosIaSecrets(admin, companyId)
    if (!openAiKey) {
      return jsonResponse({ ok: false, error: ORCAMENTOS_IA_KEY_MISSING }, 500)
    }

    if (body.action === 'save') {
      const instruction = body.userInstruction?.trim()
      if (!instruction) {
        return jsonResponse({ ok: false, error: 'userInstruction obrigatório.' }, 400)
      }
      const embedding = await createEmbedding(openAiKey, instruction, model)
      const { data, error } = await admin
        .from('ai_memories')
        .insert({
          company_id: companyId,
          category: body.category?.trim() || 'correcao_auditoria',
          user_instruction: instruction,
          embedding,
        })
        .select('id')
        .single()
      if (error) throw new Error(error.message)
      return jsonResponse({ ok: true, id: data.id })
    }

    if (body.action === 'match') {
      const query = body.query?.trim() || 'regras de orçamento e correções de marcenaria'
      const embedding = await createEmbedding(openAiKey, query, model)
      const { data, error } = await admin.rpc('match_ai_memories', {
        query_embedding: embedding,
        filter_company_id: companyId,
        match_threshold: body.matchThreshold ?? 0.7,
        match_count: body.matchCount ?? 10,
      })
      if (error) throw new Error(error.message)
      return jsonResponse({ ok: true, memories: data ?? [] })
    }

    return jsonResponse({ ok: false, error: 'action deve ser save ou match.' }, 400)
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro na memória RAG'
    console.error('[orcamentos-ia-memory]', message)
    return jsonResponse({ ok: false, error: message }, 500)
  }
})
