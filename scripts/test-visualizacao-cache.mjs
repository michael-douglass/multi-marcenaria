import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

const CACHE_FRESH_MS = 20_000
const VISUALIZACAO_CACHE_FRESH_MS = 5 * 60 * 1000
const VISUALIZACAO_CONFIG_CACHE_FRESH_MS = 30 * 60 * 1000
const VISUALIZACAO_POLL_MS = 5 * 60 * 1000

function isCacheFresh(savedAt, now = Date.now(), freshMs = CACHE_FRESH_MS) {
  return now - savedAt < freshMs
}

describe('tempos da Visualização no código', () => {
  it('refresh-policy.ts declara cache de 5 min e config de 30 min', () => {
    const src = readSrc('src/lib/refresh-policy.ts')
    assert.match(src, /VISUALIZACAO_CACHE_FRESH_MS = 5 \* 60 \* 1000/)
    assert.match(src, /VISUALIZACAO_CONFIG_CACHE_FRESH_MS = 30 \* 60 \* 1000/)
    assert.match(src, /VISUALIZACAO_POLL_MS = 5 \* 60 \* 1000/)
  })

  it('data-cache.ts tem chaves da visualização', () => {
    const src = readSrc('src/lib/data-cache.ts')
    assert.match(src, /VISUALIZACAO_CONFIG_CACHE_KEY/)
    assert.match(src, /CONTAS_RECEBER_CACHE_KEY/)
    assert.match(src, /evolucaoPainelCacheKey/)
    assert.match(src, /pontoDiarioCacheKey/)
  })

  it('página Visualização não força busca a cada 60s', () => {
    const src = readSrc('src/pages/Visualizacao.tsx')
    assert.doesNotMatch(src, /60_000/)
    assert.match(src, /longCache: true/)
    assert.doesNotMatch(src, /obrasHook\.reload\(\{ silent: true \}\)/)
    assert.doesNotMatch(src, /contasHook\.reload\(\{ silent: true \}\)/)
  })

  it('config, fotos e ponto usam cache longo', () => {
    const config = readSrc('src/hooks/useVisualizacaoConfig.ts')
    assert.match(config, /VISUALIZACAO_CONFIG_CACHE_KEY/)
    assert.match(config, /VISUALIZACAO_CONFIG_CACHE_FRESH_MS/)

    const evolucao = readSrc('src/hooks/useObraEvolucao.ts')
    assert.match(evolucao, /evolucaoPainelCacheKey/)
    assert.match(evolucao, /VISUALIZACAO_CACHE_FRESH_MS/)
    assert.match(evolucao, /VISUALIZACAO_POLL_MS/)

    const ponto = readSrc('src/hooks/useControlePontoDiario.ts')
    assert.match(ponto, /pontoDiarioCacheKey/)
    assert.match(ponto, /longCache/)
    assert.match(ponto, /VISUALIZACAO_CACHE_FRESH_MS/)

    const contas = readSrc('src/hooks/useContasReceber.ts')
    assert.match(contas, /CONTAS_RECEBER_CACHE_KEY/)
    assert.match(contas, /isCacheKeyFresh/)
  })
})

describe('política de cache da Visualização', () => {
  it('cache curto de 20s continua velho depois de 21s', () => {
    assert.equal(isCacheFresh(1_000, 22_000, CACHE_FRESH_MS), false)
  })

  it('cache da Visualização ainda vale depois de 4 min', () => {
    const savedAt = 0
    const fourMin = 4 * 60 * 1000
    assert.equal(isCacheFresh(savedAt, fourMin, VISUALIZACAO_CACHE_FRESH_MS), true)
  })

  it('cache da Visualização envelhece depois de 5 min', () => {
    const savedAt = 0
    const fiveMinPlus = VISUALIZACAO_CACHE_FRESH_MS + 1
    assert.equal(isCacheFresh(savedAt, fiveMinPlus, VISUALIZACAO_CACHE_FRESH_MS), false)
  })

  it('config dos painéis ainda vale depois de 20 min', () => {
    const twentyMin = 20 * 60 * 1000
    assert.equal(isCacheFresh(0, twentyMin, VISUALIZACAO_CONFIG_CACHE_FRESH_MS), true)
  })

  it('config dos painéis envelhece depois de 30 min', () => {
    assert.equal(
      isCacheFresh(0, VISUALIZACAO_CONFIG_CACHE_FRESH_MS + 1, VISUALIZACAO_CONFIG_CACHE_FRESH_MS),
      false,
    )
  })

  it('intervalo de atualização da TV é 5 minutos', () => {
    assert.equal(VISUALIZACAO_POLL_MS, VISUALIZACAO_CACHE_FRESH_MS)
    assert.equal(VISUALIZACAO_POLL_MS, 300_000)
  })
})
