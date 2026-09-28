import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { z } from 'https://esm.sh/zod@3.23.8';
import { corsHeaders } from '../_shared/cors.ts';
import { sugerirCamposPorExtenso } from '../_shared/valor-monetario-extenso.ts';

const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_MESSAGE_LENGTH = 8000;
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
  forcarEdicaoDocumento: z.boolean().optional().default(false),
});

const SYSTEM_PROMPT = `Você é o EDITOR de contratos da GARBO Movelaria (não o auditor).

MISSÃO: LER o contrato atual (conteudoContrato) e propor SOMENTE adaptações pedidas. Nunca reescreva o documento do zero. Preserve cláusulas, numeração e formatação que não precisam mudar.

Fontes permitidas:
1) pedidoUsuario
2) campos preenchidos
3) conteudoContrato (base obrigatória)
4) dataAtual / dataAtualExtenso — use sempre estas datas do sistema

REGRAS:
- Antes de cada troca, localize a cláusula correta no corpo (ex.: pagamento, contratante, endereço).
- "find" deve ser um trecho LITERAL e CONTÍGUO de conteudoContrato (copie e cole).
- "replace" deve caber no mesmo contexto jurídico: mesma cláusula, mesma voz, coerente com o restante.
- Formas de pagamento: se o pedido listar percentuais/prazos, SUBSTITUA a cláusula de pagamento existente (ou o trecho que descreve pagamento) por um texto que contenha TODAS as formas pedidas, sem omitir nenhuma e sem inventar condições extras.
- Não espalhe pedaços sem nexo em cláusulas erradas.
- Etapa 1: só fieldPatches; documentReplacements [].
- Etapa 2: só documentReplacements; documentPatch = null.
- JSON:
{
  "reply": "mensagem curta",
  "fieldPatches": {},
  "documentReplacements": [{ "find": "...", "replace": "..." }],
  "documentPatch": null,
  "warnings": [],
  "skipped": []
}`;

const AUDITOR_PROMPT = `Você é o AUDITOR de coesão de contratos da GARBO Movelaria.

Recebe: pedido do usuário, contrato ORIGINAL e as trocas propostas pelo editor (documentReplacements).

Sua tarefa:
1) Simular mentalmente cada troca no texto.
2) Rejeitar trocas sem nexo (find errado, replace que quebra frase, pagamento incompleto, trecho inserido na cláusula errada).
3) Corrigir ou reescrever trocas para ficarem coesas com o corpo.
4) Garantir que o pedido foi atendido por completo (ex.: se pediu 40% + 30% + 30%, as três formas devem aparecer na cláusula de pagamento resultante).
5) Não inventar fatos fora do pedido/contrato. Datas: use dataAtualExtenso.

Responda SÓ JSON:
{
  "aprovado": true,
  "reply": "resumo curto do que foi aceito/corrigido",
  "documentReplacements": [{ "find": "trecho EXATO do contrato original", "replace": "..." }],
  "sugestoesCorrecao": [
    { "titulo": "título curto", "descricao": "por que corrigir", "find": "...", "replace": "..." }
  ],
  "warnings": ["avisos"],
  "rejeitadas": ["motivo das trocas descartadas"]
}

Regras do auditor:
- Cada "find" DEVE existir literalmente no contrato original.
- Prefira poucas trocas grandes e corretas (ex.: substituir o bloco inteiro de pagamento) a várias trocas soltas.
- Se nenhuma troca for segura, devolva documentReplacements: [] e explique em warnings.`;

const VERIFICADOR_PROMPT = `Você é o VERIFICADOR / AUTOCORREÇÃO de contratos da GARBO Movelaria.

Fluxo obrigatório:
1) LEIA o contrato original.
2) LEIA o texto após as trocas propostas.
3) VERIFIQUE se está correto, completo e coeso em relação ao pedido.
4) Se houver qualquer problema, CORRIJA e envie novas sugestões (não aplique no silêncio: devolva sugestões claras).

Responda SÓ JSON:
{
  "correto": true,
  "reply": "o que foi verificado / o que ainda precisa corrigir",
  "sugestoesCorrecao": [
    {
      "titulo": "ex.: Formas de pagamento",
      "descricao": "o que estava errado e o que a sugestão corrige",
      "find": "trecho EXATO do contrato ORIGINAL",
      "replace": "texto corrigido"
    }
  ],
  "documentReplacements": [{ "find": "...", "replace": "..." }],
  "warnings": []
}

Regras:
- find sempre no contrato ORIGINAL (não no texto já modificado).
- Se estiver tudo certo, correto=true e mantenha/refine as sugestões finais.
- Se estiver errado, correto=false e devolva sugestõesCorrecao corrigidas.
- Em autocorreção sem pedido específico: aponte ortografia, cláusulas quebradas, datas inconsistentes e incoerências internas — sem inventar fatos novos.`;

function formatDataAtualBrasil(now = new Date()): {
  dataAtualIso: string;
  dataAtualBr: string;
  dataAtualExtenso: string;
} {
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
  const extensoFmt = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const parts = fmt.formatToParts(now);
  const day = parts.find((p) => p.type === 'day')?.value ?? '';
  const month = parts.find((p) => p.type === 'month')?.value ?? '';
  const year = parts.find((p) => p.type === 'year')?.value ?? '';
  const dataAtualBr = `${day}/${month}/${year}`;
  const dataAtualIso = `${year}-${month}-${day}`;
  const dataAtualExtenso = extensoFmt.format(now);
  return { dataAtualIso, dataAtualBr, dataAtualExtenso };
}

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

function sanitizeReplacements(raw: unknown): Array<{ find: string; replace: string }> {
  if (!Array.isArray(raw)) return [];
  const out: Array<{ find: string; replace: string }> = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const find =
      typeof (item as { find?: unknown }).find === 'string'
        ? (item as { find: string }).find
        : typeof (item as { from?: unknown }).from === 'string'
          ? (item as { from: string }).from
          : '';
    const replace =
      typeof (item as { replace?: unknown }).replace === 'string'
        ? (item as { replace: string }).replace
        : typeof (item as { to?: unknown }).to === 'string'
          ? (item as { to: string }).to
          : '';
    if (!find.trim() || find === replace) continue;
    out.push({ find, replace });
    if (out.length >= 40) break;
  }
  return out;
}

function sanitizeSugestoes(
  raw: unknown,
  fallback: Array<{ find: string; replace: string }> = [],
): Array<{ titulo: string; descricao: string; find: string; replace: string }> {
  const out: Array<{ titulo: string; descricao: string; find: string; replace: string }> = [];
  if (Array.isArray(raw)) {
    for (let i = 0; i < raw.length; i++) {
      const item = raw[i];
      if (!item || typeof item !== 'object') continue;
      const find = typeof (item as { find?: unknown }).find === 'string'
        ? (item as { find: string }).find
        : '';
      const replace = typeof (item as { replace?: unknown }).replace === 'string'
        ? (item as { replace: string }).replace
        : '';
      if (!find.trim() || find === replace) continue;
      out.push({
        titulo:
          typeof (item as { titulo?: unknown }).titulo === 'string' &&
          (item as { titulo: string }).titulo.trim()
            ? (item as { titulo: string }).titulo.trim()
            : `Correção ${i + 1}`,
        descricao:
          typeof (item as { descricao?: unknown }).descricao === 'string' &&
          (item as { descricao: string }).descricao.trim()
            ? (item as { descricao: string }).descricao.trim()
            : 'Sugestão de correção verificada no corpo do contrato.',
        find,
        replace,
      });
      if (out.length >= 40) break;
    }
  }
  if (out.length === 0 && fallback.length > 0) {
    return fallback.map((r, i) => ({
      titulo: `Alteração ${i + 1}`,
      descricao: 'Sugestão gerada após leitura, correção e verificação.',
      find: r.find,
      replace: r.replace,
    }));
  }
  return out;
}

function filterReplacementsAgainstDoc(
  replacements: Array<{ find: string; replace: string }>,
  doc: string | null | undefined,
): Array<{ find: string; replace: string }> {
  if (!doc) return replacements;
  return replacements.filter((r) => doc.includes(r.find));
}

function applyReplacementsPreview(
  doc: string,
  replacements: Array<{ find: string; replace: string }>,
): string {
  let out = doc;
  for (const { find, replace } of replacements) {
    if (!find || !out.includes(find)) continue;
    out = out.split(find).join(replace);
  }
  return out;
}

function pedidoEditaDocumento(message: string): boolean {
  const m = message
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  return (
    m.includes('pj') ||
    m.includes('pessoa juridica') ||
    m.includes('adapt') ||
    m.includes('reescrev') ||
    m.includes('alter') ||
    m.includes('contrato') ||
    m.includes('clausula') ||
    m.includes('representante') ||
    m.includes('razao social') ||
    m.includes('cnpj') ||
    m.includes('empresa') ||
    m.includes('revis') ||
    m.includes('corrig') ||
    m.includes('ortograf')
  );
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

    const token = authHeader.replace(/^Bearer\s+/i, '').trim();
    // Anon/publishable key também é um JWT — rejeita para não confundir com usuário logado.
    if (!token || (anonKey && token === anonKey) || token === serviceKey) {
      return jsonResponse(
        { error: 'Sessão inválida. Faça login novamente.' },
        401,
      );
    }

    // Mesmo padrão de compose-markup-ia: valida o JWT do usuário com service role.
    const authClient = createClient(supabaseUrl, serviceKey);
    const {
      data: { user },
      error: userError,
    } = await authClient.auth.getUser(token);

    if (userError || !user) {
      console.error('compose-contrato-ia auth failed', userError?.message ?? 'no user');
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
      forcarEdicaoDocumento,
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

    const conteudoAtual =
      etapa === 2 ? (conteudoContrato?.trim() || modeloConteudo?.trim() || null) : null;
    // Na etapa 2, qualquer pedido com texto do contrato = ler o corpo e adaptar
    const editaDocumento = etapa === 2 && Boolean(conteudoAtual);
    const { dataAtualIso, dataAtualBr, dataAtualExtenso } = formatDataAtualBrasil();

    const userPayload = {
      pedidoUsuario: message,
      etapa,
      dataAtual: {
        iso: dataAtualIso,
        br: dataAtualBr,
        extenso: dataAtualExtenso,
        fuso: 'America/Sao_Paulo',
      },
      dataAtualExtenso,
      deveEditarDocumento: editaDocumento,
      instrucaoExtra: editaDocumento
        ? 'Leia conteudoContrato e faça SOMENTE adaptações pedidas via documentReplacements (find = trecho literal do contrato). Não reescreva o documento inteiro. Para datas de assinatura/local, use dataAtualExtenso. documentPatch = null.'
        : 'Se preencher datas nos campos, use dataAtual.br ou dataAtualExtenso.',
      campos: camposResumo,
      sugestoesPorExtensoSeguras,
      conteudoContrato: conteudoAtual
        ? conteudoAtual.slice(0, 28000)
        : null,
    };

    if (editaDocumento && !conteudoAtual) {
      return jsonResponse(
        {
          error:
            'Não há texto do contrato na pré-visualização para editar. Abra a etapa 2 com o modelo gerado.',
        },
        400,
      );
    }

    let rawContent: string;
    try {
      rawContent = await callOpenAIChat(
        openAiKey,
        model,
        [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content: `Contexto do contrato (JSON):\n${JSON.stringify(userPayload, null, 2)}`,
          },
        ],
        editaDocumento ? 3500 : 2500,
      );
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
    let documentReplacements = filterReplacementsAgainstDoc(
      sanitizeReplacements(aiJson.documentReplacements),
      conteudoAtual,
    );
    let documentPatch: string | null =
      typeof aiJson.documentPatch === 'string' && aiJson.documentPatch.trim()
        ? aiJson.documentPatch
        : null;

    if (etapa === 1) {
      documentPatch = null;
      documentReplacements = [];
    }

    // Retry focado se pediu editar documento e não veio troca útil
    if (editaDocumento && documentReplacements.length === 0 && conteudoAtual) {
      try {
        const retryRaw = await callOpenAIChat(
          openAiKey,
          model,
          [
            {
              role: 'system',
              content:
                'Você SÓ adapta contratos existentes em PT-BR. Nunca reescreva o documento inteiro. Responda só JSON com documentReplacements: [{find, replace}]. find = trecho EXATO de conteudoContrato. Use fatos do pedidoUsuario. Para datas use dataAtualExtenso. documentPatch=null. Se o pedido for formas de pagamento, substitua a cláusula de pagamento inteira incluindo TODAS as formas pedidas.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                pedidoUsuario: message,
                dataAtualExtenso,
                dataAtualBr,
                conteudoContrato: conteudoAtual.slice(0, 24000),
                tarefa:
                  'Leia o contrato e faça somente as adaptações pedidas. Preserve o restante do texto.',
              }),
            },
          ],
          3000,
        );
        const retryJson = extractJsonObject(retryRaw) as Record<string, unknown>;
        documentReplacements = filterReplacementsAgainstDoc(
          sanitizeReplacements(retryJson.documentReplacements),
          conteudoAtual,
        );
      } catch (retryErr) {
        console.error('compose-contrato-ia retry failed', retryErr);
      }
    }

    // Força modo adaptação: não aceita reescrita integral do contrato
    documentPatch = null;

    const warnings = asStringArray(aiJson.warnings);
    const skipped = asStringArray(aiJson.skipped);
    let auditorAprovado: boolean | null = null;
    let auditorRejeitadas: string[] = [];
    let sugestoesCorrecao: Array<{
      titulo: string;
      descricao: string;
      find: string;
      replace: string;
    }> = [];

    // Fluxo AUDITOR: revisa coesão das trocas com o corpo original
    if (editaDocumento && conteudoAtual && documentReplacements.length > 0) {
      const preview = applyReplacementsPreview(conteudoAtual, documentReplacements);
      try {
        const auditorRaw = await callOpenAIChat(
          openAiKey,
          model,
          [
            { role: 'system', content: AUDITOR_PROMPT },
            {
              role: 'user',
              content: JSON.stringify({
                pedidoUsuario: message,
                dataAtualExtenso,
                dataAtualBr,
                contratoOriginal: conteudoAtual.slice(0, 24000),
                trocasPropostas: documentReplacements,
                textoAposTrocasPropostas: preview.slice(0, 24000),
                checklist: [
                  'As trocas fazem sentido no contexto das cláusulas?',
                  'O pedido foi atendido por completo (ex.: todas as formas de pagamento)?',
                  'Há frases quebradas, duplicadas ou sem nexo?',
                  'find existe literalmente no contrato original?',
                ],
              }),
            },
          ],
          3500,
        );
        const auditorJson = extractJsonObject(auditorRaw) as Record<string, unknown>;
        auditorAprovado = auditorJson.aprovado === true;
        const audited = filterReplacementsAgainstDoc(
          sanitizeReplacements(auditorJson.documentReplacements),
          conteudoAtual,
        );
        if (audited.length > 0) {
          documentReplacements = audited;
        } else if (auditorJson.aprovado === false) {
          documentReplacements = [];
        }
        auditorRejeitadas = asStringArray(auditorJson.rejeitadas);
        const auditorWarnings = asStringArray(auditorJson.warnings);
        for (const w of auditorWarnings) {
          if (!warnings.includes(w)) warnings.push(w);
        }
        for (const r of auditorRejeitadas) {
          const line = `Auditor rejeitou: ${r}`;
          if (!warnings.includes(line)) warnings.push(line);
        }
        if (typeof auditorJson.reply === 'string' && auditorJson.reply.trim()) {
          aiJson.reply = auditorJson.reply.trim();
        }
        const auditorSug = sanitizeSugestoes(
          auditorJson.sugestoesCorrecao,
          documentReplacements,
        ).filter((s) => conteudoAtual.includes(s.find));
        if (auditorSug.length > 0) {
          sugestoesCorrecao = auditorSug;
          documentReplacements = auditorSug.map((s) => ({
            find: s.find,
            replace: s.replace,
          }));
        }
        if (!auditorAprovado && documentReplacements.length === 0) {
          warnings.push(
            'O auditor não aprovou as alterações por falta de coesão. Reformule o pedido citando a cláusula.',
          );
        }
      } catch (auditorErr) {
        console.error('compose-contrato-ia auditor failed', auditorErr);
        warnings.push(
          'Auditoria automática falhou; as trocas do editor foram mantidas com cautela.',
        );
      }
    }

    // VERIFICADOR / AUTOCORREÇÃO: lê de novo e, se precisar, envia sugestões corrigidas
    if (editaDocumento && conteudoAtual && documentReplacements.length > 0) {
      const preview2 = applyReplacementsPreview(conteudoAtual, documentReplacements);
      try {
        const verRaw = await callOpenAIChat(
          openAiKey,
          model,
          [
            { role: 'system', content: VERIFICADOR_PROMPT },
            {
              role: 'user',
              content: JSON.stringify({
                pedidoUsuario: message,
                dataAtualExtenso,
                contratoOriginal: conteudoAtual.slice(0, 22000),
                textoAposEdicao: preview2.slice(0, 22000),
                trocasAtuais: documentReplacements,
                tarefa:
                  'Verifique se está correto. Se houver erro, corrija e devolva sugestoesCorrecao finais para o usuário aplicar.',
              }),
            },
          ],
          3500,
        );
        const verJson = extractJsonObject(verRaw) as Record<string, unknown>;
        const verSug = sanitizeSugestoes(
          verJson.sugestoesCorrecao,
          sanitizeReplacements(verJson.documentReplacements),
        ).filter((s) => conteudoAtual.includes(s.find));
        if (verSug.length > 0) {
          sugestoesCorrecao = verSug;
          documentReplacements = verSug.map((s) => ({
            find: s.find,
            replace: s.replace,
          }));
        }
        if (typeof verJson.reply === 'string' && verJson.reply.trim()) {
          aiJson.reply = verJson.reply.trim();
        }
        for (const w of asStringArray(verJson.warnings)) {
          if (!warnings.includes(w)) warnings.push(w);
        }
        if (verJson.correto === false) {
          warnings.push(
            'Verificador encontrou problemas e enviou sugestões de correção revisadas.',
          );
        }
      } catch (verErr) {
        console.error('compose-contrato-ia verificador failed', verErr);
        warnings.push('Verificação final falhou; revise as sugestões com atenção.');
      }
    }

    // Autocorreção “do zero”: se pediu revisar o contrato e ainda não há sugestões
    const pedeAutocorrecao =
      message.toLowerCase().includes('autocorre') ||
      message.toLowerCase().includes('verifique') ||
      message.toLowerCase().includes('sugestões de correção') ||
      message.toLowerCase().includes('sugestoes de correcao');
    if (
      editaDocumento &&
      conteudoAtual &&
      documentReplacements.length === 0 &&
      (pedeAutocorrecao || message.toLowerCase().includes('[modo edição'))
    ) {
      try {
        const autoRaw = await callOpenAIChat(
          openAiKey,
          model,
          [
            { role: 'system', content: VERIFICADOR_PROMPT },
            {
              role: 'user',
              content: JSON.stringify({
                pedidoUsuario: message,
                dataAtualExtenso,
                contratoOriginal: conteudoAtual.slice(0, 24000),
                textoAposEdicao: conteudoAtual.slice(0, 24000),
                trocasAtuais: [],
                tarefa:
                  'Leia o contrato. Se houver erros, incoerências ou trechos a melhorar sem inventar fatos, envie sugestoesCorrecao.',
              }),
            },
          ],
          3500,
        );
        const autoJson = extractJsonObject(autoRaw) as Record<string, unknown>;
        const autoSug = sanitizeSugestoes(
          autoJson.sugestoesCorrecao,
          sanitizeReplacements(autoJson.documentReplacements),
        ).filter((s) => conteudoAtual.includes(s.find));
        if (autoSug.length > 0) {
          sugestoesCorrecao = autoSug;
          documentReplacements = autoSug.map((s) => ({
            find: s.find,
            replace: s.replace,
          }));
        }
        if (typeof autoJson.reply === 'string' && autoJson.reply.trim()) {
          aiJson.reply = autoJson.reply.trim();
        }
      } catch (autoErr) {
        console.error('compose-contrato-ia autocorrecao failed', autoErr);
      }
    }

    if (sugestoesCorrecao.length === 0 && documentReplacements.length > 0) {
      sugestoesCorrecao = sanitizeSugestoes(null, documentReplacements);
    }

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

    if (editaDocumento && documentReplacements.length === 0) {
      warnings.push(
        'Não há sugestões de correção coesas para enviar. Tente de novo com mais detalhe sobre a cláusula.',
      );
    }

    const replyBase =
      typeof aiJson.reply === 'string' && aiJson.reply.trim()
        ? aiJson.reply.trim()
        : sugestoesCorrecao.length
          ? `Encontrei ${sugestoesCorrecao.length} sugestão(ões) de correção após ler e verificar o contrato.`
          : 'Pronto.';

    const reply =
      editaDocumento && sugestoesCorrecao.length > 0
        ? `${replyBase}\n\nRevise as sugestões abaixo e clique em Aplicar se concordar.`
        : replyBase;

    return jsonResponse({
      ok: true,
      reply,
      fieldPatches: etapa === 2 ? {} : fieldPatches,
      documentPatch: null,
      documentReplacements: etapa === 1 ? [] : documentReplacements,
      sugestoesCorrecao: etapa === 1 ? [] : sugestoesCorrecao,
      warnings,
      skipped,
      modelo: model,
      auditor: editaDocumento
        ? {
            aprovado: auditorAprovado,
            rejeitadas: auditorRejeitadas,
          }
        : null,
      aguardandoAplicacao: editaDocumento && sugestoesCorrecao.length > 0,
      appliedDirectly: false,
    });
  } catch (err) {
    console.error('compose-contrato-ia error', err);
    return jsonResponse({ error: 'Erro interno no assistente de contratos' }, 500);
  }
});
