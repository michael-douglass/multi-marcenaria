import { useEffect, useMemo, useState } from 'react';
import type { LeadAIMediaItem } from '@/lib/lead-ai-media-sources';
import {
  LEAD_UNFILED_FOLDER_ID,
  countFolderFiles,
  getFolderCoverUrls,
  isAttachmentInLeadFolder,
  isLeadUnfiledFolderId,
} from '@/lib/lead-media-folders';
import { useLeadMediaFolders, type LeadMediaFolder } from '@/hooks/useLeadMediaFolders';

function mediaMatchesSearch(item: LeadAIMediaItem, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return item.label.toLowerCase().includes(q);
}

function itemFolderIdForBrowse(
  item: LeadAIMediaItem,
  leadFolderIds: Set<string>,
): string | null {
  return isAttachmentInLeadFolder(item.folderId, leadFolderIds) ? item.folderId! : null;
}

export function useLeadAIMediaFolderBrowse(
  leadId: number | null | undefined,
  items: LeadAIMediaItem[],
) {
  const { folders, isLoading: foldersLoading } = useLeadMediaFolders(leadId);
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const leadFolderIds = useMemo(
    () => new Set(folders.map((folder) => folder.id)),
    [folders],
  );

  const viewingRoot = currentFolderId === null;
  const viewingUnfiled = isLeadUnfiledFolderId(currentFolderId);
  const currentFolder = folders.find((folder) => folder.id === currentFolderId) ?? null;
  const normalizedSearch = searchQuery.trim();
  const isSearching = normalizedSearch.length > 0;

  const coverSource = useMemo(
    () =>
      items.map((item) => ({
        folder_id: itemFolderIdForBrowse(item, leadFolderIds),
        tipo: item.kind === 'image' ? 'imagem' : item.kind,
        file_url: item.thumbnailUrl ?? item.fileUrl ?? '',
      })).filter((item) => !!item.file_url),
    [items, leadFolderIds],
  );

  const folderCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const folder of folders) {
      map.set(folder.id, countFolderFiles(coverSource, folder.id));
    }
    return map;
  }, [coverSource, folders]);

  const unfiledItems = useMemo(
    () => items.filter((item) => !isAttachmentInLeadFolder(item.folderId, leadFolderIds)),
    [items, leadFolderIds],
  );

  const unfiledCount = unfiledItems.length;
  const hasSavedFolders = folders.length > 0;
  /** Com pastas salvas, a raiz vira prateleira; sem pastas, galeria plana. */
  const usesFolderShelf = hasSavedFolders;

  const itemsInCurrentFolder = useMemo(() => {
    if (viewingRoot) return items;
    if (viewingUnfiled) return unfiledItems;
    return items.filter((item) => item.folderId === currentFolderId);
  }, [currentFolderId, items, unfiledItems, viewingRoot, viewingUnfiled]);

  const visibleItems = useMemo(() => {
    if (isSearching) {
      return items.filter((item) => mediaMatchesSearch(item, normalizedSearch));
    }
    if (!usesFolderShelf || viewingRoot) {
      // Na prateleira a raiz mostra pastas, não arquivos.
      if (usesFolderShelf && viewingRoot) return [];
      return items;
    }
    return itemsInCurrentFolder;
  }, [
    isSearching,
    items,
    itemsInCurrentFolder,
    normalizedSearch,
    usesFolderShelf,
    viewingRoot,
  ]);

  const showFolderShelf = usesFolderShelf && viewingRoot && !isSearching;

  useEffect(() => {
    if (!currentFolderId || isLeadUnfiledFolderId(currentFolderId)) return;
    if (foldersLoading || folders.length === 0) return;
    if (!folders.some((folder) => folder.id === currentFolderId)) {
      setCurrentFolderId(null);
    }
  }, [currentFolderId, folders, foldersLoading]);

  const folderLabel = viewingUnfiled
    ? 'Sem pasta'
    : currentFolder?.nome ?? 'Pasta';

  const openFolder = (folderId: string) => setCurrentFolderId(folderId);
  const openUnfiled = () => setCurrentFolderId(LEAD_UNFILED_FOLDER_ID);
  const goRoot = () => setCurrentFolderId(null);

  return {
    folders: folders as LeadMediaFolder[],
    foldersLoading,
    currentFolderId,
    currentFolder,
    folderLabel,
    searchQuery,
    setSearchQuery,
    isSearching,
    viewingRoot,
    viewingUnfiled,
    usesFolderShelf,
    showFolderShelf,
    visibleItems,
    unfiledCount,
    folderCounts,
    coverSource,
    openFolder,
    openUnfiled,
    goRoot,
  };
}
