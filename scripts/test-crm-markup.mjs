import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function arredondar(valor, casas = 2) {
  const fator = 10 ** casas
  return Math.round(valor * fator) / fator
}

function aplicarFatorSobras(custo, fatorPercent) {
  return arredondar(custo * (1 + fatorPercent / 100))
}

function aplicarImpostosETaxas(subtotal, percentualImposto, taxasFinanceiras) {
  return arredondar(subtotal * (1 + (percentualImposto + taxasFinanceiras) / 100))
}

function aplicarMargemLucro(custoComImpostos, margemPercent) {
  return arredondar(custoComImpostos * (1 + margemPercent / 100))
}

function aplicarDescontoFinal(precoBruto, descontoPercent) {
  const pct = Math.min(100, Math.max(0, descontoPercent ?? 0))
  return arredondar(precoBruto * (1 - pct / 100))
}

function calcularDescontoPercentFromPrecoAlvo(precoBruto, precoAlvo) {
  if (!(precoBruto > 0)) return 0
  const alvo = Math.min(precoBruto, Math.max(0, arredondar(precoAlvo)))
  return Math.min(100, Math.max(0, ((precoBruto - alvo) / precoBruto) * 100))
}

function filtrarMarkups(lista, busca) {
  const termo = busca.trim().toLowerCase()
  if (!termo) return lista
  return lista.filter(item => [item.titulo, item.lead_nome ?? '', item.status].join(' ').toLowerCase().includes(termo))
}

function isLinkPublicoAtivo(slide) {
  return !slide.dados?._meta?.link_publico_oculto
}

function linkPublicoOrcamento(id, origin = 'http://localhost:3001') {
  return `${origin}/orcamento/emp_garbo/${id}`
}

describe('Épico 4 — markup e slides', () => {
  it('preço final segue materiais + sobras + margem', () => {
    const materiais = 1000
    const comSobras = aplicarFatorSobras(materiais, 5)
    const comMargem = aplicarMargemLucro(comSobras, 30)
    assert.equal(comSobras, 1050)
    assert.equal(comMargem, 1365)
  })

  it('item inativo não entra na soma', () => {
    const linhas = [
      { quantidade: 2, valor_unitario: 10, ativo: true },
      { quantidade: 5, valor_unitario: 100, ativo: false },
    ]
    const soma = linhas.reduce((acc, l) => acc + (l.ativo === false ? 0 : arredondar(l.quantidade * l.valor_unitario)), 0)
    assert.equal(soma, 20)
  })

  it('desconto percentual converte preço alvo sem estourar o bruto', () => {
    const pct = calcularDescontoPercentFromPrecoAlvo(100, 90)
    assert.equal(arredondar(pct), 10)
    assert.equal(aplicarDescontoFinal(100, pct), 90)
  })

  it('impostos entram antes da margem', () => {
    const subtotal = 1000
    const comImposto = aplicarImpostosETaxas(subtotal, 10, 0)
    const final = aplicarMargemLucro(comImposto, 30)
    assert.equal(comImposto, 1100)
    assert.equal(final, 1430)
  })

  it('busca da lista filtra título e lead', () => {
    const lista = [
      { titulo: 'Paulo Henrique ( Casa Paulo )', lead_nome: 'Paulo Henrique', status: 'rascunho' },
      { titulo: 'Ângela Silveira', lead_nome: 'Angela', status: 'finalizado' },
    ]
    assert.equal(filtrarMarkups(lista, 'paulo').length, 1)
    assert.equal(filtrarMarkups(lista, 'rascunho').length, 1)
  })

  it('link público usa schema emp_garbo', () => {
    const id = '504795c1-358e-4c79-8205-21ab7552c982'
    assert.equal(linkPublicoOrcamento(id), `http://localhost:3001/orcamento/emp_garbo/${id}`)
    assert.equal(isLinkPublicoAtivo({ dados: {} }), true)
    assert.equal(isLinkPublicoAtivo({ dados: { _meta: { link_publico_oculto: true } } }), false)
  })

  it('páginas reais substituíram os placeholders', () => {
    const app = readSrc('src/App.tsx')
    assert.match(app, /MarkupListPage/)
    assert.match(app, /OrcamentoSlidesPage/)
    assert.doesNotMatch(app, /crmPlaceholder\('\/markup'/)
    assert.doesNotMatch(app, /crmPlaceholder\('\/orcamento-slides'/)
  })
})
