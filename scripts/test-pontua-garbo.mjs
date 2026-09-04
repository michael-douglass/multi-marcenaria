import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('P1 — portaria e mural', () => {
  it('Admin tem interruptor Pontua e o mural lista arquitetos reconhecidos', () => {
    const admin = readSrc('src/pages/Admin.tsx')
    const financeiro = readSrc('src/pages/Financeiro.tsx')
    const menu = readSrc('src/components/financeiro/ArquitetosPontuaDialog.tsx')
    const hook = readSrc('src/hooks/usePontuaGarboFinanceiro.ts')
    assert.match(admin, /comissao_ativa/)
    assert.match(admin, /Programa Pontua Garbo/)
    assert.match(admin, /ensurePontuaGarboLead/)
    // O mural saiu do corpo da página e passou a morar no menu de arquitetos.
    assert.match(financeiro, /ArquitetosPontuaDialog/)
    assert.match(menu, /ArquitetosPontuaGarboMural/)
    assert.match(menu, /PrestadorFinanceiroRow/)
    assert.match(hook, /comissao_ativa', true/)
  })
})

describe('P2 — e-mail do parceiro no card', () => {
  it('normaliza e recusa e-mail inválido antes de criar o acesso', () => {
    const email = readSrc('src/lib/lead-email.ts')
    const panel = readSrc('src/components/leads/LeadPontuaGarboContactPanel.tsx')
    const hook = readSrc('src/hooks/usePontuaGarboPartnerLeads.ts')
    assert.match(email, /EMAIL_FORMATO_INVALIDO/)
    assert.match(email, /gmail,com/)
    assert.match(panel, /parseLeadEmail/)
    assert.match(hook, /isValidLeadEmail/)
    assert.match(hook, /patchLeadInAllCaches/)
  })
})

describe('P3 — visibilidade do prestador', () => {
  it('vendedor também controla o que o prestador vê', () => {
    const fields = readSrc('src/components/leads/LeadCustomFieldsSection.tsx')
    const modal = readSrc('src/components/leads/LeadModal.tsx')
    assert.match(fields, /canManagePrestadorVisibilidade/)
    assert.match(fields, /showPrestadorVisibilidade/)
    assert.match(modal, /canManagePrestadorVisibilidade/)
    assert.match(modal, /hasRole\('vendedor'\)/)
  })
})

describe('P4 — placar e nomes', () => {
  it('tem hook de nomes por lead e totais aberto/fechado por mês', () => {
    const names = readSrc('src/hooks/usePontuaGarboArquitetosPorLeads.ts')
    const mes = readSrc('src/lib/pontua-garbo-indicacoes-mes.ts')
    assert.match(names, /usePontuaGarboArquitetosPorLeads/)
    assert.match(mes, /accumulateIndicacoesPorMes/)
  })
})
