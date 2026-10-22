import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors.ts';
import {
  DEFAULT_RENDER_ANALYSIS_PROMPT,
  DEFAULT_RENDER_IMAGE_PROMPT,
  appendCaracteristicasToRenderPrompt,
} from '../_shared/render-prompts.ts';
import { callOpenAIImageEdit } from '../_shared/openai-image-edit.ts';

const ALLOWED_VISION_MODELS = new Set(['gpt-4o-mini', 'gpt-4o', 'gpt-4.1']);
const DEFAULT_VISION_MODEL = 'gpt-4o';
const ALLOWED_IMAGE_MODELS = new Set(['gpt-image-1.5', 'gpt-image-1', 'dall-e-2']);
const DEFAULT_IMAGE_MODEL = 'gpt-image-1.5';
const RENDER_BUCKET = 'lead-ai-renders';

interface RenderItem {
  source: 'anexo' | 'whiteboard' | 'orcamento_slide';
  id: string;
  label: string;
  imageUrl?: string;
  pagesBase64?: string[];
}

interface RenderRequest {
  leadId: number;
  empresaSchema?: string | null;
  leadName?: string;
  leadOrigin?: string;
  item: RenderItem;
  caracteristicasExtras?: string;
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

function rendersTableName(empresaSchema?: string | null): string {
  return isEmpresaSchema(empresaSchema)
    ? 'lead_ai_renders'
    : 'CRM-multi-empresas>lead_ai_renders<';
}

function mediasTableName(empresaSchema?: string | null): string {
  return isEmpresaSchema(empresaSchema)
    ? 'marketing_medias'
    : 'crm_multiempresas_marketing_medias';
}

function foldersTableName(empresaSchema?: string | null): string {
  return isEmpresaSchema(empresaSchema)
    ? 'marketing_media_folders'
    : 'crm_multiempresas_marketing_media_folders';
}

const MARKETING_BUCKET = 'marketing-medias';
const ORCAMENTOS_FOLDER_NAME = 'orçamentos';

function aiRenderAttachmentFileName(renderId: string): string {
  return `render-ia-${renderId}.png`;
}

function aiRenderAttachmentTitle(label: string): string {
  const trimmed = label?.trim() || 'Projeto';
  return `Render IA — ${trimmed}`;
}

async function getOrCreateOrcamentosFolder(
  db: ReturnType<typeof resolveDb>,
  empresaSchema?: string | null,
): Promise<string | null> {
  const foldersTable = foldersTableName(empresaSchema);
  const { data: existing } = await db
    .from(foldersTable)
    .select('id')
    .eq('nome', ORCAMENTOS_FOLDER_NAME)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data: created, error } = await db
    .from(foldersTable)
    .insert({ nome: ORCAMENTOS_FOLDER_NAME, descricao: 'Orçamentos de leads' })
    .select('id')
    .single();

  if (error) {
    console.error('Erro ao criar pasta de anexos:', error);
    return null;
  }
  return created.id as string;
}

/** Salva a renderização como anexo do lead (marketing_medias) para aparecer nos anexos e nos slides. */
async function saveRenderAsLeadAttachment(
  supabase: SupabaseClient,
  db: ReturnType<typeof resolveDb>,
  empresaSchema: string | null | undefined,
  leadId: number,
  renderId: string,
  outputBytes: Uint8Array,
  label: string,
): Promise<void> {
  const prefix = storagePrefix(empresaSchema);
  const fileName = aiRenderAttachmentFileName(renderId);
  const storagePath = `${prefix}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(MARKETING_BUCKET)
    .upload(storagePath, outputBytes, {
      contentType: 'image/png',
      upsert: false,
    });

  if (uploadError) {
    console.error('Erro ao salvar render como anexo:', uploadError);
    return;
  }

  const { data: publicUrlData } = supabase.storage.from(MARKETING_BUCKET).getPublicUrl(storagePath);
  const folderId = await getOrCreateOrcamentosFolder(db, empresaSchema);
  if (!folderId) return;

  const { error: insertError } = await db.from(mediasTableName(empresaSchema)).insert({
    titulo: aiRenderAttachmentTitle(label),
    tipo: 'imagem',
    file_url: publicUrlData.publicUrl,
    file_name: fileName,
    file_size: outputBytes.length,
    mime_type: 'image/png',
    folder_id: folderId,
    lead_id: leadId,
  });

  if (insertError) {
    console.error('Erro ao registrar render como anexo:', insertError);
    await supabase.storage.from(MARKETING_BUCKET).remove([storagePath]);
  }
}

function storagePrefix(empresaSchema?: string | null): string {
  return isEmpresaSchema(empresaSchema) ? empresaSchema! : 'master';
}

function applyPromptPlaceholders(
  prompt: string,
  vars: {
    nomeLead?: string;
    origem?: string;
    analise?: string;
  },
): string {
  return prompt
    .replace(/\{\{nome_lead\}\}/gi, vars.nomeLead?.trim() || 'Não informado')
    .replace(/\{\{origem\}\}/gi, vars.origem?.trim() || 'Não informada')
    .replace(/\{\{analise\}\}/gi, vars.analise?.trim() || 'Não disponível');
}

async function urlToBytes(url: string): Promise<{ bytes: Uint8Array; mime: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const mime = res.headers.get('content-type') || 'image/png';
    return { bytes: new Uint8Array(buffer), mime };
  } catch {
    return null;
  }
}

function dataUrlToBytes(dataUrl: string): { bytes: Uint8Array; mime: string } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { bytes, mime: match[1] };
  } catch {
    return null;
  }
}

function base64ToBytes(b64: string): Uint8Array | null {
  try {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  } catch {
    return null;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

function detectImageMime(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return 'image/png';
  }
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }
  return 'image/png';
}

async function resolveSketchBytes(item: RenderItem): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (item.pagesBase64?.length) {
    const page = item.pagesBase64[0];
    if (page.startsWith('data:')) return dataUrlToBytes(page);
    const bytes = base64ToBytes(page);
    if (!bytes) return null;
    return { bytes, mime: detectImageMime(bytes) };
  }
  if (item.imageUrl) {
    if (item.imageUrl.startsWith('data:')) return dataUrlToBytes(item.imageUrl);
    return urlToBytes(item.imageUrl);
  }
  return null;
}

async function callOpenAIChat(
  apiKey: string,
  model: string,
  messages: Array<{ role: string; content: string | Array<{ type: string; text?: string; image_url?: { url: string } }> }>,
  maxTokens = 2048,
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
    console.error('OpenAI chat error:', openAiRes.status, errText);
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
  if (!content) throw new Error('A IA não retornou análise do esboço');
  return content;
}

const DEFAULT_ANALYSIS_PROMPT = DEFAULT_RENDER_ANALYSIS_PROMPT;
const DEFAULT_RENDER_PROMPT = DEFAULT_RENDER_IMAGE_PROMPT;

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

    let body: RenderRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Corpo da requisição inválido (JSON)' }, 400);
    }

    const { leadId, empresaSchema, leadName, leadOrigin, item, caracteristicasExtras } = body;

    if (!leadId || typeof leadId !== 'number') {
      return jsonResponse({ error: 'leadId é obrigatório' }, 400);
    }

    if (!item || typeof item !== 'object') {
      return jsonResponse({ error: 'Selecione uma imagem para renderizar' }, 400);
    }

    const db = resolveDb(supabase, empresaSchema);

    const { data: configRow, error: configError } = await db
      .from(configTableName(empresaSchema))
      .select(
        'render_ativo, render_vision_model, render_image_model, render_analysis_prompt, render_prompt, ativo, openai_api_key',
      )
      .eq('singleton_key', 'default')
      .maybeSingle();

    if (configError) {
      console.error('Erro ao carregar config IA:', configError);
      return jsonResponse({ error: 'Erro ao carregar configuração de IA' }, 500);
    }

    if (!configRow?.render_ativo) {
      return jsonResponse({ error: 'Renderização de projetos desativada nas configurações' }, 403);
    }

    const openAiKey = configRow.openai_api_key?.trim() || '';
    if (!openAiKey) {
      return jsonResponse(
        { error: 'Chave da OpenAI do Lead não configurada. Defina em Configurações IA.' },
        500,
      );
    }

    const sketch = await resolveSketchBytes(item);
    if (!sketch) {
      return jsonResponse({ error: 'Não foi possível carregar a imagem selecionada' }, 400);
    }

    const visionModel = ALLOWED_VISION_MODELS.has(configRow.render_vision_model)
      ? configRow.render_vision_model
      : DEFAULT_VISION_MODEL;
    const imageModel = ALLOWED_IMAGE_MODELS.has(configRow.render_image_model)
      ? configRow.render_image_model
      : DEFAULT_IMAGE_MODEL;

    const analysisPromptRaw =
      (configRow.render_analysis_prompt as string | null)?.trim() || DEFAULT_ANALYSIS_PROMPT;
    const renderPromptRaw =
      (configRow.render_prompt as string | null)?.trim() || DEFAULT_RENDER_PROMPT;

    const analysisPromptSnapshot = applyPromptPlaceholders(analysisPromptRaw, {
      nomeLead: leadName,
      origem: leadOrigin,
    });

    const imageDataUrl = `data:${sketch.mime};base64,${bytesToBase64(sketch.bytes)}`;

    let analiseTexto: string;
    try {
      analiseTexto = await callOpenAIChat(openAiKey, visionModel, [
        { role: 'system', content: analysisPromptSnapshot },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Classifique a imagem e retorne apenas o YAML conforme as instruções do sistema.' },
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'auto' } },
          ],
        },
      ], 3072);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro na análise do esboço';
      console.error('render-lead-project vision error:', message);
      return jsonResponse({ error: message, step: 'vision' }, 502);
    }

    const renderPromptSnapshot = appendCaracteristicasToRenderPrompt(
      applyPromptPlaceholders(renderPromptRaw, {
        nomeLead: leadName,
        origem: leadOrigin,
        analise: analiseTexto,
      }),
      typeof caracteristicasExtras === 'string' ? caracteristicasExtras : undefined,
    );

    let outputBytes: Uint8Array;
    try {
      outputBytes = await callOpenAIImageEdit(
        openAiKey,
        imageModel,
        sketch.bytes,
        sketch.mime,
        renderPromptSnapshot,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao gerar renderização';
      console.error('render-lead-project image error:', message, { imageModel });
      return jsonResponse({ error: message, step: 'render', imageModel }, 502);
    }

    const renderId = crypto.randomUUID();
    const storagePath = `${storagePrefix(empresaSchema)}/${leadId}/${renderId}.png`;

    const { error: uploadError } = await supabase.storage
      .from(RENDER_BUCKET)
      .upload(storagePath, outputBytes, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      console.error('Erro ao salvar render:', uploadError);
      return jsonResponse({ error: 'Render gerada mas não foi possível salvar no storage' }, 500);
    }

    const { data: publicUrlData } = supabase.storage.from(RENDER_BUCKET).getPublicUrl(storagePath);

    const inputSnapshot = {
      source: item.source,
      id: item.id,
      label: item.label,
      imageUrl: item.imageUrl,
      kind: item.pagesBase64?.length ? 'pdf' : 'image',
      ...(typeof caracteristicasExtras === 'string' && caracteristicasExtras.trim()
        ? { caracteristicasExtras: caracteristicasExtras.trim() }
        : {}),
    };

    const { data: inserted, error: insertError } = await db
      .from(rendersTableName(empresaSchema))
      .insert({
        id: renderId,
        lead_id: leadId,
        input_snapshot: inputSnapshot,
        analise_texto: analiseTexto,
        output_storage_path: storagePath,
        output_public_url: publicUrlData.publicUrl,
        vision_model: visionModel,
        image_model: imageModel,
        analysis_prompt_snapshot: analysisPromptSnapshot,
        render_prompt_snapshot: renderPromptSnapshot,
        criado_por: user.id,
      })
      .select('id, criado_em')
      .single();

    if (insertError) {
      console.error('Erro ao salvar histórico de render:', insertError);
      await supabase.storage.from(RENDER_BUCKET).remove([storagePath]);
      return jsonResponse({ error: 'Render gerada mas não foi possível salvar no histórico' }, 500);
    }

    await saveRenderAsLeadAttachment(
      supabase,
      db,
      empresaSchema,
      leadId,
      renderId,
      outputBytes,
      item.label,
    );

    return jsonResponse({
      renderId: inserted.id,
      outputUrl: publicUrlData.publicUrl,
      analiseTexto,
      criadoEm: inserted.criado_em,
      inputSnapshot,
    });
  } catch (err) {
    console.error('render-lead-project error:', err);
    return jsonResponse({ error: 'Erro interno ao renderizar projeto' }, 500);
  }
});
