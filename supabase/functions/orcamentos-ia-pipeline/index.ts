import { createClient } from 'npm:@supabase/supabase-js@2.75.0'
import { corsHeaders } from '../_shared/cors.ts'

const EXTRACTOR_MODEL = 'gpt-4o'
const PARSER_MODEL = 'gpt-4o-mini'
const AUDITOR_MODEL = 'o3-mini'
const BATCH_SIZE = 8
const MAX_PAGES = 40

interface PipelineBody {
  analysisId: string
  companyId: string
  mode?: 'max' | 'pro'
  pagePaths: string[]
  ragMemoriesPrompt?: string
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function normalizeKey(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

type AnyRec = Record<string, unknown>

function asObjArray(value: unknown): AnyRec[] {
  if (!Array.isArray(value)) return []
  return value.filter((x) => x && typeof x === 'object') as AnyRec[]
}

function mergeNumeric(a: unknown, b: unknown): number {
  const va = Number.isFinite(Number(a)) ? Number(a) : 0
  const vb = Number.isFinite(Number(b)) ? Number(b) : 0
  return va + vb
}

function materialKey(item: AnyRec, kind: string): string {
  const name =
    (typeof item.raw_name === 'string' && item.raw_name) ||
    (typeof item.material_name === 'string' && item.material_name) ||
    (typeof item.tape_name === 'string' && item.tape_name) ||
    (typeof item.name === 'string' && item.name) ||
    ''
  const cat = typeof item.category === 'string' ? item.category : kind
  return `${kind}|${cat}|${normalizeKey(name)}`
}

function mergeMaterialList(existing: AnyRec[], incoming: AnyRec[], kind: string): AnyRec[] {
  const map = new Map<string, AnyRec>()
  for (const item of [...existing, ...incoming]) {
    const key = materialKey(item, kind)
    const prev = map.get(key)
    if (!prev) {
      map.set(key, { ...item })
      continue
    }
    const next = { ...prev }
    for (const qtyKey of ['quantity', 'exact_quantity', 'full_units_quantity', 'meters']) {
      if (qtyKey in item || qtyKey in prev) {
        next[qtyKey] = mergeNumeric(prev[qtyKey], item[qtyKey])
      }
    }
    map.set(key, next)
  }
  return [...map.values()]
}

function mergeModule(a: AnyRec, b: AnyRec): AnyRec {
  return {
    ...a,
    ...b,
    name: (typeof a.name === 'string' && a.name) || b.name,
    description: a.description || b.description,
    dimensions: a.dimensions && Object.keys(a.dimensions as object).length ? a.dimensions : b.dimensions,
    bounding_box: a.bounding_box || b.bounding_box,
    caixaria: mergeMaterialList(asObjArray(a.caixaria), asObjArray(b.caixaria), 'caixaria'),
    frentes_portas: mergeMaterialList(asObjArray(a.frentes_portas), asObjArray(b.frentes_portas), 'frente'),
    ferragens: mergeMaterialList(asObjArray(a.ferragens), asObjArray(b.ferragens), 'ferragem'),
    fitas_borda_m: mergeMaterialList(asObjArray(a.fitas_borda_m), asObjArray(b.fitas_borda_m), 'fita'),
  }
}

function mergeEnvironment(a: AnyRec, b: AnyRec): AnyRec {
  const modules = new Map<string, AnyRec>()
  for (const mod of [...asObjArray(a.modules), ...asObjArray(b.modules)]) {
    const name = typeof mod.name === 'string' ? mod.name : 'Modulo'
    const key = normalizeKey(name)
    const prev = modules.get(key)
    modules.set(key, prev ? mergeModule(prev, mod) : { ...mod })
  }
  return {
    ...a,
    name: (typeof a.name === 'string' && a.name) || b.name,
    modules: [...modules.values()],
  }
}

function mergeExtractions(parts: unknown[]): AnyRec {
  const environments = new Map<string, AnyRec>()
  const auditorNotes: string[] = []
  const warnings: string[] = []

  for (const part of parts) {
    if (!part || typeof part !== 'object') continue
    const root = part as AnyRec
    if (Array.isArray(root.auditor_notes)) {
      for (const n of root.auditor_notes) {
        if (typeof n === 'string' && n.trim()) auditorNotes.push(n.trim())
      }
    }
    if (Array.isArray(root.warnings)) {
      for (const w of root.warnings) {
        if (typeof w === 'string' && w.trim()) warnings.push(w.trim())
      }
    }
    for (const env of asObjArray(root.environments)) {
      const name = typeof env.name === 'string' ? env.name : 'Ambiente'
      const key = normalizeKey(name)
      const prev = environments.get(key)
      environments.set(key, prev ? mergeEnvironment(prev, env) : { ...env })
    }
  }

  return {
    environments: [...environments.values()],
    auditor_notes: [...new Set(auditorNotes)],
    warnings: [...new Set(warnings)],
  }
}

function ensurePlaceholders(extraction: AnyRec): AnyRec {
  const OUT = [
    'tapete',
    'quadro',
    'puff',
    'pendente',
    'arandela',
    'led',
    'luminaria',
    'westwing',
    'nordecor',
    'pendurador',
    'espelho',
    'almofada',
    'cortina',
    'vaso',
    'planta',
    'decoracao',
    'decoração',
  ]
  const environments = asObjArray(extraction.environments).map((env) => {
    const modules = asObjArray(env.modules).map((mod) => {
      const name = typeof mod.name === 'string' ? mod.name : 'Modulo'
      const nameKey = normalizeKey(name)
      const outOfScope = mod.out_of_scope === true || OUT.some((h) => nameKey.includes(h))
      const total =
        asObjArray(mod.caixaria).length +
        asObjArray(mod.frentes_portas).length +
        asObjArray(mod.ferragens).length +
        asObjArray(mod.fitas_borda_m).length
      if (total > 0) return { ...mod, out_of_scope: outOfScope || undefined }
      // Marcenaria sem peças: NÃO inventar placeholder — deixa o auditor completar
      if (!outOfScope) return { ...mod, caixaria: [], frentes_portas: [], ferragens: [], fitas_borda_m: [] }
      return {
        ...mod,
        out_of_scope: true,
        ferragens: [
          {
            raw_name: `Fora de escopo — ${name}`,
            category: 'consumivel',
            unit_measure: 'un',
            exact_quantity: 1,
            full_units_quantity: 1,
            notes: 'Decoração/iluminação — não bloqueia marcenaria.',
          },
        ],
      }
    })
    return { ...env, modules }
  })
  return { ...extraction, environments }
}

function findBomGaps(extraction: AnyRec): Array<{ environment: string; module: string; reason: string }> {
  const gaps: Array<{ environment: string; module: string; reason: string }> = []
  for (const env of asObjArray(extraction.environments)) {
    const envName = typeof env.name === 'string' ? env.name : 'Ambiente'
    for (const mod of asObjArray(env.modules)) {
      if (mod.out_of_scope === true) continue
      const modName = typeof mod.name === 'string' ? mod.name : 'Modulo'
      const nameKey = normalizeKey(modName)
      if (
        ['tapete', 'quadro', 'puff', 'pendente', 'arandela', 'led', 'pendurador', 'espelho', 'almofada', 'cortina', 'vaso', 'planta'].some((h) =>
          nameKey.includes(h),
        )
      ) {
        continue
      }
      const caixaria = asObjArray(mod.caixaria)
      const frentes = asObjArray(mod.frentes_portas)
      const ferragens = asObjArray(mod.ferragens)
      const hasChapa = caixaria.length + frentes.length > 0
      const hasPlaceholder = ferragens.some((f) =>
        /a confirmar|placeholder/i.test(String(f.raw_name || '')),
      )
      if (!hasChapa) {
        gaps.push({
          environment: envName,
          module: modName,
          reason: 'Sem caixaria/frente (chapa MDF) — cotar chapas e ferragens',
        })
      } else if (hasPlaceholder) {
        gaps.push({
          environment: envName,
          module: modName,
          reason: 'Remover placeholder e detalhar ferragens/puxadores',
        })
      }
    }
  }
  return gaps
}

function buildCoverage(inventory: Array<{ environment: string; modules: string[] }>, extraction: AnyRec) {
  const expected: Array<{ environment: string; module: string }> = []
  for (const env of inventory) {
    for (const mod of env.modules) expected.push({ environment: env.environment, module: mod })
  }
  const extracted: Array<{ environment: string; module: string }> = []
  for (const env of asObjArray(extraction.environments)) {
    const envName = typeof env.name === 'string' ? env.name : 'Ambiente'
    for (const mod of asObjArray(env.modules)) {
      extracted.push({
        environment: envName,
        module: typeof mod.name === 'string' ? mod.name : 'Modulo',
      })
    }
  }
  const extractedKeys = new Set(
    extracted.map((i) => `${normalizeKey(i.environment)}::${normalizeKey(i.module)}`),
  )
  const missing = expected.filter((item) => {
    const key = `${normalizeKey(item.environment)}::${normalizeKey(item.module)}`
    if (extractedKeys.has(key)) return false
    const modKey = normalizeKey(item.module)
    // Match flexível: "Guarda Roupa" cobre "Guarda Roupa em MDF Arauco" e vice-versa
    for (const k of extractedKeys) {
      const extractedMod = k.split('::')[1] || ''
      if (!extractedMod) continue
      if (extractedMod === modKey) return false
      if (extractedMod.includes(modKey) || modKey.includes(extractedMod)) return false
      const tokensExp = modKey.split(' ').filter((t) => t.length >= 4)
      const tokensExt = extractedMod.split(' ').filter((t) => t.length >= 4)
      if (tokensExp.length && tokensExp.every((t) => extractedMod.includes(t))) return false
      if (tokensExt.length >= 2 && tokensExt.filter((t) => modKey.includes(t)).length >= 2) {
        return false
      }
    }
    return true
  })
  return {
    expected,
    extracted,
    missing,
    coveredCount: expected.length - missing.length,
    expectedCount: expected.length,
  }
}

const EXTRACTOR_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['environments', 'auditor_notes', 'warnings'],
  properties: {
    environments: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['name', 'modules'],
        properties: {
          name: { type: 'string' },
          modules: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              additionalProperties: false,
              required: ['name', 'caixaria', 'frentes_portas', 'ferragens', 'fitas_borda_m'],
              properties: {
                name: { type: 'string' },
                description: { type: 'string' },
                dimensions: {
                  type: 'object',
                  properties: {
                    width_mm: { type: 'number' },
                    height_mm: { type: 'number' },
                    depth_mm: { type: 'number' },
                  },
                },
                bounding_box: {
                  type: 'object',
                  properties: {
                    page: { type: 'integer' },
                    x: { type: 'number' },
                    y: { type: 'number' },
                    width: { type: 'number' },
                    height: { type: 'number' },
                  },
                },
                caixaria: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['name', 'function', 'width_mm', 'height_mm', 'material_name', 'quantity'],
                    properties: {
                      name: { type: 'string' },
                      function: {
                        type: 'string',
                        enum: [
                          'base',
                          'lateral',
                          'divisoria',
                          'prateleira',
                          'fundo',
                          'sarrafo',
                          'tampo',
                          'outro',
                        ],
                      },
                      width_mm: { type: 'number' },
                      height_mm: { type: 'number' },
                      thickness_mm: { type: 'number' },
                      material_name: { type: 'string' },
                      quantity: { type: 'number' },
                      edge_banding: {
                        type: 'object',
                        properties: {
                          C1: { type: 'boolean' },
                          C2: { type: 'boolean' },
                          L1: { type: 'boolean' },
                          L2: { type: 'boolean' },
                          tape_name: { type: 'string' },
                          meters: { type: 'number' },
                        },
                      },
                      bounding_box: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer' },
                          x: { type: 'number' },
                          y: { type: 'number' },
                          width: { type: 'number' },
                          height: { type: 'number' },
                        },
                      },
                    },
                  },
                },
                frentes_portas: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['name', 'kind', 'width_mm', 'height_mm', 'material_name', 'quantity'],
                    properties: {
                      name: { type: 'string' },
                      kind: {
                        type: 'string',
                        enum: [
                          'porta_giro',
                          'porta_correr',
                          'frente_gaveta',
                          'frente_falsa',
                          'basculante',
                          'tamponamento',
                        ],
                      },
                      width_mm: { type: 'number' },
                      height_mm: { type: 'number' },
                      thickness_mm: { type: 'number' },
                      material_name: { type: 'string' },
                      quantity: { type: 'number' },
                      bounding_box: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer' },
                          x: { type: 'number' },
                          y: { type: 'number' },
                          width: { type: 'number' },
                          height: { type: 'number' },
                        },
                      },
                    },
                  },
                },
                ferragens: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['raw_name', 'category', 'unit_measure', 'exact_quantity', 'full_units_quantity'],
                    properties: {
                      raw_name: { type: 'string' },
                      category: { type: 'string', enum: ['ferragem', 'puxador', 'consumivel'] },
                      unit_measure: { type: 'string', enum: ['un', 'barra', 'm', 'kg'] },
                      exact_quantity: { type: 'number' },
                      full_units_quantity: { type: 'integer' },
                      notes: { type: 'string' },
                      bounding_box: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer' },
                          x: { type: 'number' },
                          y: { type: 'number' },
                          width: { type: 'number' },
                          height: { type: 'number' },
                        },
                      },
                    },
                  },
                },
                fitas_borda_m: {
                  type: 'array',
                  items: {
                    type: 'object',
                    required: ['tape_name', 'meters'],
                    properties: {
                      tape_name: { type: 'string' },
                      meters: { type: 'number' },
                      bounding_box: {
                        type: 'object',
                        properties: {
                          page: { type: 'integer' },
                          x: { type: 'number' },
                          y: { type: 'number' },
                          width: { type: 'number' },
                          height: { type: 'number' },
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    auditor_notes: { type: 'array', items: { type: 'string' } },
    warnings: { type: 'array', items: { type: 'string' } },
  },
}

const INVENTORY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['inventory'],
  properties: {
    inventory: {
      type: 'array',
      items: {
        type: 'object',
        required: ['environment', 'modules'],
        properties: {
          environment: { type: 'string' },
          modules: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
}

const SYSTEM_EXTRACTOR = `Você é o Extrator técnico da Planilha 4.0 Premium (marcenaria).
Extraia ABSOLUTAMENTE TUDO das pranchas deste LOTE:

OBRIGATÓRIO — NUNCA módulos de marcenaria vazios.
Para cada móvel (guarda-roupa, painel, cabeceira, nicho, mesa, aparador, divisória):
- Cotar chapas MDF em caixaria e/ou frentes_portas (material_name, mm, quantity > 0)
- Cotar ferragens e puxadores por UNIDADE INDIVIDUAL (dobradiças, corrediças, Minifix, etc.)
- Cotar fitas de borda em metros
- Preencher bounding_box com page (1-based) + x,y,width,height 0–1 quando visível; senão page do módulo

Decoração/iluminação (tapete, quadro, LED, puff): pode marcar só o item sem caixaria.
PROIBIDO usar "A confirmar" em módulos de marcenaria.
Responda só no JSON schema.`

const SYSTEM_AUDITOR = `Você é o Auditor construtivo (o3-mini) da Planilha 4.0.
FORCE a cotação completa de marcenaria: todo guarda-roupa/painel/cabeceira/nicho/mesa DEVE ter:
- chapas MDF (caixaria ou frentes) com medidas e material
- ferragens/puxadores por unidade (sem placeholder "A confirmar")
- bounding_box.page em cada peça quando possível
Compare com INVENTÁRIO e LISTA DE FALHAS. Complete lacunas olhando as imagens.
Itens decorativos podem ficar como estão. Devolva o JSON completo.`

const SYSTEM_INVENTORY = `Liste ambientes e módulos do projeto (capa/sumário/plantas). Só nomes, sem pecas.
Inclua guarda-roupa, painel, cabeceira, nicho divisor, torre, bancada, mesa, ferragens se houver.
Responda só no JSON schema.`

async function openAiJson(params: {
  apiKey: string
  model: string
  system: string
  userContent: unknown[]
  schemaName: string
  schema: Record<string, unknown>
  maxTokens?: number
}): Promise<Record<string, unknown>> {
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
  return JSON.parse(content) as Record<string, unknown>
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}


async function setStage(
  admin: ReturnType<typeof createClient>,
  analysisId: string,
  status: string,
  stage: string,
  detail?: string,
  kind?: string,
) {
  const { data } = await admin
    .from('quote_analyses')
    .select('totals')
    .eq('id', analysisId)
    .maybeSingle()
  const prev =
    data?.totals && typeof data.totals === 'object'
      ? (data.totals as Record<string, unknown>)
      : {}

  const THOUGHT_CAP = 40
  const rawLog = Array.isArray(prev.thought_log) ? prev.thought_log : []
  const prevLog = rawLog.filter(
    (x) => x && typeof x === 'object' && typeof (x as { message?: unknown }).message === 'string',
  ) as Array<{ at: string; stage: string; kind: string; message: string }>

  let thought_log = prevLog
  const message = (detail || '').trim()
  if (message) {
    const last = prevLog[prevLog.length - 1]
    if (!(last && last.message === message && last.stage === stage)) {
      const entryKind =
        kind ||
        (stage === 'auditing'
          ? 'audit'
          : stage === 'fetching_prices' || stage === 'persisting'
            ? 'price'
            : stage === 'completed'
              ? 'done'
              : stage === 'failed'
                ? 'warn'
                : 'vision')
      thought_log = [
        ...prevLog,
        {
          at: new Date().toISOString(),
          stage,
          kind: entryKind,
          message,
        },
      ].slice(-THOUGHT_CAP)
    }
  }

  await admin
    .from('quote_analyses')
    .update({
      status,
      totals: {
        ...prev,
        pipeline_stage: stage,
        pipeline_detail: detail ?? null,
        thought_log,
        pipeline_updated_at: new Date().toISOString(),
      },
      updated_at: new Date().toISOString(),
    })
    .eq('id', analysisId)
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
      return jsonResponse(
        { ok: false, error: 'OPENAI_API_KEY não configurada na Edge Function.' },
        500,
      )
    }

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    let isServiceRole = false
    try {
      const payloadPart = token.split('.')[1]
      if (payloadPart) {
        const json = JSON.parse(atob(payloadPart.replace(/-/g, '+').replace(/_/g, '/')))
        isServiceRole = json?.role === 'service_role'
      }
    } catch {
      isServiceRole = false
    }
    if (!isServiceRole && serviceKey && token === serviceKey.trim()) {
      isServiceRole = true
    }

    if (!isServiceRole) {
      const userClient = createClient(supabaseUrl, anonKey, {
        global: { headers: { Authorization: authHeader } },
      })
      const { data: userData, error: userError } = await userClient.auth.getUser()
      if (userError || !userData.user) {
        return jsonResponse({ ok: false, error: 'Sessão inválida.' }, 401)
      }
    }

    const body = (await req.json()) as PipelineBody
    if (!body?.analysisId || !body?.companyId || !body?.pagePaths?.length) {
      return jsonResponse({ ok: false, error: 'analysisId, companyId e pagePaths são obrigatórios.' }, 400)
    }

    const admin = createClient(supabaseUrl, serviceKey)
    const mode = body.mode === 'pro' ? 'pro' : 'max'
    const ragBlock = body.ragMemoriesPrompt?.trim()
      ? `\n\n${body.ragMemoriesPrompt.trim()}`
      : ''

    const paths = body.pagePaths.slice(0, MAX_PAGES)
    const signedContents: Array<{ type: 'image_url'; image_url: { url: string }; path: string }> = []
    for (const path of paths) {
      const { data: signed, error: signError } = await admin.storage
        .from('orcamentos-ia')
        .createSignedUrl(path, 60 * 30)
      if (signError || !signed?.signedUrl) {
        throw new Error(`Não foi possível assinar ${path}: ${signError?.message}`)
      }
      signedContents.push({
        type: 'image_url',
        image_url: { url: signed.signedUrl },
        path,
      })
    }

    const coverImages = signedContents.slice(0, Math.min(3, signedContents.length)).map((c) => ({
      type: 'image_url' as const,
      image_url: c.image_url,
    }))

    // Passo 0 — inventário da capa
    await setStage(
      admin,
      body.analysisId,
      'READING_LAYOUT',
      'reading_inventory',
      'Olhando a capa do projeto: listando ambientes e móveis prometidos…',
      'vision',
    )

    const inventoryRaw = await openAiJson({
      apiKey: openAiKey,
      model: PARSER_MODEL,
      system: SYSTEM_INVENTORY,
      userContent: [
        {
          type: 'text',
          text: `Liste TODOS os ambientes e módulos/móveis deste projeto (guarde-roupa, painel, cabeceira, nicho, ferragens, etc.). ${signedContents.length} páginas no total.`,
        },
        ...coverImages,
      ],
      schemaName: 'quote_inventory',
      schema: INVENTORY_SCHEMA,
      maxTokens: 4000,
    })

    const inventory = Array.isArray(inventoryRaw.inventory)
      ? (inventoryRaw.inventory as Array<{ environment: string; modules: string[] }>)
      : []

    const inventoryText = inventory.length
      ? inventory
          .map((e) => `- ${e.environment}: ${(e.modules || []).join(', ')}`)
          .join('\n')
      : '(inventário vazio — extraia o máximo possível das pranchas)'

    // Extração em lotes
    const batches = chunk(signedContents, BATCH_SIZE)
    const batchResults: unknown[] = []

    for (let bi = 0; bi < batches.length; bi++) {
      const batch = batches[bi]
      const images = batch.map((c) => ({ type: 'image_url' as const, image_url: c.image_url }))
      const pageFrom = bi * BATCH_SIZE + 1
      const pageTo = bi * BATCH_SIZE + batch.length

      await setStage(
        admin,
        body.analysisId,
        'EXTRACTING_MODULES',
        'extracting_batch',
        `Lote ${bi + 1}/${batches.length}: caçando chapas MDF, puxadores e dobradiças nas páginas ${pageFrom}–${pageTo}…`,
        'vision',
      )

      const batchExtraction = await openAiJson({
        apiKey: openAiKey,
        model: EXTRACTOR_MODEL,
        system: SYSTEM_EXTRACTOR + ragBlock,
        userContent: [
          {
            type: 'text',
            text: `Lote ${bi + 1}/${batches.length} (páginas ${pageFrom}–${pageTo} de ${signedContents.length}).
INVENTÁRIO ESPERADO DO PROJETO:
${inventoryText}

Extraia TODOS os módulos/insumos visíveis NESTE lote. Não omita guarda-roupa, painel, cabeceira, nicho divisor nem ferragens.`,
          },
          ...images,
        ],
        schemaName: 'quote_extraction_batch',
        schema: EXTRACTOR_SCHEMA,
        maxTokens: 12000,
      })
      batchResults.push(batchExtraction)
    }

    let extraction = ensurePlaceholders(mergeExtractions(batchResults))

    // Auditor (modo max): no máx. 2 tentativas; para cedo se gaps não diminuírem
    const MAX_AUDITOR_ATTEMPTS = 2
    if (mode === 'max') {
      const allImages = signedContents.map((c) => ({
        type: 'image_url' as const,
        image_url: c.image_url,
      }))
      for (let attempt = 0; attempt < MAX_AUDITOR_ATTEMPTS; attempt++) {
        const gaps = findBomGaps(extraction)
        const coverageBefore = buildCoverage(inventory, extraction)
        const scoreBefore = gaps.length + coverageBefore.missing.length
        if (scoreBefore === 0) break

        await setStage(
          admin,
          body.analysisId,
          'AUDITING_REVISION',
          'auditing',
          `Auditoria ${attempt + 1}/${MAX_AUDITOR_ATTEMPTS}: ainda vejo ${gaps.length} falha(s) de lista e ${coverageBefore.missing.length} módulo(s) faltando — pedindo à IA completar…`,
          'audit',
        )

        extraction = ensurePlaceholders(
          mergeExtractions([
            extraction,
            await openAiJson({
              apiKey: openAiKey,
              model: attempt === 0 ? AUDITOR_MODEL : EXTRACTOR_MODEL,
              system: SYSTEM_AUDITOR,
              userContent: [
                {
                  type: 'text',
                  text: `Tentativa ${attempt + 1}/${MAX_AUDITOR_ATTEMPTS}.
INVENTÁRIO ESPERADO:
${inventoryText}

FALHAS DE BOM (marcenaria sem chapa/ferragem completa):
${gaps.length ? gaps.map((g) => `- ${g.environment} → ${g.module}: ${g.reason}`).join('\n') : '(nenhuma)'}

MÓDULOS DO INVENTÁRIO AINDA FALTANDO:
${
  coverageBefore.missing.length
    ? coverageBefore.missing.map((m) => `- ${m.environment} → ${m.module}`).join('\n')
    : '(nenhum)'
}

Itens decorativos (espelho, tapete, luminária, quadro, puff) → marque out_of_scope=true.
Complete chapas MDF, ferragens e puxadores. Preencha bounding_box.page.
ÁRVORE ATUAL:
${JSON.stringify(extraction).slice(0, 50000)}`,
                },
                ...(attempt === 0 ? allImages.slice(0, 12) : []),
              ],
              schemaName: 'quote_extraction_audited',
              schema: EXTRACTOR_SCHEMA,
              maxTokens: 16000,
            }),
          ]),
        )

        const gapsAfter = findBomGaps(extraction)
        const coverageAfter = buildCoverage(inventory, extraction)
        const scoreAfter = gapsAfter.length + coverageAfter.missing.length
        if (scoreAfter >= scoreBefore) {
          const notes = Array.isArray(extraction.auditor_notes)
            ? [...(extraction.auditor_notes as string[])]
            : []
          notes.push(
            `Auditoria encerrada cedo: gaps não reduziram (${scoreBefore} → ${scoreAfter}).`,
          )
          extraction = { ...extraction, auditor_notes: [...new Set(notes)] }
          break
        }
      }
    }

    const coverage = buildCoverage(inventory, extraction)
    const bomGaps = findBomGaps(extraction)
    if (bomGaps.length) {
      const warnings = Array.isArray(extraction.warnings) ? [...extraction.warnings] : []
      for (const g of bomGaps) {
        warnings.push(`BOM incompleto: ${g.environment} → ${g.module} (${g.reason})`)
      }
      extraction = { ...extraction, warnings: [...new Set(warnings)] }
    }

    await setStage(
      admin,
      body.analysisId,
      'FETCHING_MARKET_PRICES',
      'fetching_prices',
      'Extração pronta. Agora cruzo cada item com estoque e preços de mercado…',
      'price',
    )
    await admin
      .from('quote_analyses')
      .update({
        status: 'FETCHING_MARKET_PRICES',
        updated_at: new Date().toISOString(),
      })
      .eq('id', body.analysisId)

    return jsonResponse({
      ok: true,
      extraction,
      inventory,
      coverage,
      bomGaps,
      mode,
      pagesProcessed: signedContents.length,
    })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro desconhecido no pipeline'
    console.error('[orcamentos-ia-pipeline]', message)
    return jsonResponse({ ok: false, error: message }, 500)
  }
})

