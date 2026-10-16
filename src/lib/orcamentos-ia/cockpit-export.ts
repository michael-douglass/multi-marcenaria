/**
 * Exporta o conteúdo do Cockpit Corte Claude (CoT + Auditor + JSON)
 * em Markdown, PDF ou texto para a área de transferência.
 */

import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import type { ObservabilityBlocks } from '@/lib/orcamentos-ia/observability'

export interface CockpitExportMeta {
  analysisId?: string | null
  batchLabel?: string | null
  status?: string | null
  generatedAt?: string | null
}

const A4_W_MM = 210
const A4_H_MM = 297
const MARGIN_MM = 10
const EXPORT_SCALE = 2
const JPEG_QUALITY = 0.92
const SHEET_WIDTH_PX = 794
const MAX_PDF_PAGES = 60

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatMoney(n: number): string {
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function stampNow(): string {
  const d = new Date()
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}-${String(d.getHours()).padStart(2, '0')}${String(d.getMinutes()).padStart(2, '0')}`
}

function safeFilePart(value: string): string {
  const raw = String(value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return raw || 'cockpit'
}

export function cockpitExportFileBase(meta?: CockpitExportMeta | null): string {
  const label =
    (meta?.batchLabel && String(meta.batchLabel).trim()) ||
    (meta?.analysisId ? String(meta.analysisId).slice(0, 8) : '') ||
    'export'
  return `cockpit-${safeFilePart(label)}-${stampNow()}`
}

export function hasCockpitExportContent(blocks: ObservabilityBlocks | null | undefined): boolean {
  if (!blocks) return false
  if (blocks.chainOfThought?.trim()) return true
  if (blocks.priceAuditor?.length) return true
  if (blocks.responseJson && Object.keys(blocks.responseJson).length) return true
  return false
}

/** Monta o Markdown completo usado em copiar / .md / PDF. */
export function formatCockpitExportMarkdown(
  blocks: ObservabilityBlocks,
  meta?: CockpitExportMeta | null,
): string {
  const generatedAt = meta?.generatedAt?.trim() || new Date().toISOString()
  const lines: string[] = [
    '# Cockpit Corte Claude',
    '',
    '## Metadados',
    '',
    `- Análise: ${meta?.analysisId?.trim() || '—'}`,
    `- Lote: ${meta?.batchLabel?.trim() || '—'}`,
    `- Status: ${meta?.status?.trim() || '—'}`,
    `- Gerado em: ${generatedAt}`,
    '',
    '## Chain of Thought',
    '',
    blocks.chainOfThought?.trim() || '_Sem Chain of Thought._',
    '',
    '## Auditor de preços',
    '',
    `- Custo materiais (BOM): ${formatMoney(blocks.priceAuditorTotal)}`,
    `- Preço de venda: ${formatMoney(blocks.salePrice)}`,
    `- Modalidade: ${blocks.modality}`,
    `- Fórmula: ${blocks.formulaLabel}`,
    '',
  ]

  if (blocks.priceAuditor.length) {
    lines.push('| Item | Categoria | Qtd | Unidade | Unitário | Total |')
    lines.push('| --- | --- | ---: | --- | ---: | ---: |')
    for (const row of blocks.priceAuditor) {
      const item = String(row.item || '').replace(/\|/g, '\\|')
      const cat = String(row.category || '').replace(/\|/g, '\\|')
      const unit = String(row.unit || '').replace(/\|/g, '\\|')
      lines.push(
        `| ${item} | ${cat} | ${row.quantity} | ${unit} | ${formatMoney(row.unitCost)} | ${formatMoney(row.totalCost)} |`,
      )
    }
    lines.push('')
  } else {
    lines.push('_Sem linhas de BOM para auditar._', '')
  }

  let jsonBody = '{}'
  try {
    jsonBody = JSON.stringify(blocks.responseJson ?? {}, null, 2)
  } catch {
    jsonBody = '"[JSON não serializável]"'
  }

  lines.push('## JSON', '', '```json', jsonBody, '```', '')
  return lines.join('\n')
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

export function downloadCockpitMarkdown(markdown: string, fileName: string): void {
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  triggerDownload(blob, fileName.endsWith('.md') ? fileName : `${fileName}.md`)
}

function buildCockpitPdfHtml(markdown: string): string {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body {
    margin: 0;
    padding: 28px 32px;
    background: #fff;
    color: #0f1419;
    font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
  }
  pre {
    margin: 0;
    white-space: pre-wrap;
    word-break: break-word;
    font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
    font-size: 11px;
    line-height: 1.45;
  }
</style>
</head>
<body><pre>${escapeHtml(markdown)}</pre></body>
</html>`
}

async function renderMarkdownCanvas(markdown: string): Promise<HTMLCanvasElement> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText =
    'position:fixed;left:-10000px;top:0;width:820px;height:1200px;opacity:0;pointer-events:none;border:0;'
  document.body.appendChild(iframe)

  try {
    const doc = iframe.contentDocument
    if (!doc) throw new Error('Não foi possível montar o PDF do cockpit.')
    doc.open()
    doc.write(buildCockpitPdfHtml(markdown))
    doc.close()

    await new Promise<void>((resolve) => {
      if (doc.readyState === 'complete') {
        resolve()
        return
      }
      iframe.addEventListener('load', () => resolve(), { once: true })
      window.setTimeout(() => resolve(), 300)
    })

    const body = doc.body
    const sheet = body.firstElementChild as HTMLElement | null
    const target = sheet || body
    const fullH = Math.max(target.scrollHeight, body.scrollHeight, 400)

    return html2canvas(target, {
      backgroundColor: '#ffffff',
      scale: EXPORT_SCALE,
      useCORS: true,
      width: SHEET_WIDTH_PX,
      height: fullH,
      windowWidth: SHEET_WIDTH_PX,
      windowHeight: fullH,
      logging: false,
    })
  } finally {
    iframe.remove()
  }
}

async function canvasToMultipagePdf(canvas: HTMLCanvasElement, fileName: string): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const imgWmm = A4_W_MM - MARGIN_MM * 2
  const usableHmm = A4_H_MM - MARGIN_MM * 2
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
    if (page >= MAX_PDF_PAGES) break
  }

  triggerDownload(pdf.output('blob'), fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`)
}

export async function downloadCockpitPdf(markdown: string, fileName: string): Promise<void> {
  const canvas = await renderMarkdownCanvas(markdown)
  await canvasToMultipagePdf(canvas, fileName)
}
