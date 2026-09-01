/**
 * Titulares da tarefa no card do lead: toda a equipe, inclusive montadores.
 * Rodar: node --test scripts/test-lead-lembrete-titulares.mjs
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

function titularAgendaGrupo(perfilCasa) {
  return perfilCasa === 'montador' || perfilCasa === 'montador_admin' ? 'montador' : 'equipe'
}

const CASA_PAPEL_LABEL = {
  montador: 'montador',
  montador_admin: 'montador admin',
  administrador: 'admin',
  administrador_obras: 'adm. obras',
  financeiro: 'financeiro',
}

const CRM_PAPEL_LABEL = {
  admin: 'admin',
  vendedor: 'vendedor',
  marketing: 'marketing',
  projetista: 'projetista',
  projetista_admin: 'projetista admin',
}

function formatTitularAgendaPapel(perfilCasa, crmRoles) {
  const labels = []
  const seen = new Set()
  const push = (label) => {
    if (!label || seen.has(label)) return
    seen.add(label)
    labels.push(label)
  }
  push(CASA_PAPEL_LABEL[perfilCasa ?? ''])
  for (const role of crmRoles ?? []) {
    if (role === 'nenhum') continue
    push(CRM_PAPEL_LABEL[role] ?? role)
  }
  return labels.length > 0 ? labels.join(' · ') : 'equipe'
}

function groupTitularesAgenda(users) {
  const equipe = []
  const montadores = []
  for (const user of users) {
    if (user.grupo === 'montador') montadores.push(user)
    else equipe.push(user)
  }
  return { equipe, montadores }
}

describe('titulares da tarefa no card do lead', () => {
  it('separa montadores da equipe e rotula os papéis', () => {
    const joao = {
      id: 'm1',
      nome: 'João Pedro Braga',
      grupo: titularAgendaGrupo('montador'),
    }
    const bruno = {
      id: 'm2',
      nome: 'Bruno Henrique',
      grupo: titularAgendaGrupo('montador_admin'),
    }
    const fabio = {
      id: 'a1',
      nome: 'Fabio Faria',
      grupo: titularAgendaGrupo('administrador'),
    }
    const grouped = groupTitularesAgenda([joao, bruno, fabio])
    assert.equal(grouped.montadores.length, 2)
    assert.equal(grouped.equipe.length, 1)
    assert.equal(formatTitularAgendaPapel('montador', []), 'montador')
    assert.equal(formatTitularAgendaPapel('montador_admin', []), 'montador admin')
    assert.equal(formatTitularAgendaPapel('montador', ['vendedor', 'marketing']), 'montador · vendedor · marketing')
    assert.equal(formatTitularAgendaPapel('administrador', ['admin']), 'admin')
  })

  it('lista do card inclui montadores, todos os usuários e a RPC da Casa', () => {
    const picker = readSrc('src/components/agenda/LeadLembreteTitularesPicker.tsx')
    const hook = readSrc('src/hooks/useTitularesAgenda.ts')
    const lembretes = readSrc('src/hooks/useLeadLembretes.ts')
    const identity = readSrc('src/lib/crm-identity.ts')
    const sql = readSrc('supabase/migrations/179_titulares_agenda_inclui_montadores.sql')

    assert.doesNotMatch(picker, /TITULAR_LEMBRETE_ROLES/)
    assert.match(picker, /Todos os usuários do sistema/)
    assert.match(picker, /Montadores/)
    assert.match(picker, /useTitularesAgenda/)
    assert.match(hook, /movelaria_listar_titulares_agenda/)
    assert.match(lembretes, /movelaria_listar_titulares_agenda/)
    assert.match(sql, /montador_admin/)
    assert.match(sql, /tipo_usuario = 'colaborador'/)
    assert.match(sql, /emp_leads_titular_lembrete_select/)
    assert.match(identity, /Montador, projetista, admin/)
  })
})
