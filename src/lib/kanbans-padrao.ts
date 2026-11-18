/**
 * CRM pré-configurado de toda marcenaria (multi-empresa, Fase J).
 *
 * Par SQL: `supabase/migrations/20261118110000_crm_pipeline_padrao.sql` (`crm_seed_pipeline_padrao`).
 * Mudou aqui, mude lá (mesmos nomes e slugs).
 */

/** Etapas do Kanban principal do Pipeline, na ordem. Os nomes são exatos (status gravado no lead). */
export const PIPELINE_ETAPAS_PADRAO = [
  'Novo Lead',
  'Visita em obra agendada',
  'Visita em obra Feita',
  'Orçamentos feitos',
  'Precificação Feita',
  'Enviou orçamento',
] as const

/** Kanbans extras criados em toda empresa. Cada um é uma página própria no catálogo. */
export const KANBANS_PADRAO: ReadonlyArray<{ slug: string; titulo: string }> = [
  { slug: 'orcamentos', titulo: 'Orçamentos internos' },
  { slug: 'prospeccao', titulo: 'Prospecção' },
  { slug: 'manutencao', titulo: 'Manutenção' },
]

/** Id de página (catálogo e menu) de um kanban extra. */
export function kanbanPaginaId(slug: string): string {
  return `pipelineKanban:${slug}`
}

const SLUGS_PADRAO = new Set(KANBANS_PADRAO.map(k => k.slug))

/** O kanban é um dos padrão (tem página própria no catálogo)? */
export function isKanbanPadrao(slug: string): boolean {
  return SLUGS_PADRAO.has(slug)
}
