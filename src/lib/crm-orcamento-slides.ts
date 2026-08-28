import type { OrcamentoPrecificacao, OrcamentoSlideDados } from '@/types/orcamento-publico'

export interface CrmSlideLeadOption {
  id: number
  nome: string
}

export interface CrmOrcamentoSlide {
  id: string
  identificador: string
  lead_id: number | null
  lead_nome: string | null
  cliente_nome: string
  status: string
  dados: OrcamentoSlideDados
  criado_em: string | null
  atualizado_em: string | null
}

export interface CrmSlidesBoot {
  slides: CrmOrcamentoSlide[]
  leads: CrmSlideLeadOption[]
}

const SCHEMA_PUBLICO = 'emp_garbo'

function asNumber(value: unknown, fallback = 0): number {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

function asText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

export function parseSlide(raw: unknown): CrmOrcamentoSlide {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  const dados = (row.dados && typeof row.dados === 'object' ? row.dados : {}) as OrcamentoSlideDados
  return {
    id: asText(row.id),
    identificador: asText(row.identificador),
    lead_id: row.lead_id == null ? null : asNumber(row.lead_id),
    lead_nome: typeof row.lead_nome === 'string' ? row.lead_nome : null,
    cliente_nome: asText(row.cliente_nome),
    status: asText(row.status) || 'rascunho',
    dados,
    criado_em: typeof row.criado_em === 'string' ? row.criado_em : null,
    atualizado_em: typeof row.atualizado_em === 'string' ? row.atualizado_em : null,
  }
}

export function parseSlidesBoot(raw: unknown): CrmSlidesBoot {
  const row = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  return {
    slides: Array.isArray(row.slides) ? row.slides.map(parseSlide) : [],
    leads: Array.isArray(row.leads)
      ? row.leads.map(item => {
          const l = (item && typeof item === 'object' ? item : {}) as Record<string, unknown>
          return { id: asNumber(l.id), nome: asText(l.nome) }
        }).filter(l => l.id > 0)
      : [],
  }
}

export function filtrarSlides(lista: CrmOrcamentoSlide[], busca: string): CrmOrcamentoSlide[] {
  const termo = busca.trim().toLowerCase()
  if (!termo) return lista
  return lista.filter(item =>
    item.cliente_nome.toLowerCase().includes(termo)
    || item.identificador.toLowerCase().includes(termo)
    || (item.lead_nome ?? '').toLowerCase().includes(termo),
  )
}

export function linkPublicoOrcamento(id: string, origin = typeof window === 'undefined' ? '' : window.location.origin): string {
  return `${origin}/orcamento/${SCHEMA_PUBLICO}/${id}`
}

export function isLinkPublicoAtivo(slide: Pick<CrmOrcamentoSlide, 'dados'>): boolean {
  const meta = slide.dados?._meta as { link_publico_oculto?: boolean } | undefined
  return !meta?.link_publico_oculto
}

export function patchLinkPublico(dados: OrcamentoSlideDados, oculto: boolean): OrcamentoSlideDados {
  return {
    ...dados,
    _meta: {
      ...(dados._meta ?? {}),
      link_publico_oculto: oculto,
    },
  }
}

export function patchPrecificacao(
  dados: OrcamentoSlideDados,
  patch: Partial<OrcamentoPrecificacao>,
): OrcamentoSlideDados {
  return {
    ...dados,
    precificacao: {
      ...(dados.precificacao ?? {}),
      ...patch,
    },
  }
}

export function valorSlide(slide: CrmOrcamentoSlide): number {
  return Number(slide.dados?.precificacao?.valor_final ?? 0)
}

export const SLIDE_STATUS_LABEL: Record<string, string> = {
  rascunho: 'Rascunho',
  pronto: 'Pronto',
  enviado: 'Enviado',
}
