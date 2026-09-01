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

function aplicarMargemLucro(custoComImpostos, margemPercent) {
  return arredondar(custoComImpostos * (1 + margemPercent / 100))
}

function calcularMargemPercentFromLucroAlvo(custoComImpostos, lucroAlvo) {
  if (!(custoComImpostos > 0)) return 0
  const lucro = Math.max(0, arredondar(lucroAlvo))
  return Math.max(0, arredondar((lucro / custoComImpostos) * 100, 6))
}

describe('Margem de lucro em R$ na calculadora', () => {
  it('lucro de R$ 3.000 sobre custo 10.000 vira 30%', () => {
    assert.equal(calcularMargemPercentFromLucroAlvo(10000, 3000), 30)
  })

  it('ida e volta: lucro digitado reaparece depois de aplicar a %', () => {
    const custo = 107171.53
    const lucroAlvo = 32151.46
    const pct = calcularMargemPercentFromLucroAlvo(custo, lucroAlvo)
    const preco = aplicarMargemLucro(custo, pct)
    const lucroRecalculado = arredondar(preco - custo)
    assert.equal(lucroRecalculado, lucroAlvo)
  })

  it('sem custo não inventa margem', () => {
    assert.equal(calcularMargemPercentFromLucroAlvo(0, 5000), 0)
  })

  it('calculadora deixa editar o lucro em reais e recalcula a %', () => {
    const calc = readSrc('src/lib/markup-calculo.ts')
    const sheet = readSrc('src/components/markup/MarkupCalculatorSheet.tsx')
    const input = readSrc('src/components/markup/MarkupLucroReaisInput.tsx')
    assert.match(calc, /calcularMargemPercentFromLucroAlvo/)
    assert.match(sheet, /MarkupLucroReaisInput/)
    assert.match(sheet, /confirmarLucroReaisEditado/)
    assert.match(input, /A margem percentual se ajusta/)
  })
})
