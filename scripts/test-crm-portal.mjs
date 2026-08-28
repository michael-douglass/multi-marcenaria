import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function readSrc(rel) {
  return readFileSync(path.join(root, rel), 'utf8')
}

function isPortalVendaGanha(status) {
  const s = (status ?? '').trim()
  if (!s || /perdid/i.test(s)) return false
  return /venda realizada/i.test(s) || /ganh/i.test(s)
}

function isPortalVendaPerdida(status) {
  return /perdid/i.test((status ?? '').trim())
}

function podeAbrirLeadPortal(perm) {
  return Boolean(
    perm.podeVerDetalhes
    || perm.podeVerLousa
    || perm.podeVerFotos
    || perm.podeVerPdfs
    || perm.podeVerOrcamento,
  )
}

function arredondarBrl(value) {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

function sumSaquesPendentes(pedidos) {
  return pedidos
    .filter(p => p.status === 'pendente')
    .reduce((s, p) => s + Number(p.valorSolicitado), 0)
}

function calcSaldoExibidoPrestador(
  saldoParaSacar,
  totalComissaoCarteira,
  totalAGanar,
  totalRetirado,
  totalComissaoGanha,
  totalAjustes,
  pedidos,
) {
  const valorReservado = arredondarBrl(sumSaquesPendentes(pedidos))
  const retirado = arredondarBrl(totalRetirado)
  const debitadoTotal = arredondarBrl(retirado + valorReservado)
  const comissaoJaRealizada = arredondarBrl(totalComissaoGanha + totalAjustes)
  const saldoDisponivel = Math.max(0, arredondarBrl(arredondarBrl(saldoParaSacar) - valorReservado))
  const carteiraExibida = Math.max(0, arredondarBrl(totalComissaoCarteira - debitadoTotal - saldoDisponivel))
  const debitadoDoPendente = Math.max(0, arredondarBrl(debitadoTotal - comissaoJaRealizada))
  return {
    valorReservado,
    saldoDisponivel,
    carteiraExibida,
    aGanharExibido: Math.max(0, arredondarBrl(totalAGanar - debitadoDoPendente)),
  }
}

function validarValorSaque(saldoDisponivel, valor) {
  const v = arredondarBrl(Number(valor))
  if (!Number.isFinite(v) || v <= 0) {
    return { ok: false, message: 'Informe um valor válido maior que zero.' }
  }
  if (Math.round(v * 100) > Math.round(arredondarBrl(saldoDisponivel) * 100)) {
    return { ok: false, message: 'Saldo insuficiente' }
  }
  return { ok: true }
}

function leadEtiquetaKey(lead) {
  return `${lead.leadId}:${lead.fieldId}`
}

function buildPrestadorLeadEtiquetasMap(leads, valorSaquePendente, valorJaRetirado = 0) {
  const map = new Map()
  for (const lead of leads) {
    const tags = []
    if (lead.vendaGanha) tags.push('cliente_pagou')
    if (tags.length > 0) map.set(leadEtiquetaKey(lead), tags)
  }
  const totalSacado = arredondarBrl(valorSaquePendente + valorJaRetirado)
  if (totalSacado <= 0) return map
  const liberadas = leads
    .filter(l => l.comissaoLiberada)
    .sort((a, b) => (a.vendaRealizadaEm ?? a.criadoEm ?? '').localeCompare(b.vendaRealizadaEm ?? b.criadoEm ?? ''))
  let restanteCent = Math.round(totalSacado * 100)
  for (const lead of liberadas) {
    if (restanteCent <= 0) break
    const key = leadEtiquetaKey(lead)
    const tags = map.get(key) ?? (lead.vendaGanha ? ['cliente_pagou'] : [])
    if (!tags.includes('voce_ja_sacou')) tags.push('voce_ja_sacou')
    map.set(key, tags)
    restanteCent -= Math.round(arredondarBrl(lead.comissao) * 100)
  }
  return map
}

function isPrestadorServico(crm) {
  return crm?.tipoUsuario === 'prestador_servico' && crm?.statusConvite === 'ATIVO'
}

function isPortalOnly(movelaria, crm) {
  return isPrestadorServico(crm) && movelaria?.ativo !== true
}

function canAccessCrmPath(pathname, crm, movelaria) {
  if (pathname === '/portal-parceiro' || pathname.startsWith('/portal-parceiro/')) {
    return isPrestadorServico(crm)
  }
  if (isPortalOnly(movelaria, crm)) return false
  return true
}

describe('Épico 6 — portal do arquiteto', () => {
  it('reconhece venda ganha e perdida pelos nomes da Garbo', () => {
    assert.equal(isPortalVendaGanha('Orçamentos ganhos'), true)
    assert.equal(isPortalVendaGanha('Venda Realizada (Matriculado)'), true)
    assert.equal(isPortalVendaGanha('Orçamentos Perdidos'), false)
    assert.equal(isPortalVendaGanha('Venda Perdida'), false)
    assert.equal(isPortalVendaPerdida('Orçamentos Perdidos'), true)
    assert.equal(isPortalVendaGanha('Novo Lead'), false)
  })

  it('só abre o lead se alguma permissão foi liberada', () => {
    assert.equal(podeAbrirLeadPortal({
      podeVerDetalhes: false,
      podeVerLousa: false,
      podeVerFotos: false,
      podeVerPdfs: false,
      podeVerOrcamento: false,
    }), false)
    assert.equal(podeAbrirLeadPortal({
      podeVerDetalhes: false,
      podeVerLousa: true,
      podeVerFotos: false,
      podeVerPdfs: false,
      podeVerOrcamento: false,
    }), true)
  })

  it('reserva o saque pendente e não deixa sacar acima do saldo', () => {
    const exibido = calcSaldoExibidoPrestador(1000, 1500, 500, 0, 1000, 0, [
      { status: 'pendente', valorSolicitado: 200 },
    ])
    assert.equal(exibido.saldoDisponivel, 800)
    assert.equal(exibido.valorReservado, 200)
    assert.equal(validarValorSaque(800, 801).ok, false)
    assert.equal(validarValorSaque(800, 800).ok, true)
    assert.equal(validarValorSaque(800, 0).ok, false)
  })

  it('marca etiquetas de cliente pagou e você já sacou', () => {
    const leads = [
      {
        leadId: 1,
        fieldId: 'a',
        vendaGanha: true,
        comissaoLiberada: true,
        comissao: 400,
        vendaRealizadaEm: '2026-01-01',
        criadoEm: '2026-01-01',
      },
      {
        leadId: 2,
        fieldId: 'a',
        vendaGanha: true,
        comissaoLiberada: true,
        comissao: 400,
        vendaRealizadaEm: '2026-02-01',
        criadoEm: '2026-02-01',
      },
    ]
    const map = buildPrestadorLeadEtiquetasMap(leads, 0, 400)
    assert.deepEqual(map.get('1:a'), ['cliente_pagou', 'voce_ja_sacou'])
    assert.deepEqual(map.get('2:a'), ['cliente_pagou'])
  })

  it('parceiro sem ficha da fábrica só entra no portal; colaborador não abre essa rota', () => {
    const prestador = { tipoUsuario: 'prestador_servico', statusConvite: 'ATIVO' }
    const colaborador = { tipoUsuario: 'colaborador', statusConvite: 'ATIVO', roles: ['admin'] }
    assert.equal(isPortalOnly({ ativo: false }, prestador), true)
    assert.equal(isPortalOnly({ ativo: true }, prestador), false)
    assert.equal(canAccessCrmPath('/portal-parceiro', prestador, { ativo: false }), true)
    assert.equal(canAccessCrmPath('/portal-parceiro', colaborador, { ativo: true }), false)
    assert.equal(canAccessCrmPath('/caixa', prestador, { ativo: false }), false)
  })

  it('SQL publica as RPCs do portal e a página deixou de ser placeholder', () => {
    const sql = readSrc('supabase/migrations/176_crm_portal_arquiteto.sql')
    assert.match(sql, /movelaria_crm_portal_boot/)
    assert.match(sql, /movelaria_crm_portal_lead/)
    assert.match(sql, /movelaria_crm_portal_salvar_perfil/)
    assert.match(sql, /movelaria_crm_portal_solicitar_saque/)
    assert.match(sql, /emp_garbo\.lead_prestador_permissoes/)
    assert.match(sql, /emp_garbo\.prestador_saque_pedidos/)
    assert.match(sql, /Acesso negado ao portal do parceiro/)

    const page = readSrc('src/pages/Prestador.tsx')
    assert.equal(page.includes('conteúdo completo no Épico 6'), false)
    assert.match(page, /PrestadorRadialMenu/)
    assert.match(page, /Bem-vindo ao seu portal/)
    assert.match(page, /#2a1812/)
    assert.equal(page.includes('/caixa'), false)
    assert.equal(page.includes('AgendaObras'), false)

    const app = readSrc('src/App.tsx')
    assert.match(app, /isPortalOnly\(userProfile, crmProfile\) && gate\.ok/)
    assert.match(app, /<PrestadorSelletos \/>/)
  })

  it('menu radial tem as quatro seções do Prestador original', () => {
    const menu = readSrc('src/components/prestador/PrestadorRadialMenu.tsx')
    assert.match(menu, /id: 'portal'/)
    assert.match(menu, /id: 'perfil'/)
    assert.match(menu, /id: 'saldo'/)
    assert.match(menu, /id: 'clientes'/)
    assert.match(menu, /label: 'Portal'/)
    assert.match(menu, /label: 'Perfil'/)
    assert.match(menu, /label: 'Saldo'/)
    assert.match(menu, /label: 'Clientes'/)
    const page = readSrc('src/pages/Prestador.tsx')
    assert.match(page, /PrestadorRadialMenu/)
    assert.doesNotMatch(page, /from 'F:\\\\crm/)
  })
})
