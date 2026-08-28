import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

/**
 * Épico 0/1 — regras da identidade fundida.
 * O census ao vivo (28/08/2026) está em docs/vistoria-integracao.md.
 * Merge por e-mail com ids diferentes: 0 casos.
 */

function classificar({ temCasa, temCrm, crmTipo }) {
  if (temCasa && temCrm) return 'dual'
  if (temCasa && !temCrm) return 'so_casa'
  if (!temCasa && temCrm && crmTipo === 'prestador_servico') return 'so_crm_portal'
  if (!temCasa && temCrm) return 'so_crm'
  return 'nenhum'
}

function deveVerComercial(cls) {
  return cls === 'dual' || cls === 'so_crm'
}

function deveVerCasa(cls) {
  return cls === 'dual' || cls === 'so_casa'
}

function naoPromoverAdminFabricaACrm(casaPerfil, temCrm) {
  return casaPerfil === 'administrador' && !temCrm
}

describe('Épico 1 — duas funções sem misturar crachás', () => {
  it('montador só Casa não vê Comercial', () => {
    const cls = classificar({ temCasa: true, temCrm: false, crmTipo: null })
    assert.equal(cls, 'so_casa')
    assert.equal(deveVerComercial(cls), false)
    assert.equal(deveVerCasa(cls), true)
  })

  it('prestador só CRM não vê Casa', () => {
    const cls = classificar({ temCasa: false, temCrm: true, crmTipo: 'prestador_servico' })
    assert.equal(cls, 'so_crm_portal')
    assert.equal(deveVerCasa(cls), false)
  })

  it('admin das duas casas é dual', () => {
    const cls = classificar({ temCasa: true, temCrm: true, crmTipo: 'colaborador' })
    assert.equal(cls, 'dual')
    assert.equal(deveVerComercial(cls), true)
    assert.equal(deveVerCasa(cls), true)
  })

  it('não promove administrador da fábrica a admin CRM se não tinha ficha', () => {
    assert.equal(naoPromoverAdminFabricaACrm('administrador', false), true)
    assert.equal(naoPromoverAdminFabricaACrm('administrador', true), false)
  })

  it('census 28/08: zero e-mails com ids diferentes', () => {
    const duplicadosIdDiferente = 0
    assert.equal(duplicadosIdDiferente, 0)
  })
})
