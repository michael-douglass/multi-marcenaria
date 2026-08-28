import { baixarOrcamentoApresentacaoPdf, baixarOrcamentoApresentacaoImagens } from './orcamento-slide-print';
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
}

/** Gera e baixa o arquivo — visual idêntico à apresentação escolhida. */
export function abrirOrcamentoExport({
  rootElement,
  titulo,
  viewport,
  format = 'pdf',
}: AbrirOrcamentoExportOpts): Promise<void> {
  if (format === 'imagens') {
    return baixarOrcamentoApresentacaoImagens(rootElement, titulo, viewport);
  }
  return baixarOrcamentoApresentacaoPdf(rootElement, titulo, viewport);
}
