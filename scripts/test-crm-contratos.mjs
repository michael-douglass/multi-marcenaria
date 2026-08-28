import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function contratosEmProducao(lista) {
  return lista.filter(item => item.status === 'rascunho')
}

function contratosFinalizados(lista) {
  return lista.filter(item => item.status !== 'rascunho')
}

describe('Épico 14 — contratos lista dual + preview', () => {
  it('separa rascunho (em produção) dos finalizados', () => {
    const lista = [
      { id: '1', status: 'rascunho' },
      { id: '2', status: 'assinado' },
      { id: '3', status: 'enviado' },
    ]
    assert.deepEqual(contratosEmProducao(lista).map(i => i.id), ['1'])
    assert.deepEqual(contratosFinalizados(lista).map(i => i.id), ['2', '3'])
  })

  it('lista tem as duas tabelas, config e editor em dois passos', () => {
    const page = readSrc('src/pages/crm/ContratosPage.tsx')
    assert.match(page, /Em produção/)
    assert.match(page, /Finalizados/)
    assert.match(page, /contratosEmProducao/)
    assert.match(page, /contratosFinalizados/)
    assert.match(page, /\/contratos\/configuracoes/)
    assert.match(page, /1\. Preencher/)
    assert.match(page, /2\. Preview/)
    assert.match(page, /Imprimir/)
    assert.match(page, /export function ContratosConfigPage/)
    assert.match(page, /Modelos/)
    assert.match(page, /Campos variáveis/)
  })

  it('rota de configurações vem antes de :id', () => {
    const app = readSrc('src/App.tsx')
    const configIdx = app.indexOf('/contratos/configuracoes')
    const idIdx = app.indexOf('/contratos/:id')
    assert.ok(configIdx > 0 && idIdx > configIdx, 'configurações precisa vir antes de :id')
    assert.match(app, /ContratosConfigPage/)
  })
})
