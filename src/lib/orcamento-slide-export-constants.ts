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
