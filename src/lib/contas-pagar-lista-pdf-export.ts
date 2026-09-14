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
  .period-chip {
    display: inline-block;
    margin-top: 4px;
    padding: 3px 10px;
    border-radius: 999px;
    background: #f3ebe1;
    border: 1px solid #d8c8b4;
    font-size: 8pt;
    font-weight: 700;
    color: #6b3f12;
  }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
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
  .kpi-hint {
    display: block;
    margin-top: 2px;
    font-size: 7pt;
    color: #6b5244;
  }
  .mes-block {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-bottom: 10px;
    border: 1px solid #d8c8b4;
    border-radius: 6px;
    overflow: hidden;
    background: #fffcf8;
  }
  .mes-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 10px;
    padding: 8px 12px;
    background: linear-gradient(90deg, #f3ebe1 0%, #fffaf4 100%);
    border-bottom: 1px solid #e5d6c4;
    border-left: 4px solid #6b3f12;
  }
  .mes-head h2 {
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 12pt;
    text-transform: capitalize;
    color: #1a100c;
  }
  .mes-head .mes-meta {
    font-size: 7.5pt;
    color: #6b5244;
    text-align: right;
  }
  .mes-count {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    margin-left: 8px;
    border-radius: 999px;
    background: rgba(107,63,18,0.12);
    color: #6b3f12;
    font-size: 8pt;
    font-weight: 700;
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
  .dia-cell {
    width: 42px;
    text-align: center;
  }
  .dia-badge {
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-width: 34px;
    padding: 3px 4px;
    border-radius: 6px;
    background: #1a100c;
    color: #fffaf4;
    line-height: 1.1;
  }
  .dia-badge .num {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 12pt;
    font-weight: 700;
  }
  .dia-badge .dow {
    font-size: 5.5pt;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    opacity: 0.75;
  }
  .dia-badge.late {
    background: #9f1239;
  }
  .fornecedor { font-weight: 600; color: #1a100c; }
  .obs {
    margin-top: 2px;
    font-size: 7pt;
    font-weight: 400;
    color: #6b5244;
  }
  .right { text-align: right; font-variant-numeric: tabular-nums; }
  .valor { font-weight: 700; color: #6b3f12; }
  .pago { font-weight: 700; color: #146c38; }
  .restante { font-weight: 700; color: #1a100c; }
  .datas {
    font-variant-numeric: tabular-nums;
  }
  .datas .venc { font-weight: 700; }
  .datas .venc.late { color: #9f1239; }
  .datas .pag {
    display: block;
    margin-top: 2px;
    font-size: 7pt;
    color: #146c38;
  }
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
  .st-partial { background: #dbeafe; color: #1d4ed8; }
  .st-pend { background: #fef3c7; color: #92400e; }
  .mes-foot td {
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
    .mes-block, tr { break-inside: avoid; }
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

    return `
      <tr class="${isLate ? 'late' : ''}">
        <td class="dia-cell">
          <span class="dia-badge ${isLate ? 'late' : ''}">
            <span class="num">${escapeHtml(diaLabel(c.data_vencimento))}</span>
            <span class="dow">${escapeHtml(weekdayShort(c.data_vencimento))}</span>
          </span>
        </td>
        <td>
          <div class="fornecedor">${escapeHtml(nome)}</div>
          ${desc ? `<div class="obs">${escapeHtml(desc)}</div>` : ''}
          ${obs ? `<div class="obs">${escapeHtml(obs)}</div>` : ''}
        </td>
        <td>${escapeHtml(forma)}</td>
        <td>${c.numero_parcela}/${c.total_parcelas}</td>
        <td class="right valor">${escapeHtml(fmtCur(c.valor_parcela))}</td>
        <td class="right pago">${escapeHtml(fmtCur(pago))}</td>
        <td class="right restante">${escapeHtml(fmtCur(restante))}</td>
        <td class="datas">
          <span class="venc ${isLate ? 'late' : ''}">${escapeHtml(fmtDate(c.data_vencimento))}</span>
          ${status === 'pago' && dataPag
            ? `<span class="pag">Pago em ${escapeHtml(fmtDate(dataPag))}</span>`
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
          · Restante ${escapeHtml(fmtCur(totRest))}
        </div>
      </header>
      <table>
        <thead>
          <tr>
            <th>Dia</th>
            <th>Fornecedor</th>
            <th>Pagamento</th>
            <th>Parcela</th>
            <th class="right">Valor</th>
            <th class="right">Pago</th>
            <th class="right">Restante</th>
            <th>Datas</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr class="mes-foot">
            <td colspan="4">Subtotal do mês</td>
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
    ? `<div class="kpi-grid">${input.kpis.map(k => `
        <div class="kpi ${k.tone}">
          <span class="kpi-label">${escapeHtml(k.label)}</span>
          <span class="kpi-value">${escapeHtml(fmtCur(k.value))}</span>
          <span class="kpi-hint">${escapeHtml(k.hint)}</span>
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
      <div>
        <p class="doc-brand">${escapeHtml(empresa)}</p>
        <h1 class="doc-title">Contas a pagar</h1>
        <p class="doc-sub">Lista agrupada por mês · datas de vencimento e pagamento em destaque</p>
        <span class="period-chip">Período: ${escapeHtml(periodLabel)}</span>
      </div>
      <div class="doc-meta">
        ${filtrosExtras ? `<div>${escapeHtml(filtrosExtras)}</div>` : ''}
        <div>${input.contas.length} conta(s) · ${grupos.length} mês(es)</div>
        <div>Total ${escapeHtml(fmtCur(totalGeral))} · Restante ${escapeHtml(fmtCur(restanteGeral))}</div>
        <div>Gerado em ${escapeHtml(geradoEm)}</div>
      </div>
    </header>

    ${kpiHtml}
    ${body}

    <footer class="doc-foot">
      Exportação de Contas a Pagar · mesma lista filtrada da tela · gerado em ${escapeHtml(fmtDate(todayISO()))}.
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

/** Abre impressão/salvar PDF da lista filtrada (A4 paisagem, por mês). */
export function imprimirContasPagarListaPdf(input: ContasPagarListaPdfExportInput): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('Permita pop-ups para exportar o PDF de contas a pagar.')
  }
  printWindow.document.write(buildDocumentHtml(input))
  printWindow.document.close()
}
