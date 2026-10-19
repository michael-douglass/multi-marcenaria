/**
 * Exporta Cobranças em PDF A4 retrato — uma coluna, tipografia legível.
 * Estética editorial (papel quente / tinta), mesma ordem/filtro da tela.
 * O que não cabe na folha segue na próxima.
 */
import { formatPeriodFilterLabel } from '@/lib/contas-pagar-export'
import { fmtCur, fmtDate } from '@/lib/utils'
import type { PeriodFilter } from '@/components/ui/PeriodFilterBar'
import type { ContaReceber, FormaPagamento } from '@/types'

const PM_LABEL: Record<FormaPagamento, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cheque: 'Cheque',
  boleto: 'Boleto',
  cartao: 'Cartão',
}

const STATUS_LABEL: Record<string, string> = {
  pendente: 'Pendente',
  recebido: 'Recebido',
  vencido: 'Vencido',
}

export interface CobrancasPdfKpi {
  label: string
  hint: string
  value: number
  tone: 'gold' | 'ok' | 'late' | 'ink'
}

export interface CobrancasPdfExportInput {
  contas: ContaReceber[]
  /** Status efetivo (pendente / recebido / vencido) por conta. */
  getStatus: (vencimento: string, status: string) => string
  /** Início → entrega da obra, quando houver. */
  inicioEntregaPorConta?: Map<string, string>
  periodFilter: PeriodFilter
  kpis: CobrancasPdfKpi[]
  empresaNome?: string | null
  /** Ex.: "Pendente + Vencido" */
  filtrosStatusLabel?: string
  busca?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function statusClass(status: string): string {
  if (status === 'recebido') return 'st-ok'
  if (status === 'vencido') return 'st-late'
  return 'st-pend'
}

/** Tipografia legível em A4 retrato; lista em uma coluna. */
const PDF_CSS = `
  :root {
    --ink: #1a100c;
    --ink-soft: #4a3428;
    --muted: #6b5244;
    --gold: #6b3f12;
    --gold-soft: #8a6a45;
    --paper: #fffaf4;
    --paper-deep: #f3ebe1;
    --line: #d8c8b4;
    --ok: #146c38;
    --late: #9f1239;
  }
  @page { size: A4 portrait; margin: 8mm 9mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    color: var(--ink);
    background: var(--paper);
    font-family: "Source Sans 3", "Segoe UI", "Helvetica Neue", sans-serif;
    font-size: 10pt;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet { width: 100%; max-width: 192mm; margin: 0 auto; }
  .doc-head {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding-bottom: 8px;
    margin-bottom: 10px;
    border-bottom: 2px solid var(--ink);
  }
  .doc-brand {
    margin: 0;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.2em;
    text-transform: uppercase;
    color: var(--gold-soft);
  }
  .doc-title-row {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    justify-content: space-between;
    gap: 8px 16px;
  }
  .doc-title {
    margin: 0;
    font-family: Fraunces, Georgia, "Times New Roman", serif;
    font-size: 22pt;
    font-weight: 700;
    font-style: italic;
    letter-spacing: -0.02em;
    color: var(--ink);
    line-height: 1.1;
  }
  .period-chip {
    display: inline-block;
    padding: 3px 10px;
    border-radius: 4px;
    background: var(--paper-deep);
    border: 1px solid var(--line);
    font-size: 9pt;
    font-weight: 700;
    color: var(--gold);
  }
  .doc-meta {
    font-size: 9pt;
    color: var(--ink-soft);
    line-height: 1.4;
  }
  .doc-meta strong { color: var(--ink); }
  .kpi-strip {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 6px;
    margin-bottom: 12px;
  }
  .kpi {
    display: flex;
    flex-direction: column;
    gap: 2px;
    border: 1px solid var(--line);
    border-radius: 4px;
    padding: 7px 10px;
    background: #fff;
  }
  .kpi.late { border-color: rgba(159,18,57,0.4); background: #fff8f9; }
  .kpi.ok { border-color: rgba(20,108,56,0.35); background: #f4faf6; }
  .kpi.gold { border-color: rgba(107,63,18,0.35); }
  .kpi.ink { border-color: rgba(26,16,12,0.22); }
  .kpi-label {
    font-size: 7.5pt;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--ink-soft);
  }
  .kpi-value {
    font-family: Fraunces, Georgia, "Times New Roman", serif;
    font-size: 13pt;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    line-height: 1.15;
  }
  .kpi.late .kpi-value { color: var(--late); }
  .kpi.ok .kpi-value { color: var(--ok); }
  .kpi.gold .kpi-value { color: var(--gold); }
  .kpi.ink .kpi-value { color: var(--ink); }
  .list {
    display: flex;
    flex-direction: column;
    gap: 0;
    border-top: 1px solid var(--line);
  }
  .entry {
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 4px 12px;
    padding: 9px 2px;
    border-bottom: 1px solid var(--line);
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .entry:nth-child(even) { background: rgba(243, 235, 225, 0.45); }
  .entry.late { background: rgba(159, 18, 57, 0.06); }
  .entry-main { min-width: 0; }
  .cliente {
    margin: 0;
    font-size: 11pt;
    font-weight: 700;
    color: var(--ink);
    line-height: 1.25;
  }
  .meta {
    margin: 3px 0 0;
    font-size: 9.5pt;
    color: var(--ink-soft);
    line-height: 1.35;
  }
  .meta .sep { color: var(--line); margin: 0 0.35em; }
  .meta .venc-late { color: var(--late); font-weight: 700; }
  .detail {
    margin: 2px 0 0;
    font-size: 9pt;
    color: var(--muted);
    line-height: 1.3;
  }
  .entry-side {
    text-align: right;
    white-space: nowrap;
  }
  .valor {
    display: block;
    font-family: Fraunces, Georgia, "Times New Roman", serif;
    font-size: 12.5pt;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--ok);
    line-height: 1.15;
  }
  .status {
    display: inline-block;
    margin-top: 4px;
    padding: 2px 8px;
    border-radius: 3px;
    font-size: 8pt;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .st-ok { background: #dcfce7; color: var(--ok); }
  .st-late { background: #ffe4e6; color: var(--late); }
  .st-pend { background: #fef3c7; color: #92400e; }
  .recv {
    display: block;
    margin-top: 3px;
    font-size: 8.5pt;
    color: var(--ok);
  }
  .list-foot {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    margin-top: 0;
    padding: 10px 2px 8px;
    border-top: 2px solid var(--ink);
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .list-foot .label {
    font-size: 10pt;
    font-weight: 700;
    color: var(--ink);
  }
  .list-foot .total {
    font-family: Fraunces, Georgia, "Times New Roman", serif;
    font-size: 14pt;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: var(--ok);
  }
  .empty {
    padding: 20px 8px;
    text-align: center;
    font-size: 10pt;
    color: var(--muted);
  }
  .doc-foot {
    margin-top: 10px;
    padding-top: 6px;
    border-top: 1px solid var(--line);
    font-size: 8pt;
    color: var(--muted);
    text-align: center;
  }
  @media print {
    body { background: #fff; }
    .entry, .list-foot { break-inside: avoid; page-break-inside: avoid; }
  }
`

function buildDocumentHtml(input: CobrancasPdfExportInput): string {
  const empresa = input.empresaNome?.trim() || 'Movelaria Garbo'
  const periodLabel = formatPeriodFilterLabel(input.periodFilter)
  const geradoEm = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const total = input.contas.reduce((acc, c) => acc + (Number(c.valor_parcela) || 0), 0)
  const mapaObra = input.inicioEntregaPorConta

  const kpiHtml = input.kpis.length
    ? `<div class="kpi-strip">${input.kpis.map(k => `
        <div class="kpi ${k.tone}" title="${escapeHtml(k.hint)}">
          <span class="kpi-label">${escapeHtml(k.label)}</span>
          <span class="kpi-value">${escapeHtml(fmtCur(k.value))}</span>
        </div>
      `).join('')}</div>`
    : ''

  const entries = input.contas.map(c => {
    const status = input.getStatus(c.data_vencimento, c.status)
    const forma = PM_LABEL[c.forma_pagamento as FormaPagamento] ?? c.forma_pagamento
    const obra = mapaObra?.get(c.id)
    const cliente = c.cliente_nome?.trim() || '—'
    const obs = c.observacao?.trim() ?? ''
    const vencLate = status === 'vencido'
    return `
      <article class="entry ${vencLate ? 'late' : ''}">
        <div class="entry-main">
          <p class="cliente">${escapeHtml(cliente)}</p>
          <p class="meta">
            Parcela ${c.numero_parcela}/${c.total_parcelas}
            <span class="sep">·</span>
            Venc.
            <span class="${vencLate ? 'venc-late' : ''}">${escapeHtml(fmtDate(c.data_vencimento))}</span>
            <span class="sep">·</span>
            ${escapeHtml(forma)}
          </p>
          ${obra && obra !== '—'
            ? `<p class="detail">Obra: ${escapeHtml(obra)}</p>`
            : ''}
          ${obs ? `<p class="detail">${escapeHtml(obs)}</p>` : ''}
        </div>
        <div class="entry-side">
          <span class="valor">${escapeHtml(fmtCur(c.valor_parcela))}</span>
          <span class="status ${statusClass(status)}">
            ${escapeHtml(STATUS_LABEL[status] ?? status)}
          </span>
          ${status === 'recebido' && c.data_recebimento
            ? `<span class="recv">em ${escapeHtml(fmtDate(c.data_recebimento))}</span>`
            : ''}
        </div>
      </article>
    `
  }).join('')

  const filtrosExtras = [
    input.filtrosStatusLabel ? `Status: ${input.filtrosStatusLabel}` : null,
    input.busca?.trim() ? `Busca: “${input.busca.trim()}”` : null,
  ].filter(Boolean).join(' · ')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Cobranças — ${escapeHtml(periodLabel)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,600;0,9..144,700;1,9..144,700&family=Source+Sans+3:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>${PDF_CSS}</style>
</head>
<body>
  <div class="sheet">
    <header class="doc-head">
      <p class="doc-brand">${escapeHtml(empresa)}</p>
      <div class="doc-title-row">
        <h1 class="doc-title">Cobranças</h1>
        <span class="period-chip">${escapeHtml(periodLabel)}</span>
      </div>
      <div class="doc-meta">
        ${filtrosExtras ? `<div>${escapeHtml(filtrosExtras)}</div>` : ''}
        <div><strong>${input.contas.length}</strong> parcela(s) · Total <strong>${escapeHtml(fmtCur(total))}</strong> · Gerado em ${escapeHtml(geradoEm)}</div>
      </div>
    </header>

    ${kpiHtml}

    ${input.contas.length === 0
      ? '<p class="empty">Nenhuma cobrança para este filtro.</p>'
      : `<section class="list" aria-label="Parcelas">
          ${entries}
          <footer class="list-foot">
            <span class="label">Total · ${input.contas.length} parcela(s)</span>
            <span class="total">${escapeHtml(fmtCur(total))}</span>
          </footer>
        </section>`}

    <footer class="doc-foot">
      Cobranças · lista filtrada da tela · A4 retrato · ${escapeHtml(periodLabel)}
    </footer>
  </div>
  <script>
    window.onload = function () {
      var done = false;
      var go = function () {
        if (done) return;
        done = true;
        window.focus();
        window.print();
      };
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(go).catch(go);
        setTimeout(go, 900);
      } else {
        setTimeout(go, 350);
      }
    };
  </script>
</body>
</html>`
}

export function buildCobrancasPdfFileName(periodFilter: PeriodFilter): string {
  const datePart = new Date().toISOString().slice(0, 10)
  const slug = formatPeriodFilterLabel(periodFilter)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `cobrancas-${slug || 'lista'}-${datePart}.pdf`
}

/** Abre impressão/salvar PDF das cobranças filtradas (A4 retrato, uma coluna). */
export function imprimirCobrancasPdf(input: CobrancasPdfExportInput): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('Permita pop-ups para exportar o PDF de cobranças.')
  }
  printWindow.document.write(buildDocumentHtml(input))
  printWindow.document.close()
}
