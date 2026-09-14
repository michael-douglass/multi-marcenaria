/**
 * Exporta a lista de Cobranças (contas a receber) em PDF A4.
 * Usa a mesma ordem/filtro da tabela da página.
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
  @page { size: A4 landscape; margin: 9mm 8mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    color: #1a100c;
    background: #f7f2ea;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 8.5pt;
    line-height: 1.3;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet { max-width: 280mm; margin: 0 auto; }
  .doc-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
    padding-bottom: 8px;
    margin-bottom: 10px;
    border-bottom: 2.5px solid #3d2b1f;
  }
  .doc-brand {
    margin: 0 0 3px;
    font-size: 7pt;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #8a6a45;
  }
  .doc-title {
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 20pt;
    font-style: italic;
    color: #1a100c;
  }
  .doc-sub {
    margin: 3px 0 0;
    font-size: 8pt;
    color: #4a3428;
  }
  .doc-meta {
    text-align: right;
    font-size: 7.5pt;
    color: #5c4a38;
  }
  .doc-meta strong { color: #1a100c; }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    margin-bottom: 10px;
  }
  .kpi {
    border: 1px solid #d8c8b4;
    border-radius: 6px;
    padding: 7px 9px;
    background: #fffaf4;
  }
  .kpi.late { border-color: rgba(159,18,57,0.35); }
  .kpi.ok { border-color: rgba(20,108,56,0.28); }
  .kpi.gold { border-color: rgba(107,63,18,0.3); }
  .kpi-label {
    display: block;
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #4a3428;
  }
  .kpi-value {
    display: block;
    margin-top: 3px;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 13pt;
    font-weight: 700;
  }
  .kpi.late .kpi-value { color: #9f1239; }
  .kpi.ok .kpi-value { color: #146c38; }
  .kpi.gold .kpi-value { color: #6b3f12; }
  .kpi.ink .kpi-value { color: #1a100c; }
  .kpi-hint {
    display: block;
    margin-top: 2px;
    font-size: 7pt;
    color: #6b5244;
  }
  .ledger {
    border: 1px solid #d8c8b4;
    border-radius: 6px;
    overflow: hidden;
    background: #fffcf8;
  }
  .ledger-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 8px;
    padding: 7px 10px;
    background: #f3ebe1;
    border-bottom: 1px solid #e5d6c4;
  }
  .ledger-head h2 {
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11pt;
  }
  .ledger-head span {
    font-size: 7.5pt;
    color: #6b5244;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th, td {
    padding: 5px 7px;
    border-bottom: 1px solid #ebe0d4;
    vertical-align: top;
  }
  th {
    font-size: 6.5pt;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6b5244;
    background: #faf6f0;
    text-align: left;
  }
  td { font-size: 8pt; }
  tr.late td { background: rgba(159, 18, 57, 0.04); }
  .cliente { font-weight: 600; color: #1a100c; }
  .obs {
    margin-top: 2px;
    font-size: 7pt;
    font-weight: 400;
    color: #6b5244;
  }
  .right { text-align: right; font-variant-numeric: tabular-nums; }
  .valor { font-weight: 700; color: #146c38; }
  .venc-late { font-weight: 700; color: #9f1239; }
  .muted { color: #6b5244; }
  .status {
    display: inline-block;
    padding: 1px 7px;
    border-radius: 999px;
    font-size: 6.5pt;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .st-ok { background: #dcfce7; color: #146c38; }
  .st-late { background: #ffe4e6; color: #9f1239; }
  .st-pend { background: #fef3c7; color: #92400e; }
  tfoot td {
    font-weight: 700;
    background: #f3ebe1;
    border-bottom: none;
  }
  .empty {
    padding: 16px;
    text-align: center;
    color: #6b5244;
  }
  .doc-foot {
    margin-top: 8px;
    padding-top: 6px;
    border-top: 1px solid #d8c8b4;
    font-size: 7pt;
    color: #7a6754;
    text-align: center;
  }
  @media print {
    body { background: #fff; }
    tr { break-inside: avoid; }
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
    ? `<div class="kpi-grid">${input.kpis.map(k => `
        <div class="kpi ${k.tone}">
          <span class="kpi-label">${escapeHtml(k.label)}</span>
          <span class="kpi-value">${escapeHtml(fmtCur(k.value))}</span>
          <span class="kpi-hint">${escapeHtml(k.hint)}</span>
        </div>
      `).join('')}</div>`
    : ''

  const rows = input.contas.map(c => {
    const status = input.getStatus(c.data_vencimento, c.status)
    const forma = PM_LABEL[c.forma_pagamento as FormaPagamento] ?? c.forma_pagamento
    const obra = mapaObra?.get(c.id) ?? '—'
    const vencClass = status === 'vencido' ? 'venc-late' : ''
    return `
      <tr class="${status === 'vencido' ? 'late' : ''}">
        <td>
          <div class="cliente">${escapeHtml(c.cliente_nome?.trim() || '—')}</div>
          ${c.observacao?.trim()
            ? `<div class="obs">${escapeHtml(c.observacao.trim())}</div>`
            : ''}
        </td>
        <td>${c.numero_parcela}/${c.total_parcelas}</td>
        <td class="right valor">${escapeHtml(fmtCur(c.valor_parcela))}</td>
        <td class="${vencClass}">${escapeHtml(fmtDate(c.data_vencimento))}</td>
        <td class="${obra === '—' ? 'muted' : ''}">${escapeHtml(obra)}</td>
        <td>${escapeHtml(forma)}</td>
        <td>
          <span class="status ${statusClass(status)}">
            ${escapeHtml(STATUS_LABEL[status] ?? status)}
          </span>
          ${status === 'recebido' && c.data_recebimento
            ? `<div class="obs">em ${escapeHtml(fmtDate(c.data_recebimento))}</div>`
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
      <div>
        <p class="doc-brand">${escapeHtml(empresa)}</p>
        <h1 class="doc-title">Cobranças</h1>
        <p class="doc-sub">O que ainda entra no caixa, o que já foi recebido e o que atrasou.</p>
      </div>
      <div class="doc-meta">
        <div>Período: <strong>${escapeHtml(periodLabel)}</strong></div>
        ${filtrosExtras ? `<div>${escapeHtml(filtrosExtras)}</div>` : ''}
        <div>${input.contas.length} parcela(s) · Gerado em ${escapeHtml(geradoEm)}</div>
      </div>
    </header>

    ${kpiHtml}

    <section class="ledger">
      <div class="ledger-head">
        <h2>Parcelas na mesa</h2>
        <span>Mesma lista filtrada da tela</span>
      </div>
      ${input.contas.length === 0
        ? '<p class="empty">Nenhuma cobrança para este filtro.</p>'
        : `<table>
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Parcela</th>
                <th class="right">Valor</th>
                <th>Vencimento</th>
                <th>Início e entrega</th>
                <th>Pagamento</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr>
                <td colspan="2">Total (${input.contas.length})</td>
                <td class="right valor">${escapeHtml(fmtCur(total))}</td>
                <td colspan="4"></td>
              </tr>
            </tfoot>
          </table>`}
    </section>

    <footer class="doc-foot">
      Exportação de Cobranças · ordem e filtros iguais à página.
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

/** Abre impressão/salvar PDF das cobranças filtradas (A4 paisagem). */
export function imprimirCobrancasPdf(input: CobrancasPdfExportInput): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('Permita pop-ups para exportar o PDF de cobranças.')
  }
  printWindow.document.write(buildDocumentHtml(input))
  printWindow.document.close()
}
