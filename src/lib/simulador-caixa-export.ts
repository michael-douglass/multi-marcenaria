/**
 * Exporta o Simulador de Caixa em folha A4 (PDF e JPG).
 * Estética: ledger editorial — papel creme, tipografia de livro, filetes em tinta.
 */
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { fmtCur } from '@/lib/utils'

export interface SimuladorCaixaExportMes {
  mes: string
  /** Nome completo opcional (ex.: Novembro). */
  mesNome?: string
  receitas: number
  despesas: number
  saldo: number
  /** Quantidade de ocultações / ajustes no mês. */
  historicoCount?: number
}

export interface SimuladorCaixaExportInput {
  empresaNome?: string | null
  ano: number
  previsao: {
    label: string
    receber: number
    pagar: number
    saldo: number
  }
  meses: SimuladorCaixaExportMes[]
  caixaFinal: number
  /** Contas ocultadas só na simulação. */
  ocultadosCount?: number
  ajustesManuaisCount?: number
}

export type SimuladorCaixaExportFormat = 'pdf' | 'jpg'

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function moneyClass(n: number): string {
  if (n > 0) return 'pos'
  if (n < 0) return 'neg'
  return 'zero'
}

function sinalLabel(n: number): string {
  if (n > 0) return 'Positivo'
  if (n < 0) return 'Negativo'
  return 'Zerado'
}

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.rel = 'noopener'
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 2_000)
}

function fileBaseName(ano: number): string {
  const datePart = new Date().toISOString().slice(0, 10)
  return `simulador-caixa-${ano}-${datePart}`
}

const A4_CSS_PX_WIDTH = 794

function buildDocumentHtml(input: SimuladorCaixaExportInput): string {
  const empresa = input.empresaNome?.trim() || 'Movelaria Garbo'
  const geradoEm = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  const rows = input.meses
    .map(m => {
      const nome = m.mesNome ? `${escapeHtml(m.mesNome)}` : escapeHtml(m.mes)
      const hist =
        m.historicoCount && m.historicoCount > 0
          ? `<span class="hist-pill">${m.historicoCount} hist.</span>`
          : ''
      return `
        <tr>
          <td class="mes">
            <span class="mes-short">${escapeHtml(m.mes)}</span>
            <span class="mes-full">${nome}</span>
            ${hist}
          </td>
          <td class="right pos">${escapeHtml(fmtCur(m.receitas))}</td>
          <td class="right neg">${escapeHtml(fmtCur(m.despesas))}</td>
          <td class="right ${moneyClass(m.saldo)}">${escapeHtml(fmtCur(m.saldo))}</td>
        </tr>`
    })
    .join('')

  const totalReceber = input.meses.reduce((s, m) => s + m.receitas, 0)
  const totalPagar = input.meses.reduce((s, m) => s + m.despesas, 0)
  const totalSaldo = totalReceber - totalPagar

  const metaBits: string[] = []
  if (input.ocultadosCount && input.ocultadosCount > 0) {
    metaBits.push(`${input.ocultadosCount} conta(s) ocultada(s) na simulação`)
  }
  if (input.ajustesManuaisCount && input.ajustesManuaisCount > 0) {
    metaBits.push(`${input.ajustesManuaisCount} ajuste(s) manual(is)`)
  }

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Simulador de Caixa ${input.ano} — ${escapeHtml(empresa)}</title>
  <style>
    @page { size: A4 portrait; margin: 0; }
    * { box-sizing: border-box; }
    html, body {
      margin: 0;
      padding: 0;
      background: #f3ebe0;
      color: #1c120e;
      font-family: "Raleway", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      font-size: 10pt;
      line-height: 1.35;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      position: relative;
      width: ${A4_CSS_PX_WIDTH}px;
      min-height: 1123px;
      margin: 0 auto;
      padding: 28px 32px 36px;
      background:
        radial-gradient(ellipse 80% 50% at 100% 0%, rgba(196, 148, 74, 0.12), transparent 55%),
        linear-gradient(180deg, #fffdf9 0%, #faf4ea 100%);
      color: #1c120e;
      overflow: hidden;
    }
    .sheet::before {
      content: "";
      position: absolute;
      inset: 12px;
      border: 1px solid rgba(61, 43, 31, 0.18);
      pointer-events: none;
    }
    .sheet::after {
      content: "";
      position: absolute;
      top: 18px;
      bottom: 18px;
      left: 18px;
      width: 3px;
      background: linear-gradient(180deg, #8d5e22, #c4944a 40%, #8d5e22);
      border-radius: 2px;
      opacity: 0.85;
    }
    .doc-head {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 16px;
      padding: 4px 0 14px 10px;
      margin-bottom: 16px;
      border-bottom: 2.5px solid #3d2b1f;
    }
    .doc-brand {
      margin: 0 0 4px;
      font-size: 8pt;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: #8a6a45;
      font-weight: 700;
    }
    .doc-title {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 26pt;
      font-style: italic;
      font-weight: 400;
      letter-spacing: 0.02em;
      color: #1a100c;
      line-height: 1.05;
    }
    .doc-sub {
      margin: 6px 0 0;
      font-size: 8.5pt;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: #6b5244;
    }
    .doc-meta {
      text-align: right;
      font-size: 8pt;
      color: #5a4336;
      line-height: 1.55;
      padding-bottom: 2px;
    }
    .doc-meta strong {
      display: block;
      font-size: 11pt;
      color: #1a100c;
      letter-spacing: 0.08em;
    }
    .hero {
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      gap: 14px;
      margin: 0 0 18px 10px;
    }
    .hero-card, .caixa-card {
      border: 1px solid rgba(61, 43, 31, 0.14);
      background: rgba(255, 252, 248, 0.92);
      padding: 14px 16px;
      position: relative;
    }
    .hero-card::before, .caixa-card::before {
      content: "";
      position: absolute;
      left: 0; top: 0; bottom: 0;
      width: 4px;
      background: #c4944a;
    }
    .eyebrow {
      margin: 0 0 4px;
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.18em;
      text-transform: uppercase;
      color: #8a6a45;
    }
    .hero h2 {
      margin: 0 0 10px;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 16pt;
      font-style: italic;
      font-weight: 400;
      color: #1a100c;
    }
    .mini-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
    }
    .mini {
      border-top: 1px solid rgba(61, 43, 31, 0.12);
      padding-top: 6px;
    }
    .mini span {
      display: block;
      font-size: 7pt;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #7a6252;
      margin-bottom: 2px;
    }
    .mini strong {
      font-size: 10.5pt;
      font-variant-numeric: tabular-nums;
      font-weight: 700;
    }
    .caixa-card .caixa-value {
      margin: 4px 0 6px;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 22pt;
      font-variant-numeric: tabular-nums;
      line-height: 1.1;
    }
    .caixa-card .caixa-hint {
      margin: 0;
      font-size: 8pt;
      color: #6b5244;
    }
    .badge {
      display: inline-block;
      margin-top: 8px;
      padding: 3px 8px;
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      border: 1px solid currentColor;
    }
    .badge.pos { color: #1a6b3c; }
    .badge.neg { color: #a33a2f; }
    .badge.zero { color: #6b5244; }
    .section-label {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 10px;
      margin: 4px 0 8px 10px;
      padding-bottom: 4px;
      border-bottom: 1px solid rgba(61, 43, 31, 0.2);
    }
    .section-label h3 {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 13pt;
      font-style: italic;
      font-weight: 400;
    }
    .section-label span {
      font-size: 7.5pt;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #8a6a45;
    }
    table {
      width: calc(100% - 10px);
      margin-left: 10px;
      border-collapse: collapse;
    }
    thead th {
      text-align: left;
      font-size: 7pt;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #8a6a45;
      font-weight: 700;
      padding: 6px 8px;
      border-bottom: 1.5px solid #3d2b1f;
    }
    tbody td {
      padding: 9px 8px;
      border-bottom: 1px solid rgba(61, 43, 31, 0.1);
      font-variant-numeric: tabular-nums;
      vertical-align: middle;
    }
    tbody tr:nth-child(even) td {
      background: rgba(196, 148, 74, 0.05);
    }
    td.right, th.right { text-align: right; }
    .mes-short {
      display: inline-block;
      min-width: 2.2em;
      font-weight: 700;
      letter-spacing: 0.06em;
      color: #1a100c;
    }
    .mes-full {
      margin-left: 6px;
      color: #6b5244;
      font-size: 9pt;
    }
    .hist-pill {
      display: inline-block;
      margin-left: 8px;
      padding: 1px 6px;
      border: 1px solid rgba(138, 106, 69, 0.35);
      font-size: 6.5pt;
      letter-spacing: 0.1em;
      text-transform: uppercase;
      color: #8a6a45;
    }
    tfoot td {
      padding: 10px 8px;
      border-top: 2px solid #3d2b1f;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    .pos { color: #1a6b3c; }
    .neg { color: #a33a2f; }
    .zero { color: #4a3428; }
    .notes {
      margin: 14px 0 0 10px;
      font-size: 8pt;
      color: #6b5244;
    }
    .doc-foot {
      margin: 22px 0 0 10px;
      padding-top: 10px;
      border-top: 1px solid rgba(61, 43, 31, 0.15);
      font-size: 7.5pt;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #8a6a45;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <header class="doc-head">
      <div>
        <p class="doc-brand">${escapeHtml(empresa)}</p>
        <h1 class="doc-title">Simulador de Caixa</h1>
        <p class="doc-sub">Projeção editável · próximos meses · A4</p>
      </div>
      <div class="doc-meta">
        <strong>ANO ${input.ano}</strong>
        <div>Gerado em ${escapeHtml(geradoEm)}</div>
        <div>Folha A4 retrato</div>
      </div>
    </header>

    <div class="hero">
      <article class="hero-card">
        <p class="eyebrow">Previsão do próximo mês</p>
        <h2>${escapeHtml(input.previsao.label)}</h2>
        <div class="mini-grid">
          <div class="mini">
            <span>A receber</span>
            <strong class="pos">${escapeHtml(fmtCur(input.previsao.receber))}</strong>
          </div>
          <div class="mini">
            <span>A pagar</span>
            <strong class="neg">${escapeHtml(fmtCur(input.previsao.pagar))}</strong>
          </div>
          <div class="mini">
            <span>Saldo</span>
            <strong class="${moneyClass(input.previsao.saldo)}">${escapeHtml(fmtCur(input.previsao.saldo))}</strong>
          </div>
        </div>
      </article>
      <article class="caixa-card">
        <p class="eyebrow">Como está o caixa</p>
        <p class="caixa-value ${moneyClass(input.caixaFinal)}">${escapeHtml(fmtCur(input.caixaFinal))}</p>
        <p class="caixa-hint">Soma dos saldos simulados do ano ${input.ano}</p>
        <span class="badge ${moneyClass(input.caixaFinal)}">${escapeHtml(sinalLabel(input.caixaFinal))}</span>
      </article>
    </div>

    <div class="section-label">
      <h3>Meses na simulação</h3>
      <span>${input.meses.length} mês(es) · a receber − a pagar</span>
    </div>

    <table>
      <thead>
        <tr>
          <th>Mês</th>
          <th class="right">A receber</th>
          <th class="right">A pagar</th>
          <th class="right">Saldo</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="4" style="text-align:center;color:#8a6a45;padding:18px">Sem meses na janela</td></tr>'}
      </tbody>
      <tfoot>
        <tr>
          <td>Totais da lista</td>
          <td class="right pos">${escapeHtml(fmtCur(totalReceber))}</td>
          <td class="right neg">${escapeHtml(fmtCur(totalPagar))}</td>
          <td class="right ${moneyClass(totalSaldo)}">${escapeHtml(fmtCur(totalSaldo))}</td>
        </tr>
      </tfoot>
    </table>

    ${
      metaBits.length
        ? `<p class="notes">${escapeHtml(metaBits.join(' · '))}. Contas reais do sistema não foram alteradas.</p>`
        : `<p class="notes">Valores iguais à simulação da tela (parcelas em aberto + histórico).</p>`
    }

    <footer class="doc-foot">
      ${escapeHtml(empresa)} · Simulador de Caixa · documento interno
    </footer>
  </div>
</body>
</html>`
}

async function renderSheetCanvas(input: SimuladorCaixaExportInput): Promise<HTMLCanvasElement> {
  const html = buildDocumentHtml(input)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText =
    'position:fixed;left:-9999px;top:0;width:794px;height:1200px;border:none;opacity:0;pointer-events:none;'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    throw new Error('Não foi possível preparar a folha de exportação.')
  }

  doc.open()
  doc.write(html)
  doc.close()

  await new Promise(r => setTimeout(r, 100))

  const sheet = doc.querySelector('.sheet') as HTMLElement | null
  if (!sheet) {
    document.body.removeChild(iframe)
    throw new Error('Folha A4 não encontrada para exportar.')
  }

  try {
    return await html2canvas(sheet, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#fffdf9',
      width: sheet.scrollWidth,
      height: sheet.scrollHeight,
      windowWidth: sheet.scrollWidth,
      windowHeight: sheet.scrollHeight,
    })
  } finally {
    document.body.removeChild(iframe)
  }
}

/** PDF A4 retrato — fatia em várias páginas se a folha passar da altura. */
async function exportPdf(canvas: HTMLCanvasElement, ano: number): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 0
  const imgWmm = pageW - margin * 2
  const pxPerMm = canvas.width / imgWmm
  const pageHeightPx = Math.floor((pageH - margin * 2) * pxPerMm)

  let offsetY = 0
  let page = 0
  while (offsetY < canvas.height) {
    if (page > 0) pdf.addPage()
    const sliceH = Math.min(pageHeightPx, canvas.height - offsetY)
    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = sliceH
    const ctx = slice.getContext('2d')
    if (!ctx) throw new Error('Falha ao montar página do PDF.')
    ctx.fillStyle = '#fffdf9'
    ctx.fillRect(0, 0, slice.width, slice.height)
    ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, canvas.width, sliceH)
    const sliceHmm = sliceH / pxPerMm
    pdf.addImage(slice.toDataURL('image/jpeg', 0.93), 'JPEG', margin, margin, imgWmm, sliceHmm)
    offsetY += sliceH
    page += 1
    if (page > 20) break
  }

  pdf.save(`${fileBaseName(ano)}.pdf`)
}

/** JPG da folha completa (largura A4). */
async function exportJpg(canvas: HTMLCanvasElement, ano: number): Promise<void> {
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      b => (b ? resolve(b) : reject(new Error('Não foi possível gerar o JPG.'))),
      'image/jpeg',
      0.92,
    )
  })
  downloadBlob(blob, `${fileBaseName(ano)}.jpg`)
}

export async function exportarSimuladorCaixa(
  input: SimuladorCaixaExportInput,
  format: SimuladorCaixaExportFormat,
): Promise<void> {
  if (!input.meses.length && input.caixaFinal === 0) {
    // ainda permite exportar (folha com totais zerados)
  }
  const canvas = await renderSheetCanvas(input)
  if (format === 'pdf') await exportPdf(canvas, input.ano)
  else await exportJpg(canvas, input.ano)
}
