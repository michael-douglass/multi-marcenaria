/**
 * Executa de verdade o pedido de GPS (com GPS falso) para garantir o texto em português.
 * Rodar: node --test scripts/test-ponto-geolocation-runtime.mjs
 */
import assert from 'node:assert/strict'
import { describe, it, afterEach } from 'node:test'
import {
  formatGeolocationError,
  isGeolocationPermissionDenied,
  requestGeolocation,
} from '../src/lib/geolocation.ts'

function mockGeo({
  position = null,
  error = null,
  delayMs = 0,
  watchError = null,
} = {}) {
  const watches = new Map()
  let watchSeq = 1

  const deliver = (success, fail, overrideError = error) => {
    const run = () => {
      if (position && !overrideError) {
        success({
          coords: {
            latitude: position.latitude,
            longitude: position.longitude,
            accuracy: position.accuracy ?? 12,
          },
        })
        return
      }
      fail(overrideError)
    }
    if (delayMs) setTimeout(run, delayMs)
    else run()
  }

  globalThis.window = globalThis
  globalThis.window.isSecureContext = true
  globalThis.window.matchMedia = () => ({ matches: false })
  if (!globalThis.navigator) globalThis.navigator = {}
  globalThis.navigator.geolocation = {
    getCurrentPosition(success, fail) {
      deliver(success, fail)
    },
    watchPosition(success, fail) {
      const id = watchSeq++
      watches.set(id, { success, fail })
      if (watchError) {
        fail(watchError)
        return id
      }
      deliver(success, fail)
      return id
    },
    clearWatch(id) {
      watches.delete(id)
    },
  }
}

describe('pedido de GPS (execução)', () => {
  const originalWindow = globalThis.window
  const originalGeo = globalThis.navigator?.geolocation

  afterEach(() => {
    if (originalWindow === undefined) delete globalThis.window
    else globalThis.window = originalWindow
    if (globalThis.navigator) {
      if (originalGeo === undefined) delete globalThis.navigator.geolocation
      else globalThis.navigator.geolocation = originalGeo
    }
  })

  it('devolve latitude e longitude quando o celular autoriza', async () => {
    mockGeo({ position: { latitude: -23.55, longitude: -46.63, accuracy: 8 } })
    const pos = await requestGeolocation(1000)
    assert.equal(pos.latitude, -23.55)
    assert.equal(pos.longitude, -46.63)
    assert.equal(pos.accuracy, 8)
  })

  it('nunca mostra "User denied Geolocation" para a pessoa', async () => {
    mockGeo({
      error: { code: 1, message: 'User denied Geolocation', PERMISSION_DENIED: 1 },
    })
    await assert.rejects(
      () => requestGeolocation(1000),
      (err) => {
        assert.equal(err instanceof Error, true)
        assert.doesNotMatch(err.message, /User denied/)
        assert.match(err.message, /bloqueou a localização/)
        assert.equal(isGeolocationPermissionDenied(err.message), true)
        return true
      },
    )
  })

  it('explica em português quando o GPS não acha a posição', async () => {
    mockGeo({ error: { code: 2, message: 'Position unavailable', PERMISSION_DENIED: 1 } })
    await assert.rejects(
      () => requestGeolocation(1000),
      /Não encontramos sua posição/,
    )
  })

  it('não trata recusa falsa do iPhone no segundo pedido como bloqueio', async () => {
    mockGeo({
      position: { latitude: -23.55, longitude: -46.63, accuracy: 8 },
      delayMs: 40,
      watchError: { code: 1, message: 'User denied Geolocation', PERMISSION_DENIED: 1 },
    })
    const pos = await requestGeolocation(1000)
    assert.equal(pos.latitude, -23.55)
    assert.equal(pos.longitude, -46.63)
  })
})

describe('texto do erro', () => {
  it('code 1 vira instrução, não inglês cru', () => {
    const text = formatGeolocationError({ code: 1, message: 'User denied Geolocation' })
    assert.match(text, /bloqueou a localização/)
    assert.doesNotMatch(text, /User denied/)
  })
})
