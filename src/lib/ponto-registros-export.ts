import { garboBrandLogo } from '@/lib/garbo-brand'
import { FUNCIONARIO_TIPO_LABEL } from '@/lib/funcionario-constants'
import {
  enrichMarcacaoUrls,
  formatAtrasoMinutos,
  formatHoraPonto,
  formatJornadaResumo,
  formatMinutosComSinal,
  formatMinutosHoraExtra,
  formatMinutosSaldo,
  googleMapsUrl,
  horaPrevistaPorTipo,
  labelPontoTipo,
  marcacaoHoraEfetiva,
  PONTO_TIMEZONE,
} from '@/lib/funcionario-ponto'
import { diasComHoraExtra, type EspelhoPontoPeriodo } from '@/lib/ponto-espelho-periodo'
import {
  calcularBalancoResumoPonto,
  formatDataCurtaPonto,
  montarDiasResumoPonto,
  type ResumoPontoDiaBatidas,
} from '@/lib/resumo-ponto-pdf'
import { formatarCnpj } from '@/lib/rep/rep-validation'
import type { FuncionarioJornada, PontoMarcacao, PontoMarcacaoComUrls } from '@/types'

const NOME_EMPRESA = 'GARBO MOVELARIA'
const JPG_W = 1240
const JPG_H = 1754
const JPG_QUALITY = 0.88

export interface PontoRegistrosExportOptions {
  incluirFoto: boolean
  incluirAssinatura: boolean
  periodoLabel: string
  intervaloLabel: string
  jornada: FuncionarioJornada | null
  repCnpj?: string | null
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function slugNome(nome: string): string {
  const slug = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
  return slug || 'funcionario'
}

function geradoEmLabel(): string {
  return new Date().toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PONTO_TIMEZONE,
  })
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

function buildChips(datas: string[], className: string, vazio: string): string {
  if (datas.length === 0) return `<p class="ok">${escapeHtml(vazio)}</p>`
  const chips = datas.map((d) => `<li>${escapeHtml(formatDataCurtaPonto(d))}</li>`).join('')
  return `<ul class="${className}">${chips}</ul>`
}

function buildOcorrenciaLista(
  items: EspelhoPontoPeriodo['folgas'],
  vazio: string,
  chipClass: string,
): string {
  if (items.length === 0) return `<p class="ok">${escapeHtml(vazio)}</p>`
  const chips = items
    .map((o) => {
      const obs = o.observacao?.trim() ? ` — ${escapeHtml(o.observacao)}` : ''
      const auto = o.automatica ? ' <em>(automática)</em>' : ''
      return `<li>${escapeHtml(formatDataCurtaPonto(o.data))}${obs}${auto}</li>`
    })
    .join('')
  return `<ul class="${chipClass}">${chips}</ul>`
}

function statusMarcacao(m: PontoMarcacao): string {
  if (m.status === 'atraso' && m.atraso_minutos > 0) {
    return `Atraso de ${formatAtrasoMinutos(m.atraso_minutos)}`
  }
  if (m.status === 'normal') return 'No horário'
  return m.status
}

function formatDataHoraCompleta(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: PONTO_TIMEZONE,
  })
}

function sharedCss(): string {
  return `
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body { margin: 0; font-family: Georgia, 'Times New Roman', serif; color: #1a1208; background: #fff; }
    .page {
      max-width: 190mm;
      margin: 0 auto 12mm;
      padding: 10mm 12mm;
      border: 2px solid #8b6914;
      page-break-after: always;
    }
    .page:last-child { page-break-after: auto; }
    .doc-timbre { margin-bottom: 6mm; }
    .doc-timbre__faixa {
      height: 4px;
      background: linear-gradient(90deg, #8b6914, #d4a853, #8b6914);
      margin-bottom: 4mm;
    }
    .doc-header { display: flex; align-items: center; gap: 14px; }
    .doc-header img { max-height: 56px; width: auto; }
    .doc-empresa h1 { margin: 0; font-size: 14pt; letter-spacing: 0.14em; color: #8b6914; }
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
      margin-bottom: 5mm;
    }
    .meta-grid.cols-2 { grid-template-columns: repeat(2, 1fr); }
    .meta-grid.cols-4 { grid-template-columns: repeat(4, 1fr); }
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
      grid-template-columns: repeat(3, 1fr);
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
    table.batidas { width: 100%; border-collapse: collapse; font-size: 9pt; }
    table.batidas th, table.batidas td { border: 1px solid #e0d5c8; padding: 2.2mm 2mm; }
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
    .faltas, .he-chips, .folgas, .abonos {
      list-style: none; margin: 0; padding: 0; display: flex; flex-wrap: wrap; gap: 2mm;
    }
    .faltas li {
      border: 1px solid #e8b4b4; background: #fdf2f2; color: #7f1d1d;
      padding: 1.5mm 3mm; font-size: 9pt; font-variant-numeric: tabular-nums;
    }
    .he-chips li {
      border: 1px solid #bbf7d0; background: #f0fdf4; color: #166534;
      padding: 1.5mm 3mm; font-size: 9pt; font-variant-numeric: tabular-nums;
    }
    .folgas li {
      border: 1px solid #bfdbfe; background: #eff6ff; color: #1e40af;
      padding: 1.5mm 3mm; font-size: 9pt;
    }
    .abonos li {
      border: 1px solid #fde68a; background: #fffbeb; color: #92400e;
      padding: 1.5mm 3mm; font-size: 9pt;
    }
    .vazio { margin: 0; font-size: 9pt; color: #888; }
    .ok { margin: 0; font-size: 9pt; color: #166534; }
    .doc-footer {
      margin-top: 7mm; padding-top: 3mm; border-top: 1px solid #ddd;
      font-size: 8pt; color: #666; text-align: center;
    }
    .data-completa { text-align: center; font-size: 10pt; color: #444; margin-bottom: 5mm; }
    .local-box {
      border: 1px solid #b8d4e8; background: #f0f8ff; padding: 4mm;
      margin-bottom: 5mm; font-size: 9pt;
    }
    .local-box h3 { margin: 0 0 2mm; font-size: 9pt; text-transform: uppercase; color: #2563eb; }
    .local-coords { margin: 0; font-family: monospace; }
    .local-link { margin: 2mm 0 0; }
    .local-link a { color: #2563eb; }
    .midia-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm; }
    .midia-grid.cols-1 { grid-template-columns: 1fr; }
    .midia-card { border: 1px solid #ccc; padding: 3mm; }
    .midia-card h3 { margin: 0 0 2mm; font-size: 8pt; text-transform: uppercase; color: #666; }
    .midia-img { width: 100%; max-height: 55mm; object-fit: cover; display: block; }
    .midia-img.assinatura { object-fit: contain; background: #faf8f5; }
    .midia-vazio {
      height: 45mm; display: flex; align-items: center; justify-content: center;
      background: #f5f5f5; color: #999; font-size: 9pt;
    }
    .hash code { font-size: 7pt; word-break: break-all; }
    .origem { font-size: 8pt; color: #888; margin: 0 0 4mm; text-align: center; }
  `
}

function buildTimbre(logoUrl: string, cnpj: string, sub: string): string {
  return `
    <div class="doc-timbre">
      <div class="doc-timbre__faixa"></div>
      <div class="doc-header">
        <img src="${logoUrl}" alt="${NOME_EMPRESA}" />
        <div class="doc-empresa">
          <h1>${NOME_EMPRESA}</h1>
          <p>CNPJ ${cnpj}</p>
          <p class="doc-sub">${escapeHtml(sub)}</p>
        </div>
      </div>
    </div>`
}

function buildPaginaResumo(
  espelho: EspelhoPontoPeriodo,
  options: PontoRegistrosExportOptions,
  logoUrl: string,
  cnpj: string,
): string {
  const { row } = espelho
  const nome = escapeHtml(row.nome)
  const tipo = escapeHtml(FUNCIONARIO_TIPO_LABEL[row.tipo] ?? row.tipo)
  const jornadaTxt = escapeHtml(formatJornadaResumo(options.jornada) ?? '—')
  const he = escapeHtml(formatMinutosHoraExtra(row.hora_extra_minutos))
  const dias = montarDiasResumoPonto(row)
  const balanco = calcularBalancoResumoPonto(row)
  const positivasTxt = escapeHtml(formatMinutosHoraExtra(balanco.horas_positivas_minutos))
  const negativasTxt = escapeHtml(
    balanco.horas_negativas_minutos > 0
      ? `−${formatMinutosSaldo(balanco.horas_negativas_minutos)}`
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
  const heDias = diasComHoraExtra(espelho)
  const heChips =
    heDias.length === 0
      ? '<p class="ok">Nenhuma hora extra no período.</p>'
      : `<ul class="he-chips">${heDias
          .map(
            (d) =>
              `<li>${escapeHtml(formatDataCurtaPonto(d.data))} · +${escapeHtml(formatMinutosHoraExtra(d.minutos))}</li>`,
          )
          .join('')}</ul>`

  return `
    <section class="page">
      ${buildTimbre(logoUrl, cnpj, 'Espelho completo de ponto — REP-P')}
      <h2 class="doc-titulo">Espelho de registros</h2>
      <div class="prestador">
        <span class="label">Prestador / Funcionário</span>
        <strong>${nome}</strong>
        <p class="tipo">${tipo} · Jornada ${jornadaTxt}</p>
      </div>
      <div class="meta-grid cols-4">
        <div><span>Período</span><strong>${escapeHtml(options.periodoLabel)}</strong></div>
        <div><span>Intervalo</span><strong>${escapeHtml(options.intervaloLabel || '—')}</strong></div>
        <div><span>Hora extra</span><strong>${he}</strong></div>
        <div><span>Faltas</span><strong>${row.faltas} dia${row.faltas === 1 ? '' : 's'}</strong></div>
      </div>
      <div class="balanco" aria-label="Balanço de horas">
        <div>
          <span>Horas positivas (HE)</span>
          <strong class="pos">${positivasTxt}</strong>
        </div>
        <div>
          <span>Horas negativas (atrasos)</span>
          <strong class="neg">${negativasTxt}</strong>
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
        <h3>Horas extras (por dia)</h3>
        ${heChips}
      </section>
      <section class="secao">
        <h3>Faltas</h3>
        ${buildChips(row.faltas_datas, 'faltas', 'Nenhuma falta no período.')}
      </section>
      <section class="secao">
        <h3>Folgas</h3>
        ${buildOcorrenciaLista(espelho.folgas, 'Nenhuma folga no período.', 'folgas')}
      </section>
      <section class="secao">
        <h3>Abonos</h3>
        ${buildOcorrenciaLista(espelho.abonos, 'Nenhum abono no período.', 'abonos')}
      </section>
      <footer class="doc-footer">
        <p>Documento gerado em ${escapeHtml(geradoEmLabel())} · Garbo Movelaria</p>
        <p>Conforme Portaria MTP nº 671/2021 (REP-P).</p>
        <p>Saldo = horas positivas (hora extra após a saída) − horas negativas (atrasos na entrada).</p>
      </footer>
    </section>`
}

function buildPaginaBatida(
  m: PontoMarcacaoComUrls,
  funcionarioNome: string,
  options: PontoRegistrosExportOptions,
  logoUrl: string,
  cnpj: string,
): string {
  const nome = escapeHtml(funcionarioNome)
  const tipo = escapeHtml(labelPontoTipo(m.tipo))
  const previsto = horaPrevistaPorTipo(m.tipo, options.jornada)
  const horaEfetiva = formatHoraPonto(marcacaoHoraEfetiva(m))
  const lat = m.latitude
  const lng = m.longitude
  const localHtml =
    lat != null && lng != null
      ? `<p class="local-coords">${lat.toFixed(6)}, ${lng.toFixed(6)}${
          m.precisao_metros != null ? ` (±${Math.round(m.precisao_metros)} m)` : ''
        }</p>
         <p class="local-link"><a href="${googleMapsUrl(lat, lng)}">Abrir no Google Maps</a></p>`
      : '<p class="local-coords">Localização não registrada</p>'

  const mostrarFoto = options.incluirFoto
  const mostrarAssinatura = options.incluirAssinatura
  const gridClass = mostrarFoto && mostrarAssinatura ? 'midia-grid' : 'midia-grid cols-1'

  let midia = ''
  if (mostrarFoto || mostrarAssinatura) {
    const fotoBlock = mostrarFoto
      ? `<div class="midia-card"><h3>Foto da batida</h3>${
          m.fotoUrl
            ? `<img src="${escapeHtml(m.fotoUrl)}" alt="Selfie do registro" class="midia-img" />`
            : '<div class="midia-vazio">Sem foto</div>'
        }</div>`
      : ''
    const assinaturaBlock = mostrarAssinatura
      ? `<div class="midia-card"><h3>Assinatura do funcionário</h3>${
          m.assinaturaUrl
            ? `<img src="${escapeHtml(m.assinaturaUrl)}" alt="Assinatura" class="midia-img assinatura" />`
            : '<div class="midia-vazio">Sem assinatura</div>'
        }</div>`
      : ''
    midia = `<div class="${gridClass}">${fotoBlock}${assinaturaBlock}</div>`
  }

  const origem =
    m.origem === 'rh_manual'
      ? `Lançamento do RH${m.registro_motivo ? ` — ${escapeHtml(m.registro_motivo)}` : ''}`
      : 'Registro pelo aplicativo'

  return `
    <section class="page">
      ${buildTimbre(logoUrl, cnpj, 'Comprovante de batida — REP-P')}
      <h2 class="doc-titulo">Registro de ponto</h2>
      <div class="prestador">
        <span class="label">Prestador / Funcionário</span>
        <strong>${nome}</strong>
      </div>
      <div class="meta-grid cols-2">
        <div><span>Tipo</span><strong>${tipo}</strong></div>
        <div><span>NSR</span><strong>${m.nsr}</strong></div>
        <div><span>Horário batido</span><strong>${escapeHtml(horaEfetiva)}</strong></div>
        <div><span>Horário previsto</span><strong>${escapeHtml(previsto?.slice(0, 5) ?? '—')}</strong></div>
        <div><span>Status</span><strong>${escapeHtml(statusMarcacao(m))}</strong></div>
        <div><span>Origem</span><strong>${escapeHtml(m.origem === 'rh_manual' ? 'RH' : 'App')}</strong></div>
      </div>
      <p class="data-completa">${escapeHtml(formatDataHoraCompleta(marcacaoHoraEfetiva(m)))}</p>
      <p class="origem">${origem}</p>
      <div class="local-box">
        <h3>Localização do registro</h3>
        ${localHtml}
      </div>
      ${midia}
      <footer class="doc-footer">
        <p>Documento gerado conforme Portaria MTP nº 671/2021 (REP-P).</p>
        <p class="hash">Hash SHA-256: <code>${escapeHtml((m.hash_sha256 ?? '').slice(0, 48))}…</code></p>
      </footer>
    </section>`
}

export async function prepararEspelhoPontoExport(
  espelho: EspelhoPontoPeriodo,
  options: PontoRegistrosExportOptions,
): Promise<PontoMarcacaoComUrls[]> {
  if (!options.incluirFoto && !options.incluirAssinatura) return []
  const enriched = await Promise.all(espelho.marcacoes.map((m) => enrichMarcacaoUrls(m)))
  return enriched
}

export function buildEspelhoPontoHtml(
  espelho: EspelhoPontoPeriodo,
  options: PontoRegistrosExportOptions,
  marcacoesEnriquecidas: PontoMarcacaoComUrls[],
): string {
  const logoUrl = new URL(garboBrandLogo, window.location.origin).href
  const cnpjRaw = options.repCnpj?.trim() || ''
  const cnpj = escapeHtml(cnpjRaw ? formatarCnpj(cnpjRaw) : '—')
  const nome = escapeHtml(espelho.row.nome)
  const incluirMidia = options.incluirFoto || options.incluirAssinatura
  const paginasBatida = incluirMidia
    ? marcacoesEnriquecidas.map((m) => buildPaginaBatida(m, espelho.row.nome, options, logoUrl, cnpj)).join('')
    : ''

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <title>Espelho de ponto — ${nome}</title>
  <style>${sharedCss()}</style>
</head>
<body>
  ${buildPaginaResumo(espelho, options, logoUrl, cnpj)}
  ${paginasBatida}
</body>
</html>`
}

export function imprimirEspelhoPontoPdf(html: string): void {
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

function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'))
    img.src = src
  })
}

async function loadImageFromRemote(src: string): Promise<HTMLImageElement | null> {
  try {
    const res = await fetch(src)
    if (!res.ok) return null
    const blob = await res.blob()
    const obj = URL.createObjectURL(blob)
    const img = await loadImage(obj)
    // Mantém o bitmap na Image; o blob URL pode ser liberado depois do decode.
    URL.revokeObjectURL(obj)
    return img
  } catch {
    return null
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function canvasToJpg(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Não foi possível gerar a imagem.'))
        else resolve(blob)
      },
      'image/jpeg',
      JPG_QUALITY,
    )
  })
}

function paintPaper(ctx: CanvasRenderingContext2D): void {
  const grad = ctx.createLinearGradient(0, 0, 0, JPG_H)
  grad.addColorStop(0, '#fffef9')
  grad.addColorStop(0.45, '#ffffff')
  grad.addColorStop(1, '#fffdf8')
  ctx.fillStyle = grad
  ctx.fillRect(0, 0, JPG_W, JPG_H)
  const m = 28
  ctx.strokeStyle = '#8b6914'
  ctx.lineWidth = 3
  ctx.strokeRect(m, m, JPG_W - m * 2, JPG_H - m * 2)
  ctx.strokeStyle = 'rgba(139, 105, 20, 0.35)'
  ctx.lineWidth = 1
  ctx.strokeRect(m + 14, m + 14, JPG_W - (m + 14) * 2, JPG_H - (m + 14) * 2)
}

function newPage(): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas')
  canvas.width = JPG_W
  canvas.height = JPG_H
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Não foi possível gerar a imagem.')
  paintPaper(ctx)
  return { canvas, ctx }
}

function drawHeader(
  ctx: CanvasRenderingContext2D,
  logo: HTMLImageElement,
  cnpj: string,
  sub: string,
): number {
  const left = 72
  const right = JPG_W - 72
  let y = 78
  const logoH = 70
  const logoW = (logo.width / logo.height) * logoH
  ctx.drawImage(logo, left, y, logoW, logoH)
  ctx.textAlign = 'left'
  ctx.fillStyle = '#8b6914'
  ctx.font = '700 22px Georgia, "Times New Roman", serif'
  ctx.fillText(NOME_EMPRESA, left + logoW + 18, y + 24)
  ctx.font = '14px Georgia, "Times New Roman", serif'
  ctx.fillStyle = '#5a4636'
  ctx.fillText(`CNPJ ${cnpj}`, left + logoW + 18, y + 46)
  ctx.fillText(sub, left + logoW + 18, y + 66)
  y += 92
  ctx.strokeStyle = '#8b6914'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(left, y)
  ctx.lineTo(right, y)
  ctx.stroke()
  return y + 28
}

function wrapLine(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let current = ''
  for (const word of words) {
    const next = current ? `${current} ${word}` : word
    if (ctx.measureText(next).width <= maxWidth) current = next
    else {
      if (current) lines.push(current)
      current = word
    }
  }
  if (current) lines.push(current)
  return lines.length ? lines : ['']
}

interface JpgPageSink {
  pages: HTMLCanvasElement[]
}

function pushPage(sink: JpgPageSink, canvas: HTMLCanvasElement): void {
  sink.pages.push(canvas)
}

function drawSectionTitle(ctx: CanvasRenderingContext2D, title: string, y: number, left: number, right: number): number {
  ctx.textAlign = 'left'
  ctx.fillStyle = '#8b6914'
  ctx.font = '700 13px Georgia, "Times New Roman", serif'
  ctx.fillText(title.toUpperCase(), left, y)
  ctx.strokeStyle = '#e8dfd0'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(left, y + 8)
  ctx.lineTo(right, y + 8)
  ctx.stroke()
  return y + 28
}

function drawChipRow(
  ctx: CanvasRenderingContext2D,
  labels: string[],
  y: number,
  left: number,
  right: number,
  fill: string,
  stroke: string,
  color: string,
): number {
  if (labels.length === 0) {
    ctx.fillStyle = '#166534'
    ctx.font = '15px Georgia, "Times New Roman", serif'
    ctx.textAlign = 'left'
    ctx.fillText('Nenhum registro neste item.', left, y)
    return y + 28
  }
  let x = left
  let rowY = y
  ctx.font = '14px Georgia, "Times New Roman", serif'
  for (const label of labels) {
    const w = Math.min(right - left, ctx.measureText(label).width + 24)
    if (x + w > right) {
      x = left
      rowY += 36
    }
    ctx.fillStyle = fill
    ctx.strokeStyle = stroke
    ctx.lineWidth = 1
    ctx.fillRect(x, rowY - 16, w, 26)
    ctx.strokeRect(x, rowY - 16, w, 26)
    ctx.fillStyle = color
    ctx.textAlign = 'left'
    ctx.fillText(label, x + 12, rowY + 2)
    x += w + 10
  }
  return rowY + 28
}

async function renderJpgPages(
  espelho: EspelhoPontoPeriodo,
  options: PontoRegistrosExportOptions,
  marcacoesEnriquecidas: PontoMarcacaoComUrls[],
): Promise<HTMLCanvasElement[]> {
  const logoUrl = new URL(garboBrandLogo, window.location.origin).href
  const logo = await loadImage(logoUrl)
  const cnpjRaw = options.repCnpj?.trim() || ''
  const cnpj = cnpjRaw ? formatarCnpj(cnpjRaw) : '—'
  const sink: JpgPageSink = { pages: [] }
  const left = 72
  const right = JPG_W - 72
  const bottom = JPG_H - 70

  const startSummaryPage = () => {
    const page = newPage()
    const y = drawHeader(page.ctx, logo, cnpj, 'Espelho completo de ponto — REP-P')
    return { ...page, y }
  }

  let current = startSummaryPage()
  const g = () => current.ctx

  g().textAlign = 'center'
  g().fillStyle = '#1a1208'
  g().font = '700 26px Georgia, "Times New Roman", serif'
  g().fillText('ESPELHO DE REGISTROS', JPG_W / 2, current.y)
  current.y += 18
  g().fillStyle = '#faf8f5'
  g().strokeStyle = '#d4a853'
  g().lineWidth = 1.5
  g().fillRect(left, current.y, right - left, 78)
  g().strokeRect(left, current.y, right - left, 78)
  g().fillStyle = '#8b6914'
  g().font = '12px Georgia, "Times New Roman", serif'
  g().fillText('PRESTADOR / FUNCIONÁRIO', JPG_W / 2, current.y + 22)
  g().fillStyle = '#1a1208'
  g().font = '700 22px Georgia, "Times New Roman", serif'
  g().fillText(espelho.row.nome, JPG_W / 2, current.y + 50)
  g().font = '14px Georgia, "Times New Roman", serif'
  g().fillStyle = '#666'
  const tipo = FUNCIONARIO_TIPO_LABEL[espelho.row.tipo] ?? espelho.row.tipo
  g().fillText(`${tipo} · ${formatJornadaResumo(options.jornada) ?? '—'}`, JPG_W / 2, current.y + 70)
  current.y += 100

  const meta = [
    ['Período', options.periodoLabel],
    ['Intervalo', options.intervaloLabel || '—'],
    ['Hora extra', formatMinutosHoraExtra(espelho.horaExtraMinutos)],
    ['Faltas', `${espelho.row.faltas} dia${espelho.row.faltas === 1 ? '' : 's'}`],
  ]
  const boxW = (right - left - 24) / 4
  meta.forEach((item, i) => {
    const x = left + i * (boxW + 8)
    g().strokeStyle = '#e0d5c8'
    g().strokeRect(x, current.y, boxW, 58)
    g().fillStyle = '#777'
    g().font = '11px Georgia, "Times New Roman", serif'
    g().textAlign = 'left'
    g().fillText(item[0].toUpperCase(), x + 10, current.y + 20)
    g().fillStyle = '#1a1208'
    g().font = '700 15px Georgia, "Times New Roman", serif'
    const lines = wrapLine(g(), item[1], boxW - 18)
    g().fillText(lines[0] ?? '—', x + 10, current.y + 42)
  })
  current.y += 78

  const balanco = calcularBalancoResumoPonto(espelho.row)
  g().fillStyle = '#faf6ef'
  g().strokeStyle = '#d4a853'
  g().lineWidth = 2
  g().fillRect(left, current.y, right - left, 70)
  g().strokeRect(left, current.y, right - left, 70)
  const balancoCols: Array<[string, string, string]> = [
    ['Horas positivas (HE)', formatMinutosHoraExtra(balanco.horas_positivas_minutos), '#166534'],
    [
      'Horas negativas (atrasos)',
      balanco.horas_negativas_minutos > 0 ? `−${formatMinutosSaldo(balanco.horas_negativas_minutos)}` : '0min',
      '#9f1239',
    ],
    ['Saldo', formatMinutosComSinal(balanco.saldo_minutos), balanco.saldo_minutos >= 0 ? '#166534' : '#9f1239'],
  ]
  balancoCols.forEach((col, i) => {
    const x = left + ((right - left) / 3) * i + (right - left) / 6
    g().textAlign = 'center'
    g().fillStyle = '#6b5344'
    g().font = '11px Georgia, "Times New Roman", serif'
    g().fillText(col[0].toUpperCase(), x, current.y + 24)
    g().fillStyle = col[2]
    g().font = '700 20px Georgia, "Times New Roman", serif'
    g().fillText(col[1], x, current.y + 52)
  })
  current.y += 92

  const ensureSpace = (need: number) => {
    if (current.y + need < bottom) return false
    g().textAlign = 'center'
    g().fillStyle = '#888'
    g().font = '12px Georgia, "Times New Roman", serif'
    g().fillText('Continua…', JPG_W / 2, JPG_H - 42)
    pushPage(sink, current.canvas)
    current = startSummaryPage()
    return true
  }

  current.y = drawSectionTitle(current.ctx, 'Batidas e faltas no período', current.y, left, right)
  const dias = montarDiasResumoPonto(espelho.row)
  const colXs = [left, left + 150, left + 310, left + 490, left + 680, left + 840]
  const headers = ['Data', 'Início', 'Início almoço', 'Saída almoço', 'Saída', 'Saldo']

  const drawTableHead = () => {
    current.ctx.fillStyle = '#f5efe6'
    current.ctx.fillRect(left, current.y - 16, right - left, 28)
    current.ctx.fillStyle = '#6b5344'
    current.ctx.font = '700 12px Georgia, "Times New Roman", serif'
    current.ctx.textAlign = 'left'
    headers.forEach((h, i) => current.ctx.fillText(h.toUpperCase(), colXs[i] ?? left, current.y))
    current.y += 22
  }
  drawTableHead()

  if (dias.length === 0) {
    current.ctx.fillStyle = '#888'
    current.ctx.font = '14px Georgia, "Times New Roman", serif'
    current.ctx.fillText('Nenhuma batida nem falta no período.', left, current.y + 8)
    current.y += 32
  } else {
    for (const dia of dias) {
      if (ensureSpace(32)) drawTableHead()
      if (dia.ehFalta) {
        current.ctx.fillStyle = '#fdf2f2'
        current.ctx.fillRect(left, current.y - 14, right - left, 26)
        current.ctx.fillStyle = '#7f1d1d'
      } else {
        current.ctx.fillStyle = '#1a1208'
      }
      current.ctx.font = '14px Georgia, "Times New Roman", serif'
      current.ctx.textAlign = 'left'
      const dataLabel = `${formatDataCurtaPonto(dia.data)}${dia.ehFalta ? ' (falta)' : ''}`
      current.ctx.fillText(dataLabel, colXs[0] ?? left, current.y)
      current.ctx.fillText(dia.inicio ?? '—', colXs[1] ?? left, current.y)
      current.ctx.fillText(dia.inicioAlmoco ?? '—', colXs[2] ?? left, current.y)
      current.ctx.fillText(dia.saidaAlmoco ?? '—', colXs[3] ?? left, current.y)
      current.ctx.fillText(dia.saida ?? '—', colXs[4] ?? left, current.y)
      const saldoTxt = dia.ehFalta
        ? 'Falta'
        : dia.excedente_minutos === 0 && dia.atraso_minutos === 0
          ? '—'
          : formatMinutosComSinal(dia.saldo_minutos)
      current.ctx.fillStyle = dia.ehFalta || dia.saldo_minutos < 0 ? '#9f1239' : dia.saldo_minutos > 0 ? '#166534' : '#6b5344'
      current.ctx.fillText(saldoTxt, colXs[5] ?? left, current.y)
      current.y += 26
    }
  }

  const heDias = diasComHoraExtra(espelho)
  ensureSpace(80)
  current.y = drawSectionTitle(current.ctx, 'Horas extras (por dia)', current.y + 12, left, right)
  current.y = drawChipRow(
    current.ctx,
    heDias.map((d) => `${formatDataCurtaPonto(d.data)} · +${formatMinutosHoraExtra(d.minutos)}`),
    current.y,
    left,
    right,
    '#f0fdf4',
    '#bbf7d0',
    '#166534',
  )

  ensureSpace(80)
  current.y = drawSectionTitle(current.ctx, 'Faltas', current.y + 8, left, right)
  current.y = drawChipRow(
    current.ctx,
    espelho.faltas.map((f) => formatDataCurtaPonto(f.data)),
    current.y,
    left,
    right,
    '#fdf2f2',
    '#e8b4b4',
    '#7f1d1d',
  )

  ensureSpace(80)
  current.y = drawSectionTitle(current.ctx, 'Folgas', current.y + 8, left, right)
  current.y = drawChipRow(
    current.ctx,
    espelho.folgas.map((f) => formatDataCurtaPonto(f.data)),
    current.y,
    left,
    right,
    '#eff6ff',
    '#bfdbfe',
    '#1e40af',
  )

  ensureSpace(80)
  current.y = drawSectionTitle(current.ctx, 'Abonos', current.y + 8, left, right)
  current.y = drawChipRow(
    current.ctx,
    espelho.abonos.map((f) => formatDataCurtaPonto(f.data)),
    current.y,
    left,
    right,
    '#fffbeb',
    '#fde68a',
    '#92400e',
  )

  current.ctx.textAlign = 'center'
  current.ctx.fillStyle = '#666'
  current.ctx.font = '12px Georgia, "Times New Roman", serif'
  current.ctx.fillText(`Gerado em ${geradoEmLabel()} · Garbo Movelaria`, JPG_W / 2, JPG_H - 48)
  current.ctx.fillText('Conforme Portaria MTP nº 671/2021 (REP-P).', JPG_W / 2, JPG_H - 32)
  pushPage(sink, current.canvas)

  if (options.incluirFoto || options.incluirAssinatura) {
    for (const m of marcacoesEnriquecidas) {
      const page = newPage()
      let y = drawHeader(page.ctx, logo, cnpj, 'Comprovante de batida — REP-P')
      page.ctx.textAlign = 'center'
      page.ctx.fillStyle = '#1a1208'
      page.ctx.font = '700 24px Georgia, "Times New Roman", serif'
      page.ctx.fillText('REGISTRO DE PONTO', JPG_W / 2, y)
      y += 16
      page.ctx.fillStyle = '#faf8f5'
      page.ctx.strokeStyle = '#d4a853'
      page.ctx.fillRect(left, y, right - left, 64)
      page.ctx.strokeRect(left, y, right - left, 64)
      page.ctx.fillStyle = '#8b6914'
      page.ctx.font = '12px Georgia, "Times New Roman", serif'
      page.ctx.fillText('PRESTADOR / FUNCIONÁRIO', JPG_W / 2, y + 22)
      page.ctx.fillStyle = '#1a1208'
      page.ctx.font = '700 20px Georgia, "Times New Roman", serif'
      page.ctx.fillText(espelho.row.nome, JPG_W / 2, y + 48)
      y += 88

      const previsto = horaPrevistaPorTipo(m.tipo, options.jornada)?.slice(0, 5) ?? '—'
      const cells: Array<[string, string]> = [
        ['Tipo', labelPontoTipo(m.tipo)],
        ['NSR', String(m.nsr)],
        ['Horário batido', formatHoraPonto(marcacaoHoraEfetiva(m))],
        ['Horário previsto', previsto],
        ['Status', statusMarcacao(m)],
        ['Origem', m.origem === 'rh_manual' ? 'RH' : 'App'],
      ]
      const cw = (right - left - 16) / 2
      cells.forEach((cell, i) => {
        const col = i % 2
        const row = Math.floor(i / 2)
        const x = left + col * (cw + 16)
        const cy = y + row * 58
        page.ctx.strokeStyle = '#e0d5c8'
        page.ctx.strokeRect(x, cy, cw, 50)
        page.ctx.textAlign = 'left'
        page.ctx.fillStyle = '#777'
        page.ctx.font = '11px Georgia, "Times New Roman", serif'
        page.ctx.fillText(cell[0].toUpperCase(), x + 12, cy + 18)
        page.ctx.fillStyle = '#1a1208'
        page.ctx.font = '700 16px Georgia, "Times New Roman", serif'
        page.ctx.fillText(cell[1], x + 12, cy + 38)
      })
      y += 58 * 3 + 16
      page.ctx.textAlign = 'center'
      page.ctx.fillStyle = '#444'
      page.ctx.font = '15px Georgia, "Times New Roman", serif'
      page.ctx.fillText(formatDataHoraCompleta(marcacaoHoraEfetiva(m)), JPG_W / 2, y)
      y += 28

      const midiaW = options.incluirFoto && options.incluirAssinatura ? (right - left - 20) / 2 : right - left
      const midiaH = 380
      const drawMidiaBox = async (title: string, url: string | undefined, x: number, isAssinatura: boolean) => {
        page.ctx.strokeStyle = '#ccc'
        page.ctx.strokeRect(x, y, midiaW, midiaH)
        page.ctx.textAlign = 'left'
        page.ctx.fillStyle = '#666'
        page.ctx.font = '12px Georgia, "Times New Roman", serif'
        page.ctx.fillText(title.toUpperCase(), x + 12, y + 22)
        if (url) {
          const img = await loadImageFromRemote(url)
          if (img) {
            const pad = 16
            const maxW = midiaW - pad * 2
            const maxH = midiaH - 44
            const ratio = Math.min(maxW / img.width, maxH / img.height)
            const dw = img.width * ratio
            const dh = img.height * ratio
            const dx = x + (midiaW - dw) / 2
            const dy = y + 32 + (maxH - dh) / 2
            if (isAssinatura) {
              page.ctx.fillStyle = '#faf8f5'
              page.ctx.fillRect(x + pad, y + 32, maxW, maxH)
            }
            page.ctx.drawImage(img, dx, dy, dw, dh)
            return
          }
        }
        page.ctx.fillStyle = '#f5f5f5'
        page.ctx.fillRect(x + 12, y + 36, midiaW - 24, midiaH - 52)
        page.ctx.fillStyle = '#999'
        page.ctx.textAlign = 'center'
        page.ctx.font = '16px Georgia, "Times New Roman", serif'
        page.ctx.fillText(isAssinatura ? 'Sem assinatura' : 'Sem foto', x + midiaW / 2, y + midiaH / 2)
      }

      if (options.incluirFoto && options.incluirAssinatura) {
        await drawMidiaBox('Foto da batida', m.fotoUrl, left, false)
        await drawMidiaBox('Assinatura do funcionário', m.assinaturaUrl, left + midiaW + 20, true)
      } else if (options.incluirFoto) {
        await drawMidiaBox('Foto da batida', m.fotoUrl, left, false)
      } else if (options.incluirAssinatura) {
        await drawMidiaBox('Assinatura do funcionário', m.assinaturaUrl, left, true)
      }

      page.ctx.textAlign = 'center'
      page.ctx.fillStyle = '#666'
      page.ctx.font = '12px Georgia, "Times New Roman", serif'
      page.ctx.fillText('Conforme Portaria MTP nº 671/2021 (REP-P).', JPG_W / 2, JPG_H - 48)
      pushPage(sink, page.canvas)
    }
  }

  return sink.pages
}

export async function baixarEspelhoPontoJpg(
  espelho: EspelhoPontoPeriodo,
  options: PontoRegistrosExportOptions,
  marcacoesEnriquecidas: PontoMarcacaoComUrls[],
): Promise<number> {
  const pages = await renderJpgPages(espelho, options, marcacoesEnriquecidas)
  const base = `espelho-ponto-${slugNome(espelho.row.nome)}-${espelho.de}-${espelho.ate}`
  const pad = String(pages.length).length
  for (let i = 0; i < pages.length; i++) {
    const blob = await canvasToJpg(pages[i]!)
    const suffix = pages.length === 1 ? '' : `-p${String(i + 1).padStart(Math.max(2, pad), '0')}`
    downloadBlob(blob, `${base}${suffix}.jpg`)
    if (i < pages.length - 1) await sleep(280)
  }
  return pages.length
}
