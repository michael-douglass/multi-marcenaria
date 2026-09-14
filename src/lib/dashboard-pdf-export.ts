/**
 * Exporta o Dashboard financeiro em PDF (A4).
 * Replica as seções da página: saldos, indicadores e tabelas mensais.
 */
import { fmtCur } from '@/lib/utils'
import type { DadoGraficoMensal, FinanceiroStats } from '@/types'

export interface DashboardPdfMesComparativo {
  mes: string
  receitas: number
  despesas: number
}

export interface DashboardPdfExportInput {
  stats: FinanceiroStats
  empresaNome?: string | null
  anoReceitas: number
  receitasMensais: DadoGraficoMensal[]
  anoDespesas: number
  despesasMensais: DadoGraficoMensal[]
  anoComparativo: number
  comparativo: DashboardPdfMesComparativo[]
  anoSimulador: number
  simulador: DashboardPdfMesComparativo[]
  previsaoProximoReceber: number
  previsaoProximoPagar: number
}

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

function kpiCell(label: string, value: string, hint?: string): string {
  return `
    <div class="kpi">
      <span class="kpi-label">${escapeHtml(label)}</span>
      <span class="kpi-value">${escapeHtml(value)}</span>
      ${hint ? `<span class="kpi-hint">${escapeHtml(hint)}</span>` : ''}
    </div>
  `
}

function saldoCard(opts: {
  title: string
  subtitle: string
  principal: number
  entradaLabel: string
  entrada: number
  saidaLabel: string
  saida: number
}): string {
  const saldo = opts.entrada - opts.saida
  const sinal = saldo > 0 ? 'Positivo' : saldo < 0 ? 'Negativo' : 'Zerado'
  return `
    <article class="saldo-card">
      <header>
        <h3>${escapeHtml(opts.title)}</h3>
        <p>${escapeHtml(opts.subtitle)}</p>
      </header>
      <p class="saldo-principal">${escapeHtml(fmtCur(opts.principal))}</p>
      <div class="saldo-lines">
        <div><span>${escapeHtml(opts.entradaLabel)}</span><strong class="pos">${escapeHtml(fmtCur(opts.entrada))}</strong></div>
        <div><span>${escapeHtml(opts.saidaLabel)}</span><strong class="neg">${escapeHtml(fmtCur(opts.saida))}</strong></div>
        <div class="saldo-result">
          <span>Saldo · ${escapeHtml(sinal)}</span>
          <strong class="${moneyClass(saldo)}">${escapeHtml(fmtCur(saldo))}</strong>
        </div>
      </div>
    </article>
  `
}

function simpleMonthTable(
  title: string,
  ano: number,
  rows: DadoGraficoMensal[],
  valueLabel: string,
): string {
  const total = rows.reduce((acc, r) => acc + (Number(r.valor) || 0), 0)
  const body = rows.map(r => `
    <tr>
      <td>${escapeHtml(r.mes)}</td>
      <td class="right">${escapeHtml(fmtCur(r.valor))}</td>
    </tr>
  `).join('')

  return `
    <section class="block">
      <div class="block-head">
        <h2>${escapeHtml(title)}</h2>
        <span>Ano ${ano}</span>
      </div>
      <table>
        <thead>
          <tr><th>Mês</th><th class="right">${escapeHtml(valueLabel)}</th></tr>
        </thead>
        <tbody>${body || '<tr><td colspan="2" class="empty">Sem dados</td></tr>'}</tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td class="right">${escapeHtml(fmtCur(total))}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  `
}

function comparativoTable(
  title: string,
  ano: number,
  rows: DashboardPdfMesComparativo[],
  subtitle?: string,
): string {
  const totR = rows.reduce((acc, r) => acc + (Number(r.receitas) || 0), 0)
  const totD = rows.reduce((acc, r) => acc + (Number(r.despesas) || 0), 0)
  const totS = totR - totD
  const body = rows.map(r => {
    const saldo = (Number(r.receitas) || 0) - (Number(r.despesas) || 0)
    return `
      <tr>
        <td>${escapeHtml(r.mes)}</td>
        <td class="right pos">${escapeHtml(fmtCur(r.receitas))}</td>
        <td class="right neg">${escapeHtml(fmtCur(r.despesas))}</td>
        <td class="right ${moneyClass(saldo)}">${escapeHtml(fmtCur(saldo))}</td>
      </tr>
    `
  }).join('')

  return `
    <section class="block">
      <div class="block-head">
        <div>
          <h2>${escapeHtml(title)}</h2>
          ${subtitle ? `<p class="block-sub">${escapeHtml(subtitle)}</p>` : ''}
        </div>
        <span>Ano ${ano}</span>
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
        <tbody>${body || '<tr><td colspan="4" class="empty">Sem dados</td></tr>'}</tbody>
        <tfoot>
          <tr>
            <td>Total</td>
            <td class="right pos">${escapeHtml(fmtCur(totR))}</td>
            <td class="right neg">${escapeHtml(fmtCur(totD))}</td>
            <td class="right ${moneyClass(totS)}">${escapeHtml(fmtCur(totS))}</td>
          </tr>
        </tfoot>
      </table>
    </section>
  `
}

const PDF_CSS = `
  @page { size: A4 portrait; margin: 11mm 10mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    color: #2a1812;
    background: #f7f2ea;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 9pt;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet { max-width: 190mm; margin: 0 auto; }
  .doc-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 12px;
    padding-bottom: 10px;
    margin-bottom: 14px;
    border-bottom: 2.5px solid #3d2b1f;
  }
  .doc-brand {
    margin: 0 0 4px;
    font-size: 7.5pt;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #8a6a45;
  }
  .doc-title {
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 22pt;
    letter-spacing: 0.12em;
    color: #1f160f;
  }
  .doc-sub {
    margin: 4px 0 0;
    font-size: 8.5pt;
    color: #6b5244;
  }
  .doc-meta {
    text-align: right;
    font-size: 8pt;
    color: #5c4a38;
  }
  .section-label {
    margin: 16px 0 8px;
    padding-bottom: 4px;
    border-bottom: 1px solid #d8c8b4;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11pt;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #2a1812;
  }
  .section-label span {
    float: right;
    font-family: "Segoe UI", sans-serif;
    font-size: 7.5pt;
    letter-spacing: 0.12em;
    color: #8a7060;
    text-transform: uppercase;
    margin-top: 4px;
  }
  .saldo-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .saldo-card {
    break-inside: avoid;
    border: 1px solid #d8c8b4;
    border-radius: 6px;
    padding: 10px 12px;
    background: #fffcf8;
  }
  .saldo-card h3 {
    margin: 0;
    font-size: 8pt;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #6b5244;
  }
  .saldo-card header p {
    margin: 2px 0 0;
    font-size: 7.5pt;
    color: #8a7060;
  }
  .saldo-principal {
    margin: 8px 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 16pt;
    font-weight: 700;
    color: #047857;
  }
  .saldo-lines div {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    margin-top: 4px;
    font-size: 8pt;
  }
  .saldo-result {
    margin-top: 6px !important;
    padding-top: 6px;
    border-top: 1px solid #e5d6c4;
    font-weight: 700;
  }
  .kpi-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .kpi {
    break-inside: avoid;
    border: 1px solid #d8c8b4;
    border-radius: 6px;
    padding: 8px 10px;
    background: #fffcf8;
  }
  .kpi-label {
    display: block;
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #6b5244;
  }
  .kpi-value {
    display: block;
    margin-top: 4px;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 12pt;
    font-weight: 700;
    color: #1f160f;
  }
  .kpi-hint {
    display: block;
    margin-top: 2px;
    font-size: 7pt;
    color: #8a7060;
  }
  .two-col {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }
  .block {
    break-inside: avoid;
    margin-bottom: 10px;
    border: 1px solid #d8c8b4;
    border-radius: 6px;
    overflow: hidden;
    background: #fffcf8;
  }
  .block-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    gap: 8px;
    padding: 8px 10px;
    background: #f3ebe1;
    border-bottom: 1px solid #e5d6c4;
  }
  .block-head h2 {
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11pt;
    color: #1f160f;
  }
  .block-sub {
    margin: 2px 0 0;
    font-size: 7.5pt;
    color: #6b5244;
  }
  .block-head > span {
    font-size: 8pt;
    font-weight: 700;
    color: #8a6a45;
  }
  table {
    width: 100%;
    border-collapse: collapse;
  }
  th, td {
    padding: 5px 8px;
    border-bottom: 1px solid #ebe0d4;
    vertical-align: top;
  }
  th {
    font-size: 7pt;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #6b5244;
    background: #faf6f0;
    text-align: left;
  }
  td { font-size: 8.5pt; }
  tfoot td {
    font-weight: 700;
    background: #f3ebe1;
    border-bottom: none;
  }
  .right { text-align: right; font-variant-numeric: tabular-nums; }
  .pos { color: #047857; }
  .neg { color: #b91c1c; }
  .zero { color: #6b5244; }
  .empty { text-align: center; color: #8a7060; }
  .previsao-box {
    margin-top: 8px;
    padding: 8px 10px;
    border: 1px dashed #c9b089;
    border-radius: 6px;
    background: #fff8e8;
    font-size: 8pt;
  }
  .previsao-box strong { font-family: Georgia, serif; }
  .doc-foot {
    margin-top: 12px;
    padding-top: 8px;
    border-top: 1px solid #d8c8b4;
    font-size: 7.5pt;
    color: #7a6754;
    text-align: center;
  }
  @media print {
    body { background: #fff; }
    .saldo-card, .kpi, .block { break-inside: avoid; }
  }
`

function buildDocumentHtml(input: DashboardPdfExportInput): string {
  const s = input.stats
  const empresa = input.empresaNome?.trim() || 'Movelaria Garbo'
  const geradoEm = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const saldoMes = s.totalAReceber - s.totalAPagarMes
  const saldoProx = input.previsaoProximoReceber - input.previsaoProximoPagar

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Dashboard Financeiro — ${escapeHtml(empresa)}</title>
  <style>${PDF_CSS}</style>
</head>
<body>
  <div class="sheet">
    <header class="doc-head">
      <div>
        <p class="doc-brand">${escapeHtml(empresa)}</p>
        <h1 class="doc-title">DASHBOARD</h1>
        <p class="doc-sub">Painel financeiro — saldos, indicadores e movimento de caixa</p>
      </div>
      <div class="doc-meta">
        <div>Gerado em ${escapeHtml(geradoEm)}</div>
        <div>Folha A4 · mesma leitura da tela</div>
      </div>
    </header>

    <h2 class="section-label">Saldos <span>Entradas − saídas</span></h2>
    <div class="saldo-grid">
      ${saldoCard({
        title: 'A Receber Este Mês',
        subtitle: 'Parcelas vencendo no mês',
        principal: s.totalAReceber,
        entradaLabel: 'A receber',
        entrada: s.totalAReceber,
        saidaLabel: 'A pagar',
        saida: s.totalAPagarMes,
      })}
      ${saldoCard({
        title: 'Previsão Próx. Mês',
        subtitle: 'Parcelas vencendo no próximo mês',
        principal: input.previsaoProximoReceber,
        entradaLabel: 'A receber',
        entrada: input.previsaoProximoReceber,
        saidaLabel: 'A pagar',
        saida: input.previsaoProximoPagar,
      })}
    </div>
    <div class="previsao-box">
      Saldo deste mês: <strong class="${moneyClass(saldoMes)}">${escapeHtml(fmtCur(saldoMes))}</strong>
      &nbsp;·&nbsp;
      Saldo previsto próximo mês: <strong class="${moneyClass(saldoProx)}">${escapeHtml(fmtCur(saldoProx))}</strong>
    </div>

    <h2 class="section-label">Indicadores <span>Visão rápida</span></h2>
    <div class="kpi-grid">
      ${kpiCell('Clientes ativos', String(s.clientesAtivos), `${s.clientesPendentesContrato} pendentes plano`)}
      ${kpiCell('Recebido este mês', fmtCur(s.totalRecebidoMes), 'Pagamentos confirmados')}
      ${kpiCell('Atrasado', fmtCur(s.totalAtrasado), 'Total vencido e não pago')}
      ${kpiCell('Previsão ano', fmtCur(s.previsaoAno), 'Projeção baseada na média')}
      ${kpiCell('Receita líquida ano', fmtCur(s.receitaLiquidaAno), 'Recebido − pago (Jan–hoje)')}
      ${kpiCell('Novos clientes mês', String(s.novosClientesMes), `Ticket médio: ${fmtCur(s.ticketMedio)}`)}
    </div>

    <h2 class="section-label">Movimento mensal <span>Receitas e despesas</span></h2>
    <div class="two-col">
      ${simpleMonthTable('Receitas mensais', input.anoReceitas, input.receitasMensais, 'Recebido')}
      ${simpleMonthTable('Despesas mensais', input.anoDespesas, input.despesasMensais, 'Pago')}
    </div>

    <h2 class="section-label">Comparativo <span>A receber × a pagar em aberto</span></h2>
    ${comparativoTable(
      'A receber × A pagar',
      input.anoComparativo,
      input.comparativo,
      'Parcelas em aberto por vencimento (mesma conta do sistema)',
    )}

    <h2 class="section-label">Simulador <span>Base do sistema (antes de ajustes manuais)</span></h2>
    ${comparativoTable(
      'Projeção de caixa',
      input.anoSimulador,
      input.simulador,
      'Valores originais do sistema por mês',
    )}

    <footer class="doc-foot">
      Exportação do dashboard financeiro · números iguais aos cards e gráficos da tela.
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

export function buildDashboardPdfFileName(): string {
  const datePart = new Date().toISOString().slice(0, 10)
  return `dashboard-financeiro-${datePart}.pdf`
}

/**
 * Abre a janela de impressão/salvar PDF do dashboard (folha A4).
 * No diálogo do navegador, escolha “Salvar como PDF”.
 */
export function imprimirDashboardPdf(input: DashboardPdfExportInput): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('Permita pop-ups para exportar o PDF do dashboard.')
  }
  printWindow.document.write(buildDocumentHtml(input))
  printWindow.document.close()
}
