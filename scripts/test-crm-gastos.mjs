import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('Épico 20 — controle de gastos planilha', () => {
  it('tem fonte, sub-fonte e tabela Data / Observação / Valor', () => {
    const page = readSrc('src/pages/crm/ControleGastosPage.tsx')
    assert.match(page, /Nova fonte/)
    assert.match(page, /Nova sub-fonte/)
    assert.match(page, /<th className="px-3 py-2">Data<\/th>/)
    assert.match(page, /<th className="px-3 py-2">Observação<\/th>/)
    assert.match(page, /<th className="px-3 py-2 text-right">Valor<\/th>/)
    assert.match(page, /type="date"/)
    assert.doesNotMatch(page, /<ul className="divide-y/)
  })
})
