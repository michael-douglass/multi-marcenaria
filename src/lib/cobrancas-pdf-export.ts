/**
 * Exporta a lista de Cobranças (contas a receber) em PDF A4 paisagem compacto.
 * Usa a mesma ordem/filtro da tabela da página; prioriza densidade na impressão.
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

const PDF_CSS = `
  @page { size: A4 landscape; margin: 5mm 5mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    color: #1a100c;
    background: #fff;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 7pt;
    line-height: 1.2;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet { width: 100%; max-width: 287mm; margin: 0 auto; }
  .doc-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding-bottom: 4px;
    margin-bottom: 5px;
    border-bottom: 1.5px solid #3d2b1f;
  }
  .doc-brand-line {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 10px;
  }
  .doc-brand {
    margin: 0;
    font-size: 6pt;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #8a6a45;
  }
  .doc-title {
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 12pt;
    font-weight: 700;
    color: #1a100c;
  }
  .period-chip {
    display: inline-block;
    padding: 1px 7px;
    border-radius: 3px;
    background: #f3ebe1;
    border: 1px solid #d8c8b4;
    font-size: 6.5pt;
    font-weight: 700;
    color: #6b3f12;
  }
  .doc-meta {
    text-align: right;
    font-size: 6.5pt;
    color: #5c4a38;
    line-height: 1.25;
    white-space: nowrap;
  }
  .doc-meta strong { color: #1a100c; }
  .kpi-strip {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-bottom: 5px;
  }
  .kpi {
    flex: 1 1 0;
    min-width: 0;
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 6px;
    border: 1px solid #d8c8b4;
    border-radius: 3px;
    padding: 3px 6px;
    background: #fffaf4;
  }
  .kpi.late { border-color: rgba(159,18,57,0.35); background: #fff5f6; }
  .kpi.ok { border-color: rgba(20,108,56,0.28); background: #f3faf5; }
  .kpi.gold { border-color: rgba(107,63,18,0.3); }
  .kpi.ink { border-color: rgba(26,16,12,0.22); }
  .kpi-label {
    font-size: 5.5pt;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #4a3428;
  }
  .kpi-value {
    font-variant-numeric: tabular-nums;
    font-size: 8pt;
    font-weight: 700;
    white-space: nowrap;
  }
  .kpi.late .kpi-value { color: #9f1239; }
  .kpi.ok .kpi-value { color: #146c38; }
  .kpi.gold .kpi-value { color: #6b3f12; }
  .kpi.ink .kpi-value { color: #1a100c; }
  .ledger {
    border: 1px solid #d8c8b4;
    border-radius: 3px;
    overflow: hidden;
    background: #fffcf8;
  }
  .ledger-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
    padding: 3px 7px;
    background: #f3ebe1;
    border-bottom: 1px solid #e5d6c4;
    border-left: 3px solid #6b3f12;
    break-after: avoid;
    page-break-after: avoid;
  }
  .ledger-head h2 {
    margin: 0;
    font-size: 8pt;
    font-weight: 700;
    color: #1a100c;
  }
  .ledger-head span {
    font-size: 6.5pt;
    color: #4a3428;
    font-variant-numeric: tabular-nums;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    table-layout: fixed;
  }
  thead { display: table-header-group; }
  tfoot { display: table-footer-group; }
  th, td {
    padding: 2px 4px;
    border-bottom: 1px solid #ebe0d4;
    vertical-align: middle;
    overflow: hidden;
  }
  th {
    font-size: 5.5pt;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #6b5244;
    background: #faf6f0;
    text-align: left;
    font-weight: 700;
  }
  td { font-size: 7pt; }
  col.c-cli { width: 26%; }
  col.c-parc { width: 6%; }
  col.c-val { width: 10%; }
  col.c-venc { width: 10%; }
  col.c-obra { width: 22%; }
  col.c-pag { width: 10%; }
  col.c-st { width: 16%; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  tr.late td { background: rgba(159, 18, 57, 0.05); }
  tr:nth-child(even):not(.late) td { background: #faf7f2; }
  .cliente {
    font-weight: 600;
    color: #1a100c;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .obs {
    margin-top: 0;
    font-size: 5.5pt;
    font-weight: 400;
    color: #6b5244;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .parc { text-align: center; font-variant-numeric: tabular-nums; }
  .right { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .valor { font-weight: 700; color: #146c38; }
  .venc {
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    font-weight: 600;
  }
  .venc-late { color: #9f1239; font-weight: 700; }
  .obra {
    font-size: 6.5pt;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .forma {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 6.5pt;
  }
  .muted { color: #6b5244; }
  .status {
    display: inline-block;
    padding: 0 4px;
    border-radius: 2px;
    font-size: 5.5pt;
    font-weight: 700;
    letter-spacing: 0.02em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .st-ok { background: #dcfce7; color: #146c38; }
  .st-late { background: #ffe4e6; color: #9f1239; }
  .st-pend { background: #fef3c7; color: #92400e; }
  .recv {
    display: block;
    margin-top: 0;
    font-size: 5.5pt;
    color: #146c38;
    white-space: nowrap;
  }
  tfoot td {
    font-weight: 700;
    background: #efe4d6;
    border-bottom: none;
    padding-top: 3px;
    padding-bottom: 3px;
    font-size: 6.5pt;
  }
  .empty {
    padding: 10px;
    text-align: center;
    color: #6b5244;
  }
  .doc-foot {
    margin-top: 4px;
    padding-top: 3px;
    border-top: 1px solid #d8c8b4;
    font-size: 5.5pt;
    color: #7a6754;
    text-align: center;
  }
  @media print {
    body { background: #fff; }
    tr { break-inside: avoid; page-break-inside: avoid; }
    thead { display: table-header-group; }
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

  const rows = input.contas.map(c => {
    const status = input.getStatus(c.data_vencimento, c.status)
    const forma = PM_LABEL[c.forma_pagamento as FormaPagamento] ?? c.forma_pagamento
    const obra = mapaObra?.get(c.id) ?? '—'
    const cliente = c.cliente_nome?.trim() || '—'
    const obs = c.observacao?.trim() ?? ''
    const vencClass = status === 'vencido' ? 'venc venc-late' : 'venc'
    return `
      <tr class="${status === 'vencido' ? 'late' : ''}">
        <td>
          <div class="cliente" title="${escapeHtml(cliente)}">${escapeHtml(cliente)}</div>
          ${obs ? `<div class="obs" title="${escapeHtml(obs)}">${escapeHtml(obs)}</div>` : ''}
        </td>
        <td class="parc">${c.numero_parcela}/${c.total_parcelas}</td>
        <td class="right valor">${escapeHtml(fmtCur(c.valor_parcela))}</td>
        <td class="${vencClass}">${escapeHtml(fmtDate(c.data_vencimento))}</td>
        <td class="obra ${obra === '—' ? 'muted' : ''}" title="${escapeHtml(obra)}">${escapeHtml(obra)}</td>
        <td class="forma" title="${escapeHtml(forma)}">${escapeHtml(forma)}</td>
        <td>
          <span class="status ${statusClass(status)}">
            ${escapeHtml(STATUS_LABEL[status] ?? status)}
          </span>
          ${status === 'recebido' && c.data_recebimento
            ? `<span class="recv">em ${escapeHtml(fmtDate(c.data_recebimento))}</span>`
            : ''}
        </td>
      </tr>
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
  <style>${PDF_CSS}</style>
</head>
<body>
  <div class="sheet">
    <header class="doc-head">
      <div class="doc-brand-line">
        <p class="doc-brand">${escapeHtml(empresa)}</p>
        <h1 class="doc-title">Cobranças</h1>
        <span class="period-chip">${escapeHtml(periodLabel)}</span>
      </div>
      <div class="doc-meta">
        ${filtrosExtras ? `<div>${escapeHtml(filtrosExtras)}</div>` : ''}
        <div><strong>${input.contas.length}</strong> parcela(s) · Total <strong>${escapeHtml(fmtCur(total))}</strong></div>
        <div>Gerado em ${escapeHtml(geradoEm)}</div>
      </div>
    </header>

    ${kpiHtml}

    <section class="ledger">
      <div class="ledger-head">
        <h2>Parcelas filtradas</h2>
        <span>${input.contas.length} linha(s) · mesma ordem da tela</span>
      </div>
      ${input.contas.length === 0
        ? '<p class="empty">Nenhuma cobrança para este filtro.</p>'
        : `<table>
            <colgroup>
              <col class="c-cli" />
              <col class="c-parc" />
              <col class="c-val" />
              <col class="c-venc" />
              <col class="c-obra" />
              <col class="c-pag" />
              <col class="c-st" />
            </colgroup>
            <thead>
              <tr>
                <th>Cliente / obs.</th>
                <th class="parc">Parc.</th>
                <th class="right">Valor</th>
                <th>Vencimento</th>
                <th>Início → entrega</th>
                <th>Forma</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr>
                <td colspan="2">Total · ${input.contas.length} parcela(s)</td>
                <td class="right valor">${escapeHtml(fmtCur(total))}</td>
                <td colspan="4"></td>
              </tr>
            </tfoot>
          </table>`}
    </section>

    <footer class="doc-foot">
      Cobranças · lista filtrada da tela · ${escapeHtml(periodLabel)}
    </footer>
  </div>
  <script>
    window.onload = function () {
      window.focus();
      window.print();
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

/** Abre impressão/salvar PDF das cobranças filtradas (A4 paisagem compacto). */
export function imprimirCobrancasPdf(input: CobrancasPdfExportInput): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('Permita pop-ups para exportar o PDF de cobranças.')
  }
  printWindow.document.write(buildDocumentHtml(input))
  printWindow.document.close()
}
