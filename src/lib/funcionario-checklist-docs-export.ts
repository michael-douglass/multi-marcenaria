import { garboBrandLogo } from '@/lib/garbo-brand'
import { ADMISSAO_DOC_TIPOS, WHATSAPP_ADMISSAO } from '@/lib/funcionario-constants'
import { formatarCnpj } from '@/lib/rep/rep-validation'

const NOME_EMPRESA = 'GARBO MOVELARIA'
const CIDADE_PADRAO = 'Contagem/MG'

/** A4 em ~150 dpi — bom equilíbrio entre nitidez e peso do JPG. */
const JPG_W = 1240
const JPG_H = 1754
const JPG_QUALITY = 0.92

export interface ChecklistDocsExportOptions {
  cnpj?: string | null
  cidadeUf?: string | null
  /** Nome opcional do colaborador (linha em branco se vazio). */
  colaboradorNome?: string | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function cnpjLabel(cnpj?: string | null): string {
  const raw = cnpj?.trim() || ''
  return raw ? formatarCnpj(raw) : '—'
}

function dataHojeCurta(): string {
  return new Date().toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível carregar a logo da empresa.'))
    img.src = src
  })
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth) {
      current = next
    } else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines
}

/** HTML do papel timbrado com a lista de documentos para carteira. */
export function buildChecklistDocumentosHtml(options: ChecklistDocsExportOptions = {}): string {
  const logoUrl = new URL(garboBrandLogo, window.location.origin).href
  const cnpj = escapeHtml(cnpjLabel(options.cnpj))
  const cidade = escapeHtml(options.cidadeUf?.trim() || CIDADE_PADRAO)
  const colaborador = escapeHtml(options.colaboradorNome?.trim() || '')
  const data = escapeHtml(dataHojeCurta())
  const whatsapp = escapeHtml(WHATSAPP_ADMISSAO)

  const itens = ADMISSAO_DOC_TIPOS.map((doc, i) => `
    <li class="item">
      <span class="box" aria-hidden="true"></span>
      <span class="num">${String(i + 1).padStart(2, '0')}</span>
      <span class="label">${escapeHtml(doc.label)}</span>
    </li>
  `).join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Documentos para assinatura de carteira — ${escapeHtml(NOME_EMPRESA)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
      color: #1a1208;
      background: #fff;
      font-size: 11pt;
      line-height: 1.45;
    }
    .folha {
      max-width: 186mm;
      margin: 0 auto;
      min-height: 262mm;
      border: 1.5px solid #8b6914;
      padding: 10mm 12mm 12mm;
      position: relative;
      display: flex;
      flex-direction: column;
      background:
        linear-gradient(180deg, #fffef9 0%, #ffffff 40%, #fffdf8 100%);
    }
    .folha::before {
      content: "";
      position: absolute;
      inset: 3mm;
      border: 1px solid rgba(139, 105, 20, 0.35);
      pointer-events: none;
    }
    .timbre {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding-bottom: 6mm;
      border-bottom: 2px solid #1a1208;
      margin-bottom: 6mm;
      position: relative;
      z-index: 1;
    }
    .timbre img {
      max-height: 56px;
      width: auto;
      object-fit: contain;
    }
    .timbre-meta {
      text-align: right;
    }
    .timbre-meta strong {
      display: block;
      font-size: 12pt;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #1a1208;
    }
    .timbre-meta span {
      display: block;
      margin-top: 2px;
      font-size: 8.5pt;
      color: #5a4636;
      letter-spacing: 0.04em;
    }
    .selo {
      display: inline-block;
      margin-top: 4px;
      padding: 1.5mm 3mm;
      border: 1px solid #8b6914;
      font-size: 7.5pt;
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #8b6914;
    }
    .titulo {
      text-align: center;
      margin: 0 0 2mm;
      font-size: 13.5pt;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #1a1208;
      position: relative;
      z-index: 1;
    }
    .subtitulo {
      text-align: center;
      margin: 0 0 6mm;
      font-size: 9.5pt;
      color: #5a4636;
      position: relative;
      z-index: 1;
    }
    .intro {
      margin: 0 0 5mm;
      font-size: 10pt;
      text-align: justify;
      color: #2a1812;
      position: relative;
      z-index: 1;
    }
    .ficha {
      display: grid;
      grid-template-columns: 1.4fr 1fr;
      gap: 4mm;
      margin-bottom: 5mm;
      position: relative;
      z-index: 1;
    }
    .campo {
      border-bottom: 1px solid #1a1208;
      min-height: 8mm;
      padding-bottom: 1mm;
    }
    .campo label {
      display: block;
      font-size: 7.5pt;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #6b5544;
      margin-bottom: 1mm;
    }
    .campo .valor {
      font-size: 11pt;
      min-height: 1.2em;
    }
    .lista {
      list-style: none;
      margin: 0;
      padding: 0;
      flex: 1;
      position: relative;
      z-index: 1;
    }
    .item {
      display: grid;
      grid-template-columns: 7mm 9mm 1fr;
      align-items: start;
      gap: 2.5mm;
      padding: 2.4mm 0;
      border-bottom: 1px dotted rgba(26, 18, 8, 0.28);
    }
    .item:last-child { border-bottom: none; }
    .box {
      width: 5.5mm;
      height: 5.5mm;
      border: 1.4px solid #1a1208;
      margin-top: 0.6mm;
      background: #fff;
    }
    .num {
      font-size: 9pt;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: #8b6914;
      padding-top: 0.4mm;
    }
    .label {
      font-size: 10.5pt;
      color: #1a1208;
    }
    .obs {
      margin: 5mm 0 0;
      padding: 3.5mm 4mm;
      background: #f7f1e6;
      border-left: 3px solid #8b6914;
      font-size: 9pt;
      color: #3d2c20;
      position: relative;
      z-index: 1;
    }
    .assinaturas {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10mm;
      margin-top: 10mm;
      position: relative;
      z-index: 1;
    }
    .assin {
      text-align: center;
    }
    .assin .linha {
      border-top: 1px solid #1a1208;
      margin: 14mm 4mm 2mm;
    }
    .assin p {
      margin: 0;
      font-size: 9pt;
      color: #3d2c20;
    }
    .rodape {
      margin-top: auto;
      padding-top: 6mm;
      border-top: 1px solid rgba(26, 18, 8, 0.2);
      display: flex;
      justify-content: space-between;
      gap: 8px;
      font-size: 8pt;
      color: #6b5544;
      position: relative;
      z-index: 1;
    }
    @media print {
      .folha { border-color: #8b6914; max-width: none; margin: 0; }
    }
  </style>
</head>
<body>
  <article class="folha">
    <header class="timbre">
      <img src="${logoUrl}" alt="${escapeHtml(NOME_EMPRESA)}" />
      <div class="timbre-meta">
        <strong>${escapeHtml(NOME_EMPRESA)}</strong>
        <span>Móveis planejados de alta qualidade</span>
        <span>CNPJ ${cnpj}</span>
        <span class="selo">RH · Admissão</span>
      </div>
    </header>

    <h1 class="titulo">Documentos para assinatura de carteira</h1>
    <p class="subtitulo">${cidade} · Lista oficial de documentos necessários ao registro</p>

    <p class="intro">
      Para concluir a admissão e o registro em carteira de trabalho, o colaborador
      deve apresentar os documentos abaixo (originais e cópias, quando solicitado).
      Marque cada item conforme a entrega ao setor de RH.
    </p>

    <div class="ficha">
      <div class="campo">
        <label>Nome do colaborador</label>
        <div class="valor">${colaborador || '&nbsp;'}</div>
      </div>
      <div class="campo">
        <label>Data</label>
        <div class="valor">${data}</div>
      </div>
    </div>

    <ol class="lista">
      ${itens}
    </ol>

    <p class="obs">
      Dúvidas sobre o envio: WhatsApp ${whatsapp}. Documentos ilegíveis ou incompletos
      poderão atrasar a assinatura da carteira.
    </p>

    <div class="assinaturas">
      <div class="assin">
        <div class="linha" aria-hidden="true"></div>
        <p>Assinatura do colaborador</p>
      </div>
      <div class="assin">
        <div class="linha" aria-hidden="true"></div>
        <p>Recebido pelo RH — ${escapeHtml(NOME_EMPRESA)}</p>
      </div>
    </div>

    <footer class="rodape">
      <span>Emitido pelo sistema financeiro · ${escapeHtml(NOME_EMPRESA)}</span>
      <span>Checklist de admissão</span>
    </footer>
  </article>
  <script>
    window.onload = function () {
      window.focus();
      window.print();
    };
  </script>
</body>
</html>`
}

/** Abre a janela de impressão para salvar como PDF. */
export function imprimirChecklistDocumentosPdf(options: ChecklistDocsExportOptions = {}): void {
  const html = buildChecklistDocumentosHtml(options)
  const win = window.open('', '_blank')
  if (!win) {
    throw new Error('Permita pop-ups para exportar o PDF.')
  }
  win.document.write(html)
  win.document.close()
}

/** Gera e baixa o mesmo papel timbrado em JPG. */
export async function baixarChecklistDocumentosJpg(
  options: ChecklistDocsExportOptions = {},
): Promise<void> {
  const logoUrl = new URL(garboBrandLogo, window.location.origin).href
  const logo = await loadImage(logoUrl)
  const cnpj = cnpjLabel(options.cnpj)
  const cidade = options.cidadeUf?.trim() || CIDADE_PADRAO
  const colaborador = options.colaboradorNome?.trim() || ''
  const data = dataHojeCurta()

  const canvas = document.createElement('canvas')
  canvas.width = JPG_W
  canvas.height = JPG_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível gerar a imagem.')

  // Fundo papel
  const grad = ctx.createLinearGradient(0, 0, 0, JPG_H)
  grad.addColorStop(0, '#fffef9')
  grad.addColorStop(0.45, '#ffffff')
  grad.addColorStop(1, '#fffdf8')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, JPG_W, JPG_H)

  // Moldura dourada
  const m = 28
  ctx.strokeStyle = '#8b6914'
  ctx.lineWidth = 3
  ctx.strokeRect(m, m, JPG_W - m * 2, JPG_H - m * 2)
  ctx.strokeStyle = 'rgba(139, 105, 20, 0.35)'
  ctx.lineWidth = 1
  ctx.strokeRect(m + 14, m + 14, JPG_W - (m + 14) * 2, JPG_H - (m + 14) * 2)

  const left = 72
  const right = JPG_W - 72
  let y = 78

  // Logo
  const logoH = 78
  const logoW = (logo.width / logo.height) * logoH
  ctx.drawImage(logo, left, y, logoW, logoH)

  // Meta empresa
  ctx.textAlign = 'right'
  ctx.fillStyle = '#1a1208'
  ctx.font = '700 22px Georgia, "Times New Roman", serif'
  ctx.fillText(NOME_EMPRESA, right, y + 22)
  ctx.font = '15px Georgia, "Times New Roman", serif'
  ctx.fillStyle = '#5a4636'
  ctx.fillText('Móveis planejados de alta qualidade', right, y + 46)
  ctx.fillText(`CNPJ ${cnpj}`, right, y + 68)

  ctx.strokeStyle = '#8b6914'
  ctx.strokeRect(right - 118, y + 78, 118, 24)
  ctx.font = '700 11px Georgia, "Times New Roman", serif'
  ctx.fillStyle = '#8b6914'
  ctx.fillText('RH · ADMISSÃO', right - 10, y + 95)

  y += 118
  ctx.strokeStyle = '#1a1208'
  ctx.lineWidth = 2.5
  ctx.beginPath()
  ctx.moveTo(left, y)
  ctx.lineTo(right, y)
  ctx.stroke()

  y += 48
  ctx.textAlign = 'center'
  ctx.fillStyle = '#1a1208'
  ctx.font = '700 28px Georgia, "Times New Roman", serif'
  ctx.fillText('DOCUMENTOS PARA ASSINATURA DE CARTEIRA', JPG_W / 2, y)

  y += 28
  ctx.font = '16px Georgia, "Times New Roman", serif'
  ctx.fillStyle = '#5a4636'
  ctx.fillText(`${cidade} · Lista oficial de documentos necessários ao registro`, JPG_W / 2, y)

  y += 36
  ctx.textAlign = 'left'
  ctx.fillStyle = '#2a1812'
  ctx.font = '16px Georgia, "Times New Roman", serif'
  const intro =
    'Para concluir a admissão e o registro em carteira de trabalho, o colaborador deve apresentar os documentos abaixo (originais e cópias, quando solicitado). Marque cada item conforme a entrega ao setor de RH.'
  for (const line of wrapText(ctx, intro, right - left)) {
    ctx.fillText(line, left, y)
    y += 22
  }

  y += 18
  // Campos nome / data
  const mid = left + (right - left) * 0.62
  ctx.fillStyle = '#6b5544'
  ctx.font = '700 12px Georgia, "Times New Roman", serif'
  ctx.fillText('NOME DO COLABORADOR', left, y)
  ctx.fillText('DATA', mid + 16, y)
  y += 8
  ctx.strokeStyle = '#1a1208'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(left, y + 28)
  ctx.lineTo(mid - 12, y + 28)
  ctx.moveTo(mid + 16, y + 28)
  ctx.lineTo(right, y + 28)
  ctx.stroke()
  ctx.fillStyle = '#1a1208'
  ctx.font = '18px Georgia, "Times New Roman", serif'
  if (colaborador) ctx.fillText(colaborador, left, y + 22)
  ctx.fillText(data, mid + 16, y + 22)
  y += 52

  // Lista
  for (let i = 0; i < ADMISSAO_DOC_TIPOS.length; i++) {
    const doc = ADMISSAO_DOC_TIPOS[i]
    const rowTop = y

    ctx.strokeStyle = '#1a1208'
    ctx.lineWidth = 1.6
    ctx.strokeRect(left, rowTop - 2, 18, 18)

    ctx.fillStyle = '#8b6914'
    ctx.font = '700 15px Georgia, "Times New Roman", serif'
    ctx.fillText(String(i + 1).padStart(2, '0'), left + 30, rowTop + 13)

    ctx.fillStyle = '#1a1208'
    ctx.font = '17px Georgia, "Times New Roman", serif'
    ctx.fillText(doc.label, left + 62, rowTop + 13)

    y += 38
    ctx.strokeStyle = 'rgba(26, 18, 8, 0.22)'
    ctx.lineWidth = 1
    ctx.setLineDash([3, 4])
    ctx.beginPath()
    ctx.moveTo(left, y - 12)
    ctx.lineTo(right, y - 12)
    ctx.stroke()
    ctx.setLineDash([])
  }

  // Observação
  y += 8
  ctx.fillStyle = '#f7f1e6'
  ctx.fillRect(left, y, right - left, 70)
  ctx.fillStyle = '#8b6914'
  ctx.fillRect(left, y, 6, 70)
  ctx.fillStyle = '#3d2c20'
  ctx.font = '15px Georgia, "Times New Roman", serif'
  const obs = `Dúvidas sobre o envio: WhatsApp ${WHATSAPP_ADMISSAO}. Documentos ilegíveis ou incompletos poderão atrasar a assinatura da carteira.`
  let oy = y + 24
  for (const line of wrapText(ctx, obs, right - left - 28)) {
    ctx.fillText(line, left + 18, oy)
    oy += 20
  }

  // Assinaturas
  y = JPG_H - 210
  const half = (right - left - 48) / 2
  const a1 = left
  const a2 = left + half + 48
  ctx.strokeStyle = '#1a1208'
  ctx.lineWidth = 1.2
  ctx.beginPath()
  ctx.moveTo(a1 + 20, y)
  ctx.lineTo(a1 + half - 20, y)
  ctx.moveTo(a2 + 20, y)
  ctx.lineTo(a2 + half - 20, y)
  ctx.stroke()
  ctx.textAlign = 'center'
  ctx.fillStyle = '#3d2c20'
  ctx.font = '15px Georgia, "Times New Roman", serif'
  ctx.fillText('Assinatura do colaborador', a1 + half / 2, y + 24)
  ctx.fillText(`Recebido pelo RH — ${NOME_EMPRESA}`, a2 + half / 2, y + 24)

  // Rodapé
  y = JPG_H - 70
  ctx.strokeStyle = 'rgba(26, 18, 8, 0.2)'
  ctx.beginPath()
  ctx.moveTo(left, y)
  ctx.lineTo(right, y)
  ctx.stroke()
  ctx.textAlign = 'left'
  ctx.fillStyle = '#6b5544'
  ctx.font = '13px Georgia, "Times New Roman", serif'
  ctx.fillText(`Emitido pelo sistema financeiro · ${NOME_EMPRESA}`, left, y + 28)
  ctx.textAlign = 'right'
  ctx.fillText('Checklist de admissão', right, y + 28)

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('Falha ao gerar o JPG.'))),
      'image/jpeg',
      JPG_QUALITY,
    )
  })

  downloadBlob(blob, `garbo-documentos-carteira-${data.replace(/\//g, '-')}.jpg`)
}
