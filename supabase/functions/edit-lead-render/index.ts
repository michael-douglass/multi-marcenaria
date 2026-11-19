import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import {
  autorizarIaCardLead,
  checarCota,
  ehRecusa,
  mensagemSegura,
  registrarUso,
  respostaRecusa,
  type OpenAiUsage,
} from '../_shared/ia-card-lead.ts';
import { modeloImagemPermitido } from '../_shared/ia-card-lead-modelos.ts';
import { corsHeaders } from '../_shared/cors.ts';
import { buildSurgicalEditPrompt, type EditPonto } from '../_shared/render-prompts.ts';
import { callOpenAIImageEdit } from '../_shared/openai-image-edit.ts';
import {
  buildEditMaskFromPontos,
  maskMatchesImage,
  readImageDimensions,
} from '../_shared/edit-mask.ts';

const RENDER_BUCKET = 'lead-ai-renders';
const MARKETING_BUCKET = 'marketing-medias';
const ORCAMENTOS_FOLDER_NAME = 'orçamentos';
const MAX_PONTOS = 8;

interface EditRenderRequest {
  leadId: number;
  parentRenderId?: string;
  editNotas: string;
  editPontos: EditPonto[];
  maskImageBase64?: string;
  markedImageBase64?: string;
  sourceImageUrl?: string;
  sourceImageBase64?: string;
  inputSnapshot?: {
    source?: string;
    id?: string;
    label?: string;
    kind?: string;
    imageUrl?: string;
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type CrmDb = ReturnType<SupabaseClient['schema']>;

function aiRenderAttachmentFileName(renderId: string): string {
  return `render-ia-${renderId}.png`;
}

function aiRenderAttachmentTitle(label: string): string {
  const trimmed = label?.trim() || 'Projeto';
  return `Render IA — ${trimmed}`;
}

function decodeBase64Image(base64: unknown): { bytes: Uint8Array; mime: string } | null {
  if (typeof base64 !== 'string' || !base64.trim()) return null;
  const dataUrlMatch = base64.match(/^data:([^;]+);base64,(.+)$/);
  const raw = dataUrlMatch ? dataUrlMatch[2] : base64.replace(/^data:image\/\w+;base64,/, '');
  const mime = dataUrlMatch?.[1] || 'image/png';
  try {
    const binary = atob(raw);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return { bytes, mime };
  } catch {
    return null;
  }
}

async function loadRenderImageBytes(
  supabase: SupabaseClient,
  outputUrl: string | null,
  storagePath: string | null,
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  if (storagePath) {
    const { data, error } = await supabase.storage.from(RENDER_BUCKET).download(storagePath);
    if (!error && data) {
      return { bytes: new Uint8Array(await data.arrayBuffer()), mime: 'image/png' };
    }
    console.warn('Falha ao baixar render do storage, tentando URL pública:', error?.message);
  }

  if (!outputUrl) return null;
  return urlToBytes(outputUrl);
}

async function resolveEditMaskBytes(
  sourceBytes: Uint8Array,
  pontos: EditPonto[],
  clientMaskBase64?: unknown,
): Promise<Uint8Array | undefined> {
  const sourceDim = await readImageDimensions(sourceBytes);
  if (!sourceDim) {
    console.warn('Não foi possível ler dimensões da imagem fonte; edição sem máscara');
    return undefined;
  }

  const clientMask = decodeBase64Image(clientMaskBase64);
  if (clientMask && maskMatchesImage(sourceBytes, clientMask.bytes)) {
    return clientMask.bytes;
  }

  if (clientMask) {
    console.warn('Máscara do cliente com dimensões incompatíveis; regenerando no servidor');
  }

  try {
    return await buildEditMaskFromPontos(sourceDim.width, sourceDim.height, pontos);
  } catch (err) {
    console.error('Erro ao gerar máscara no servidor:', err);
    return undefined;
  }
}

async function resolveEditInputImageBytes(
  sourceBytes: Uint8Array,
  markedImageBase64?: unknown,
): Promise<Uint8Array> {
  const marked = decodeBase64Image(markedImageBase64);
  if (marked && maskMatchesImage(sourceBytes, marked.bytes)) {
    return marked.bytes;
  }
  if (marked) {
    console.warn('Imagem marcada com dimensões incompatíveis; usando render original sem marcadores');
  }
  return sourceBytes;
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

function validatePontos(pontos: unknown): EditPonto[] | null {
  if (!Array.isArray(pontos) || pontos.length < 1 || pontos.length > MAX_PONTOS) return null;
  const valid: EditPonto[] = [];
  for (const p of pontos) {
    if (
      typeof p !== 'object' ||
      p === null ||
      typeof p.id !== 'number' ||
      typeof p.x !== 'number' ||
      typeof p.y !== 'number'
    ) {
      return null;
    }
    if (p.x < 0 || p.x > 1 || p.y < 0 || p.y > 1) return null;
    valid.push({ id: p.id, x: p.x, y: p.y });
  }
  return valid;
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // A edição por IA conta como escrita (gera arquivos, linhas e custo).
    const ctx = await autorizarIaCardLead(req, 'render');
    if (ehRecusa(ctx)) return respostaRecusa(ctx);
    const supabase = ctx.svc;
    const empresaId = ctx.empresaId;

    let body: EditRenderRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Corpo da requisição inválido (JSON)' }, 400);
    }

    const {
      leadId,
      parentRenderId,
      editNotas,
      editPontos,
      maskImageBase64,
      markedImageBase64,
      sourceImageUrl,
      sourceImageBase64,
      inputSnapshot: clientInputSnapshot,
    } = body;

    if (!leadId || typeof leadId !== 'number') {
      return jsonResponse({ error: 'leadId é obrigatório' }, 400);
    }

    const hasParentRender = typeof parentRenderId === 'string' && parentRenderId.length > 0;
    const hasPhotoSource =
      (typeof sourceImageUrl === 'string' && sourceImageUrl.trim().length > 0) ||
      (typeof sourceImageBase64 === 'string' && sourceImageBase64.trim().length > 0);

    if (!hasParentRender && !hasPhotoSource) {
      return jsonResponse(
        { error: 'Informe parentRenderId ou a imagem de origem (sourceImageUrl / sourceImageBase64)' },
        400,
      );
    }

    const notas = typeof editNotas === 'string' ? editNotas.trim() : '';
    if (notas.length < 5) {
      return jsonResponse({ error: 'Descreva a alteração com pelo menos 5 caracteres' }, 400);
    }

    const pontos = validatePontos(editPontos);
    if (!pontos) {
      return jsonResponse({ error: `Informe entre 1 e ${MAX_PONTOS} pontos válidos na imagem` }, 400);
    }

    const db = supabase.schema('crm');

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

    const { data: parentRender, error: parentError } = hasParentRender
      ? await db
          .from('lead_ai_renders')
          .select(
            'id, lead_id, analise_texto, render_prompt_snapshot, analysis_prompt_snapshot, vision_model, image_model, input_snapshot, output_public_url, output_storage_path',
          )
          .eq('id', parentRenderId!)
          .eq('empresa_id', empresaId)
          .maybeSingle()
      : { data: null, error: null };

    if (hasParentRender && (parentError || !parentRender)) {
      return jsonResponse({ error: 'Renderização original não encontrada' }, 404);
    }

    if (parentRender && parentRender.lead_id !== leadId) {
      return jsonResponse({ error: 'Renderização não pertence a este lead' }, 403);
    }

    let sourceImage: { bytes: Uint8Array; mime: string } | null = null;

    if (parentRender) {
      const outputUrl = parentRender.output_public_url as string | null;
      const parentStoragePath = parentRender.output_storage_path as string | null;
      sourceImage = await loadRenderImageBytes(supabase, outputUrl, parentStoragePath);
    } else {
      sourceImage = decodeBase64Image(sourceImageBase64);
      if (!sourceImage && typeof sourceImageUrl === 'string' && sourceImageUrl.trim()) {
        if (sourceImageUrl.startsWith('data:')) {
          sourceImage = decodeBase64Image(sourceImageUrl);
        } else {
          sourceImage = await urlToBytes(sourceImageUrl.trim());
        }
      }
    }

    if (!sourceImage) {
      return jsonResponse({ error: 'Não foi possível carregar a imagem selecionada' }, 400);
    }

    const maskBytes = await resolveEditMaskBytes(sourceImage.bytes, pontos, maskImageBase64);
    if (!maskBytes?.length) {
      return jsonResponse(
        { error: 'Não foi possível gerar a máscara de edição. Tente reposicionar o ponto na imagem.' },
        400,
      );
    }

    const inputImageBytes = await resolveEditInputImageBytes(sourceImage.bytes, markedImageBase64);

    // O modelo do render-pai só vale se ainda for permitido; senão usa o do motor global.
    const imageModel = modeloImagemPermitido(
      parentRender && parentRender.image_model ? parentRender.image_model : ctx.motor.image_model,
    );

    const editPrompt = buildSurgicalEditPrompt({ notas, pontos });

    let outputBytes: Uint8Array;
    let imagemUsage: OpenAiUsage = null;
    try {
      outputBytes = await callOpenAIImageEdit(
        openAiKey,
        imageModel,
        inputImageBytes,
        sourceImage.mime,
        editPrompt,
        maskBytes,
        {
          requireMask: true,
          onUsage: (u) => {
            imagemUsage = u as OpenAiUsage;
          },
        },
      );
    } catch (err) {
      const message = mensagemSegura(err instanceof Error ? err.message : 'Erro ao aplicar edição');
      return jsonResponse({ error: message }, 502);
    }

    const renderId = crypto.randomUUID();
    const outputStoragePath = `${empresaId}/${leadId}/${renderId}.png`;

    const { error: uploadError } = await supabase.storage
      .from(RENDER_BUCKET)
      .upload(outputStoragePath, outputBytes, {
        contentType: 'image/png',
        upsert: false,
      });

    if (uploadError) {
      console.error('Erro ao salvar render editada:', uploadError);
      return jsonResponse({ error: 'Edição gerada mas não foi possível salvar no storage' }, 500);
    }

    const { data: publicUrlData } = supabase.storage.from(RENDER_BUCKET).getPublicUrl(outputStoragePath);

    const photoLabel =
      typeof clientInputSnapshot?.label === 'string' && clientInputSnapshot.label.trim()
        ? clientInputSnapshot.label.trim()
        : 'Foto do lead';

    const inputSnapshot = parentRender
      ? {
          source: 'render_edit' as const,
          id: parentRenderId!,
          parentRenderId: parentRenderId!,
          label: 'Edição pontual',
        }
      : {
          source: (clientInputSnapshot?.source ?? 'anexo') as string,
          id: clientInputSnapshot?.id ?? 'photo-edit',
          label: photoLabel,
          kind: clientInputSnapshot?.kind,
          imageUrl: clientInputSnapshot?.imageUrl ?? sourceImageUrl,
        };

    const analiseTexto = parentRender
      ? (parentRender.analise_texto as string)
      : `Edição pontual aplicada em: ${photoLabel}`;

    await registrarUso(ctx, {
      funcao: 'render_edicao',
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
        output_storage_path: outputStoragePath,
        output_public_url: publicUrlData.publicUrl,
        vision_model: parentRender ? (parentRender.vision_model as string) : '',
        image_model: imageModel,
        analysis_prompt_snapshot: parentRender
          ? (parentRender.analysis_prompt_snapshot as string)
          : '',
        render_prompt_snapshot: editPrompt,
        parent_render_id: parentRender ? parentRenderId! : null,
        edit_notas: notas,
        edit_pontos: pontos,
        criado_por: ctx.userId,
      })
      .select('id, criado_em')
      .single();

    if (insertError) {
      console.error('Erro ao salvar histórico de edição:', insertError);
      await supabase.storage.from(RENDER_BUCKET).remove([outputStoragePath]);
      return jsonResponse({ error: 'Edição gerada mas não foi possível salvar no histórico' }, 500);
    }

    await saveRenderAsLeadAttachment(
      supabase,
      db,
      empresaId,
      leadId,
      renderId,
      outputBytes,
      parentRender ? 'Edição pontual' : photoLabel,
    );

    return jsonResponse({
      renderId: inserted.id,
      outputUrl: publicUrlData.publicUrl,
      analiseTexto,
      criadoEm: inserted.criado_em,
      inputSnapshot,
      parentRenderId: parentRender ? parentRenderId! : null,
      editNotas: notas,
      editPontos: pontos,
    });
  } catch (err) {
    console.error('edit-lead-render error:', err);
    const message = err instanceof Error ? err.message : 'Erro interno ao editar renderização';
    return jsonResponse({ error: message }, 500);
  }
});
