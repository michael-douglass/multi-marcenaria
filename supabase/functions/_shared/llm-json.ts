/**
 * Cliente unificado OpenAI + Anthropic Claude para respostas JSON
 * (Orçamentos IA — Edge Functions Deno).
 */

export interface LlmJsonResult {
  json: Record<string, unknown>
  model: string
  schema_name: string
  system_preview: string
  response_preview: string
  provider: 'openai' | 'anthropic'
  usage: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  } | null
}

export function isClaudeModel(model: string): boolean {
  return model.startsWith('claude-')
}

/** Converte blocos estilo OpenAI chat → Anthropic Messages content. */
export function toAnthropicContent(userContent: unknown[]): unknown[] {
  const out: unknown[] = []
  for (const part of userContent) {
    if (!part || typeof part !== 'object') continue
    const p = part as Record<string, unknown>
    if (p.type === 'text' && typeof p.text === 'string') {
      out.push({ type: 'text', text: p.text })
      continue
    }
    if (p.type === 'image_url') {
      const imageUrl = p.image_url as { url?: string } | undefined
      const url = imageUrl?.url
      if (!url || typeof url !== 'string') continue
      if (url.startsWith('data:')) {
        const m = /^data:([^;]+);base64,(.+)$/s.exec(url)
        if (m) {
          out.push({
            type: 'image',
            source: { type: 'base64', media_type: m[1], data: m[2] },
          })
        }
      } else {
        out.push({
          type: 'image',
          source: { type: 'url', url },
        })
      }
    }
  }
  return out
}

function repairJsonText(text: string): string {
  let t = text.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '')
  }
  // vírgulas finais comuns em saídas de LLM
  t = t.replace(/,\s*([\]}])/g, '$1')
  return t
}

function extractJsonObject(text: string): Record<string, unknown> {
  const trimmed = repairJsonText(text)
  try {
    return JSON.parse(trimmed) as Record<string, unknown>
  } catch {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start >= 0 && end > start) {
      const slice = repairJsonText(trimmed.slice(start, end + 1))
      return JSON.parse(slice) as Record<string, unknown>
    }
    throw new Error('Resposta Claude não é JSON válido')
  }
}

function asToolInputSchema(schema: Record<string, unknown>): Record<string, unknown> {
  if (schema && typeof schema === 'object' && schema.type === 'object') {
    return schema
  }
  return {
    type: 'object',
    properties: {
      result: schema && typeof schema === 'object' ? schema : { type: 'object' },
    },
    required: ['result'],
  }
}

export async function openAiJson(params: {
  apiKey: string
  model: string
  system: string
  userContent: unknown[]
  schemaName: string
  schema: Record<string, unknown>
  maxTokens?: number
}): Promise<LlmJsonResult> {
  const body: Record<string, unknown> = {
    model: params.model,
    messages: [
      { role: 'system', content: params.system },
      { role: 'user', content: params.userContent },
    ],
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: params.schemaName,
        strict: false,
        schema: params.schema,
      },
    },
  }

  if (params.model.startsWith('o3') || params.model.startsWith('o1')) {
    body.max_completion_tokens = params.maxTokens ?? 16000
  } else {
    body.max_tokens = params.maxTokens ?? 12000
    body.temperature = 0.1
  }

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text()
    throw new Error(`OpenAI ${params.model} (${res.status}): ${errText.slice(0, 500)}`)
  }

  const data = await res.json()
  const content = data?.choices?.[0]?.message?.content
  if (!content || typeof content !== 'string') {
    throw new Error(`Resposta vazia do modelo ${params.model}`)
  }
  const usage =
    data?.usage && typeof data.usage === 'object'
      ? (data.usage as LlmJsonResult['usage'])
      : null
  return {
    json: JSON.parse(content) as Record<string, unknown>,
    model: params.model,
    schema_name: params.schemaName,
    system_preview: params.system.slice(0, 240),
    response_preview: content.slice(0, 4000),
    provider: 'openai',
    usage,
  }
}

function parseClaudeContentBlocks(
  blocks: unknown[],
  toolName: string,
): { json: Record<string, unknown>; preview: string } {
  const toolBlock = blocks.find(
    (b) =>
      b &&
      typeof b === 'object' &&
      (b as { type?: string; name?: string }).type === 'tool_use' &&
      (b as { name?: string }).name === toolName,
  ) as { input?: Record<string, unknown> } | undefined

  if (toolBlock?.input && typeof toolBlock.input === 'object') {
    const preview = JSON.stringify(toolBlock.input).slice(0, 4000)
    return { json: toolBlock.input, preview }
  }

  const text = blocks
    .filter((b) => b && typeof b === 'object' && (b as { type?: string }).type === 'text')
    .map((b) => (b as { text?: string }).text || '')
    .join('\n')
  if (!text.trim()) {
    throw new Error('Resposta vazia do modelo Claude (sem texto nem tool_use)')
  }
  return { json: extractJsonObject(text), preview: text.slice(0, 4000) }
}

/**
 * Claude Opus 5.5: sem tool_choice forçado (`tool`/`any` → 400).
 * Preferimos structured outputs (`output_config.format`); se o schema for rejeitado,
 * caímos em tools + tool_choice auto + instrução no system.
 */
export async function claudeJson(params: {
  apiKey: string
  model: string
  system: string
  userContent: unknown[]
  schemaName: string
  schema: Record<string, unknown>
  maxTokens?: number
  /** Opus 5.5 adaptive thinking — low evita 504 no gateway Supabase (~150s). */
  effort?: 'low' | 'medium' | 'high' | 'max' | 'xhigh'
}): Promise<LlmJsonResult> {
  const toolName = params.schemaName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64) || 'structured_json'
  const inputSchema = asToolInputSchema(params.schema)
  const effort = params.effort ?? 'low'
  const messages = [
    {
      role: 'user',
      content: toAnthropicContent(params.userContent),
    },
  ]

  const headers = {
    'x-api-key': params.apiKey,
    'anthropic-version': '2023-06-01',
    'Content-Type': 'application/json',
  }

  const systemStructured = [
    params.system,
    '',
    `Devolva o resultado como JSON válido no formato exigido (schema ${params.schemaName}). Sem markdown.`,
  ].join('\n')

  const structuredBody: Record<string, unknown> = {
    model: params.model,
    max_tokens: params.maxTokens ?? 16000,
    system: systemStructured,
    messages,
    output_config: {
      effort,
      format: {
        type: 'json_schema',
        schema: inputSchema,
      },
    },
  }

  let res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers,
    body: JSON.stringify(structuredBody),
  })

  let usedSystem = systemStructured

  if (!res.ok) {
    const errText = await res.text()
    const schemaRejected =
      res.status === 400 &&
      /schema|output_config|json_schema|additionalProperties|unsupported/i.test(errText)

    if (!schemaRejected) {
      throw new Error(`Anthropic ${params.model} (${res.status}): ${errText.slice(0, 500)}`)
    }

    // Fallback Opus 5.5: tools + auto (nunca tool_choice forçado)
    usedSystem = [
      params.system,
      '',
      `OBRIGATÓRIO: chame a ferramenta "${toolName}" exatamente uma vez com o resultado completo. Não responda só em texto.`,
    ].join('\n')

    const toolsBody: Record<string, unknown> = {
      model: params.model,
      max_tokens: params.maxTokens ?? 16000,
      system: usedSystem,
      tools: [
        {
          name: toolName,
          description: `Retorna o objeto JSON do schema ${params.schemaName}`,
          input_schema: inputSchema,
          strict: true,
        },
      ],
      tool_choice: { type: 'auto' },
      messages,
      output_config: { effort },
    }

    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(toolsBody),
    })

    if (!res.ok) {
      // Última tentativa: tools sem strict (schemas complexos)
      const softBody = {
        ...toolsBody,
        tools: [
          {
            name: toolName,
            description: `Retorna o objeto JSON do schema ${params.schemaName}`,
            input_schema: inputSchema,
          },
        ],
      }
      res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers,
        body: JSON.stringify(softBody),
      })
      if (!res.ok) {
        const softErr = await res.text()
        throw new Error(
          `Anthropic ${params.model} (${res.status}): ${softErr.slice(0, 500)} [após structured+strict]`,
        )
      }
    }
  }

  const data = await res.json()
  const blocks = Array.isArray(data?.content) ? data.content : []
  const { json, preview } = parseClaudeContentBlocks(blocks, toolName)

  const usage =
    data?.usage && typeof data.usage === 'object'
      ? {
          prompt_tokens: Number(data.usage.input_tokens) || undefined,
          completion_tokens: Number(data.usage.output_tokens) || undefined,
          total_tokens:
            (Number(data.usage.input_tokens) || 0) + (Number(data.usage.output_tokens) || 0) ||
            undefined,
        }
      : null

  return {
    json,
    model: params.model,
    schema_name: params.schemaName,
    system_preview: usedSystem.slice(0, 240),
    response_preview: preview,
    provider: 'anthropic',
    usage,
  }
}

/**
 * Roteia para Claude ou OpenAI conforme o model id.
 * Fallback Claude→gpt-4o só quando `allowOpenAiFallback` é true (modo pro / emergência).
 * Modo max passa `allowOpenAiFallback: false` — falha Claude vira erro para retentar.
 */
export async function llmJson(params: {
  openAiKey?: string | null
  anthropicKey?: string | null
  model: string
  system: string
  userContent: unknown[]
  schemaName: string
  schema: Record<string, unknown>
  maxTokens?: number
  /** Default true. False = Claude estrito (sem rebaixar para gpt-4o). */
  allowOpenAiFallback?: boolean
  effort?: 'low' | 'medium' | 'high' | 'max'
}): Promise<LlmJsonResult> {
  const allowOpenAiFallback = params.allowOpenAiFallback !== false
  if (isClaudeModel(params.model)) {
    if (!params.anthropicKey) {
      throw new Error('ANTHROPIC_API_KEY não configurada para modelo Claude.')
    }
    try {
      return await claudeJson({
        apiKey: params.anthropicKey,
        model: params.model,
        system: params.system,
        userContent: params.userContent,
        schemaName: params.schemaName,
        schema: params.schema,
        maxTokens: params.maxTokens,
        effort: params.effort,
      })
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      if (!allowOpenAiFallback) {
        throw new Error(
          `Modo max exige ${params.model}. Claude falhou (${message.slice(0, 220)}); retente a análise — fallback gpt-4o bloqueado.`,
        )
      }
      console.warn(`[llm-json] Claude falhou (${message.slice(0, 180)}); fallback gpt-4o`)
      if (!params.openAiKey) throw err
      return openAiJson({
        apiKey: params.openAiKey,
        model: 'gpt-4o',
        system: params.system,
        userContent: params.userContent,
        schemaName: params.schemaName,
        schema: params.schema,
        maxTokens: params.maxTokens,
      })
    }
  }
  if (!params.openAiKey) {
    throw new Error('OPENAI_API_KEY não configurada.')
  }
  return openAiJson({
    apiKey: params.openAiKey,
    model: params.model,
    system: params.system,
    userContent: params.userContent,
    schemaName: params.schemaName,
    schema: params.schema,
    maxTokens: params.maxTokens,
  })
}

/** Modelo Claude canônico (visão + auditor modo max). */
export const CLAUDE_OPUS_VISION = 'claude-opus-5-5'

/**
 * Escolhe modelos por modo + disponibilidade de chaves.
 * Modo max EXIGE Anthropic — não faz fallback silencioso para gpt-4o.
 */
export function resolveOrcamentosModels(params: {
  mode: 'max' | 'pro' | string
  hasAnthropic: boolean
}): { extractor: string; parser: string; auditor: string } {
  const mode = params.mode === 'pro' ? 'pro' : 'max'
  if (mode === 'max') {
    if (!params.hasAnthropic) {
      throw new Error(
        'Modo max exige ANTHROPIC_API_KEY na Edge (claude-opus-5-5). Configure o secret no Supabase.',
      )
    }
    return {
      extractor: CLAUDE_OPUS_VISION,
      parser: 'gpt-4o',
      auditor: CLAUDE_OPUS_VISION,
    }
  }
  // Modo pro: OpenAI leve
  return {
    extractor: 'gpt-4o',
    parser: 'gpt-4o-mini',
    auditor: 'o3-mini',
  }
}
