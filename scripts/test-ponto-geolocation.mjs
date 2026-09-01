/**
 * GPS do ponto: texto em português e um único pedido no toque.
 * Rodar: node --test scripts/test-ponto-geolocation.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('GPS do bater ponto', () => {
  const geo = readSrc('src/lib/geolocation.ts')
  const hook = readSrc('src/hooks/useBaterPonto.ts')
  const page = readSrc('src/pages/BaterPonto.tsx')
  const ponto = readSrc('src/lib/funcionario-ponto.ts')

  it('traduz o recado em inglês do celular para português', () => {
    assert.match(geo, /formatGeolocationError/)
    assert.match(geo, /O celular bloqueou a localização/)
    assert.match(geo, /Não encontramos sua posição/)
    assert.match(geo, /Demorou demais para achar sua posição/)
    assert.doesNotMatch(geo, /err\.message/)
    assert.doesNotMatch(ponto, /err\.message \|\| 'Permissão de localização/)
  })

  it('pede localização no toque e não tenta de novo depois que o tempo acaba', () => {
    const fn = geo.slice(geo.indexOf('export function requestGeolocation'))
    assert.match(fn, /getCurrentPosition/)
    assert.match(fn, /watchPosition/)
    assert.match(fn, /PERMISSION_DENIED|isPermissionDeniedCode/)
    assert.match(fn, /iPhone recusa o 2º pedido/)
    assert.doesNotMatch(fn, /timeout:\s*\d/)
    assert.doesNotMatch(geo, /readPositionOnce/)
    assert.match(hook, /solicitarLocalizacao = \(\) =>/)
    assert.doesNotMatch(hook, /await requestGeolocation/)
  })

  it('se o GPS falhar, a tela explica como ligar de novo sem esconder o passo', () => {
    assert.match(hook, /statusError/)
    assert.match(page, /statusError/)
    assert.match(page, /isGeolocationPermissionDenied/)
    assert.match(page, /Tentar localização de novo/)
    assert.match(page, /Serviços de Localização/)
    assert.match(page, /PontoLocalizacaoManual/)
    assert.match(page, /digite só o CEP/)
    assert.doesNotMatch(page, /ErrorState message=\{error\}/)
  })
})
