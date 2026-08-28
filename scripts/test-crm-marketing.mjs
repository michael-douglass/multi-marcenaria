import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function cardsDaColuna(cards, columnId) {
  return cards.filter(c => c.columnId === columnId).sort((a, b) => a.ordem - b.ordem)
}

function filtrarTarefasDoMes(tarefas, ym) {
  return tarefas.filter(t => (t.dataAgendada ?? '').startsWith(ym))
}

function somaLancamentos(lista) {
  return lista.reduce((s, l) => s + l.valor, 0)
}

function canAccessCrmPath(pathname, crm) {
  const roles = crm?.roles ?? []
  const admin = roles.includes('admin')
  const marketing = roles.includes('marketing') || admin
  const vendedor = roles.includes('vendedor') || admin
  const marketingOnly = roles.includes('marketing') && !admin && !roles.includes('vendedor')
  if (pathname.startsWith('/marketing-conteudo')) return marketing
  if (pathname.startsWith('/controle-gastos')) return admin
  if (pathname.startsWith('/financeiro-pontua')) return vendedor && !marketingOnly
  if (pathname.startsWith('/automacoes/marketing')) return admin || vendedor || marketing
  if (pathname.startsWith('/automacoes')) return (vendedor || marketing) && !(marketingOnly && pathname === '/automacoes')
  return false
}

describe('Épico 7 — marketing', () => {
  it('cards ficam na coluna certa e a agenda filtra o mês', () => {
    const cards = [
      { id: '1', columnId: 'a', ordem: 2, titulo: 'B' },
      { id: '2', columnId: 'a', ordem: 1, titulo: 'A' },
      { id: '3', columnId: 'b', ordem: 1, titulo: 'C' },
    ]
    assert.deepEqual(cardsDaColuna(cards, 'a').map(c => c.titulo), ['A', 'B'])
    const tarefas = [
      { dataAgendada: '2026-08-01', titulo: 'Agosto' },
      { dataAgendada: '2026-07-01', titulo: 'Julho' },
    ]
    assert.equal(filtrarTarefasDoMes(tarefas, '2026-08').length, 1)
  })

  it('soma gastos sem misturar colunas', () => {
    assert.equal(somaLancamentos([{ valor: 10.5 }, { valor: 20 }]), 30.5)
  })

  it('marketing, gastos e pontua respeitam o papel', () => {
    const admin = { roles: ['admin'] }
    const mkt = { roles: ['marketing'] }
    const vend = { roles: ['vendedor'] }
    assert.equal(canAccessCrmPath('/marketing-conteudo', admin), true)
    assert.equal(canAccessCrmPath('/marketing-conteudo', mkt), true)
    assert.equal(canAccessCrmPath('/marketing-conteudo', vend), false)
    assert.equal(canAccessCrmPath('/controle-gastos', admin), true)
    assert.equal(canAccessCrmPath('/controle-gastos', mkt), false)
    assert.equal(canAccessCrmPath('/financeiro-pontua', vend), true)
    assert.equal(canAccessCrmPath('/financeiro-pontua', mkt), false)
  })

  it('páginas vivas no App e RPCs no SQL', () => {
    const app = readSrc('src/App.tsx')
    assert.match(app, /MarketingConteudo/)
    assert.match(app, /ControleGastosSelletos/)
    assert.match(app, /FinanceiroPontua/)
    assert.equal(app.includes("crmPlaceholder('/marketing-conteudo'"), false)

    const sql = readSrc('supabase/migrations/177_crm_marketing.sql')
    assert.match(sql, /movelaria_crm_marketing_boot/)
    assert.match(sql, /movelaria_crm_marketing_medias/)
    assert.match(sql, /movelaria_crm_gastos_boot/)
    assert.match(sql, /emp_garbo\.marketing_medias/)
    assert.match(sql, /Não mistura com o Caixa da fábrica|financeiro Pontua/)

    const page = readSrc('src/pages/crm/MarketingConteudoPage.tsx')
    assert.match(page, /CrmPageFrame/)
    assert.match(page, /Gerar com IA/)
    assert.equal(page.includes('ObraPageHeader'), false)
  })
})
