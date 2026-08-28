import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('Épico 2 — Projetos (prancheta)', () => {
  it('rota /projetos existe e o menu Comercial aponta para ela', () => {
    const app = readSrc('src/App.tsx')
    const nav = readSrc('src/lib/app-navigation.ts')
    assert.match(app, /path="\/projetos"/)
    assert.match(nav, /title: 'Projetos'/)
    assert.match(nav, /url: '\/projetos'/)
    assert.match(nav, /id: 'projetos'/)
  })

  it('página e painel leem as tabelas reais do CRM', () => {
    const hook = readSrc('src/hooks/useLeadProjetos.ts')
    const page = readSrc('src/pages/Projetos.tsx')
    const modal = readSrc('src/components/leads/LeadModal.tsx')
    assert.match(hook, /lead_projetos/)
    assert.match(hook, /projeto_stages/)
    assert.match(hook, /lead_projeto_notas/)
    assert.match(page, /useLeadProjetos/)
    assert.match(modal, /LeadProjetoPanel|LeadProjetoConclusaoPanel/)
  })

  it('projetista-only cai em /projetos e marketing-only não entra', () => {
    const identity = readSrc('src/lib/crm-identity.ts')
    assert.match(identity, /isProjetistaOnlyCrm/)
    assert.match(identity, /canAccessProjetosBoard/)
    assert.match(identity, /return '\/projetos'/)
    assert.match(identity, /pathname.startsWith\('\/projetos'\)/)
  })
})
