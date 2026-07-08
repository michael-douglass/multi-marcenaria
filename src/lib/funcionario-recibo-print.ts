import { fmtCur, fmtDate } from '@/lib/utils'
import type { FuncionarioRecibo } from '@/types'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function buildReciboPrestadorHtml(recibo: FuncionarioRecibo, assinaturaDataUrl?: string): string {
  const textoHtml = escapeHtml(recibo.texto_recibo.trim()).replace(/\n/g, '<br>')
  const valor = recibo.valor != null ? fmtCur(recibo.valor) : ''
  const data = recibo.data_pagamento ? fmtDate(recibo.data_pagamento) : ''

  const assinaturaBlock = assinaturaDataUrl
    ? `<div class="assinatura">
        <img src="${assinaturaDataUrl}" alt="Assinatura" />
        <div class="linha"></div>
        <p>Assinatura do prestador</p>
      </div>`
    : `<div class="assinatura">
        <div class="linha"></div>
        <p>Assinatura do prestador</p>
      </div>`

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Recibo de Pagamento</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    body { font-family: Georgia, 'Times New Roman', serif; color: #1a1208; margin: 0; padding: 16mm; background: #fff; }
    .header { text-align: center; border-bottom: 2px solid #d4a853; padding-bottom: 12px; margin-bottom: 20px; }
    .header h1 { font-size: 18pt; letter-spacing: 0.12em; margin: 0; color: #8b6914; }
    .header p { margin: 4px 0 0; font-size: 10pt; color: #666; }
    .meta { display: flex; justify-content: space-between; font-size: 10pt; margin-bottom: 16px; color: #444; }
    .corpo { border: 1px solid #ccc; padding: 16px; min-height: 120px; line-height: 1.6; font-size: 11pt; }
    .assinatura { margin-top: 40px; text-align: center; }
    .assinatura img { max-height: 80px; max-width: 280px; }
    .assinatura .linha { border-top: 1px solid #333; width: 260px; margin: 8px auto 4px; }
    .assinatura p { font-size: 10pt; color: #555; margin: 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1>GARBO MOVELARIA</h1>
    <p>Recibo de Pagamento — Prestador de Serviços</p>
  </div>
  <div class="meta">
    <span>${valor ? `Valor: <strong>${valor}</strong>` : ''}</span>
    <span>${data ? `Data: ${data}` : ''}</span>
  </div>
  <div class="corpo">${textoHtml}</div>
  ${assinaturaBlock}
</body>
</html>`
}

export function imprimirReciboPrestador(recibo: FuncionarioRecibo, assinaturaDataUrl?: string): void {
  const html = buildReciboPrestadorHtml(recibo, assinaturaDataUrl)
  const win = window.open('', '_blank')
  if (!win) return
  win.document.write(html)
  win.document.close()
  win.onload = () => {
    win.print()
    setTimeout(() => win.close(), 500)
  }
}

export async function renderReciboAssinadoBlob(
  recibo: FuncionarioRecibo,
  assinaturaDataUrl: string,
): Promise<Blob> {
  const html = buildReciboPrestadorHtml(recibo, assinaturaDataUrl)
  const iframe = document.createElement('iframe')
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  iframe.style.width = '794px'
  iframe.style.height = '1123px'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument
  if (!doc) {
    document.body.removeChild(iframe)
    throw new Error('Não foi possível renderizar o recibo.')
  }

  doc.open()
  doc.write(html)
  doc.close()

  await new Promise(r => setTimeout(r, 300))

  const canvas = document.createElement('canvas')
  canvas.width = 794
  canvas.height = 1123
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    document.body.removeChild(iframe)
    throw new Error('Canvas indisponível.')
  }

  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  const textLines = recibo.texto_recibo.split('\n')
  ctx.fillStyle = '#1a1208'
  ctx.font = 'bold 22px Georgia'
  ctx.textAlign = 'center'
  ctx.fillText('GARBO MOVELARIA', 397, 48)
  ctx.font = '14px Georgia'
  ctx.fillStyle = '#666'
  ctx.fillText('Recibo de Pagamento', 397, 72)

  ctx.textAlign = 'left'
  ctx.font = '14px Georgia'
  ctx.fillStyle = '#1a1208'
  let y = 120
  for (const line of textLines) {
    ctx.fillText(line, 48, y)
    y += 22
  }

  const img = new Image()
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve()
    img.onerror = () => reject(new Error('Erro ao carregar assinatura.'))
    img.src = assinaturaDataUrl
  })
  ctx.drawImage(img, 250, y + 40, 280, 80)
  ctx.strokeStyle = '#333'
  ctx.beginPath()
  ctx.moveTo(250, y + 130)
  ctx.lineTo(530, y + 130)
  ctx.stroke()
  ctx.font = '12px Georgia'
  ctx.fillStyle = '#555'
  ctx.textAlign = 'center'
  ctx.fillText('Assinatura do prestador', 397, y + 150)

  document.body.removeChild(iframe)

  return new Promise((resolve, reject) => {
    canvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Falha ao gerar imagem do recibo.'))
    }, 'image/png')
  })
}
