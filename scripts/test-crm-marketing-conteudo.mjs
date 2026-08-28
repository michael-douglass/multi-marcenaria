import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function tarefasDoDia(tarefas, isoDate) {
  return tarefas.filter(t => (t.dataAgendada ?? '').slice(0, 10) === isoDate)
}

describe('Épico 18 — marketing conteúdo calendário e ?tab=', () => {
  it('tarefasDoDia filtra só o dia', () => {
    const tarefas = [
      { id: 'a', dataAgendada: '2026-08-27' },
      { id: 'b', dataAgendada: '2026-08-28T10:00:00' },
      { id: 'c', dataAgendada: '2026-08-27T15:00:00' },
    ]
    assert.deepEqual(tarefasDoDia(tarefas, '2026-08-27').map(t => t.id), ['a', 'c'])
  })

  it('página lê ?tab= e desenha calendário do mês', () => {
    const page = readSrc('src/pages/crm/MarketingConteudoPage.tsx')
    assert.match(page, /useSearchParams/)
    assert.match(page, /params\.get\('tab'\)/)
    assert.match(page, /next\.set\('tab', item\.id\)/)
    assert.match(page, /tarefasDoDia/)
    assert.match(page, /grid-cols-7/)
    assert.match(page, /Agendamento/)
    assert.doesNotMatch(page, /react-day-picker/)
  })

  it('helper tarefasDoDia existe na lib', () => {
    const lib = readSrc('src/lib/crm-marketing.ts')
    assert.match(lib, /export function tarefasDoDia/)
  })
})
