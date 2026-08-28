import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function substituirVariaveis(template, valores) {
  return template.replace(/\{\{(\w+)\}\}/g, (_, nome) => valores[nome] ?? `{{${nome}}}`)
}

function stripMetaCampos(campos) {
  const out = {}
  for (const [k, v] of Object.entries(campos)) {
    if (!k.startsWith('__')) out[k] = v
  }
  return out
}

function buildConteudoContrato(modelo, valores) {
  return substituirVariaveis(modelo, stripMetaCampos(valores))
}

function gerarIdentificadorContrato(clienteNome, now = new Date()) {
  const d = String(now.getDate()).padStart(2, '0')
  const m = String(now.getMonth() + 1).padStart(2, '0')
  return `${d}/${m}/${now.getFullYear()} - ${clienteNome.trim() || 'Cliente'}`
}

function filtrarContratos(lista, busca) {
  const termo = busca.trim().toLowerCase()
  if (!termo) return lista
  return lista.filter(item =>
    item.identificador.toLowerCase().includes(termo)
    || item.cliente_nome.toLowerCase().includes(termo)
    || (item.lead_nome ?? '').toLowerCase().includes(termo),
  )
}

function unbindDrawingImage(pathData) {
  if (!pathData.startsWith('WB_IMG:')) return { imageId: null, pathData }
  const rest = pathData.slice('WB_IMG:'.length)
  const sep = rest.indexOf(':')
  if (sep <= 0) return { imageId: null, pathData }
  return { imageId: rest.slice(0, sep), pathData: rest.slice(sep + 1) }
}

function drawingToSvgPath(pathData) {
  const inner = unbindDrawingImage(pathData).pathData.trim()
  if (inner.startsWith('M') || inner.startsWith('m')) return inner
  const jsonStr = inner.startsWith('WB_JSON:') ? inner.slice('WB_JSON:'.length) : ''
  if (!jsonStr) return null
  const json = JSON.parse(jsonStr)
  if (json.kind !== 'polyline' || !Array.isArray(json.points) || json.points.length === 0) return null
  return json.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x} ${p.y}`).join(' ')
}

function linkPublicoAgenda(slug, origin = 'http://localhost:3001') {
  if (!slug) return ''
  return `${origin}/agendar/garbo/${slug}`
}

function filtrarReunioes(lista, busca) {
  const termo = busca.trim().toLowerCase()
  if (!termo) return lista
  return lista.filter(item =>
    item.titulo.toLowerCase().includes(termo)
    || (item.convidado_nome ?? '').toLowerCase().includes(termo)
    || (item.lead_nome ?? '').toLowerCase().includes(termo),
  )
}

describe('Épico 5 — contratos, agenda e lousa', () => {
  it('substitui variáveis do modelo e ignora metadados', () => {
    const texto = buildConteudoContrato('Contrato de {{cliente_nome}} — {{cidade}}', {
      cliente_nome: 'Camila Rosa',
      cidade: 'Espanha',
      __modelo_id: 'abc',
    })
    assert.equal(texto, 'Contrato de Camila Rosa — Espanha')
  })

  it('identificador usa data + nome do cliente', () => {
    const id = gerarIdentificadorContrato('Paulo Henrique', new Date('2026-08-27T12:00:00'))
    assert.equal(id, '27/08/2026 - Paulo Henrique')
  })

  it('busca da lista filtra cliente e identificador', () => {
    const lista = [
      { identificador: '27/08/2026 - Camila', cliente_nome: 'Camila Rosa', lead_nome: 'Camila' },
      { identificador: '01/01/2026 - Otavio', cliente_nome: 'Otavio', lead_nome: null },
    ]
    assert.equal(filtrarContratos(lista, 'camila').length, 1)
    assert.equal(filtrarContratos(lista, 'otavio').length, 1)
  })

  it('agenda filtra reunião e monta o link público da Garbo', () => {
    const reunioes = [
      { titulo: 'Reunião com Camila Rosa', convidado_nome: 'Camila Rosa', lead_nome: 'Camila' },
      { titulo: 'Alinhamento Divina', convidado_nome: 'Divina', lead_nome: null },
    ]
    assert.equal(filtrarReunioes(reunioes, 'camila').length, 1)
    assert.equal(linkPublicoAgenda('agendamento'), 'http://localhost:3001/agendar/garbo/agendamento')
  })

  it('traço WB_JSON vira caminho SVG e WB_IMG solta o id da foto', () => {
    const path = drawingToSvgPath('WB_JSON:{"kind":"polyline","points":[{"x":10,"y":20},{"x":30,"y":40}]}')
    assert.equal(path, 'M10 20 L30 40')
    const bound = unbindDrawingImage('WB_IMG:foto-1:M0 0 L1 1')
    assert.equal(bound.imageId, 'foto-1')
    assert.equal(bound.pathData, 'M0 0 L1 1')
  })

  it('páginas reais substituíram os placeholders de contratos e agenda', () => {
    const app = readSrc('src/App.tsx')
    assert.match(app, /ContratosPage/)
    assert.match(app, /AgendaComercial/)
    assert.match(app, /path="\/leads\/:id\/lousa"/)
    assert.doesNotMatch(app, /crmPlaceholder\('\/contratos'/)
    assert.doesNotMatch(app, /crmPlaceholder\('\/agenda-comercial'/)
  })

  it('projetista entra na lousa e não nos contratos', () => {
    const identity = readSrc('src/lib/crm-identity.ts')
    assert.match(identity, /pathname\.startsWith\('\/pipeline'\) \|\| pathname\.startsWith\('\/leads'\)/)
    const modal = readSrc('src/components/leads/LeadModal.tsx')
    assert.match(modal, /LeadWhiteboard/)
  })
})
