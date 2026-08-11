import { pdfUrlAllPagesToObjectUrls } from '@/lib/pdf-to-image'
import type { LeadMidia } from '@/types'

/** Item exibido no card: foto normal ou página de PDF convertida em imagem. */
export interface LeadMidiaDisplayItem {
  key: string
  title: string
  thumbUrl: string
  /** Galeria do lightbox (1 foto ou N páginas do mesmo PDF). */
  galleryPages: string[]
  galleryIndex: number
  kind: 'image' | 'pdf'
  sourceMidiaId: string
}

const pdfPagesCache = new Map<string, Promise<string[]>>()

export function getCachedPdfPageUrls(fileUrl: string): Promise<string[]> {
  let pending = pdfPagesCache.get(fileUrl)
  if (!pending) {
    pending = pdfUrlAllPagesToObjectUrls(fileUrl).catch(err => {
      pdfPagesCache.delete(fileUrl)
      throw err
    })
    pdfPagesCache.set(fileUrl, pending)
  }
  return pending
}

/**
 * Expande mídias do lead: imagens ficam 1:1; cada PDF vira N fotos (1 por página).
 */
export async function expandLeadMidiasToDisplayItems(
  midias: LeadMidia[],
): Promise<LeadMidiaDisplayItem[]> {
  const items: LeadMidiaDisplayItem[] = []

  for (const midia of midias) {
    if (midia.tipo !== 'pdf') {
      items.push({
        key: midia.id,
        title: midia.titulo,
        thumbUrl: midia.file_url,
        galleryPages: [midia.file_url],
        galleryIndex: 0,
        kind: 'image',
        sourceMidiaId: midia.id,
      })
      continue
    }

    try {
      const pages = await getCachedPdfPageUrls(midia.file_url)
      if (pages.length === 0) continue
      for (let i = 0; i < pages.length; i++) {
        items.push({
          key: `${midia.id}-p${i + 1}`,
          title: `${midia.titulo} · pág. ${i + 1}/${pages.length}`,
          thumbUrl: pages[i]!,
          galleryPages: pages,
          galleryIndex: i,
          kind: 'pdf',
          sourceMidiaId: midia.id,
        })
      }
    } catch {
      // Se a conversão falhar, mantém um atalho para o PDF original.
      items.push({
        key: midia.id,
        title: midia.titulo,
        thumbUrl: '',
        galleryPages: [midia.file_url],
        galleryIndex: 0,
        kind: 'pdf',
        sourceMidiaId: midia.id,
      })
    }
  }

  return items
}
