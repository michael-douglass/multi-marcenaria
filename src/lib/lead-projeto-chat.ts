import { supabase } from '@/integrations/supabase/client';
import type { QueryClient } from '@tanstack/react-query';
import {
  isSchemaApiExposed,
  resolveMarketingMediasConfig,
} from '@/lib/empresa-tables';
import { bumpLeadKnowledgeReindex } from '@/lib/lead-knowledge-reindex';
import { isAutorDoAtelie, type AppUserRole } from '@/lib/app-roles';
import {
  LEAD_CHAT_FOLDER_NAME,
  MAX_CHAT_MENSAGEM,
  MAX_IMAGEM_ENVIO_BYTES,
} from '@/lib/projetos-atelie';

const STORAGE_BUCKET = 'marketing-medias';
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export { LEAD_CHAT_FOLDER_NAME };

export interface LeadProjetoChatUpload {
  url: string;
  fileName: string;
  mimeType: string;
}

function marketingDb(schema: string | null) {
  return schema && isSchemaApiExposed(schema) ? supabase.schema(schema) : supabase;
}

export function isImagemPermitidaNoAtelie(file: File): boolean {
  if (file.size > MAX_IMAGEM_ENVIO_BYTES) return false;
  if (IMAGE_TYPES.has(file.type)) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(file.name);
}

export function mensagemChatValida(texto: string, temImagem: boolean): boolean {
  const trimmed = texto.trim();
  if (trimmed.length > MAX_CHAT_MENSAGEM) return false;
  return trimmed.length > 0 || temImagem;
}

export function isBolhaDoAtelie(roles: readonly AppUserRole[] | null | undefined): boolean {
  return isAutorDoAtelie(roles);
}

export async function getOrCreateLeadChatFolder(
  schemaNome: string | null | undefined,
  leadId: number,
): Promise<string> {
  const config = resolveMarketingMediasConfig(schemaNome);
  const db = marketingDb(config.schema);

  const { data: existing } = await db
    .from(config.foldersTable)
    .select('id')
    .eq('nome', LEAD_CHAT_FOLDER_NAME)
    .eq('lead_id', leadId)
    .maybeSingle();

  if (existing?.id) return String(existing.id);

  const { data: byName } = await db
    .from(config.foldersTable)
    .select('id, lead_id')
    .eq('nome', LEAD_CHAT_FOLDER_NAME)
    .is('lead_id', null)
    .maybeSingle();

  if (byName?.id) {
    await db
      .from(config.foldersTable)
      .update({ lead_id: leadId })
      .eq('id', byName.id);
    return String(byName.id);
  }

  const { data: created, error } = await db
    .from(config.foldersTable)
    .insert({
      nome: LEAD_CHAT_FOLDER_NAME,
      descricao: `Canal do ateliê — lead ${leadId}`,
      lead_id: leadId,
    })
    .select('id')
    .single();

  if (error) {
    const { data: existingByName } = await db
      .from(config.foldersTable)
      .select('id')
      .eq('nome', LEAD_CHAT_FOLDER_NAME)
      .maybeSingle()
    if (existingByName?.id) return String(existingByName.id)
    throw error
  };
  return String(created.id);
}

export async function uploadLeadProjetoChatImage(input: {
  file: File;
  leadId: number;
  schemaEmpresa: string | null;
  queryClient?: QueryClient;
}): Promise<LeadProjetoChatUpload> {
  if (!isImagemPermitidaNoAtelie(input.file)) {
    throw new Error('Use JPG, PNG, WebP ou GIF de até 20 MB.');
  }

  const folderId = await getOrCreateLeadChatFolder(input.schemaEmpresa, input.leadId);
  const config = resolveMarketingMediasConfig(input.schemaEmpresa);
  const db = marketingDb(config.schema);
  const ext = (input.file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
  const prefix = config.schema ?? 'master';
  const path = `${prefix}/chat/${input.leadId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;

  const { error: uploadError } = await supabase.storage.from(STORAGE_BUCKET).upload(path, input.file, {
    contentType: input.file.type || `image/${ext}`,
    upsert: false,
  });
  if (uploadError) throw uploadError;

  const {
    data: { publicUrl },
  } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);

  const { error: insertError } = await db.from(config.mediasTable).insert({
    titulo: input.file.name,
    tipo: 'imagem',
    file_url: publicUrl,
    file_name: input.file.name,
    file_size: input.file.size,
    mime_type: input.file.type || `image/${ext}`,
    folder_id: folderId,
    lead_id: input.leadId,
  });
  if (insertError) throw insertError;

  if (input.queryClient) {
    bumpLeadKnowledgeReindex(input.queryClient, input.schemaEmpresa, input.leadId);
    input.queryClient.invalidateQueries({ queryKey: ['marketing-medias'] });
    input.queryClient.invalidateQueries({ queryKey: ['biblioteca-medias'] });
  }

  return {
    url: publicUrl,
    fileName: input.file.name,
    mimeType: input.file.type || `image/${ext}`,
  };
}
