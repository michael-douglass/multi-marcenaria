import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('Épico 21 — financeiro Pontua mural e KPIs', () => {
  it('mostra quatro KPIs, mural de arquitetos, saques e liberações', () => {
    const page = readSrc('src/pages/crm/FinanceiroPontuaPage.tsx')
    assert.match(page, /Arquitetos/)
    assert.match(page, /Saques pedidos/)
    assert.match(page, /Aguardando PIX/)
    assert.match(page, /Liberações/)
    assert.match(page, /Mural de arquitetos/)
    assert.match(page, /Pedidos de saque/)
    assert.match(page, /Comissões aguardando liberação/)
    assert.doesNotMatch(page, /Montador/)
    assert.doesNotMatch(page, /\/caixa/)
  })
})
