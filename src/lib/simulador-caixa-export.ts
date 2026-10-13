/**
 * Exporta o Simulador de Caixa em folha A4 (PDF e JPG).
 * Inclui totais por mês + histórico detalhado de ocultações/exclusões (igual aos cards).
 */
import html2canvas from 'html2canvas'
import { jsPDF } from 'jspdf'
import { fmtCur } from '@/lib/utils'

export interface SimuladorCaixaExportHistoricoItem {
  titulo: string
  /** Ex.: A receber · Ocultado · 13/10/2026 */
  detalhe: string
  /** adicionar | remover | ocultar */
  acao: 'adicionar' | 'remover' | 'ocultar'
  valor: number
  campoLabel: string
}

export interface SimuladorCaixaExportMes {
  mes: string
  /** Nome completo opcional (ex.: Novembro). */
  mesNome?: string
  ano?: number
  receitas: number
  despesas: number
  saldo: number
  /** Histórico completo do mês (ocultados e ajustes manuais). */
  historico?: SimuladorCaixaExportHistoricoItem[]
}

export interface SimuladorCaixaExportInput {
  empresaNome?: string | null
  ano: number
  /** Ex.: Out/2026 → Mar/2027 */
  janelaLabel?: string
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

function acaoLabel(acao: SimuladorCaixaExportHistoricoItem['acao']): string {
  if (acao === 'ocultar') return 'Ocultado'
  if (acao === 'adicionar') return 'Adicionado'
  return 'Removido'
}

function buildDocumentHtml(input: SimuladorCaixaExportInput): string {
  const empresa = input.empresaNome?.trim() || 'Movelaria Garbo'
  const geradoEm = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const janela =
    input.janelaLabel?.trim() ||
    `Ano ${input.ano}`

  const totalReceber = input.meses.reduce((s, m) => s + m.receitas, 0)
  const totalPagar = input.meses.reduce((s, m) => s + m.despesas, 0)
  const totalSaldo = totalReceber - totalPagar

  const totalHistorico = input.meses.reduce(
    (s, m) => s + (m.historico?.length ?? 0),
    0,
  )

  const resumoRows = input.meses
    .map(m => {
      const rotulo = m.ano ? `${escapeHtml(m.mes)}/${m.ano}` : escapeHtml(m.mes)
      const nome = m.mesNome ? escapeHtml(m.mesNome) : ''
      const nHist = m.historico?.length ?? 0
      const histPill =
        nHist > 0
          ? `<span class="hist-pill">${nHist} no histórico</span>`
          : ''
      return `
        <tr>
          <td class="mes">
            <span class="mes-short">${rotulo}</span>
            ${nome ? `<span class="mes-full">${nome}</span>` : ''}
            ${histPill}
          </td>
          <td class="right pos">${escapeHtml(fmtCur(m.receitas))}</td>
          <td class="right neg">${escapeHtml(fmtCur(m.despesas))}</td>
          <td class="right ${moneyClass(m.saldo)}">${escapeHtml(fmtCur(m.saldo))}</td>
        </tr>`
    })
    .join('')

  const cardsHtml = input.meses
    .map(m => {
      const tituloMes = m.ano
        ? `${escapeHtml(m.mesNome || m.mes)} ${m.ano}`
        : escapeHtml(m.mesNome || m.mes)
      const hist = m.historico ?? []
      const histHtml =
        hist.length === 0
          ? `<p class="hist-empty">Sem exclusões ou ajustes neste mês.</p>`
          : `
            <ul class="hist-list">
              ${hist
                .map(h => {
                  const sinal = h.acao === 'adicionar' ? '+' : '−'
                  const tom =
                    h.acao === 'adicionar'
                      ? 'add'
                      : h.acao === 'ocultar'
                        ? 'hide'
                        : 'rem'
                  return `
                    <li class="hist-item ${tom}" data-break>
                      <div class="hist-main">
                        <p class="hist-title">${escapeHtml(h.titulo)}</p>
                        <p class="hist-detail">${escapeHtml(h.detalhe)}</p>
                      </div>
                      <p class="hist-valor ${tom}">${sinal}${escapeHtml(fmtCur(h.valor))}</p>
                    </li>`
                })
                .join('')}
            </ul>`

      return `
        <article class="mes-card" data-break>
          <header class="mes-card-head">
            <h4>${tituloMes}</h4>
            <span class="badge ${moneyClass(m.saldo)}">${escapeHtml(sinalLabel(m.saldo))}</span>
          </header>
          <div class="mes-lines">
            <div><span>A receber</span><strong class="pos">${escapeHtml(fmtCur(m.receitas))}</strong></div>
            <div><span>A pagar</span><strong class="neg">− ${escapeHtml(fmtCur(m.despesas))}</strong></div>
            <div class="mes-saldo">
              <span>Saldo final</span>
              <strong class="${moneyClass(m.saldo)}">${escapeHtml(fmtCur(m.saldo))}</strong>
            </div>
          </div>
          <div class="hist-block">
            <p class="hist-label">
              Histórico · exclusões e ajustes
              ${hist.length > 0 ? `<em>${hist.length}</em>` : ''}
            </p>
            ${histHtml}
          </div>
        </article>`
    })
    .join('')

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
      line-height: 1.4;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .sheet {
      position: relative;
      width: ${A4_CSS_PX_WIDTH}px;
      min-height: 1123px;
      margin: 0 auto;
      padding: 28px 32px 40px;
      background:
        radial-gradient(ellipse 80% 40% at 100% 0%, rgba(196, 148, 74, 0.12), transparent 55%),
        linear-gradient(180deg, #fffdf9 0%, #faf4ea 100%);
      color: #1c120e;
      overflow: visible;
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
      font-size: 24pt;
      font-style: italic;
      font-weight: 400;
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
    }
    .doc-meta strong {
      display: block;
      font-size: 10.5pt;
      color: #1a100c;
      letter-spacing: 0.06em;
    }
    .hero {
      display: grid;
      grid-template-columns: 1.15fr 1fr;
      gap: 12px;
      margin: 0 0 16px 10px;
    }
    .hero-card, .caixa-card {
      border: 1px solid rgba(61, 43, 31, 0.14);
      background: rgba(255, 252, 248, 0.95);
      padding: 12px 14px;
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
      letter-spacing: 0.16em;
      text-transform: uppercase;
      color: #8a6a45;
    }
    .hero h2 {
      margin: 0 0 8px;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 15pt;
      font-style: italic;
      font-weight: 400;
    }
    .mini-grid {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      gap: 8px;
    }
    .mini {
      border-top: 1px solid rgba(61, 43, 31, 0.12);
      padding-top: 5px;
    }
    .mini span {
      display: block;
      font-size: 7pt;
      letter-spacing: 0.1em;
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
      margin: 2px 0 4px;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 20pt;
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
      padding: 2px 7px;
      font-size: 7pt;
      font-weight: 700;
      letter-spacing: 0.12em;
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
      margin: 6px 0 8px 10px;
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
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #8a6a45;
    }
    table.resumo {
      width: calc(100% - 10px);
      margin: 0 0 18px 10px;
      border-collapse: collapse;
    }
    table.resumo thead th {
      text-align: left;
      font-size: 7pt;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #8a6a45;
      font-weight: 700;
      padding: 6px 8px;
      border-bottom: 1.5px solid #3d2b1f;
    }
    table.resumo tbody td {
      padding: 8px;
      border-bottom: 1px solid rgba(61, 43, 31, 0.1);
      font-variant-numeric: tabular-nums;
      font-size: 9.5pt;
    }
    table.resumo tbody tr:nth-child(even) td {
      background: rgba(196, 148, 74, 0.05);
    }
    table.resumo tfoot td {
      padding: 9px 8px;
      border-top: 2px solid #3d2b1f;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
    }
    td.right, th.right { text-align: right; }
    .mes-short {
      font-weight: 700;
      letter-spacing: 0.04em;
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
      border: 1px solid rgba(138, 106, 69, 0.4);
      font-size: 6.5pt;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #8a6a45;
    }
    .cards {
      display: grid;
      grid-template-columns: 1fr;
      gap: 14px;
      margin: 0 0 8px 10px;
      width: calc(100% - 10px);
    }
    .mes-card {
      border: 1px solid rgba(61, 43, 31, 0.14);
      background: #fffcf8;
      padding: 12px 14px 14px;
      break-inside: avoid;
      page-break-inside: avoid;
    }
    .mes-card-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px solid rgba(61, 43, 31, 0.12);
    }
    .mes-card-head h4 {
      margin: 0;
      font-family: Georgia, "Times New Roman", serif;
      font-size: 13pt;
      font-style: italic;
      font-weight: 400;
      color: #1a100c;
    }
    .mes-lines {
      display: grid;
      gap: 4px;
      margin-bottom: 10px;
      font-size: 9pt;
    }
    .mes-lines > div {
      display: flex;
      justify-content: space-between;
      gap: 8px;
    }
    .mes-lines span {
      text-transform: uppercase;
      letter-spacing: 0.1em;
      font-size: 7.5pt;
      color: #7a6252;
    }
    .mes-lines strong {
      font-variant-numeric: tabular-nums;
      font-size: 10pt;
    }
    .mes-saldo {
      margin-top: 2px;
      padding-top: 5px;
      border-top: 1px dashed rgba(61, 43, 31, 0.18);
    }
    .hist-block {
      border-top: 1px solid rgba(61, 43, 31, 0.1);
      padding-top: 8px;
    }
    .hist-label {
      margin: 0 0 6px;
      font-size: 7.5pt;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #8a6a45;
    }
    .hist-label em {
      font-style: normal;
      margin-left: 6px;
      padding: 1px 5px;
      border: 1px solid rgba(138, 106, 69, 0.35);
      color: #8d5e22;
    }
    .hist-empty {
      margin: 0;
      font-size: 8.5pt;
      color: #8a6a45;
    }
    .hist-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      gap: 5px;
    }
    .hist-item {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 8px;
      padding: 7px 8px;
      border: 1px solid rgba(61, 43, 31, 0.1);
      background: rgba(42, 24, 18, 0.03);
    }
    .hist-item.hide {
      border-color: rgba(163, 58, 47, 0.28);
      background: rgba(163, 58, 47, 0.06);
    }
    .hist-item.rem {
      border-color: rgba(163, 58, 47, 0.2);
      background: rgba(163, 58, 47, 0.04);
    }
    .hist-item.add {
      border-color: rgba(26, 107, 60, 0.22);
      background: rgba(26, 107, 60, 0.05);
    }
    .hist-title {
      margin: 0 0 2px;
      font-size: 9.5pt;
      font-weight: 600;
      color: #1a100c;
      line-height: 1.25;
      word-break: break-word;
    }
    .hist-detail {
      margin: 0;
      font-size: 7.5pt;
      color: #6b5244;
      line-height: 1.3;
    }
    .hist-valor {
      flex-shrink: 0;
      margin: 0;
      font-size: 10pt;
      font-weight: 700;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }
    .hist-valor.add { color: #1a6b3c; }
    .hist-valor.rem, .hist-valor.hide { color: #a33a2f; }
    .pos { color: #1a6b3c; }
    .neg { color: #a33a2f; }
    .zero { color: #4a3428; }
    .notes {
      margin: 12px 0 0 10px;
      font-size: 8pt;
      color: #6b5244;
      line-height: 1.45;
    }
    .doc-foot {
      margin: 18px 0 0 10px;
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
    <header class="doc-head" data-break>
      <div>
        <p class="doc-brand">${escapeHtml(empresa)}</p>
        <h1 class="doc-title">Simulador de Caixa</h1>
        <p class="doc-sub">Janela ${escapeHtml(janela)} · com histórico de exclusões</p>
      </div>
      <div class="doc-meta">
        <strong>${escapeHtml(janela)}</strong>
        <div>Gerado em ${escapeHtml(geradoEm)}</div>
        <div>A4 · ${totalHistorico} item(ns) no histórico</div>
      </div>
    </header>

    <div class="hero" data-break>
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
        <p class="caixa-hint">Soma dos 6 meses à frente (a receber − a pagar)</p>
        <span class="badge ${moneyClass(input.caixaFinal)}" style="margin-top:8px">${escapeHtml(sinalLabel(input.caixaFinal))}</span>
      </article>
    </div>

    <div class="section-label" data-break>
      <h3>Resumo dos meses</h3>
      <span>${input.meses.length} mês(es) · a receber − a pagar</span>
    </div>

    <table class="resumo" data-break>
      <thead>
        <tr>
          <th>Mês</th>
          <th class="right">A receber</th>
          <th class="right">A pagar</th>
          <th class="right">Saldo</th>
        </tr>
      </thead>
      <tbody>
        ${resumoRows || '<tr><td colspan="4" style="text-align:center;color:#8a6a45;padding:18px">Sem meses na janela</td></tr>'}
      </tbody>
      <tfoot>
        <tr>
          <td>Totais da janela</td>
          <td class="right pos">${escapeHtml(fmtCur(totalReceber))}</td>
          <td class="right neg">${escapeHtml(fmtCur(totalPagar))}</td>
          <td class="right ${moneyClass(totalSaldo)}">${escapeHtml(fmtCur(totalSaldo))}</td>
        </tr>
      </tfoot>
    </table>

    <div class="section-label" data-break>
      <h3>Detalhe por mês · como nos cards</h3>
      <span>Histórico de exclusões / ocultações</span>
    </div>

    <div class="cards">
      ${cardsHtml || '<p class="notes" data-break>Sem meses para detalhar.</p>'}
    </div>

    ${
      metaBits.length
        ? `<p class="notes" data-break><strong>Resumo:</strong> ${escapeHtml(metaBits.join(' · '))}. Contas reais do sistema (Contas a Receber / a Pagar) não foram apagadas — só saíram desta simulação.</p>`
        : `<p class="notes" data-break>Nenhuma exclusão no histórico desta janela. Valores iguais às parcelas em aberto do sistema.</p>`
    }

    <footer class="doc-foot" data-break>
      ${escapeHtml(empresa)} · Simulador de Caixa · documento interno · legível A4
    </footer>
  </div>
</body>
</html>`
}

interface RenderedSheet {
  canvas: HTMLCanvasElement
  /** Fins de bloco em pixels do canvas — pontos seguros para quebrar página. */
  safeEnds: number[]
}

/**
 * Coleta o rodapé de cada bloco marcado (cards, histórico, seções)
 * para o PDF não cortar informação no meio.
 */
function collectSafeEnds(sheet: HTMLElement, canvasHeight: number): number[] {
  const contentH = Math.max(sheet.scrollHeight, sheet.offsetHeight, 1)
  const scale = canvasHeight / contentH
  const sheetTop = sheet.getBoundingClientRect().top
  const ends = new Set<number>([0, canvasHeight])

  sheet.querySelectorAll('[data-break]').forEach(node => {
    const r = (node as HTMLElement).getBoundingClientRect()
    const bottom = Math.round((r.bottom - sheetTop) * scale)
    if (bottom > 2 && bottom < canvasHeight - 2) ends.add(bottom)
  })

  return [...ends].sort((a, b) => a - b)
}

/** Escolhe o fim da página no maior ponto seguro que ainda cabe em pageHeightPx. */
function nextPageEnd(
  start: number,
  pageHeightPx: number,
  safeEnds: number[],
  canvasHeight: number,
): number {
  const limit = Math.min(start + pageHeightPx, canvasHeight)
  if (limit >= canvasHeight) return canvasHeight

  let best = -1
  for (const y of safeEnds) {
    // margem mínima de conteúdo na página (~24px no canvas @2x)
    if (y > start + 24 && y <= limit) best = y
  }
  if (best > start) return best

  // Nenhum bloco inteiro cabe: corta no limite A4 (último recurso).
  return limit
}

async function renderSheetCanvas(input: SimuladorCaixaExportInput): Promise<RenderedSheet> {
  const html = buildDocumentHtml(input)
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.cssText =
    'position:fixed;left:-9999px;top:0;width:794px;height:2400px;border:none;opacity:0;pointer-events:none;'
  document.body.appendChild(iframe)

  const doc = iframe.contentDocument ?? iframe.contentWindow?.document
  if (!doc) {
    document.body.removeChild(iframe)
    throw new Error('Não foi possível preparar a folha de exportação.')
  }

  doc.open()
  doc.write(html)
  doc.close()

  await new Promise(r => setTimeout(r, 120))

  const sheet = doc.querySelector('.sheet') as HTMLElement | null
  if (!sheet) {
    document.body.removeChild(iframe)
    throw new Error('Folha A4 não encontrada para exportar.')
  }

  try {
    const canvas = await html2canvas(sheet, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#fffdf9',
      width: sheet.scrollWidth,
      height: Math.max(sheet.scrollHeight, sheet.offsetHeight),
      windowWidth: sheet.scrollWidth,
      windowHeight: Math.max(sheet.scrollHeight, sheet.offsetHeight),
    })
    const safeEnds = collectSafeEnds(sheet, canvas.height)
    return { canvas, safeEnds }
  } finally {
    document.body.removeChild(iframe)
  }
}

/** PDF A4 — quebra só entre blocos (não corta card/histórico no meio). */
async function exportPdf(
  canvas: HTMLCanvasElement,
  safeEnds: number[],
  ano: number,
): Promise<void> {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })
  const pageW = pdf.internal.pageSize.getWidth()
  const pageH = pdf.internal.pageSize.getHeight()
  const margin = 4
  const footerH = 6
  const imgWmm = pageW - margin * 2
  const usableHmm = pageH - margin * 2 - footerH
  const pxPerMm = canvas.width / imgWmm
  const pageHeightPx = Math.floor(usableHmm * pxPerMm)

  let offsetY = 0
  let page = 0
  const totalGuess = Math.max(1, Math.ceil(canvas.height / pageHeightPx))

  while (offsetY < canvas.height - 1) {
    if (page > 0) pdf.addPage()
    const endY = nextPageEnd(offsetY, pageHeightPx, safeEnds, canvas.height)
    const sliceH = Math.max(1, endY - offsetY)

    const slice = document.createElement('canvas')
    slice.width = canvas.width
    slice.height = sliceH
    const ctx = slice.getContext('2d')
    if (!ctx) throw new Error('Falha ao montar página do PDF.')
    ctx.fillStyle = '#fffdf9'
    ctx.fillRect(0, 0, slice.width, slice.height)
    ctx.drawImage(canvas, 0, offsetY, canvas.width, sliceH, 0, 0, canvas.width, sliceH)

    const sliceHmm = sliceH / pxPerMm
    pdf.addImage(
      slice.toDataURL('image/jpeg', 0.93),
      'JPEG',
      margin,
      margin,
      imgWmm,
      sliceHmm,
    )

    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(8)
    pdf.setTextColor(138, 106, 69)
    const pageLabel = `Página ${page + 1}`
    pdf.text(pageLabel, pageW / 2, pageH - 4, { align: 'center' })

    offsetY = endY
    page += 1
    if (page > Math.max(40, totalGuess + 10)) break
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
  const { canvas, safeEnds } = await renderSheetCanvas(input)
  if (format === 'pdf') await exportPdf(canvas, safeEnds, input.ano)
  else await exportJpg(canvas, input.ano)
}

export { acaoLabel }
