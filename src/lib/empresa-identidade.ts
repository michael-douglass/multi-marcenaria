/**
 * Identidade da marcenaria (multi-empresa): CNPJ, endereço e nome do programa de pontos.
 * Funções puras — usadas por telas, PDFs e pela página pública. Ver docs/identidade-empresa/DESIGN.md.
 */
import { resolveBrandLogo, resolveBrandName } from '@/lib/app-branding'

/** Remove tudo que não é dígito (o banco guarda o CNPJ só com os 14 dígitos). */
export function somenteDigitos(valor?: string | null): string {
  return (valor ?? '').replace(/\D/g, '')
}

/**
 * Máscara `00.000.000/0000-00`. Aceita entrada parcial (útil no input) e devolve
 * string vazia para valor vazio.
 */
export function formatCnpj(valor?: string | null): string {
  const d = somenteDigitos(valor).slice(0, 14)
  if (!d) return ''
  if (d.length <= 2) return d
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`
}

/** Valida o CNPJ pelos dígitos verificadores (rejeita sequências repetidas). */
export function cnpjValido(valor?: string | null): boolean {
  const d = somenteDigitos(valor)
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const calc = (base: string) => {
    const pesos = base.length === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const soma = base.split('').reduce((acc, n, i) => acc + Number(n) * pesos[i], 0)
    const resto = soma % 11
    return resto < 2 ? 0 : 11 - resto
  }
  const dv1 = calc(d.slice(0, 12))
  const dv2 = calc(d.slice(0, 12) + String(dv1))
  return d.endsWith(`${dv1}${dv2}`)
}

/** Máscara `00000-000` para CEP. */
export function formatCep(valor?: string | null): string {
  const d = somenteDigitos(valor).slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

/** Telefone brasileiro: `(11) 3333-4444` ou `(11) 98888-7777`. Outros formatos voltam como vieram. */
export function formatTelefone(valor?: string | null): string {
  const d = somenteDigitos(valor)
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  return (valor ?? '').trim()
}

export interface EnderecoEmpresa {
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  cep?: string | null
}

/** "Rua X, 123 - Sala 2 - Bairro - Cidade/UF - CEP 00000-000" (partes vazias são omitidas). */
export function formatEnderecoEmpresa(e?: EnderecoEmpresa | null): string {
  if (!e) return ''
  const t = (v?: string | null) => (v ?? '').trim()
  const rua = [t(e.logradouro), t(e.numero)].filter(Boolean).join(', ')
  const cidadeUf = [t(e.cidade), t(e.uf).toUpperCase()].filter(Boolean).join('/')
  const cep = t(e.cep) ? `CEP ${formatCep(e.cep)}` : ''
  return [rua, t(e.complemento), t(e.bairro), cidadeUf, cep].filter(Boolean).join(' - ')
}

/**
 * Nome visível do programa de pontos: "Pontua {nome fantasia}". Sem nome (empresa ainda
 * carregando) devolve só "Pontua", para não piscar a marca de outra empresa.
 */
export function nomePrograma(nome?: string | null): string {
  const n = nome?.trim()
  return n ? `Pontua ${n}` : 'Pontua'
}

/**
 * Valor gravado no banco para o programa (campo personalizado / origem do lead).
 * NÃO mudar: é usado para buscar e deduplicar registros. Só a exibição é trocada.
 */
export const PONTUA_VALOR_GRAVADO = 'Pontua Garbo'

/** Troca o valor gravado `'Pontua Garbo'` pelo nome do programa da empresa (só exibição). */
export function rotuloPontua(valor: string | null | undefined, programa: string): string {
  if (valor == null) return ''
  return valor.trim().toLowerCase() === PONTUA_VALOR_GRAVADO.toLowerCase() ? programa : valor
}

/** Dados da empresa prontos para telas e PDFs (com fallbacks). */
export interface EmpresaIdentidade {
  /** Nome fantasia (= `empresas.nome`); cai no nome padrão do sistema. */
  nomeFantasia: string
  /** Razão social; cai no nome fantasia. */
  razaoSocial: string
  /** CNPJ mascarado (vazio se não cadastrado). */
  cnpjFormatado: string
  /** CNPJ só com dígitos (REP/AFD, BR Code). */
  cnpjDigitos: string
  /** Logo da empresa ou a logo padrão. */
  logoUrl: string
  /** Logo cadastrada pela empresa (null quando usa a padrão). */
  logoUrlEmpresa: string | null
  /** Endereço em uma linha. */
  endereco: string
  telefone: string
  email: string
  cidade: string
  uf: string
  /** "Pontua {nome fantasia}". */
  nomePrograma: string
}

export interface EmpresaIdentidadeFonte {
  nome?: string | null
  razaoSocial?: string | null
  cnpj?: string | null
  logoUrl?: string | null
  cep?: string | null
  logradouro?: string | null
  numero?: string | null
  complemento?: string | null
  bairro?: string | null
  cidade?: string | null
  uf?: string | null
  telefone?: string | null
  email?: string | null
}

/** Monta a identidade (pura) — usada pelo hook, pelos PDFs e por páginas públicas. */
export function montarEmpresaIdentidade(fonte?: EmpresaIdentidadeFonte | null): EmpresaIdentidade {
  const nomeFantasia = resolveBrandName(fonte?.nome)
  const logoEmpresa = fonte?.logoUrl?.trim() || null
  return {
    nomeFantasia,
    razaoSocial: fonte?.razaoSocial?.trim() || nomeFantasia,
    cnpjFormatado: formatCnpj(fonte?.cnpj),
    cnpjDigitos: somenteDigitos(fonte?.cnpj),
    logoUrl: resolveBrandLogo(logoEmpresa),
    logoUrlEmpresa: logoEmpresa,
    endereco: formatEnderecoEmpresa(fonte),
    telefone: formatTelefone(fonte?.telefone),
    email: fonte?.email?.trim() ?? '',
    cidade: fonte?.cidade?.trim() ?? '',
    uf: (fonte?.uf ?? '').trim().toUpperCase(),
    nomePrograma: nomePrograma(fonte?.nome),
  }
}

// ── Empresa ativa para geradores de PDF/recibo (fora do React) ──────────────────────────────
// Definida por `useEmpresaAtiva` sempre que a empresa carrega/muda (mesmo padrão de
// `definirInspecaoSomenteLeitura` em src/lib/supabase.ts). Os geradores aceitam um override,
// mas usam este valor como padrão — assim nenhum PDF volta a mostrar a marca de outra empresa.
let empresaDocumentoAtual: EmpresaIdentidade | null = null

export function definirEmpresaDocumento(fonte: EmpresaIdentidadeFonte | null): void {
  empresaDocumentoAtual = fonte ? montarEmpresaIdentidade(fonte) : null
}

/** Identidade da empresa ativa para documentos (fallback: nome padrão do sistema). */
export function empresaDocumento(): EmpresaIdentidade {
  return empresaDocumentoAtual ?? montarEmpresaIdentidade(null)
}

/** Nome da empresa em caixa alta, como nos cabeçalhos dos documentos ("GARBO MOVELARIA"). */
export function nomeEmpresaDocumento(): string {
  return empresaDocumento().nomeFantasia.toLocaleUpperCase('pt-BR')
}

function urlAbsoluta(u: string): string {
  if (typeof window === 'undefined' || /^(https?:|data:|blob:)/i.test(u)) return u
  return new URL(u, window.location.origin).href
}

/** URL absoluta da logo da empresa ativa para documentos (cai na logo padrão). */
export function logoDocumentoUrl(): string {
  return urlAbsoluta(empresaDocumento().logoUrl)
}

/** URL absoluta da logo padrão (fallback quando a logo da empresa não carrega no canvas). */
export function logoPadraoDocumentoUrl(): string {
  return urlAbsoluta(resolveBrandLogo(null))
}
