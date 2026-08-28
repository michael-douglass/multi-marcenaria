import type { CSSProperties } from 'react';
import type {
  AlinhamentoLayout,
  BlocoLayoutConfig,
  BlocoLayoutViewport,
  BlocoTipo,
  FotoPosicao,
  TextoPosicaoImagem,
} from '@/lib/orcamento-slide-types';

export type ViewportMode = 'desktop' | 'mobile';

const DEFAULTS: Partial<Record<BlocoTipo, BlocoLayoutConfig>> = {
  capa: {
    desktop: { alinhamento: 'centro', painel_largura_pct: 58, foto_largura_pct: 50, texto_posicao_imagem: 'antes' },
    mobile: { alinhamento: 'centro', padding_x: 16, foto_largura_pct: 100 },
  },
  valorizacao: {
    desktop: { foto_posicao: 'esquerda', painel_largura_pct: 62, foto_largura_pct: 50, alinhamento: 'esquerda', texto_posicao_imagem: 'antes' },
    mobile: { ordem_mobile: 'imagem_primeiro', foto_altura: 'media', padding_x: 16, alinhamento: 'esquerda', foto_largura_pct: 100 },
  },
  comparativo_ferragens: {
    desktop: { foto_posicao: 'direita', painel_largura_pct: 50, foto_largura_pct: 50, alinhamento: 'esquerda', texto_posicao_imagem: 'antes' },
    mobile: { ordem_mobile: 'texto_primeiro', padding_x: 16, alinhamento: 'esquerda', foto_largura_pct: 100 },
  },
  galeria_projetos: {
    desktop: { colunas: 3, alinhamento: 'esquerda', foto_largura_pct: 100 },
    mobile: { colunas: 1, padding_x: 16, alinhamento: 'esquerda', foto_largura_pct: 100 },
  },
  precificacao: {
    desktop: { alinhamento: 'esquerda' },
    mobile: { alinhamento: 'esquerda', padding_x: 16 },
  },
  precos_fracionados: {
    desktop: { alinhamento: 'esquerda' },
    mobile: { alinhamento: 'esquerda', padding_x: 16 },
  },
  prazos: {
    desktop: { foto_posicao: 'esquerda', painel_largura_pct: 45, alinhamento: 'esquerda' },
    mobile: { ordem_mobile: 'texto_primeiro', padding_x: 16, alinhamento: 'esquerda' },
  },
  garantia: {
    desktop: { alinhamento: 'esquerda' },
    mobile: { alinhamento: 'centro', padding_x: 16 },
  },
  dados_projeto: {
    desktop: { alinhamento: 'esquerda', padding_x: 40 },
    mobile: { alinhamento: 'esquerda', padding_x: 20 },
  },
  imagens_orcamento: {
    desktop: { alinhamento: 'esquerda', padding_x: 40 },
    mobile: { alinhamento: 'esquerda', padding_x: 20 },
  },
  analise_ia: {
    desktop: { alinhamento: 'esquerda', padding_x: 48, altura_visual: 'maxima' },
    mobile: { alinhamento: 'esquerda', padding_x: 20, altura_visual: 'maxima' },
  },
};

function inferImagemFromPainel(fotoPosicao?: FotoPosicao): AlinhamentoLayout | undefined {
  // Legado: foto_posicao descrevia o painel escuro, não a imagem.
  if (fotoPosicao === 'esquerda') return 'direita';
  if (fotoPosicao === 'direita') return 'esquerda';
  return undefined;
}

export function resolveImagemAlinhamento(viewport: BlocoLayoutViewport): AlinhamentoLayout {
  if (viewport.imagem_alinhamento) return viewport.imagem_alinhamento;
  return inferImagemFromPainel(viewport.foto_posicao) ?? 'direita';
}

export function resolveBlocoLayout(
  tipo: BlocoTipo,
  config: Record<string, unknown>,
  viewport: ViewportMode,
): Required<Pick<BlocoLayoutViewport, 'foto_posicao' | 'imagem_alinhamento' | 'painel_largura_pct' | 'foto_largura_pct' | 'ordem_mobile' | 'texto_posicao_imagem' | 'colunas' | 'alinhamento' | 'padding_x' | 'foto_altura' | 'altura_visual' | 'escala_visual'>> {
  const stored = (config.layout as BlocoLayoutConfig | undefined) ?? {};
  const base = DEFAULTS[tipo]?.[viewport] ?? {};
  const custom = stored[viewport] ?? {};
  const merged: BlocoLayoutViewport = { ...base, ...custom };

  return {
    foto_posicao: merged.foto_posicao ?? 'esquerda',
    imagem_alinhamento: resolveImagemAlinhamento(merged),
    painel_largura_pct: merged.painel_largura_pct ?? 50,
    foto_largura_pct: merged.foto_largura_pct ?? (viewport === 'mobile' ? 100 : 50),
    ordem_mobile: merged.ordem_mobile ?? 'texto_primeiro',
    texto_posicao_imagem: merged.texto_posicao_imagem ?? 'antes',
    colunas: merged.colunas ?? 2,
    alinhamento: merged.alinhamento ?? 'esquerda',
    padding_x: merged.padding_x ?? 24,
    foto_altura: merged.foto_altura ?? 'media',
    altura_visual: merged.altura_visual ?? 'padrao',
    escala_visual: merged.escala_visual ?? 'normal',
  };
}

export function alinhamentoFlexClasses(alinhamento: AlinhamentoLayout) {
  switch (alinhamento) {
    case 'centro':
      return { items: 'items-center', text: 'text-center', self: 'self-center' };
    case 'direita':
      return { items: 'items-end', text: 'text-right', self: 'self-end' };
    default:
      return { items: 'items-start', text: 'text-left', self: 'self-start' };
  }
}

export function isMobileViewport(viewport?: ViewportMode) {
  return viewport === 'mobile';
}

export function textoSobreImagem(posicao: TextoPosicaoImagem) {
  return posicao === 'sobre_imagem';
}

export function textoAntesImagem(posicao: TextoPosicaoImagem) {
  return posicao === 'antes';
}

export function clampLarguraImagemPct(pct: number) {
  return Math.min(100, Math.max(20, pct));
}

/** Estilo inline para redimensionar a imagem (% do bloco). */
export function larguraImagemStyle(pct: number): { width: string; maxWidth: string } {
  const w = `${clampLarguraImagemPct(pct)}%`;
  return { width: w, maxWidth: w };
}

/** Painel escurecido atrás do texto quando ele fica sobre a imagem. */
export const ESTILO_PAINEL_TEXTO_SOBRE_IMAGEM: CSSProperties = {
  background: 'rgba(0, 0, 0, 0.55)',
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
  boxShadow: '0 12px 40px rgba(0, 0, 0, 0.55), 0 0 0 1px rgba(255, 255, 255, 0.1)',
  borderRadius: 16,
};

/** Sombra nas letras para não sumirem na foto (desktop). */
export const SOMBRA_TEXTO_SOBRE_IMAGEM: CSSProperties = {
  textShadow: '0 2px 18px rgba(0, 0, 0, 0.95), 0 1px 6px rgba(0, 0, 0, 0.85)',
};

/** Sombra leve no celular — legível sem borrar na tela ou no PDF. */
export const SOMBRA_TEXTO_MOBILE_SOBRE_IMAGEM: CSSProperties = {
  textShadow: '0 1px 3px rgba(0, 0, 0, 0.78)',
};
