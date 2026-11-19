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
import { corsHeaders } from './_shared/cors.ts';
import {
  DEFAULT_AMBIENTE_ANALYSIS_PROMPT,
  DEFAULT_AMBIENTE_IMAGE_PROMPT,
  DEFAULT_AMBIENTE_SCENE_INVENTORY_PROMPT,
  applyAmbientePromptPlaceholders,
  appendAmbienteFurnitureFidelity,
} from '../_shared/render-prompts.ts';
import { callOpenAIImageEdit, callOpenAIImageGenerate } from '../_shared/openai-image-edit.ts';

const RENDER_BUCKET = 'lead-ai-renders';
const MARKETING_BUCKET = 'marketing-medias';
const ORCAMENTOS_FOLDER_NAME = 'orçamentos';

interface FurnitureReference {
  label?: string;
  imageBase64?: string;
}

interface AmbienteRequest {
  action?: 'analyze' | 'render';
  leadId: number;
  leadName?: string;
  leadOrigin?: string;
  descricao?: string;
  analiseTexto?: string;
  cenaInventario?: string;
  compositionImageBase64?: string;
  sourceImageBase64?: string;
  furnitureReferences?: FurnitureReference[];
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

type CrmDb = ReturnType<SupabaseClient['schema']>;

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
): Promise<void> {
  const prefix = empresaId;
  const fileName = `render-ia-${renderId}.png`;
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
  const folderId = await getOrCreateOrcamentosFolder(db, empresaId);
  if (!folderId) return;

  const { error: insertError } = await db.from('marketing_medias').insert({
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
    // O render por IA conta como escrita (gera arquivos, linhas e custo), inclusive a análise.
    const ctx = await autorizarIaCardLead(req, 'ambiente');
    if (ehRecusa(ctx)) return respostaRecusa(ctx);
    const supabase = ctx.svc;
    const empresaId = ctx.empresaId;

    let body: AmbienteRequest;
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Corpo da requisição inválido (JSON)' }, 400);
    }

    const action = body.action === 'render' ? 'render' : 'analyze';
    const { leadId, leadName, leadOrigin } = body;
    const descricao = typeof body.descricao === 'string' ? body.descricao.trim() : '';
    const cenaInventario = typeof body.cenaInventario === 'string' ? body.cenaInventario.trim() : '';

    if (!leadId || typeof leadId !== 'number') {
      return jsonResponse({ error: 'leadId é obrigatório' }, 400);
    }

    const composition = parseImagePayload(body.compositionImageBase64);
    const sourceImage = parseImagePayload(body.sourceImageBase64) ?? composition;
    const visionImage = composition ?? sourceImage;
    const furnitureRefs = (Array.isArray(body.furnitureReferences) ? body.furnitureReferences : [])
      .slice(0, 4)
      .flatMap((ref) => {
        const parsed = parseImagePayload(typeof ref?.imageBase64 === 'string' ? ref.imageBase64 : undefined);
        if (!parsed) return [];
        const label =
          typeof ref?.label === 'string' && ref.label.trim() ? ref.label.trim() : 'Móvel do projeto';
        return [{ label, ...parsed }];
      });

    if (action === 'analyze' && !descricao && !visionImage) {
      return jsonResponse({ error: 'Descreva o ambiente, desenhe na lousa ou envie uma foto' }, 400);
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
    const motor = ctx.motor;
    const visionModel = modeloVisaoPermitido(motor.vision_model);
    const imageModel = modeloImagemPermitido(motor.image_model);

    const analysisPromptRaw =
      motor.render_ambiente_analysis_prompt?.trim() || DEFAULT_AMBIENTE_ANALYSIS_PROMPT;
    const renderPromptRaw = motor.render_ambiente_prompt?.trim() || DEFAULT_AMBIENTE_IMAGE_PROMPT;

    const analysisPromptSnapshot = applyAmbientePromptPlaceholders(analysisPromptRaw, {
      nomeLead: leadName,
      origem: leadOrigin,
      descricao,
      cenaInventario,
    });
    let analysisPromptUsed = analysisPromptSnapshot;

    const sugestoesAnteriores =
      typeof body.analiseTexto === 'string' && body.analiseTexto.trim()
        ? body.analiseTexto.trim()
        : '';

    let analiseTexto = sugestoesAnteriores;

    const hasClientScene =
      Boolean(cenaInventario) || Boolean(sugestoesAnteriores);
    // No "gerar", o inventário da lousa já veio do browser — pular a visão
    // economiza 10–30s e evita estouro de tempo (que disparava um 2º pedido).
    const shouldRunVision = action === 'analyze' || (action === 'render' && !hasClientScene);
    if (action === 'render' && !shouldRunVision) {
      analiseTexto =
        [cenaInventario, sugestoesAnteriores].filter(Boolean).join('\n\n') || analiseTexto;
    }
    if (shouldRunVision) {
      try {
        const inventoryPromptSnapshot = applyAmbientePromptPlaceholders(
          DEFAULT_AMBIENTE_SCENE_INVENTORY_PROMPT,
          {
            nomeLead: leadName,
            origem: leadOrigin,
            descricao,
            cenaInventario,
          },
        );
        const systemPrompt =
          action === 'render' ? inventoryPromptSnapshot : analysisPromptSnapshot;
        analysisPromptUsed = systemPrompt;

        const introParts: string[] = [];
        if (descricao) introParts.push(`Descrição do vendedor:\n${descricao}`);
        if (cenaInventario) {
          introParts.push(`Inventário objetivo da lousa (fonte da verdade das peças):\n${cenaInventario}`);
        }
        if (action === 'render' && sugestoesAnteriores) {
          introParts.push(`Sugestões anteriores (contexto, não substituem a lousa):\n${sugestoesAnteriores}`);
        }
        introParts.push(
          visionImage
            ? 'A IMAGEM 1 é a montagem da lousa (desenhos + móveis posicionados + foto do cômodo, se houver). Retorne apenas o YAML.'
            : 'Não houve imagem da lousa. Use a descrição e o inventário. Retorne apenas o YAML.',
        );

        const userContent: Array<{
          type: string;
          text?: string;
          image_url?: { url: string };
        }> = [{ type: 'text', text: introParts.join('\n\n') }];

        if (visionImage) {
          userContent.push({
            type: 'image_url',
            image_url: {
              url: `data:${visionImage.mime};base64,${bytesToBase64(visionImage.bytes)}`,
            },
          });
        }

        furnitureRefs.forEach((ref, index) => {
          userContent.push({
            type: 'text',
            text: `IMAGEM ${index + 2} — referência fiel do móvel (copiar identicamente): ${ref.label}`,
          });
          userContent.push({
            type: 'image_url',
            image_url: {
              url: `data:${ref.mime};base64,${bytesToBase64(ref.bytes)}`,
            },
          });
        });

        const visaoRes = await chatVisao(
          openAiKey,
          visionModel,
          [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userContent },
          ],
          4096,
        );
        const visao = visaoRes.content;
        await registrarUso(ctx, {
          funcao: 'render_ambiente_analise',
          etapa: 'visao',
          modelo: visionModel,
          leadId,
          usage: visaoRes.usage,
        });

        if (action === 'render' && sugestoesAnteriores) {
          analiseTexto = `${visao}\n\n---\nSugestões anteriores (desmembrar):\n${sugestoesAnteriores}`;
        } else {
          analiseTexto = visao;
        }
      } catch (err) {
        const message = mensagemSegura(err instanceof Error ? err.message : 'Erro na análise do ambiente');
        console.error('render-lead-ambiente vision error:', message);
        if (action === 'analyze') {
          return jsonResponse({ error: message, step: 'vision' }, 502);
        }
        analiseTexto =
          [cenaInventario, sugestoesAnteriores].filter(Boolean).join('\n\n') || analiseTexto;
        if (!analiseTexto.trim()) {
          return jsonResponse({ error: message, step: 'vision' }, 502);
        }
      }
    }

    if (action === 'analyze') {
      return jsonResponse({ analiseTexto });
    }

    const renderPromptSnapshot = appendAmbienteFurnitureFidelity(
      applyAmbientePromptPlaceholders(renderPromptRaw, {
        nomeLead: leadName,
        origem: leadOrigin,
        analise: analiseTexto,
        descricao,
        cenaInventario,
      }),
      {
        cenaInventario,
        furnitureRefCount: furnitureRefs.length,
      },
    );

    const editSource = composition ?? sourceImage;
    let outputBytes: Uint8Array;
    let imagemUsage: OpenAiUsage = null;
    const onUsage = (u: unknown) => {
      imagemUsage = u as OpenAiUsage;
    };
    try {
      if (editSource) {
        outputBytes = await callOpenAIImageEdit(
          openAiKey,
          imageModel,
          editSource.bytes,
          editSource.mime,
          renderPromptSnapshot,
          undefined,
          {
            extraImages: furnitureRefs.map((ref, index) => ({
              bytes: ref.bytes,
              mime: ref.mime,
              filename: `furniture-${index + 1}.${ref.mime.includes('png') ? 'png' : 'jpg'}`,
            })),
            onUsage,
          },
        );
      } else {
        outputBytes = await callOpenAIImageGenerate(openAiKey, imageModel, renderPromptSnapshot, { onUsage });
      }
    } catch (err) {
      const message = mensagemSegura(err instanceof Error ? err.message : 'Erro ao gerar renderização do ambiente');
      console.error('render-lead-ambiente image error:', message, { imageModel });
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
      console.error('Erro ao salvar render de ambiente:', uploadError);
      return jsonResponse({ error: 'Render gerada mas não foi possível salvar no storage' }, 500);
    }

    const { data: publicUrlData } = supabase.storage.from(RENDER_BUCKET).getPublicUrl(storagePath);

    let compositionPublicUrl: string | undefined;
    let compositionPath: string | undefined;
    if (editSource) {
      const antesExt = editSource.mime.includes('png') ? 'png' : 'jpg';
      const antesMime = editSource.mime.includes('png') ? 'image/png' : 'image/jpeg';
      compositionPath = `${empresaId}/${leadId}/${renderId}-antes.${antesExt}`;
      const { error: antesError } = await supabase.storage
        .from(RENDER_BUCKET)
        .upload(compositionPath, editSource.bytes, {
          contentType: antesMime,
          upsert: false,
        });
      if (antesError) {
        console.error('Erro ao salvar composição (antes) do ambiente:', antesError);
      } else {
        compositionPublicUrl = supabase.storage.from(RENDER_BUCKET).getPublicUrl(compositionPath).data
          .publicUrl;
      }
    }

    const inputSnapshot = {
      source: 'anexo' as const,
      id: renderId,
      label: 'Composição de ambiente',
      mode: 'ambiente' as const,
      imageUrl: compositionPublicUrl,
      descricao: descricao || undefined,
      cenaInventario: cenaInventario || undefined,
      furnitureRefCount: furnitureRefs.length,
    };

    await registrarUso(ctx, {
      funcao: 'render_ambiente',
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
        analysis_prompt_snapshot: analysisPromptUsed,
        render_prompt_snapshot: renderPromptSnapshot,
        criado_por: ctx.userId,
      })
      .select('id, criado_em')
      .single();

    if (insertError) {
      console.error('Erro ao salvar histórico de ambiente:', insertError);
      const toRemove = compositionPath ? [storagePath, compositionPath] : [storagePath];
      await supabase.storage.from(RENDER_BUCKET).remove(toRemove);
      return jsonResponse({ error: 'Render gerada mas não foi possível salvar no histórico' }, 500);
    }

    await saveRenderAsLeadAttachment(supabase, db, empresaId, leadId, renderId, outputBytes);

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
