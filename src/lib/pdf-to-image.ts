/**
 * Conversão de PDF → PNG via pdf.js.
 * Usa o build `legacy` porque o build moderno exige Map.getOrInsertComputed
 * (Chrome 145+); sem isso o anexo falha com "getOrInsertComputed is not a function".
 */
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs'

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

const PDF_RENDER_SCALE = 1.5
const MAX_PDF_PAGES = 50
/** No card/lightbox: poucas páginas. 100 PNGs derrubavam o Safari no iPhone. */
const MAX_LEAD_PDF_PAGES = 8

async function renderPdfPageToPngBlob(
  pdf: pdfjs.PDFDocumentProxy,
  pageNumber: number,
): Promise<Blob> {
  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale: PDF_RENDER_SCALE })

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível renderizar o PDF.')

  await page.render({ canvas, canvasContext: ctx, viewport }).promise

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('Falha ao gerar imagem do PDF.'))),
      'image/png',
      0.92,
    )
  })
}

/** Converte todas as páginas do PDF (ArrayBuffer) em PNGs. */
export async function pdfDataAllPagesToPngBlobs(
  data: ArrayBuffer,
  options?: { maxPages?: number },
): Promise<Blob[]> {
  const maxPages = options?.maxPages ?? MAX_PDF_PAGES
  const pdf = await pdfjs.getDocument({ data }).promise
  const pageCount = Math.min(pdf.numPages, maxPages)

  const blobs: Blob[] = []
  for (let page = 1; page <= pageCount; page++) {
    blobs.push(await renderPdfPageToPngBlob(pdf, page))
  }
  return blobs
}

/** Converte todas as páginas do PDF em PNGs para pré-visualização. */
export async function pdfAllPagesToPngBlobs(file: File): Promise<Blob[]> {
  return pdfDataAllPagesToPngBlobs(await file.arrayBuffer())
}

/** Converte a 1ª página do PDF em PNG para pré-visualização. */
export async function pdfFirstPageToPngBlob(file: File): Promise<Blob> {
  const data = await file.arrayBuffer()
  const pdf = await pdfjs.getDocument({ data }).promise
  if (pdf.numPages < 1) throw new Error('PDF vazio.')
  return renderPdfPageToPngBlob(pdf, 1)
}

/**
 * Baixa um PDF pela URL e gera object URLs (blob:) de cada página.
 * Cada página vira uma “foto” navegável no lightbox.
 */
export async function pdfUrlAllPagesToObjectUrls(url: string): Promise<string[]> {
  const res = await fetch(url)
  if (!res.ok) {
    throw new Error(`Não foi possível baixar o PDF (${res.status}).`)
  }
  const blobs = await pdfDataAllPagesToPngBlobs(await res.arrayBuffer(), {
    maxPages: MAX_LEAD_PDF_PAGES,
  })
  return blobs.map(blob => URL.createObjectURL(blob))
}
