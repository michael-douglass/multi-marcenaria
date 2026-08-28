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

function capaHtml(board: EventoBoard, branding: EventoPdfBranding): string {
  const { evento } = board
  return `
    <section class="capa">
      ${branding.logoUrl ? `<img class="logo" src="${esc(branding.logoUrl)}" alt="" />` : ''}
      <h1>${esc(branding.nome)}</h1>
      ${branding.cnpj?.trim() ? `<p class="cnpj">CNPJ ${esc(branding.cnpj.trim())}</p>` : ''}
      <hr />
      <h2>${esc(evento.titulo)}</h2>
      <p>${esc(labelEventoDataExtenso(evento.data_evento))}</p>
      <p>${esc(labelEventoTipo(evento.tipo, evento.tipo_custom))} · ${esc(labelEventoQuando(evento.data_evento))}</p>
    </section>
  `
}

function blocoParticipantes(board: EventoBoard): string {
  const rows = board.participantes
    .map((p) => `<li>${esc(p.nome)}${p.lead_id ? ' <span class="tag">Lead</span>' : ' <span class="tag">Convidado</span>'}</li>`)
    .join('')
  return `<section><h3>Participantes</h3><ul>${rows || '<li>Ninguém na lista.</li>'}</ul></section>`
}

function blocoItens(board: EventoBoard): string {
  const rows = board.itens
    .map((item) => `
      <tr>
        <td>${esc(item.nome)}</td>
        <td>${item.quantidade} ${esc(item.unidade)}</td>
        <td>${esc(item.fornecedor ?? '—')}</td>
        <td>${formatarMoedaEvento(item.preco_unitario)}</td>
        <td>${formatarMoedaEvento(totalLinhaItem(item))}</td>
      </tr>`)
    .join('')
  return `<section><h3>Itens e preços</h3>
    <table><thead><tr><th>Item</th><th>Qtd</th><th>Fornecedor</th><th>Unitário</th><th>Total</th></tr></thead>
    <tbody>${rows || '<tr><td colspan="5">Nenhum item.</td></tr>'}</tbody></table></section>`
}

function blocoCaderno(board: EventoBoard): string {
  const secoes: EventoSecao[] = ['detalhes', 'discurso', 'palestra']
  const html = secoes.map((secao) => {
    const folhas = board.paginas.filter((p) => p.secao === secao).sort((a, b) => a.ordem - b.ordem)
    const body = folhas
      .map((folha, i) => `
        <article class="folha">
          <h4>${esc(EVENTO_SECAO_DICAS[secao].aba)} · Folha ${i + 1}${folha.titulo ? ` — ${esc(folha.titulo)}` : ''}</h4>
          <pre>${esc(folha.corpo || '')}</pre>
        </article>`)
      .join('')
    return body
  }).join('')
  return `<section><h3>Caderno</h3>${html || '<p>Caderno vazio.</p>'}</section>`
}

function blocoTotais(board: EventoBoard): string {
  const t = totaisDoEvento(board.participantes.length, board.itens)
  return `<section><h3>Totais</h3>
    <p>Pessoas: ${t.pessoas} · Itens: ${t.itens} · Total: ${formatarMoedaEvento(t.total)}</p>
  </section>`
}

function blocoTarefas(board: EventoBoard): string {
  const rows = board.tarefas
    .map((t) => `<li class="${t.concluida ? 'done' : ''}">${esc(t.titulo)}</li>`)
    .join('')
  return `<section><h3>Tarefas</h3><ul>${rows || '<li>Nenhuma tarefa.</li>'}</ul></section>`
}

const CSS = `
  * { box-sizing: border-box; }
  body { font-family: Georgia, serif; color: #2a1812; background: #fff; margin: 24px; }
  .capa { text-align: center; padding-bottom: 24px; }
  .logo { max-height: 56px; }
  h1 { margin: 8px 0 0; font-size: 18pt; }
  h2 { margin: 16px 0 4px; font-size: 22pt; }
  h3 { color: #2a1812; border-bottom: 1px solid #c9a07b; padding-bottom: 4px; }
  hr { border: 0; border-top: 3px solid #c9a07b; width: 40%; margin: 12px auto; }
  .cnpj { color: #5c4030; font-size: 10pt; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  th, td { border-bottom: 1px solid #eee; padding: 6px 4px; text-align: left; }
  .folha pre { white-space: pre-wrap; font-family: Georgia, serif; }
  .done { text-decoration: line-through; color: #7a6456; }
  .tag { font-size: 8pt; color: #8a6a3a; }
  @page { size: A4; margin: 14mm; }
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
  win.onload = () => win.print()
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
    .map((foto, i) => `<figure><img src="${foto.src}" alt="${esc(foto.nome)}" /><figcaption>Foto ${i + 1}</figcaption></figure>`)
    .join('')
  const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8" />
    <title>Fotos · ${esc(input.titulo)}</title>
    <style>
      body { font-family: Georgia, serif; color: #2a1812; background: #fff; margin: 18px; }
      .capa { text-align: center; border-bottom: 3px solid #c9a07b; padding-bottom: 12px; margin-bottom: 16px; }
      img { max-width: 100%; }
      figure { page-break-inside: avoid; margin: 0 0 18px; }
      @page { size: A4; margin: 12mm; }
    </style></head>
    <body>
      <div class="capa">
        ${input.branding.logoUrl ? `<img style="max-height:48px" src="${esc(input.branding.logoUrl)}" alt="" />` : ''}
        <h1>${esc(input.branding.nome)}</h1>
        ${input.branding.cnpj ? `<p>CNPJ ${esc(input.branding.cnpj)}</p>` : ''}
        <h2>${esc(input.titulo)}</h2>
        <p>Gerado em ${format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR })}</p>
      </div>
      ${body || '<p>Nenhuma foto.</p>'}
    </body></html>`
  const win = window.open('', '_blank')
  if (!win) throw new Error('Permita pop-ups para gerar o PDF das fotos')
  win.document.write(html)
  win.document.close()
  win.onload = () => win.print()
}

export { EVENTO_PDF_COLUNAS }
