/** Pasta virtual para arquivos do lead que ainda não foram organizados. */
export const LEAD_UNFILED_FOLDER_ID = '__unfiled__';

/** Remove espaços extras do nome da pasta. Vazio se não sobrar texto. */
export function normalizeFolderName(nome: string | null | undefined): string {
  return (nome ?? '').trim().replace(/\s+/g, ' ');
}

export function findFolderByName<T extends { nome: string }>(
  folders: T[],
  nome: string | null | undefined,
): T | undefined {
  const normalized = normalizeFolderName(nome).toLowerCase();
  if (!normalized) return undefined;
  return folders.find((folder) => folder.nome.trim().toLowerCase() === normalized);
}

export function isLeadUnfiledFolderId(folderId: string | null | undefined): boolean {
  return folderId === LEAD_UNFILED_FOLDER_ID;
}

export function formatLeadFolderLabel(folderNome: string, leadNome?: string | null): string {
  const pasta = folderNome.trim() || 'Pasta';
  const lead = leadNome?.trim();
  return lead ? `${lead} · ${pasta}` : pasta;
}

export function getFolderCoverUrls(
  items: Array<{ folder_id: string | null; tipo?: string; file_url: string }>,
  folderId: string | null,
  limit = 3,
): string[] {
  return items
    .filter((item) => {
      if (item.tipo && item.tipo !== 'imagem') return false;
      if (folderId === null) return item.folder_id == null;
      return item.folder_id === folderId;
    })
    .slice(0, limit)
    .map((item) => item.file_url);
}

export function isAttachmentInLeadFolder(
  folderId: string | null | undefined,
  leadFolderIds: Set<string>,
): boolean {
  return !!folderId && leadFolderIds.has(folderId);
}

export function countFolderFiles(
  items: Array<{ folder_id: string | null }>,
  folderId: string | null,
): number {
  return items.filter((item) =>
    folderId === null ? item.folder_id == null : item.folder_id === folderId,
  ).length;
}
