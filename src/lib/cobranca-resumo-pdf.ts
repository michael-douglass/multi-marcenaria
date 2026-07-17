import { garboBrandLogo } from '@/lib/garbo-brand'
import { fmtCur, fmtDate, isOverdue } from '@/lib/utils'
import type { FormaPagamento, TipoRecebimento } from '@/types'

const NOME_EMPRESA = 'GARBO MOVELARIA'

const TIPO_LABEL: Record<TipoRecebimento, string> = {
  a_vista: 'À Vista',
  cartao_parcelado: 'Cartão Parcelado',
  nosso_parcelamento: 'Nosso Parcelamento',
}

const PM_LABEL: Record<FormaPagamento, string> = {
  pix: 'Pix',
  dinheiro: 'Dinheiro',
  cheque: 'Cheque',
  boleto: 'Boleto',
  cartao: 'Cartão',
}

export type CobrancaResumoParcelaStatus = 'aberto' | 'recebido' | 'vencido' | 'previsto'

export interface CobrancaResumoParcela {
  numero: number
  totalParcelas: number
  valor: number
  vencimento: string
  status: CobrancaResumoParcelaStatus
  formaPagamento?: string
}

export interface CobrancaResumoAnexo {
  nome: string
  escopo?: string
  /** URLs de imagem (preview) para embutir no PDF */
  previewUrls?: string[]
}

export interface CobrancaResumoPdfInput {
  clienteNome: string
  valorTotal: number
  tipoRecebimento?: TipoRecebimento | string
  formaPagamento?: FormaPagamento | string
  observacao?: string | null
  entrada?: {
    valor: number
    data: string
    formaPagamento?: string
  } | null
  parcelas: CobrancaResumoParcela[]
  anexos: CobrancaResumoAnexo[]
  /** Ex.: "Rascunho — Nova Cobrança" ou "Cobrança salva" */
  subtitulo?: string
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function statusLabel(status: CobrancaResumoParcelaStatus): string {
  switch (status) {
    case 'recebido':
      return 'Recebido'
    case 'vencido':
      return 'Vencido'
    case 'previsto':
      return 'Previsto'
    default:
      return 'Em aberto'
  }
}

function statusColor(status: CobrancaResumoParcelaStatus): string {
  switch (status) {
    case 'recebido':
      return '#15803d'
    case 'vencido':
      return '#b91c1c'
    case 'previsto':
      return '#a16207'
    default:
      return '#b45309'
  }
}

export function statusParcelaConta(
  status: string,
  vencimento: string,
): CobrancaResumoParcelaStatus {
  if (status === 'recebido') return 'recebido'
  if (isOverdue(vencimento)) return 'vencido'
  return 'aberto'
}

/** Monta HTML e abre a impressão / “Salvar como PDF”. */
export function imprimirResumoCobrancaPdf(input: CobrancaResumoPdfInput): void {
  const html = buildResumoCobrancaHtml(input)
  const win = window.open('', '_blank')
  if (!win) {
    throw new Error('Permita pop-ups para gerar o PDF.')
  }
  win.document.write(html)
  win.document.close()
  win.onload = () => {
    win.focus()
    win.print()
  }
}

export function buildResumoCobrancaHtml(input: CobrancaResumoPdfInput): string {
  const logo = garboBrandLogo
  const geradoEm = new Date().toLocaleString('pt-BR')
  const tipo =
    input.tipoRecebimento && input.tipoRecebimento in TIPO_LABEL
      ? TIPO_LABEL[input.tipoRecebimento as TipoRecebimento]
      : (input.tipoRecebimento ?? '—')
  const forma =
    input.formaPagamento && input.formaPagamento in PM_LABEL
      ? PM_LABEL[input.formaPagamento as FormaPagamento]
      : (input.formaPagamento ?? '—')

  const abertas = input.parcelas.filter(
    p => p.status === 'aberto' || p.status === 'vencido' || p.status === 'previsto',
  )
  const recebidas = input.parcelas.filter(p => p.status === 'recebido')
  const previstas = input.parcelas.filter(p => p.status === 'previsto')

  const totalAberto = abertas.reduce((s, p) => s + p.valor, 0)
  const totalRecebido = recebidas.reduce((s, p) => s + p.valor, 0)
  const totalPrevisto = previstas.reduce((s, p) => s + p.valor, 0)
  const totalParcelas = input.parcelas.reduce((s, p) => s + p.valor, 0)
  const entradaValor = input.entrada?.valor ?? 0

  const parcelasRows = input.parcelas.length
    ? input.parcelas
        .map(
          p => `
      <tr>
        <td>${p.numero}/${p.totalParcelas}</td>
        <td>${escapeHtml(fmtDate(p.vencimento))}</td>
        <td class="num">${escapeHtml(fmtCur(p.valor))}</td>
        <td>${escapeHtml(p.formaPagamento || forma)}</td>
        <td style="color:${statusColor(p.status)};font-weight:700">${statusLabel(p.status)}</td>
      </tr>`,
        )
        .join('')
    : `<tr><td colspan="5" class="empty">Nenhuma parcela informada.</td></tr>`

  const abertasRows = abertas.length
    ? abertas
        .map(
          p => `
      <tr>
        <td>${p.numero}/${p.totalParcelas}</td>
        <td>${escapeHtml(fmtDate(p.vencimento))}</td>
        <td class="num">${escapeHtml(fmtCur(p.valor))}</td>
        <td style="color:${statusColor(p.status)};font-weight:700">${statusLabel(p.status)}</td>
      </tr>`,
        )
        .join('')
    : `<tr><td colspan="4" class="empty">Nada em aberto ou a receber neste momento.</td></tr>`

  const anexosList = input.anexos.length
    ? `<ul class="anexo-list">${input.anexos
        .map(
          a =>
            `<li><strong>${escapeHtml(a.nome)}</strong>${
              a.escopo ? ` <span class="muted">(${escapeHtml(a.escopo)})</span>` : ''
            }</li>`,
        )
        .join('')}</ul>`
    : '<p class="muted">Nenhum anexo.</p>'

  const anexosImagens = input.anexos
    .flatMap(a =>
      (a.previewUrls ?? []).map(
        (url, i) => `
      <div class="anexo-page">
        <div class="anexo-caption">${escapeHtml(a.nome)}${
          (a.previewUrls?.length ?? 0) > 1 ? ` — página ${i + 1}` : ''
        }</div>
        <div class="anexo-frame"><img src="${escapeHtml(url)}" alt="${escapeHtml(a.nome)}" /></div>
      </div>`,
      ),
    )
    .join('')

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Resumo da Cobrança — ${escapeHtml(input.clienteNome || 'Cliente')}</title>
  <style>
    @page { size: A4; margin: 12mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, 'Times New Roman', Times, serif;
      color: #2a1812;
      font-size: 11pt;
      line-height: 1.45;
    }
    .header {
      display: flex;
      align-items: center;
      gap: 14px;
      border-bottom: 2px solid #c9a227;
      padding-bottom: 10px;
      margin-bottom: 16px;
    }
    .header img { height: 48px; width: auto; }
    .header h1 {
      margin: 0;
      font-size: 16pt;
      letter-spacing: 0.06em;
      color: #6b4a2e;
    }
    .header p { margin: 2px 0 0; font-size: 9pt; color: #7a6555; }
    h2 {
      margin: 18px 0 8px;
      font-size: 12pt;
      color: #6b4a2e;
      border-bottom: 1px solid #e8dcc8;
      padding-bottom: 4px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px 16px;
      margin-bottom: 8px;
    }
    .label { font-size: 8pt; text-transform: uppercase; letter-spacing: 0.06em; color: #8a7464; }
    .value { font-weight: 600; }
    .kpi {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin: 12px 0 4px;
    }
    .kpi-card {
      border: 1px solid #e0d5c8;
      border-radius: 6px;
      padding: 8px 10px;
      background: #faf8f5;
    }
    .kpi-card .label { display: block; margin-bottom: 2px; }
    .kpi-card .value { font-size: 12pt; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
      margin-top: 6px;
    }
    th, td {
      border: 1px solid #e0d5c8;
      padding: 6px 8px;
      text-align: left;
      vertical-align: top;
    }
    th {
      background: #f5efe6;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #6b4a2e;
    }
    td.num, th.num { text-align: right; }
    td.empty { text-align: center; color: #8a7464; font-style: italic; }
    .obs {
      white-space: pre-wrap;
      background: #faf8f5;
      border: 1px solid #e0d5c8;
      border-radius: 6px;
      padding: 10px;
      min-height: 2.5em;
    }
    .anexo-list { margin: 6px 0 0; padding-left: 18px; }
    .muted { color: #8a7464; font-size: 9pt; }
    .anexo-page {
      break-inside: avoid;
      page-break-inside: avoid;
      margin: 14px 0;
    }
    .anexo-caption {
      font-size: 9pt;
      color: #6b4a2e;
      margin-bottom: 4px;
      font-weight: 600;
    }
    .anexo-frame {
      border: 1px solid #e0d5c8;
      background: #fff;
      padding: 6px;
      text-align: center;
    }
    .anexo-frame img {
      max-width: 100%;
      max-height: 220mm;
      object-fit: contain;
    }
    .footer {
      margin-top: 20px;
      padding-top: 8px;
      border-top: 1px solid #e0d5c8;
      font-size: 8pt;
      color: #8a7464;
      text-align: center;
    }
    @media print {
      .anexo-page { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <div class="header">
    <img src="${logo}" alt="${NOME_EMPRESA}" />
    <div>
      <h1>RESUMO DA COBRANÇA</h1>
      <p>${NOME_EMPRESA}${input.subtitulo ? ` · ${escapeHtml(input.subtitulo)}` : ''}</p>
      <p>Gerado em ${escapeHtml(geradoEm)}</p>
    </div>
  </div>

  <h2>1. Dados gerais</h2>
  <div class="grid">
    <div><div class="label">Cliente</div><div class="value">${escapeHtml(input.clienteNome || '—')}</div></div>
    <div><div class="label">Valor total da venda</div><div class="value">${escapeHtml(fmtCur(input.valorTotal))}</div></div>
    <div><div class="label">Tipo de recebimento</div><div class="value">${escapeHtml(tipo)}</div></div>
    <div><div class="label">Forma de pagamento</div><div class="value">${escapeHtml(forma)}</div></div>
    ${
      input.entrada
        ? `<div><div class="label">Entrada</div><div class="value">${escapeHtml(fmtCur(input.entrada.valor))} em ${escapeHtml(fmtDate(input.entrada.data))}${
            input.entrada.formaPagamento
              ? ` (${escapeHtml(input.entrada.formaPagamento)})`
              : ''
          }</div></div>`
        : ''
    }
  </div>

  <div class="kpi">
    <div class="kpi-card">
      <span class="label">Em aberto / a receber</span>
      <div class="value" style="color:#b45309">${escapeHtml(fmtCur(totalAberto))}</div>
      <span class="muted">${abertas.length} parcela(s)</span>
    </div>
    <div class="kpi-card">
      <span class="label">Já recebido</span>
      <div class="value" style="color:#15803d">${escapeHtml(fmtCur(totalRecebido + entradaValor))}</div>
      <span class="muted">${recebidas.length} parcela(s)${entradaValor ? ' + entrada' : ''}</span>
    </div>
    <div class="kpi-card">
      <span class="label">Soma das parcelas</span>
      <div class="value">${escapeHtml(fmtCur(totalParcelas))}</div>
      <span class="muted">${input.parcelas.length} parcela(s)${
        totalPrevisto > 0 && abertas.length === 0 && recebidas.length === 0
          ? ` · previsto ${escapeHtml(fmtCur(totalPrevisto))}`
          : ''
      }</span>
    </div>
  </div>

  <h2>2. Todas as parcelas</h2>
  <table>
    <thead>
      <tr>
        <th>Parcela</th>
        <th>Vencimento</th>
        <th class="num">Valor</th>
        <th>Pagamento</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>${parcelasRows}</tbody>
  </table>

  <h2>3. Em aberto / a receber</h2>
  <table>
    <thead>
      <tr>
        <th>Parcela</th>
        <th>Vencimento</th>
        <th class="num">Valor</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>${abertasRows}</tbody>
  </table>

  <h2>4. Observação</h2>
  <div class="obs">${escapeHtml(input.observacao?.trim() || '—')}</div>

  <h2>5. Documentos anexos</h2>
  ${anexosList}
  ${anexosImagens ? `<div style="margin-top:12px">${anexosImagens}</div>` : ''}

  <div class="footer">${NOME_EMPRESA} — Resumo de cobrança para arquivo / impressão (Salvar como PDF)</div>
</body>
</html>`
}
