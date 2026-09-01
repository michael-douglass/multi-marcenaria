import { supabase } from '@/lib/supabase'
import {
  isSchemaApiExposed,
  MASTER_TABLES,
  resolveEmpresaTableNames,
  resolveLeadsQueryConfig,
} from '@/lib/empresa-tables'
import { stripWhitespace } from '@/lib/qr/copy-text'

export interface CaixaDestinatarioContato {
  nomeExibicao: string
  nomePessoa: string
  origem: string | null
  telefone: string | null
  endereco: string | null
  email: string | null
  chavePix: string | null
  tipoChavePix: string | null
  avatarUrl: string | null
}

function normalizeNome(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Tira o prefixo "Comissão:" / "Fixo montador:" e devolve só o nome da pessoa. */
export function extractNomePessoaDestinatario(destinatarioNome: string): string {
  return destinatarioNome
    .replace(/^(comiss[aã]o|fixo montador|fixo)\s*:\s*/i, '')
    .trim()
}

function nomesBatemos(a: string, b: string): boolean {
  const na = normalizeNome(a)
  const nb = normalizeNome(b)
  if (!na || !nb) return false
  return na === nb || na.includes(nb) || nb.includes(na)
}

function pickPixFromDadosBancarios(raw: unknown): string | null {
  if (typeof raw === 'string' && raw.trim()) return raw.trim()
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  for (const key of ['pix', 'chave_pix', 'chave', 'pix_chave', 'chavePix']) {
    const value = o[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return null
}

function compactPixKey(chave: string): string {
  const noSpace = stripWhitespace(chave)
  if (/^[\d.\-\/]+$/.test(noSpace)) return noSpace.replace(/\D/g, '')
  return noSpace
}

function asText(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const t = value.trim()
  return t.length > 0 ? t : null
}

function prefer(current: string | null, next: string | null | undefined): string | null {
  if (current) return current
  const t = asText(next)
  return t
}

interface UsuarioRow {
  id: string
  nome: string
  telefone?: string | null
  email?: string | null
  endereco?: string | null
  chave_pix?: string | null
  tipo_chave_pix?: string | null
  avatar_url?: string | null
}

interface FuncionarioRow {
  nome: string
  telefone?: string | null
  email?: string | null
  cpf?: string | null
  admissao_dados?: { endereco?: string | null } | null
}

interface FornecedorRow {
  nome: string
  telefone?: string | null
  email?: string | null
  cnpj_cpf?: string | null
}

interface ClienteRow {
  nome: string
  telefone?: string | null
  email?: string | null
  endereco?: string | null
  cpf?: string | null
}

interface LeadRow {
  nome: string
  telefone?: string | null
  email?: string | null
  empresa?: string | null
  regiao?: string | null
}

export async function buscarContatoDestinatario(params: {
  destinatarioNome: string
  destinatarioId: string
  schemaEmpresa?: string | null
}): Promise<CaixaDestinatarioContato> {
  const nomePessoa = extractNomePessoaDestinatario(params.destinatarioNome)
  const contato: CaixaDestinatarioContato = {
    nomeExibicao: params.destinatarioNome,
    nomePessoa,
    origem: null,
    telefone: null,
    endereco: null,
    email: null,
    chavePix: null,
    tipoChavePix: null,
    avatarUrl: null,
  }

  const virtual = params.destinatarioId.startsWith('__virtual__:')
  const tables = resolveEmpresaTableNames(params.schemaEmpresa)
  const leadsConfig = resolveLeadsQueryConfig(params.schemaEmpresa)

  const settled = await Promise.allSettled([
    virtual
      ? Promise.resolve({ data: null as { dados_bancarios?: unknown } | null })
      : supabase
          .from('movelaria_caixa_destinatarios')
          .select('dados_bancarios, observacoes')
          .eq('id', params.destinatarioId)
          .maybeSingle(),
    supabase
      .from('movelaria_funcionarios')
      .select('nome, telefone, email, cpf, admissao_dados')
      .eq('ativo', true),
    supabase.from('movelaria_fornecedores').select('nome, telefone, email, cnpj_cpf'),
    supabase.from('movelaria_clientes').select('nome, telefone, email, endereco, cpf'),
    supabase
      .from('movelaria_contas_pagar')
      .select('prestador_id, fornecedor_nome')
      .eq('fornecedor_nome', params.destinatarioNome)
      .not('prestador_id', 'is', null)
      .limit(8),
  ])

  const destRes = settled[0].status === 'fulfilled' ? settled[0].value : { data: null }
  const funcRes = settled[1].status === 'fulfilled' ? settled[1].value : { data: null }
  const fornRes = settled[2].status === 'fulfilled' ? settled[2].value : { data: null }
  const cliRes = settled[3].status === 'fulfilled' ? settled[3].value : { data: null }
  const contasRes = settled[4].status === 'fulfilled' ? settled[4].value : { data: null }

  const pixDest = pickPixFromDadosBancarios(destRes.data?.dados_bancarios)
  if (pixDest) {
    contato.chavePix = pixDest
    contato.origem = contato.origem ?? 'Destinatário do caixa'
  }

  const prestadorIds = [
    ...new Set(
      (contasRes.data ?? [])
        .map(row => (typeof row.prestador_id === 'string' ? row.prestador_id : null))
        .filter((id): id is string => Boolean(id)),
    ),
  ]

  let usuarios: UsuarioRow[] = []
  try {
    const empresaDb = isSchemaApiExposed(params.schemaEmpresa)
      ? supabase.schema(params.schemaEmpresa)
      : supabase
    const usuariosSelect =
      'id, nome, telefone, email, endereco, chave_pix, tipo_chave_pix, avatar_url'
    const { data: usuariosFull, error: usuariosErr } = await empresaDb
      .from(tables.usuarios)
      .select(usuariosSelect)

    if (usuariosErr) {
      const { data: usuariosMin } = await empresaDb
        .from(tables.usuarios)
        .select('id, nome, telefone, email, avatar_url')
      usuarios = (usuariosMin ?? []) as UsuarioRow[]
    } else {
      usuarios = (usuariosFull ?? []) as UsuarioRow[]
    }
  } catch {
    usuarios = []
  }

  const usuarioPorId = prestadorIds
    .map(id => usuarios.find(u => u.id === id))
    .find(Boolean)

  const usuarioPorNome = usuarios.find(u => nomesBatemos(u.nome, nomePessoa))
  const usuario = usuarioPorId ?? usuarioPorNome

  if (usuario) {
    contato.origem = 'Cadastro da pessoa'
    contato.telefone = prefer(contato.telefone, usuario.telefone)
    contato.email = prefer(contato.email, usuario.email)
    contato.endereco = prefer(contato.endereco, usuario.endereco)
    contato.chavePix = prefer(contato.chavePix, usuario.chave_pix)
    contato.tipoChavePix = prefer(contato.tipoChavePix, usuario.tipo_chave_pix)
    contato.avatarUrl = prefer(contato.avatarUrl, usuario.avatar_url)
  }

  const funcionario = ((funcRes.data ?? []) as FuncionarioRow[]).find(f =>
    nomesBatemos(f.nome, nomePessoa),
  )
  if (funcionario) {
    contato.origem = contato.origem ?? 'Equipe'
    contato.telefone = prefer(contato.telefone, funcionario.telefone)
    contato.email = prefer(contato.email, funcionario.email)
    contato.endereco = prefer(contato.endereco, funcionario.admissao_dados?.endereco)
    if (!contato.chavePix && funcionario.cpf) {
      const cpfDigits = funcionario.cpf.replace(/\D/g, '')
      if (cpfDigits.length === 11) {
        contato.chavePix = cpfDigits
        contato.tipoChavePix = contato.tipoChavePix ?? 'cpf'
      }
    }
  }

  const fornecedor = ((fornRes.data ?? []) as FornecedorRow[]).find(f =>
    nomesBatemos(f.nome, nomePessoa) || nomesBatemos(f.nome, params.destinatarioNome),
  )
  if (fornecedor) {
    contato.origem = contato.origem ?? 'Fornecedor'
    contato.telefone = prefer(contato.telefone, fornecedor.telefone)
    contato.email = prefer(contato.email, fornecedor.email)
    if (!contato.chavePix && fornecedor.cnpj_cpf) {
      const doc = fornecedor.cnpj_cpf.replace(/\D/g, '')
      if (doc.length === 11 || doc.length === 14) {
        contato.chavePix = doc
        contato.tipoChavePix = contato.tipoChavePix ?? (doc.length === 14 ? 'cnpj' : 'cpf')
      }
    }
  }

  const cliente = ((cliRes.data ?? []) as ClienteRow[]).find(c =>
    nomesBatemos(c.nome, nomePessoa),
  )
  if (cliente) {
    contato.origem = contato.origem ?? 'Cliente'
    contato.telefone = prefer(contato.telefone, cliente.telefone)
    contato.email = prefer(contato.email, cliente.email)
    contato.endereco = prefer(contato.endereco, cliente.endereco)
    if (!contato.chavePix && cliente.cpf) {
      const cpfDigits = cliente.cpf.replace(/\D/g, '')
      if (cpfDigits.length === 11) {
        contato.chavePix = cpfDigits
        contato.tipoChavePix = contato.tipoChavePix ?? 'cpf'
      }
    }
  }

  try {
    const leadsTable = leadsConfig.leadsTable || MASTER_TABLES.leads
    const leadsDb = leadsConfig.schema ? supabase.schema(leadsConfig.schema) : supabase
    const { data: leads } = await leadsDb
      .from(leadsTable)
      .select('nome, telefone, email, empresa, regiao')
      .limit(400)

    const lead = ((leads ?? []) as LeadRow[]).find(l => nomesBatemos(l.nome, nomePessoa))
    if (lead) {
      contato.origem = contato.origem ?? 'Lead'
      contato.telefone = prefer(contato.telefone, lead.telefone)
      contato.email = prefer(contato.email, lead.email)
      contato.endereco = prefer(
        contato.endereco,
        [lead.empresa, lead.regiao].filter(Boolean).join(' · ') || null,
      )
    }
  } catch {
    // lead é extra — se a tabela não responder, o restante do painel segue
  }

  if (contato.chavePix) {
    contato.chavePix = compactPixKey(contato.chavePix)
  }

  return contato
}
