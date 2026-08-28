export const AGENDA_FILE_CATEGORIES = ['image', 'video', 'pdf'] as const;

export type AgendaFileCategory = (typeof AGENDA_FILE_CATEGORIES)[number];

export const AGENDA_FILE_CATEGORY_LABELS: Record<AgendaFileCategory, string> = {
  image: 'Fotos / Imagens',
  video: 'Vídeos',
  pdf: 'PDF',
};

export const AGENDA_FILE_ACCEPT: Record<AgendaFileCategory, string> = {
  image: 'image/jpeg,image/png,image/webp,image/gif',
  video: 'video/mp4,video/webm,video/quicktime',
  pdf: 'application/pdf',
};

export const AGENDA_FILE_MAX_BYTES: Record<AgendaFileCategory, number> = {
  image: 10 * 1024 * 1024,
  /** Vídeos sem limite de tamanho no agendamento público */
  video: Number.POSITIVE_INFINITY,
  pdf: 25 * 1024 * 1024,
};

export function getAgendaFileCategory(mimeType: string): AgendaFileCategory | null {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType === 'application/pdf') return 'pdf';
  return null;
}

export function buildAcceptFromCategories(categories: string[] | null | undefined): string {
  const allowed = (categories ?? AGENDA_FILE_CATEGORIES).filter((c): c is AgendaFileCategory =>
    AGENDA_FILE_CATEGORIES.includes(c as AgendaFileCategory),
  );
  if (allowed.length === 0) {
    return Object.values(AGENDA_FILE_ACCEPT).join(',');
  }
  return allowed.map((category) => AGENDA_FILE_ACCEPT[category]).join(',');
}

export function validateAgendaFile(file: File, allowedCategories: string[] | null | undefined): string | null {
  const category = getAgendaFileCategory(file.type);
  if (!category) {
    return 'Tipo de arquivo não permitido. Use fotos, vídeos ou PDF.';
  }

  const allowed = allowedCategories?.length ? allowedCategories : [...AGENDA_FILE_CATEGORIES];
  if (!allowed.includes(category)) {
    return `Este campo não aceita ${AGENDA_FILE_CATEGORY_LABELS[category].toLowerCase()}.`;
  }

  if (file.size > AGENDA_FILE_MAX_BYTES[category]) {
    if (category === 'video') return null;
    const maxMb = Math.round(AGENDA_FILE_MAX_BYTES[category] / (1024 * 1024));
    return `Arquivo muito grande (máx. ${maxMb}MB).`;
  }

  return null;
}
