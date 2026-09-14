/**
 * Exporta o painel Visualização em PDF A4.
 * Inclui os blocos visíveis: materiais, calendário, obras do dia, atrasos, cobranças e ponto.
 */
import { addDaysISO, obrasParaDiaChegada } from '@/lib/obra-chegada-material'
import { obrasParaDiaCalendario } from '@/lib/obra-dias-trabalho'
import { getObraMontadorNomes } from '@/lib/obra-montadores'
import { getStatusEfetivo } from '@/lib/obra-progresso'
import { PONTO_STATUS_DIA_LABEL } from '@/lib/funcionario-constants'
import { formatHoraPonto, marcacaoHoraEfetiva } from '@/lib/funcionario-ponto'
import type { VisualizacaoObrasMesStats } from '@/lib/visualizacao-obras-stats'
import { fmtCur, fmtDate } from '@/lib/utils'
import type {
  ContaReceber,
  ObraFull,
  PontoControleFuncionarioRow,
  StatusKanbanObra,
} from '@/types'

const STATUS_LABEL: Record<StatusKanbanObra, string> = {
  datas_em_aberto: 'Em aberto',
  datas_em_atraso: 'Em atraso',
  datas_definidas: 'Agendada',
  em_andamento: 'Em andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

export interface VisualizacaoPdfClienteAtraso {
  cliente_nome: string
  parcelas: ContaReceber[]
  total: number
  vencimentoMaisAntigo: string
}

export interface VisualizacaoPdfAcompanhamentoGrupo {
  cliente_nome: string
  fotosCount: number
}

export interface VisualizacaoPdfExportInput {
  empresaNome?: string | null
  rangeLabel: string
  dataLabel: string
  horaLabel: string
  hoje: string
  diasAtivos: number[]
  /** Janela de dias (chegada / calendário). */
  rangeDays: string[]
  obrasTodas: ObraFull[]
  obrasCalendario: ObraFull[]
  calendarioStats: VisualizacaoObrasMesStats
  mesAtual: number
  anoAtual: number
  acompanhamento: VisualizacaoPdfAcompanhamentoGrupo[]
  obrasAtrasadas: ObraFull[]
  clientesAtrasados: VisualizacaoPdfClienteAtraso[]
  pontoRows: PontoControleFuncionarioRow[]
  pontoResumo: { presentes: number; atrasados: number; faltas: number; total: number }
  include: {
    chegada: boolean
    calendario: boolean
    obrasDoDia: boolean
    acompanhamento: boolean
    obrasAtrasadas: boolean
    cobrancas: boolean
    ponto: boolean
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function weekdayLabel(iso: string): string {
  const d = new Date(`${iso.slice(0, 10)}T12:00:00`)
  if (Number.isNaN(d.getTime())) return iso
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' })
    .format(d)
}

function montadoresLabel(obra: ObraFull): string {
  const nomes = getObraMontadorNomes(obra)
  const admin = obra.montador_admin_nome?.trim()
  const parts = [
    admin ? `Admin: ${admin}` : null,
    nomes.length ? nomes.join(', ') : null,
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Sem montadores'
}

function obraLinha(obra: ObraFull, extra?: string): string {
  const status = getStatusEfetivo(obra)
  return `
    <tr>
      <td>
        <strong>${escapeHtml(obra.cliente_nome)}</strong>
        ${obra.lousa ? `<div class="meta">${escapeHtml(obra.lousa)}</div>` : ''}
        <div class="meta">${escapeHtml(montadoresLabel(obra))}</div>
      </td>
      <td>${escapeHtml(STATUS_LABEL[status])}</td>
      <td class="nowrap">
        ${obra.data_prevista_inicio ? escapeHtml(fmtDate(obra.data_prevista_inicio)) : '?'}
        →
        ${obra.data_prevista_fim ? escapeHtml(fmtDate(obra.data_prevista_fim)) : '?'}
      </td>
      ${extra ?? ''}
    </tr>
  `
}

function section(title: string, subtitle: string, badge: string | number, body: string): string {
  return `
    <section class="block">
      <header class="block-head">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p class="block-sub">${escapeHtml(subtitle)}</p>
        </div>
        <span class="badge">${escapeHtml(String(badge))}</span>
      </header>
      <div class="block-body">${body}</div>
    </section>
  `
}

function empty(msg: string): string {
  return `<p class="empty">${escapeHtml(msg)}</p>`
}

function buildChegada(input: VisualizacaoPdfExportInput): string {
  const cols = input.rangeDays.map(iso => {
    const obras = obrasParaDiaChegada(input.obrasTodas, iso)
    const itens = obras.length
      ? `<ul>${obras.map(o => `<li><strong>${escapeHtml(o.cliente_nome)}</strong>${o.lousa ? ` — ${escapeHtml(o.lousa)}` : ''}</li>`).join('')}</ul>`
      : '<p class="empty-sm">—</p>'
    return `
      <div class="day-col">
        <div class="day-col-head">${escapeHtml(weekdayLabel(iso))} <span>${obras.length}</span></div>
        ${itens}
      </div>
    `
  }).join('')

  return section(
    'Chegada de Materiais',
    input.rangeLabel,
    input.rangeDays.reduce((n, iso) => n + obrasParaDiaChegada(input.obrasTodas, iso).length, 0),
    `<div class="day-grid">${cols}</div>`,
  )
}

function buildCalendario(input: VisualizacaoPdfExportInput): string {
  const cols = input.rangeDays.map(iso => {
    const obras = obrasParaDiaCalendario(input.obrasCalendario, iso, input.diasAtivos)
    const itens = obras.length
      ? `<ul>${obras.map(o => `<li><strong>${escapeHtml(o.cliente_nome)}</strong></li>`).join('')}</ul>`
      : '<p class="empty-sm">—</p>'
    return `
      <div class="day-col">
        <div class="day-col-head">${escapeHtml(weekdayLabel(iso))} <span>${obras.length}</span></div>
        ${itens}
      </div>
    `
  }).join('')

  const stats = `
    <div class="stats">
      <span>Ativas: <strong>${input.calendarioStats.total}</strong></span>
      <span>A finalizar no mês: <strong>${input.calendarioStats.aFinalizarMes}</strong></span>
      <span>Concluídas no mês: <strong>${input.calendarioStats.concluidasMes}</strong></span>
      <span>Mês ref.: ${String(input.mesAtual).padStart(2, '0')}/${input.anoAtual}</span>
    </div>
  `

  return section(
    'Calendário de Obras',
    input.rangeLabel,
    input.obrasCalendario.length,
    `${stats}<div class="day-grid">${cols}</div>`,
  )
}

function buildObrasDoDia(input: VisualizacaoPdfExportInput): string {
  const amanha = addDaysISO(input.hoje, 1)
  const hojeObras = obrasParaDiaCalendario(input.obrasCalendario, input.hoje, input.diasAtivos)
  const amanhaObras = obrasParaDiaCalendario(input.obrasCalendario, amanha, input.diasAtivos)

  const tabela = (titulo: string, iso: string, obras: ObraFull[]) => `
    <h3 class="subhead">${escapeHtml(titulo)} · ${escapeHtml(fmtDate(iso))} · ${obras.length}</h3>
    ${obras.length === 0
      ? empty('Nenhuma obra neste dia.')
      : `<table>
          <thead><tr><th>Cliente</th><th>Status</th><th>Datas</th></tr></thead>
          <tbody>${obras.map(o => obraLinha(o)).join('')}</tbody>
        </table>`}
  `

  return section(
    'Obras do Dia',
    `${fmtDate(input.hoje)} · amanhã ${fmtDate(amanha)}`,
    hojeObras.length + amanhaObras.length,
    `${tabela('Hoje', input.hoje, hojeObras)}${tabela('Amanhã', amanha, amanhaObras)}`,
  )
}

function buildAcompanhamento(input: VisualizacaoPdfExportInput): string {
  if (input.acompanhamento.length === 0) {
    return section(
      'Acompanhamento de Obras',
      `Hoje · ${fmtDate(input.hoje)}`,
      0,
      empty('Sem fotos/evolução nas obras de hoje.'),
    )
  }

  const totalFotos = input.acompanhamento.reduce((s, g) => s + g.fotosCount, 0)
  const rows = input.acompanhamento.map(g => `
    <tr>
      <td><strong>${escapeHtml(g.cliente_nome)}</strong></td>
      <td class="right">${g.fotosCount} foto(s)</td>
    </tr>
  `).join('')

  return section(
    'Acompanhamento de Obras',
    `Hoje · ${fmtDate(input.hoje)} · obras do dia`,
    totalFotos,
    `<table>
      <thead><tr><th>Cliente</th><th class="right">Evolução</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`,
  )
}

function buildObrasAtrasadas(input: VisualizacaoPdfExportInput): string {
  if (input.obrasAtrasadas.length === 0) {
    return section('Obras Atrasadas', 'Prazo vencido', 0, empty('Nenhuma obra em atraso no momento.'))
  }

  return section(
    'Obras Atrasadas',
    'Prazo de entrega vencido',
    input.obrasAtrasadas.length,
    `<table>
      <thead><tr><th>Cliente</th><th>Status</th><th>Datas</th><th>Entrega</th></tr></thead>
      <tbody>${input.obrasAtrasadas.map(o => obraLinha(
        o,
        `<td class="late nowrap">até ${escapeHtml(fmtDate(o.data_prevista_fim))}</td>`,
      )).join('')}</tbody>
    </table>`,
  )
}

function buildCobrancas(input: VisualizacaoPdfExportInput): string {
  if (input.clientesAtrasados.length === 0) {
    return section('Cobranças Atrasadas', 'Parcelas vencidas', 0, empty('Nenhum cliente em atraso.'))
  }

  const total = input.clientesAtrasados.reduce((s, c) => s + c.total, 0)
  const rows = input.clientesAtrasados.map(g => `
    <tr>
      <td>
        <strong>${escapeHtml(g.cliente_nome)}</strong>
        <div class="meta">${g.parcelas.length} parcela(s) · desde ${escapeHtml(fmtDate(g.vencimentoMaisAntigo))}</div>
      </td>
      <td class="right late">${escapeHtml(fmtCur(g.total))}</td>
    </tr>
  `).join('')

  return section(
    'Cobranças Atrasadas',
    'Clientes com parcelas vencidas',
    input.clientesAtrasados.length,
    `<table>
      <thead><tr><th>Cliente</th><th class="right">Total</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td>Total</td><td class="right late">${escapeHtml(fmtCur(total))}</td></tr></tfoot>
    </table>`,
  )
}

function buildPonto(input: VisualizacaoPdfExportInput): string {
  const { presentes, atrasados, faltas, total } = input.pontoResumo
  const chips = `
    <div class="stats">
      <span>Equipe <strong>${total}</strong></span>
      <span>Presentes <strong>${presentes}</strong></span>
      <span>Atraso <strong>${atrasados}</strong></span>
      <span>Faltas <strong>${faltas}</strong></span>
    </div>
  `

  if (input.pontoRows.length === 0) {
    return section(
      'Ponto',
      `Hoje · ${fmtDate(input.hoje)}`,
      0,
      `${chips}${empty('Nenhum funcionário de campo cadastrado.')}`,
    )
  }

  const rows = input.pontoRows.map(r => {
    const entrada = r.marcacoes.find(m => m.tipo === 'entrada') ?? r.entrada
    const chegada = formatHoraPonto(entrada ? marcacaoHoraEfetiva(entrada) : null)
    const previsto = formatHoraPonto(r.jornada?.hora_entrada ?? r.hora_prevista)
    return `
      <tr>
        <td><strong>${escapeHtml(r.nome)}</strong></td>
        <td>${escapeHtml(PONTO_STATUS_DIA_LABEL[r.status_dia] ?? r.status_dia)}</td>
        <td class="nowrap">${escapeHtml(chegada)}</td>
        <td class="nowrap muted">${escapeHtml(previsto)}</td>
      </tr>
    `
  }).join('')

  return section(
    'Ponto',
    `Hoje · ${fmtDate(input.hoje)} · registros diários da equipe`,
    total,
    `${chips}<table>
      <thead><tr><th>Funcionário</th><th>Status</th><th>Entrada</th><th>Previsto</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`,
  )
}

const PDF_CSS = `
  @page { size: A4 portrait; margin: 10mm 9mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0; padding: 0;
    color: #1a100c;
    background: #f4f0ea;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 8.5pt;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet { max-width: 192mm; margin: 0 auto; }
  .doc-head {
    display: flex; justify-content: space-between; align-items: flex-end; gap: 12px;
    padding-bottom: 8px; margin-bottom: 12px; border-bottom: 2.5px solid #2a1812;
  }
  .doc-brand { margin: 0 0 3px; font-size: 7pt; letter-spacing: .18em; text-transform: uppercase; color: #8a6a45; }
  .doc-title { margin: 0; font-family: Georgia, "Times New Roman", serif; font-size: 22pt; color: #1a100c; }
  .doc-sub { margin: 4px 0 0; font-size: 8pt; color: #4a3428; }
  .doc-meta { text-align: right; font-size: 8pt; color: #5c4a38; }
  .doc-meta .clock { font-family: Georgia, serif; font-size: 16pt; font-weight: 700; color: #1a100c; }
  .capitalize { text-transform: capitalize; }
  .block {
    break-inside: avoid; page-break-inside: avoid;
    margin-bottom: 10px; border: 1px solid #d8c8b4; border-radius: 6px; overflow: hidden; background: #fffcf8;
  }
  .block-head {
    display: flex; justify-content: space-between; align-items: center; gap: 8px;
    padding: 8px 10px; background: #f3ebe1; border-bottom: 1px solid #e5d6c4; border-left: 4px solid #6b3f12;
  }
  .block-head h2 { margin: 0; font-family: Georgia, serif; font-size: 11pt; }
  .block-sub { margin: 2px 0 0; font-size: 7.5pt; color: #6b5244; }
  .badge {
    min-width: 22px; height: 22px; padding: 0 7px; display: inline-flex; align-items: center; justify-content: center;
    border-radius: 999px; background: rgba(107,63,18,.14); color: #6b3f12; font-size: 8pt; font-weight: 700;
  }
  .block-body { padding: 8px 10px 10px; }
  .day-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 6px; }
  .day-col { border: 1px solid #e5d6c4; border-radius: 4px; padding: 5px; background: #fff; min-height: 48px; }
  .day-col-head {
    display: flex; justify-content: space-between; align-items: center;
    font-size: 7pt; font-weight: 700; text-transform: capitalize; color: #6b3f12; margin-bottom: 4px;
  }
  .day-col-head span { color: #8a7060; }
  .day-col ul { margin: 0; padding-left: 14px; }
  .day-col li { margin: 1px 0; font-size: 7.5pt; }
  .stats { display: flex; flex-wrap: wrap; gap: 8px 14px; margin-bottom: 8px; font-size: 7.5pt; color: #4a3428; }
  .subhead { margin: 10px 0 6px; font-size: 9pt; color: #6b3f12; }
  table { width: 100%; border-collapse: collapse; }
  th, td { padding: 4px 6px; border-bottom: 1px solid #ebe0d4; vertical-align: top; }
  th { font-size: 6.5pt; letter-spacing: .06em; text-transform: uppercase; color: #6b5244; background: #faf6f0; text-align: left; }
  td { font-size: 8pt; }
  tfoot td { font-weight: 700; background: #f3ebe1; border-bottom: none; }
  .meta { font-size: 7pt; color: #6b5244; margin-top: 1px; }
  .right { text-align: right; font-variant-numeric: tabular-nums; }
  .nowrap { white-space: nowrap; font-variant-numeric: tabular-nums; }
  .late { color: #9f1239; font-weight: 700; }
  .muted { color: #6b5244; }
  .empty, .empty-sm { margin: 0; text-align: center; color: #8a7060; }
  .empty { padding: 10px; font-size: 8pt; }
  .empty-sm { font-size: 7.5pt; padding: 4px 0; }
  .doc-foot {
    margin-top: 8px; padding-top: 6px; border-top: 1px solid #d8c8b4;
    font-size: 7pt; color: #7a6754; text-align: center;
  }
  @media print {
    body { background: #fff; }
    .block { break-inside: avoid; }
  }
`

function buildDocumentHtml(input: VisualizacaoPdfExportInput): string {
  const empresa = input.empresaNome?.trim() || 'Movelaria Garbo'
  const geradoEm = new Date().toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })

  const parts: string[] = []
  if (input.include.chegada) parts.push(buildChegada(input))
  if (input.include.calendario) parts.push(buildCalendario(input))
  if (input.include.obrasDoDia) parts.push(buildObrasDoDia(input))
  if (input.include.acompanhamento) parts.push(buildAcompanhamento(input))
  if (input.include.obrasAtrasadas) parts.push(buildObrasAtrasadas(input))
  if (input.include.cobrancas) parts.push(buildCobrancas(input))
  if (input.include.ponto) parts.push(buildPonto(input))

  const body = parts.length > 0
    ? parts.join('')
    : empty('Nenhum painel disponível para exportar no momento.')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Visualização — ${escapeHtml(input.rangeLabel)}</title>
  <style>${PDF_CSS}</style>
</head>
<body>
  <div class="sheet">
    <header class="doc-head">
      <div>
        <p class="doc-brand">${escapeHtml(empresa)}</p>
        <h1 class="doc-title">Visualização</h1>
        <p class="doc-sub">Painel operacional · janela ${escapeHtml(input.rangeLabel)}</p>
      </div>
      <div class="doc-meta">
        <div class="clock">${escapeHtml(input.horaLabel)}</div>
        <div class="capitalize">${escapeHtml(input.dataLabel)}</div>
        <div>Gerado em ${escapeHtml(geradoEm)}</div>
      </div>
    </header>
    ${body}
    <footer class="doc-foot">
      Exportação do painel Visualização · mesmos blocos da tela.
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

export function buildVisualizacaoPdfFileName(): string {
  return `visualizacao-${new Date().toISOString().slice(0, 10)}.pdf`
}

/** Abre impressão/salvar PDF do painel Visualização (A4). */
export function imprimirVisualizacaoPdf(input: VisualizacaoPdfExportInput): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('Permita pop-ups para exportar o PDF da visualização.')
  }
  printWindow.document.write(buildDocumentHtml(input))
  printWindow.document.close()
}
