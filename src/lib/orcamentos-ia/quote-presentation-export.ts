/**
 * Exporta a proposta apresentável em PDF ou JPG com download automático.
 * Renderiza o HTML de impressão num iframe fora do modal (evita bug do html2canvas com transform).
 */

import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import {
  buildQuotePresentationBodyHtml,
  QUOTE_PRESENTATION_CSS,
} from '@/lib/orcamentos-ia/quote-presentation-print'
import type { QuotePresentationLayout } from '@/lib/orcamentos-ia/quote-presentation'

export type QuotePresentationExportFormat = 'pdf' | 'jpg'

const A4_W_MM = 210
const A4_H_MM = 297
const MARGIN_MM = 6
const EXPORT_SCALE = 2
const JPEG_QUALITY = 0.92
const SHEET_WIDTH_PX = 794 // ~210mm @ 96dpi

function safeFileBase(title: string): string {
  const raw = String(title || 'proposta')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\w\s.-]+/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 60)
  return raw || 'proposta'
}

function fileNameFor(layout: QuotePresentationLayout, ext: 'pdf' | 'jpg'): string {
  const d = new Date()
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`
  return `proposta-${safeFileBase(layout.projectTitle)}-${stamp}.${ext}`
}

function triggerDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = fileName
  link.rel = 'noopener'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000)
}

function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'))
  if (!imgs.length) return Promise.resolve()
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve()
            return
          }
          const done = () => resolve()
          img.addEventListener('load', done, { once: true })
          img.addEventListener('error', done, { once: true })
        }),
    ),
  ).then(() => undefined)
}

/** Converte URL remota em data URL para o canvas não perder a foto (CORS). */
async function embedImageSrc(src: string): Promise<string> {
  const url = src.trim()
  if (!url || url.startsWith('data:')) return url
  try {
    const res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-cache' })
    if (!res.ok) return url
    const blob = await res.blob()
    const bitmap = await createImageBitmap(blob)
    const maxSide = 1600
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height))
    const w = Math.max(1, Math.round(bitmap.width * scale))
    const h = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      bitmap.close()
      return url
    }
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(bitmap, 0, 0, w, h)
    bitmap.close()
    return canvas.toDataURL('image/jpeg', 0.88)
  } catch {
    return url
  }
}

async function embedAllImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'))
  await Promise.all(
    imgs.map(async (img) => {
      const src = img.getAttribute('src') || ''
      if (!src) return
      const embedded = await embedImageSrc(src)
      if (embedded !== src) img.setAttribute('src', embedded)
    }),
  )
  await waitForImages(root)
}

function buildCaptureHtml(layout: QuotePresentationLayout): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@500;600;700&display=swap" rel="stylesheet" />
  <style>
    ${QUOTE_PRESENTATION_CSS}
    html, body {
      margin: 0;
      padding: 0;
      background: #ffffff;
    }
    body { padding: 0; }
    .qp-sheet { width: ${SHEET_WIDTH_PX}px; max-width: ${SHEET_WIDTH_PX}px; margin: 0; }
  </style>
</head>
<body>
  ${buildQuotePresentationBodyHtml(layout)}
</body>
</html>`
}

async function renderSheetCanvas(layout: QuotePresentationLayout): Promise<HTMLCanvasElement> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText = [
    'position:fixed',
    `left:-${SHEET_WIDTH_PX + 80}px`,
    'top:0',
    `width:${SHEET_WIDTH_PX}px`,
    'height:2400px',
    'border:none',
    'opacity:0',
    'pointer-events:none',
    'z-index:-1',
  ].join(';')
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) {
    iframe.remove()
    throw new Error('Não foi possível preparar a captura da proposta.')
  }

  doc.open()
  doc.write(buildCaptureHtml(layout))
  doc.close()

  await new Promise((r) => setTimeout(r, 160))

  const sheet = doc.querySelector('.qp-sheet') as HTMLElement | null
  if (!sheet) {
    iframe.remove()
    throw new Error('Folha da proposta não encontrada para exportar.')
  }

  try {
    await embedAllImages(sheet)
    // Ajusta altura do iframe ao conteúdo real
    const fullH = Math.max(sheet.scrollHeight, sheet.offsetHeight, 800)
    iframe.style.height = `${fullH + 40}px`

    const canvas = await html2canvas(sheet, {
      scale: EXPORT_SCALE,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#ffffff',
      width: sheet.scrollWidth,
      height: fullH,
      windowWidth: sheet.scrollWidth,
      windowHeight: fullH,
      logging: false,
    })
    return canvas
  } finally {
    iframe.remove()
  }
}

async function downloadAsJpg(canvas: HTMLCanvasElement, fileName: string): Promise<void> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falha ao gerar JPG.'))),
      'image/jpeg',
      JPEG_QUALITY,
    )
  })
  triggerDownload(blob, fileName)
}

async function downloadAsPdf(canvas: HTMLCanvasElement, fileName: string): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = A4_W_MM
  const pageH = A4_H_MM
  const imgWmm = pageW - MARGIN_MM * 2
  const usableHmm = pageH - MARGIN_MM * 2
  const pxPerMm = canvas.width / imgWmm
  const pageHeightPx = Math.max(1, Math.floor(usableHmm * pxPerMm))

  let offsetY = 0
  let page = 0

  while (offsetY < canvas.height - 1) {
    if (page > 0) pdf.addPage()
    const sliceH = Math.min(pageHeightPx, canvas.height - offsetY)
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = sliceH
    const ctx = slice.getContext('2d')
    if (!ctx) throw new Error('Falha ao montar página do PDF.')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, slice.width, slice.height)
    ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, canvas.width, sliceH)

    const sliceHmm = sliceH / pxPerMm
    pdf.addImage(
      slice.toDataURL('image/jpeg', JPEG_QUALITY),
      'JPEG',
      MARGIN_MM,
      MARGIN_MM,
      imgWmm,
      sliceHmm,
    )

    offsetY += sliceH
    page += 1
    if (page > 40) break
  }

  const blob = pdf.output('blob')
  triggerDownload(blob, fileName)
}

/** Gera e baixa automaticamente a proposta em PDF ou JPG. */
export async function downloadQuotePresentationExport(
  layout: QuotePresentationLayout,
  format: QuotePresentationExportFormat,
): Promise<void> {
  const canvas = await renderSheetCanvas(layout)
  if (format === 'jpg') {
    await downloadAsJpg(canvas, fileNameFor(layout, 'jpg'))
    return
  }
  await downloadAsPdf(canvas, fileNameFor(layout, 'pdf'))
}
