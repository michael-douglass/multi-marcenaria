/**
 * Ponto: se o GPS bloquear, o prestador informa só o CEP.
 * Rodar: node --test scripts/test-ponto-localizacao-manual.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { afterEach, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { formatCep, geocodeCep, isCepCompleto, normalizeCep } from '../src/lib/geocoding.ts'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('CEP manual no bater ponto', () => {
  const page = readSrc('src/pages/BaterPonto.tsx')
  const hook = readSrc('src/hooks/useBaterPonto.ts')
  const manual = readSrc('src/components/ponto/PontoLocalizacaoManual.tsx')
  const geocoding = readSrc('src/lib/geocoding.ts')

  it('só mostra o campo depois de tentar o GPS', () => {
    assert.match(page, /Permitir localização/)
    assert.match(page, /error && \(\s*<PontoLocalizacaoManual/)
    assert.match(hook, /requestGeolocation\(\)/)
    assert.match(hook, /confirmarLocalizacaoManual/)
    assert.doesNotMatch(hook, /await requestGeolocation/)
  })

  it('pede somente o CEP e grava como localização manual', () => {
    assert.match(manual, /Somente o CEP/)
    assert.match(manual, /Usar este CEP/)
    assert.match(manual, /geocodeCep/)
    assert.match(manual, /origem: 'manual'/)
    assert.doesNotMatch(manual, /Rua das Flores/)
    assert.match(geocoding, /brasilapi\.com\.br\/api\/cep/)
    assert.match(page, /digite só o CEP/)
    assert.match(page, /Informado pelo CEP/)
  })
})

describe('CEP (execução)', () => {
  const originalFetch = globalThis.fetch

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  it('aceita CEP com ou sem hífen', () => {
    assert.equal(normalizeCep('37.170-000'), '37170000')
    assert.equal(formatCep('37170000'), '37170-000')
    assert.equal(isCepCompleto('37170-000'), true)
    assert.equal(isCepCompleto('37170'), false)
  })

  it('pede os 8 números antes de procurar', async () => {
    await assert.rejects(() => geocodeCep('37170'), /8 números/)
  })

  it('transforma o CEP em latitude e longitude', async () => {
    globalThis.fetch = async (input) => {
      const url = String(input)
      if (url.includes('brasilapi.com.br')) {
        return {
          ok: true,
          json: async () => ({
            city: 'Boa Esperança',
            state: 'MG',
            neighborhood: 'Centro',
            street: 'Praça da Matriz',
            location: { coordinates: { latitude: '-21.0901', longitude: '-45.5642' } },
          }),
        }
      }
      throw new Error(`fetch inesperado: ${url}`)
    }

    const pos = await geocodeCep('37170-000')
    assert.equal(pos.latitude, -21.0901)
    assert.equal(pos.longitude, -45.5642)
    assert.match(pos.endereco, /Boa Esperança/)
  })

  it('avisa quando o CEP não existe', async () => {
    globalThis.fetch = async (input) => {
      const url = String(input)
      if (url.includes('brasilapi.com.br')) {
        return { ok: false, json: async () => ({}) }
      }
      if (url.includes('viacep.com.br')) {
        return { ok: true, json: async () => ({ erro: true }) }
      }
      throw new Error(`fetch inesperado: ${url}`)
    }

    await assert.rejects(() => geocodeCep('00000000'), /CEP não encontrado/)
  })
})
