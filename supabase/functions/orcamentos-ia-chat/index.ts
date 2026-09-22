import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0'
import { corsHeaders } from '../_shared/cors.ts'

const CHAT_MODEL = 'gpt-4o-mini'

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
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
    const openAiKey = Deno.env.get('OPENAI_API_KEY')?.trim()
    if (!openAiKey) {
      return jsonResponse({ ok: false, error: 'OPENAI_API_KEY não configurada.' }, 500)
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    })
    const { data: userData, error: userError } = await userClient.auth.getUser()
    if (userError || !userData.user) {
      return jsonResponse({ ok: false, error: 'Sessão inválida.' }, 401)
    }

    const body = (await req.json()) as {
      companyId?: string
      analysisId?: string
      question?: string
      selectionSummary?: string | null
    }

    const companyId = body.companyId?.trim()
    const analysisId = body.analysisId?.trim()
    const question = body.question?.trim()
    if (!companyId || !analysisId || !question) {
      return jsonResponse(
        { ok: false, error: 'companyId, analysisId e question são obrigatórios.' },
        400,
      )
    }

    const admin = createClient(supabaseUrl, serviceKey)

    const { data: analysis, error: analysisError } = await admin
      .from('quote_analyses')
      .select('id, company_id, status, mode, totals, error_message')
      .eq('id', analysisId)
      .eq('company_id', companyId)
      .maybeSingle()

    if (analysisError) throw new Error(analysisError.message)
    if (!analysis) {
      return jsonResponse({ ok: false, error: 'Orçamento não encontrado.' }, 404)
    }

    const { data: environments } = await admin
      .from('quote_environments')
      .select('id, name, sort_order')
      .eq('analysis_id', analysisId)
      .order('sort_order', { ascending: true })

    const envIds = (environments ?? []).map((e) => e.id)
    let modules: Array<{ id: string; name: string; environment_id: string; description: string | null }> = []
    if (envIds.length) {
      const { data: mods } = await admin
        .from('quote_modules')
        .select('id, name, environment_id, description')
        .in('environment_id', envIds)
        .order('sort_order', { ascending: true })
      modules = (mods ?? []) as typeof modules
    }

    const modIds = modules.map((m) => m.id)
    let materials: Array<{
      raw_name: string
      category: string
      exact_quantity: number | null
      unit_price: number | null
      module_id: string
    }> = []
    if (modIds.length) {
      const { data: mats } = await admin
        .from('quote_materials')
        .select('raw_name, category, exact_quantity, unit_price, module_id')
        .in('module_id', modIds)
        .limit(200)
      materials = (mats ?? []) as typeof materials
    }

    const { data: memories } = await admin
      .from('ai_memories')
      .select('category, user_instruction')
      .eq('company_id', companyId)
      .order('created_at', { ascending: false })
      .limit(12)

    const treeLines: string[] = []
    for (const env of environments ?? []) {
      treeLines.push(`Ambiente: ${env.name}`)
      for (const mod of modules.filter((m) => m.environment_id === env.id)) {
        treeLines.push(`  - Módulo: ${mod.name}${mod.description ? ` (${mod.description})` : ''}`)
        const mats = materials.filter((m) => m.module_id === mod.id).slice(0, 12)
        for (const mat of mats) {
          treeLines.push(
            `      · ${mat.raw_name} [${mat.category}] qtd=${mat.exact_quantity ?? '?'} preço=${mat.unit_price ?? '?'}`,
          )
        }
      }
    }

    const memoryLines = (memories ?? [])
      .map((m, i) => `${i + 1}. [${m.category}] ${m.user_instruction}`)
      .join('\n')

    const system = `Você é o Max, assistente técnico de orçamento de marcenaria (Planilha 4.0 / GARBO).
Responda em português, de forma clara e objetiva (como para um profissional de marcenaria).
Use o contexto do orçamento e das memórias da oficina. Se algo não estiver no contexto, diga que não sabe.
Não invente preços fora do que aparece no contexto.`

    const userPrompt = [
      `Status do orçamento: ${analysis.status} | modo: ${analysis.mode}`,
      body.selectionSummary ? `Seleção atual na tela: ${body.selectionSummary}` : '',
      '',
      '## Árvore do orçamento',
      treeLines.join('\n') || '(sem módulos extraídos)',
      '',
      '## Memórias / regras da oficina',
      memoryLines || '(nenhuma)',
      '',
      `## Pergunta do usuário`,
      question,
    ]
      .filter(Boolean)
      .join('\n')

    const oaRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: CHAT_MODEL,
        temperature: 0.3,
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    if (!oaRes.ok) {
      const errText = await oaRes.text()
      throw new Error(`OpenAI chat (${oaRes.status}): ${errText.slice(0, 400)}`)
    }

    const oaJson = await oaRes.json()
    const answer = (oaJson?.choices?.[0]?.message?.content as string | undefined)?.trim()
    if (!answer) throw new Error('Resposta vazia do modelo.')

    return jsonResponse({ ok: true, answer })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro no chat Max'
    console.error('[orcamentos-ia-chat]', message)
    return jsonResponse({ ok: false, error: message }, 500)
  }
})
