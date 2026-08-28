import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

describe('Épico 23 — agenda pública em 4 passos', () => {
  it('passos form, date, time e success existem', () => {
    const page = readSrc('src/pages/AgendamentoPublicoGarbo.tsx')
    assert.match(page, /type Step = 'form' \| 'date' \| 'time' \| 'success'/)
    assert.match(page, /1 · Seus dados/)
    assert.match(page, /2 · Escolha o dia/)
    assert.match(page, /3 · Escolha o horário/)
    assert.match(page, /Agendamento confirmado/)
    assert.match(page, /proximosDiasAgenda/)
    assert.match(page, /horariosDoDia/)
  })

  it('rotas públicas e helper de dias', () => {
    const app = readSrc('src/App.tsx')
    assert.match(app, /\/agendar\/:empresaSlug\/:slug/)
    assert.match(app, /AgendamentoPublico/)
    const lib = readSrc('src/lib/crm-comunicacao.ts')
    assert.match(lib, /export function proximosDiasAgenda/)
  })
})
