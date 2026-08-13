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
const VISIBILITY_RELOAD_MIN_MS = 45_000

function isCacheFresh(savedAt, now = Date.now(), freshMs = CACHE_FRESH_MS) {
  return now - savedAt < freshMs
}

function shouldReloadOnVisible(input) {
  if (input.visibilityState !== 'visible') return false
  const minIntervalMs = input.minIntervalMs ?? VISIBILITY_RELOAD_MIN_MS
  return input.now - input.lastReloadAt >= minIntervalMs
}

describe('constantes alinhadas com o código', () => {
  it('refresh-policy.ts usa os mesmos tempos', () => {
    const src = readSrc('src/lib/refresh-policy.ts')
    assert.match(src, /CACHE_FRESH_MS = 20_000/)
    assert.match(src, /VISIBILITY_RELOAD_MIN_MS = 45_000/)
    assert.match(src, /VISIBILITY_DEBOUNCE_MS = 350/)
  })

  it('useAutoRefresh não recarrega a cada visibilitychange', () => {
    const src = readSrc('src/hooks/useAutoRefresh.ts')
    assert.match(src, /shouldReloadOnVisible/)
    assert.match(src, /visibilityState !== 'visible'/)
    assert.doesNotMatch(src, /if \(document\.visibilityState === 'visible'\) reload\(\)/)
  })

  it('obras usam cache e realtime imediato', () => {
    const src = readSrc('src/hooks/useObrasState.ts')
    assert.match(src, /OBRAS_CACHE_KEY/)
    assert.match(src, /silentReloadLive/)
    assert.match(src, /isCacheKeyFresh/)
  })

  it('calendário não some enquanto já tem dados em cache', () => {
    const src = readSrc('src/pages/CalendarioObras.tsx')
    assert.match(src, /obrasHook\.loading && obrasHook\.data\.length === 0/)
  })

  it('agenda também mantém o Kanban se já tem dados', () => {
    const src = readSrc('src/pages/AgendaObras.tsx')
    assert.match(src, /obrasHook\.loading && obrasHook\.data\.length === 0/)
  })
})

describe('iPhone: crash por atualizar várias vezes', () => {
  it('no celular não usa location.reload', () => {
    const src = readSrc('src/lib/app-refresh.ts')
    assert.match(src, /isMobileUi\(\)/)
    assert.match(src, /requestSoftRefresh/)
    assert.match(src, /SOFT_REFRESH_EVENT/)
  })

  it('card da agenda não transforma PDF em dezenas de fotos', () => {
    const strip = readSrc('src/components/obras/ObraLeadMidiasStrip.tsx')
    assert.match(strip, /rasterizePdfs = variant === 'detail'/)
    const pdf = readSrc('src/lib/pdf-to-image.ts')
    assert.match(pdf, /MAX_LEAD_PDF_PAGES = 8/)
    assert.doesNotMatch(pdf, /MAX_LEAD_PDF_PAGES = 100/)
  })

  it('detecta loop de abertura da página', () => {
    const src = readSrc('src/lib/boot-guard.ts')
    assert.match(src, /BOOT_BURST_LIMIT = 3/)
    const main = readSrc('src/main.tsx')
    assert.match(main, /markBootAndDetectLoop/)
  })
})

describe('política de cache', () => {
  it('considera fresco se buscou há 5s', () => {
    assert.equal(isCacheFresh(1_000, 6_000), true)
  })

  it('considera velho se buscou há 21s', () => {
    assert.equal(isCacheFresh(1_000, 22_000), false)
  })
})

describe('iPhone voltando para a aba', () => {
  it('não recarrega se a aba está oculta', () => {
    assert.equal(
      shouldReloadOnVisible({
        now: 50_000,
        lastReloadAt: 0,
        visibilityState: 'hidden',
      }),
      false,
    )
  })

  it('não recarrega se o usuário só olhou uma notificação (10s)', () => {
    assert.equal(
      shouldReloadOnVisible({
        now: 10_000,
        lastReloadAt: 0,
        visibilityState: 'visible',
      }),
      false,
    )
  })

  it('recarrega se ficou longe por mais de 45s', () => {
    assert.equal(
      shouldReloadOnVisible({
        now: 45_000,
        lastReloadAt: 0,
        visibilityState: 'visible',
      }),
      true,
    )
  })

  it('junta vários avisos: 44.9s ainda não busca', () => {
    assert.equal(
      shouldReloadOnVisible({
        now: 44_999,
        lastReloadAt: 0,
        visibilityState: 'visible',
      }),
      false,
    )
  })
})

describe('cache em memória + sessionStorage', () => {
  it('guarda e lê de volta', () => {
    const store = new Map()
    const memory = new Map()
    const key = 'movelaria-obras'

    function write(value, at = 1_000) {
      const entry = { value, at }
      memory.set(key, entry)
      store.set(key, JSON.stringify(entry))
    }

    function read() {
      if (memory.has(key)) return memory.get(key)
      const raw = store.get(key)
      return raw ? JSON.parse(raw) : null
    }

    write([{ id: 'obra-1', cliente_nome: 'Casa Azul' }])
    const cached = read()
    assert.equal(cached.value[0].cliente_nome, 'Casa Azul')
    assert.equal(isCacheFresh(cached.at, 15_000), true)
    assert.equal(isCacheFresh(cached.at, 25_000), false)
  })
})
