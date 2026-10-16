/**
 * Ponte QuotePresentation (Orçamentos IA) → precificação do Orçamento Slides.
 */

import { criarGrupoPrecosFracionados } from '@/lib/orcamento-slide-precificacao'
import type {
  OrcamentoDadosMeta,
  OrcamentoPrecificacao,
} from '@/lib/orcamento-slide-types'
import type { QuotePresentationLayout } from '@/lib/orcamentos-ia/quote-presentation'

export const ORCAMENTO_SLIDES_IA_PRICE_SEED_KEY = 'orcamento-slides:ia-price-seed'

export interface OrcamentoSlidesIaPriceSeed {
  leadId: number
  projectId: string | null
  analysisId: string | null
  clienteNome?: string | null
  precificacao: OrcamentoPrecificacao
  meta: Pick<
    OrcamentoDadosMeta,
    'origem' | 'orcamentos_ia_analysis_id' | 'orcamentos_ia_project_id'
  >
  createdAt: string
}

/** Converte layout da proposta IA em precificação com preços fracionados por ambiente. */
export function quotePresentationToSlidesPrecificacao(
  layout: QuotePresentationLayout,
): OrcamentoPrecificacao {
  const grupos = layout.environments
    .map((env) => {
      const itens = env.modules
        .filter((m) => !m.outOfScope && Number(m.salePrice) > 0)
        .map((m) => ({
          label: m.name.slice(0, 120),
          valor: Math.round(Number(m.salePrice) * 100) / 100,
        }))
      if (!itens.length) return null
      return criarGrupoPrecosFracionados({
        titulo: env.name.slice(0, 80),
        itens,
        exibir_total: true,
      })
    })
    .filter((g): g is NonNullable<typeof g> => g != null)

  const sale = Math.round(Number(layout.pricing.salePrice || 0) * 100) / 100

  return {
    valor_integral: sale,
    parcelas: 1,
    valor_parcela: sale,
    desconto_percent: 0,
    acrescimo_percent: 0,
    valor_final: sale,
    fracionar_precos: grupos.length > 0,
    grupos_fracionados: grupos,
    itens_fracionados: grupos[0]?.itens ?? [],
    exibir_total_fracionado: true,
    adicionar_markup: false,
  }
}

export function buildOrcamentoSlidesIaPriceSeed(params: {
  layout: QuotePresentationLayout
  leadId: number
  projectId?: string | null
  analysisId?: string | null
  clienteNome?: string | null
}): OrcamentoSlidesIaPriceSeed {
  const precificacao = quotePresentationToSlidesPrecificacao(params.layout)
  return {
    leadId: params.leadId,
    projectId: params.projectId ?? null,
    analysisId: params.analysisId ?? null,
    clienteNome: params.clienteNome ?? null,
    precificacao,
    meta: {
      origem: 'orcamentos_ia',
      orcamentos_ia_analysis_id: params.analysisId ?? undefined,
      orcamentos_ia_project_id: params.projectId ?? undefined,
    },
    createdAt: new Date().toISOString(),
  }
}

export function writeOrcamentoSlidesIaPriceSeed(seed: OrcamentoSlidesIaPriceSeed): void {
  sessionStorage.setItem(ORCAMENTO_SLIDES_IA_PRICE_SEED_KEY, JSON.stringify(seed))
}

export function readOrcamentoSlidesIaPriceSeed(): OrcamentoSlidesIaPriceSeed | null {
  try {
    const raw = sessionStorage.getItem(ORCAMENTO_SLIDES_IA_PRICE_SEED_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as OrcamentoSlidesIaPriceSeed
    if (!parsed || typeof parsed.leadId !== 'number' || !parsed.precificacao) return null
    return parsed
  } catch {
    return null
  }
}

export function clearOrcamentoSlidesIaPriceSeed(): void {
  try {
    sessionStorage.removeItem(ORCAMENTO_SLIDES_IA_PRICE_SEED_KEY)
  } catch {
    /* ignore */
  }
}
