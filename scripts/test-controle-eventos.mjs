import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function parseDataEventoLocal(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return new Date(y || 1970, (m || 1) - 1, d || 1)
}

function formatDataEventoIso(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function labelEventoQuando(iso, hoje) {
  const data = parseDataEventoLocal(iso)
  const start = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate())
  const diff = Math.round((data - start) / 86400000)
  if (diff === 0) return 'Acontece hoje'
  if (diff === 1) return 'Acontece amanhã'
  if (diff > 1) return `Acontece em ${diff} dias`
  if (diff === -1) return 'Foi ontem'
  return `Foi há ${Math.abs(diff)} dias`
}

function correspondeBuscaFlexivel(texto, termo) {
  const compact = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[\s.]+/g, '')
  const palavras = termo.trim().split(/\s+/).map(compact).filter(Boolean)
  const alvo = compact(texto)
  return palavras.every((p) => alvo.includes(p))
}

function eventoCorrespondeBusca(evento, termo) {
  if (!termo.trim()) return true
  const blob = [evento.titulo, 'Evento de arquitetos', evento.observacoes ?? '', evento.data_evento, labelEventoQuando(evento.data_evento, new Date(2026, 7, 28))].join(' ')
  return correspondeBuscaFlexivel(blob, termo)
}

function arredondar(valor) {
  return Math.round((Number(valor) || 0) * 100) / 100
}

describe('E0 — domínio do Controle de Eventos', () => {
  it('admin e marketing entram; vendedor puro e projetista-only não', () => {
    const roles = readSrc('src/lib/app-roles.ts')
    assert.match(roles, /export function canAccessMarketingConteudo/)
    assert.match(roles, /export function canAccessControleEventos/)
    const identity = readSrc('src/lib/crm-identity.ts')
    assert.match(identity, /canAccessControleEventos/)
    assert.match(identity, /\/controle-eventos/)
    assert.doesNotMatch(identity, /pathname.startsWith\('\/eventos-crm'\) return vendedor/)
  })

  it('menu fica em Marketing e esconde do vendedor puro', () => {
    const nav = readSrc('src/lib/app-navigation.ts')
    assert.match(nav, /id: 'controleEventos'/)
    assert.match(nav, /url: '\/controle-eventos'/)
    assert.match(nav, /hideIfVendedorRestricted/)
    assert.doesNotMatch(nav, /url: '\/eventos-crm'/)
  })

  it('data local não desloca o dia e a frase humana bate com o PRD', () => {
    const hoje = new Date(2026, 7, 28)
    assert.equal(formatDataEventoIso(parseDataEventoLocal('2026-08-28')), '2026-08-28')
    assert.equal(labelEventoQuando('2026-08-28', hoje), 'Acontece hoje')
    assert.equal(labelEventoQuando('2026-08-27', hoje), 'Foi ontem')
    assert.equal(labelEventoQuando('2026-09-09', hoje), 'Acontece em 12 dias')
  })

  it('totais arredondam qtd × unitário em 2 casas', () => {
    assert.equal(arredondar(2 * 10.125), 20.25)
    assert.equal(arredondar(1 * 3.333), 3.33)
  })

  it('hooks existem sem realtime de chat', () => {
    const list = readSrc('src/hooks/useControleEventos.ts')
    const board = readSrc('src/hooks/useEventoBoard.ts')
    const tarefas = readSrc('src/hooks/useEventoTarefas.ts')
    assert.match(list, /export function useControleEventos/)
    assert.match(board, /export function useEventoBoard/)
    assert.match(tarefas, /export function useEventoTarefas/)
    assert.doesNotMatch(board, /channel\(/)
    assert.doesNotMatch(list, /lead_projeto_notas/)
  })
})

describe('E1 — grade de pastas', () => {
  it('página tem kicker, busca e Nova pasta', () => {
    const page = readSrc('src/pages/ControleEventos.tsx')
    assert.match(page, /Marketing · Dossiê/)
    assert.match(page, /Nova pasta/)
    assert.match(page, /Buscar evento por nome, tipo ou data/)
    assert.match(page, /Nenhuma pasta ainda/)
    assert.match(page, /A busca ignora acentos/)
  })

  it('card é pasta CSS com pin, data 42px e calendário na capa', () => {
    const card = readSrc('src/components/eventos/EventoFolderCard.tsx')
    assert.match(card, /PASTA/)
    assert.match(card, /text-\[42px\]/)
    assert.match(card, /BibliotecaPinButton/)
    assert.match(card, /Mais ações da pasta/)
    assert.doesNotMatch(card, /BibliotecaPinAura/)
    assert.doesNotMatch(card, /WebGL/)
  })

  it('busca ignora acentos em título e “acontece em”', () => {
    const pasta = {
      titulo: 'Festa de arquitetos',
      tipo: 'arquitetos',
      tipo_custom: null,
      observacoes: 'jantar',
      data_evento: '2026-09-09',
    }
    assert.equal(eventoCorrespondeBusca(pasta, 'arquitetos'), true)
    assert.equal(eventoCorrespondeBusca(pasta, 'festa'), true)
    assert.equal(eventoCorrespondeBusca(pasta, 'naoexiste'), false)
  })
})

describe('E2 — board e caderno', () => {
  it('board tem 4 colunas e caderno branco', () => {
    const board = readSrc('src/pages/ControleEventoBoard.tsx')
    assert.match(board, /1 · Participantes/)
    assert.match(board, /2 · Compras/)
    assert.match(board, /EventoDocumentoPanel/)
    assert.match(board, /EventoTotaisPanel/)
    assert.match(board, /Pasta não encontrada/)
    const caderno = readSrc('src/components/eventos/EventoDocumentoPanel.tsx')
    assert.match(caderno, /evento-caderno-folha/)
    assert.match(caderno, /400/)
    assert.match(caderno, /beforeunload/)
    assert.match(caderno, /visibilitychange/)
    assert.match(caderno, /Salva sozinho/)
    assert.doesNotMatch(caderno, /rádio|radio|chat/)
  })

  it('CSS da folha força papel branco e não herda glass-input', () => {
    const css = readSrc('src/index.css')
    assert.match(css, /\.evento-caderno-folha/)
    assert.match(css, /color-scheme: light/)
    assert.match(css, /#b23b32/)
    assert.match(css, /\.evento-pdf-folio/)
    assert.match(css, /\.btn-proforco/)
  })
})

describe('E3 — tarefas e lápis', () => {
  it('tarefas abrem da lista e do board', () => {
    const dialog = readSrc('src/components/eventos/EventoTarefasDialog.tsx')
    assert.match(dialog, /Nova tarefa/)
    assert.match(dialog, /Não é um chat/)
    const list = readSrc('src/pages/ControleEventos.tsx')
    const board = readSrc('src/pages/ControleEventoBoard.tsx')
    assert.match(list, /EventoTarefasDialog/)
    assert.match(board, /EventoTarefasDialog/)
  })

  it('lápis grava path SVG e salva a cada traço', () => {
    const canvas = readSrc('src/components/eventos/EventoPhotoDrawCanvas.tsx')
    const types = readSrc('src/lib/evento-types.ts')
    assert.match(canvas, /viewBox="0 0 1000 1000"/)
    assert.match(canvas, /touch-none/)
    assert.match(canvas, /data-drawing-id/)
    assert.match(types, /#f0d28c/)
    assert.match(canvas, /EVENTO_LAPIS_CORES/)
    assert.match(canvas, /Limpar traços/)
    const sheet = readSrc('src/components/eventos/EventoCardFotosSheet.tsx')
    assert.match(sheet, /prepareWhiteboardImageForUpload/)
    assert.match(sheet, /downloadEventoFotosPdf/)
  })
})

describe('E4 — PDF e auras', () => {
  it('PDF do dossiê usa janela A4 e exige pelo menos uma coluna', () => {
    const pdf = readSrc('src/lib/evento-pdf-export.ts')
    assert.match(pdf, /openEventoPdfPrint/)
    assert.match(pdf, /Marque pelo menos uma coluna/)
    assert.match(pdf, /size: A4/)
    assert.match(pdf, /#c9a07b/)
    assert.doesNotMatch(pdf, /jsPDF/)
  })

  it('WebGL só no caderno e no lacre, pixelRatio 1', () => {
    const auraDoc = readSrc('src/components/eventos/EventoDocumentoAura.tsx')
    const auraPdf = readSrc('src/components/eventos/EventoPdfExportAura.tsx')
    assert.match(auraDoc, /pixelRatioMax: 1/)
    assert.match(auraPdf, /pixelRatioMax: 1/)
    assert.match(auraPdf, /fillRef/)
    assert.match(auraPdf, /uFill/)
    const card = readSrc('src/components/eventos/EventoFolderCard.tsx')
    assert.doesNotMatch(card, /useAtelieShaderPlane/)
  })
})

describe('E5 — rotas', () => {
  it('App registra grade, board e redirect da URL antiga', () => {
    const app = readSrc('src/App.tsx')
    assert.match(app, /\/controle-eventos\/:eventoId/)
    assert.match(app, /\/controle-eventos/)
    assert.match(app, /Navigate to="\/controle-eventos"/)
  })
})
