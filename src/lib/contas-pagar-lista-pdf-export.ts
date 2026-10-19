/**
 * Exporta Contas a Pagar em PDF A4 retrato — uma coluna, tipografia legível.
 * Agrupa por mês; o que não cabe na folha segue na próxima.
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

function weekdayShort(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })
    .format(d)
    .replace('.', '')
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
    grid-template-columns: repeat(auto-fit, minmax(52mm, 1fr));
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
  .mes-block { margin-bottom: 14px; }
  .mes-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 10px;
    padding: 6px 2px;
    margin-bottom: 2px;
    border-bottom: 1.5px solid var(--gold);
    break-after: avoid;
    page-break-after: avoid;
  }
  .mes-head h2 {
    margin: 0;
    font-family: Fraunces, Georgia, "Times New Roman", serif;
    font-size: 13pt;
    font-weight: 700;
    text-transform: capitalize;
    color: var(--ink);
  }
  .mes-count {
    display: inline-block;
    margin-left: 6px;
    padding: 1px 7px;
    border-radius: 3px;
    background: rgba(107,63,18,0.12);
    color: var(--gold);
    font-family: "Source Sans 3", sans-serif;
    font-size: 9pt;
    font-weight: 700;
  }
  .mes-meta {
    font-size: 9pt;
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .list {
    display: flex;
    flex-direction: column;
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
    color: var(--gold);
    line-height: 1.15;
  }
  .valores-sec {
    display: block;
    margin-top: 3px;
    font-size: 8.5pt;
    color: var(--ink-soft);
    font-variant-numeric: tabular-nums;
  }
  .valores-sec .pago { color: var(--ok); font-weight: 700; }
  .valores-sec .rest { color: var(--ink); font-weight: 700; }
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
  .st-partial { background: #dbeafe; color: #1d4ed8; }
  .st-pend { background: #fef3c7; color: #92400e; }
  .recv {
    display: block;
    margin-top: 3px;
    font-size: 8.5pt;
    color: var(--ok);
  }
  .mes-foot {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    padding: 8px 2px;
    border-top: 1.5px solid var(--ink);
    font-size: 9.5pt;
    font-weight: 700;
    break-inside: avoid;
    page-break-inside: avoid;
  }
  .mes-foot .totais {
    font-variant-numeric: tabular-nums;
    text-align: right;
  }
  .mes-foot .pago { color: var(--ok); }
  .mes-foot .rest { color: var(--ink); }
  .list-foot {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    margin-top: 4px;
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
    color: var(--gold);
    text-align: right;
  }
  .list-foot .total-sec {
    display: block;
    margin-top: 2px;
    font-family: "Source Sans 3", sans-serif;
    font-size: 9pt;
    color: var(--ink-soft);
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
    .entry, .mes-foot, .list-foot { break-inside: avoid; page-break-inside: avoid; }
  }
`

function buildMesBlockHtml(
  grupo: MesGrupo,
  input: ContasPagarListaPdfExportInput,
): string {
  let totValor = 0
  let totPago = 0
  let totRest = 0

  const entries = grupo.contas.map(c => {
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
    const dow = weekdayShort(c.data_vencimento)

    return `
      <article class="entry ${isLate ? 'late' : ''}">
        <div class="entry-main">
          <p class="cliente">${escapeHtml(nome)}</p>
          <p class="meta">
            Parcela ${c.numero_parcela}/${c.total_parcelas}
            <span class="sep">·</span>
            ${dow ? `${escapeHtml(dow)} · ` : ''}
            Venc.
            <span class="${isLate ? 'venc-late' : ''}">${escapeHtml(fmtDate(c.data_vencimento))}</span>
            <span class="sep">·</span>
            ${escapeHtml(forma)}
          </p>
          ${obsLine ? `<p class="detail">${escapeHtml(obsLine)}</p>` : ''}
        </div>
        <div class="entry-side">
          <span class="valor">${escapeHtml(fmtCur(c.valor_parcela))}</span>
          <span class="valores-sec">
            <span class="pago">Pago ${escapeHtml(fmtCur(pago))}</span>
            · <span class="rest">Rest. ${escapeHtml(fmtCur(restante))}</span>
          </span>
          <span class="status ${statusClass(status)}">
            ${escapeHtml(STATUS_LABEL[status] ?? status)}
          </span>
          ${status === 'pago' && dataPag
            ? `<span class="recv">em ${escapeHtml(fmtDate(dataPag))}</span>`
            : ''}
        </div>
      </article>
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
      <div class="list">
        ${entries}
        <div class="mes-foot">
          <span>Subtotal do mês</span>
          <span class="totais">
            ${escapeHtml(fmtCur(totValor))}
            · <span class="pago">Pago ${escapeHtml(fmtCur(totPago))}</span>
            · <span class="rest">Rest. ${escapeHtml(fmtCur(totRest))}</span>
          </span>
        </div>
      </div>
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

  const pagoGeral = input.contas.reduce((acc, c) => acc + getValorPagoConta(c), 0)

  const body = grupos.length > 0
    ? `${grupos.map(g => buildMesBlockHtml(g, input)).join('')}
      <footer class="list-foot">
        <span class="label">Total geral · ${input.contas.length} conta(s) · ${grupos.length} mês(es)</span>
        <span class="total">
          ${escapeHtml(fmtCur(totalGeral))}
          <span class="total-sec">Pago ${escapeHtml(fmtCur(pagoGeral))} · Restante ${escapeHtml(fmtCur(restanteGeral))}</span>
        </span>
      </footer>`
    : '<p class="empty">Nenhuma conta para este filtro.</p>'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Contas a Pagar — ${escapeHtml(periodLabel)}</title>
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
        <h1 class="doc-title">Contas a pagar</h1>
        <span class="period-chip">${escapeHtml(periodLabel)}</span>
      </div>
      <div class="doc-meta">
        ${filtrosExtras ? `<div>${escapeHtml(filtrosExtras)}</div>` : ''}
        <div><strong>${input.contas.length}</strong> conta(s) · Total <strong>${escapeHtml(fmtCur(totalGeral))}</strong> · Restante <strong>${escapeHtml(fmtCur(restanteGeral))}</strong> · Gerado em ${escapeHtml(geradoEm)}</div>
      </div>
    </header>

    ${kpiHtml}
    ${body}

    <footer class="doc-foot">
      Contas a Pagar · lista filtrada da tela · A4 retrato · ${escapeHtml(periodLabel)} · ${escapeHtml(fmtDate(todayISO()))}
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

/** Abre impressão/salvar PDF da lista filtrada (A4 retrato, uma coluna, por mês). */
export function imprimirContasPagarListaPdf(input: ContasPagarListaPdfExportInput): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('Permita pop-ups para exportar o PDF de contas a pagar.')
  }
  printWindow.document.write(buildDocumentHtml(input))
  printWindow.document.close()
}
