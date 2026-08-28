/** Metadados de arquivo enviado pelo formulário público da agenda. */
export interface AgendaFormUploadedFile {
  url: string;
  name: string;
  mime_type: string;
  size: number;
}

export type AgendaFormMediaTipo = 'pdf' | 'imagem' | 'video';

export function parseAgendaFormUploadValue(raw: unknown): AgendaFormUploadedFile | null {
  if (raw === null || raw === undefined) return null;

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('{')) return null;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;

  const record = parsed as Record<string, unknown>;
  const url = typeof record.url === 'string' ? record.url.trim() : '';
  if (!url.startsWith('http')) return null;

  return {
    url,
    name: typeof record.name === 'string' && record.name.trim() ? record.name.trim() : 'Anexo',
    mime_type:
      typeof record.mime_type === 'string' && record.mime_type.trim()
        ? record.mime_type.trim()
        : 'application/octet-stream',
    size: typeof record.size === 'number' && record.size >= 0 ? record.size : 0,
  };
}

/** Um ou vários arquivos salvos no mesmo campo (array JSON ou objeto único legado). */
export function parseAgendaFormUploadFieldValue(raw: unknown): AgendaFormUploadedFile[] {
  if (raw === null || raw === undefined) return [];

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return [];
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }

  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => parseAgendaFormUploadValue(item))
      .filter((item): item is AgendaFormUploadedFile => item !== null);
  }

  const single = parseAgendaFormUploadValue(parsed);
  return single ? [single] : [];
}

export function serializeAgendaFormUploadFieldValue(files: AgendaFormUploadedFile[]): string {
  if (files.length === 1) return JSON.stringify(files[0]);
  return JSON.stringify(files);
}

export function extractAgendaFormUploads(
  respostaFormulario: string | null | undefined,
): AgendaFormUploadedFile[] {
  if (!respostaFormulario?.trim()) return [];

  try {
    const parsed = JSON.parse(respostaFormulario) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return [];

    const uploads: AgendaFormUploadedFile[] = [];
    for (const value of Object.values(parsed)) {
      uploads.push(...parseAgendaFormUploadFieldValue(value));
    }
    return uploads;
  } catch {
    return [];
  }
}

export function agendaMimeToMediaTipo(mimeType: string): AgendaFormMediaTipo | null {
  const mime = mimeType.toLowerCase();
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'imagem';
  if (mime.startsWith('video/')) return 'video';
  return null;
}
