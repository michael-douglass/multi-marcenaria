import { format } from 'date-fns'
import { ptBR } from 'date-fns/locale'
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

function capaHtml(board: EventoBoard, branding: EventoPdfBranding): string {
  const { evento } = board
  const totais = totaisDoEvento(board.participantes.length, board.itens)
  const tarefasPendentes = board.tarefas.filter((t) => !t.concluida).length
  const folhas = board.paginas.length
  const custoPessoa = totais.pessoas > 0 ? totais.total / totais.pessoas : 0
  const observacoes = evento.observacoes?.trim()
  return `
    <section class="capa">
      ${branding.logoUrl ? `<img class="logo" src="${esc(branding.logoUrl)}" alt="" />` : ''}
      <p class="kicker">Dossiê de evento</p>
      <h1>${esc(branding.nome)}</h1>
      ${branding.cnpj?.trim() ? `<p class="cnpj">CNPJ ${esc(branding.cnpj.trim())}</p>` : ''}
      <hr />
      <h2>${esc(evento.titulo)}</h2>
      <p class="data-extenso">${esc(labelEventoDataExtenso(evento.data_evento))}</p>
      <p class="meta">${esc(labelEventoTipo(evento.tipo, evento.tipo_custom))} · ${esc(labelEventoQuando(evento.data_evento))}</p>
      ${observacoes ? `<blockquote class="obs">${esc(observacoes)}</blockquote>` : ''}
      <dl class="capa-resumo">
        <div><dt>Pessoas</dt><dd>${totais.pessoas}</dd></div>
        <div><dt>Itens</dt><dd>${totais.itens}</dd></div>
        <div><dt>Folhas</dt><dd>${folhas}</dd></div>
        <div><dt>Tarefas abertas</dt><dd>${tarefasPendentes}</dd></div>
        <div><dt>Total estimado</dt><dd>${esc(formatarMoedaEvento(totais.total))}</dd></div>
        <div><dt>Por pessoa</dt><dd>${totais.pessoas > 0 ? esc(formatarMoedaEvento(custoPessoa)) : '—'}</dd></div>
      </dl>
      <p class="gerado">Gerado em ${esc(geradoEmLabel())}</p>
    </section>
  `
}

function blocoParticipantes(board: EventoBoard): string {
  const rows = board.participantes
    .map((p, i) => {
      const fotos = p.midias.length
      return `<tr>
        <td class="num">${i + 1}</td>
        <td>${esc(p.nome)}</td>
        <td>${esc(p.telefone ?? '—')}</td>
        <td>${esc(p.email ?? '—')}</td>
        <td>${p.lead_id ? `<span class="tag">Lead</span> nº ${p.lead_id}` : '<span class="tag">Convidado</span>'}</td>
        <td>${fotos} ${fotos === 1 ? 'foto' : 'fotos'}</td>
      </tr>`
    })
    .join('')
  return `<section>
    <h3>Participantes</h3>
    <p class="sec-meta">${board.participantes.length} ${board.participantes.length === 1 ? 'pessoa na lista' : 'pessoas na lista'}</p>
    <table>
      <thead><tr><th>#</th><th>Nome</th><th>Telefone</th><th>E-mail</th><th>Origem</th><th>Fotos</th></tr></thead>
      <tbody>${rows || '<tr><td colspan="6">Ninguém na lista.</td></tr>'}</tbody>
    </table>
  </section>`
}

function blocoItens(board: EventoBoard): string {
  const rows = board.itens
    .map((item) => `
      <tr>
        <td>${esc(item.nome)}</td>
        <td>${item.quantidade} ${esc(item.unidade)}</td>
        <td>${esc(item.fornecedor ?? '—')}</td>
        <td>${esc(item.telefone_fornecedor ?? '—')}</td>
        <td class="num">${esc(formatarMoedaEvento(item.preco_unitario))}</td>
        <td class="num">${esc(formatarMoedaEvento(totalLinhaItem(item)))}</td>
      </tr>`)
    .join('')
  const total = totaisDoEvento(board.participantes.length, board.itens).total
  return `<section>
    <h3>Itens e preços</h3>
    <p class="sec-meta">${board.itens.length} ${board.itens.length === 1 ? 'item' : 'itens'} · subtotal ${esc(formatarMoedaEvento(total))}</p>
    <table>
      <thead>
        <tr>
          <th>Item</th><th>Qtd</th><th>Fornecedor</th><th>Telefone</th><th>Unitário</th><th>Total</th>
        </tr>
      </thead>
      <tbody>${rows || '<tr><td colspan="6">Nenhum item.</td></tr>'}</tbody>
      <tfoot>
        <tr>
          <td colspan="5">Subtotal das compras</td>
          <td class="num">${esc(formatarMoedaEvento(total))}</td>
        </tr>
      </tfoot>
    </table>
  </section>`
}

function blocoCaderno(board: EventoBoard): string {
  const secoes: EventoSecao[] = ['detalhes', 'discurso', 'palestra']
  const html = secoes.map((secao) => {
    const folhas = board.paginas.filter((p) => p.secao === secao).sort((a, b) => a.ordem - b.ordem)
    const dica = EVENTO_SECAO_DICAS[secao]
    const body = folhas
      .map((folha, i) => {
        const corpo = folha.corpo.trim()
        return `
        <article class="folha-caderno">
          <header>
            <p class="folha-kicker">${esc(dica.aba)} · Folha ${i + 1} de ${folhas.length}</p>
            <h4>${esc(folha.titulo.trim() || 'Sem título')}</h4>
            <p class="folha-dica">${esc(dica.dica)}</p>
          </header>
          <pre>${corpo ? esc(corpo) : '<span class="vazio">— em branco —</span>'}</pre>
          <footer>Atualizada em ${esc(formatarQuandoIso(folha.atualizado_em))}</footer>
        </article>`
      })
      .join('')
    return `
      <div class="caderno-secao">
        <h3>${esc(dica.aba)}</h3>
        <p class="sec-meta">${esc(dica.dica)} · ${folhas.length} ${folhas.length === 1 ? 'folha' : 'folhas'}</p>
        ${body || '<p class="vazio">Nenhuma folha nesta seção.</p>'}
      </div>`
  }).join('')
  return `<section class="caderno">${html}</section>`
}

function blocoTotais(board: EventoBoard): string {
  const t = totaisDoEvento(board.participantes.length, board.itens)
  const porPessoa = t.pessoas > 0 ? t.total / t.pessoas : 0
  const linhas = board.itens
    .map((item) => `
      <tr>
        <td>${esc(item.nome)}</td>
        <td>${item.quantidade} ${esc(item.unidade)}</td>
        <td class="num">${esc(formatarMoedaEvento(totalLinhaItem(item)))}</td>
      </tr>`)
    .join('')
  return `<section>
    <h3>Totais</h3>
    <dl class="totais-grid">
      <div><dt>Pessoas</dt><dd>${t.pessoas}</dd></div>
      <div><dt>Itens</dt><dd>${t.itens}</dd></div>
      <div><dt>Total estimado</dt><dd>${esc(formatarMoedaEvento(t.total))}</dd></div>
      <div><dt>Custo por pessoa</dt><dd>${t.pessoas > 0 ? esc(formatarMoedaEvento(porPessoa)) : '—'}</dd></div>
    </dl>
    <table>
      <thead><tr><th>Item</th><th>Qtd</th><th>Linha</th></tr></thead>
      <tbody>${linhas || '<tr><td colspan="3">Nada para somar ainda.</td></tr>'}</tbody>
      <tfoot><tr><td colspan="2">Total</td><td class="num">${esc(formatarMoedaEvento(t.total))}</td></tr></tfoot>
    </table>
  </section>`
}

function blocoTarefas(board: EventoBoard): string {
  const abertas = board.tarefas.filter((t) => !t.concluida)
  const feitas = board.tarefas.filter((t) => t.concluida)
  const row = (t: (typeof board.tarefas)[number]) => `
    <li class="${t.concluida ? 'done' : ''}">
      <span class="check">${t.concluida ? '☑' : '☐'}</span>
      <span>
        <strong>${esc(t.titulo)}</strong>
        <small>${t.concluida ? 'Concluída' : 'Pendente'} · criada em ${esc(formatarQuandoIso(t.criado_em))}</small>
      </span>
    </li>`
  return `<section>
    <h3>Tarefas</h3>
    <p class="sec-meta">${abertas.length} pendente${abertas.length === 1 ? '' : 's'} · ${feitas.length} concluída${feitas.length === 1 ? '' : 's'}</p>
    ${abertas.length ? `<h4 class="subh">Pendentes</h4><ul class="tarefas">${abertas.map(row).join('')}</ul>` : ''}
    ${feitas.length ? `<h4 class="subh">Concluídas</h4><ul class="tarefas">${feitas.map(row).join('')}</ul>` : ''}
    ${board.tarefas.length === 0 ? '<p>Nenhuma tarefa.</p>' : ''}
  </section>`
}

const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500&family=Source+Sans+3:wght@400;600&display=swap');
  * { box-sizing: border-box; }
  html, body { margin: 0; }
  body {
    font-family: 'Source Sans 3', Georgia, serif;
    color: #2a1812;
    background: #f7f1e4;
    margin: 0;
    padding: 18px 22px 28px;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .capa {
    text-align: center;
    padding: 28px 18px 32px;
    background:
      radial-gradient(ellipse at 50% 0%, rgba(240, 210, 140, 0.28), transparent 58%),
      linear-gradient(180deg, #fffaf1 0%, #f3ead6 100%);
    border: 1px solid #c9a07b;
    margin-bottom: 28px;
  }
  .kicker {
    font-family: 'Cormorant Garamond', Georgia, serif;
    letter-spacing: 0.28em;
    text-transform: uppercase;
    font-size: 9pt;
    color: #8a6a3a;
    margin: 0 0 8px;
  }
  .logo { max-height: 64px; margin-bottom: 8px; }
  h1 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    margin: 8px 0 0;
    font-size: 18pt;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  h2 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    margin: 18px 0 6px;
    font-size: 26pt;
    font-weight: 700;
  }
  h3 {
    font-family: 'Cormorant Garamond', Georgia, serif;
    color: #2a1812;
    border-bottom: 2px solid #c9a07b;
    padding-bottom: 6px;
    font-size: 16pt;
    margin: 0 0 6px;
  }
  h4 { font-family: 'Cormorant Garamond', Georgia, serif; margin: 0; font-size: 16pt; }
  .subh { font-size: 11pt; letter-spacing: 0.12em; text-transform: uppercase; color: #8a6a3a; margin: 14px 0 6px; }
  hr { border: 0; border-top: 3px solid #c9a07b; width: 42%; margin: 14px auto; }
  .cnpj, .meta, .gerado, .sec-meta { color: #5c4030; font-size: 10pt; }
  .data-extenso { font-family: 'Cormorant Garamond', Georgia, serif; font-size: 13pt; margin: 0; }
  .gerado { margin-top: 16px; letter-spacing: 0.06em; text-transform: uppercase; font-size: 8.5pt; }
  .obs {
    margin: 16px auto 0;
    max-width: 36rem;
    padding: 10px 14px;
    border-left: 3px solid #c9a07b;
    background: rgba(201, 160, 123, 0.12);
    text-align: left;
    font-style: italic;
  }
  .capa-resumo, .totais-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
    margin: 22px auto 0;
    max-width: 40rem;
    text-align: center;
  }
  .capa-resumo div, .totais-grid div {
    background: #fff;
    border: 1px solid #e4d2b8;
    padding: 10px 6px;
  }
  .capa-resumo dt, .totais-grid dt {
    font-size: 8pt;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    color: #8a6a3a;
  }
  .capa-resumo dd, .totais-grid dd {
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 16pt;
    margin: 4px 0 0;
  }
  section { margin: 0 0 26px; page-break-inside: avoid; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; background: #fff; }
  th, td { border-bottom: 1px solid #e8dcc8; padding: 8px 6px; text-align: left; vertical-align: top; }
  th {
    font-size: 8pt;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: #8a6a3a;
    border-bottom: 2px solid #c9a07b;
  }
  td.num, th.num { text-align: right; font-variant-numeric: tabular-nums; }
  tfoot td { font-weight: 600; border-top: 2px solid #c9a07b; background: #f3ead6; }
  .tag { font-size: 8pt; color: #8a6a3a; letter-spacing: 0.08em; text-transform: uppercase; }
  .folha-caderno {
    page-break-inside: avoid;
    margin: 14px 0 20px;
    padding: 22px 22px 18px 56px;
    position: relative;
    background-color: #fffdf6;
    background-image: repeating-linear-gradient(
      to bottom,
      transparent 0 27px,
      rgba(80, 50, 24, 0.12) 27px 28px
    );
    border: 1px solid #e4d2b8;
    box-shadow: 0 10px 24px rgba(42, 24, 18, 0.08);
    min-height: 220px;
  }
  .folha-caderno::before {
    content: '';
    position: absolute;
    top: 0; bottom: 0; left: 38px;
    width: 1.5px;
    background: #b23b32;
    opacity: 0.5;
  }
  .folha-kicker {
    font-size: 8pt;
    letter-spacing: 0.16em;
    text-transform: uppercase;
    color: #8a6a3a;
    margin: 0 0 4px;
  }
  .folha-dica { font-size: 8.5pt; color: #7a6456; margin: 2px 0 10px; }
  .folha-caderno pre {
    white-space: pre-wrap;
    font-family: 'Cormorant Garamond', Georgia, serif;
    font-size: 12.5pt;
    line-height: 28px;
    margin: 0;
    min-height: 112px;
  }
  .folha-caderno footer {
    margin-top: 16px;
    font-size: 8pt;
    color: #7a6456;
    letter-spacing: 0.06em;
    text-transform: uppercase;
  }
  .vazio { color: #9a8170; font-style: italic; }
  .tarefas { list-style: none; padding: 0; margin: 0; }
  .tarefas li {
    display: flex;
    gap: 10px;
    padding: 8px 0;
    border-bottom: 1px solid #eee;
  }
  .tarefas small { display: block; color: #7a6456; font-weight: 400; }
  .check { font-size: 13pt; line-height: 1.2; }
  .done { text-decoration: none; color: #7a6456; }
  .done strong { text-decoration: line-through; }
  @page { size: A4; margin: 12mm; }
  @media print {
    body { background: #fff; padding: 0; }
    .capa { break-after: page; }
    .folha-caderno { box-shadow: none; }
  }
`

export function buildEventoPdfHtml(
  board: EventoBoard,
  branding: EventoPdfBranding,
  colunas: EventoPdfColunaId[],
): string {
  const blocos: string[] = [capaHtml(board, branding)]
  if (colunas.includes('participantes')) blocos.push(blocoParticipantes(board))
  if (colunas.includes('itens')) blocos.push(blocoItens(board))
  if (colunas.includes('caderno')) blocos.push(blocoCaderno(board))
  if (colunas.includes('totais')) blocos.push(blocoTotais(board))
  if (colunas.includes('tarefas')) blocos.push(blocoTarefas(board))
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" /><title>${esc(board.evento.titulo)}</title>
    <style>${CSS}</style></head><body>${blocos.join('')}</body></html>`
}

function printWindowWhenReady(win: Window): void {
  let printed = false
  const run = () => {
    if (printed) return
    printed = true
    win.focus()
    win.print()
  }
  const waitFonts = () => {
    const fonts = win.document.fonts
    if (fonts?.ready) {
      void fonts.ready.then(run).catch(run)
      window.setTimeout(run, 1600)
      return
    }
    run()
  }
  if (win.document.readyState === 'complete') waitFonts()
  else win.onload = waitFonts
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
