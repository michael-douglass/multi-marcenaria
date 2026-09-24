import { garboBrandLogo } from '@/lib/garbo-brand'
import { FUNCIONARIO_TIPO_LABEL } from '@/lib/funcionario-constants'
import {
  formatMinutosComSinal,
  formatMinutosHoraExtra,
  formatMinutosSaldo,
} from '@/lib/funcionario-ponto'
import { formatarCnpj } from '@/lib/rep/rep-validation'
import type { PontoFaltaDetalhe, PontoResumoBatida, PontoResumoFuncionarioPeriodo } from '@/types'

const NOME_EMPRESA = 'GARBO MOVELARIA'

export interface ResumoPontoDiaBatidas {
  data: string
  inicio: string | null
  inicioAlmoco: string | null
  saidaAlmoco: string | null
  saida: string | null
  /** Atraso da entrada (minutos). 0 = no horário. */
  atraso_minutos: number
  /** Hora extra após a saída prevista (minutos). */
  excedente_minutos: number
  /** excedente − atraso do dia. */
  saldo_minutos: number
}

/** Horas positivas (HE) vs negativas (atrasos + faltas abatidas + HE pagas) no período. */
export interface ResumoPontoBalanco {
  horas_positivas_minutos: number
  horas_negativas_minutos: number
  /** Minutos de faltas abatidas no banco de horas. */
  faltas_banco_minutos: number
  /** Minutos de HE já convertidos em pagamento. */
  he_pagas_minutos: number
  /** positivas − atrasos − faltas abatidas − HE pagas (pode ser negativo). */
  saldo_minutos: number
  status: 'positivo' | 'negativo' | 'zerado'
}

export function calcularBalancoResumoPonto(
  row: Pick<
    PontoResumoFuncionarioPeriodo,
    'hora_extra_minutos' | 'chegadas' | 'faltas_banco_minutos' | 'he_pagas_minutos'
  >,
): ResumoPontoBalanco {
  const positivas = Math.max(0, Math.floor(Number(row.hora_extra_minutos) || 0))
  const atrasos = (row.chegadas ?? [])
    .filter((b) => b.tipo === 'entrada')
    .reduce((acc, b) => acc + Math.max(0, Math.floor(Number(b.atraso_minutos) || 0)), 0)
  const faltasBanco = Math.max(0, Math.floor(Number(row.faltas_banco_minutos) || 0))
  const hePagas = Math.max(0, Math.floor(Number(row.he_pagas_minutos) || 0))
  const negativas = atrasos + faltasBanco + hePagas
  const saldo = positivas - negativas
  let status: ResumoPontoBalanco['status'] = 'zerado'
  if (saldo > 0) status = 'positivo'
  else if (saldo < 0) status = 'negativo'
  return {
    horas_positivas_minutos: positivas,
    horas_negativas_minutos: atrasos,
    faltas_banco_minutos: faltasBanco,
    he_pagas_minutos: hePagas,
    saldo_minutos: saldo,
    status,
  }
}

export interface ResumoPontoPdfInput {
  row: PontoResumoFuncionarioPeriodo
  periodoLabel: string
  intervaloLabel: string
  repCnpj?: string | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function formatDataCurtaPonto(iso: string): string {
  if (!iso) return '—'
  const d = new Date(iso + 'T12:00:00')
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function agruparBatidasPorDia(
  chegadas: PontoResumoBatida[],
  saidas: PontoResumoBatida[],
): ResumoPontoDiaBatidas[] {
  const map = new Map<string, ResumoPontoDiaBatidas>()

  function ensure(data: string): ResumoPontoDiaBatidas {
    let dia = map.get(data)
    if (!dia) {
      dia = {
        data,
        inicio: null,
        inicioAlmoco: null,
        saidaAlmoco: null,
        saida: null,
        atraso_minutos: 0,
        excedente_minutos: 0,
        saldo_minutos: 0,
      }
      map.set(data, dia)
    }
    return dia
  }

  for (const b of chegadas) {
    const dia = ensure(b.data)
    if (b.tipo === 'entrada') {
      dia.inicio = b.hora
      dia.atraso_minutos = Math.max(0, Math.floor(Number(b.atraso_minutos) || 0))
    }
    if (b.tipo === 'retorno_intervalo') dia.saidaAlmoco = b.hora
  }

  for (const b of saidas) {
    const dia = ensure(b.data)
    if (b.tipo === 'saida_intervalo') dia.inicioAlmoco = b.hora
    if (b.tipo === 'saida') {
      dia.saida = b.hora
      dia.excedente_minutos = Math.max(0, Math.floor(Number(b.hora_extra_minutos) || 0))
    }
  }

  for (const dia of map.values()) {
    dia.saldo_minutos = dia.excedente_minutos - dia.atraso_minutos
  }

  return Array.from(map.values()).sort((a, b) => a.data.localeCompare(b.data))
}

/** Une batidas do período com dias de falta (sem ponto). */
export function montarDiasResumoPonto(
  row: Pick<PontoResumoFuncionarioPeriodo, 'chegadas' | 'saidas' | 'faltas_datas'>,
): Array<ResumoPontoDiaBatidas & { ehFalta: boolean }> {
  const dias = agruparBatidasPorDia(row.chegadas, row.saidas ?? [])
  const map = new Map(dias.map((d) => [d.data, { ...d, ehFalta: false }]))

  for (const data of row.faltas_datas ?? []) {
    if (!data) continue
    if (!map.has(data)) {
      map.set(data, {
        data,
        inicio: null,
        inicioAlmoco: null,
        saidaAlmoco: null,
        saida: null,
        atraso_minutos: 0,
        excedente_minutos: 0,
        saldo_minutos: 0,
        ehFalta: true,
      })
    }
  }

  return Array.from(map.values()).sort((a, b) => a.data.localeCompare(b.data))
}

function cellHora(valor: string | null): string {
  return valor ? escapeHtml(valor) : '—'
}

function cellSaldoDia(dia: ResumoPontoDiaBatidas & { ehFalta?: boolean }): string {
  if (dia.ehFalta) return '<span class="neg">Falta</span>'
  const partes: string[] = []
  if (dia.excedente_minutos > 0) {
    partes.push(`<span class="pos">+${escapeHtml(formatMinutosSaldo(dia.excedente_minutos))}</span>`)
  }
  if (dia.atraso_minutos > 0) {
    partes.push(`<span class="neg">−${escapeHtml(formatMinutosSaldo(dia.atraso_minutos))}</span>`)
  }
  if (partes.length === 0) return '<span class="neutro">—</span>'
  if (dia.excedente_minutos > 0 && dia.atraso_minutos > 0) {
    partes.push(
      `<span class="${dia.saldo_minutos >= 0 ? 'pos' : 'neg'}">(= ${escapeHtml(formatMinutosComSinal(dia.saldo_minutos))})</span>`,
    )
  }
  return partes.join(' ')
}

function buildTabelaBatidas(dias: Array<ResumoPontoDiaBatidas & { ehFalta?: boolean }>): string {
  if (dias.length === 0) {
    return '<p class="vazio">Nenhuma batida nem falta no período.</p>'
  }

  const rows = dias
    .map((dia) => {
      const dataCls = dia.ehFalta ? ' class="falta-row"' : ''
      return `
      <tr${dataCls}>
        <td>${escapeHtml(formatDataCurtaPonto(dia.data))}${dia.ehFalta ? ' <em>(falta)</em>' : ''}</td>
        <td class="hora">${cellHora(dia.inicio)}</td>
        <td class="hora">${cellHora(dia.inicioAlmoco)}</td>
        <td class="hora">${cellHora(dia.saidaAlmoco)}</td>
        <td class="hora">${cellHora(dia.saida)}</td>
        <td class="hora">${cellSaldoDia(dia)}</td>
      </tr>`
    })
    .join('')

  return `
    <table class="batidas">
      <thead>
        <tr>
          <th>Data</th>
          <th>Início</th>
          <th>Início almoço</th>
          <th>Saída almoço</th>
          <th>Saída</th>
          <th>Saldo do dia</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>`
}

/** Monta lista de faltas com motivo a partir de detalhe ou só das datas. */
export function resolverFaltasDetalhe(
  row: Pick<PontoResumoFuncionarioPeriodo, 'faltas_datas' | 'faltas_detalhe'>,
): PontoFaltaDetalhe[] {
  if (row.faltas_detalhe && row.faltas_detalhe.length > 0) {
    const byData = new Map<string, PontoFaltaDetalhe>()
    for (const f of row.faltas_detalhe) {
      byData.set(f.data, f)
    }
    return [...byData.values()].sort((a, b) => a.data.localeCompare(b.data))
  }
  return (row.faltas_datas ?? []).map((data) => ({
    data,
    observacao: null,
    abater_banco_horas: false,
    minutos_abatidos: null,
  }))
}

function buildFaltas(faltas: PontoFaltaDetalhe[]): string {
  if (faltas.length === 0) {
    return '<p class="ok">Nenhuma falta no período.</p>'
  }
  const chips = faltas
    .map((f) => {
      const data = escapeHtml(formatDataCurtaPonto(f.data))
      const motivo = f.observacao?.trim()
        ? escapeHtml(f.observacao.trim())
        : 'Sem justificativa'
      const abate =
        f.abater_banco_horas
          ? ` · abatida no banco${
              f.minutos_abatidos != null && f.minutos_abatidos > 0
                ? ` (−${escapeHtml(formatMinutosSaldo(f.minutos_abatidos))})`
                : ''
            }`
          : ''
      return `<li><strong>${data}</strong> — ${motivo}${abate}</li>`
    })
    .join('')
  return `<ul class="faltas">${chips}</ul>`
}

export function buildResumoPontoHtml(input: ResumoPontoPdfInput): string {
  const { row, periodoLabel, intervaloLabel, repCnpj } = input
  const logoUrl = new URL(garboBrandLogo, window.location.origin).href
  const cnpjRaw = repCnpj?.trim() || ''
  const cnpj = escapeHtml(cnpjRaw ? formatarCnpj(cnpjRaw) : '—')
  const nome = escapeHtml(row.nome)
  const tipo = escapeHtml(FUNCIONARIO_TIPO_LABEL[row.tipo] ?? row.tipo)
  const he = escapeHtml(formatMinutosHoraExtra(row.hora_extra_minutos))
  const dias = montarDiasResumoPonto(row)
  const balanco = calcularBalancoResumoPonto(row)
  const faltasDetalhe = resolverFaltasDetalhe(row)
  const positivasTxt = escapeHtml(formatMinutosHoraExtra(balanco.horas_positivas_minutos))
  const negativasTxt = escapeHtml(
    balanco.horas_negativas_minutos > 0
      ? `−${formatMinutosSaldo(balanco.horas_negativas_minutos)}`
      : '0min',
  )
  const faltasBancoTxt = escapeHtml(
    balanco.faltas_banco_minutos > 0
      ? `−${formatMinutosSaldo(balanco.faltas_banco_minutos)}`
      : '0min',
  )
  const hePagasTxt = escapeHtml(
    balanco.he_pagas_minutos > 0
      ? `−${formatMinutosSaldo(balanco.he_pagas_minutos)}`
      : '0min',
  )
  const saldoTxt = escapeHtml(formatMinutosComSinal(balanco.saldo_minutos))
  const saldoClass =
    balanco.status === 'positivo' ? 'pos' : balanco.status === 'negativo' ? 'neg' : 'neutro'
  const saldoLabel =
    balanco.status === 'positivo'
      ? 'Saldo positivo'
      : balanco.status === 'negativo'
        ? 'Saldo negativo'
        : 'Saldo zerado'
  const geradoEm = new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Resumo de ponto — ${nome}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Georgia, 'Times New Roman', serif;
      color: #1a1208;
      background: #fff;
    }
    .resumo-page {
      max-width: 190mm;
      margin: 0 auto;
      padding: 10mm 12mm;
      border: 2px solid #8b6914;
    }
    .doc-timbre { margin-bottom: 6mm; }
    .doc-timbre__faixa {
      height: 4px;
      background: linear-gradient(90deg, #8b6914, #d4a853, #8b6914);
      margin-bottom: 4mm;
    }
    .doc-header { display: flex; align-items: center; gap: 14px; }
    .doc-header img { max-height: 56px; width: auto; }
    .doc-empresa h1 {
      margin: 0;
      font-size: 14pt;
      letter-spacing: 0.14em;
      color: #8b6914;
    }
    .doc-empresa p { margin: 2px 0 0; font-size: 9pt; color: #555; }
    .doc-sub { font-style: italic; }
    .doc-titulo {
      text-align: center;
      font-size: 12pt;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin: 5mm 0 4mm;
      color: #2a1812;
    }
    .prestador {
      text-align: center;
      padding: 5mm;
      border: 1px solid #d4a853;
      background: #faf8f5;
      margin-bottom: 5mm;
    }
    .prestador .label {
      display: block;
      font-size: 8pt;
      text-transform: uppercase;
      letter-spacing: 0.12em;
      color: #8b6914;
      margin-bottom: 2mm;
    }
    .prestador strong { font-size: 15pt; }
    .prestador .tipo { margin: 2mm 0 0; font-size: 9pt; color: #666; }
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 3mm;
      margin-bottom: 6mm;
    }
    .meta-grid div {
      border: 1px solid #e0d5c8;
      padding: 3mm;
      font-size: 9pt;
    }
    .meta-grid span {
      display: block;
      color: #777;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .meta-grid strong { font-size: 11pt; color: #1a1208; }
    .balanco {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 3mm;
      margin-bottom: 6mm;
      padding: 3.5mm;
      border: 1.5px solid #d4a853;
      background: #faf6ef;
    }
    .balanco div { text-align: center; }
    .balanco span {
      display: block;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      color: #6b5344;
      margin-bottom: 1.5mm;
    }
    .balanco strong { font-size: 12pt; font-variant-numeric: tabular-nums; }
    .pos { color: #166534; }
    .neg { color: #9f1239; }
    .neutro { color: #6b5344; }
    .secao { margin-bottom: 5mm; }
    .secao h3 {
      margin: 0 0 2.5mm;
      font-size: 9pt;
      letter-spacing: 0.14em;
      text-transform: uppercase;
      color: #8b6914;
      border-bottom: 1px solid #e8dfd0;
      padding-bottom: 1.5mm;
    }
    table.batidas {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
    }
    table.batidas th,
    table.batidas td {
      border: 1px solid #e0d5c8;
      padding: 2.2mm 2mm;
    }
    table.batidas th {
      background: #f5efe6;
      font-size: 7.5pt;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #6b5344;
      font-weight: 600;
    }
    table.batidas td.hora { text-align: center; font-variant-numeric: tabular-nums; }
    tr.falta-row td { background: #fdf2f2; color: #7f1d1d; }
    tr.falta-row em { font-size: 7.5pt; font-style: normal; color: #9f1239; }
    .faltas {
      list-style: none;
      margin: 0;
      padding: 0;
      display: flex;
      flex-wrap: wrap;
      gap: 2mm;
    }
    .faltas li {
      border: 1px solid #e8b4b4;
      background: #fdf2f2;
      color: #7f1d1d;
      padding: 1.5mm 3mm;
      font-size: 8.5pt;
      max-width: 100%;
      line-height: 1.35;
    }
    .faltas li strong { font-variant-numeric: tabular-nums; }
    .vazio { margin: 0; font-size: 9pt; color: #888; }
    .ok { margin: 0; font-size: 9pt; color: #166534; }
    .doc-footer {
      margin-top: 7mm;
      padding-top: 3mm;
      border-top: 1px solid #ddd;
      font-size: 8pt;
      color: #666;
      text-align: center;
    }
  </style>
</head>
<body>
  <section class="resumo-page">
    <div class="doc-timbre">
      <div class="doc-timbre__faixa"></div>
      <div class="doc-header">
        <img src="${logoUrl}" alt="${NOME_EMPRESA}" />
        <div class="doc-empresa">
          <h1>${NOME_EMPRESA}</h1>
          <p>CNPJ ${cnpj}</p>
          <p class="doc-sub">Resumo de Registro de Ponto — REP-P</p>
        </div>
      </div>
    </div>

    <h2 class="doc-titulo">Resumo de ponto</h2>

    <div class="prestador">
      <span class="label">Prestador / Funcionário</span>
      <strong>${nome}</strong>
      <p class="tipo">${tipo}</p>
    </div>

    <div class="meta-grid">
      <div>
        <span>Período</span>
        <strong>${escapeHtml(periodoLabel)}</strong>
      </div>
      <div>
        <span>Intervalo</span>
        <strong>${escapeHtml(intervaloLabel || '—')}</strong>
      </div>
      <div>
        <span>Hora extra</span>
        <strong>${he}</strong>
      </div>
    </div>

    <div class="meta-grid" style="grid-template-columns: 1fr;">
      <div>
        <span>Faltas no período</span>
        <strong>${row.faltas} dia${row.faltas === 1 ? '' : 's'}</strong>
      </div>
    </div>

    <div class="balanco" aria-label="Balanço de horas" style="grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));">
      <div>
        <span>Horas positivas (HE)</span>
        <strong class="pos">${positivasTxt}</strong>
      </div>
      <div>
        <span>Horas negativas (atrasos)</span>
        <strong class="neg">${negativasTxt}</strong>
      </div>
      <div>
        <span>Faltas abatidas (banco)</span>
        <strong class="neg">${faltasBancoTxt}</strong>
      </div>
      <div>
        <span>HE pagas</span>
        <strong class="neg">${hePagasTxt}</strong>
      </div>
      <div>
        <span>${saldoLabel}</span>
        <strong class="${saldoClass}">${saldoTxt}</strong>
      </div>
    </div>

    <section class="secao">
      <h3>Batidas e faltas no período</h3>
      ${buildTabelaBatidas(dias)}
    </section>

    <section class="secao">
      <h3>Faltas (dias sem ponto)</h3>
      ${buildFaltas(faltasDetalhe)}
    </section>

    <footer class="doc-footer">
      <p>Documento gerado em ${escapeHtml(geradoEm)} · Garbo Movelaria</p>
      <p>Conforme Portaria MTP nº 671/2021 (REP-P).</p>
      <p>Saldo = horas positivas (HE) − atrasos − faltas abatidas − HE convertidas em pagamento.</p>
    </footer>
  </section>
</body>
</html>`
}

/** Abre impressão / “Salvar como PDF” com resumo timbrado. */
export function imprimirResumoPontoPdf(input: ResumoPontoPdfInput): void {
  const html = buildResumoPontoHtml(input)
  const win = window.open('', '_blank')
  if (!win) {
    throw new Error('Permita pop-ups para exportar o PDF.')
  }
  win.document.write(html)
  win.document.close()
  win.onload = () => {
    win.print()
    setTimeout(() => win.close(), 500)
  }
}
