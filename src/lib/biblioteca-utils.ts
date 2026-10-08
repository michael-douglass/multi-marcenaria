import type { BibliotecaMedia } from '@/hooks/useBibliotecaMedias';

/** Limite por arquivo na biblioteca (alinhado ao bucket marketing-medias). */
export const BIBLIOTECA_MAX_FILE_SIZE_BYTES = 250 * 1024 * 1024; // 250 MB
export const BIBLIOTECA_MAX_FILE_SIZE_MB = 250;

export type BibliotecaCategoria = 'todas' | 'imagens' | 'videos' | 'arquivos';

export const BIBLIOTECA_CATEGORIAS: {
  id: BibliotecaCategoria;
  label: string;
  description: string;
}[] = [
  { id: 'todas', label: 'Todas', description: 'Todo o acervo' },
  { id: 'imagens', label: 'Imagens', description: 'Fotos e ilustrações' },
  { id: 'videos', label: 'Vídeos', description: 'Clips e gravações' },
  { id: 'arquivos', label: 'Arquivos', description: 'PDFs, áudios e outros' },
];

export function isBibliotecaArquivo(tipo: BibliotecaMedia['tipo']): boolean {
  return tipo === 'pdf' || tipo === 'audio';
}

export function filterMediasByCategoria(
  medias: BibliotecaMedia[],
  categoria: BibliotecaCategoria,
): BibliotecaMedia[] {
  switch (categoria) {
    case 'imagens':
      return medias.filter((m) => m.tipo === 'imagem');
    case 'videos':
      return medias.filter((m) => m.tipo === 'video');
    case 'arquivos':
      return medias.filter((m) => isBibliotecaArquivo(m.tipo));
    default:
      return medias;
  }
}

export function filterMediasByFolder(
  medias: BibliotecaMedia[],
  folderId: string | null,
): BibliotecaMedia[] {
  if (folderId === null) {
    return medias.filter((m) => m.folder_id === null);
  }
  return medias.filter((m) => m.folder_id === folderId);
}

export function countFolderItems(medias: BibliotecaMedia[], folderId: string): number {
  return medias.filter((m) => m.folder_id === folderId).length;
}

export function countMediasByCategoria(medias: BibliotecaMedia[]): Record<BibliotecaCategoria, number> {
  return {
    todas: medias.length,
    imagens: medias.filter((m) => m.tipo === 'imagem').length,
    videos: medias.filter((m) => m.tipo === 'video').length,
    arquivos: medias.filter((m) => isBibliotecaArquivo(m.tipo)).length,
  };
}

export function getBibliotecaOrigemLabel(origem: BibliotecaMedia['origem']): string {
  switch (origem) {
    case 'lead_whiteboard':
      return 'Lead · Lousa';
    case 'lead_anexo':
      return 'Lead · Anexo';
    default:
      return 'Biblioteca';
  }
}

export function formatBibliotecaFileSize(bytes: number | null): string {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function getBibliotecaFileSizeError(file: File): string | null {
  if (file.size > BIBLIOTECA_MAX_FILE_SIZE_BYTES) {
    return `Arquivo muito grande (máx. ${BIBLIOTECA_MAX_FILE_SIZE_MB} MB)`;
  }
  return null;
}

export function formatBibliotecaDate(iso: string): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}
