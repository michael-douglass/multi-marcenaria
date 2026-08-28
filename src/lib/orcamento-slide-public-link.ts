import type { OrcamentoSlide } from '@/lib/orcamento-slide-types';

/** Link público para o cliente visualizar e baixar o orçamento (sem login). */
export function linkPublicoOrcamento(schema: string, orcamentoId: string, origin = window.location.origin): string {
  return `${origin}/orcamento/${schema}/${orcamentoId}`;
}

/** Indica se o link público está ativo (visível para qualquer pessoa). */
export function isLinkPublicoAtivo(orcamento: Pick<OrcamentoSlide, 'dados'>): boolean {
  return !orcamento.dados?._meta?.link_publico_oculto;
}
