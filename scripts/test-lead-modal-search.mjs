import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

function normalizeLeadSearch(text) {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()
}

function wordStartsWith(haystack, query) {
  if (!query) return false
  return haystack.split(/[^a-z0-9]+/).some((word) => word.startsWith(query))
}

function scoreLeadSearchQuery(query, haystack, keywords = []) {
  const q = normalizeLeadSearch(query)
  if (!q) return 0
  const hay = normalizeLeadSearch(haystack)
  const keys = keywords.map(normalizeLeadSearch).filter(Boolean)
  if (keys.includes(q)) return 120
  if (hay === q) return 110
  if (hay.startsWith(q)) return 95
  if (wordStartsWith(hay, q)) return 80
  if (q.length >= 3 && hay.includes(q)) return 55
  if (q.length >= 3 && keys.some((key) => key.includes(q) || q.includes(key))) return 70
  return 0
}

describe('busca do card do lead', () => {
  it('IA leva ao estúdio, não a um pedaço aleatório de palavra', () => {
    const ia = scoreLeadSearchQuery('IA', 'Análise visual', ['ia', 'iris', 'analise'])
    const markup = scoreLeadSearchQuery('IA', 'Markup composição de preço', ['custo'])
    assert.ok(ia >= 120)
    assert.equal(markup, 0)
  })

  it('aceita acento e maiúscula', () => {
    assert.ok(scoreLeadSearchQuery('ORÇAMENTO', 'Orçamentos slides', ['orcamento']) > 0)
    assert.ok(scoreLeadSearchQuery('telefone', 'Contato Nome telefone e e-mail') > 0)
  })

  it('não casa letra solta no meio do texto', () => {
    assert.equal(scoreLeadSearchQuery('x', 'Markup'), 0)
  })
})
