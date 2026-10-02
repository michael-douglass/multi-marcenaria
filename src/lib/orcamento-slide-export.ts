import {
  baixarOrcamentoApresentacaoPdf,
  baixarOrcamentoApresentacaoImagens,
  type OrcamentoExportProgressCallback,
} from './orcamento-slide-print';
import type { OrcamentoExportViewport } from './orcamento-slide-export-constants';

export type { OrcamentoExportViewport } from './orcamento-slide-export-constants';
export {
  ORCAMENTO_EXPORT_WIDTH,
  ORCAMENTO_EXPORT_PAGE_HEIGHT,
  resolveExportPageSize,
} from './orcamento-slide-export-constants';

export type OrcamentoExportFormat = 'pdf' | 'imagens';

export interface AbrirOrcamentoExportOpts {
  /** Elemento da apresentação renderizada (`data-orcamento-apresentacao`). */
  rootElement: HTMLElement;
  titulo: string;
  /** Visualização escolhida: computador (paisagem) ou celular (retrato). */
  viewport: OrcamentoExportViewport;
  /** PDF (padrão) ou imagens JPEG — uma por página, download direto. */
  format?: OrcamentoExportFormat;
  /** Progresso slide a slide (toast “Slide 3 de 12…”). */
  onProgress?: OrcamentoExportProgressCallback;
}

/** Gera e baixa o arquivo — visual idêntico à apresentação escolhida. Retorna o Blob do PDF (útil para cache). */
export function abrirOrcamentoExport({
  rootElement,
  titulo,
  viewport,
  format = 'pdf',
  onProgress,
}: AbrirOrcamentoExportOpts): Promise<Blob | void> {
  if (format === 'imagens') {
    return baixarOrcamentoApresentacaoImagens(rootElement, titulo, viewport, onProgress);
  }
  return baixarOrcamentoApresentacaoPdf(rootElement, titulo, viewport, onProgress);
}
