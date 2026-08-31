import type { SupabaseClient } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import type { LeadPDF } from '@/hooks/useLeadPDFs';
import type { LeadAIRender } from '@/hooks/useLeadAIRenders';
import type { LeadMidiaDisponivel } from '@/lib/orcamento-slide-types';

export const AI_RENDER_ATTACHMENT_ID_PREFIX = 'ai-render:';

export function aiRenderAttachmentFileName(renderId: string): string {
  return `render-ia-${renderId}.png`;
}

export function aiRenderAttachmentTitle(label: string): string {
  const trimmed = label?.trim() || 'Projeto';
  return `Render IA — ${trimmed}`;
}

export function isAiRenderAttachmentId(id: string): boolean {
  return id.startsWith(AI_RENDER_ATTACHMENT_ID_PREFIX);
}

export function parseRenderIdFromAiAttachmentId(id: string): string | null {
  if (!isAiRenderAttachmentId(id)) return null;
  const renderId = id.slice(AI_RENDER_ATTACHMENT_ID_PREFIX.length);
  return renderId.length > 0 ? renderId : null;
}

export function parseRenderIdFromAttachmentFileName(fileName: string): string | null {
  const match = /^(?:render-ia|render-ambiente)-([0-9a-f-]{36})\.png$/i.exec(fileName.trim());
  return match?.[1] ?? null;
}

export function parseRenderIdFromAttachmentUrl(fileUrl: string): string | null {
  try {
    const pathname = new URL(fileUrl).pathname;
    const fileName = decodeURIComponent(pathname.split('/').pop() ?? '');
    return parseRenderIdFromAttachmentFileName(fileName);
  } catch {
    return null;
  }
}

/** Identifica render IA a partir de id virtual, URL ou nome do arquivo. */
export function resolveAiRenderIdFromAttachment(input: {
  id?: string;
  fileUrl?: string;
  fileName?: string;
}): string | null {
  if (input.id) {
    const fromVirtualId = parseRenderIdFromAiAttachmentId(input.id);
    if (fromVirtualId) return fromVirtualId;
  }
  if (input.fileName) {
    const fromName = parseRenderIdFromAttachmentFileName(input.fileName);
    if (fromName) return fromName;
  }
  if (input.fileUrl) {
    return parseRenderIdFromAttachmentUrl(input.fileUrl);
  }
  return null;
}

export function aiRenderAttachmentId(renderId: string): string {
  return `${AI_RENDER_ATTACHMENT_ID_PREFIX}${renderId}`;
}

/** Verifica se a renderização já foi salva como anexo em marketing_medias. */
export function isAiRenderSyncedToAttachments(
  renderId: string,
  medias: Array<Pick<LeadPDF, 'file_name'>>,
): boolean {
  const expectedName = aiRenderAttachmentFileName(renderId);
  return medias.some((m) => m.file_name === expectedName);
}

/** Renderizações ainda não importadas para marketing_medias (ex.: histórico antigo). */
export function listUnsyncedAiRenders(
  renders: LeadAIRender[],
  medias: LeadPDF[],
): LeadAIRender[] {
  return renders.filter((r) => !isAiRenderSyncedToAttachments(r.id, medias));
}

export function aiRenderToLeadPDF(render: LeadAIRender): LeadPDF {
  return {
    id: aiRenderAttachmentId(render.id),
    titulo: aiRenderAttachmentTitle(render.inputSnapshot.label),
    file_url: render.outputPublicUrl,
    file_name: aiRenderAttachmentFileName(render.id),
    file_size: null,
    lead_id: render.leadId,
    folder_id: null,
    criado_em: render.criadoEm,
    tipo: 'imagem',
    mime_type: 'image/png',
  };
}

export function aiRenderToLeadMidia(render: LeadAIRender): LeadMidiaDisponivel {
  return {
    id: aiRenderAttachmentId(render.id),
    origem: 'lead_ai_render',
    file_url: render.outputPublicUrl,
    file_name: aiRenderAttachmentFileName(render.id),
    criado_em: render.criadoEm,
    preview_label: 'Render IA',
    tipo_arquivo: 'imagem',
    folder_id: null,
  };
}

const MARKETING_STORAGE_BUCKET = 'marketing-medias';

function extractMarketingStoragePath(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl);
    const pathMatch = url.pathname.match(
      /\/storage\/v1\/object\/public\/marketing-medias\/(.+)/,
    );
    return pathMatch ? decodeURIComponent(pathMatch[1]) : null;
  } catch {
    return null;
  }
}

/** Remove o anexo marketing_medias vinculado à renderização (se existir). */
export async function deleteAiRenderAttachment(
  db: SupabaseClient,
  mediasTable: string,
  leadId: number,
  renderId: string,
): Promise<void> {
  const fileName = aiRenderAttachmentFileName(renderId);

  const { data: media, error: selectError } = await db
    .from(mediasTable)
    .select('id, file_url')
    .eq('lead_id', leadId)
    .eq('file_name', fileName)
    .maybeSingle();

  if (selectError || !media) return;

  const storagePath = extractMarketingStoragePath(String(media.file_url ?? ''));
  if (storagePath) {
    await supabase.storage.from(MARKETING_STORAGE_BUCKET).remove([storagePath]);
  }

  await db.from(mediasTable).delete().eq('id', media.id);
}
