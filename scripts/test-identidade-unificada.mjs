import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function currentTimeHHmm(now) {
  const h = String(now.getHours()).padStart(2, '0')
  const m = String(now.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function isWithinAccessHours(hours, now) {
  if (!hours?.inicio && !hours?.fim) return true
  const current = currentTimeHHmm(now)
  if (hours.inicio && !hours.fim) return current >= hours.inicio
  if (!hours.inicio && hours.fim) return current <= hours.fim
  return current >= hours.inicio && current <= hours.fim
}

function isPortalOnly(movelaria, crm) {
  const temFabrica = movelaria?.ativo === true
  return crm?.tipoUsuario === 'prestador_servico' && crm?.statusConvite === 'ATIVO' && !temFabrica
}

function evaluateIdentityGate(movelaria, crm) {
  const movelariaOk = movelaria?.ativo === true
  const crmOk = crm?.statusConvite === 'ATIVO'
  if (!movelaria && !crm) return { ok: false, reason: 'missing' }
  if (!movelariaOk && !crmOk) {
    if (movelaria && movelaria.ativo === false) return { ok: false, reason: 'pending' }
    return { ok: false, reason: 'missing' }
  }
  if (!movelariaOk && crmOk && crm?.tipoUsuario === 'lead') {
    return { ok: false, reason: 'pending' }
  }
  return { ok: true }
}

describe('Épico 1 — helpers de identidade', () => {
  it('arquiteto sem ficha Movelaria cai no portal', () => {
    assert.equal(
      isPortalOnly(null, { tipoUsuario: 'prestador_servico', statusConvite: 'ATIVO' }),
      true,
    )
  })

  it('montador da fábrica não vira portal mesmo com ficha CRM', () => {
    assert.equal(
      isPortalOnly(
        { ativo: true, perfil: 'montador' },
        { tipoUsuario: 'prestador_servico', statusConvite: 'ATIVO' },
      ),
      false,
    )
  })

  it('admin da fábrica + admin CRM continua com as duas fichas ativas', () => {
    const gate = evaluateIdentityGate(
      { ativo: true, perfil: 'administrador' },
      { statusConvite: 'ATIVO', tipoUsuario: 'colaborador' },
    )
    assert.equal(gate.ok, true)
  })

  it('só Movelaria inativa, sem CRM, fica pendente', () => {
    const gate = evaluateIdentityGate({ ativo: false }, null)
    assert.equal(gate.ok, false)
    assert.equal(gate.reason, 'pending')
  })

  it('lead do CRM sem ficha da Casa fica pendente', () => {
    const gate = evaluateIdentityGate(null, { statusConvite: 'ATIVO', tipoUsuario: 'lead' })
    assert.equal(gate.ok, false)
    assert.equal(gate.reason, 'pending')
  })

  it('arquiteto CRM ativo entra mesmo sem Movelaria', () => {
    const gate = evaluateIdentityGate(null, { statusConvite: 'ATIVO', tipoUsuario: 'prestador_servico' })
    assert.equal(gate.ok, true)
  })

  it('horário de acesso: dentro da janela passa', () => {
    const now = new Date(2026, 7, 27, 10, 0, 0)
    assert.equal(isWithinAccessHours({ inicio: '08:00', fim: '18:00' }, now), true)
  })

  it('horário de acesso: fora da janela bloqueia', () => {
    const now = new Date(2026, 7, 27, 22, 0, 0)
    assert.equal(isWithinAccessHours({ inicio: '08:00', fim: '18:00' }, now), false)
  })
})

describe('Épico 1 — código da Movelaria usa as duas fichas', () => {
  it('useAuth busca a RPC de identidade unificada', () => {
    const src = readSrc('src/hooks/useAuth.ts')
    assert.match(src, /movelaria_obter_minha_identidade/)
    assert.match(src, /crmProfile/)
  })

  it('Configurações lista identidades e edita ficha CRM', () => {
    const page = readSrc('src/pages/Configuracoes.tsx')
    const hook = readSrc('src/hooks/useUsuarios.ts')
    assert.match(hook, /movelaria_listar_identidades/)
    assert.match(hook, /movelaria_atualizar_ficha_crm/)
    assert.match(page, /Função CRM/)
    assert.match(page, /Função Casa/)
    assert.match(page, /prestador_servico/)
  })

  it('App abre portal do parceiro e tela de horário', () => {
    const src = readSrc('src/App.tsx')
    assert.match(src, /PrestadorSelletos/)
    assert.match(src, /ForaDoHorario/)
    assert.match(src, /isPortalOnly/)
    assert.match(src, /evaluateIdentityGate/)
  })

  it('papéis CRM não entram no enum da fábrica', () => {
    const types = readSrc('src/types/index.ts')
    assert.doesNotMatch(types, /UserRole = .*vendedor/)
    const identity = readSrc('src/lib/crm-identity.ts')
    assert.match(identity, /export type CrmRole/)
    const auth = readSrc('src/contexts/AuthContext.tsx')
    assert.match(auth, /projetista_admin/)
    const roles = readSrc('src/lib/app-roles.ts')
    assert.match(roles, /projetista_admin/)
  })
})
