import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors.ts';
import { indexLeadKnowledge } from '../_shared/lead-knowledge.ts';
import { parseIrisSkyConfigRow } from '../_shared/iris-sky-prompts.ts';

const MAX_ITEMS = 10;
const MAX_IMAGES_TOTAL = 40;
const ALLOWED_MODELS = new Set(['gpt-4o-mini', 'gpt-4o', 'gpt-4.1']);
const DEFAULT_MODEL = 'gpt-4o-mini';

interface AnalysisItem {
  source: 'anexo' | 'whiteboard' | 'orcamento_slide';
  id: string;
  label: string;
  imageUrl?: string;
  pagesBase64?: string[];
}

interface AnalyzeRequest {
  leadId: number;
  empresaSchema?: string | null;
  leadName?: string;
  leadOrigin?: string;
  itens: AnalysisItem[];
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

function analisesTableName(empresaSchema?: string | null): string {
  return isEmpresaSchema(empresaSchema)
    ? 'lead_ai_analises'
    : 'CRM-multi-empresas>lead_ai_analises<';
}

function applyPromptPlaceholders(
  prompt: string,
  vars: {
    nomeLead?: string;
    origem?: string;
    relatorio?: string;
    orcamento?: string;
  },
): string {
  return prompt
    .replace(/\{\{nome_lead\}\}/gi, vars.nomeLead?.trim() || 'Não informado')
    .replace(/\{\{origem\}\}/gi, vars.origem?.trim() || 'Não informada')
    .replace(/\{\{relatorio\}\}/gi, vars.relatorio?.trim() || 'Não disponível')
    .replace(/\{\{orcamento\}\}/gi, vars.orcamento?.trim() || 'Nenhum orçamento cadastrado para este lead.');
}

function formatCurrencyBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function summarizeOrcamentoDados(dados: Record<string, unknown> | null | undefined): string {
  if (!dados || typeof dados !== 'object') return 'Sem detalhes estruturados.';

  const lines: string[] = [];
  const prec = dados.precificacao as Record<string, unknown> | undefined;
  if (prec) {
    const valorFinal = Number(prec.valor_final ?? 0);
    const valorIntegral = Number(prec.valor_integral ?? 0);
    const desconto = Number(prec.desconto_percent ?? 0);
    const parcelas = Number(prec.parcelas ?? 0);
    if (valorFinal > 0) lines.push(`Valor final: ${formatCurrencyBRL(valorFinal)}`);
    if (valorIntegral > 0 && valorIntegral !== valorFinal) {
      lines.push(`Valor integral: ${formatCurrencyBRL(valorIntegral)}`);
    }
    if (desconto > 0) lines.push(`Desconto: ${desconto}%`);
    const acrescimo = Number(prec.acrescimo_percent ?? 0);
    if (acrescimo > 0) lines.push(`Acréscimo: ${acrescimo}%`);
    if (parcelas > 0) lines.push(`Parcelas: ${parcelas}x`);
    const itens = prec.itens_fracionados as Array<{ label?: string; valor?: number }> | undefined;
    if (itens?.length) {
      lines.push('Itens fracionados:');
      for (const item of itens.slice(0, 12)) {
        if (item.label) {
          lines.push(`- ${item.label}: ${formatCurrencyBRL(Number(item.valor ?? 0))}`);
        }
      }
    }
  }

  if (dados.prazo_entrega) lines.push(`Prazo de entrega: ${String(dados.prazo_entrega)}`);
  if (dados.inicio_execucao) lines.push(`Início da execução: ${String(dados.inicio_execucao)}`);
  if (dados.garantia_meses) lines.push(`Garantia: ${String(dados.garantia_meses)} meses`);

  const respostas = dados.respostas as Record<string, unknown> | undefined;
  if (respostas && Object.keys(respostas).length > 0) {
    lines.push('Respostas do formulário do orçamento:');
    for (const [key, value] of Object.entries(respostas).slice(0, 20)) {
      const val = Array.isArray(value) ? value.join(', ') : String(value);
      if (val.trim()) lines.push(`- ${key}: ${val}`);
    }
  }

  const textos = dados.textos_blocos as Record<string, string> | undefined;
  if (textos) {
    for (const [bloco, texto] of Object.entries(textos).slice(0, 8)) {
      const t = texto?.trim();
      if (t) lines.push(`[${bloco}] ${t.slice(0, 400)}${t.length > 400 ? '…' : ''}`);
    }
  }

  return lines.length > 0 ? lines.join('\n') : 'Orçamento sem campos preenchidos.';
}

async function fetchOrcamentoContext(
  db: ReturnType<typeof resolveDb>,
  leadId: number,
  empresaSchema?: string | null,
): Promise<string> {
  const leadsTable = isEmpresaSchema(empresaSchema) ? 'leads' : 'CRM-multi-empresas>leads<';
  const orcTable = 'orcamento_slides';
  const lines: string[] = [];

  const { data: leadRow } = await db
    .from(leadsTable)
    .select('valor_orcamento, nome, empresa, observacoes')
    .eq('id', leadId)
    .maybeSingle();

  if (leadRow) {
    const valor = Number(leadRow.valor_orcamento ?? 0);
    if (valor > 0) lines.push(`Valor de orçamento no card do lead: ${formatCurrencyBRL(valor)}`);
    if (leadRow.empresa) lines.push(`Empresa do lead: ${leadRow.empresa}`);
  }

  if (!isEmpresaSchema(empresaSchema)) {
    if (lines.length === 0) {
      lines.push('Orçamentos em slides disponíveis apenas no contexto da empresa.');
    }
    return lines.join('\n\n');
  }

  const { data: orcamentos } = await db
    .from(orcTable)
    .select('identificador, status, cliente_nome, dados, atualizado_em')
    .eq('lead_id', leadId)
    .order('atualizado_em', { ascending: false })
    .limit(3);

  if (!orcamentos?.length) {
    lines.push('Nenhum orçamento em slides vinculado a este lead.');
    return lines.join('\n\n');
  }

  orcamentos.forEach((orc, index) => {
    lines.push(
      `--- Orçamento ${index + 1}: ${orc.identificador} (${orc.status}) ---`,
      `Cliente: ${orc.cliente_nome || 'Não informado'}`,
      summarizeOrcamentoDados(orc.dados as Record<string, unknown>),
    );
  });

  return lines.join('\n\n');
}

const BRIEFING_AGENT_SYSTEM_PROMPT = `Você é um agente especializado em briefing comercial para móveis planejados.

Você recebe:
1) O relatório de análise visual já produzido por outro agente
2) As mesmas imagens/páginas analisadas
3) Instruções do usuário sobre como formatar as perguntas

Sua única tarefa: gerar perguntas inteligentes para o vendedor usar com o cliente.

REGRAS OBRIGATÓRIAS:
- Leia o relatório E revise as imagens anexadas antes de escrever qualquer pergunta.
- As perguntas devem ser sobre o ambiente, cômodo e elementos REAIS do material (ex.: se o relatório e as fotos mostram sala de estar, NÃO pergunte sobre cozinha, banheiro ou outros cômodos não identificados).
- Não invente móveis, ambientes ou problemas que não aparecem no relatório ou nas imagens.
- Use dados do orçamento apenas como complemento — nunca contradiga o que o relatório visual descreve.
- Priorize lacunas que impedem medição, produção ou fechamento do projeto mostrado.
- Responda apenas com a lista de perguntas no formato solicitado no prompt do usuário.`;

async function callOpenAIChat(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string | OpenAIContentPart[] }>,
  maxTokens = 8192,
): Promise<string> {
  const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
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

async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

type OpenAIContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

async function buildImageParts(itens: AnalysisItem[]): Promise<OpenAIContentPart[]> {
  const parts: OpenAIContentPart[] = [];
  let imageCount = 0;
  let globalIndex = 0;

  for (const item of itens) {
    if (imageCount >= MAX_IMAGES_TOTAL) break;

    if (item.pagesBase64?.length) {
      const totalPages = item.pagesBase64.length;
      for (let i = 0; i < item.pagesBase64.length; i++) {
        if (imageCount >= MAX_IMAGES_TOTAL) break;
        globalIndex += 1;
        const page = item.pagesBase64[i];
        const url = page.startsWith('data:') ? page : `data:image/jpeg;base64,${page}`;
        parts.push({
          type: 'text',
          text:
            totalPages > 1
              ? `--- Página ${i + 1} de ${totalPages} do PDF "${item.label}" (imagem ${globalIndex}) ---`
              : `--- PDF "${item.label}" (imagem ${globalIndex}) ---`,
        });
        parts.push({
          type: 'image_url',
          image_url: { url, detail: 'high' },
        });
        imageCount++;
      }
      continue;
    }

    if (item.imageUrl) {
      let url = item.imageUrl;
      if (!url.startsWith('data:')) {
        const converted = await urlToBase64(url);
        if (!converted) continue;
        url = converted;
      }
      globalIndex += 1;
      parts.push({
        type: 'text',
        text: `--- Imagem "${item.label}" (imagem ${globalIndex}) ---`,
      });
      parts.push({
        type: 'image_url',
        image_url: { url, detail: 'high' },
      });
      imageCount++;
    }
  }

  return parts;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return jsonResponse({ error: 'Não autorizado' }, 401);
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: 'Usuário não autenticado' }, 401);
    }

    let body: AnalyzeRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Corpo da requisição inválido (JSON)' }, 400);
    }

    const { leadId, empresaSchema, leadName, leadOrigin, itens } = body;

    if (!leadId || typeof leadId !== 'number') {
      return jsonResponse({ error: 'leadId é obrigatório' }, 400);
    }

    if (!Array.isArray(itens) || itens.length === 0) {
      return jsonResponse({ error: 'Selecione ao menos uma imagem ou PDF' }, 400);
    }

    if (itens.length > MAX_ITEMS) {
      return jsonResponse({ error: `Máximo de ${MAX_ITEMS} itens por análise` }, 400);
    }

    const db = resolveDb(supabase, empresaSchema);

    const { data: configRow, error: configError } = await db
      .from(configTableName(empresaSchema))
      .select(
        'model, system_prompt, briefing_prompt, ativo, openai_api_key, iris_sky_knowledge_ativo, iris_sky_embedding_model, iris_sky_include_media_vision, iris_sky_include_whatsapp',
      )
      .eq('singleton_key', 'default')
      .maybeSingle();

    if (configError) {
      console.error('Erro ao carregar config IA:', configError);
      return jsonResponse({ error: 'Erro ao carregar configuração de IA' }, 500);
    }

    if (!configRow?.ativo) {
      return jsonResponse({ error: 'Análise de IA desativada nas configurações do pipeline' }, 403);
    }

    const openAiKey =
      (configRow.openai_api_key?.trim() || '') || Deno.env.get('OPENAI_API_KEY') || '';
    if (!openAiKey) {
      return jsonResponse(
        {
          error:
            'Chave da OpenAI não configurada. Defina em Pipeline → Configurações → Configuração IA.',
        },
        500,
      );
    }

    const model = ALLOWED_MODELS.has(configRow.model) ? configRow.model : DEFAULT_MODEL;
    const systemPrompt = applyPromptPlaceholders(configRow.system_prompt || '', {
      nomeLead: leadName,
      origem: leadOrigin,
    });

    const imageParts = await buildImageParts(itens);
    if (imageParts.length === 0) {
      return jsonResponse({ error: 'Não foi possível carregar as imagens selecionadas' }, 400);
    }

    const visionImageCount = imageParts.filter((part) => part.type === 'image_url').length;

    const userContent: OpenAIContentPart[] = [
      {
        type: 'text',
        text: [
          `Analise TODAS as ${visionImageCount} imagem(ns)/página(s) a seguir.`,
          'Cada imagem vem imediatamente após um rótulo com o número da página do PDF (quando houver várias páginas).',
          'Na seção "O que cada imagem mostra", descreva página por página (Pág. 1, Pág. 2, …), com o conteúdo técnico visível: ambiente, módulos, medidas, materiais, cortes, anotações e interferências.',
          'Não ignore páginas intermediárias. Se uma página for planta, elevação, detalhe construtivo ou memorial, diga explicitamente.',
          'Depois consolide o conjunto como um único projeto e produza o relatório completo conforme suas instruções.',
          'Não invente conteúdo que não esteja nas imagens; se algo não estiver legível, diga "não legível na página".',
        ].join(' '),
      },
      ...imageParts,
    ];

    let conteudo: string;
    try {
      conteudo = await callOpenAIChat(openAiKey, model, [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ], visionImageCount > 3 ? 8192 : 4096);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao chamar a API da OpenAI';
      return jsonResponse({ error: message }, 502);
    }

    let perguntasBriefing: string | null = null;
    let briefingPromptSnapshot: string | null = null;
    const briefingPromptRaw = (configRow.briefing_prompt as string | null)?.trim() ?? '';

    if (briefingPromptRaw) {
      const orcamentoContext = await fetchOrcamentoContext(db, leadId, empresaSchema);
      briefingPromptSnapshot = applyPromptPlaceholders(briefingPromptRaw, {
        nomeLead: leadName,
        origem: leadOrigin,
        relatorio: conteudo,
        orcamento: orcamentoContext,
      });

      try {
        const briefingUserContent: OpenAIContentPart[] = [
          {
            type: 'text',
            text: `${briefingPromptSnapshot}\n\n--- IMAGENS ANALISADAS ---\nRevise as ${visionImageCount} imagem(ns)/página(s) abaixo. Suas perguntas devem ser coerentes com o relatório acima E com o que você vê nestas imagens.`,
          },
          ...imageParts,
        ];

        perguntasBriefing = await callOpenAIChat(
          openAiKey,
          model,
          [
            { role: 'system', content: BRIEFING_AGENT_SYSTEM_PROMPT },
            { role: 'user', content: briefingUserContent },
          ],
          2048,
        );
      } catch (briefingErr) {
        console.error('Erro ao gerar perguntas de briefing:', briefingErr);
        perguntasBriefing = null;
      }
    }

    const itensSnapshot = itens.map((item) => ({
      source: item.source,
      id: item.id,
      label: item.label,
      imageUrl: item.imageUrl,
      kind: item.pagesBase64?.length ? 'pdf' : item.imageUrl ? 'image' : undefined,
      pageCount: item.pagesBase64?.length || (item.imageUrl ? 1 : 0),
    }));

    const { data: inserted, error: insertError } = await db
      .from(analisesTableName(empresaSchema))
      .insert({
        lead_id: leadId,
        conteudo,
        perguntas_briefing: perguntasBriefing,
        briefing_prompt_snapshot: briefingPromptSnapshot,
        modelo: model,
        prompt_snapshot: systemPrompt,
        itens_selecionados: itensSnapshot,
        criado_por: user.id,
      })
      .select('id, criado_em')
      .single();

    if (insertError) {
      console.error('Erro ao salvar análise:', insertError);
      return jsonResponse({ error: 'Análise gerada mas não foi possível salvar no histórico' }, 500);
    }

    const irisConfig = parseIrisSkyConfigRow(configRow as Record<string, unknown>);
    if (irisConfig.irisSkyKnowledgeAtivo) {
      indexLeadKnowledge(supabase, leadId, empresaSchema, openAiKey, {
        force: true,
        includeMediaVision: irisConfig.irisSkyIncludeMediaVision,
        includeWhatsapp: irisConfig.irisSkyIncludeWhatsapp,
        embeddingModel: irisConfig.irisSkyEmbeddingModel,
      }).catch((indexErr) => {
        console.error('Falha ao indexar base de conhecimento do lead:', indexErr);
      });
    }

    return jsonResponse({
      analiseId: inserted.id,
      conteudo,
      perguntasBriefing,
      criadoEm: inserted.criado_em,
    });
  } catch (err) {
    console.error('analyze-lead-photos error:', err);
    return jsonResponse({ error: 'Erro interno ao analisar imagens' }, 500);
  }
});
