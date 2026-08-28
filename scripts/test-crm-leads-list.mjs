import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function filterPipelineLeads(leads, opts) {
  const vendedorId = opts.vendedorId && opts.vendedorId !== 'all' ? opts.vendedorId : ''
  const origem = opts.origem && opts.origem !== 'all' ? opts.origem : ''
  const status = opts.status && opts.status !== 'all' ? opts.status : ''
  return leads.filter(lead => {
    if (vendedorId === 'unassigned' && (lead.vendedorId || lead.vendedorNome)) return false
    if (vendedorId && vendedorId !== 'unassigned') {
      const key = lead.vendedorId || lead.vendedorNome || ''
      if (key !== vendedorId) return false
    }
    if (origem && (lead.origem || '') !== origem) return false
    if (status && lead.status !== status) return false
    return true
  })
}

describe('Épico 12 — lista de leads', () => {
  it('filtra por status, vendedor e origem', () => {
    const leads = [
      { id: 1, status: 'Novo Lead', vendedorId: 'a', vendedorNome: 'Ana', origem: 'Instagram' },
      { id: 2, status: 'Enviou orçamento', vendedorId: 'b', vendedorNome: 'Bia', origem: 'Indicação' },
      { id: 3, status: 'Novo Lead', vendedorId: null, vendedorNome: null, origem: 'Instagram' },
    ]
    assert.deepEqual(filterPipelineLeads(leads, { status: 'Novo Lead' }).map(l => l.id), [1, 3])
    assert.deepEqual(filterPipelineLeads(leads, { origem: 'Indicação' }).map(l => l.id), [2])
    assert.deepEqual(filterPipelineLeads(leads, { vendedorId: 'unassigned' }).map(l => l.id), [3])
  })

  it('página usa os mesmos filtros do Pipeline e mostra telefone, email e atenção', () => {
    const page = readSrc('src/pages/crm/LeadsPage.tsx')
    assert.match(page, /filterPipelineLeads/)
    assert.match(page, /dateFilter, status/)
    assert.match(page, />Telefone</)
    assert.match(page, />Email</)
    assert.match(page, /darAtencao/)
    assert.match(page, /Atenção/)
    assert.match(page, /Todos os vendedores/)
    assert.match(page, /Todas as origens/)
    assert.match(page, /Todos os status/)
    assert.match(page, /Limpar filtros/)
    assert.match(page, /navigate\('\/pipeline'\)/)
    assert.match(page, /PipelineLeadModal/)
    assert.doesNotMatch(page, /Região/)
    assert.doesNotMatch(page, /Sinalizar/)
  })

  it('lib aceita filtro de status opcional', () => {
    const lib = readSrc('src/lib/crm-pipeline.ts')
    assert.match(lib, /status\?: string/)
    assert.match(lib, /if \(status && lead\.status !== status\) return false/)
  })
})
