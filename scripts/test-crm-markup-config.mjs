import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('Épico 15 — markup configurações + aba IA', () => {
  it('lista aponta para Configurações, não Catálogo', () => {
    const list = readSrc('src/pages/crm/MarkupListPage.tsx')
    assert.match(list, /\/markup\/configuracoes/)
    assert.match(list, /Configurações/)
    assert.doesNotMatch(list, />Catálogo</)
  })

  it('página de config tem as cinco abas e IA honesta', () => {
    const page = readSrc('src/pages/crm/MarkupListPage.tsx')
    assert.match(page, /title="Configurações do markup"/)
    assert.match(page, /'produtos' \| 'parametros' \| 'despesas' \| 'servicos' \| 'ia'/)
    assert.match(page, /tab === 'ia'/)
    assert.match(page, /: 'IA'/)
    assert.match(page, /Marketing de conteúdo/)
    assert.match(page, /Gerar com IA/)
  })

  it('rota de configurações existe no App', () => {
    const app = readSrc('src/App.tsx')
    assert.match(app, /\/markup\/configuracoes/)
    assert.match(app, /MarkupConfigPage/)
  })
})
