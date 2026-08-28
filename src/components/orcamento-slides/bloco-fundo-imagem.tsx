import {
  createContext,
  useContext,
  type CSSProperties,
  type ReactElement,
  type ReactNode,
} from 'react';
import { cn } from '@/lib/utils';
import { urlImagemFundoDoConfig } from '@/lib/orcamento-slide-bloco-imagens';
import {
  SOMBRA_TEXTO_MOBILE_SOBRE_IMAGEM,
  SOMBRA_TEXTO_SOBRE_IMAGEM,
} from '@/lib/orcamento-slide-layout';
import { slideShellPageClass, SLIDE_CONTAINER_STYLE } from '@/lib/orcamento-slide-typography';
import type { OrcamentoSlideBloco } from '@/lib/orcamento-slide-types';
import {
  SlideShellProvider,
  useSlideLayoutContext,
} from '@/components/orcamento-slides/orcamento-slide-layout-context';
import { SlideImagem } from '@/components/orcamento-slides/SlideImagem';

const BlocoFundoImagemContext = createContext(false);

export function useBlocoFundoImagem() {
  return useContext(BlocoFundoImagemContext);
}

interface PaletaSlide {
  primaria: string;
  fundo: string;
}

/** Ajusta fundos opacos e sombras quando o bloco usa imagem de fundo. */
export function useEstilosLegibilidadeFundo(p: PaletaSlide) {
  const sobreFundo = useBlocoFundoImagem();
  const { mobile } = useSlideLayoutContext();
  const sombra = mobile ? SOMBRA_TEXTO_MOBILE_SOBRE_IMAGEM : SOMBRA_TEXTO_SOBRE_IMAGEM;

  return {
    sobreFundo,
    fundoSecao: sobreFundo ? 'transparent' : p.primaria,
    fundoPainel: sobreFundo ? 'transparent' : p.primaria,
    fundoAlternativo: sobreFundo ? 'transparent' : p.fundo,
    sombraTexto: (sobreFundo ? sombra : {}) as CSSProperties,
  };
}

export function sombraTextoComFundo(overlayAtivo: boolean, leg: ReturnType<typeof useEstilosLegibilidadeFundo>): CSSProperties {
  if (!overlayAtivo && !leg.sobreFundo) return {};
  return leg.sombraTexto;
}

interface OrcamentoSlideShellProps {
  bloco: OrcamentoSlideBloco;
  children: ReactNode;
  /** Paginação interna (ex.: análise de IA com várias páginas no PDF). */
  slidePageIndex?: number;
  slidePageTotal?: number;
  /** Slide só com vídeo — omitido na impressão/PDF. */
  videoSlide?: boolean;
}

/**
 * Cada bloco = uma “página” inteira (snap no celular, quebra no PDF).
 * Com imagem de fundo: camadas + legibilidade; sem imagem: apenas o invólucro.
 */
export function OrcamentoSlideShell({
  bloco,
  children,
  slidePageIndex,
  slidePageTotal,
  videoSlide = false,
}: OrcamentoSlideShellProps) {
  const url = urlImagemFundoDoConfig(bloco.config);
  const { mobile, previewMode, embeddedInLayout, faithfulPreview, omitVideos } =
    useSlideLayoutContext();

  // PDF/imagens: páginas só de vídeo não entram no arquivo.
  if (omitVideos && videoSlide) {
    return null;
  }

  return (
    <SlideShellProvider>
      <BlocoFundoImagemContext.Provider value={!!url}>
        <div
          data-orcamento-slide
          data-bloco-tipo={bloco.tipo}
          data-bloco-pagina={slidePageIndex}
          data-bloco-paginas={slidePageTotal}
          {...(videoSlide ? { 'data-orcamento-video-slide': '' } : {})}
          className={cn(
            'relative isolate w-full max-w-full',
            slideShellPageClass(mobile, previewMode, embeddedInLayout, faithfulPreview),
          )}
          style={{
            scrollSnapAlign: 'start',
            scrollSnapStop: 'always',
            ...SLIDE_CONTAINER_STYLE,
            ...(mobile && !previewMode ? { contentVisibility: 'auto', containIntrinsicSize: '100dvh' } : {}),
          }}
        >
          {url && (
            <>
              <SlideImagem
                src={url}
                mobile={mobile}
                tamanho="fundo"
                className="pointer-events-none absolute inset-0 z-0 h-full w-full object-cover"
              />
              <div aria-hidden className="pointer-events-none absolute inset-0 z-[1] bg-black/50" />
            </>
          )}
          <div
            className={cn(
              // min-h-full (não min-h-0): permite o slide crescer com markup/preços longos
              // e a rolagem continuar no container da apresentação.
              'relative z-10 flex min-h-full w-full flex-1 flex-col',
              url && 'orcamento-legivel-sobre-fundo',
            )}
          >
            {children}
          </div>
        </div>
      </BlocoFundoImagemContext.Provider>
    </SlideShellProvider>
  );
}

export function withImagemFundo(bloco: OrcamentoSlideBloco, node: ReactElement | null) {
  if (!node) return null;
  return <OrcamentoSlideShell bloco={bloco}>{node}</OrcamentoSlideShell>;
}

/** @deprecated Use OrcamentoSlideShell */
export function EnvolverComImagemFundo({ bloco, children }: { bloco: OrcamentoSlideBloco; children: ReactNode }) {
  return <OrcamentoSlideShell bloco={bloco}>{children}</OrcamentoSlideShell>;
}
