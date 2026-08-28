import { supabase } from '@/integrations/supabase/client';
import type { MetadataCapturada } from '@/hooks/useAgenda';
import type { AgendaPublicScope } from '@/lib/agenda-public-scope';
import { validateAgendaFile } from '@/lib/agenda-file-types';
import { preprocessAgendaFormFiles } from '@/lib/agenda-form-file-preprocess';

export interface AgendaPublicUploadedFile {
  url: string;
  name: string;
  mime_type: string;
  size: number;
}

export interface AgendaPublicBookingPayload {
  scope: {
    schema: string | null;
    configId: string;
    agendaSlug: string;
  };
  dados: {
    data_hora_inicio: string;
    convidado_nome: string;
    convidado_whatsapp: string;
    convidado_email?: string | null;
    resposta_formulario?: string;
    metadata_capturada?: MetadataCapturada;
  };
}

export interface AgendaPublicBookingResult {
  reuniao_id: string;
  lead_id: number | null;
}

const BUCKET = 'agenda-form-uploads';

function sanitizePath(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

/** Upload direto no Storage — não usa Edge Function (evita CORS quando a função não está publicada). */
async function uploadSingleAgendaPublicFile(
  file: File,
  scope: AgendaPublicScope,
  configId: string,
  fieldKey: string,
): Promise<AgendaPublicUploadedFile> {
  const validationError = validateAgendaFile(file, null);
  if (validationError) {
    throw new Error(validationError);
  }

  const prefix = scope.schema ? sanitizePath(scope.schema) : 'master';
  const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
  const path = `${prefix}/${configId}/${sanitizePath(fieldKey)}/${crypto.randomUUID()}.${ext}`;

  const contentType = file.type || 'application/octet-stream';

  const { error: uploadError } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType,
    upsert: false,
    cacheControl: '3600',
  });

  if (uploadError) {
    throw new Error(uploadError.message || 'Falha ao enviar arquivo. Tente outro formato ou um arquivo menor.');
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);

  return {
    url: data.publicUrl,
    name: file.name,
    mime_type: contentType,
    size: file.size,
  };
}

/** Converte PDF em imagens e envia cada arquivo resultante. */
export async function uploadAgendaPublicFiles(
  file: File,
  scope: AgendaPublicScope,
  configId: string,
  fieldKey: string,
): Promise<AgendaPublicUploadedFile[]> {
  const prepared = await preprocessAgendaFormFiles([file]);
  return Promise.all(
    prepared.map((item) => uploadSingleAgendaPublicFile(item, scope, configId, fieldKey)),
  );
}

export async function uploadAgendaPublicFile(
  file: File,
  scope: AgendaPublicScope,
  configId: string,
  fieldKey: string,
): Promise<AgendaPublicUploadedFile> {
  const uploaded = await uploadAgendaPublicFiles(file, scope, configId, fieldKey);
  return uploaded[0];
}

/** Cria agendamento + lead via RPC no Postgres (sem Edge Function). */
export async function createAgendaPublicBooking(
  payload: AgendaPublicBookingPayload,
): Promise<AgendaPublicBookingResult> {
  const { data, error } = await supabase.rpc('agenda_public_create_booking', {
    p_schema: payload.scope.schema,
    p_config_id: payload.scope.configId,
    p_agenda_slug: payload.scope.agendaSlug,
    p_dados: {
      data_hora_inicio: payload.dados.data_hora_inicio,
      convidado_nome: payload.dados.convidado_nome,
      convidado_whatsapp: payload.dados.convidado_whatsapp,
      convidado_email: payload.dados.convidado_email ?? null,
      resposta_formulario: payload.dados.resposta_formulario ?? null,
      metadata_capturada: payload.dados.metadata_capturada ?? null,
    },
  });

  if (error) {
    const message =
      typeof error.message === 'string' && error.message.length > 0
        ? error.message
        : 'Falha ao criar agendamento';
    throw new Error(message);
  }

  const result = data as { reuniao_id?: string; lead_id?: number | null } | null;
  if (!result?.reuniao_id) {
    throw new Error('Falha ao criar agendamento');
  }

  return {
    reuniao_id: result.reuniao_id,
    lead_id: result.lead_id ?? null,
  };
}
