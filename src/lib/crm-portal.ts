import type { CrmLousaDrawing, CrmLousaImage } from '@/lib/crm-lousa'

export type TipoChavePix = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria'

export const TIPO_PIX_LABELS: Record<TipoChavePix, string> = {
  cpf: 'CPF',
  cnpj: 'CNPJ',
  email: 'E-mail',
  telefone: 'Telefone',
  aleatoria: 'Chave Aleatória',
}

export interface PortalPerfil {
  id: string
  nome: string
  email: string | null
  telefone: string | null
  avatarUrl: string | null
  titulo: string
  comissaoAtiva: boolean
  chavePix: string | null
  tipoChavePix: TipoChavePix
}

export interface PortalPermissao {
  leadId: number
  prestadorId: string
  podeVerDetalhes: boolean
  podeVerLousa: boolean
  podeVerAnotacoes: boolean
  podeVerAnexos: boolean
  podeVerFotos: boolean
  podeVerPdfs: boolean
  anexosVisiveis: string[] | null
  podeVerOrcamento: boolean
  orcamentosVisiveis: string[] | null
}

export interface PortalComissaoLead {
  leadId: number
  leadNome: string
  leadStatus: string
  valorOrcamento: number
  fieldId: string
  fieldNome: string
  percentual: number
  comissao: number
  vendaGanha: boolean
  comissaoLiberada: boolean
  comissaoAguardandoLiberacao: boolean
  liberacaoId: string | null
  vendaRealizadaEm: string | null
  dataChegada: string | null
  criadoEm: string | null
  leadEmail: string | null
  leadTelefone: string | null
  leadEmpresa: string | null
  leadOrigem: string | null
  leadRegiao: string | null
  churned: boolean
}

export interface PortalSaque {
  id: string
  valorSolicitado: number
  chavePix: string
  tipoChavePix: string
  status: 'pendente' | 'aprovado' | 'rejeitado' | string
  obsAdmin: string | null
  criadoEm: string | null
  processadoEm: string | null
}

export interface PortalLancamento {
  id: string
  tipo: string
  valor: number
  descricao: string | null
  criadoEm: string | null
}

export interface PortalTitulo {
  id: string
  nome: string
}

export interface PortalGanhoMes {
  key: string
  label: string
  valor: number
}

export interface PortalResumo {
  leads: PortalComissaoLead[]
  churnedLeads: PortalComissaoLead[]
  totalAGanar: number
  totalComissaoCarteira: number
  totalComissaoGanha: number
  totalAguardandoLiberacao: number
  ganhoMesAtual: number
  mediaMensalGanhos: number
  ganhosPorMes: PortalGanhoMes[]
  totalAjustes: number
  totalRetirado: number
  saldoParaSacar: number
  totalComissao: number
}

export interface PortalBoot {
  perfil: PortalPerfil
  resumo: PortalResumo
  permissoes: PortalPermissao[]
  saques: PortalSaque[]
  lancamentos: PortalLancamento[]
  titulos: PortalTitulo[]
}

export interface PortalLeadDetalhe {
  lead: {
    id: number
    nome: string
    empresa: string | null
    email: string | null
    telefone: string | null
    origem: string | null
    status: string
    valorOrcamento: number
    valorNegocio: number
    dataChegada: string | null
    regiao: string | null
    observacoes: string | null
  } | null
  podeVerDetalhes: boolean
  podeVerLousa: boolean
  podeVerAnotacoes: boolean
  podeVerFotos: boolean
  podeVerPdfs: boolean
  podeVerOrcamento: boolean
  lousaImages: CrmLousaImage[]
  lousaDrawings: CrmLousaDrawing[]
  slides: Array<{ id: string; identificador: string; clienteNome: string; status: string }>
}

const EMPTY_PERFIL: PortalPerfil = {
  id: '',
  nome: '',
  email: null,
  telefone: null,
  avatarUrl: null,
  titulo: 'Prestador de Serviço',
  comissaoAtiva: false,
  chavePix: null,
  tipoChavePix: 'cpf',
}

export function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function asBool(value: unknown): boolean {
  return value === true
}

export function arredondarBrl(value: number): number {
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100) / 100
}

export function isPortalVendaGanha(status: string | null | undefined): boolean {
  const s = (status ?? '').trim()
  if (!s || /perdid/i.test(s)) return false
  return /venda realizada/i.test(s) || /ganh/i.test(s)
}

export function isPortalVendaPerdida(status: string | null | undefined): boolean {
  return /perdid/i.test((status ?? '').trim())
}

export function resolveValorBaseComissao(
  status: string,
  valorOrcamento: number,
  valorNegocio: number,
): number {
  if (isPortalVendaGanha(status)) return valorNegocio > 0 ? valorNegocio : valorOrcamento
  return valorOrcamento
}

export function normalizePermissao(
  found: Partial<PortalPermissao> | undefined,
  leadId: number,
  prestadorId: string,
): PortalPermissao {
  const legadoAnexos = found?.podeVerAnexos === true
  const fotos = found?.podeVerFotos ?? legadoAnexos
  const pdfs = found?.podeVerPdfs ?? legadoAnexos
  return {
    leadId,
    prestadorId,
    podeVerDetalhes: found?.podeVerDetalhes === true,
    podeVerLousa: found?.podeVerLousa === true,
    podeVerAnotacoes: found?.podeVerAnotacoes === true,
    podeVerFotos: fotos,
    podeVerPdfs: pdfs,
    podeVerAnexos: found?.podeVerAnexos === true || fotos || pdfs,
    anexosVisiveis: found?.anexosVisiveis ?? null,
    podeVerOrcamento: found?.podeVerOrcamento === true,
    orcamentosVisiveis: found?.orcamentosVisiveis ?? null,
  }
}

export function podeAbrirLeadPortal(perm: PortalPermissao): boolean {
  return perm.podeVerDetalhes || perm.podeVerLousa || perm.podeVerFotos || perm.podeVerPdfs || perm.podeVerOrcamento
}

export function parsePermissaoRow(raw: unknown, fallbackPrestadorId: string): PortalPermissao {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const leadId = asNumber(row.lead_id)
  const prestadorId = asText(row.prestador_id) || fallbackPrestadorId
  return normalizePermissao({
    leadId,
    prestadorId,
    podeVerDetalhes: asBool(row.pode_ver_detalhes),
    podeVerLousa: asBool(row.pode_ver_lousa),
    podeVerAnotacoes: asBool(row.pode_ver_anotacoes),
    podeVerAnexos: asBool(row.pode_ver_anexos),
    podeVerFotos: typeof row.pode_ver_fotos === 'boolean' ? row.pode_ver_fotos : undefined,
    podeVerPdfs: typeof row.pode_ver_pdfs === 'boolean' ? row.pode_ver_pdfs : undefined,
    anexosVisiveis: Array.isArray(row.anexos_visiveis) ? row.anexos_visiveis.map(String) : null,
    podeVerOrcamento: asBool(row.pode_ver_orcamento),
    orcamentosVisiveis: Array.isArray(row.orcamentos_visiveis) ? row.orcamentos_visiveis.map(String) : null,
  }, leadId, prestadorId)
}

const MESES_PT = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'] as const

function monthKeyFromDate(isoDate: string): string {
  return isoDate.slice(0, 7)
}

function labelFromMonthKey(key: string): string {
  const [y, m] = key.split('-')
  const idx = Number(m) - 1
  if (!y || idx < 0 || idx > 11) return key
  return `${MESES_PT[idx]}/${y.slice(2)}`
}

export function buildPortalResumoFinanceiro(
  vendasGanhasLiberadas: Array<{ comissao: number; vendaRealizadaEm: string | null }>,
  comissaoPendente: number,
  totalAjustes: number,
  totalRetirado: number,
  totalAguardandoLiberacao = 0,
  mesesGrafico = 6,
  now = new Date(),
): Omit<PortalResumo, 'leads' | 'churnedLeads' | 'totalAjustes' | 'totalRetirado' | 'totalComissao'> {
  const totalComissaoGanhaLiberada = vendasGanhasLiberadas.reduce((s, v) => s + v.comissao, 0)
  const totalComissaoGanha = totalComissaoGanhaLiberada + totalAguardandoLiberacao
  const saldoParaSacar = Math.max(0, arredondarBrl(totalComissaoGanhaLiberada + totalAjustes - totalRetirado))
  const porMes = new Map<string, number>()
  for (const v of vendasGanhasLiberadas) {
    if (!v.vendaRealizadaEm) continue
    const key = monthKeyFromDate(v.vendaRealizadaEm)
    porMes.set(key, (porMes.get(key) ?? 0) + v.comissao)
  }
  const mesAtualKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  const mesesComValor = [...porMes.entries()].filter(([, v]) => v > 0)
  const sortedKeys = [...porMes.keys()].sort()
  return {
    totalAGanar: comissaoPendente,
    totalComissaoCarteira: comissaoPendente + totalComissaoGanha,
    totalComissaoGanha,
    totalAguardandoLiberacao,
    saldoParaSacar,
    ganhoMesAtual: porMes.get(mesAtualKey) ?? 0,
    mediaMensalGanhos: mesesComValor.length > 0
      ? mesesComValor.reduce((s, [, v]) => s + v, 0) / mesesComValor.length
      : 0,
    ganhosPorMes: sortedKeys.slice(-mesesGrafico).map(key => ({
      key,
      label: labelFromMonthKey(key),
      valor: porMes.get(key) ?? 0,
    })),
  }
}

export function sumSaquesPendentes(pedidos: Pick<PortalSaque, 'status' | 'valorSolicitado'>[]): number {
  return pedidos
    .filter(p => p.status === 'pendente')
    .reduce((s, p) => s + Number(p.valorSolicitado), 0)
}

export function calcSaldoExibidoPrestador(
  saldoParaSacar: number,
  totalComissaoCarteira: number,
  totalAGanar: number,
  totalRetirado: number,
  totalComissaoGanha: number,
  totalAjustes: number,
  pedidos: Pick<PortalSaque, 'status' | 'valorSolicitado'>[],
): { saldoDisponivel: number; carteiraExibida: number; aGanharExibido: number; valorReservado: number } {
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

export function validarValorSaque(
  saldoDisponivel: number,
  valor: number,
): { ok: true } | { ok: false; message: string } {
  const v = arredondarBrl(Number(valor))
  if (!Number.isFinite(v) || v <= 0) {
    return { ok: false, message: 'Informe um valor válido maior que zero.' }
  }
  if (Math.round(v * 100) > Math.round(arredondarBrl(saldoDisponivel) * 100)) {
    return {
      ok: false,
      message: `Saldo insuficiente. Disponível para sacar: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(arredondarBrl(Math.max(0, saldoDisponivel)))}.`,
    }
  }
  return { ok: true }
}

export type PortalLeadEtiqueta = 'cliente_pagou' | 'voce_ja_sacou'

export function leadEtiquetaKey(lead: Pick<PortalComissaoLead, 'leadId' | 'fieldId'>): string {
  return `${lead.leadId}:${lead.fieldId}`
}

export function buildPrestadorLeadEtiquetasMap(
  leads: PortalComissaoLead[],
  valorSaquePendente: number,
  valorJaRetirado = 0,
): Map<string, PortalLeadEtiqueta[]> {
  const map = new Map<string, PortalLeadEtiqueta[]>()
  for (const lead of leads) {
    const tags: PortalLeadEtiqueta[] = []
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
    const tags = map.get(key) ?? (lead.vendaGanha ? ['cliente_pagou' as const] : [])
    if (!tags.includes('voce_ja_sacou')) tags.push('voce_ja_sacou')
    map.set(key, tags)
    restanteCent -= Math.round(arredondarBrl(lead.comissao) * 100)
  }
  return map
}

function parseLeadDate(raw: string | null | undefined): Date | null {
  if (!raw) return null
  const trimmed = raw.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const d = new Date(`${trimmed}T12:00:00`)
    return Number.isNaN(d.getTime()) ? null : d
  }
  const d = new Date(trimmed)
  return Number.isNaN(d.getTime()) ? null : d
}

export function splitLeadsByCurrentMonth(leads: PortalComissaoLead[], now = new Date()) {
  const year = now.getFullYear()
  const month = now.getMonth()
  const mesAtual: PortalComissaoLead[] = []
  const outrosMeses: PortalComissaoLead[] = []
  for (const lead of leads) {
    const d = parseLeadDate(lead.vendaRealizadaEm ?? lead.dataChegada ?? lead.criadoEm)
    if (d && d.getFullYear() === year && d.getMonth() === month) mesAtual.push(lead)
    else outrosMeses.push(lead)
  }
  const mesLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' }).format(now)
  return { mesAtual, outrosMeses, todosMeses: leads, mesLabel }
}

export function prestadorLeadMatchesSearch(lead: PortalComissaoLead, query: string): boolean {
  const q = query.trim().toLowerCase()
  if (!q) return true
  return [lead.leadNome, lead.leadStatus, lead.fieldNome, lead.leadOrigem]
    .some(value => (value ?? '').toLowerCase().includes(q))
}

function parseTipoPix(raw: unknown): TipoChavePix {
  const v = asText(raw)
  if (v === 'cnpj' || v === 'email' || v === 'telefone' || v === 'aleatoria') return v
  return 'cpf'
}

export function assemblePortalResumo(
  rawLeads: unknown[],
  lancamentos: PortalLancamento[],
): PortalResumo {
  const leads: PortalComissaoLead[] = []
  const churnedLeads: PortalComissaoLead[] = []
  for (const item of rawLeads) {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    const status = asText(row.lead_status)
    const percentual = asNumber(row.percentual)
    if (percentual <= 0) continue
    const valorOrcamento = asNumber(row.valor_orcamento)
    const valorNegocio = asNumber(row.valor_negocio)
    const base = resolveValorBaseComissao(status, valorOrcamento, valorNegocio)
    const vendaGanha = isPortalVendaGanha(status)
    const libStatus = asText(row.liberacao_status)
    const comissaoLiberada = vendaGanha && libStatus === 'liberada'
    const parsed: PortalComissaoLead = {
      leadId: asNumber(row.lead_id),
      leadNome: asText(row.lead_nome) || `Lead ${asNumber(row.lead_id)}`,
      leadStatus: status,
      valorOrcamento: base,
      fieldId: asText(row.field_id),
      fieldNome: asText(row.field_nome) || 'Pontua Garbo',
      percentual,
      comissao: (base * percentual) / 100,
      vendaGanha,
      comissaoLiberada,
      comissaoAguardandoLiberacao: vendaGanha && !comissaoLiberada,
      liberacaoId: asText(row.liberacao_id) || null,
      vendaRealizadaEm: typeof row.venda_realizada_em === 'string' ? row.venda_realizada_em : null,
      dataChegada: typeof row.data_chegada === 'string' ? row.data_chegada : null,
      criadoEm: typeof row.criado_em === 'string' ? row.criado_em : null,
      leadEmail: typeof row.lead_email === 'string' ? row.lead_email : null,
      leadTelefone: typeof row.lead_telefone === 'string' ? row.lead_telefone : null,
      leadEmpresa: typeof row.lead_empresa === 'string' ? row.lead_empresa : null,
      leadOrigem: typeof row.lead_origem === 'string' ? row.lead_origem : null,
      leadRegiao: typeof row.lead_regiao === 'string' ? row.lead_regiao : null,
      churned: isPortalVendaPerdida(status),
    }
    if (parsed.churned) churnedLeads.push(parsed)
    else leads.push(parsed)
  }

  const totalAjustes = lancamentos.filter(l => l.tipo === 'ajuste').reduce((s, l) => s + l.valor, 0)
  const totalRetirado = lancamentos.filter(l => l.tipo === 'saque').reduce((s, l) => s + l.valor, 0)
  const ganhasLiberadas = leads.filter(l => l.comissaoLiberada)
  const aguardando = leads.filter(l => l.comissaoAguardandoLiberacao)
  const pendentes = leads.filter(l => !l.vendaGanha)
  const resumo = buildPortalResumoFinanceiro(
    ganhasLiberadas.map(l => ({ comissao: l.comissao, vendaRealizadaEm: l.vendaRealizadaEm })),
    pendentes.reduce((s, l) => s + l.comissao, 0),
    totalAjustes,
    totalRetirado,
    aguardando.reduce((s, l) => s + l.comissao, 0),
  )
  return {
    leads,
    churnedLeads,
    ...resumo,
    totalAjustes,
    totalRetirado,
    totalComissao: resumo.totalComissaoCarteira,
  }
}

export function parsePortalBoot(raw: unknown): PortalBoot {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const perfilRaw = (data.perfil && typeof data.perfil === 'object' ? data.perfil : {}) as Record<string, unknown>
  const perfil: PortalPerfil = {
    id: asText(perfilRaw.id),
    nome: asText(perfilRaw.nome),
    email: typeof perfilRaw.email === 'string' ? perfilRaw.email : null,
    telefone: typeof perfilRaw.telefone === 'string' ? perfilRaw.telefone : null,
    avatarUrl: typeof perfilRaw.avatar_url === 'string' ? perfilRaw.avatar_url : null,
    titulo: asText(perfilRaw.titulo) || EMPTY_PERFIL.titulo,
    comissaoAtiva: asBool(perfilRaw.comissao_ativa),
    chavePix: typeof perfilRaw.chave_pix === 'string' ? perfilRaw.chave_pix : null,
    tipoChavePix: parseTipoPix(perfilRaw.tipo_chave_pix),
  }
  const lancamentos: PortalLancamento[] = Array.isArray(data.lancamentos)
    ? data.lancamentos.map(item => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        return {
          id: asText(row.id),
          tipo: asText(row.tipo),
          valor: asNumber(row.valor),
          descricao: typeof row.descricao === 'string' ? row.descricao : null,
          criadoEm: typeof row.criado_em === 'string' ? row.criado_em : null,
        }
      })
    : []
  const saques: PortalSaque[] = Array.isArray(data.saques)
    ? data.saques.map(item => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        return {
          id: asText(row.id),
          valorSolicitado: asNumber(row.valor_solicitado),
          chavePix: asText(row.chave_pix),
          tipoChavePix: asText(row.tipo_chave_pix),
          status: asText(row.status) || 'pendente',
          obsAdmin: typeof row.obs_admin === 'string' ? row.obs_admin : null,
          criadoEm: typeof row.criado_em === 'string' ? row.criado_em : null,
          processadoEm: typeof row.processado_em === 'string' ? row.processado_em : null,
        }
      })
    : []
  const permissoes = Array.isArray(data.permissoes)
    ? data.permissoes.map(item => parsePermissaoRow(item, perfil.id)).filter(p => p.leadId > 0)
    : []
  const titulos: PortalTitulo[] = Array.isArray(data.titulos)
    ? data.titulos.map(item => {
        const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        return { id: asText(row.id), nome: asText(row.nome) }
      }).filter(t => t.id)
    : []
  return {
    perfil,
    resumo: assemblePortalResumo(Array.isArray(data.leads) ? data.leads : [], lancamentos),
    permissoes,
    saques,
    lancamentos,
    titulos,
  }
}

export function parsePortalLeadDetalhe(raw: unknown): PortalLeadDetalhe {
  const data = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const leadRaw = data.lead && typeof data.lead === 'object' ? data.lead as Record<string, unknown> : null
  return {
    lead: leadRaw ? {
      id: asNumber(leadRaw.id),
      nome: asText(leadRaw.nome),
      empresa: typeof leadRaw.empresa === 'string' ? leadRaw.empresa : null,
      email: typeof leadRaw.email === 'string' ? leadRaw.email : null,
      telefone: typeof leadRaw.telefone === 'string' ? leadRaw.telefone : null,
      origem: typeof leadRaw.origem === 'string' ? leadRaw.origem : null,
      status: asText(leadRaw.status),
      valorOrcamento: asNumber(leadRaw.valor_orcamento),
      valorNegocio: asNumber(leadRaw.valor_negocio),
      dataChegada: typeof leadRaw.data_chegada === 'string' ? leadRaw.data_chegada : null,
      regiao: typeof leadRaw.regiao === 'string' ? leadRaw.regiao : null,
      observacoes: typeof leadRaw.observacoes === 'string' ? leadRaw.observacoes : null,
    } : null,
    podeVerDetalhes: asBool(data.pode_ver_detalhes),
    podeVerLousa: asBool(data.pode_ver_lousa),
    podeVerAnotacoes: asBool(data.pode_ver_anotacoes),
    podeVerFotos: asBool(data.pode_ver_fotos),
    podeVerPdfs: asBool(data.pode_ver_pdfs),
    podeVerOrcamento: asBool(data.pode_ver_orcamento),
    lousaImages: Array.isArray(data.lousa_images) ? data.lousa_images as CrmLousaImage[] : [],
    lousaDrawings: Array.isArray(data.lousa_drawings) ? data.lousa_drawings as CrmLousaDrawing[] : [],
    slides: Array.isArray(data.slides)
      ? data.slides.map(item => {
          const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
          return {
            id: asText(row.id),
            identificador: asText(row.identificador),
            clienteNome: asText(row.cliente_nome),
            status: asText(row.status),
          }
        }).filter(s => s.id)
      : [],
  }
}

export const EMPTY_PORTAL_BOOT: PortalBoot = {
  perfil: EMPTY_PERFIL,
  resumo: {
    leads: [],
    churnedLeads: [],
    totalAGanar: 0,
    totalComissaoCarteira: 0,
    totalComissaoGanha: 0,
    totalAguardandoLiberacao: 0,
    ganhoMesAtual: 0,
    mediaMensalGanhos: 0,
    ganhosPorMes: [],
    totalAjustes: 0,
    totalRetirado: 0,
    saldoParaSacar: 0,
    totalComissao: 0,
  },
  permissoes: [],
  saques: [],
  lancamentos: [],
  titulos: [],
}
