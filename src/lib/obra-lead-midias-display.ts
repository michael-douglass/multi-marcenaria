import { pdfUrlAllPagesToObjectUrls } from '@/lib/pdf-to-image'
import { supabase } from '@/lib/supabase'
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

const MARKETING_PUBLIC = '/storage/v1/object/public/marketing-medias/'

function marketingMediasStoragePath(fileUrl: string): string | null {
  const idx = fileUrl.indexOf(MARKETING_PUBLIC)
  if (idx < 0) return null
  return decodeURIComponent(fileUrl.slice(idx + MARKETING_PUBLIC.length).split('?')[0] ?? '')
}

async function downloadPdfBytes(fileUrl: string): Promise<ArrayBuffer> {
  try {
    const res = await fetch(fileUrl)
    if (res.ok) return res.arrayBuffer()
  } catch {
    // CORS ou rede — tenta via Storage API
  }

  const path = marketingMediasStoragePath(fileUrl)
  if (!path) throw new Error('Não foi possível localizar o PDF no Storage.')

  const { data, error } = await supabase.storage.from('marketing-medias').download(path)
  if (error || !data) {
    throw new Error(error?.message ?? 'Falha ao baixar PDF do Storage.')
  }
  return data.arrayBuffer()
}

export function getCachedPdfPageUrls(fileUrl: string): Promise<string[]> {
  let pending = pdfPagesCache.get(fileUrl)
  if (!pending) {
    pending = (async () => {
      try {
        return await pdfUrlAllPagesToObjectUrls(fileUrl)
      } catch {
        const { pdfDataAllPagesToPngBlobs } = await import('@/lib/pdf-to-image')
        const bytes = await downloadPdfBytes(fileUrl)
        const blobs = await pdfDataAllPagesToPngBlobs(bytes, { maxPages: 100 })
        return blobs.map(blob => URL.createObjectURL(blob))
      }
    })().catch(err => {
      pdfPagesCache.delete(fileUrl)
      throw err
    })
    pdfPagesCache.set(fileUrl, pending)
  }
  return pending
}

function imageItem(midia: LeadMidia): LeadMidiaDisplayItem {
  return {
    key: midia.id,
    title: midia.titulo,
    thumbUrl: midia.file_url,
    galleryPages: [midia.file_url],
    galleryIndex: 0,
    kind: 'image',
    sourceMidiaId: midia.id,
  }
}

function pdfPageItems(midia: LeadMidia, pages: string[]): LeadMidiaDisplayItem[] {
  return pages.map((pageUrl, i) => ({
    key: `${midia.id}-p${i + 1}`,
    title: `${midia.titulo} · pág. ${i + 1}/${pages.length}`,
    thumbUrl: pageUrl,
    galleryPages: pages,
    galleryIndex: i,
    kind: 'pdf' as const,
    sourceMidiaId: midia.id,
  }))
}

function pdfFallbackItem(midia: LeadMidia): LeadMidiaDisplayItem {
  return {
    key: midia.id,
    title: midia.titulo,
    thumbUrl: '',
    galleryPages: [midia.file_url],
    galleryIndex: 0,
    kind: 'pdf',
    sourceMidiaId: midia.id,
  }
}

/**
 * Expande mídias do lead: imagens 1:1; cada PDF vira N fotos (1 por página).
 * Chama `onProgress` a cada PDF convertido para a UI ir atualizando.
 */
export async function expandLeadMidiasToDisplayItems(
  midias: LeadMidia[],
  onProgress?: (items: LeadMidiaDisplayItem[]) => void,
): Promise<LeadMidiaDisplayItem[]> {
  const images = midias.filter(m => m.tipo !== 'pdf')
  const pdfs = midias.filter(m => m.tipo === 'pdf')

  let items: LeadMidiaDisplayItem[] = images.map(imageItem)
  onProgress?.(items)

  for (const midia of pdfs) {
    try {
      const pages = await getCachedPdfPageUrls(midia.file_url)
      if (pages.length === 0) continue
      items = [...items, ...pdfPageItems(midia, pages)]
    } catch {
      items = [...items, pdfFallbackItem(midia)]
    }
    onProgress?.(items)
  }

  return items
}
