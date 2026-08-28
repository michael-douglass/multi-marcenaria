import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('Épico 25 — marca admin sem multiempresa', () => {
  it('página de marca liga identidade, portal e timbrado na empresa Garbo', () => {
    const page = readSrc('src/pages/admin/ConfiguracaoMarca.tsx')
    assert.match(page, /EmpresaBrandingForm/)
    assert.match(page, /PrestadorBannerForm/)
    assert.match(page, /Timbrado/)
    assert.doesNotMatch(page, /GerenciamentoEmpresas/)
  })

  it('rota /admin/marca ligada no App, menu e identidade', () => {
    const app = readSrc('src/App.tsx')
    assert.match(app, /path="\/admin\/marca"/)
    assert.match(app, /ConfiguracaoMarca/)
    const identity = readSrc('src/lib/crm-identity.ts')
    assert.match(identity, /'\/admin\/marca'/)
    assert.match(identity, /pathname\.startsWith\('\/admin'\)\) return admin/)
    const nav = readSrc('src/lib/app-navigation.ts')
    assert.match(nav, /id: 'marcaCrm'/)
    assert.match(nav, /url: '\/admin\/marca'/)
  })
})
