/**
 * Exporta a lista filtrada de Contas a Pagar em PDF A4.
 * Agrupa por mês e destaca as datas (vencimento e pagamento).
 */
import { formatPeriodFilterLabel } from '@/lib/contas-pagar-export'
import { getDataReferenciaPagamento, getValorPagoConta } from '@/lib/contas-pagar-valores'
import { monthLabel } from '@/components/ui/PeriodFilterBar'
import type { PeriodFilter } from '@/components/ui/PeriodFilterBar'
import { fmtCur, fmtDate, todayISO } from '@/lib/utils'
import type { ContaPagar } from '@/types'

const STATUS_LABEL: Record<string, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  parcialmente_pago: 'Parcial',
  vencido: 'Vencido',
}

export interface ContasPagarListaPdfKpi {
  label: string
  hint: string
  value: number
  tone: 'gold' | 'ok' | 'late'
}

export interface ContasPagarListaPdfExportInput {
  contas: ContaPagar[]
  fornecedores: { id: string; nome: string }[]
  getStatus: (vencimento: string, status: string) => string
  periodFilter: PeriodFilter
  kpis: ContasPagarListaPdfKpi[]
  empresaNome?: string | null
  filtrosStatusLabel?: string
  busca?: string
}

interface MesGrupo {
  ym: string
  label: string
  contas: ContaPagar[]
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function statusClass(status: string): string {
  if (status === 'pago') return 'st-ok'
  if (status === 'vencido') return 'st-late'
  if (status === 'parcialmente_pago') return 'st-partial'
  return 'st-pend'
}

function ymFromIso(iso: string | null | undefined): string {
  if (!iso) return 'sem-data'
  return iso.slice(0, 7)
}

function diaLabel(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = iso.slice(8, 10)
  return d || '—'
}

function nomeConta(
  conta: ContaPagar,
  fornecedores: { id: string; nome: string }[],
): string {
  return (
    conta.fornecedor_nome
    ?? fornecedores.find(f => f.id === conta.fornecedor_id)?.nome
    ?? conta.descricao
    ?? '—'
  )
}

/** Agrupa por mês do vencimento (mais antigo → mais novo). Sem data no fim. */
export function groupContasPagarPorMes(contas: ContaPagar[]): MesGrupo[] {
  const map = new Map<string, ContaPagar[]>()
  for (const conta of contas) {
    const ym = ymFromIso(conta.data_vencimento)
    const list = map.get(ym)
    if (list) list.push(conta)
    else map.set(ym, [conta])
  }

  const keys = [...map.keys()].sort((a, b) => {
    if (a === 'sem-data') return 1
    if (b === 'sem-data') return -1
    return a.localeCompare(b)
  })

  return keys.map(ym => ({
    ym,
    label: ym === 'sem-data' ? 'Sem data de vencimento' : monthLabel(ym),
    contas: (map.get(ym) ?? []).slice().sort((a, b) =>
      (a.data_vencimento ?? '').localeCompare(b.data_vencimento ?? ''),
    ),
  }))
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
  .mes-block {
    margin-bottom: 5px;
    border: 1px solid #d8c8b4;
    border-radius: 3px;
    overflow: hidden;
    background: #fffcf8;
  }
  .mes-head {
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
  .mes-head h2 {
    margin: 0;
    font-size: 8pt;
    font-weight: 700;
    text-transform: capitalize;
    color: #1a100c;
  }
  .mes-head .mes-meta {
    font-size: 6.5pt;
    color: #4a3428;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .mes-count {
    display: inline-block;
    min-width: 16px;
    padding: 0 4px;
    margin-left: 5px;
    border-radius: 3px;
    background: rgba(107,63,18,0.12);
    color: #6b3f12;
    font-size: 6.5pt;
    font-weight: 700;
    text-align: center;
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
  col.c-dia { width: 7%; }
  col.c-forn { width: 28%; }
  col.c-pag { width: 11%; }
  col.c-parc { width: 5%; }
  col.c-val { width: 9%; }
  col.c-pago { width: 9%; }
  col.c-rest { width: 9%; }
  col.c-datas { width: 13%; }
  col.c-st { width: 9%; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  tr.late td { background: rgba(159, 18, 57, 0.05); }
  tr:nth-child(even):not(.late) td { background: #faf7f2; }
  .dia-cell { text-align: center; }
  .dia-num {
    display: inline-block;
    min-width: 1.4em;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    font-size: 8pt;
    color: #1a100c;
  }
  .dia-num.late { color: #9f1239; }
  .dia-dow {
    display: block;
    font-size: 5pt;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: #6b5244;
    line-height: 1;
  }
  .fornecedor {
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
  .forma {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-size: 6.5pt;
  }
  .parc { text-align: center; font-variant-numeric: tabular-nums; }
  .right { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  .valor { font-weight: 700; color: #6b3f12; }
  .pago { font-weight: 700; color: #146c38; }
  .restante { font-weight: 700; color: #1a100c; }
  .datas {
    font-variant-numeric: tabular-nums;
    font-size: 6.5pt;
    line-height: 1.15;
  }
  .datas .venc { font-weight: 700; white-space: nowrap; }
  .datas .venc.late { color: #9f1239; }
  .datas .pag {
    display: block;
    font-size: 5.5pt;
    color: #146c38;
    white-space: nowrap;
  }
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
  .st-partial { background: #dbeafe; color: #1d4ed8; }
  .st-pend { background: #fef3c7; color: #92400e; }
  .mes-foot td {
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

function weekdayShort(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
    .format(d)
    .replace('.', '')
}

function buildMesBlockHtml(
  grupo: MesGrupo,
  input: ContasPagarListaPdfExportInput,
): string {
  let totValor = 0
  let totPago = 0
  let totRest = 0

  const rows = grupo.contas.map(c => {
    const status = input.getStatus(c.data_vencimento, c.status)
    const pago = getValorPagoConta(c)
    const restante = Math.max(0, c.valor_parcela - pago)
    totValor += c.valor_parcela
    totPago += pago
    totRest += restante
    const dataPag = getDataReferenciaPagamento(c)
    const isLate = status === 'vencido'
    const nome = nomeConta(c, input.fornecedores)
    const forma = c.movelaria_formas_pagamento_pagar?.nome ?? '—'
    const desc = c.descricao?.trim() && c.descricao.trim() !== nome
      ? c.descricao.trim()
      : ''
    const obs = c.observacao?.trim() ?? ''

    const obsLine = [desc, obs].filter(Boolean).join(' · ')

    return `
      <tr class="${isLate ? 'late' : ''}">
        <td class="dia-cell">
          <span class="dia-num ${isLate ? 'late' : ''}">${escapeHtml(diaLabel(c.data_vencimento))}</span>
          <span class="dia-dow">${escapeHtml(weekdayShort(c.data_vencimento))}</span>
        </td>
        <td>
          <div class="fornecedor" title="${escapeHtml(nome)}">${escapeHtml(nome)}</div>
          ${obsLine ? `<div class="obs" title="${escapeHtml(obsLine)}">${escapeHtml(obsLine)}</div>` : ''}
        </td>
        <td class="forma" title="${escapeHtml(forma)}">${escapeHtml(forma)}</td>
        <td class="parc">${c.numero_parcela}/${c.total_parcelas}</td>
        <td class="right valor">${escapeHtml(fmtCur(c.valor_parcela))}</td>
        <td class="right pago">${escapeHtml(fmtCur(pago))}</td>
        <td class="right restante">${escapeHtml(fmtCur(restante))}</td>
        <td class="datas">
          <span class="venc ${isLate ? 'late' : ''}">${escapeHtml(fmtDate(c.data_vencimento))}</span>
          ${status === 'pago' && dataPag
            ? `<span class="pag">Pg ${escapeHtml(fmtDate(dataPag))}</span>`
            : ''}
        </td>
        <td>
          <span class="status ${statusClass(status)}">
            ${escapeHtml(STATUS_LABEL[status] ?? status)}
          </span>
        </td>
      </tr>
    `
  }).join('')

  return `
    <section class="mes-block">
      <header class="mes-head">
        <h2>
          ${escapeHtml(grupo.label)}
          <span class="mes-count">${grupo.contas.length}</span>
        </h2>
        <div class="mes-meta">
          Valor ${escapeHtml(fmtCur(totValor))}
          · Pago ${escapeHtml(fmtCur(totPago))}
          · Restante ${escapeHtml(fmtCur(totRest))}
        </div>
      </header>
      <table>
        <colgroup>
          <col class="c-dia" />
          <col class="c-forn" />
          <col class="c-pag" />
          <col class="c-parc" />
          <col class="c-val" />
          <col class="c-pago" />
          <col class="c-rest" />
          <col class="c-datas" />
          <col class="c-st" />
        </colgroup>
        <thead>
          <tr>
            <th>Dia</th>
            <th>Fornecedor / descrição</th>
            <th>Forma</th>
            <th class="parc">Parc.</th>
            <th class="right">Valor</th>
            <th class="right">Pago</th>
            <th class="right">Restante</th>
            <th>Venc. / Pag.</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr class="mes-foot">
            <td colspan="4">Subtotal do mês · ${grupo.contas.length} conta(s)</td>
            <td class="right valor">${escapeHtml(fmtCur(totValor))}</td>
            <td class="right pago">${escapeHtml(fmtCur(totPago))}</td>
            <td class="right restante">${escapeHtml(fmtCur(totRest))}</td>
            <td colspan="2"></td>
          </tr>
        </tfoot>
      </table>
    </section>
  `
}

function buildDocumentHtml(input: ContasPagarListaPdfExportInput): string {
  const empresa = input.empresaNome?.trim() || 'Movelaria Garbo'
  const periodLabel = formatPeriodFilterLabel(input.periodFilter)
  const geradoEm = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const grupos = groupContasPagarPorMes(input.contas)
  const totalGeral = input.contas.reduce((acc, c) => acc + c.valor_parcela, 0)
  const restanteGeral = input.contas.reduce(
    (acc, c) => acc + Math.max(0, c.valor_parcela - getValorPagoConta(c)),
    0,
  )

  const kpiHtml = input.kpis.length
    ? `<div class="kpi-strip">${input.kpis.map(k => `
        <div class="kpi ${k.tone}" title="${escapeHtml(k.hint)}">
          <span class="kpi-label">${escapeHtml(k.label)}</span>
          <span class="kpi-value">${escapeHtml(fmtCur(k.value))}</span>
        </div>
      `).join('')}</div>`
    : ''

  const filtrosExtras = [
    input.filtrosStatusLabel ? `Status: ${input.filtrosStatusLabel}` : null,
    input.busca?.trim() ? `Busca: “${input.busca.trim()}”` : null,
  ].filter(Boolean).join(' · ')

  const body = grupos.length > 0
    ? grupos.map(g => buildMesBlockHtml(g, input)).join('')
    : '<p class="empty">Nenhuma conta para este filtro.</p>'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Contas a Pagar — ${escapeHtml(periodLabel)}</title>
  <style>${PDF_CSS}</style>
</head>
<body>
  <div class="sheet">
    <header class="doc-head">
      <div class="doc-brand-line">
        <p class="doc-brand">${escapeHtml(empresa)}</p>
        <h1 class="doc-title">Contas a pagar</h1>
        <span class="period-chip">${escapeHtml(periodLabel)}</span>
      </div>
      <div class="doc-meta">
        ${filtrosExtras ? `<div>${escapeHtml(filtrosExtras)}</div>` : ''}
        <div><strong>${input.contas.length}</strong> conta(s) · ${grupos.length} mês(es) · Total <strong>${escapeHtml(fmtCur(totalGeral))}</strong> · Restante <strong>${escapeHtml(fmtCur(restanteGeral))}</strong></div>
        <div>Gerado em ${escapeHtml(geradoEm)}</div>
      </div>
    </header>

    ${kpiHtml}
    ${body}

    <footer class="doc-foot">
      Contas a Pagar · lista filtrada da tela · ${escapeHtml(fmtDate(todayISO()))}
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

export function buildContasPagarListaPdfFileName(periodFilter: PeriodFilter): string {
  const datePart = new Date().toISOString().slice(0, 10)
  const slug = formatPeriodFilterLabel(periodFilter)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `contas-pagar-${slug || 'lista'}-${datePart}.pdf`
}

/** Abre impressão/salvar PDF da lista filtrada (A4 paisagem compacto, por mês). */
export function imprimirContasPagarListaPdf(input: ContasPagarListaPdfExportInput): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('Permita pop-ups para exportar o PDF de contas a pagar.')
  }
  printWindow.document.write(buildDocumentHtml(input))
  printWindow.document.close()
}
