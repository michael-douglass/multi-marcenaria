import { CRM_ROLE_LABEL, CRM_TIPO_LABEL } from '@/lib/crm-identity'
import type { UsuarioAdmin } from '@/hooks/useUsuarios'

/** Rótulo bonito para o perfil de login da Movelaria. */
export const MOVELARIA_PERFIL_LABEL: Record<string, string> = {
  administrador: 'Administrador',
  financeiro: 'Financeiro',
  marceneiro: 'Marceneiro',
  montador: 'Montador',
  montador_admin: 'Montador Admin',
  administrador_obras: 'Administrador de Obras',
  visualizador: 'Visualizador',
}

export type UsuarioOrigem = 'movelaria' | 'crm' | 'ambos'
export type UsuarioOrigemFiltro = UsuarioOrigem | 'todas'

export const USUARIO_ORIGEM_LABEL: Record<UsuarioOrigem, string> = {
  movelaria: 'Movelaria',
  crm: 'CRM',
  ambos: 'Movelaria + CRM',
}

export interface UsuarioOpcao {
  id: string
  nome: string
  email: string
  origem: UsuarioOrigem
  /** Perfis/roles da pessoa, já em rótulo legível. */
  acessos: string[]
  ativo: boolean
  /** Bate com o perfil de login que o tipo da pasta espera. */
  recomendado: boolean
  score: number
}

export function normalizeUsuarioBusca(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}@.\s-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim()
}

/** Tem ficha no CRM (emp_garbo), mesmo sem tipo definido. */
export function temAcessoCrm(u: UsuarioAdmin): boolean {
  return Boolean(u.crm_tipo_usuario || u.crm_status_convite || u.crm_roles.length > 0)
}

export function usuarioOrigem(u: UsuarioAdmin): UsuarioOrigem {
  const crm = temAcessoCrm(u)
  if (u.tem_movelaria && crm) return 'ambos'
  return crm ? 'crm' : 'movelaria'
}

export function usuarioAcessos(u: UsuarioAdmin): string[] {
  const acessos: string[] = []
  if (u.perfil) acessos.push(MOVELARIA_PERFIL_LABEL[u.perfil] ?? u.perfil)
  for (const extra of u.perfis_extras) {
    const label = MOVELARIA_PERFIL_LABEL[extra] ?? extra
    if (!acessos.includes(label)) acessos.push(label)
  }
  for (const role of u.crm_roles) {
    const label = CRM_ROLE_LABEL[role] ?? role
    if (!acessos.includes(label)) acessos.push(label)
  }
  if (acessos.length === 0 && u.crm_tipo_usuario) {
    acessos.push(CRM_TIPO_LABEL[u.crm_tipo_usuario])
  }
  return acessos
}

export function usuarioBatePerfil(u: UsuarioAdmin, perfilEsperado: string | undefined): boolean {
  if (!perfilEsperado) return false
  return u.perfil === perfilEsperado || u.perfis_extras.includes(perfilEsperado)
}

export function toUsuarioOpcao(u: UsuarioAdmin, perfilEsperado?: string): UsuarioOpcao {
  return {
    id: u.id,
    nome: u.nome?.trim() || u.email || 'Sem nome',
    email: u.email,
    origem: usuarioOrigem(u),
    acessos: usuarioAcessos(u),
    ativo: u.ativo,
    recomendado: usuarioBatePerfil(u, perfilEsperado),
    score: 0,
  }
}

/** Tudo que o usuário pode digitar para achar a pessoa. */
function palheiro(u: UsuarioAdmin, opcao: UsuarioOpcao): string {
  return normalizeUsuarioBusca(
    [
      opcao.nome,
      opcao.email,
      USUARIO_ORIGEM_LABEL[opcao.origem],
      ...opcao.acessos,
      u.perfil,
      ...u.perfis_extras,
      ...u.crm_roles,
      u.crm_tipo_usuario ?? '',
      opcao.ativo ? 'ativo' : 'inativo',
    ]
      .filter(Boolean)
      .join(' '),
  )
}

function scoreTermo(termo: string, hay: string, palavras: string[]): number {
  if (!termo) return 0
  if (palavras.includes(termo)) return 100
  if (palavras.some(p => p.startsWith(termo))) return 80
  if (hay.startsWith(termo)) return 75
  if (termo.length >= 3 && hay.includes(termo)) return 45
  return 0
}

/** 0 = não serve. Todo termo digitado precisa casar em algum lugar. */
export function scoreUsuarioBusca(query: string, hay: string): number {
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

export interface UsuarioBuscaOpts {
  /** Perfil de login que o tipo da pasta espera (marca "recomendado"). */
  perfilEsperado?: string
  query?: string
  origem?: UsuarioOrigemFiltro
  incluirInativos?: boolean
  /** Quem já está vinculado nunca desaparece da lista. */
  manterId?: string | null
  limite?: number
}

export function buscarUsuarios(
  usuarios: UsuarioAdmin[],
  opts: UsuarioBuscaOpts = {},
): UsuarioOpcao[] {
  const {
    perfilEsperado,
    query = '',
    origem = 'todas',
    incluirInativos = false,
    manterId = null,
    limite = 80,
  } = opts

  const achados: UsuarioOpcao[] = []
  for (const u of usuarios) {
    const fixo = manterId != null && u.id === manterId
    const opcao = toUsuarioOpcao(u, perfilEsperado)
    if (!fixo) {
      if (!incluirInativos && !opcao.ativo) continue
      if (origem !== 'todas' && opcao.origem !== origem && opcao.origem !== 'ambos') continue
    }
    const score = scoreUsuarioBusca(query, palheiro(u, opcao))
    if (score === 0 && !fixo) continue
    achados.push({ ...opcao, score })
  }

  const temQuery = normalizeUsuarioBusca(query).length > 0
  achados.sort((a, b) => {
    if (a.ativo !== b.ativo) return a.ativo ? -1 : 1
    if (temQuery && a.score !== b.score) return b.score - a.score
    if (a.recomendado !== b.recomendado) return a.recomendado ? -1 : 1
    return a.nome.localeCompare(b.nome, 'pt-BR')
  })

  return achados.slice(0, limite)
}

export interface UsuarioOrigemContagem {
  todas: number
  movelaria: number
  crm: number
}

/** Números dos chips de origem (quem está nos dois conta nos dois). */
export function contarUsuariosPorOrigem(
  usuarios: UsuarioAdmin[],
  incluirInativos = false,
): UsuarioOrigemContagem {
  const contagem: UsuarioOrigemContagem = { todas: 0, movelaria: 0, crm: 0 }
  for (const u of usuarios) {
    if (!incluirInativos && !u.ativo) continue
    contagem.todas += 1
    const origem = usuarioOrigem(u)
    if (origem === 'movelaria' || origem === 'ambos') contagem.movelaria += 1
    if (origem === 'crm' || origem === 'ambos') contagem.crm += 1
  }
  return contagem
}
