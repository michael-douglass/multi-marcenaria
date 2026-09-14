/**
 * Exporta as Filas de Obras em PDF (A4).
 * Abre uma página de impressão com a mesma ordem da tela:
 * data de entrega (mais cedo → mais tarde) e, dentro do dia, atrasadas primeiro.
 */
import type { FilaDataColuna } from '@/lib/obra-fila'
import {
  getObraComissaoItensVisiveis,
  formatComissaoStripLabel,
  sumObraComissao,
} from '@/lib/obra-comissao'
import { getObraMontadorNomes } from '@/lib/obra-montadores'
import { calcObraProgresso, getStatusEfetivo } from '@/lib/obra-progresso'
import { fmtCur, fmtDate } from '@/lib/utils'
import type { ObraFull, StatusKanbanObra } from '@/types'

const STATUS_SHORT: Record<StatusKanbanObra, string> = {
  datas_em_aberto: 'Em aberto',
  datas_em_atraso: 'Atraso',
  datas_definidas: 'Agendada',
  em_andamento: 'Andamento',
  concluida: 'Concluída',
  cancelada: 'Cancelada',
}

const STATUS_COR: Record<StatusKanbanObra, string> = {
  datas_em_aberto: '#6b7280',
  datas_em_atraso: '#ef4444',
  datas_definidas: '#3b82f6',
  em_andamento: '#f59e0b',
  concluida: '#10b981',
  cancelada: '#9ca3af',
}

export interface ObraFilaPdfExportInput {
  colunas: FilaDataColuna[]
  /** Ex.: "Março 2026" ou "Dia 14/03/2026" */
  filtroLabel: string
  /** Se true, mostra comissão de todos; se false, só do prestador logado. */
  showAllComissao?: boolean
  prestadorId?: string | null
  empresaNome?: string | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function prazoTag(col: FilaDataColuna): string {
  if (col.atrasada) return 'Atraso'
  if (col.hoje) return 'Hoje'
  return 'Prazo'
}

function formatDatasPrevistas(obra: ObraFull): string {
  const ini = obra.data_prevista_inicio ? fmtDate(obra.data_prevista_inicio) : '?'
  const fim = obra.data_prevista_fim ? fmtDate(obra.data_prevista_fim) : '?'
  return `${ini} → ${fim}`
}

function formatDatasOriginais(obra: ObraFull): string | null {
  if (!obra.data_prevista_inicio_original && !obra.data_prevista_fim_original) return null
  const ini = obra.data_prevista_inicio_original
    ? fmtDate(obra.data_prevista_inicio_original)
    : '?'
  const fim = obra.data_prevista_fim_original
    ? fmtDate(obra.data_prevista_fim_original)
    : '?'
  return `${ini} → ${fim}`
}

function buildComissaoHtml(
  obra: ObraFull,
  showAll: boolean,
  prestadorId?: string | null,
): string {
  const itens = getObraComissaoItensVisiveis(obra, { prestadorId, showAll })
  const total = sumObraComissao(itens)
  const label = formatComissaoStripLabel(itens, fmtCur)
  if (!label || total <= 0) return ''

  return `
    <div class="comissao">
      <span class="comissao-tag">A receber</span>
      <span class="comissao-valor">${escapeHtml(fmtCur(total))}</span>
      ${showAll && itens.length > 1
        ? `<span class="comissao-detalhe">${escapeHtml(label)}</span>`
        : ''}
    </div>
  `
}

function buildObraCardHtml(
  obra: ObraFull,
  index: number,
  options: Pick<ObraFilaPdfExportInput, 'showAllComissao' | 'prestadorId'>,
): string {
  const status = getStatusEfetivo(obra)
  const statusCor = STATUS_COR[status]
  const progresso = calcObraProgresso(obra)
  const adminNome = obra.montador_admin_nome?.trim() || null
  const montadores = getObraMontadorNomes(obra)
  const originais = formatDatasOriginais(obra)
  const pedidoFeito = obra.pedido_material_feito === true

  const montadoresHtml = montadores.length > 0
    ? `<div class="meta-row"><span class="meta-label">${montadores.length === 1 ? 'Montador' : 'Ajudantes'}</span><span class="meta-value">${escapeHtml(montadores.join(', '))}</span></div>`
    : !adminNome
      ? `<div class="meta-row"><span class="meta-label">Montadores</span><span class="meta-value muted">Sem montadores</span></div>`
      : ''

  return `
    <article class="obra-card" style="border-left-color: ${statusCor}">
      <div class="obra-card-head">
        <span class="obra-num">${index}</span>
        <div class="obra-card-title-block">
          <h3 class="obra-cliente">${escapeHtml(obra.cliente_nome)}</h3>
          ${obra.lousa
            ? `<p class="obra-lousa">${escapeHtml(obra.lousa)}</p>`
            : ''}
        </div>
        <span class="status-pill" style="color:${statusCor};border-color:${statusCor}88;background:${statusCor}18">
          ${escapeHtml(STATUS_SHORT[status])}
        </span>
      </div>

      ${buildComissaoHtml(obra, options.showAllComissao !== false, options.prestadorId)}

      <div class="obra-dates">
        <span class="dates-atual">${escapeHtml(formatDatasPrevistas(obra))}</span>
        ${originais
          ? `<span class="dates-original">Original: ${escapeHtml(originais)}</span>`
          : ''}
      </div>

      <div class="obra-meta">
        ${adminNome
          ? `<div class="meta-row"><span class="meta-label">Admin</span><span class="meta-value">${escapeHtml(adminNome)}</span></div>`
          : ''}
        ${montadoresHtml}
        <div class="meta-row">
          <span class="meta-label">Pedido material</span>
          <span class="meta-value ${pedidoFeito ? 'ok' : 'warn'}">${pedidoFeito ? 'Feito' : 'Pendente'}</span>
        </div>
        ${obra.tipo_obra_nome
          ? `<div class="meta-row"><span class="meta-label">Tipo</span><span class="meta-value">${escapeHtml(obra.tipo_obra_nome)}</span></div>`
          : ''}
        ${obra.endereco_obra
          ? `<div class="meta-row"><span class="meta-label">Endereço</span><span class="meta-value">${escapeHtml(obra.endereco_obra)}</span></div>`
          : ''}
        <div class="meta-row">
          <span class="meta-label">Andamento</span>
          <span class="meta-value" style="color:${progresso.barColor}">${escapeHtml(progresso.label)}</span>
        </div>
      </div>
    </article>
  `
}

function buildColunaHtml(
  col: FilaDataColuna,
  options: Pick<ObraFilaPdfExportInput, 'showAllComissao' | 'prestadorId'>,
): string {
  const cards = col.obras
    .map((obra, i) => buildObraCardHtml(obra, i + 1, options))
    .join('')

  return `
    <section class="fila-dia" style="--dia-cor: ${col.cor}">
      <header class="fila-dia-head">
        <div class="fila-dia-title">
          <h2>${escapeHtml(col.label)}</h2>
          <span class="fila-dia-tag">${escapeHtml(prazoTag(col))}</span>
        </div>
        <span class="fila-dia-count">${col.obras.length}</span>
      </header>
      <div class="fila-dia-body">
        ${cards || '<p class="empty">Nenhuma obra neste dia.</p>'}
      </div>
    </section>
  `
}

const PDF_CSS = `
  @page { size: A4 portrait; margin: 12mm 11mm; }
  * { box-sizing: border-box; }
  html, body {
    margin: 0;
    padding: 0;
    color: #2a2118;
    background: #f7f2ea;
    font-family: "Segoe UI", "Helvetica Neue", Arial, sans-serif;
    font-size: 9.5pt;
    line-height: 1.35;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .sheet {
    max-width: 190mm;
    margin: 0 auto;
  }
  .doc-head {
    display: flex;
    align-items: flex-end;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 10px;
    margin-bottom: 14px;
    border-bottom: 2.5px solid #3d2b1f;
  }
  .doc-brand {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 8pt;
    letter-spacing: 0.18em;
    text-transform: uppercase;
    color: #8a6a45;
    margin: 0 0 4px;
  }
  .doc-title {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 20pt;
    font-weight: 700;
    margin: 0;
    letter-spacing: -0.02em;
    color: #1f160f;
  }
  .doc-meta {
    text-align: right;
    font-size: 8.5pt;
    color: #5c4a38;
  }
  .doc-meta strong { color: #1f160f; }
  .legend {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    margin-bottom: 16px;
    font-size: 7.5pt;
    color: #6b5744;
  }
  .legend span::before {
    content: "";
    display: inline-block;
    width: 8px;
    height: 8px;
    margin-right: 5px;
    border-radius: 2px;
    vertical-align: middle;
  }
  .legend .atraso::before { background: #ef4444; }
  .legend .hoje::before { background: #d97706; }
  .legend .prazo::before { background: #3b82f6; }

  .fila-dia {
    break-inside: avoid;
    page-break-inside: avoid;
    margin-bottom: 14px;
    border: 1px solid #d8c8b4;
    border-radius: 6px;
    overflow: hidden;
    background: #fffcf8;
  }
  .fila-dia-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 12px;
    background: color-mix(in srgb, var(--dia-cor) 12%, #fff8f0);
    border-bottom: 1px solid #e5d6c4;
    border-left: 4px solid var(--dia-cor);
  }
  .fila-dia-title {
    display: flex;
    align-items: baseline;
    gap: 10px;
    min-width: 0;
  }
  .fila-dia-title h2 {
    margin: 0;
    font-family: Georgia, "Times New Roman", serif;
    font-size: 13pt;
    color: var(--dia-cor);
  }
  .fila-dia-tag {
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #6b5744;
  }
  .fila-dia-count {
    flex-shrink: 0;
    min-width: 22px;
    height: 22px;
    padding: 0 6px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    font-size: 9pt;
    font-weight: 700;
    color: var(--dia-cor);
    background: color-mix(in srgb, var(--dia-cor) 18%, transparent);
  }
  .fila-dia-body {
    display: flex;
    flex-direction: column;
    gap: 8px;
    padding: 10px;
  }
  .obra-card {
    break-inside: avoid;
    page-break-inside: avoid;
    padding: 8px 10px 9px;
    border: 1px solid #e8dccf;
    border-left: 3px solid #6b7280;
    border-radius: 4px;
    background: #fff;
  }
  .obra-card-head {
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  .obra-num {
    flex-shrink: 0;
    width: 18px;
    height: 18px;
    margin-top: 1px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border-radius: 999px;
    font-size: 8pt;
    font-weight: 700;
    color: #fff;
    background: #3d2b1f;
  }
  .obra-card-title-block {
    flex: 1;
    min-width: 0;
  }
  .obra-cliente {
    margin: 0;
    font-size: 10.5pt;
    font-weight: 700;
    color: #1f160f;
  }
  .obra-lousa {
    margin: 2px 0 0;
    font-size: 8pt;
    color: #6b5744;
  }
  .status-pill {
    flex-shrink: 0;
    padding: 2px 7px;
    border-radius: 999px;
    border: 1px solid;
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .comissao {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 10px;
    margin-top: 6px;
    padding: 4px 8px;
    border-radius: 4px;
    border: 1px solid #e2c98a;
    background: linear-gradient(90deg, #f8edd0 0%, #fff8e8 100%);
  }
  .comissao-tag {
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #8a6a2e;
  }
  .comissao-valor {
    font-family: Georgia, "Times New Roman", serif;
    font-size: 11pt;
    font-weight: 700;
    color: #6b4f18;
  }
  .comissao-detalhe {
    flex-basis: 100%;
    font-size: 7.5pt;
    color: #7a6540;
  }
  .obra-dates {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 12px;
    margin-top: 6px;
  }
  .dates-atual {
    font-size: 9pt;
    font-weight: 700;
    font-variant-numeric: tabular-nums;
    color: #3d2b1f;
  }
  .dates-original {
    font-size: 7.5pt;
    color: #7a6754;
  }
  .obra-meta {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 3px 12px;
    margin-top: 7px;
  }
  .meta-row {
    display: flex;
    gap: 6px;
    min-width: 0;
  }
  .meta-label {
    flex-shrink: 0;
    min-width: 4.6rem;
    font-size: 7pt;
    font-weight: 700;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: #8a7660;
  }
  .meta-value {
    min-width: 0;
    font-size: 8pt;
    color: #2a2118;
    word-break: break-word;
  }
  .meta-value.muted { color: #9a8774; }
  .meta-value.ok { color: #047857; font-weight: 600; }
  .meta-value.warn { color: #b45309; font-weight: 600; }
  .empty {
    margin: 0;
    padding: 8px;
    text-align: center;
    color: #8a7660;
    font-size: 8.5pt;
  }
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
    .fila-dia, .obra-card { break-inside: avoid; }
  }
`

function buildDocumentHtml(input: ObraFilaPdfExportInput): string {
  const totalObras = input.colunas.reduce((acc, c) => acc + c.obras.length, 0)
  const geradoEm = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
  const empresa = input.empresaNome?.trim() || 'Movelaria'
  const options = {
    showAllComissao: input.showAllComissao,
    prestadorId: input.prestadorId,
  }

  const colunasHtml = input.colunas.length > 0
    ? input.colunas.map(col => buildColunaHtml(col, options)).join('')
    : '<p class="empty">Nenhuma obra com datas nesta fila.</p>'

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Filas de Obras — ${escapeHtml(input.filtroLabel)}</title>
  <style>${PDF_CSS}</style>
</head>
<body>
  <div class="sheet">
    <header class="doc-head">
      <div>
        <p class="doc-brand">${escapeHtml(empresa)}</p>
        <h1 class="doc-title">Filas de Obras</h1>
      </div>
      <div class="doc-meta">
        <div>Filtro: <strong>${escapeHtml(input.filtroLabel)}</strong></div>
        <div>${totalObras} obra(s) · ${input.colunas.length} dia(s)</div>
        <div>Gerado em ${escapeHtml(geradoEm)}</div>
      </div>
    </header>

    <div class="legend">
      <span class="atraso">Atraso (prazo vencido)</span>
      <span class="hoje">Hoje</span>
      <span class="prazo">Prazo futuro</span>
    </div>

    ${colunasHtml}

    <footer class="doc-foot">
      Ordem: data de entrega (mais cedo → mais tarde). Dentro do dia: atrasadas primeiro, depois início e cliente.
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

export function buildObraFilaPdfFileName(filtroLabel?: string): string {
  const datePart = new Date().toISOString().slice(0, 10)
  const slug = (filtroLabel ?? 'filas')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)
  return `filas-obras-${slug || 'todas'}-${datePart}.pdf`
}

/**
 * Abre a janela de impressão/salvar PDF das filas (folha A4).
 * O navegador mostra o diálogo nativo — escolha "Salvar como PDF".
 */
export function imprimirObraFilaPdf(input: ObraFilaPdfExportInput): void {
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    throw new Error('Permita pop-ups para exportar o PDF das filas.')
  }

  printWindow.document.write(buildDocumentHtml(input))
  printWindow.document.close()
}
