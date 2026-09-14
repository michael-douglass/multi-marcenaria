/**
 * Prepara arquivos do quadro de eventos: imagem (compacta) ou PDF (cada página vira foto).
 */
import { pdfAllPagesToJpegBlobs } from '@/lib/pdf-to-image'
import {
  isLikelyImageFile,
  prepareWhiteboardImageForUpload,
  WHITEBOARD_MAX_IMAGE_BYTES,
} from '@/lib/whiteboard-image-upload'

const PDF_MAX_BYTES = 25 * 1024 * 1024

export function isPdfFile(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
}

export function isAcceptedEventoMidiaFile(file: File): boolean {
  return isPdfFile(file) || isLikelyImageFile(file)
}

/**
 * Devolve uma ou mais imagens prontas para upload.
 * PDF → uma JPEG por página (para desenhar e ver no caderno).
 */
export async function prepareEventoMidiaFiles(file: File): Promise<File[]> {
  if (isPdfFile(file)) {
    if (file.size > PDF_MAX_BYTES) {
      throw new Error('PDF muito grande (máx. 25 MB).')
    }
    const blobs = await pdfAllPagesToJpegBlobs(file)
    if (blobs.length === 0) throw new Error('PDF sem páginas para converter.')
    const base = file.name.replace(/\.pdf$/i, '').trim() || 'documento'
    return blobs.map((blob, i) => {
      if (blob.size > WHITEBOARD_MAX_IMAGE_BYTES) {
        throw new Error(`A página ${i + 1} do PDF ficou grande demais após a conversão.`)
      }
      return new File([blob], `${base}-pagina-${i + 1}.jpg`, {
        type: 'image/jpeg',
        lastModified: Date.now(),
      })
    })
  }

  if (!isLikelyImageFile(file)) {
    throw new Error('Envie uma imagem (JPG, PNG…) ou um PDF.')
  }
  return [await prepareWhiteboardImageForUpload(file)]
}
