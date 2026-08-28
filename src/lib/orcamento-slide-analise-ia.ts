import { textoDoConfig } from '@/lib/orcamento-slide-bloco-textos';
import type { OrcamentoSlide, OrcamentoSlideBloco } from '@/lib/orcamento-slide-types';

export const ANALISE_IA_TEXTO_PREVIEW = `## Visão geral do ambiente

Descreva aqui o que a análise de IA identificou no projeto — materiais, layout, acabamentos e oportunidades comerciais.

### Destaques
- Elementos principais do projeto
- Materiais e acabamentos sugeridos
- Pontos de atenção para medição e produção

> Envie o relatório da aba **Análise IA** do lead com o botão **Incluir na apresentação**, ou edite este texto manualmente.`;

export function chaveTextoAnaliseIa(blocoId: string) {
  return blocoId;
}

export function chaveTituloAnaliseIa(blocoId: string) {
  return `${blocoId}:titulo`;
}

export function chaveEtiquetaAnaliseIa(blocoId: string) {
  return `${blocoId}:etiqueta`;
}

export function resolveAnaliseIaConteudo(
  orcamento: OrcamentoSlide,
  bloco: OrcamentoSlideBloco,
): { etiqueta: string; titulo: string; corpo: string } {
  const textos = orcamento.dados.textos_blocos ?? {};
  const corpo =
    textos[chaveTextoAnaliseIa(bloco.id)]?.trim()
    || textoDoConfig(bloco.config, 'texto', 'analise_ia')
    || '';
  const titulo =
    textos[chaveTituloAnaliseIa(bloco.id)]?.trim()
    || textoDoConfig(bloco.config, 'titulo', 'analise_ia')
    || 'Análise do seu projeto';
  const etiqueta =
    textos[chaveEtiquetaAnaliseIa(bloco.id)]?.trim()
    || textoDoConfig(bloco.config, 'etiqueta', 'analise_ia')
    || 'Estudo do ambiente';

  return { etiqueta, titulo, corpo };
}

export function analiseIaTemConteudo(corpo: string) {
  return corpo.trim().length > 0;
}

/** Quando true, o slide de Análise de IA não entra na apresentação deste orçamento. */
export function isAnaliseIaOcultaNoOrcamento(orcamento: Pick<OrcamentoSlide, 'dados'>): boolean {
  return !!orcamento.dados?._meta?.ocultar_analise_ia;
}

export function patchTextosAnaliseIa(
  textosAtuais: Record<string, string>,
  blocoId: string,
  input: { etiqueta?: string; titulo?: string; corpo?: string },
): Record<string, string> {
  const next = { ...textosAtuais };
  if (input.corpo !== undefined) next[chaveTextoAnaliseIa(blocoId)] = input.corpo;
  if (input.titulo !== undefined) next[chaveTituloAnaliseIa(blocoId)] = input.titulo;
  if (input.etiqueta !== undefined) next[chaveEtiquetaAnaliseIa(blocoId)] = input.etiqueta;
  return next;
}

export function inserirRelatorioAnaliseIa(
  orcamento: OrcamentoSlide,
  blocoId: string,
  relatorio: string,
): OrcamentoSlide['dados'] {
  return {
    ...orcamento.dados,
    textos_blocos: patchTextosAnaliseIa(orcamento.dados.textos_blocos ?? {}, blocoId, {
      corpo: relatorio.trim(),
    }),
  };
}
