/**
 * Montador vê obras em atraso (calendário de hoje, agenda do mês e Visualização).
 * Rodar: node --test scripts/test-obras-atraso-montador.mjs
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

describe('montador vê obras em atraso', () => {
  it('o menu e a rota de Visualização abrem para o montador', () => {
    const roles = readSrc('src/lib/role-access.ts')
    const nav = readSrc('src/lib/app-navigation.ts')
    const montadorLine = roles
      .split('\n')
      .find(line => line.includes('Montador:') && line.includes('agendaObras'))
    assert.ok(montadorLine, 'linha do perfil Montador')
    assert.match(montadorLine, /visualizacao/)
    assert.match(nav, /id: 'visualizacao'/)
    assert.match(nav, /'MontadorAdmin', 'Montador', 'Visualizador'/)
  })

  it('o painel Obras Atrasadas está liberado para montador e montador admin', () => {
    const paineis = readSrc('src/lib/visualizacao-paineis.ts')
    assert.match(paineis, /roles\.includes\('Montador'\)/)
    const start = paineis.indexOf('export const VISUALIZACAO_PAINEIS_MONTADOR:')
    assert.ok(start >= 0)
    const arrayStart = paineis.indexOf('= [', start)
    const block = paineis.slice(arrayStart, paineis.indexOf(']', arrayStart))
    assert.match(block, /obras_atrasadas/)
    assert.doesNotMatch(block, /cobrancas_atrasadas/)
  })

  it('o calendário de hoje continua mostrando obra com prazo vencido', () => {
    const dias = readSrc('src/lib/obra-dias-trabalho.ts')
    assert.match(dias, /obraEmAtrasoAberta/)
    assert.match(dias, /obraVisivelNoDiaCalendario/)
    assert.match(dias, /iso === hojeIso && obraEmAtrasoAberta/)
    const progresso = readSrc('src/lib/obra-progresso.ts')
    assert.match(progresso, /obraVisivelNoDiaCalendario/)
  })

  it('na agenda, atraso de mês passado permanece no mês atual', () => {
    const filtro = readSrc('src/lib/obra-mes-filtro.ts')
    assert.match(filtro, /isMesCorrente/)
    assert.match(filtro, /datas_em_atraso/)
    assert.match(filtro, /getStatusEfetivo/)
  })
})
