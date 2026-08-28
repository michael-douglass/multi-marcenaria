import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function diaChave(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function reunioesDoDia(lista, day) {
  const key = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`
  return lista.filter(item => diaChave(item.data_hora_inicio) === key)
}

describe('Épico 13 — agenda comercial calendário', () => {
  it('reuniões do dia usam a data local, não o fuso da string ISO crua', () => {
    const day = new Date(2026, 7, 27)
    const lista = [
      { id: 'a', data_hora_inicio: new Date(2026, 7, 27, 10, 0).toISOString() },
      { id: 'b', data_hora_inicio: new Date(2026, 7, 28, 10, 0).toISOString() },
    ]
    assert.deepEqual(reunioesDoDia(lista, day).map(i => i.id), ['a'])
  })

  it('calendário é date-fns, sem react-day-picker', () => {
    const cal = readSrc('src/components/crm/AgendaComercialCalendar.tsx')
    assert.match(cal, /from 'date-fns'/)
    assert.match(cal, /ptBR/)
    assert.match(cal, /reunioesDoDia/)
    assert.doesNotMatch(cal, /react-day-picker/)
    assert.doesNotMatch(cal, /AgendaPopup/)
  })

  it('página tem calendário, lista do dia, status e link público', () => {
    const page = readSrc('src/pages/crm/AgendaComercialPage.tsx')
    assert.match(page, /AgendaComercialCalendar/)
    assert.match(page, /reunioesDoDia/)
    assert.match(page, /reunioesHoje/)
    assert.match(page, /AGENDA_STATUS_LABEL/)
    assert.match(page, /Todos os status/)
    assert.match(page, /linkPublicoAgenda/)
    assert.match(page, /Nova reunião/)
    assert.doesNotMatch(page, /Agenda Geral/)
    assert.doesNotMatch(page, /Agenda Pessoal/)
    assert.doesNotMatch(page, /Lembrete de Leads/)
    assert.doesNotMatch(page, /AgendaPopup/)
  })

  it('helpers de dia existem na lib', () => {
    const lib = readSrc('src/lib/crm-agenda.ts')
    assert.match(lib, /export function reunioesDoDia/)
    assert.match(lib, /export function reunioesHoje/)
    assert.match(lib, /\/agendar\/garbo\//)
  })
})
