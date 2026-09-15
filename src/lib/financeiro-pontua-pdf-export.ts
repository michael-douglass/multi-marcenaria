/**
 * Exporta o painel Financeiro · Pontua Garbo em PDF A4.
 * Replica métricas, série mensal, solicitantes e lista de arquitetos.
 */
import { formatBRLPontua, tituloReconhecidoPontuaGarbo } from '@/lib/pontua-garbo-arquiteto'
import type { PontuaMetricas, SaqueSolicitante } from '@/lib/pontua-garbo-metricas'
import type { PrestadorFinanceiro } from '@/hooks/usePontuaGarboFinanceiro'
import { fmtDate } from '@/lib/utils'

export interface FinanceiroPontuaPdfExportInput {
  metricas: PontuaMetricas
  /** Período dos gráficos: 6 ou 12 meses. */
  meses: number
  arquitetos: PrestadorFinanceiro[]
  empresaNome?: string | null
  busca?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(n: number): string {
  return formatBRLPontua(n)
}

function deltaLabel(delta: number | null): string {
  if (delta === null || !Number.isFinite(delta)) return '—'
  const sinal = delta >= 0 ? '+' : ''
  return `${sinal}${delta.toFixed(0)}%`
}

const PDF_CSS = `
  @page { size: A4 portrait; margin: 10mm 9mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    color: #1a100c;
    background: #f7f2ea;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 8.5pt;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet { max-width: 192mm; margin: 0 auto; }
  .doc-head {
    display: flex; justify-content: space-between; align-items: flex-end; gap: 12px;
    padding-bottom: 8px; margin-bottom: 12px; border-bottom: 2.5px solid #3d2b1f;
  }
  .doc-brand {
    margin: 0 0 3px; font-size: 7pt; letter-spacing: .18em;
    text-transform: uppercase; color: #8a6a45;
  }
  .doc-title {
    margin: 0; font-family: Georgia, "Times New Roman", serif;
    font-size: 20pt; font-style: italic; color: #1a100c;
  }
  .doc-sub { margin: 4px 0 0; font-size: 8pt; color: #4a3428; max-width: 28rem; }
  .doc-meta { text-align: right; font-size: 7.5pt; color: #5c4a38; }
  .period-chip {
    display: inline-block; margin-top: 4px; padding: 3px 10px;
    border-radius: 999px; background: #f3ebe1; border: 1px solid #d8c8b4;
    font-size: 8pt; font-weight: 700; color: #6b3f12;
  }
  .kpi-grid {
    display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 12px;
  }
  .kpi {
    border: 1px solid #d8c8b4; border-radius: 6px; padding: 8px 10px; background: #fffaf4;
  }
  .kpi-label {
    display: block; font-size: 7pt; font-weight: 700; letter-spacing: .1em;
    text-transform: uppercase; color: #6b5244;
  }
  .kpi-value {
    display: block; margin-top: 3px;
    font-family: Georgia, "Times New Roman", serif; font-size: 14pt; font-weight: 700;
  }
  .kpi-value.gold { color: #6b3f12; }
  .kpi-value.sky { color: #0369a1; }
  .kpi-value.ok { color: #146c38; }
  .kpi-hint { display: block; margin-top: 2px; font-size: 7pt; color: #6b5244; }
  .block {
    break-inside: avoid; page-break-inside: avoid;
    margin-bottom: 10px; border: 1px solid #d8c8b4; border-radius: 6px;
    overflow: hidden; background: #fffcf8;
  }
  .block-head {
    display: flex; justify-content: space-between; align-items: baseline; gap: 8px;
    padding: 7px 10px; background: #f3ebe1; border-bottom: 1px solid #e5d6c4;
    border-left: 4px solid #6b3f12;
  }
  .block-head h2 {
    margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: 11pt;
  }
  .block-head span { font-size: 7.5pt; color: #6b5244; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 5px 7px; border-bottom: 1px solid #ebe0d4; vertical-align: top; }
  th {
    font-size: 6.5pt; letter-spacing: .08em; text-transform: uppercase;
    color: #6b5244; background: #faf6f0; text-align: left;
  }
  td { font-size: 8pt; }
  tfoot td { font-weight: 700; background: #f3ebe1; border-bottom: none; }
  .right { text-align: right; font-variant-numeric: tabular-nums; }
  .name { font-weight: 600; color: #1a100c; }
  .meta { font-size: 7pt; color: #6b5244; margin-top: 1px; }
  .gold { color: #6b3f12; font-weight: 700; }
  .ok { color: #146c38; font-weight: 700; }
  .empty { margin: 0; padding: 12px; text-align: center; color: #8a7060; font-size: 8pt; }
  .doc-foot {
    margin-top: 8px; padding-top: 6px; border-top: 1px solid #d8c8b4;
    font-size: 7pt; color: #7a6754; text-align: center;
  }
  @media print {
    body { background: #fff; }
    .block, .kpi { break-inside: avoid; }
  }
`

function buildKpis(m: PontuaMetricas): string {
  return `
    <div class="kpi-grid">
      <div class="kpi">
        <span class="kpi-label">Cadastrados neste mês</span>
        <span class="kpi-value gold">${m.cadastradosMes}</span>
        <span class="kpi-hint">${m.cadastradosMesAnterior} no mês anterior · Δ ${escapeHtml(deltaLabel(m.deltaCadastrados))} · ${m.totalCadastrados} no total</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">Arquitetos pontuando</span>
        <span class="kpi-value sky">${m.pontuando}</span>
        <span class="kpi-hint">${m.percentualPontuando.toFixed(0)}% dos cadastrados · ${m.pontuaramNoMes} com venda ganha neste mês</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">Solicitaram saque</span>
        <span class="kpi-value gold">${m.solicitantesPendentes.length}</span>
        <span class="kpi-hint">${escapeHtml(money(m.totalSolicitadoPendente))} aguardando aprovação</span>
      </div>
      <div class="kpi">
        <span class="kpi-label">Média de comissão paga</span>
        <span class="kpi-value ok">${escapeHtml(money(m.mediaComissaoPaga))}</span>
        <span class="kpi-hint">por quem já recebeu (${m.arquitetosComComissaoPaga}) · ${escapeHtml(money(m.totalComissaoPaga))} pagos</span>
      </div>
    </div>
  `
}

function buildSerie(m: PontuaMetricas): string {
  const totCad = m.serie.reduce((s, b) => s + b.cadastrados, 0)
  const totPont = m.serie.reduce((s, b) => s + b.pontuaram, 0)
  const totPago = m.serie.reduce((s, b) => s + b.comissaoPaga, 0)
  const rows = m.serie.map(b => `
    <tr>
      <td class="name">${escapeHtml(b.labelLongo)}</td>
      <td class="right">${b.cadastrados}</td>
      <td class="right">${b.pontuaram}</td>
      <td class="right ok">${escapeHtml(money(b.comissaoPaga))}</td>
    </tr>
  `).join('')

  return `
    <section class="block">
      <div class="block-head">
        <h2>Movimento mês a mês</h2>
        <span>Cadastros · quem pontuou · comissão paga</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Mês</th>
            <th class="right">Cadastrados</th>
            <th class="right">Pontuaram</th>
            <th class="right">Comissão paga</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td>Total no período</td>
            <td class="right">${totCad}</td>
            <td class="right">${totPont}</td>
            <td class="right ok">${escapeHtml(money(totPago))}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  `
}

function buildSolicitantes(list: SaqueSolicitante[], totalPendente: number): string {
  if (list.length === 0) {
    return `
      <section class="block">
        <div class="block-head"><h2>Quem pediu saque</h2><span>Pendentes</span></div>
        <p class="empty">Nenhum saque aguardando aprovação.</p>
      </section>
    `
  }

  const rows = list.map(s => {
    const pendentes = s.pedidos.filter(p => p.status === 'pendente').length
    const quando = s.ultimaSolicitacao ? fmtDate(s.ultimaSolicitacao) : '—'
    return `
      <tr>
        <td>
          <div class="name">${escapeHtml(s.nome)}</div>
          <div class="meta">${escapeHtml(tituloReconhecidoPontuaGarbo(s.titulo))} · pediu em ${escapeHtml(quando)}</div>
        </td>
        <td class="right">${pendentes}</td>
        <td class="right gold">${escapeHtml(money(s.totalPendente))}</td>
        <td class="right ok">${escapeHtml(money(s.totalAprovado))}</td>
      </tr>
    `
  }).join('')

  return `
    <section class="block">
      <div class="block-head">
        <h2>Quem pediu saque</h2>
        <span>${list.length} · ${escapeHtml(money(totalPendente))} pendente</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Arquiteto</th>
            <th class="right">Pedidos</th>
            <th class="right">Pendente</th>
            <th class="right">Já aprovado</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    </section>
  `
}

function buildArquitetos(list: PrestadorFinanceiro[]): string {
  if (list.length === 0) {
    return `
      <section class="block">
        <div class="block-head"><h2>Arquitetos</h2><span>0</span></div>
        <p class="empty">Nenhum arquiteto neste recorte.</p>
      </section>
    `
  }

  const sorted = [...list].sort((a, b) => {
    if (b.saldoParaSacar !== a.saldoParaSacar) return b.saldoParaSacar - a.saldoParaSacar
    return a.nome.localeCompare(b.nome, 'pt-BR')
  })

  const totSaldo = sorted.reduce((s, p) => s + p.saldoParaSacar, 0)
  const totCom = sorted.reduce((s, p) => s + p.totalComissao, 0)
  const totRet = sorted.reduce((s, p) => s + p.totalRetirado, 0)

  const rows = sorted.map(p => `
    <tr>
      <td>
        <div class="name">${escapeHtml(p.nome)}</div>
        <div class="meta">${escapeHtml(tituloReconhecidoPontuaGarbo(p.titulo))}${p.email ? ` · ${escapeHtml(p.email)}` : ''}</div>
      </td>
      <td class="right">${p.leads.length}</td>
      <td class="right">${escapeHtml(money(p.totalComissao))}</td>
      <td class="right ok">${escapeHtml(money(p.totalRetirado))}</td>
      <td class="right gold">${escapeHtml(money(p.saldoParaSacar))}</td>
      <td class="right">${escapeHtml(money(p.totalAguardandoLiberacao))}</td>
    </tr>
  `).join('')

  return `
    <section class="block">
      <div class="block-head">
        <h2>Lista de arquitetos</h2>
        <span>${sorted.length} cadastrado(s)</span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Arquiteto</th>
            <th class="right">Leads</th>
            <th class="right">Comissão</th>
            <th class="right">Retirado</th>
            <th class="right">Saldo</th>
            <th class="right">Aguardando</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
        <tfoot>
          <tr>
            <td colspan="2">Totais</td>
            <td class="right">${escapeHtml(money(totCom))}</td>
            <td class="right ok">${escapeHtml(money(totRet))}</td>
            <td class="right gold">${escapeHtml(money(totSaldo))}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </section>
  `
}

function buildDocumentHtml(input: FinanceiroPontuaPdfExportInput): string {
  const empresa = input.empresaNome?.trim() || 'Movelaria Garbo'
  const geradoEm = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
  const buscaHint = input.busca?.trim()
    ? `<div>Busca: “${escapeHtml(input.busca.trim())}”</div>`
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Financeiro Pontua Garbo — ${input.meses} meses</title>
  <style>${PDF_CSS}</style>
</head>
<body>
  <div class="sheet">
    <header class="doc-head">
      <div>
        <p class="doc-brand">${escapeHtml(empresa)}</p>
        <h1 class="doc-title">Painel do Pontua</h1>
        <p class="doc-sub">Cadastro de arquitetos, quem está pontuando, quem pediu saque e comissão paga.</p>
        <span class="period-chip">Período: últimos ${input.meses} meses</span>
      </div>
      <div class="doc-meta">
        ${buscaHint}
        <div>${input.arquitetos.length} arquiteto(s) no PDF</div>
        <div>Gerado em ${escapeHtml(geradoEm)}</div>
      </div>
    </header>

    ${buildKpis(input.metricas)}
    ${buildSerie(input.metricas)}
    ${buildSolicitantes(input.metricas.solicitantesPendentes, input.metricas.totalSolicitadoPendente)}
    ${buildArquitetos(input.arquitetos)}

    <footer class="doc-foot">
      Exportação Financeiro · Pontua Garbo · números iguais aos cards e gráficos da tela.
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

export function buildFinanceiroPontuaPdfFileName(meses: number): string {
  const datePart = new Date().toISOString().slice(0, 10)
  return `financeiro-pontua-${meses}m-${datePart}.pdf`
}

/** Abre impressão/salvar PDF do painel Pontua (A4). */
export function imprimirFinanceiroPontuaPdf(input: FinanceiroPontuaPdfExportInput): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('Permita pop-ups para exportar o PDF do Pontua.')
  }
  printWindow.document.write(buildDocumentHtml(input))
  printWindow.document.close()
}
