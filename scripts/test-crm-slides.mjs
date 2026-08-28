import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('Épico 16 — slides ações da lista', () => {
  it('lista tem Ver, Copiar e Editar com stopPropagation', () => {
    const page = readSrc('src/pages/crm/OrcamentoSlidesPage.tsx')
    assert.match(page, /stopPropagation/)
    assert.match(page, /Editar/)
    assert.match(page, /> Ver/)
    assert.match(page, /Copiar/)
    assert.match(page, /linkPublicoOrcamento/)
    assert.match(page, /clipboard\.writeText/)
    assert.match(page, /Pencil/)
    assert.match(page, /Copy/)
  })

  it('não reescreve um player de milhares de linhas', () => {
    const page = readSrc('src/pages/crm/OrcamentoSlidesPage.tsx')
    const lines = page.split('\n').length
    assert.ok(lines < 800, `editor da lista ficou grande demais: ${lines} linhas`)
  })
})
