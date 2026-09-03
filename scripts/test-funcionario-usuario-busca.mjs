import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'

const readSrc = (rel) => readFileSync(new URL(`../${rel}`, import.meta.url), 'utf8')

// Espelho da lógica pura de src/lib/funcionario-usuario-busca.ts
function normalizeUsuarioBusca(text) {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}@.\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()
}

function scoreTermo(termo, hay, palavras) {
  if (!termo) return 0
  if (palavras.includes(termo)) return 100
  if (palavras.some((p) => p.startsWith(termo))) return 80
  if (hay.startsWith(termo)) return 75
  if (termo.length >= 3 && hay.includes(termo)) return 45
  return 0
}

function scoreUsuarioBusca(query, hay) {
  const termos = normalizeUsuarioBusca(query).split(' ').filter(Boolean)
  if (termos.length === 0) return 1
  const palavras = hay.split(/[^\p{L}\p{N}@.]+/u).filter(Boolean)
  let total = 0
  for (const termo of termos) {
    const parcial = scoreTermo(termo, hay, palavras)
    if (parcial === 0) return 0
    total += parcial
  }
  return Math.round(total / termos.length)
}

function temAcessoCrm(u) {
  return Boolean(u.crm_tipo_usuario || u.crm_status_convite || (u.crm_roles ?? []).length > 0)
}

function usuarioOrigem(u) {
  const crm = temAcessoCrm(u)
  if (u.tem_movelaria && crm) return 'ambos'
  return crm ? 'crm' : 'movelaria'
}

const USUARIOS = [
  {
    id: 'u-mov',
    nome: 'João Pedro Braga',
    email: 'joao@garbo.com',
    perfil: 'montador',
    perfis_extras: [],
    ativo: true,
    tem_movelaria: true,
    crm_tipo_usuario: null,
    crm_status_convite: null,
    crm_roles: [],
  },
  {
    id: 'u-crm',
    nome: 'Ana Arquiteta',
    email: 'ana@parceira.com',
    perfil: '',
    perfis_extras: [],
    ativo: true,
    tem_movelaria: false,
    crm_tipo_usuario: 'prestador_servico',
    crm_status_convite: 'ATIVO',
    crm_roles: ['vendedor'],
  },
  {
    id: 'u-ambos',
    nome: 'Fábio Faria',
    email: 'fabio@garbo.com',
    perfil: 'administrador',
    perfis_extras: [],
    ativo: true,
    tem_movelaria: true,
    crm_tipo_usuario: 'colaborador',
    crm_status_convite: 'ATIVO',
    crm_roles: ['admin'],
  },
]

describe('origem do usuário do sistema', () => {
  it('separa Movelaria, CRM e quem está nos dois', () => {
    assert.equal(usuarioOrigem(USUARIOS[0]), 'movelaria')
    assert.equal(usuarioOrigem(USUARIOS[1]), 'crm')
    assert.equal(usuarioOrigem(USUARIOS[2]), 'ambos')
  })

  it('usuário só do CRM não é mais tratado como sem acesso', () => {
    const crm = USUARIOS[1]
    assert.equal(crm.tem_movelaria, false)
    assert.equal(crm.perfil, '')
    // O filtro antigo (tem_movelaria || perfil) sumia com ele.
    assert.equal(usuarioOrigem(crm), 'crm')
  })
})

describe('busca de usuário na pasta do funcionário', () => {
  it('acha por nome com acento e maiúscula', () => {
    assert.ok(scoreUsuarioBusca('FABIO', normalizeUsuarioBusca('Fábio Faria fabio@garbo.com')) > 0)
    assert.ok(scoreUsuarioBusca('fábio', normalizeUsuarioBusca('Fabio Faria')) > 0)
  })

  it('acha por e-mail e por domínio', () => {
    const hay = normalizeUsuarioBusca('Ana Arquiteta ana@parceira.com CRM Vendedor')
    assert.ok(scoreUsuarioBusca('ana@parceira.com', hay) > 0)
    assert.ok(scoreUsuarioBusca('parceira', hay) > 0)
  })

  it('acha por perfil e por origem', () => {
    const hay = normalizeUsuarioBusca('João Pedro Braga joao@garbo.com Movelaria Montador montador')
    assert.ok(scoreUsuarioBusca('montador', hay) > 0)
    assert.ok(scoreUsuarioBusca('movelaria', hay) > 0)
    assert.equal(scoreUsuarioBusca('crm', hay), 0)
  })

  it('exige que todos os termos casem', () => {
    const hay = normalizeUsuarioBusca('Fábio Faria administrador Movelaria + CRM')
    assert.ok(scoreUsuarioBusca('fabio admin', hay) > 0)
    assert.equal(scoreUsuarioBusca('fabio montador', hay), 0)
  })

  it('nome exato pontua mais que pedaço no meio', () => {
    const hay = normalizeUsuarioBusca('Ana Arquiteta ana@parceira.com')
    const inicio = scoreUsuarioBusca('ana', hay)
    const meio = scoreUsuarioBusca('quitet', hay)
    assert.ok(inicio > meio)
  })

  it('query vazia devolve todo mundo', () => {
    assert.equal(scoreUsuarioBusca('', 'qualquer coisa'), 1)
    assert.equal(scoreUsuarioBusca('   ', 'qualquer coisa'), 1)
  })
})

describe('painel de vínculos', () => {
  const panel = readSrc('src/components/funcionarios/FuncionarioVinculosPanel.tsx')
  const select = readSrc('src/components/funcionarios/FuncionarioUsuarioSelect.tsx')

  it('usa o buscador em vez do select nativo', () => {
    assert.match(panel, /FuncionarioUsuarioSelect/)
    assert.doesNotMatch(panel, /<select/)
  })

  it('não filtra mais por tem_movelaria antes de listar', () => {
    assert.doesNotMatch(panel, /tem_movelaria/)
  })

  it('o buscador recebe a lista inteira de identidades', () => {
    assert.match(panel, /usuarios=\{usuarios\}/)
    assert.match(select, /buscarUsuarios\(usuarios, \{/)
  })

  it('tem campo de busca acessível com listbox', () => {
    assert.match(select, /role="combobox"/)
    assert.match(select, /role="listbox"/)
    assert.match(select, /aria-activedescendant/)
    assert.match(select, /ArrowDown/)
  })

  it('a lista fica acima do cartão de contas a pagar', () => {
    const css = readSrc('src/index.css')
    // .glass-card usa backdrop-filter: sem levantar o cartão da vez, o cartão
    // seguinte desenha por cima da lista aberta.
    assert.match(css, /\.glass-card:has\(\.fn-user-pick__panel\)\s*\{[^}]*z-index/)
  })

  it('quem já está vinculado nunca desaparece da lista', () => {
    const lib = readSrc('src/lib/funcionario-usuario-busca.ts')
    assert.match(lib, /manterId/)
    assert.match(select, /manterId: value/)
  })
})
