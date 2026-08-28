import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('Épico 24 — biblioteca CRM rota própria', () => {
  it('página de acervo não mistura com a biblioteca da fábrica', () => {
    const page = readSrc('src/pages/CrmBiblioteca.tsx')
    assert.match(page, /BibliotecaPageContent/)
    assert.doesNotMatch(page, /from '@\/pages\/Biblioteca'/)
    assert.doesNotMatch(page, /CaixaFornecedor/)
  })

  it('rota /biblioteca-crm é distinta de /biblioteca', () => {
    const app = readSrc('src/App.tsx')
    assert.match(app, /path="\/biblioteca-crm"/)
    assert.match(app, /CrmBiblioteca/)
    assert.match(app, /path="\/biblioteca"/)
    const identity = readSrc('src/lib/crm-identity.ts')
    assert.match(identity, /'\/biblioteca-crm'/)
    assert.doesNotMatch(identity, /'\/biblioteca'/)
    const nav = readSrc('src/lib/app-navigation.ts')
    assert.match(nav, /id: 'bibliotecaCrm'/)
    assert.match(nav, /url: '\/biblioteca-crm'/)
    assert.match(nav, /url: '\/biblioteca'/)
  })
})
