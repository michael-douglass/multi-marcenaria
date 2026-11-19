import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import {
  autorizarIaCardLead,
  checarCota,
  chatVisao,
  ehRecusa,
  mensagemSegura,
  registrarUso,
  respostaRecusa,
  type OpenAiUsage,
} from '../_shared/ia-card-lead.ts';
import { modeloImagemPermitido, modeloVisaoPermitido } from '../_shared/ia-card-lead-modelos.ts';
import { corsHeaders } from '../_shared/cors.ts';
import {
  DEFAULT_RENDER_ANALYSIS_PROMPT,
  DEFAULT_RENDER_IMAGE_PROMPT,
  appendCaracteristicasToRenderPrompt,
} from '../_shared/render-prompts.ts';
import { callOpenAIImageEdit } from '../_shared/openai-image-edit.ts';

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

type CrmDb = ReturnType<SupabaseClient['schema']>;

const MARKETING_BUCKET = 'marketing-medias';
const ORCAMENTOS_FOLDER_NAME = 'orçamentos';

function aiRenderAttachmentFileName(renderId: string): string {
  return `render-ia-${renderId}.png`;
}

function aiRenderAttachmentTitle(label: string): string {
  const trimmed = label?.trim() || 'Projeto';
  return `Render IA — ${trimmed}`;
}

async function getOrCreateOrcamentosFolder(db: CrmDb, empresaId: string): Promise<string | null> {
  const foldersTable = 'marketing_media_folders';
  const { data: existing } = await db
    .from(foldersTable)
    .select('id')
    .eq('empresa_id', empresaId)
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
  db: CrmDb,
  empresaId: string,
  leadId: number,
  renderId: string,
  outputBytes: Uint8Array,
  label: string,
): Promise<void> {
  const prefix = empresaId;
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
  const folderId = await getOrCreateOrcamentosFolder(db, empresaId);
  if (!folderId) return;

  const { error: insertError } = await db.from('marketing_medias').insert({
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

const DEFAULT_ANALYSIS_PROMPT = DEFAULT_RENDER_ANALYSIS_PROMPT;
const DEFAULT_RENDER_PROMPT = DEFAULT_RENDER_IMAGE_PROMPT;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ctx = await autorizarIaCardLead(req, 'render');
    if (ehRecusa(ctx)) return respostaRecusa(ctx);
    const supabase = ctx.svc;
    const empresaId = ctx.empresaId;
    const db = supabase.schema('crm');

    let body: RenderRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Corpo da requisição inválido (JSON)' }, 400);
    }

    const { leadId, leadName, leadOrigin, item, caracteristicasExtras } = body;

    if (!leadId || typeof leadId !== 'number') {
      return jsonResponse({ error: 'leadId é obrigatório' }, 400);
    }

    if (!item || typeof item !== 'object') {
      return jsonResponse({ error: 'Selecione uma imagem para renderizar' }, 400);
    }

    // O lead precisa ser da empresa de quem chama (service role ignora a RLS).
    const { data: leadRow } = await db
      .from('leads')
      .select('id')
      .eq('id', leadId)
      .eq('empresa_id', empresaId)
      .maybeSingle();
    if (!leadRow) return jsonResponse({ error: 'Lead não encontrado' }, 404);

    const cota = await checarCota(ctx);
    if (cota) return respostaRecusa(cota);

    const openAiKey = ctx.apiKey;
    const motor = ctx.motor;

    const sketch = await resolveSketchBytes(item);
    if (!sketch) {
      return jsonResponse({ error: 'Não foi possível carregar a imagem selecionada' }, 400);
    }

    const visionModel = modeloVisaoPermitido(motor.vision_model);
    const imageModel = modeloImagemPermitido(motor.image_model);

    const analysisPromptRaw = motor.render_analysis_prompt?.trim() || DEFAULT_ANALYSIS_PROMPT;
    const renderPromptRaw = motor.render_prompt?.trim() || DEFAULT_RENDER_PROMPT;

    const analysisPromptSnapshot = applyPromptPlaceholders(analysisPromptRaw, {
      nomeLead: leadName,
      origem: leadOrigin,
    });

    const imageDataUrl = `data:${sketch.mime};base64,${bytesToBase64(sketch.bytes)}`;

    let analiseTexto: string;
    try {
      const visao = await chatVisao(openAiKey, visionModel, [
        { role: 'system', content: analysisPromptSnapshot },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Classifique a imagem e retorne apenas o YAML conforme as instruções do sistema.' },
            { type: 'image_url', image_url: { url: imageDataUrl, detail: 'auto' } },
          ],
        },
      ], 3072);
      analiseTexto = visao.content;
      await registrarUso(ctx, { funcao: 'render_projeto', etapa: 'visao', modelo: visionModel, leadId, usage: visao.usage });
    } catch (err) {
      const message = mensagemSegura(err instanceof Error ? err.message : 'Erro na análise do esboço');
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
    let imagemUsage: OpenAiUsage = null;
    try {
      outputBytes = await callOpenAIImageEdit(
        openAiKey,
        imageModel,
        sketch.bytes,
        sketch.mime,
        renderPromptSnapshot,
        undefined,
        {
          onUsage: (u) => {
            imagemUsage = u as OpenAiUsage;
          },
        },
      );
    } catch (err) {
      const message = mensagemSegura(err instanceof Error ? err.message : 'Erro ao gerar renderização');
      console.error('render-lead-project image error:', message, { imageModel });
      return jsonResponse({ error: message, step: 'render', imageModel }, 502);
    }

    const renderId = crypto.randomUUID();
    const storagePath = `${empresaId}/${leadId}/${renderId}.png`;

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

    await registrarUso(ctx, {
      funcao: 'render_projeto',
      etapa: 'imagem',
      modelo: imageModel,
      leadId,
      refId: renderId,
      usage: imagemUsage,
    });

    const { data: inserted, error: insertError } = await db
      .from('lead_ai_renders')
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
        criado_por: ctx.userId,
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
      empresaId,
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
