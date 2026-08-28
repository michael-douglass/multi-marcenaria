import type { CSSProperties } from 'react';

import type { BlocoAlturaVisual, BlocoEscalaVisual, BlocoLayoutViewport } from '@/lib/orcamento-slide-types';

const FAITHFUL_HEIGHT_DESKTOP = 'h-[1080px]';
const FAITHFUL_HEIGHT_MOBILE = 'h-[1920px]';

function faithfulSlideHeightClass(mobile: boolean): string {
  return mobile
    ? `${FAITHFUL_HEIGHT_MOBILE} shrink-0`
    : `${FAITHFUL_HEIGHT_DESKTOP} shrink-0`;
}



/** Tipografia relativa ao container do slide (cqi), não à janela inteira. */

function fatorEscala(escala: BlocoEscalaVisual = 'normal'): number {
  switch (escala) {
    case 'grande':
      return 1.18;
    case 'maxima':
      return 1.38;
    default:
      return 1;
  }
}

export function slideTypography(mobile: boolean, escala: BlocoEscalaVisual = 'normal'): {

  capaTitulo: CSSProperties;

  capaSubtitulo: CSSProperties;

  blocoTitulo: CSSProperties;

  blocoDestaque: CSSProperties;

  corpo: CSSProperties;

  etiqueta: CSSProperties;

} {
  const s = fatorEscala(escala);

  return {

    capaTitulo: {

      fontSize: mobile ? `clamp(${1.85 * s}rem, ${9.5 * s}cqi, ${2.85 * s}rem)` : `clamp(${1.75 * s}rem, ${9 * s}cqi, ${3.25 * s}rem)`,

      lineHeight: 1.08,

      maxWidth: '100%',

      wordBreak: 'break-word',

      overflowWrap: 'break-word',

    },

    capaSubtitulo: {

      fontSize: mobile ? `clamp(${1.05 * s}rem, ${4.6 * s}cqi, ${1.35 * s}rem)` : `clamp(${1 * s}rem, ${4 * s}cqi, ${1.5 * s}rem)`,

      lineHeight: 1.4,

      maxWidth: '100%',

      wordBreak: 'break-word',

      overflowWrap: 'break-word',

    },

    blocoTitulo: {

      fontSize: mobile ? `clamp(${1.65 * s}rem, ${8 * s}cqi, ${2.35 * s}rem)` : `clamp(${1.5 * s}rem, ${6.5 * s}cqi, ${2.75 * s}rem)`,

      lineHeight: 1.12,

      maxWidth: '100%',

      wordBreak: 'break-word',

    },

    blocoDestaque: {

      fontSize: mobile ? `clamp(${2.6 * s}rem, ${14 * s}cqi, ${4.1 * s}rem)` : `clamp(${2.5 * s}rem, ${14 * s}cqi, ${6.5 * s}rem)`,

      lineHeight: 1,

      maxWidth: '100%',

    },

    corpo: {

      fontSize: mobile ? `clamp(${1.05 * s}rem, ${4.2 * s}cqi, ${1.25 * s}rem)` : `clamp(${0.9 * s}rem, ${3 * s}cqi, ${1.15 * s}rem)`,

      lineHeight: 1.65,

      maxWidth: '100%',

      wordBreak: 'break-word',

    },

    etiqueta: {

      fontSize: mobile ? `${0.78 * s}rem` : `${0.75 * s}rem`,

      letterSpacing: '0.2em',

      textTransform: 'uppercase' as const,

    },

  };

}



export const SLIDE_CONTAINER_STYLE: CSSProperties = {

  containerType: 'inline-size',

};



/** Altura da “página” de cada bloco — um slide por tela no celular. */
export function slideShellPageClass(
  mobile: boolean,
  previewMode: boolean,
  embeddedInLayout: boolean,
  faithfulPreview = false,
): string {
  if (faithfulPreview && previewMode) {
    return `flex flex-col overflow-hidden ${faithfulSlideHeightClass(mobile)}`;
  }
  if (previewMode) {
    return mobile ? 'flex flex-col overflow-hidden min-h-0' : 'flex flex-col overflow-hidden min-h-screen';
  }
  if (embeddedInLayout) {
    // min-h-full (sem h-full/overflow-hidden): slide curto preenche a tela;
    // slide longo (markup/preços) cresce e a rolagem fica no container da apresentação.
    return 'flex min-h-full shrink-0 snap-start flex-col';
  }
  if (mobile) {
    return 'flex h-[100dvh] max-h-[100dvh] shrink-0 snap-start snap-always flex-col overflow-hidden';
  }
  return 'flex min-h-screen shrink-0 snap-start flex-col overflow-hidden';
}

export function sectionMinHeight(
  previewMode?: boolean,
  mobile?: boolean,
  embeddedInLayout?: boolean,
  insideSlideShell?: boolean,
  faithfulPreview = false,
): string {
  // Sem overflow-y-auto interno: ele “prende” a rolagem da apresentação (wheel/touch).
  // justify-safe-center evita cortar o topo quando o conteúdo passa da altura da tela.
  if (insideSlideShell && !previewMode) {
    return 'flex min-h-full w-full flex-1 flex-col justify-safe-center';
  }

  if (faithfulPreview && previewMode) {
    return faithfulSlideHeightClass(!!mobile);
  }

  if (previewMode) return mobile ? 'min-h-[440px]' : 'min-h-[560px]';

  // Dentro da barra superior (Apresentar / link público): 1 slide = área visível, sem vazar o próximo.
  if (embeddedInLayout) return 'min-h-full shrink-0 snap-start';

  return mobile ? 'min-h-[100dvh]' : 'min-h-screen';
}

export function resolveSectionMinHeight(
  layout: Pick<BlocoLayoutViewport, 'altura_visual'>,
  previewMode?: boolean,
  mobile?: boolean,
  embeddedInLayout?: boolean,
  insideSlideShell?: boolean,
  faithfulPreview = false,
): string {
  const altura: BlocoAlturaVisual = layout.altura_visual ?? 'padrao';

  if (insideSlideShell && !previewMode) {
    return 'flex min-h-full w-full flex-1 flex-col justify-safe-center';
  }

  if (embeddedInLayout && !previewMode) {
    if (altura === 'maxima') return 'min-h-full shrink-0 snap-start';
    if (altura === 'grande') return 'min-h-full shrink-0 snap-start';
    return sectionMinHeight(previewMode, mobile, true, insideSlideShell, faithfulPreview);
  }

  if (faithfulPreview && previewMode) {
    return faithfulSlideHeightClass(!!mobile);
  }

  if (previewMode) {
    if (altura === 'maxima') return mobile ? 'min-h-[640px]' : 'min-h-[820px]';
    if (altura === 'grande') return mobile ? 'min-h-[540px]' : 'min-h-[700px]';
    return sectionMinHeight(previewMode, mobile, embeddedInLayout);
  }

  if (mobile) {
    if (altura === 'maxima') return 'min-h-[125dvh]';
    if (altura === 'grande') return 'min-h-[112dvh]';
    return 'min-h-[100dvh]';
  }

  if (altura === 'maxima') return 'min-h-[125vh]';
  if (altura === 'grande') return 'min-h-[112vh]';
  return 'min-h-screen';
}

/** Altura dos cards de ferragem conforme escala visual. */
export function alturaCardFerragem(mobile: boolean, escala: BlocoEscalaVisual = 'normal'): string {
  const base = mobile ? 112 : 144;
  const altura = base * fatorEscala(escala);
  return `${Math.round(altura)}px`;
}



export function slidePaddingX(layout: Pick<BlocoLayoutViewport, 'padding_x'>, mobile: boolean): number {

  const base = layout.padding_x ?? (mobile ? 28 : 24);

  // Celular: margem lateral confortável (~5–7% de 1080px) sem esmagar o conteúdo.
  return mobile ? Math.min(Math.max(base, 28), 40) : base;

}



export function fotoAlturaMobile(altura: BlocoLayoutViewport['foto_altura']): string {

  switch (altura) {

    case 'compacta':

      return 'min(200px, 32vh)';

    case 'grande':

      return 'min(360px, 48vh)';

    default:

      return 'min(280px, 40vh)';

  }

}


