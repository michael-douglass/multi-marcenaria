import type { ViewportMode } from '@/lib/orcamento-slide-layout';
import type {
  OrcamentoFormaPagamento,
  OrcamentoSlide,
  OrcamentoSlideBloco,
  OrcamentoSlideMidia,
  OrcamentoSlideTemplate,
  OrcamentoCatalogoItem,
  OrcamentoPergunta,
} from '@/lib/orcamento-slide-types';

/** Props compartilhadas — evita import circular com OrcamentoSlideExportMenu. */
export interface OrcamentoSlideApresentacaoProps {
  orcamento: OrcamentoSlide;
  template: OrcamentoSlideTemplate | null;
  blocos: OrcamentoSlideBloco[];
  midias: OrcamentoSlideMidia[];
  perguntas?: OrcamentoPergunta[];
  catalogoFerragens?: OrcamentoCatalogoItem[];
  catalogoItens?: OrcamentoCatalogoItem[];
  className?: string;
  viewport?: ViewportMode;
  previewMode?: boolean;
  valorOrcamentoLead?: number;
  formasPagamento?: OrcamentoFormaPagamento[];
  midiasOrcamento?: OrcamentoSlideMidia[];
  embeddedInLayout?: boolean;
  /** Prévia fiel nas configurações — cada dobra com tamanho real do slide. */
  faithfulPreview?: boolean;
  /**
   * Exportação PDF/imagens: omite slides e players de vídeo
   * (vídeo só existe na apresentação web / gravação).
   */
  omitVideos?: boolean;
}
