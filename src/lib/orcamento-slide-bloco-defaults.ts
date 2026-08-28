import { ANALISE_IA_TEXTO_PREVIEW } from '@/lib/orcamento-slide-analise-ia';
import type { BlocoTipo } from '@/lib/orcamento-slide-types';

export const BLOCO_CONFIG_PADRAO: Partial<Record<BlocoTipo, Record<string, unknown>>> = {
  analise_ia: {
    etiqueta: 'Estudo do ambiente',
    titulo: 'Análise do seu projeto',
    texto: ANALISE_IA_TEXTO_PREVIEW,
    layout: {
      desktop: {
        alinhamento: 'esquerda',
        padding_x: 48,
        altura_visual: 'maxima',
      },
      mobile: {
        alinhamento: 'esquerda',
        padding_x: 20,
        altura_visual: 'maxima',
      },
    },
  },
};

export function configPadraoDoBloco(tipo: BlocoTipo): Record<string, unknown> {
  const padrao = BLOCO_CONFIG_PADRAO[tipo];
  return padrao ? structuredClone(padrao) : {};
}
