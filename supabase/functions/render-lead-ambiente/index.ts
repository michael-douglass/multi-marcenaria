import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from './_shared/cors.ts';
import {
  DEFAULT_AMBIENTE_ANALYSIS_PROMPT,
  DEFAULT_AMBIENTE_IMAGE_PROMPT,
  applyAmbientePromptPlaceholders,
} from './_shared/ambiente-prompts.ts';
import { callOpenAIImageEdit, callOpenAIImageGenerate } from './_shared/openai-image-edit.ts';

const ALLOWED_VISION_MODELS = new Set(['gpt-4o-mini', 'gpt-4o', 'gpt-4.1']);
const DEFAULT_VISION_MODEL = 'gpt-4o';
const ALLOWED_IMAGE_MODELS = new Set(['gpt-image-1.5', 'gpt-image-1', 'dall-e-2']);
const DEFAULT_IMAGE_MODEL = 'gpt-image-1.5';
const RENDER_BUCKET = 'lead-ai-renders';
const MARKETING_BUCKET = 'marketing-medias';
const ORCAMENTOS_FOLDER_NAME = 'orçamentos';

interface AmbienteRequest {
  action?: 'analyze' | 'render';
  leadId: number;
  empresaSchema?: string | null;
  leadName?: string;
  leadOrigin?: string;
  descricao?: string;
  analiseTexto?: string;
  compositionImageBase64?: string;
  sourceImageBase64?: string;
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

function storagePrefix(empresaSchema?: string | null): string {
  return isEmpresaSchema(empresaSchema) ? empresaSchema! : 'master';
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

function detectImageMime(bytes: Uint8Array): string {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) {
    return 'image/png';
  }
  return 'image/jpeg';
}

function parseImagePayload(raw?: string): { bytes: Uint8Array; mime: string } | null {
  if (!raw?.trim()) return null;
  if (raw.startsWith('data:')) return dataUrlToBytes(raw);
  const bytes = base64ToBytes(raw);
  if (!bytes) return null;
  return { bytes, mime: detectImageMime(bytes) };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
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
  if (!content) throw new Error('A IA não retornou a análise do ambiente');
  return content;
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

async function saveRenderAsLeadAttachment(
  supabase: SupabaseClient,
  db: ReturnType<typeof resolveDb>,
  empresaSchema: string | null | undefined,
  leadId: number,
  renderId: string,
  outputBytes: Uint8Array,
): Promise<void> {
  const prefix = storagePrefix(empresaSchema);
  const fileName = `render-ambiente-${renderId}.png`;
  const storagePath = `${prefix}/${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from(MARKETING_BUCKET)
    .upload(storagePath, outputBytes, {
      contentType: 'image/png',
      upsert: false,
    });

  if (uploadError) {
    console.error('Erro ao salvar render de ambiente como anexo:', uploadError);
    return;
  }

  const { data: publicUrlData } = supabase.storage.from(MARKETING_BUCKET).getPublicUrl(storagePath);
  const folderId = await getOrCreateOrcamentosFolder(db, empresaSchema);
  if (!folderId) return;

  const { error: insertError } = await db.from(mediasTableName(empresaSchema)).insert({
    titulo: 'Render IA — Ambiente',
    tipo: 'imagem',
    file_url: publicUrlData.publicUrl,
    file_name: fileName,
    file_size: outputBytes.length,
    mime_type: 'image/png',
    folder_id: folderId,
    lead_id: leadId,
  });

  if (insertError) {
    console.error('Erro ao registrar render de ambiente como anexo:', insertError);
    await supabase.storage.from(MARKETING_BUCKET).remove([storagePath]);
  }
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

    let body: AmbienteRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Corpo da requisição inválido (JSON)' }, 400);
    }

    const action = body.action === 'render' ? 'render' : 'analyze';
    const { leadId, empresaSchema, leadName, leadOrigin } = body;
    const descricao = typeof body.descricao === 'string' ? body.descricao.trim() : '';

    if (!leadId || typeof leadId !== 'number') {
      return jsonResponse({ error: 'leadId é obrigatório' }, 400);
    }

    const composition = parseImagePayload(body.compositionImageBase64);
    const sourceImage = parseImagePayload(body.sourceImageBase64) ?? composition;

    if (action === 'analyze' && !descricao && !sourceImage) {
      return jsonResponse({ error: 'Descreva o ambiente ou envie uma foto' }, 400);
    }

    const db = resolveDb(supabase, empresaSchema);

    const { data: configRow, error: configError } = await db
      .from(configTableName(empresaSchema))
      .select(
        'render_ambiente_ativo, render_vision_model, render_image_model, render_ambiente_analysis_prompt, render_ambiente_prompt, openai_api_key',
      )
      .eq('singleton_key', 'default')
      .maybeSingle();

    if (configError) {
      console.error('Erro ao carregar config IA:', configError);
      return jsonResponse({ error: 'Erro ao carregar configuração de IA' }, 500);
    }

    if (configRow && configRow.render_ambiente_ativo === false) {
      return jsonResponse({ error: 'Renderização com ambiente desativada nas configurações' }, 403);
    }

    const openAiKey =
      (configRow?.openai_api_key?.trim() || '') || Deno.env.get('OPENAI_API_KEY') || '';
    if (!openAiKey) {
      return jsonResponse(
        { error: 'Chave da OpenAI não configurada. Defina em Pipeline → Configurações → IA.' },
        500,
      );
    }

    const visionModel = ALLOWED_VISION_MODELS.has(configRow?.render_vision_model)
      ? configRow.render_vision_model
      : DEFAULT_VISION_MODEL;
    const imageModel = ALLOWED_IMAGE_MODELS.has(configRow?.render_image_model)
      ? configRow.render_image_model
      : DEFAULT_IMAGE_MODEL;

    const analysisPromptRaw =
      (configRow?.render_ambiente_analysis_prompt as string | null)?.trim() ||
      DEFAULT_AMBIENTE_ANALYSIS_PROMPT;
    const renderPromptRaw =
      (configRow?.render_ambiente_prompt as string | null)?.trim() || DEFAULT_AMBIENTE_IMAGE_PROMPT;

    const analysisPromptSnapshot = applyAmbientePromptPlaceholders(analysisPromptRaw, {
      nomeLead: leadName,
      origem: leadOrigin,
      descricao,
    });

    let analiseTexto =
      typeof body.analiseTexto === 'string' && body.analiseTexto.trim()
        ? body.analiseTexto.trim()
        : '';

    if (!analiseTexto || action === 'analyze') {
      try {
        const userContent: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
          {
            type: 'text',
            text: descricao
              ? `Descrição do vendedor:\n${descricao}\n\nRetorne apenas o YAML.`
              : 'Não houve descrição textual. Analise a foto e retorne apenas o YAML.',
          },
        ];
        if (sourceImage) {
          userContent.push({
            type: 'image_url',
            image_url: {
              url: `data:${sourceImage.mime};base64,${bytesToBase64(sourceImage.bytes)}`,
            },
          });
        }

        analiseTexto = await callOpenAIChat(
          openAiKey,
          visionModel,
          [
            { role: 'system', content: analysisPromptSnapshot },
            { role: 'user', content: userContent },
          ],
          3072,
        );
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro na análise do ambiente';
        console.error('render-lead-ambiente vision error:', message);
        return jsonResponse({ error: message, step: 'vision' }, 502);
      }
    }

    if (action === 'analyze') {
      return jsonResponse({ analiseTexto });
    }

    const renderPromptSnapshot = applyAmbientePromptPlaceholders(renderPromptRaw, {
      nomeLead: leadName,
      origem: leadOrigin,
      analise: analiseTexto,
      descricao,
    });

    const editSource = composition ?? sourceImage;
    let outputBytes: Uint8Array;
    try {
      if (editSource) {
        outputBytes = await callOpenAIImageEdit(
          openAiKey,
          imageModel,
          editSource.bytes,
          editSource.mime,
          renderPromptSnapshot,
        );
      } else {
        outputBytes = await callOpenAIImageGenerate(openAiKey, imageModel, renderPromptSnapshot);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao gerar renderização do ambiente';
      console.error('render-lead-ambiente image error:', message, { imageModel });
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
      console.error('Erro ao salvar render de ambiente:', uploadError);
      return jsonResponse({ error: 'Render gerada mas não foi possível salvar no storage' }, 500);
    }

    const { data: publicUrlData } = supabase.storage.from(RENDER_BUCKET).getPublicUrl(storagePath);

    const inputSnapshot = {
      source: 'anexo' as const,
      id: renderId,
      label: 'Composição de ambiente',
      mode: 'ambiente' as const,
      descricao: descricao || undefined,
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
      console.error('Erro ao salvar histórico de ambiente:', insertError);
      await supabase.storage.from(RENDER_BUCKET).remove([storagePath]);
      return jsonResponse({ error: 'Render gerada mas não foi possível salvar no histórico' }, 500);
    }

    await saveRenderAsLeadAttachment(supabase, db, empresaSchema, leadId, renderId, outputBytes);

    return jsonResponse({
      renderId: inserted.id,
      outputUrl: publicUrlData.publicUrl,
      analiseTexto,
      criadoEm: inserted.criado_em,
      inputSnapshot,
    });
  } catch (err) {
    console.error('render-lead-ambiente error:', err);
    return jsonResponse({ error: 'Erro interno ao renderizar ambiente' }, 500);
  }
});
