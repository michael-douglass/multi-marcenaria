import { correspondeBuscaFlexivel } from '@/lib/markup-busca'
import {
  aplicarConfiguracaoFixaNosModulos,
  recalcularModulos,
} from '@/lib/markup-calculo'
import { normalizarModulosServicos } from '@/lib/markup-servicos'
import {
  criarModulosVazios,
  MARKUP_DEFAULT_CONFIG,
  type MarkupCategoria,
  type MarkupConfig,
  type MarkupDespesaTemplate,
  type MarkupLeadResumo,
  type MarkupOrcamento,
  type MarkupOrcamentoStatus,
  type MarkupProduto,
  type MarkupServicoTemplate,
} from '@/lib/markup-types'

export interface CrmMarkupLeadOption {
  id: number
  nome: string
}

export interface CrmMarkupListaItem {
  id: string
  lead_id: number | null
  lead_nome: string | null
  titulo: string
  status: MarkupOrcamentoStatus
  preco_final: number
  atualizado_em: string | null
}

export interface CrmMarkupBoot {
  orcamentos: CrmMarkupListaItem[]
  config: MarkupConfig
  categorias: MarkupCategoria[]
  produtos: MarkupProduto[]
  despesas: MarkupDespesaTemplate[]
  servicos: MarkupServicoTemplate[]
  leads: CrmMarkupLeadOption[]
}

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function parseMarkupConfig(raw: unknown): MarkupConfig {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    id: asText(row.id) || 'default',
    valor_hora_marcenaria: asNumber(row.valor_hora_marcenaria, MARKUP_DEFAULT_CONFIG.valor_hora_marcenaria),
    fator_sobras: asNumber(row.fator_sobras, MARKUP_DEFAULT_CONFIG.fator_sobras),
    margem_lucro: asNumber(row.margem_lucro, MARKUP_DEFAULT_CONFIG.margem_lucro),
    percentual_imposto: asNumber(row.percentual_imposto, MARKUP_DEFAULT_CONFIG.percentual_imposto),
    taxas_financeiras: asNumber(row.taxas_financeiras, MARKUP_DEFAULT_CONFIG.taxas_financeiras),
    custo_frete_padrao: asNumber(row.custo_frete_padrao, MARKUP_DEFAULT_CONFIG.custo_frete_padrao),
    horas_projeto_padrao: asNumber(row.horas_projeto_padrao, MARKUP_DEFAULT_CONFIG.horas_projeto_padrao),
    horas_producao_padrao: asNumber(row.horas_producao_padrao, MARKUP_DEFAULT_CONFIG.horas_producao_padrao),
    horas_instalacao_padrao: asNumber(row.horas_instalacao_padrao, MARKUP_DEFAULT_CONFIG.horas_instalacao_padrao),
    rodape_observacoes_padrao: asText(row.rodape_observacoes_padrao),
    timbrado_url: typeof row.timbrado_url === 'string' ? row.timbrado_url : null,
  }
}

export function parseMarkupOrcamento(raw: unknown, config?: Partial<MarkupConfig>): MarkupOrcamento {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const base = aplicarConfiguracaoFixaNosModulos(
    config ?? MARKUP_DEFAULT_CONFIG,
    criarModulosVazios(config),
  )
  const incoming = row.modulos && typeof row.modulos === 'object'
    ? (row.modulos as typeof base)
    : base
  const merged = {
    ...base,
    ...incoming,
    materiais: { ...base.materiais, ...(incoming.materiais ?? {}), linhas: incoming.materiais?.linhas ?? [] },
    servicos: { ...base.servicos, ...(incoming.servicos ?? {}), linhas: incoming.servicos?.linhas ?? [] },
    despesas: incoming.despesas ?? [],
    impostos: { ...base.impostos, ...(incoming.impostos ?? {}) },
    margem: { ...base.margem, ...(incoming.margem ?? {}) },
    totais: { ...base.totais, ...(incoming.totais ?? {}) },
  }
  const modulos = recalcularModulos(normalizarModulosServicos(merged))
  const status = row.status === 'finalizado' ? 'finalizado' : 'rascunho'
  return {
    id: asText(row.id),
    lead_id: row.lead_id == null ? null : asNumber(row.lead_id),
    lead_nome: typeof row.lead_nome === 'string' ? row.lead_nome : null,
    titulo: asText(row.titulo) || 'Markup',
    status,
    modulos,
    preco_final: asNumber(row.preco_final, modulos.totais.preco_final),
    observacoes_rodape: asText(row.observacoes_rodape),
    criado_em: typeof row.criado_em === 'string' ? row.criado_em : undefined,
    atualizado_em: typeof row.atualizado_em === 'string' ? row.atualizado_em : undefined,
  }
}

export function parseMarkupBoot(raw: unknown): CrmMarkupBoot {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const config = parseMarkupConfig(row.config)
  const orcamentos = Array.isArray(row.orcamentos)
    ? row.orcamentos.map((item): CrmMarkupListaItem => {
        const o = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
        return {
          id: asText(o.id),
          lead_id: o.lead_id == null ? null : asNumber(o.lead_id),
          lead_nome: typeof o.lead_nome === 'string' ? o.lead_nome : null,
          titulo: asText(o.titulo) || 'Markup',
          status: o.status === 'finalizado' ? 'finalizado' : 'rascunho',
          preco_final: asNumber(o.preco_final),
          atualizado_em: typeof o.atualizado_em === 'string' ? o.atualizado_em : null,
        }
      })
    : []
  return {
    orcamentos,
    config,
    categorias: Array.isArray(row.categorias) ? row.categorias as MarkupCategoria[] : [],
    produtos: Array.isArray(row.produtos) ? row.produtos as MarkupProduto[] : [],
    despesas: Array.isArray(row.despesas) ? row.despesas as MarkupDespesaTemplate[] : [],
    servicos: Array.isArray(row.servicos) ? row.servicos as MarkupServicoTemplate[] : [],
    leads: Array.isArray(row.leads)
      ? row.leads.map(item => {
          const l = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
          return { id: asNumber(l.id), nome: asText(l.nome) }
        }).filter(l => l.id > 0)
      : [],
  }
}

export function parseMarkupResumos(raw: unknown): MarkupLeadResumo[] {
  if (!Array.isArray(raw)) return []
  return raw.map(item => {
    const row = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
    return {
      lead_id: asNumber(row.lead_id),
      orcamento_id: asText(row.orcamento_id),
      preco_final: asNumber(row.preco_final),
      titulo: asText(row.titulo) || 'Markup',
      atualizado_em: asText(row.atualizado_em),
    }
  }).filter(item => item.lead_id > 0 && item.preco_final > 0)
}

export function markupResumoMap(resumos: MarkupLeadResumo[]): Map<number, MarkupLeadResumo> {
  return new Map(resumos.map(item => [item.lead_id, item]))
}

/** Orçamentos deste lead, o mais recente primeiro — igual à lista da ficha no Selletos. */
export function orcamentosDoLead(lista: CrmMarkupListaItem[], leadId: number): CrmMarkupListaItem[] {
  return lista
    .filter(item => item.lead_id === leadId)
    .sort((a, b) => {
      const ta = a.atualizado_em ?? ''
      const tb = b.atualizado_em ?? ''
      return tb.localeCompare(ta)
    })
}

export function resumoComoLista(resumo: MarkupLeadResumo | undefined | null): CrmMarkupListaItem[] {
  if (!resumo) return []
  return [{
    id: resumo.orcamento_id,
    lead_id: resumo.lead_id,
    lead_nome: null,
    titulo: resumo.titulo,
    status: 'rascunho',
    preco_final: resumo.preco_final,
    atualizado_em: resumo.atualizado_em || null,
  }]
}

export function filtrarMarkups(lista: CrmMarkupListaItem[], busca: string): CrmMarkupListaItem[] {
  const termo = busca.trim()
  if (!termo) return lista
  return lista.filter(item => correspondeBuscaFlexivel(
    [item.titulo, item.lead_nome ?? '', String(item.lead_id ?? ''), item.status].join(' '),
    termo,
  ))
}

export function agrupatProdutosPorCategoria(
  produtos: MarkupProduto[],
  categorias: MarkupCategoria[],
  busca: string,
): Array<{ categoria: string; items: MarkupProduto[] }> {
  const ativos = produtos.filter(p => p.ativo !== false)
  const filtrados = busca.trim()
    ? ativos.filter(p => correspondeBuscaFlexivel(
        [p.nome, p.variacao ?? '', p.categoria ?? ''].join(' '),
        busca,
      ))
    : ativos
  const nomes = new Map(categorias.map(c => [c.id, c.nome]))
  const grupos = new Map<string, MarkupProduto[]>()
  for (const produto of filtrados) {
    const nome = produto.categoria || nomes.get(produto.categoria_id) || 'Outros'
    const bucket = grupos.get(nome) ?? []
    bucket.push(produto)
    grupos.set(nome, bucket)
  }
  return [...grupos.entries()].map(([categoria, items]) => ({ categoria, items }))
}
