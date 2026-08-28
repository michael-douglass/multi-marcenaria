import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors.ts';
import {
  formatRetrievedContext,
  indexLeadKnowledge,
  metaTableName,
  searchLeadKnowledge,
} from '../_shared/lead-knowledge.ts';
import {
  applyIrisSkyChatPromptPlaceholders,
  applyIrisSkySpotPromptPlaceholders,
  parseIrisSkyConfigRow,
} from '../_shared/iris-sky-prompts.ts';

const ALLOWED_MODELS = new Set(['gpt-4o-mini', 'gpt-4o', 'gpt-4.1']);
const DEFAULT_MODEL = 'gpt-4o-mini';
const MAX_HISTORY_MESSAGES = 20;
const MAX_MESSAGE_LENGTH = 4000;
const CONVERSATION_MEMORY_HINT =
  '\n\nMantenha continuidade com o histórico da conversa abaixo: use perguntas e respostas anteriores como contexto antes de responder.';

interface IrisSpotContext {
  mediaLabel: string;
  normalizedX: number;
  normalizedY: number;
  imageBase64?: string;
  cropBase64?: string;
  pdfPageNumber?: number;
  spotDescription?: string;
}

interface ChatRequest {
  leadId: number;
  empresaSchema?: string | null;
  analiseId?: string | null;
  message: string;
  leadName?: string;
  leadOrigin?: string;
  spotContext?: IrisSpotContext | null;
  identifySpotOnly?: boolean;
}

type OpenAIChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string; detail?: 'low' | 'high' | 'auto' } };

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

function chatMessagesTableName(empresaSchema?: string | null): string {
  return isEmpresaSchema(empresaSchema)
    ? 'lead_ai_chat_messages'
    : 'CRM-multi-empresas>lead_ai_chat_messages<';
}

const SPOT_VISION_MODEL = 'gpt-4o';

const IRIS_SKY_CONFIG_SELECT =
  'model, ativo, openai_api_key, iris_sky_ativo, iris_sky_model, iris_sky_knowledge_ativo, iris_sky_embedding_model, iris_sky_include_media_vision, iris_sky_include_whatsapp, iris_sky_match_count, iris_sky_chat_prompt, iris_sky_spot_prompt';

const IRIS_SKY_CONFIG_SELECT_LEGACY = 'model, ativo, openai_api_key';

async function callOpenAIChat(
  apiKey: string,
  model: string,
  messages: { role: string; content: string }[],
  maxTokens = 1500,
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

async function callOpenAIVision(
  apiKey: string,
  model: string,
  systemText: string,
  userParts: OpenAIChatContentPart[],
  maxTokens = 900,
): Promise<string> {
  const visionModel = ALLOWED_MODELS.has(model) ? model : DEFAULT_MODEL;
  const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: visionModel,
      messages: [
        { role: 'system', content: systemText },
        { role: 'user', content: userParts },
      ],
      max_tokens: maxTokens,
    }),
  });

  if (!openAiRes.ok) {
    const errText = await openAiRes.text();
    console.error('OpenAI vision error:', openAiRes.status, errText);
    throw new Error('Erro ao analisar o ponto selecionado na imagem');
  }

  const openAiData = await openAiRes.json();
  const content = openAiData?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('A IA não retornou análise visual do ponto');
  return content;
}

async function analyzeImageSpot(
  apiKey: string,
  spotPromptTemplate: string,
  spot: IrisSpotContext,
  vars: {
    leadName: string;
    leadOrigin?: string;
    relatorio: string;
  },
): Promise<string> {
  const xPct = Math.round(spot.normalizedX * 100);
  const yPct = Math.round(spot.normalizedY * 100);
  const pageHint = spot.pdfPageNumber ? ` · pág. ${spot.pdfPageNumber}` : '';
  const coordenadas = `${xPct}% da esquerda, ${yPct}% do topo${pageHint}`;

  const cropUrl = spot.cropBase64?.trim() || spot.imageBase64?.trim();
  if (!cropUrl) {
    throw new Error('Imagem do ponto selecionado não foi enviada');
  }

  const spotPrompt = applyIrisSkySpotPromptPlaceholders(spotPromptTemplate, {
    nomeLead: vars.leadName,
    origem: vars.leadOrigin,
    relatorio: vars.relatorio,
    analise: vars.relatorio,
    mediaLabel: spot.mediaLabel,
    coordenadas,
  });

  const userParts: OpenAIChatContentPart[] = [
    {
      type: 'text',
      text: spotPrompt,
    },
    {
      type: 'image_url',
      image_url: { url: cropUrl, detail: 'high' },
    },
  ];

  const visionModel = ALLOWED_MODELS.has(SPOT_VISION_MODEL) ? SPOT_VISION_MODEL : 'gpt-4o-mini';

  return callOpenAIVision(
    apiKey,
    visionModel,
    'Você analisa recortes de imagens de projetos de marcenaria e retorna apenas YAML conforme instruído.',
    userParts,
    1200,
  );
}

function extractSpotShortLabel(yaml: string): string {
  for (const line of yaml.split('\n')) {
    const match = line.match(/^\s*(descricao_exata|visual_description)\s*:\s*(.+)$/i);
    if (match?.[2]) {
      const value = match[2].trim().replace(/^["']|["']$/g, '');
      if (value && value !== 'null' && !value.startsWith('(')) return value;
    }
  }
  return '';
}

function buildSpotIdentifyAssistantMessage(shortLabel: string, mediaLabel: string): string {
  const element = shortLabel || 'um trecho desta imagem';
  return `Identifiquei **${element}** em "${mediaLabel}".\n\nO que você deseja saber ou fazer com este ponto? Por exemplo: cor, material, medida, interferência no projeto…`;
}

interface SpotChatMetadata {
  type: 'spot_identify';
  spotDescription: string;
  shortLabel: string;
  mediaLabel: string;
  normalizedX: number;
  normalizedY: number;
  pdfPageNumber?: number;
}

function findLatestSpotDescriptionFromHistory(
  rows: Array<{ metadata?: unknown }>,
): string | null {
  for (let i = rows.length - 1; i >= 0; i--) {
    const raw = rows[i].metadata;
    if (!raw || typeof raw !== 'object') continue;
    const meta = raw as Partial<SpotChatMetadata>;
    if (meta.type === 'spot_identify' && typeof meta.spotDescription === 'string') {
      const yaml = meta.spotDescription.trim();
      if (yaml) return yaml;
    }
  }
  return null;
}

async function loadChatHistory(
  db: ReturnType<typeof resolveDb>,
  chatTable: string,
  leadId: number,
  userId: string,
  analiseId: string,
) {
  const { data: historyRowsDesc, error: historyError } = await db
    .from(chatTable)
    .select('role, content, metadata')
    .eq('lead_id', leadId)
    .eq('user_id', userId)
    .or(`analise_id.eq.${analiseId},analise_id.is.null`)
    .order('criado_em', { ascending: false })
    .limit(MAX_HISTORY_MESSAGES);

  if (historyError) {
    throw historyError;
  }

  return (historyRowsDesc ?? []).slice().reverse();
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

    let body: ChatRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Corpo da requisição inválido (JSON)' }, 400);
    }

    const { leadId, empresaSchema, analiseId, message, leadName, leadOrigin, spotContext, identifySpotOnly } =
      body;

    if (!leadId || typeof leadId !== 'number') {
      return jsonResponse({ error: 'leadId é obrigatório' }, 400);
    }

    const trimmedMessage = message?.trim() ?? '';
    if (!identifySpotOnly && !trimmedMessage) {
      return jsonResponse({ error: 'Mensagem vazia' }, 400);
    }
    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      return jsonResponse({ error: `Mensagem muito longa (máx. ${MAX_MESSAGE_LENGTH} caracteres)` }, 400);
    }

    const db = resolveDb(supabase, empresaSchema);
    const analisesTable = analisesTableName(empresaSchema);
    const chatTable = chatMessagesTableName(empresaSchema);

    let analiseQuery = db
      .from(analisesTable)
      .select('id, conteudo, perguntas_briefing')
      .eq('lead_id', leadId);

    if (analiseId) {
      analiseQuery = analiseQuery.eq('id', analiseId);
    } else {
      analiseQuery = analiseQuery.order('criado_em', { ascending: false }).limit(1);
    }

    const { data: analiseRow, error: analiseError } = await analiseQuery.maybeSingle();

    if (analiseError) {
      console.error('Erro ao carregar análise:', analiseError);
      return jsonResponse({ error: 'Erro ao carregar análise do lead' }, 500);
    }

    if (!analiseRow?.conteudo?.trim()) {
      return jsonResponse(
        { error: 'Gere uma análise visual antes de conversar com a Íris Sky.' },
        400,
      );
    }

    let configResult = await db
      .from(configTableName(empresaSchema))
      .select(IRIS_SKY_CONFIG_SELECT)
      .eq('singleton_key', 'default')
      .maybeSingle();

    if (configResult.error?.code === '42703') {
      configResult = await db
        .from(configTableName(empresaSchema))
        .select(IRIS_SKY_CONFIG_SELECT_LEGACY)
        .eq('singleton_key', 'default')
        .maybeSingle();
    }

    const { data: configRow, error: configError } = configResult;

    if (configError) {
      console.error('Erro ao carregar config IA:', configError);
      return jsonResponse({ error: 'Erro ao carregar configuração de IA' }, 500);
    }

    if (!configRow?.ativo) {
      return jsonResponse({ error: 'Análise de IA desativada nas configurações do pipeline' }, 403);
    }

    const irisConfig = parseIrisSkyConfigRow(configRow as Record<string, unknown>);
    if (!irisConfig.irisSkyAtivo) {
      return jsonResponse(
        { error: 'Chat Íris Sky desativado nas configurações do pipeline (aba IA).' },
        403,
      );
    }

    const openAiKey =
      ((configRow as { openai_api_key?: string }).openai_api_key?.trim() || '') ||
      Deno.env.get('OPENAI_API_KEY') ||
      '';
    if (!openAiKey) {
      return jsonResponse(
        {
          error:
            'Chave da OpenAI não configurada. Defina em Pipeline → Configurações → Configuração IA.',
        },
        500,
      );
    }

    const model = ALLOWED_MODELS.has(irisConfig.irisSkyModel)
      ? irisConfig.irisSkyModel
      : DEFAULT_MODEL;
    const resolvedAnaliseId = analiseRow.id as string;

    const sanitizedSpot = spotContext &&
      typeof spotContext.mediaLabel === 'string' &&
      typeof spotContext.normalizedX === 'number' &&
      typeof spotContext.normalizedY === 'number'
      ? spotContext
      : null;

    if (identifySpotOnly) {
      if (!sanitizedSpot?.cropBase64?.trim() && !sanitizedSpot?.imageBase64?.trim()) {
        return jsonResponse({ error: 'Imagem do ponto selecionado não foi enviada' }, 400);
      }

      let spotDescription: string;
      try {
        spotDescription = sanitizedSpot!.spotDescription?.trim() ||
          await analyzeImageSpot(
            openAiKey,
            irisConfig.irisSkySpotPrompt,
            sanitizedSpot!,
            {
              leadName: leadName?.trim() || 'Lead',
              leadOrigin,
              relatorio: analiseRow.conteudo as string,
            },
          );
      } catch (spotErr) {
        console.error('Erro na identificação do ponto:', spotErr);
        const spotMessage = spotErr instanceof Error ? spotErr.message : 'Erro na análise visual';
        return jsonResponse({ error: spotMessage }, 502);
      }

      const shortLabel = extractSpotShortLabel(spotDescription);
      const assistantContent = buildSpotIdentifyAssistantMessage(shortLabel, sanitizedSpot!.mediaLabel);
      const xPct = Math.round(sanitizedSpot!.normalizedX * 100);
      const yPct = Math.round(sanitizedSpot!.normalizedY * 100);
      const spotMetadata: SpotChatMetadata = {
        type: 'spot_identify',
        spotDescription,
        shortLabel,
        mediaLabel: sanitizedSpot!.mediaLabel,
        normalizedX: sanitizedSpot!.normalizedX,
        normalizedY: sanitizedSpot!.normalizedY,
        pdfPageNumber: sanitizedSpot!.pdfPageNumber,
      };

      const { data: insertedRows, error: insertError } = await db
        .from(chatTable)
        .insert([
          {
            lead_id: leadId,
            user_id: user.id,
            analise_id: resolvedAnaliseId,
            role: 'user',
            content: `📍 Selecionei um ponto em ${sanitizedSpot!.mediaLabel} (${xPct}%, ${yPct}%)`,
          },
          {
            lead_id: leadId,
            user_id: user.id,
            analise_id: resolvedAnaliseId,
            role: 'assistant',
            content: assistantContent,
            modelo: SPOT_VISION_MODEL,
            metadata: spotMetadata,
          },
        ])
        .select('id, role, content, criado_em, modelo');

      if (insertError) {
        console.error('Erro ao salvar identificação do ponto:', insertError);
        return jsonResponse({ error: 'Não foi possível salvar no histórico' }, 500);
      }

      const assistantRow = (insertedRows ?? []).find((r) => r.role === 'assistant');

      return jsonResponse({
        spotDescription,
        shortLabel,
        assistantMessage: assistantContent,
        identifyOnly: true,
        messageId: assistantRow?.id ?? null,
        criadoEm: assistantRow?.criado_em ?? null,
      });
    }

    let historyRows: Array<{ role: string; content: string; metadata?: unknown }>;
    try {
      historyRows = await loadChatHistory(db, chatTable, leadId, user.id, resolvedAnaliseId);
    } catch (historyError) {
      console.error('Erro ao carregar histórico:', historyError);
      return jsonResponse({ error: 'Erro ao carregar histórico do chat' }, 500);
    }

    let retrievedContext =
      'Base de conhecimento desativada nas configurações do pipeline.';

    if (irisConfig.irisSkyKnowledgeAtivo) {
      try {
        const metaTable = metaTableName(empresaSchema);
        const { data: knowledgeMeta } = await db
          .from(metaTable)
          .select('status')
          .eq('lead_id', leadId)
          .maybeSingle();

        if (knowledgeMeta?.status !== 'ready' && knowledgeMeta?.status !== 'indexing') {
          await indexLeadKnowledge(supabase, leadId, empresaSchema, openAiKey, {
            includeMediaVision: false,
            includeWhatsapp: irisConfig.irisSkyIncludeWhatsapp,
            embeddingModel: irisConfig.irisSkyEmbeddingModel,
          });
        }
      } catch (indexErr) {
        console.error('Aviso: falha ao atualizar base de conhecimento:', indexErr);
      }

      retrievedContext = 'Base de conhecimento ainda não indexada para este lead.';
      try {
        const hits = await searchLeadKnowledge(
          supabase,
          leadId,
          empresaSchema,
          openAiKey,
          trimmedMessage,
          irisConfig.irisSkyMatchCount,
          irisConfig.irisSkyEmbeddingModel,
        );
        retrievedContext = formatRetrievedContext(hits);
      } catch (searchErr) {
        console.error('Aviso: busca semântica indisponível:', searchErr);
      }
    }

    const systemPrompt = applyIrisSkyChatPromptPlaceholders(irisConfig.irisSkyChatPrompt, {
      nomeLead: leadName,
      origem: leadOrigin,
      relatorio: analiseRow.conteudo as string,
      briefing: (analiseRow.perguntas_briefing as string | null) ?? null,
      conhecimento: retrievedContext,
    }) + CONVERSATION_MEMORY_HINT;

    let spotDescription: string | null = null;
    let userMessageForModel = trimmedMessage;

    const historySpotYaml = findLatestSpotDescriptionFromHistory(historyRows);

    if (sanitizedSpot) {
      const existingYaml = sanitizedSpot.spotDescription?.trim() || historySpotYaml;
      try {
        spotDescription = existingYaml ||
          await analyzeImageSpot(
            openAiKey,
            irisConfig.irisSkySpotPrompt,
            sanitizedSpot,
            {
              leadName: leadName?.trim() || 'Lead',
              leadOrigin,
              relatorio: analiseRow.conteudo as string,
            },
          );
      } catch (spotErr) {
        console.error('Erro na análise do ponto:', spotErr);
        const spotMessage = spotErr instanceof Error ? spotErr.message : 'Erro na análise visual';
        return jsonResponse({ error: spotMessage }, 502);
      }
    } else if (historySpotYaml) {
      spotDescription = historySpotYaml;
    }

    const spotContextBlock = spotDescription
      ? `\n\n--- ELEMENTO SELECIONADO NA IMAGEM (YAML — leitura obrigatória) ---\n${spotDescription}\n\nResponda à pergunta do usuário usando este elemento e o histórico da conversa. Seja direta e objetiva.`
      : '';

    const systemPromptWithSpot = spotDescription
      ? `${systemPrompt}${spotContextBlock}`
      : systemPrompt;

    if (spotDescription) {
      userMessageForModel = `${trimmedMessage}\n\n(Responda com base no ponto selecionado na imagem e no histórico desta conversa.)`;
    }

    const openAiMessages: { role: string; content: string }[] = [
      { role: 'system', content: systemPromptWithSpot },
      ...historyRows.map((row) => ({
        role: row.role as string,
        content: row.content as string,
      })),
      { role: 'user', content: userMessageForModel },
    ];

    let assistantContent: string;
    try {
      assistantContent = await callOpenAIChat(openAiKey, model, openAiMessages);
    } catch (err) {
      const errMessage = err instanceof Error ? err.message : 'Erro ao chamar a API da OpenAI';
      return jsonResponse({ error: errMessage }, 502);
    }

    const chatRows: Array<{
      lead_id: number;
      user_id: string;
      analise_id: string;
      role: string;
      content: string;
      modelo?: string;
    }> = [
      {
        lead_id: leadId,
        user_id: user.id,
        analise_id: resolvedAnaliseId,
        role: 'user',
        content: sanitizedSpot
          ? `📍 ${sanitizedSpot.mediaLabel}\n${trimmedMessage}`
          : trimmedMessage,
      },
    ];

    chatRows.push({
      lead_id: leadId,
      user_id: user.id,
      analise_id: resolvedAnaliseId,
      role: 'assistant',
      content: assistantContent,
      modelo: model,
    });

    const { data: insertedRows, error: insertError } = await db
      .from(chatTable)
      .insert(chatRows)
      .select('id, role, content, criado_em, modelo');

    if (insertError) {
      console.error('Erro ao salvar mensagens:', insertError);
      return jsonResponse({ error: 'Resposta gerada mas não foi possível salvar no histórico' }, 500);
    }

    const assistantRows = (insertedRows ?? []).filter((r) => r.role === 'assistant');
    const lastAssistantRow = assistantRows.at(-1);

    return jsonResponse({
      spotDescription,
      assistantMessage: assistantContent,
      messageId: lastAssistantRow?.id ?? null,
      criadoEm: lastAssistantRow?.criado_em ?? null,
    });
  } catch (err) {
    console.error('chat-iris-sky error:', err);
    return jsonResponse({ error: 'Erro interno no chat Íris Sky' }, 500);
  }
});
