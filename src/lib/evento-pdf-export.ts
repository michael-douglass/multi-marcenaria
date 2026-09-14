import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
import { parseEventoCadernoCorpo } from '@/lib/evento-caderno-anexos'
import { compositeEventoPhoto } from '@/lib/evento-photo-composite'
import {
  formatarMoedaEvento,
  labelEventoQuando,
  labelEventoTipo,
  labelEventoDataExtenso,
  totalLinhaItem,
  totaisDoEvento,
} from '@/lib/evento-helpers'
import type { EventoBoard, EventoMidia, EventoPdfColunaId, EventoSecao } from '@/lib/evento-types'
import { EVENTO_PDF_COLUNAS, EVENTO_SECAO_DICAS } from '@/lib/evento-types'

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export interface EventoPdfBranding {
  nome: string
  cnpj?: string | null
  logoUrl?: string | null
}

/** Quantidade que cabe no miolo de uma folha A4 sem apertar. */
const FOLHA = {
  itens: 9,
  participantes: 11,
  totais: 11,
  tarefas: 12,
  cadernoLinhas: 22,
  cadernoCols: 78,
} as const

interface FolhaDraft {
  secao: string
  variant: 'capa' | 'planilha' | 'papel'
  inner: string
}

function geradoEmLabel(): string {
  return format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

function formatarQuandoIso(iso: string): string {
  try {
    return format(new Date(iso), "dd/MM/yyyy HH:mm", { locale: ptBR })
  } catch {
    return iso
  }
}

function fatias<T>(itens: T[], tamanho: number): T[][] {
  if (itens.length === 0) return [[]]
  const out: T[][] = []
  for (let i = 0; i < itens.length; i += tamanho) out.push(itens.slice(i, i + tamanho))
  return out
}

function partirLinhas(texto: string, colunas: number, linhas: number): string[] {
  const fonte = texto.replace(/\r\n/g, '\n')
  if (!fonte.trim()) return ['']
  const fisicas: string[] = []
  for (const linha of fonte.split('\n')) {
    if (linha.length <= colunas) {
      fisicas.push(linha)
      continue
    }
    let resto = linha
    while (resto.length > colunas) {
      const janela = resto.slice(0, colunas + 1)
      let corte = janela.lastIndexOf(' ')
      if (corte < Math.floor(colunas * 0.45)) corte = colunas
      fisicas.push(resto.slice(0, corte).trimEnd())
      resto = resto.slice(corte).trimStart()
    }
    if (resto) fisicas.push(resto)
  }
  const paginas: string[] = []
  for (let i = 0; i < fisicas.length; i += linhas) {
    paginas.push(fisicas.slice(i, i + linhas).join('\n'))
  }
  return paginas.length ? paginas : ['']
}

function montarFolhas(
  drafts: FolhaDraft[],
  branding: EventoPdfBranding,
  tituloEvento: string,
): string {
  const total = drafts.length
  return drafts
    .map((draft, i) => {
      const n = i + 1
      if (draft.variant === 'capa') {
        return `<article class="folha folha-capa">${draft.inner}</article>`
      }
      const papel = draft.variant === 'papel' ? ' folha-papel' : ''
      return `<article class="folha${papel}">
        <table class="folha-grade">
          <tr class="linha-topo"><td>
            <table class="running"><tr>
              <td>${esc(branding.nome)}</td>
              <td>${esc(draft.secao)}</td>
            </tr></table>
          </td></tr>
          <tr class="linha-miolo"><td>${draft.inner}</td></tr>
          <tr class="linha-base"><td>
            <table class="running"><tr>
              <td>${esc(tituloEvento)}</td>
              <td>Folha ${n} de ${total}</td>
            </tr></table>
          </td></tr>
        </table>
      </article>`
    })
    .join('')
}

function capaHtml(board: EventoBoard, branding: EventoPdfBranding): FolhaDraft {
  const { evento } = board
  const totais = totaisDoEvento(board.participantes.length, board.itens)
  const tarefasPendentes = board.tarefas.filter((t) => !t.concluida).length
  const folhas = board.paginas.length
  const custoPessoa = totais.pessoas > 0 ? totais.total / totais.pessoas : 0
  const observacoes = evento.observacoes?.trim()
  return {
    secao: 'Capa',
    variant: 'capa',
    inner: `
      <table class="moldura">
        <tr class="capa-topo"><td>
          ${branding.logoUrl ? `<img class="logo" src="${esc(branding.logoUrl)}" alt="" />` : ''}
          <p class="kicker">Dossiê de evento</p>
          <h1>${esc(branding.nome)}</h1>
          ${branding.cnpj?.trim() ? `<p class="cnpj">CNPJ ${esc(branding.cnpj.trim())}</p>` : ''}
        </td></tr>
        <tr class="capa-miolo"><td>
          <p class="filete" aria-hidden="true"></p>
          <h2>${esc(evento.titulo)}</h2>
          <p class="data-extenso">${esc(labelEventoDataExtenso(evento.data_evento))}</p>
          <p class="meta">${esc(labelEventoTipo(evento.tipo, evento.tipo_custom))} · ${esc(labelEventoQuando(evento.data_evento))}</p>
          ${observacoes ? `<blockquote class="obs">${esc(observacoes)}</blockquote>` : ''}
        </td></tr>
        <tr class="capa-base"><td>
          <table class="kpis">
            <tr>
              <td><span>Pessoas</span><strong>${totais.pessoas}</strong></td>
              <td><span>Itens</span><strong>${totais.itens}</strong></td>
              <td><span>Folhas</span><strong>${folhas}</strong></td>
            </tr>
            <tr>
              <td><span>Tarefas abertas</span><strong>${tarefasPendentes}</strong></td>
              <td><span>Total estimado</span><strong>${esc(formatarMoedaEvento(totais.total))}</strong></td>
              <td><span>Por pessoa</span><strong>${totais.pessoas > 0 ? esc(formatarMoedaEvento(custoPessoa)) : '—'}</strong></td>
            </tr>
          </table>
          <p class="gerado">Gerado em ${esc(geradoEmLabel())}</p>
        </td></tr>
      </table>`,
  }
}

function blocoParticipantes(board: EventoBoard): FolhaDraft[] {
  const grupos = fatias(board.participantes, FOLHA.participantes)
  const totalGrupos = grupos.length
  return grupos.map((grupo, g) => {
    const offset = g * FOLHA.participantes
    const rows = grupo
      .map((p, i) => {
        const fotos = p.midias.length
        const origem = p.lead_id ? `Lead nº ${p.lead_id}` : 'Convidado'
        return `<tr>
          <td class="num">${offset + i + 1}</td>
          <td>
            <strong>${esc(p.nome)}</strong>
            <span class="sub">${esc(origem)}${fotos ? ` · ${fotos} ${fotos === 1 ? 'foto' : 'fotos'}` : ''}</span>
          </td>
          <td>${esc(p.telefone ?? '—')}</td>
          <td>${esc(p.email ?? '—')}</td>
        </tr>`
      })
      .join('')
    const continua = totalGrupos > 1
      ? `<p class="sec-meta">${board.participantes.length} na lista · parte ${g + 1} de ${totalGrupos}</p>`
      : `<p class="sec-meta">${board.participantes.length} ${board.participantes.length === 1 ? 'pessoa na lista' : 'pessoas na lista'}</p>`
    return {
      secao: continua && g > 0 ? 'Participantes · continua' : 'Participantes',
      variant: 'planilha' as const,
      inner: `
        <h3>Participantes</h3>
        ${continua}
        <table class="planilha">
          <colgroup>
            <col class="col-idx" />
            <col class="col-nome" />
            <col class="col-fone" />
            <col class="col-mail" />
          </colgroup>
          <thead><tr><th>#</th><th>Nome</th><th>Telefone</th><th>E-mail</th></tr></thead>
          <tbody>${rows || '<tr><td colspan="4">Ninguém na lista.</td></tr>'}</tbody>
        </table>`,
    }
  })
}

function blocoItens(board: EventoBoard): FolhaDraft[] {
  const total = totaisDoEvento(board.participantes.length, board.itens).total
  const grupos = fatias(board.itens, FOLHA.itens)
  const totalGrupos = grupos.length
  return grupos.map((grupo, g) => {
    const offset = g * FOLHA.itens
    const ultima = g === totalGrupos - 1
    const rows = grupo
      .map((item, i) => {
        const fornecedor = [item.fornecedor, item.telefone_fornecedor].filter(Boolean).join(' · ')
        return `<tr>
          <td class="num">${offset + i + 1}</td>
          <td>
            <strong>${esc(item.nome)}</strong>
            ${fornecedor ? `<span class="sub">${esc(fornecedor)}</span>` : '<span class="sub">Sem fornecedor</span>'}
          </td>
          <td class="nowrap">${item.quantidade} ${esc(item.unidade)}</td>
          <td class="num">${esc(formatarMoedaEvento(item.preco_unitario))}</td>
          <td class="num">${esc(formatarMoedaEvento(totalLinhaItem(item)))}</td>
        </tr>`
      })
      .join('')
    return {
      secao: g > 0 ? 'Itens e preços · continua' : 'Itens e preços',
      variant: 'planilha' as const,
      inner: `
        <h3>Itens e preços</h3>
        <p class="sec-meta">${board.itens.length} ${board.itens.length === 1 ? 'item' : 'itens'} · subtotal ${esc(formatarMoedaEvento(total))}${totalGrupos > 1 ? ` · parte ${g + 1} de ${totalGrupos}` : ''}</p>
        <table class="planilha itens">
          <colgroup>
            <col class="col-idx" />
            <col class="col-nome" />
            <col class="col-qtd" />
            <col class="col-moeda" />
            <col class="col-moeda" />
          </colgroup>
          <thead>
            <tr>
              <th>#</th><th>Item</th><th>Qtd</th><th class="num">Unitário</th><th class="num">Total</th>
            </tr>
          </thead>
          <tbody>${rows || '<tr><td colspan="5">Nenhum item.</td></tr>'}</tbody>
          ${ultima ? `<tfoot>
            <tr>
              <td colspan="4">${totalGrupos > 1 ? 'Subtotal geral das compras' : 'Subtotal das compras'}</td>
              <td class="num">${esc(formatarMoedaEvento(total))}</td>
            </tr>
          </tfoot>` : `<tfoot>
            <tr>
              <td colspan="5">Continua na próxima folha</td>
            </tr>
          </tfoot>`}
        </table>`,
    }
  })
}

function blocoCaderno(board: EventoBoard): FolhaDraft[] {
  const secoes: EventoSecao[] = ['detalhes', 'discurso', 'palestra']
  const drafts: FolhaDraft[] = []
  for (const secao of secoes) {
    const folhas = board.paginas.filter((p) => p.secao === secao).sort((a, b) => a.ordem - b.ordem)
    const dica = EVENTO_SECAO_DICAS[secao]
    if (folhas.length === 0) continue
    folhas.forEach((folha, i) => {
      const { texto, imageUrls } = parseEventoCadernoCorpo(folha.corpo)
      const partes = partirLinhas(texto, FOLHA.cadernoCols, FOLHA.cadernoLinhas)
      partes.forEach((parte, p) => {
        const corpo = parte.trim()
        const parteLabel = partes.length > 1 ? ` · parte ${p + 1} de ${partes.length}` : ''
        const anexosHtml =
          p === partes.length - 1 && imageUrls.length > 0
            ? `<div class="folha-anexos">${imageUrls
                .map((url) => `<img src="${esc(url)}" alt="" />`)
                .join('')}</div>`
            : ''
        drafts.push({
          secao: `${dica.aba} · folha ${i + 1}${parteLabel}`,
          variant: 'papel',
          inner: `
            <div class="folha-caderno">
              <table class="papel-grade">
                <tr class="papel-topo"><td>
                  <p class="folha-kicker">${esc(dica.aba)} · Folha ${i + 1} de ${folhas.length}${esc(parteLabel)}</p>
                  <h4>${esc(folha.titulo.trim() || 'Sem título')}</h4>
                  <p class="folha-dica">${esc(dica.dica)}</p>
                </td></tr>
                <tr class="papel-miolo"><td>
                  <pre>${corpo ? esc(parte) : imageUrls.length && p === 0 ? '' : '<span class="vazio">— em branco —</span>'}</pre>
                  ${anexosHtml}
                </td></tr>
                <tr class="papel-base"><td>
                  Atualizada em ${esc(formatarQuandoIso(folha.atualizado_em))}
                </td></tr>
              </table>
            </div>`,
        })
      })
    })
  }
  if (drafts.length === 0) {
    drafts.push({
      secao: 'Caderno',
      variant: 'papel',
      inner: `
        <div class="folha-caderno">
          <table class="papel-grade">
            <tr class="papel-topo"><td>
              <p class="folha-kicker">Caderno</p>
              <h4>Em branco</h4>
              <p class="folha-dica">Nenhuma folha escrita neste evento.</p>
            </td></tr>
            <tr class="papel-miolo"><td>
              <pre><span class="vazio">— em branco —</span></pre>
            </td></tr>
            <tr class="papel-base"><td></td></tr>
          </table>
        </div>`,
    })
  }
  return drafts
}

function blocoTotais(board: EventoBoard): FolhaDraft[] {
  const t = totaisDoEvento(board.participantes.length, board.itens)
  const porPessoa = t.pessoas > 0 ? t.total / t.pessoas : 0
  const grupos = fatias(board.itens, FOLHA.totais)
  const totalGrupos = grupos.length
  return grupos.map((grupo, g) => {
    const offset = g * FOLHA.totais
    const ultima = g === totalGrupos - 1
    const linhas = grupo
      .map((item, i) => `
        <tr>
          <td class="num">${offset + i + 1}</td>
          <td>${esc(item.nome)}</td>
          <td class="nowrap">${item.quantidade} ${esc(item.unidade)}</td>
          <td class="num">${esc(formatarMoedaEvento(totalLinhaItem(item)))}</td>
        </tr>`)
      .join('')
    const kpis = g === 0
      ? `<table class="kpis kpis-totais">
          <tr>
            <td><span>Pessoas</span><strong>${t.pessoas}</strong></td>
            <td><span>Itens</span><strong>${t.itens}</strong></td>
            <td><span>Total estimado</span><strong>${esc(formatarMoedaEvento(t.total))}</strong></td>
            <td><span>Custo por pessoa</span><strong>${t.pessoas > 0 ? esc(formatarMoedaEvento(porPessoa)) : '—'}</strong></td>
          </tr>
        </table>`
      : ''
    return {
      secao: g > 0 ? 'Totais · continua' : 'Totais',
      variant: 'planilha' as const,
      inner: `
        <h3>Totais</h3>
        ${kpis}
        <table class="planilha">
          <colgroup>
            <col class="col-idx" />
            <col class="col-nome" />
            <col class="col-qtd" />
            <col class="col-moeda" />
          </colgroup>
          <thead><tr><th>#</th><th>Item</th><th>Qtd</th><th class="num">Linha</th></tr></thead>
          <tbody>${linhas || '<tr><td colspan="4">Nada para somar ainda.</td></tr>'}</tbody>
          ${ultima ? `<tfoot><tr><td colspan="3">Total</td><td class="num">${esc(formatarMoedaEvento(t.total))}</td></tr></tfoot>` : `<tfoot><tr><td colspan="4">Continua na próxima folha</td></tr></tfoot>`}
        </table>`,
    }
  })
}

function blocoTarefas(board: EventoBoard): FolhaDraft[] {
  const abertas = board.tarefas.filter((t) => !t.concluida)
  const feitas = board.tarefas.filter((t) => t.concluida)
  const lista = [...abertas, ...feitas]
  const grupos = fatias(lista, FOLHA.tarefas)
  const totalGrupos = grupos.length
  const row = (tarefa: (typeof board.tarefas)[number]) => `
    <li class="${tarefa.concluida ? 'done' : ''}">
      <span class="check">${tarefa.concluida ? '☑' : '☐'}</span>
      <span>
        <strong>${esc(tarefa.titulo)}</strong>
        <small>${tarefa.concluida ? 'Concluída' : 'Pendente'} · criada em ${esc(formatarQuandoIso(tarefa.criado_em))}</small>
      </span>
    </li>`
  return grupos.map((grupo, g) => {
    const pendentes = grupo.filter((t) => !t.concluida)
    const concluidas = grupo.filter((t) => t.concluida)
    return {
      secao: g > 0 ? 'Tarefas · continua' : 'Tarefas',
      variant: 'planilha' as const,
      inner: `
        <h3>Tarefas</h3>
        <p class="sec-meta">${abertas.length} pendente${abertas.length === 1 ? '' : 's'} · ${feitas.length} concluída${feitas.length === 1 ? '' : 's'}${totalGrupos > 1 ? ` · parte ${g + 1} de ${totalGrupos}` : ''}</p>
        ${pendentes.length ? `<h4 class="subh">Pendentes</h4><ul class="tarefas">${pendentes.map(row).join('')}</ul>` : ''}
        ${concluidas.length ? `<h4 class="subh">Concluídas</h4><ul class="tarefas">${concluidas.map(row).join('')}</ul>` : ''}
        ${board.tarefas.length === 0 ? '<p>Nenhuma tarefa.</p>' : ''}`,
    }
  })
}

const CSS = `
  * { box-sizing: border-box; }
  html, body { margin: 0; padding: 0; }
  html {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  body {
    font-family: Palatino Linotype, Palatino, Book Antiqua, Georgia, serif;
    color: #2a1812;
    background: #1c110c;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .aviso-tela {
    display: block;
    width: 210mm;
    margin: 0 auto;
    padding: 16px 8px 10px;
    color: #e8dcc8;
    font-size: 9pt;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    text-align: center;
  }
  .folha {
    width: 210mm;
    height: 297mm;
    margin: 0 auto 22px;
    background: #f4ead6;
    box-shadow: 0 28px 56px rgba(0, 0, 0, 0.45);
    overflow: hidden;
    page-break-after: always;
    page-break-inside: avoid;
    break-after: page;
    break-inside: avoid;
  }
  .folha:last-of-type {
    margin-bottom: 28px;
    page-break-after: auto;
    break-after: auto;
  }
  .folha-grade {
    width: 100%;
    height: 100%;
    table-layout: fixed;
    border-collapse: collapse;
  }
  .linha-topo td,
  .linha-base td {
    height: 1px;
    padding: 11mm 16mm 3mm;
    vertical-align: bottom;
  }
  .linha-base td {
    padding: 3mm 16mm 11mm;
    vertical-align: top;
  }
  .linha-miolo td {
    height: 100%;
    padding: 2mm 16mm 4mm;
    vertical-align: top;
  }
  .running {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    border-bottom: 1.5pt solid #c9a07b;
  }
  .linha-base .running {
    border-bottom: 0;
    border-top: 1pt solid #c9a07b;
  }
  .running td {
    font-size: 8pt;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #8a6a3a;
    padding: 0 0 4px;
  }
  .running td:last-child { text-align: right; }
  .folha-capa {
    padding: 12mm;
  }
  table.moldura {
    width: 100%;
    height: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    border: 1pt solid #c9a07b;
    box-shadow: inset 0 0 0 4.5mm rgba(201, 160, 123, 0.18);
    background:
      radial-gradient(ellipse at 50% 18%, rgba(240, 210, 140, 0.28), transparent 58%),
      linear-gradient(180deg, #fffaf1 0%, #f3ead6 100%);
    text-align: center;
  }
  .capa-topo td { height: 1px; padding: 14mm 12mm 4mm; vertical-align: top; }
  .capa-miolo td { height: 100%; padding: 4mm 12mm; vertical-align: middle; }
  .capa-base td { height: 1px; padding: 4mm 12mm 12mm; vertical-align: bottom; }
  .kicker {
    letter-spacing: 0.34em;
    text-transform: uppercase;
    font-size: 9pt;
    color: #8a6a3a;
    margin: 8mm 0 3mm;
  }
  .logo { max-height: 18mm; margin-bottom: 2mm; }
  h1 {
    margin: 0;
    font-size: 13pt;
    font-weight: 600;
    letter-spacing: 0.18em;
    text-transform: uppercase;
  }
  h2 {
    margin: 4mm 0 3mm;
    font-size: 28pt;
    font-weight: 700;
    line-height: 1.15;
  }
  h3 {
    color: #2a1812;
    border-bottom: 2pt solid #c9a07b;
    padding-bottom: 2.5mm;
    font-size: 16pt;
    margin: 0 0 2.5mm;
  }
  h4 { margin: 0; font-size: 16pt; }
  .subh {
    font-size: 9pt;
    letter-spacing: 0.14em;
    text-transform: uppercase;
    color: #8a6a3a;
    margin: 5mm 0 2mm;
  }
  .filete {
    width: 28mm;
    margin: 0 auto 7mm;
    border-top: 1.6pt solid #c9a07b;
    border-bottom: 0.4pt solid #c9a07b;
    padding-top: 1.6mm;
  }
  .cnpj, .meta, .gerado, .sec-meta { color: #5c4030; font-size: 9.5pt; }
  .data-extenso { font-size: 13pt; margin: 0 0 2mm; font-style: italic; }
  .gerado {
    margin: 6mm 0 0;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    font-size: 8pt;
  }
  .obs {
    margin: 6mm auto 0;
    max-width: 140mm;
    padding: 3mm 4mm;
    border-left: 2.5pt solid #c9a07b;
    background: rgba(201, 160, 123, 0.12);
    text-align: left;
    font-style: italic;
  }
  table.kpis {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    margin: 6mm 0 0;
    background: transparent;
  }
  table.kpis td {
    border: 1pt solid #e4d2b8;
    background: #fffdf8;
    text-align: center;
    vertical-align: top;
    padding: 3.5mm 2.5mm;
  }
  table.kpis span {
    display: block;
    font-size: 7pt;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #8a6a3a;
  }
  table.kpis strong {
    display: block;
    font-size: 13pt;
    font-weight: 700;
    margin-top: 1.5mm;
    word-break: break-word;
  }
  table.kpis-totais { margin: 0 0 4mm; }
  table.planilha {
    width: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    font-size: 10pt;
    background: #fffdf8;
  }
  .col-idx { width: 8%; }
  .col-qtd { width: 13%; }
  .col-moeda { width: 18%; }
  .col-fone { width: 20%; }
  .col-mail { width: 26%; }
  table.planilha thead { display: table-header-group; }
  table.planilha tfoot { display: table-footer-group; }
  table.planilha th, table.planilha td {
    border-bottom: 0.6pt solid #e8dcc8;
    padding: 2.6mm 2mm;
    text-align: left;
    vertical-align: top;
    overflow-wrap: anywhere;
    word-wrap: break-word;
  }
  table.planilha th {
    font-size: 8pt;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #8a6a3a;
    border-bottom: 1.5pt solid #c9a07b;
  }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  td.nowrap { white-space: nowrap; overflow-wrap: normal; }
  .sub {
    display: block;
    font-size: 8pt;
    color: #7a6456;
    font-weight: 400;
    margin-top: 0.8mm;
  }
  tfoot td { font-weight: 700; border-top: 1.5pt solid #c9a07b; background: #efe3cc; }
  .folha-papel .linha-miolo td { padding: 0 10mm 0 0; }
  .folha-caderno {
    height: 100%;
    padding: 4mm 12mm 6mm 22mm;
    position: relative;
    background-color: #f6eedc;
    background-image:
      radial-gradient(circle at 11mm 18%, #f6eedc 0 2.2mm, #2a1812 2.4mm 3.1mm, transparent 3.3mm),
      radial-gradient(circle at 11mm 50%, #f6eedc 0 2.2mm, #2a1812 2.4mm 3.1mm, transparent 3.3mm),
      radial-gradient(circle at 11mm 82%, #f6eedc 0 2.2mm, #2a1812 2.4mm 3.1mm, transparent 3.3mm),
      repeating-linear-gradient(
        to bottom,
        transparent 0 7.6mm,
        rgba(80, 50, 24, 0.14) 7.6mm 8mm
      );
  }
  .papel-grade {
    width: 100%;
    height: 100%;
    table-layout: fixed;
    border-collapse: collapse;
    background: transparent;
  }
  .papel-topo td { height: 1px; vertical-align: top; padding: 0; }
  .papel-miolo td { height: 100%; vertical-align: top; padding: 0; }
  .papel-base td {
    height: 1px;
    vertical-align: bottom;
    padding: 4mm 0 0;
    font-size: 8pt;
    color: #7a6456;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .folha-caderno::before {
    content: '';
    position: absolute;
    top: 0; bottom: 0; left: 16mm;
    width: 0.5mm;
    background: #b23b32;
    opacity: 0.55;
  }
  .folha-kicker {
    font-size: 8pt;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #8a6a3a;
    margin: 0 0 1mm;
  }
  .folha-dica { font-size: 8.5pt; color: #7a6456; margin: 1mm 0 4mm; }
  .folha-caderno pre {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-family: Palatino Linotype, Palatino, Georgia, serif;
    font-size: 12pt;
    line-height: 8mm;
    margin: 0;
    min-height: 0;
  }
  .folha-anexos {
    display: flex;
    flex-wrap: wrap;
    gap: 3mm;
    margin-top: 4mm;
  }
  .folha-anexos img {
    width: 42mm;
    height: 42mm;
    object-fit: cover;
    border: 0.4pt solid #c9a07b;
    border-radius: 1.5mm;
  }
  .vazio { color: #9a8170; font-style: italic; }
  .tarefas { list-style: none; padding: 0; margin: 0; }
  .tarefas li {
    display: table;
    width: 100%;
    table-layout: fixed;
    padding: 2.4mm 0;
    border-bottom: 0.5pt solid #e8dcc8;
  }
  .tarefas .check { display: table-cell; width: 8mm; font-size: 12pt; vertical-align: top; }
  .tarefas li > span:last-child { display: table-cell; }
  .tarefas small { display: block; color: #7a6456; font-weight: 400; }
  .done { color: #7a6456; }
  .done strong { text-decoration: line-through; }
  @page { size: A4; margin: 0; }
  @media print {
    body { background: #fff; }
    .aviso-tela { display: none; }
    .folha {
      margin: 0;
      box-shadow: none;
      width: 210mm;
      height: 297mm;
    }
    .folha:last-of-type { margin-bottom: 0; }
  }
`

export function buildEventoPdfHtml(
  board: EventoBoard,
  branding: EventoPdfBranding,
  colunas: EventoPdfColunaId[],
): string {
  const drafts: FolhaDraft[] = [capaHtml(board, branding)]
  if (colunas.includes('participantes')) drafts.push(...blocoParticipantes(board))
  if (colunas.includes('itens')) drafts.push(...blocoItens(board))
  if (colunas.includes('caderno')) drafts.push(...blocoCaderno(board))
  if (colunas.includes('totais')) drafts.push(...blocoTotais(board))
  if (colunas.includes('tarefas')) drafts.push(...blocoTarefas(board))
  const folhas = montarFolhas(drafts, branding, board.evento.titulo)
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><title>${esc(board.evento.titulo)}</title>
    <style>${CSS}</style></head><body>
      <p class="aviso-tela">Cada retângulo é uma folha A4 · use Imprimir / Guardar em PDF</p>
      ${folhas}
    </body></html>`
}

function printWindowWhenReady(win: Window): void {
  let printed = false
  const run = () => {
    if (printed) return
    printed = true
    win.focus()
    win.print()
  }
  const afterLayout = () => {
    const kick = () => {
      win.requestAnimationFrame(() => {
        win.requestAnimationFrame(run)
      })
    }
    const fonts = win.document.fonts
    if (fonts?.ready) {
      void fonts.ready.then(kick).catch(kick)
      return
    }
    kick()
  }
  if (win.document.readyState === 'complete') afterLayout()
  else win.onload = afterLayout
}

export function openEventoPdfPrint(
  board: EventoBoard,
  branding: EventoPdfBranding,
  colunas: EventoPdfColunaId[],
): void {
  if (colunas.length === 0) throw new Error('Marque pelo menos uma coluna')
  const html = buildEventoPdfHtml(board, branding, colunas)
  const win = window.open('', '_blank')
  if (!win) throw new Error('Permita pop-ups para gerar o PDF')
  win.document.write(html)
  win.document.close()
  printWindowWhenReady(win)
}

export async function downloadEventoFotosPdf(input: {
  titulo: string
  midias: EventoMidia[]
  branding: EventoPdfBranding
}): Promise<void> {
  const fotos = await Promise.all(
    input.midias.map(async (midia) => ({
      src: await compositeEventoPhoto(midia.file_url, midia.anotacoes),
      nome: midia.file_name ?? 'foto',
    })),
  )
  const body = fotos
    .map((foto, i) => `<figure><img src="${foto.src}" alt="${esc(foto.nome)}" /><figcaption>Foto ${i + 1} · ${esc(foto.nome)}</figcaption></figure>`)
    .join('')
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
    <title>Fotos · ${esc(input.titulo)}</title>
    <style>
      body { font-family: Georgia, serif; color: #2a1812; background: #fff; margin: 18px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      .capa { text-align: center; border-bottom: 3px solid #c9a07b; padding-bottom: 12px; margin-bottom: 16px; }
      img { max-width: 100%; }
      figure { page-break-inside: avoid; margin: 0 0 18px; }
      figcaption { font-size: 10pt; color: #5c4030; margin-top: 6px; }
      @page { size: A4; margin: 12mm; }
    </style></head>
    <body>
      <div class="capa">
        ${input.branding.logoUrl ? `<img style="max-height:48px" src="${esc(input.branding.logoUrl)}" alt="" />` : ''}
        <h1>${esc(input.branding.nome)}</h1>
        ${input.branding.cnpj ? `<p>CNPJ ${esc(input.branding.cnpj)}</p>` : ''}
        <h2>${esc(input.titulo)}</h2>
        <p>Gerado em ${geradoEmLabel()}</p>
      </div>
      ${body || '<p>Nenhuma foto.</p>'}
    </body></html>`
  const win = window.open('', '_blank')
  if (!win) throw new Error('Permita pop-ups para gerar o PDF das fotos')
  win.document.write(html)
  win.document.close()
  printWindowWhenReady(win)
}

export { EVENTO_PDF_COLUNAS }
