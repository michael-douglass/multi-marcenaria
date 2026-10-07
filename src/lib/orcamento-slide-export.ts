import {
  baixarOrcamentoApresentacaoPdf,
  baixarOrcamentoApresentacaoImagens,
  gerarOrcamentoApresentacaoPdf,
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

/** PDF pronto para a pré-visualização (gerado agora ou vindo do cache). */
export interface OrcamentoPdfPronto {
  blob: Blob;
  titulo: string;
  viewport: OrcamentoExportViewport;
  fromCache: boolean;
}

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
  /** PDF: só gera o Blob (sem download) — usado pela pré-visualização. */
  skipDownload?: boolean;
}

/** Gera e baixa o arquivo — visual idêntico à apresentação escolhida. Retorna o Blob do PDF (útil para cache). */
export function abrirOrcamentoExport({
  rootElement,
  titulo,
  viewport,
  format = 'pdf',
  onProgress,
  skipDownload = false,
}: AbrirOrcamentoExportOpts): Promise<Blob | void> {
  if (format === 'imagens') {
    return baixarOrcamentoApresentacaoImagens(rootElement, titulo, viewport, onProgress);
  }
  if (skipDownload) {
    return gerarOrcamentoApresentacaoPdf(rootElement, viewport, onProgress);
  }
  return baixarOrcamentoApresentacaoPdf(rootElement, titulo, viewport, onProgress);
}
