import { addMonths, fmtCur, fmtDate, todayISO } from '@/lib/utils'
import { getValorPagoConta } from '@/lib/contas-pagar-valores'
import type { PeriodFilter } from '@/components/ui/PeriodFilterBar'
import type { ContaPagar } from '@/types'

const MESES_PT = [
  'Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho',
  'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro',
]

const STATUS_LABEL: Record<string, string> = {
  pago: 'Pago',
  pendente: 'Pendente',
  parcialmente_pago: 'Parcial',
  vencido: 'Vencido',
}

function monthLabel(ym: string): string {
  const [year, month] = ym.split('-').map(Number)
  if (!year || !month) return ym
  return `${MESES_PT[month - 1]} de ${year}`
}

export function formatPeriodFilterLabel(period: PeriodFilter): string {
  const today = todayISO()

  switch (period.mode) {
    case 'all':
      return 'Todas as contas'
    case 'month':
      return monthLabel(today.slice(0, 7))
    case 'next-month': {
      const next = addMonths(`${today.slice(0, 7)}-01`, 1)
      return monthLabel(next.slice(0, 7))
    }
    case 'next-6m':
      return 'Próximos 6 meses'
    case 'fixed-month':
      return period.month ? monthLabel(period.month) : 'Mês selecionado'
    case 'fixed-day':
      return period.day ? fmtDate(period.day) : 'Dia selecionado'
    case 'date-range': {
      if (period.from && period.to) return `${fmtDate(period.from)} a ${fmtDate(period.to)}`
      if (period.from) return `A partir de ${fmtDate(period.from)}`
      if (period.to) return `Até ${fmtDate(period.to)}`
      return 'Período personalizado'
    }
    default:
      return 'Período'
  }
}

export interface ContaPagarExportRow {
  fornecedor: string
  pagamento: string
  parcela: string
  valorParcela: number
  pago: number
  restante: number
  vencimento: string
  status: string
  observacao: string
}

export function buildContaPagarExportRow(
  conta: ContaPagar,
  fornecedores: { id: string; nome: string }[],
  getStatus: (vencimento: string, status: string) => string,
): ContaPagarExportRow {
  const statusKey = getStatus(conta.data_vencimento, conta.status)
  const pago = getValorPagoConta(conta)

  return {
    fornecedor:
      conta.fornecedor_nome
      ?? fornecedores.find(f => f.id === conta.fornecedor_id)?.nome
      ?? conta.descricao
      ?? '—',
    pagamento: conta.movelaria_formas_pagamento_pagar?.nome ?? '—',
    parcela: `${conta.numero_parcela}/${conta.total_parcelas}`,
    valorParcela: conta.valor_parcela,
    pago,
    restante: Math.max(0, conta.valor_parcela - pago),
    vencimento: fmtDate(conta.data_vencimento),
    status: STATUS_LABEL[statusKey] ?? statusKey,
    observacao: conta.observacao?.trim() ?? '',
  }
}

function csvEscape(value: string | number): string {
  const text = String(value ?? '')
  if (/[;"\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function formatMoneyCsv(value: number): string {
  return value.toFixed(2).replace('.', ',')
}

export function downloadContasPagarCsv(
  rows: ContaPagarExportRow[],
  periodLabel: string,
): void {
  const header = [
    'Fornecedor',
    'Forma de Pagamento',
    'Parcela',
    'Valor da Parcela',
    'Pago',
    'Restante',
    'Vencimento',
    'Status',
    'Observação',
  ]

  const lines = [
    `Contas a Pagar - ${periodLabel}`,
    `Gerado em ${fmtDate(todayISO())}`,
    '',
    header.join(';'),
    ...rows.map(row => [
      csvEscape(row.fornecedor),
      csvEscape(row.pagamento),
      csvEscape(row.parcela),
      csvEscape(formatMoneyCsv(row.valorParcela)),
      csvEscape(formatMoneyCsv(row.pago)),
      csvEscape(formatMoneyCsv(row.restante)),
      csvEscape(row.vencimento),
      csvEscape(row.status),
      csvEscape(row.observacao),
    ].join(';')),
  ]

  const totais = rows.reduce(
    (acc, row) => ({
      valor: acc.valor + row.valorParcela,
      pago: acc.pago + row.pago,
      restante: acc.restante + row.restante,
    }),
    { valor: 0, pago: 0, restante: 0 },
  )

  lines.push('')
  lines.push([
    'TOTAL',
    '',
    '',
    csvEscape(formatMoneyCsv(totais.valor)),
    csvEscape(formatMoneyCsv(totais.pago)),
    csvEscape(formatMoneyCsv(totais.restante)),
    '',
    '',
    '',
  ].join(';'))

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  const safePeriod = periodLabel
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()

  anchor.href = url
  anchor.download = `contas-a-pagar-${safePeriod || 'export'}.csv`
  anchor.click()
  URL.revokeObjectURL(url)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function imprimirContasPagarPdf(
  rows: ContaPagarExportRow[],
  periodLabel: string,
): void {
  const totais = rows.reduce(
    (acc, row) => ({
      valor: acc.valor + row.valorParcela,
      pago: acc.pago + row.pago,
      restante: acc.restante + row.restante,
    }),
    { valor: 0, pago: 0, restante: 0 },
  )

  const tableRows = rows.map(row => `
    <tr>
      <td>${escapeHtml(row.fornecedor)}</td>
      <td>${escapeHtml(row.pagamento)}</td>
      <td class="center">${escapeHtml(row.parcela)}</td>
      <td class="right">${escapeHtml(fmtCur(row.valorParcela))}</td>
      <td class="right">${escapeHtml(fmtCur(row.pago))}</td>
      <td class="right">${escapeHtml(fmtCur(row.restante))}</td>
      <td class="center">${escapeHtml(row.vencimento)}</td>
      <td class="center">${escapeHtml(row.status)}</td>
    </tr>
    ${row.observacao ? `<tr class="obs"><td colspan="8">${escapeHtml(row.observacao)}</td></tr>` : ''}
  `).join('')

  const printWindow = window.open('', '_blank')
  if (!printWindow) return

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="pt-BR">
      <head>
        <meta charset="utf-8" />
        <title>Contas a Pagar - ${escapeHtml(periodLabel)}</title>
        <style>
          @page { size: A4 landscape; margin: 10mm; }
          * { box-sizing: border-box; }
          body {
            font-family: Arial, Helvetica, sans-serif;
            font-size: 10pt;
            color: #222;
            margin: 0;
            padding: 0;
          }
          h1 {
            font-size: 16pt;
            margin: 0 0 4px;
          }
          .meta {
            font-size: 9pt;
            color: #555;
            margin-bottom: 14px;
          }
          table {
            width: 100%;
            border-collapse: collapse;
          }
          th, td {
            border: 1px solid #ccc;
            padding: 6px 8px;
            vertical-align: top;
          }
          th {
            background: #f3f3f3;
            font-size: 9pt;
            text-transform: uppercase;
            letter-spacing: .03em;
          }
          tr.obs td {
            border-top: none;
            font-size: 8.5pt;
            color: #666;
            font-style: italic;
            padding-top: 0;
          }
          tfoot td {
            font-weight: 700;
            background: #fafafa;
          }
          .right { text-align: right; }
          .center { text-align: center; }
        </style>
      </head>
      <body>
        <h1>Contas a Pagar</h1>
        <div class="meta">
          Período: ${escapeHtml(periodLabel)}<br />
          Gerado em ${escapeHtml(fmtDate(todayISO()))} · ${rows.length} conta(s)
        </div>
        <table>
          <thead>
            <tr>
              <th>Fornecedor</th>
              <th>Pagamento</th>
              <th>Parcela</th>
              <th>Valor</th>
              <th>Pago</th>
              <th>Restante</th>
              <th>Vencimento</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRows}
          </tbody>
          <tfoot>
            <tr>
              <td colspan="3">Total</td>
              <td class="right">${escapeHtml(fmtCur(totais.valor))}</td>
              <td class="right">${escapeHtml(fmtCur(totais.pago))}</td>
              <td class="right">${escapeHtml(fmtCur(totais.restante))}</td>
              <td colspan="2"></td>
            </tr>
          </tfoot>
        </table>
        <script>
          window.onload = function() {
            window.print();
            setTimeout(function() { window.close(); }, 500);
          };
        </script>
      </body>
    </html>
  `)
  printWindow.document.close()
}

export function periodFilterRequiresMonth(period: PeriodFilter): boolean {
  return period.mode === 'all' || period.mode === 'next-6m'
}
