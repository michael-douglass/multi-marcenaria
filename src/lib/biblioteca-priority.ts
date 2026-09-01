import type { BibliotecaMedia } from '@/hooks/useBibliotecaMedias'

export interface BibliotecaPastaPin {
  id: string
  nome: string
  descricao: string | null
  lead_id: number | null
  fixado: boolean
  ordem_topo: number | null
}

export function isLojaFolder(folder: Pick<BibliotecaPastaPin, 'lead_id'>): boolean {
  return folder.lead_id == null
}

export function isLeadFolder(folder: Pick<BibliotecaPastaPin, 'lead_id'>): boolean {
  return folder.lead_id != null
}

export function proximaOrdemPinBiblioteca(
  itens: Array<{ ordem_topo: number | null }>,
): number {
  return itens.reduce((acc, item) => Math.max(acc, item.ordem_topo ?? 0), 0) + 1
}

export function ordenarPastasLoja<T extends BibliotecaPastaPin>(folders: T[]): T[] {
  return [...folders].sort((a, b) => {
    if (a.fixado !== b.fixado) return a.fixado ? -1 : 1
    if (a.fixado && b.fixado) return (b.ordem_topo ?? 0) - (a.ordem_topo ?? 0)
    return a.nome.localeCompare(b.nome, 'pt-BR')
  })
}

export function splitPastasBiblioteca<T extends BibliotecaPastaPin>(folders: T[]): {
  loja: T[]
  leads: T[]
  favoritas: T[]
  demaisLoja: T[]
} {
  const loja = ordenarPastasLoja(folders.filter(isLojaFolder))
  const leads = folders.filter(isLeadFolder)
  return {
    loja,
    leads,
    favoritas: loja.filter((folder) => folder.fixado),
    demaisLoja: loja.filter((folder) => !folder.fixado),
  }
}

export function ordenarMidiasVista(medias: BibliotecaMedia[]): BibliotecaMedia[] {
  return [...medias].sort((a, b) => {
    if (a.fixado !== b.fixado) return a.fixado ? -1 : 1
    if (a.fixado && b.fixado) return (b.ordem_topo ?? 0) - (a.ordem_topo ?? 0)
    return new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime()
  })
}

export function capasDaPasta(medias: BibliotecaMedia[], folderId: string): string[] {
  return medias
    .filter((media) => media.folder_id === folderId && media.tipo === 'imagem')
    .slice(0, 3)
    .map((media) => media.file_url)
}

export function primeiraMidiaDaPasta(
  medias: BibliotecaMedia[],
  folderId: string,
): BibliotecaMedia | null {
  return medias.find((media) => media.folder_id === folderId) ?? null
}
