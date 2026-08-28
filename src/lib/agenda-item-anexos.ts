import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { extractStoragePathFromPublicUrl } from '@/lib/attachment-files';
import { dataUrlToFile, pdfFileToImageFiles } from '@/lib/contrato-anexo-upload';

export const AGENDA_ITEM_ANEXOS_BUCKET = 'agenda-item-anexos';
export const AGENDA_ITEM_ANEXO_MAX_COUNT = 12;
export const AGENDA_ITEM_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const AGENDA_ITEM_PDF_MAX_BYTES = 25 * 1024 * 1024;

export type AgendaItemAnexoKind = 'image' | 'pdf-page';
export type AgendaItemAnexosScope = 'lembretes' | 'tarefas-pessoais';
export type AgendaItemAnexosAccept = 'images' | 'images-and-pdfs';

export interface AgendaItemAnexo {
  id: string;
  url: string;
  name: string;
  mime_type: string;
  size: number;
  kind: AgendaItemAnexoKind;
  source_name?: string;
  page?: number;
  created_at: string;
}

const anexoSchema = z.object({
  id: z.string().min(1),
  url: z.string().min(1),
  name: z.string().min(1),
  mime_type: z.string().min(1),
  size: z.number().nonnegative(),
  kind: z.enum(['image', 'pdf-page']),
  source_name: z.string().optional(),
  page: z.number().int().positive().optional(),
  created_at: z.string().min(1),
});

export function parseAgendaItemAnexos(raw: unknown): AgendaItemAnexo[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((item) => {
    const parsed = anexoSchema.safeParse(item);
    return parsed.success ? [parsed.data] : [];
  });
}

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

export function isImageFile(file: File): boolean {
  if (file.type.startsWith('image/')) return true;
  return /\.(jpe?g|png|webp|gif)$/i.test(file.name);
}

export function validateAgendaItemFile(
  file: File,
  accept: AgendaItemAnexosAccept,
): string | null {
  if (isPdfFile(file)) {
    if (accept !== 'images-and-pdfs') {
      return 'Neste lembrete só entram fotos. PDF fica na agenda pessoal.';
    }
    if (file.size > AGENDA_ITEM_PDF_MAX_BYTES) {
      return 'PDF muito grande (máx. 25MB).';
    }
    return null;
  }

  if (!isImageFile(file)) {
    return accept === 'images-and-pdfs'
      ? 'Use fotos (JPG, PNG, WebP, GIF) ou PDF.'
      : 'Use fotos (JPG, PNG, WebP ou GIF).';
  }

  if (file.size > AGENDA_ITEM_IMAGE_MAX_BYTES) {
    return 'Foto muito grande (máx. 10MB).';
  }

  return null;
}

function fileExtension(file: File): string {
  const fromName = file.name.includes('.') ? file.name.split('.').pop() : null;
  if (fromName) return fromName.toLowerCase();
  if (file.type === 'image/png') return 'png';
  if (file.type === 'image/webp') return 'webp';
  if (file.type === 'image/gif') return 'gif';
  if (file.type === 'application/pdf') return 'pdf';
  return 'jpg';
}

export async function convertPdfToImageFiles(file: File): Promise<File[]> {
  return pdfFileToImageFiles(file);
}

export async function uploadAgendaItemFile(input: {
  file: File;
  scope: AgendaItemAnexosScope;
  entityId: string;
  userId: string;
  kind: AgendaItemAnexoKind;
  sourceName?: string;
  page?: number;
}): Promise<AgendaItemAnexo> {
  const ext = fileExtension(input.file);
  const storageName = `${crypto.randomUUID()}.${ext}`;
  const path = `${input.scope}/${input.userId}/${input.entityId}/${storageName}`;

  const { error } = await supabase.storage.from(AGENDA_ITEM_ANEXOS_BUCKET).upload(path, input.file, {
    contentType: input.file.type || 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;

  const {
    data: { publicUrl },
  } = supabase.storage.from(AGENDA_ITEM_ANEXOS_BUCKET).getPublicUrl(path);

  return {
    id: crypto.randomUUID(),
    url: publicUrl,
    name: input.file.name,
    mime_type: input.file.type || 'image/jpeg',
    size: input.file.size,
    kind: input.kind,
    source_name: input.sourceName,
    page: input.page,
    created_at: new Date().toISOString(),
  };
}

export async function deleteAgendaItemAnexosFromStorage(
  anexos: AgendaItemAnexo[],
): Promise<void> {
  const paths = anexos
    .map((anexo) => extractStoragePathFromPublicUrl(anexo.url, AGENDA_ITEM_ANEXOS_BUCKET))
    .filter((path): path is string => !!path);
  if (paths.length === 0) return;
  await supabase.storage.from(AGENDA_ITEM_ANEXOS_BUCKET).remove(paths);
}

export function dataUrlToPreviewFile(dataUrl: string, name: string): File {
  return dataUrlToFile(dataUrl, name);
}
