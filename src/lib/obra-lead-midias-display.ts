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
  /** Pasta do CRM (`folder_nome`). Vazio = sem pasta. */
  folderNome: string | null
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
      const { pdfUrlAllPagesToObjectUrls, pdfDataAllPagesToPngBlobs } = await import('@/lib/pdf-to-image')
      try {
        return await pdfUrlAllPagesToObjectUrls(fileUrl)
      } catch {
        const bytes = await downloadPdfBytes(fileUrl)
        const blobs = await pdfDataAllPagesToPngBlobs(bytes, { maxPages: 8 })
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

function folderNomeOf(midia: LeadMidia): string | null {
  const t = midia.folder_nome?.trim()
  return t ? t : null
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
    folderNome: folderNomeOf(midia),
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
    folderNome: folderNomeOf(midia),
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
    folderNome: folderNomeOf(midia),
  }
}

/**
 * Expande mídias do lead: imagens 1:1; PDF vira ícone no card
 * (rasterizar todas as páginas no Kanban derrubava o iPhone).
 * Só converte PDF → foto quando `rasterizePdfs` é true (modal).
 */
export async function expandLeadMidiasToDisplayItems(
  midias: LeadMidia[],
  onProgress?: (items: LeadMidiaDisplayItem[]) => void,
  options?: { rasterizePdfs?: boolean },
): Promise<LeadMidiaDisplayItem[]> {
  const images = midias.filter(m => m.tipo !== 'pdf')
  const pdfs = midias.filter(m => m.tipo === 'pdf')

  let items: LeadMidiaDisplayItem[] = images.map(imageItem)
  onProgress?.(items)

  const rasterizePdfs = options?.rasterizePdfs === true

  for (const midia of pdfs) {
    if (!rasterizePdfs) {
      items = [...items, pdfFallbackItem(midia)]
      onProgress?.(items)
      continue
    }
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

/** Agrupa fotos já expandidas pela pasta do CRM. `null` se nenhuma mídia tem pasta. */
export function groupDisplayItemsByFolder(
  items: LeadMidiaDisplayItem[],
): Array<{ pasta: string; items: LeadMidiaDisplayItem[] }> | null {
  const hasFolders = items.some(item => Boolean(item.folderNome))
  if (!hasFolders) return null

  const order: string[] = []
  const map = new Map<string, LeadMidiaDisplayItem[]>()
  for (const item of items) {
    const pasta = item.folderNome?.trim() || 'Sem pasta'
    if (!map.has(pasta)) {
      map.set(pasta, [])
      order.push(pasta)
    }
    map.get(pasta)!.push(item)
  }
  return order.map(pasta => ({ pasta, items: map.get(pasta)! }))
}
