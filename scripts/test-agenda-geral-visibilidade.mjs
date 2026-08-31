import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function isCrmAtivo(crm) {
  return crm?.statusConvite === 'ATIVO'
}

function isPrestadorServico(crm) {
  return crm?.tipoUsuario === 'prestador_servico' && isCrmAtivo(crm)
}

function hasCrmColaboradorAccess(crm) {
  if (!crm || !isCrmAtivo(crm) || crm.tipoUsuario !== 'colaborador') return false
  return (crm.roles ?? []).some(r => r !== 'nenhum')
}

function canUseAgendaGeral(movelaria, crm, pathname) {
  if (pathname?.startsWith('/portal-parceiro')) return false
  if (isPrestadorServico(crm)) return false
  if (crm?.tipoUsuario === 'lead') return false
  if (movelaria?.ativo === true) return true
  return hasCrmColaboradorAccess(crm)
}

const montador = { ativo: true, perfil: 'montador' }
const montadorAdmin = { ativo: true, perfil: 'montador_admin' }
const projetista = {
  tipoUsuario: 'colaborador',
  statusConvite: 'ATIVO',
  roles: ['projetista'],
}
const prestador = {
  tipoUsuario: 'prestador_servico',
  statusConvite: 'ATIVO',
  roles: [],
}
const lead = { tipoUsuario: 'lead', statusConvite: 'ATIVO', roles: [] }

describe('agenda geral em todo o sistema', () => {
  it('libera montador, montador admin e projetista', () => {
    assert.equal(canUseAgendaGeral(montador, null, '/calendario-obras'), true)
    assert.equal(canUseAgendaGeral(montadorAdmin, null, '/agenda-obras'), true)
    assert.equal(canUseAgendaGeral(null, projetista, '/projetos'), true)
    assert.equal(canUseAgendaGeral({ ativo: true }, projetista, '/dashboard'), true)
  })

  it('bloqueia prestador de serviço e lead', () => {
    assert.equal(canUseAgendaGeral(null, prestador, '/portal-parceiro'), false)
    assert.equal(canUseAgendaGeral({ ativo: true }, prestador, '/dashboard'), false)
    assert.equal(canUseAgendaGeral(null, lead, '/pipeline'), false)
  })

  it('MainLayout monta o calendário e o dock CRM não duplica', () => {
    const layout = readSrc('src/components/layout/MainLayout.tsx')
    const dock = readSrc('src/components/crm/CrmSelletosDock.tsx')
    const identity = readSrc('src/lib/crm-identity.ts')
    const pessoal = readSrc('src/hooks/useAgendaPessoal.ts')
    assert.match(layout, /FloatingAgendaGeralShell/)
    assert.match(layout, /canUseAgendaGeral/)
    assert.doesNotMatch(dock, /FloatingAgendaGeralShell/)
    assert.match(identity, /canUseAgendaGeral/)
    assert.match(identity, /isPrestadorServico/)
    assert.match(pessoal, /titular_id\.eq/)
  })
})
