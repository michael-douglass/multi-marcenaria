import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('Épico 17 — automações e templates', () => {
  it('negativação é um card próprio', () => {
    const page = readSrc('src/pages/crm/AutomacoesPage.tsx')
    assert.match(page, /export function AutomacoesPage/)
    assert.match(page, /Negativação/)
    assert.match(page, /salvarNegativado/)
  })

  it('marketing tem as cinco abas e empty state honesto de mídia', () => {
    const page = readSrc('src/pages/crm/AutomacoesPage.tsx')
    assert.match(page, /export function AutomacoesMarketingPage/)
    assert.match(page, /Mensagens/)
    assert.match(page, /Disparos/)
    assert.match(page, /Áudios/)
    assert.match(page, /Imagens/)
    assert.match(page, /PDFs/)
    assert.match(page, /Upload de áudio, imagem e PDF não foi portado/)
  })
})
