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

/** A4 retrato @ 96dpi — página física ao salvar PDF no navegador. */
export const A4_PORTRAIT_PRINT = { width: 794, height: 1123 } as const;

/** A4 paisagem @ 96dpi — computador (1920×1080). */
export const A4_LANDSCAPE_PRINT = { width: 1123, height: 794 } as const;

export type ExportPrintOrientation = 'portrait' | 'landscape';

/**
 * Dimensões do slide na apresentação (1920×1080 ou 1080×1920).
 */
export function resolveExportPageSize(viewport: OrcamentoExportViewport): ExportPageSize {
  return {
    width: ORCAMENTO_EXPORT_WIDTH[viewport],
    height: ORCAMENTO_EXPORT_PAGE_HEIGHT[viewport],
  };
}

/** Orientação da página de impressão conforme o viewport escolhido. */
export function resolvePrintOrientation(viewport: OrcamentoExportViewport): ExportPrintOrientation {
  switch (viewport) {
    case 'mobile':
      return 'portrait';
    case 'desktop':
      return 'landscape';
  }
}

/** Página A4 — paisagem (computador) ou retrato (celular). */
export function resolvePrintPageSize(viewport: OrcamentoExportViewport): ExportPageSize {
  if (viewport === 'mobile') {
    return {
      width: A4_PORTRAIT_PRINT.width,
      height: A4_PORTRAIT_PRINT.height,
    };
  }
  return {
    width: A4_LANDSCAPE_PRINT.width,
    height: A4_LANDSCAPE_PRINT.height,
  };
}
