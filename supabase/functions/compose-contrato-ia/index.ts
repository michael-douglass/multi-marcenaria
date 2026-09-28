import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from 'https://esm.sh/zod@3.23.8';
import { corsHeaders } from '../_shared/cors.ts';
import { sugerirCamposPorExtenso } from '../_shared/valor-monetario-extenso.ts';

const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_MESSAGE_LENGTH = 4000;
const MAX_DOCUMENT_CHARS = 80_000;

const VariavelSchema = z.object({
  nome: z.string().min(1).max(120),
  label: z.string().min(1).max(200),
  tipo: z.enum(['texto', 'data', 'valor', 'cpf']).optional().default('texto'),
  obrigatorio: z.boolean().optional().default(false),
});

const RequestSchema = z.object({
  message: z.string().min(1).max(MAX_MESSAGE_LENGTH),
  etapa: z.union([z.literal(1), z.literal(2)]),
  variaveis: z.array(VariavelSchema).max(80),
  valores: z.record(z.string()).default({}),
  conteudoContrato: z.string().max(MAX_DOCUMENT_CHARS).optional().nullable(),
  modeloConteudo: z.string().max(MAX_DOCUMENT_CHARS).optional().nullable(),
  empresaSchema: z.string().optional().nullable(),
});

const SYSTEM_PROMPT = `Você é o assistente de contratos da GARBO Movelaria.

Seu trabalho é ajudar a preencher e revisar contratos a partir SOMENTE do contexto enviado (campos preenchidos, modelo e texto atual).

REGRAS INVIOLÁVEIS:
- NUNCA invente nomes, CPF, CNPJ, endereços, telefones, datas, valores ou qualquer fato que não esteja no contexto.
- Se faltar um dado (ex.: adaptar para PJ sem CNPJ/razão social no contexto), explique o que falta em "warnings" e NÃO invente.
- Preencher vazios: só derive o que for claramente calculável a partir dos dados (ex.: usar "sugestoesPorExtensoSeguras") ou copie de outro campo equivalente já preenchido.
- Ortografia: corrija gramática, acentuação e typos SEM alterar fatos, números, percentuais, valores em R$ ou cláusulas de valor.
- Na etapa 1: documentPatch DEVE ser null — altere apenas fieldPatches.
- Na etapa 2: se o pedido for sobre o texto do contrato, retorne documentPatch com o texto COMPLETO revisado; se for só campos, documentPatch = null.
- Prefira as "sugestoesPorExtensoSeguras" para campos por extenso — não recalcule por conta própria.
- Responda SEMPRE em JSON válido (sem markdown), no formato:
{
  "reply": "mensagem curta em português para o usuário",
  "fieldPatches": { "nome_do_campo": "novo valor" },
  "documentPatch": null,
  "warnings": ["avisos"],
  "skipped": ["campos que não preencheu e por quê"]
}
- fieldPatches só pode conter chaves que existem em "variaveis".
- Se não houver nada a alterar, fieldPatches = {} e documentPatch = null, com reply explicando.`;

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function isEmpresaSchema(schema: string | null | undefined): boolean {
  return !!schema && /^emp_[a-z0-9_]+$/.test(schema);
}

function resolveDb(client: SupabaseClient, empresaSchema?: string | null) {
  if (isEmpresaSchema(empresaSchema)) {
    return client.schema(empresaSchema!);
  }
  return client;
}

function configTableName(empresaSchema?: string | null): string {
  return isEmpresaSchema(empresaSchema)
    ? 'pipeline_lead_ai_config'
    : 'CRM-multi-empresas>pipeline_lead_ai_config<';
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    // ignore
  }
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence?.[1]) {
    try {
      return JSON.parse(fence[1].trim());
    } catch {
      // ignore
    }
  }
  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    return JSON.parse(trimmed.slice(start, end + 1));
  }
  throw new Error('A IA não retornou JSON válido');
}

async function callOpenAIChat(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  maxTokens = 4000,
): Promise<string> {
  const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: maxTokens,
      temperature: 0.2,
      response_format: { type: 'json_object' },
    }),
  });

  if (!openAiRes.ok) {
    const errText = await openAiRes.text();
    console.error('OpenAI error:', openAiRes.status, errText);
    let message = 'Erro ao chamar a API da OpenAI';
    try {
      const parsed = JSON.parse(errText);
      message = parsed?.error?.message || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  const openAiData = await openAiRes.json();
  const content = openAiData?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('A IA não retornou conteúdo');
  return content;
}

function sanitizeFieldPatches(
  patches: unknown,
  allowedNames: Set<string>,
): Record<string, string> {
  if (!patches || typeof patches !== 'object' || Array.isArray(patches)) return {};
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(patches as Record<string, unknown>)) {
    if (!allowedNames.has(key)) continue;
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    out[key] = value;
  }
  return out;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === 'string')
    .map((s) => s.trim())
    .filter(Boolean)
    .slice(0, 20);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Método não permitido' }, 405);
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Não autorizado' }, 401);
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: 'Configuração do servidor incompleta' }, 500);
    }

    const userClient = createClient(supabaseUrl, anonKey || serviceKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: userError,
    } = await userClient.auth.getUser(token);

    if (userError || !user) {
      return jsonResponse({ error: 'Usuário não autenticado' }, 401);
    }

    let bodyRaw: unknown;
    try {
      bodyRaw = await req.json();
    } catch {
      return jsonResponse({ error: 'Corpo da requisição inválido (JSON)' }, 400);
    }

    const parsed = RequestSchema.safeParse(bodyRaw);
    if (!parsed.success) {
      return jsonResponse(
        {
          error: 'Dados inválidos',
          details: parsed.error.flatten(),
        },
        400,
      );
    }

    const {
      message,
      etapa,
      variaveis,
      valores,
      conteudoContrato,
      modeloConteudo,
      empresaSchema,
    } = parsed.data;

    const admin = createClient(supabaseUrl, serviceKey);
    const db = resolveDb(admin, empresaSchema);
    const configTable = configTableName(empresaSchema);

    const { data: configRow, error: configError } = await db
      .from(configTable)
      .select('ativo, openai_api_key, model')
      .limit(1)
      .maybeSingle();

    if (configError) {
      console.error('config error', configError);
      return jsonResponse({ error: 'Erro ao carregar configuração de IA' }, 500);
    }

    const openAiKey =
      ((configRow as { openai_api_key?: string } | null)?.openai_api_key?.trim() || '') ||
      Deno.env.get('OPENAI_API_KEY') ||
      '';

    if (!openAiKey) {
      return jsonResponse(
        {
          error:
            'Chave da OpenAI não configurada. Defina em Pipeline → Configurações → IA.',
        },
        400,
      );
    }

    const model =
      ((configRow as { model?: string } | null)?.model?.trim() || '') || DEFAULT_MODEL;

    const allowedNames = new Set(variaveis.map((v) => v.nome));
    const valoresLimpos: Record<string, string> = {};
    for (const [k, v] of Object.entries(valores)) {
      if (!allowedNames.has(k)) continue;
      if (typeof v !== 'string') continue;
      valoresLimpos[k] = v;
    }

    const sugestoesPorExtensoSeguras = sugerirCamposPorExtenso(variaveis, valoresLimpos);

    const camposResumo = variaveis.map((v) => ({
      nome: v.nome,
      label: v.label,
      tipo: v.tipo,
      obrigatorio: v.obrigatorio,
      valorAtual: (valoresLimpos[v.nome] ?? '').trim() || null,
      vazio: !(valoresLimpos[v.nome] ?? '').trim(),
    }));

    const userPayload = {
      pedidoUsuario: message,
      etapa,
      campos: camposResumo,
      sugestoesPorExtensoSeguras,
      conteudoContrato:
        etapa === 2 ? (conteudoContrato?.trim() || null) : null,
      modeloConteudo: modeloConteudo?.trim() || null,
    };

    let rawContent: string;
    try {
      rawContent = await callOpenAIChat(openAiKey, model, [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Contexto do contrato (JSON):\n${JSON.stringify(userPayload, null, 2)}`,
        },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao chamar OpenAI';
      return jsonResponse({ error: msg }, 502);
    }

    let aiJson: Record<string, unknown>;
    try {
      aiJson = extractJsonObject(rawContent) as Record<string, unknown>;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'JSON inválido';
      return jsonResponse({ error: msg }, 502);
    }

    let fieldPatches = sanitizeFieldPatches(aiJson.fieldPatches, allowedNames);
    let documentPatch: string | null =
      typeof aiJson.documentPatch === 'string' && aiJson.documentPatch.trim()
        ? aiJson.documentPatch
        : null;

    if (etapa === 1) {
      documentPatch = null;
    }

    // Se o pedido parece ser só por-extenso / preencher vazios e a IA omitiu, completa com sugestões seguras
    const msgLower = message.toLowerCase();
    const pedeExtenso =
      msgLower.includes('extenso') ||
      msgLower.includes('preencher') ||
      msgLower.includes('preencha') ||
      msgLower.includes('campos vazios');
    if (pedeExtenso) {
      for (const [k, v] of Object.entries(sugestoesPorExtensoSeguras)) {
        if (!(k in fieldPatches)) fieldPatches[k] = v;
      }
    }

    const reply =
      typeof aiJson.reply === 'string' && aiJson.reply.trim()
        ? aiJson.reply.trim()
        : 'Pronto. Revise as alterações sugeridas antes de aplicar.';

    return jsonResponse({
      ok: true,
      reply,
      fieldPatches,
      documentPatch,
      warnings: asStringArray(aiJson.warnings),
      skipped: asStringArray(aiJson.skipped),
      modelo: model,
    });
  } catch (err) {
    console.error('compose-contrato-ia error', err);
    return jsonResponse({ error: 'Erro interno no assistente de contratos' }, 500);
  }
});
