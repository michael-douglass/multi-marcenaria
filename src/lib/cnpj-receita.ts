/**
 * Consulta de CNPJ na Receita Federal (dados públicos), direto do navegador.
 * 1º BrasilAPI (`/api/cnpj/v1`), 2º publica.cnpj.ws. As duas aceitam CORS e não pedem chave.
 * Ver docs/identidade-empresa/DESIGN.md §3.
 */
import { cnpjValido, somenteDigitos } from '@/lib/empresa-identidade'

export interface DadosReceita {
  cnpj: string
  razaoSocial: string
  /** Vazio quando a Receita não tem nome fantasia. */
  nomeFantasia: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  cidade: string
  uf: string
  /** Só dígitos, com DDD. */
  telefone: string
  email: string
  /** Ex.: "ATIVA", "BAIXADA", "INAPTA". */
  situacao: string
  fonte: 'brasilapi' | 'cnpjws'
}

/** A consulta falhou nas duas fontes (rede, limite de requisições, fora do ar). */
export class CnpjReceitaIndisponivel extends Error {
  constructor(message = 'Não foi possível consultar a Receita agora. Preencha os dados manualmente.') {
    super(message)
    this.name = 'CnpjReceitaIndisponivel'
  }
}

const TIMEOUT_MS = 8000

type Json = Record<string, unknown>

const txt = (v: unknown) => (typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '')

async function buscarJson(url: string): Promise<{ status: number; body: Json | null }> {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    const body = res.ok ? ((await res.json()) as Json) : null
    return { status: res.status, body }
  } finally {
    clearTimeout(timer)
  }
}

function juntarLogradouro(tipo: string, logradouro: string): string {
  if (!tipo) return logradouro
  if (logradouro.toUpperCase().startsWith(tipo.toUpperCase())) return logradouro
  return `${tipo} ${logradouro}`.trim()
}

/** Mapeia a resposta da BrasilAPI (exportado para o teste). */
export function mapBrasilApi(b: Json): DadosReceita {
  return {
    cnpj: somenteDigitos(txt(b.cnpj)),
    razaoSocial: txt(b.razao_social),
    nomeFantasia: txt(b.nome_fantasia),
    cep: somenteDigitos(txt(b.cep)),
    logradouro: juntarLogradouro(txt(b.descricao_tipo_de_logradouro), txt(b.logradouro)),
    numero: txt(b.numero),
    complemento: txt(b.complemento),
    bairro: txt(b.bairro),
    cidade: txt(b.municipio),
    uf: txt(b.uf).toUpperCase(),
    telefone: somenteDigitos(txt(b.ddd_telefone_1)),
    email: txt(b.email).toLowerCase(),
    situacao: txt(b.descricao_situacao_cadastral).toUpperCase(),
    fonte: 'brasilapi',
  }
}

/** Mapeia a resposta de publica.cnpj.ws (exportado para o teste). */
export function mapCnpjWs(b: Json): DadosReceita {
  const est = (b.estabelecimento ?? {}) as Json
  const cidade = (est.cidade ?? {}) as Json
  const estado = (est.estado ?? {}) as Json
  return {
    cnpj: somenteDigitos(txt(est.cnpj)),
    razaoSocial: txt(b.razao_social),
    nomeFantasia: txt(est.nome_fantasia),
    cep: somenteDigitos(txt(est.cep)),
    logradouro: juntarLogradouro(txt(est.tipo_logradouro), txt(est.logradouro)),
    numero: txt(est.numero),
    complemento: txt(est.complemento),
    bairro: txt(est.bairro),
    cidade: txt(cidade.nome),
    uf: txt(estado.sigla).toUpperCase(),
    telefone: somenteDigitos(`${txt(est.ddd1)}${txt(est.telefone1)}`),
    email: txt(est.email).toLowerCase(),
    situacao: txt(est.situacao_cadastral).toUpperCase(),
    fonte: 'cnpjws',
  }
}

/**
 * Busca o CNPJ na Receita.
 * - CNPJ inválido → `null` (sem chamar a rede).
 * - CNPJ inexistente (404 nas fontes) → `null`.
 * - Fontes indisponíveis → lança `CnpjReceitaIndisponivel`.
 */
export async function consultarCnpjReceita(cnpj: string): Promise<DadosReceita | null> {
  const d = somenteDigitos(cnpj)
  if (!cnpjValido(d)) return null

  let naoEncontrado = false
  try {
    const r = await buscarJson(`https://brasilapi.com.br/api/cnpj/v1/${d}`)
    if (r.body) return mapBrasilApi(r.body)
    if (r.status === 404) naoEncontrado = true
  } catch {
    /* timeout/rede: tenta a segunda fonte */
  }

  try {
    const r = await buscarJson(`https://publica.cnpj.ws/cnpj/${d}`)
    if (r.body) return mapCnpjWs(r.body)
    if (r.status === 404 || r.status === 400) return null
  } catch {
    /* timeout/rede */
  }

  if (naoEncontrado) return null
  throw new CnpjReceitaIndisponivel()
}
