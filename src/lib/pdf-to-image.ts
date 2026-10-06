/**
 * Conversão de PDF → imagem via pdf.js.
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
/** JPEG de documentos (menor que PNG; fundo branco evita página preta). */
const PDF_JPEG_QUALITY = 0.85
const PDF_JPEG_MAX_EDGE = 2000
/** Pipeline Orçamentos IA: JPEG mais leve para não travar PDFs grandes. */
export const ORCAMENTOS_IA_JPEG_MAX_EDGE = 1600
export const ORCAMENTOS_IA_JPEG_QUALITY = 0.82
/** No card/lightbox: poucas páginas. 100 PNGs derrubavam o Safari no iPhone. */
const MAX_LEAD_PDF_PAGES = 8

interface RenderPdfPageOptions {
  mime?: 'image/png' | 'image/jpeg'
  quality?: number
  maxEdge?: number
  fillWhite?: boolean
}

async function renderPdfPageToBlob(
  pdf: pdfjs.PDFDocumentProxy,
  pageNumber: number,
  options: RenderPdfPageOptions = {},
): Promise<Blob> {
  const mime = options.mime ?? 'image/png'
  const quality = options.quality ?? (mime === 'image/jpeg' ? PDF_JPEG_QUALITY : 0.92)
  const page = await pdf.getPage(pageNumber)
  let viewport = page.getViewport({ scale: PDF_RENDER_SCALE })
  const maxEdge = options.maxEdge
  if (maxEdge && Math.max(viewport.width, viewport.height) > maxEdge) {
    const scale = PDF_RENDER_SCALE * (maxEdge / Math.max(viewport.width, viewport.height))
    viewport = page.getViewport({ scale })
  }

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível renderizar o PDF.')

  if (options.fillWhite || mime === 'image/jpeg') {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  await page.render({ canvas, canvasContext: ctx, viewport }).promise

  // Libera a página do worker o quanto antes (menos memória em PDFs longos).
  page.cleanup()

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        canvas.width = 0
        canvas.height = 0
        if (blob) resolve(blob)
        else reject(new Error('Falha ao gerar imagem do PDF.'))
      },
      mime,
      quality,
    )
  })
}

async function renderPdfPageToPngBlob(
  pdf: pdfjs.PDFDocumentProxy,
  pageNumber: number,
): Promise<Blob> {
  return renderPdfPageToBlob(pdf, pageNumber, { mime: 'image/png' })
}

/** Converte todas as páginas do PDF (ArrayBuffer) em PNGs. */
export async function pdfDataAllPagesToPngBlobs(
  data: ArrayBuffer,
  options?: { maxPages?: number },
): Promise<Blob[]> {
  const maxPages = options?.maxPages ?? MAX_PDF_PAGES
  const bytes = new Uint8Array(data.slice(0))
  const pdf = await pdfjs.getDocument({
    data: bytes,
    disableFontFace: true,
    useSystemFonts: true,
  }).promise
  const pageCount = Math.min(pdf.numPages, maxPages)

  const blobs: Blob[] = []
  for (let page = 1; page <= pageCount; page++) {
    blobs.push(await renderPdfPageToPngBlob(pdf, page))
  }
  return blobs
}

export interface PdfPageJpegResult {
  pageNumber: number
  totalPages: number
  blob: Blob
}

/**
 * Converte o PDF página a página em JPEG (sem acumular tudo na memória).
 * Usado pelo pipeline de Orçamentos IA — progresso + menos risco de travar a aba.
 */
export async function convertPdfPagesToJpegSequential(
  data: ArrayBuffer,
  options: {
    maxPages?: number
    maxEdge?: number
    quality?: number
    /** Timeout por página (ms). Padrão 120s. */
    pageTimeoutMs?: number
    /** Timeout para abrir o PDF (ms). Padrão 3 min (PDFs CAD/HelloMob podem demorar). */
    openTimeoutMs?: number
    onPage: (page: PdfPageJpegResult) => void | Promise<void>
  },
): Promise<{ totalPages: number; converted: number }> {
  const maxPages = options.maxPages ?? MAX_PDF_PAGES
  const pageTimeoutMs = options.pageTimeoutMs ?? 120_000
  const openTimeoutMs = options.openTimeoutMs ?? 180_000

  const withTimeout = async <T,>(promise: Promise<T>, ms: number, message: string): Promise<T> => {
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      return await Promise.race([
        promise,
        new Promise<T>((_, reject) => {
          timer = setTimeout(() => reject(new Error(message)), ms)
        }),
      ])
    } finally {
      if (timer) clearTimeout(timer)
    }
  }

  let pdf: pdfjs.PDFDocumentProxy
  try {
    // pdf.js 5.x exige Uint8Array (ArrayBuffer puro pode travar o worker no browser).
    const bytes = new Uint8Array(data.slice(0))
    pdf = await withTimeout(
      pdfjs.getDocument({
        data: bytes,
        // PDFs de detalhamento (AutoCAD/HelloMob) abrem mais estáveis assim no browser.
        disableFontFace: true,
        useSystemFonts: true,
        verbosity: 0,
      }).promise,
      openTimeoutMs,
      'O PDF demorou demais para abrir. Tente um arquivo menor ou sem senha/proteção.',
    )
  } catch (err) {
    const message =
      err instanceof Error
        ? err.message
        : 'Não foi possível ler este PDF. Se estiver protegido por senha, exporte sem senha e envie de novo.'
    throw new Error(message)
  }

  if (pdf.numPages < 1) {
    await pdf.destroy()
    throw new Error('PDF vazio.')
  }

  const totalPages = Math.min(pdf.numPages, maxPages)
  let converted = 0

  try {
    for (let pageNumber = 1; pageNumber <= totalPages; pageNumber++) {
      const blob = await withTimeout(
        renderPdfPageToBlob(pdf, pageNumber, {
          mime: 'image/jpeg',
          quality: options.quality ?? ORCAMENTOS_IA_JPEG_QUALITY,
          maxEdge: options.maxEdge ?? ORCAMENTOS_IA_JPEG_MAX_EDGE,
          fillWhite: true,
        }),
        pageTimeoutMs,
        `A conversão da página ${pageNumber} demorou demais e foi interrompida. Tente um PDF menor ou menos pesado.`,
      )
      converted += 1
      await options.onPage({ pageNumber, totalPages, blob })
    }
  } finally {
    await pdf.destroy()
  }

  return { totalPages, converted }
}

/**
 * Converte cada página do PDF em JPEG (uma imagem por página).
 * Se o PDF tiver mais páginas que o teto, avisa em vez de cortar em silêncio.
 */
export async function pdfAllPagesToJpegBlobs(
  file: File,
  options?: { maxPages?: number },
): Promise<Blob[]> {
  const maxPages = options?.maxPages ?? MAX_PDF_PAGES
  let pdf: pdfjs.PDFDocumentProxy
  try {
    const bytes = new Uint8Array(await file.arrayBuffer())
    pdf = await pdfjs.getDocument({
      data: bytes,
      disableFontFace: true,
      useSystemFonts: true,
    }).promise
  } catch {
    throw new Error(
      'Não foi possível ler este PDF. Se estiver protegido por senha, exporte sem senha e envie de novo.',
    )
  }
  if (pdf.numPages < 1) throw new Error('PDF vazio.')
  if (pdf.numPages > maxPages) {
    throw new Error(
      `Este PDF tem ${pdf.numPages} páginas. Envie um arquivo com até ${maxPages} páginas.`,
    )
  }

  const blobs: Blob[] = []
  for (let page = 1; page <= pdf.numPages; page++) {
    blobs.push(
      await renderPdfPageToBlob(pdf, page, {
        mime: 'image/jpeg',
        quality: PDF_JPEG_QUALITY,
        maxEdge: PDF_JPEG_MAX_EDGE,
        fillWhite: true,
      }),
    )
  }
  return blobs
}

/** Converte todas as páginas do PDF em PNGs para pré-visualização. */
export async function pdfAllPagesToPngBlobs(file: File): Promise<Blob[]> {
  return pdfDataAllPagesToPngBlobs(await file.arrayBuffer())
}

/** Converte a 1ª página do PDF em PNG para pré-visualização. */
export async function pdfFirstPageToPngBlob(file: File): Promise<Blob> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const pdf = await pdfjs.getDocument({
    data: bytes,
    disableFontFace: true,
    useSystemFonts: true,
  }).promise
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
  return blobs.map((blob) => URL.createObjectURL(blob))
}
