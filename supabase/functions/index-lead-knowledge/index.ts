import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors.ts';
import {
  indexLeadKnowledge,
  isEmpresaSchema,
  metaTableName,
  resolveDb,
  type ClientMediaItem,
} from '../_shared/lead-knowledge.ts';
import { parseIrisSkyConfigRow } from '../_shared/iris-sky-prompts.ts';

interface IndexRequest {
  leadId: number;
  empresaSchema?: string | null;
  force?: boolean;
  includeMediaVision?: boolean;
  clientMedia?: ClientMediaItem[];
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function configTableName(empresaSchema?: string | null): string {
  return isEmpresaSchema(empresaSchema)
    ? 'pipeline_lead_ai_config'
    : 'CRM-multi-empresas>pipeline_lead_ai_config<';
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

    let body: IndexRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Corpo da requisição inválido (JSON)' }, 400);
    }

    const { leadId, empresaSchema, force, includeMediaVision, clientMedia } = body;
    if (!leadId || typeof leadId !== 'number') {
      return jsonResponse({ error: 'leadId é obrigatório' }, 400);
    }

    const db = resolveDb(supabase, empresaSchema);

    const { data: configRow, error: configError } = await db
      .from(configTableName(empresaSchema))
      .select(
        'ativo, openai_api_key, iris_sky_knowledge_ativo, iris_sky_embedding_model, iris_sky_include_media_vision, iris_sky_include_whatsapp, iris_sky_knowledge_max_items, iris_sky_knowledge_max_pages',
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

    const irisConfig = parseIrisSkyConfigRow(configRow as Record<string, unknown>);
    if (!irisConfig.irisSkyKnowledgeAtivo) {
      return jsonResponse(
        { error: 'Base de conhecimento desativada nas configurações do pipeline (aba IA).' },
        403,
      );
    }

    const openAiKey = configRow.openai_api_key?.trim() || '';
    if (!openAiKey) {
      return jsonResponse(
        { error: 'Chave da OpenAI do Lead não configurada. Defina em Configurações IA.' },
        500,
      );
    }

    const sanitizedClientMedia = Array.isArray(clientMedia)
      ? clientMedia
          .filter(
            (item) =>
              item &&
              typeof item.id === 'string' &&
              typeof item.label === 'string' &&
              typeof item.source === 'string',
          )
          .slice(0, irisConfig.irisSkyKnowledgeMaxItems)
      : undefined;

    const result = await indexLeadKnowledge(supabase, leadId, empresaSchema, openAiKey, {
      force: Boolean(force),
      includeMediaVision:
        includeMediaVision !== false && irisConfig.irisSkyIncludeMediaVision,
      includeWhatsapp: irisConfig.irisSkyIncludeWhatsapp,
      embeddingModel: irisConfig.irisSkyEmbeddingModel,
      clientMedia: sanitizedClientMedia?.length ? sanitizedClientMedia : undefined,
      clientMediaMaxPages: Math.min(irisConfig.irisSkyKnowledgeMaxPages, 20),
    });

    const { data: meta } = await db
      .from(metaTableName(empresaSchema))
      .select('status, chunk_count, indexed_at')
      .eq('lead_id', leadId)
      .maybeSingle();

    return jsonResponse({
      skipped: result.skipped,
      chunkCount: result.chunkCount || meta?.chunk_count || 0,
      status: meta?.status ?? 'ready',
      indexedAt: meta?.indexed_at ?? null,
    });
  } catch (err) {
    console.error('index-lead-knowledge error:', err);
    const message = err instanceof Error ? err.message : 'Erro interno ao indexar conhecimento';
    return jsonResponse({ error: message }, 500);
  }
});
