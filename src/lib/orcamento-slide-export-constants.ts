import type { ViewportMode } from '@/lib/orcamento-slide-layout';
import { SLIDE_PREVIEW_DESKTOP, SLIDE_PREVIEW_MOBILE } from '@/lib/orcamento-slide-imagem-spec';

export type OrcamentoExportViewport = ViewportMode;

/** Largura da renderização off-screen e do PDF. */
export const ORCAMENTO_EXPORT_WIDTH: Record<OrcamentoExportViewport, number> = {
  desktop: SLIDE_PREVIEW_DESKTOP.width,
  mobile: SLIDE_PREVIEW_MOBILE.width,
};

/** Altura de cada página no PDF. */
export const ORCAMENTO_EXPORT_PAGE_HEIGHT: Record<OrcamentoExportViewport, number> = {
  desktop: SLIDE_PREVIEW_DESKTOP.height,
  mobile: SLIDE_PREVIEW_MOBILE.height,
};

export interface ExportPageSize {
  width: number;
  height: number;
}

/** 96 CSS px = 1 polegada — conversão para @page / jsPDF. */
export const PRINT_CSS_PX_PER_INCH = 96;

export type ExportPrintOrientation = 'portrait' | 'landscape';

/**
 * Dimensões do palco (computador 1920×1080, celular 1080×1920).
 */
export function resolveExportPageSize(viewport: OrcamentoExportViewport): ExportPageSize {
  return {
    width: ORCAMENTO_EXPORT_WIDTH[viewport],
    height: ORCAMENTO_EXPORT_PAGE_HEIGHT[viewport],
  };
}

/**
 * Palco de layout (CSS px) usado na exportação — tamanho de tela real, não de pixel final.
 * O layout foi desenhado para notebook/celular; montar em 1920 ou 1080 CSS deixava
 * textos e fotos minúsculos. A captura amplia o palco até o tamanho de saída.
 */
export const ORCAMENTO_EXPORT_STAGE: Record<OrcamentoExportViewport, ExportPageSize> = {
  desktop: { width: 1280, height: 720 },
  mobile: { width: 432, height: 768 },
};

/** Muda quando o motor de PDF muda — invalida PDFs antigos guardados no Storage. */
export const ORCAMENTO_EXPORT_RENDER_VERSION = 'stage-v3';

export function resolveExportStageSize(viewport: OrcamentoExportViewport): ExportPageSize {
  return ORCAMENTO_EXPORT_STAGE[viewport];
}

/** Fator de ampliação palco → pixels finais (1280→1920 = 1.5 · 432→1080 = 2.5). */
export function resolveExportCaptureScale(viewport: OrcamentoExportViewport): number {
  return resolveExportPageSize(viewport).width / resolveExportStageSize(viewport).width;
}

/** Orientação da página de impressão conforme o palco escolhido. */
export function resolvePrintOrientation(viewport: OrcamentoExportViewport): ExportPrintOrientation {
  switch (viewport) {
    case 'mobile':
      return 'portrait';
    case 'desktop':
      return 'landscape';
  }
}

/**
 * Página impressa = o próprio slide (não A4).
 * Computador: 1920×1080. Celular: 1080×1920.
 */
export function resolvePrintPageSize(viewport: OrcamentoExportViewport): ExportPageSize {
  return resolveExportPageSize(viewport);
}

/** Converte o palco em milímetros para @page e jsPDF. */
export function slideSizeToMm(size: ExportPageSize): ExportPageSize {
  const pxToMm = 25.4 / PRINT_CSS_PX_PER_INCH;
  return {
    width: size.width * pxToMm,
    height: size.height * pxToMm,
  };
}
