import { forwardRef, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import type {
  BlocoEscalaVisual,
  BlocoLayoutViewport,
  OrcamentoFormaPagamento,
  OrcamentoSlide,
  OrcamentoSlideTemplate,
  OrcamentoSlideBloco,
  OrcamentoSlideMidia,
  OrcamentoCatalogoItem,
  OrcamentoPergunta,
} from '@/lib/orcamento-slide-types';
import {
  classesGridFerragens,
  resolverFerragensSelecionadas,
  type FerragemExibicao,
} from '@/lib/orcamento-slide-ferragens-resolver';
import {
  BRL,
  linhasMarkupComposicaoApresentacao,
  markupComposicaoTemConteudo,
  opcoesPagamentoApresentacao,
  normalizarPrecificacao,
  precificacaoFracionadaAtiva,
  precificacaoMarkupAtivo,
  resolverGruposFracionadosApresentacao,
  slidePrecosFracionadosModoExemplo,
  somaItensFracionados,
  somaMarkupComposicao,
} from '@/lib/orcamento-slide-precificacao';
import { PrecificacaoOpcaoCard } from '@/components/orcamento-slides/PrecificacaoOpcaoCard';
import {
  precificacaoTemValor,
  resolverPrecificacaoApresentacao,
} from '@/lib/orcamento-slide-lead-sync';
import { PALETA_PADRAO } from '@/lib/orcamento-slide-types';
import {
  alinhamentoFlexClasses,
  ESTILO_PAINEL_TEXTO_SOBRE_IMAGEM,
  isMobileViewport,
  larguraImagemStyle,
  resolveBlocoLayout,
  SOMBRA_TEXTO_SOBRE_IMAGEM,
  textoAntesImagem,
  textoSobreImagem,
  type ViewportMode,
} from '@/lib/orcamento-slide-layout';
import {
  imagensGaleriaDoConfig,
  orientacaoDoConfig,
  urlDoConfig,
  urlImagemFundoDoConfig,
} from '@/lib/orcamento-slide-bloco-imagens';
import {
  OrcamentoSlideShell,
  sombraTextoComFundo,
  useEstilosLegibilidadeFundo,
  withImagemFundo,
} from '@/components/orcamento-slides/bloco-fundo-imagem';
import type { OrcamentoSlideApresentacaoProps } from '@/components/orcamento-slides/orcamento-slide-apresentacao-props';
import {
  SlideLayoutContext,
  type SlideLayoutContextValue,
  useIsInSlideShell,
  useSlideLayoutContext,
} from '@/components/orcamento-slides/orcamento-slide-layout-context';
import { aspectRatioSlide, estiloContainerImagem } from '@/lib/orcamento-slide-imagem-spec';
import { textoDoConfig, itensFracionadosDoConfig } from '@/lib/orcamento-slide-bloco-textos';
import {
  formatarDataInicioExecucao,
  formatarPrazoEmDias,
  orcamentoTemDadosDePrazo,
  resolverDataPrevistaEntrega,
} from '@/lib/orcamento-slide-datas';
import { SlideImagem } from '@/components/orcamento-slides/SlideImagem';
import { SlideMidia } from '@/components/orcamento-slides/SlideMidia';
import { CuboMagicoFundo, CuboMagicoLens, cuboMagicoPeriodStyle } from '@/components/orcamento-slides/CuboMagicoFundo';
import { isOrcamentoMidiaVideo } from '@/lib/orcamento-slide-midia-video';
import { urlImagemApresentacao } from '@/lib/orcamento-slide-imagem-url';
import './ferragens-cards.css';
import {
  dadosProjetoTemConteudo,
  resolverItensDadosProjeto,
} from '@/lib/orcamento-slide-perguntas-resolver';
import {
  midiaCapa,
  midiaComparativoFerragens,
  midiaValorizacao,
  midiasGaleriaConfiguracao,
  resolverFotosImagensOrcamento,
} from '@/lib/orcamento-slide-midias-helpers';
import { BlocoAnaliseIASlides } from '@/components/orcamento-slides/BlocoAnaliseIA';
import { isAnaliseIaOcultaNoOrcamento } from '@/lib/orcamento-slide-analise-ia';
import {
  alturaCardFerragem,
  resolveSectionMinHeight,
  sectionMinHeight,
  slidePaddingX,
  slideTypography,
  SLIDE_CONTAINER_STYLE,
} from '@/lib/orcamento-slide-typography';
import { marcarElementoRevelado } from '@/lib/orcamento-slide-reveal';

interface Props extends OrcamentoSlideApresentacaoProps {}

function useSectionMinH(layout?: Pick<BlocoLayoutViewport, 'altura_visual'>) {
  const { previewMode, mobile, embeddedInLayout, faithfulPreview } = useContext(SlideLayoutContext);
  const insideSlideShell = useIsInSlideShell();
  if (layout?.altura_visual) {
    return resolveSectionMinHeight(layout, previewMode, mobile, embeddedInLayout, insideSlideShell, faithfulPreview);
  }
  return sectionMinHeight(previewMode, mobile, embeddedInLayout, insideSlideShell, faithfulPreview);
}

function useEffectiveViewport(forced?: ViewportMode): ViewportMode {
  const [auto, setAuto] = useState<ViewportMode>(() =>
    typeof window !== 'undefined' && window.innerWidth < 768 ? 'mobile' : 'desktop',
  );
  useEffect(() => {
    if (forced) return;
    const onResize = () => setAuto(window.innerWidth < 768 ? 'mobile' : 'desktop');
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [forced]);
  return forced ?? auto;
}

// ── Scroll reveal via IntersectionObserver ────────────────────────────────────
function useScrollReveal(
  ref: React.RefObject<HTMLElement>,
  disabled = false,
  embeddedInLayout = false,
  contentRev = '',
) {
  useLayoutEffect(() => {
    if (disabled) return;
    const root = ref.current;
    if (!root) return;

    const revelar = (el: HTMLElement) => marcarElementoRevelado(el);

    const pendentes = () =>
      root.querySelectorAll<HTMLElement>('[data-reveal]:not([data-revealed="true"])');

    // Apresentar / link público: mostra na hora.
    // MutationObserver pega nós novos (vídeos, troca desktop↔celular) que remontam sem data-revealed.
    if (embeddedInLayout) {
      const revelarTodos = () => {
        pendentes().forEach(revelar);
      };
      revelarTodos();
      const mo = new MutationObserver(revelarTodos);
      mo.observe(root, { childList: true, subtree: true });
      return () => mo.disconnect();
    }

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) revelar(e.target as HTMLElement);
        });
      },
      { root, threshold: 0.08, rootMargin: '0px 0px -4% 0px' },
    );

    const observar = (els: NodeListOf<HTMLElement> | HTMLElement[]) => {
      const rootRect = root.getBoundingClientRect();
      els.forEach((html) => {
        obs.observe(html);
        const rect = html.getBoundingClientRect();
        if (rect.top < rootRect.bottom && rect.bottom > rootRect.top) {
          revelar(html);
        }
      });
    };

    observar(pendentes());

    // Novos [data-reveal] (ex.: slides de vídeo) entram no observer automaticamente.
    const mo = new MutationObserver(() => {
      const novos = pendentes();
      if (novos.length) observar(novos);
    });
    mo.observe(root, { childList: true, subtree: true });

    return () => {
      obs.disconnect();
      mo.disconnect();
    };
  }, [ref, disabled, embeddedInLayout, contentRev]);
}

// Paleta resolvida — nunca undefined
function usePaleta(template: OrcamentoSlideTemplate | null) {
  return {
    primaria:   template?.cor_primaria   ?? PALETA_PADRAO.corPrimaria,   // marrom escuro
    secundaria: template?.cor_secundaria ?? PALETA_PADRAO.corSecundaria, // dourado/bege
    fundo:      template?.cor_fundo      ?? PALETA_PADRAO.corFundo,      // pêssego/creme
    texto:      template?.cor_texto      ?? '#FFFFFF',
    tituloFont: template?.fonte_titulo   ?? 'Playfair Display',
    corpoFont:  template?.fonte_corpo    ?? 'Lato',
    logoUrl:    template?.logo_url       ?? null,
    fundoUrl:   template?.fundo_url      ?? null,
  };
}

function reveal(delay = 0, previewMode = false): React.CSSProperties {
  if (previewMode) return { opacity: 1, transform: 'none' };
  return { '--reveal-delay': `${delay}ms` } as React.CSSProperties;
}

/** Fotos extras salvas em `config.imagens` — exibidas no rodapé do slide (exceto galeria principal). */
function ImagensExtrasDoBloco({
  bloco,
  mobile,
  previewMode,
  px,
}: {
  bloco: OrcamentoSlideBloco;
  mobile: boolean;
  previewMode?: boolean;
  px: number;
}) {
  if (bloco.tipo === 'galeria_projetos') return null;
  const fotos = imagensGaleriaDoConfig(bloco.config);
  if (fotos.length === 0) return null;

  const maxFotos = mobile ? 4 : 6;
  const exibir = fotos.slice(0, maxFotos);
  const cols = Math.min(exibir.length, mobile ? 2 : 3);

  return (
    <div
      className="relative z-20 shrink-0 w-full pt-3"
      style={{ paddingLeft: px, paddingRight: px, paddingBottom: mobile ? 12 : 16 }}
    >
      <div
        className="grid gap-2 mx-auto w-full max-w-4xl"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {exibir.map((img, i) => (
          <div
            key={`${img.url}-${i}`}
            className="overflow-hidden rounded-lg shadow-md"
            style={{
              aspectRatio: aspectRatioSlide(img.orientacao),
              maxHeight: mobile ? 96 : 128,
              ...reveal(60 + i * 40, previewMode),
            }}
            data-reveal={!previewMode || undefined}
          >
            <SlideImagem src={img.url} mobile={mobile} tamanho="small" className="h-full w-full object-cover" />
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Bloco: CAPA ───────────────────────────────────────────────────────────────
function BlocoCapa({
  bloco, orcamento, template, midias, viewport, previewMode,
}: { bloco: OrcamentoSlideBloco; orcamento: OrcamentoSlide; template: OrcamentoSlideTemplate | null; midias: OrcamentoSlideMidia[]; viewport?: ViewportMode; previewMode?: boolean }) {
  const { faithfulPreview } = useSlideLayoutContext();
  const p = usePaleta(template);
  const leg = useEstilosLegibilidadeFundo(p);
  const mobile = isMobileViewport(viewport);
  const layout = resolveBlocoLayout(bloco.tipo, bloco.config, mobile ? 'mobile' : 'desktop');
  const capaMidia = midiaCapa(midias, urlDoConfig(bloco.config, 'imagem_url'));
  const capaOrientacao = orientacaoDoConfig(bloco.config);
  const capaAspect = aspectRatioSlide(capaOrientacao);
  const titulo    = (bloco.config.titulo as string) || 'Proposta Comercial';
  const subtitulo = (bloco.config.subtitulo as string) || orcamento.cliente_nome || '';
  const typo = slideTypography(mobile);
  const minH = useSectionMinH();
  const px = slidePaddingX(layout, mobile);
  // Celular: texto centralizado com margem — aspecto natural de proposta no telefone.
  const textAlign = mobile
    ? alinhamentoFlexClasses('centro')
    : alinhamentoFlexClasses(layout.alinhamento);
  const imgAlign = layout.imagem_alinhamento;
  const textoPos = layout.texto_posicao_imagem;
  const overlaySobreImagem = !!capaMidia && textoSobreImagem(textoPos);
  const sombraTexto = sombraTextoComFundo(overlaySobreImagem, leg);
  const larguraImg = larguraImagemStyle(layout.foto_largura_pct);
  const cuboAtivo = !previewMode;
  const mobileTextoColClass = 'mx-auto w-full max-w-[min(36rem,88%)]';
  const textoCapa = (
    <CuboMagicoLens
      enabled={cuboAtivo}
      kind="content"
      className={cn('flex w-full flex-col', mobile ? 'gap-3.5' : 'gap-5', textAlign.items)}
    >
      {p.logoUrl && (
        <img
          src={urlImagemApresentacao(p.logoUrl, mobile, 'small')}
          alt="Logo"
          className={cn(
            'object-contain mb-1',
            mobile ? 'h-16 max-w-[min(100%,280px)]' : 'h-20 max-w-[min(100%,200px)]',
          )}
          style={{ ...reveal(0, previewMode) }}
          data-reveal={!previewMode ? true : undefined}
          loading="eager"
          decoding="async"
        />
      )}
      <h1
        className="font-serif font-black w-full max-w-full"
        style={{
          fontFamily: `'${p.tituloFont}', serif`,
          color: p.secundaria,
          ...typo.capaTitulo,
          ...sombraTexto,
          ...reveal(120, previewMode),
        }}
        data-reveal={!previewMode ? true : undefined}
      >
        {titulo}
      </h1>
      {subtitulo && (
        <p
          className="w-full max-w-full"
          style={{
            color: 'rgba(255,255,255,0.85)',
            fontFamily: `'${p.corpoFont}', sans-serif`,
            ...typo.capaSubtitulo,
            ...sombraTexto,
            ...reveal(240, previewMode),
          }}
          data-reveal={!previewMode ? true : undefined}
        >
          {subtitulo}
        </p>
      )}
      <div
        className={cn('h-0.5 mt-1', mobile ? 'w-12 max-w-[36%]' : 'w-16 max-w-[40%]')}
        style={{ background: p.secundaria, ...sombraTexto, ...reveal(360, previewMode) }}
        data-reveal={!previewMode ? true : undefined}
      />
    </CuboMagicoLens>
  );

  // Título centralizado sobre a imagem (com sombra para legibilidade) + Cubo Mágico
  if (overlaySobreImagem) {
    return (
      <section
        className={cn('relative w-full max-w-full flex flex-col overflow-hidden', minH)}
        style={{ scrollSnapAlign: 'start', ...SLIDE_CONTAINER_STYLE, ...cuboMagicoPeriodStyle(mobile) }}
      >
        <div className="relative flex flex-1 min-h-0 overflow-hidden">
          <CuboMagicoLens enabled={cuboAtivo} kind="bg" className="absolute inset-0">
            <SlideImagem
              src={capaMidia!.file_url}
              mobile={mobile}
              tamanho="hero"
              priority={mobile}
              className="absolute inset-0 h-full w-full object-cover"
            />
          </CuboMagicoLens>
          <div className="absolute inset-0 z-[2] bg-gradient-to-b from-black/55 via-black/40 to-black/60" />
          <CuboMagicoFundo enabled={cuboAtivo} mobile={mobile} variant="dark" />
          <div
            className={cn(
              'relative z-10 flex w-full flex-1 items-center justify-center',
              mobile
                ? 'px-[max(1rem,env(safe-area-inset-left))] pr-[max(1rem,env(safe-area-inset-right))] py-[max(2rem,env(safe-area-inset-top))]'
                : 'px-8 py-12',
            )}
          >
            <div
              className={cn(
                'flex w-full flex-col',
                mobile ? mobileTextoColClass : 'max-w-2xl px-10 py-10',
                textAlign.items,
                textAlign.text,
              )}
              style={mobile ? undefined : ESTILO_PAINEL_TEXTO_SOBRE_IMAGEM}
            >
              {textoCapa}
            </div>
          </div>
        </div>
        <ImagensExtrasDoBloco bloco={bloco} mobile={mobile} previewMode={previewMode} px={px} />
      </section>
    );
  }

  // Mobile com foto: hero cinematográfico + texto (melhor leitura em celular / gravação)
  if (capaMidia && mobile) {
    const textoPrimeiro = !textoAntesImagem(textoPos);
    const blocoFoto = (
      <div
        className="relative mx-auto w-full shrink-0 overflow-hidden"
        style={{
          aspectRatio: capaAspect,
          width: '100%',
          maxWidth: '100%',
          // PDF/prévia fiel: ocupa boa parte do slide 1080×1920. Ao vivo: usa a tela do telefone.
          minHeight: faithfulPreview ? '52%' : 'min(48dvh, 520px)',
          maxHeight: faithfulPreview ? '62%' : 'min(60dvh, 720px)',
          flex: faithfulPreview ? '0 0 58%' : undefined,
        }}
      >
        <CuboMagicoLens enabled={cuboAtivo} kind="bg" className="absolute inset-0">
          <SlideImagem
            src={capaMidia.file_url}
            mobile={mobile}
            tamanho="hero"
            priority={mobile}
            className="absolute inset-0 h-full w-full object-cover"
          />
        </CuboMagicoLens>
        <div className="absolute inset-0 z-[2] bg-gradient-to-b from-black/15 via-transparent to-black/45" />
        <CuboMagicoFundo enabled={cuboAtivo} mobile variant="dark" />
      </div>
    );
    const blocoTexto = (
      <div
        className={cn(
          'relative flex flex-1 flex-col justify-center',
          textAlign.items,
          textAlign.text,
        )}
        style={{
          background: leg.fundoPainel,
          paddingLeft: `max(${px}px, env(safe-area-inset-left))`,
          paddingRight: `max(${px}px, env(safe-area-inset-right))`,
          paddingTop: 28,
          paddingBottom: 28,
        }}
      >
        <div className={cn('flex w-full flex-col', mobileTextoColClass, textAlign.items)}>{textoCapa}</div>
      </div>
    );
    return (
      <section
        className={cn('relative w-full max-w-full flex flex-col overflow-hidden', minH)}
        style={{ scrollSnapAlign: 'start', ...SLIDE_CONTAINER_STYLE, ...cuboMagicoPeriodStyle(true) }}
      >
        {textoPrimeiro ? <>{blocoTexto}{blocoFoto}</> : <>{blocoFoto}{blocoTexto}</>}
        <ImagensExtrasDoBloco bloco={bloco} mobile={mobile} previewMode={previewMode} px={px} />
      </section>
    );
  }

  // Desktop com foto centralizada: imagem em destaque + texto empilhado
  if (capaMidia && !mobile && imgAlign === 'centro') {
    const textoPrimeiro = textoAntesImagem(textoPos);
    const blocoTexto = (
      <div
        className={cn('relative flex flex-1 flex-col justify-center py-12', textAlign.items, textAlign.text)}
        style={{ background: leg.fundoPainel, paddingLeft: px, paddingRight: px }}
      >
        <div className={cn('flex w-full max-w-lg flex-col', textAlign.items, 'mx-auto')}>
          {textoCapa}
        </div>
      </div>
    );
    const blocoFoto = (
      <div className="relative shrink-0 mx-auto overflow-hidden" style={{ aspectRatio: capaAspect, ...larguraImg }}>
        <CuboMagicoLens enabled={cuboAtivo} kind="bg" className="absolute inset-0">
          <SlideImagem src={capaMidia.file_url} mobile={mobile} tamanho="hero" priority={mobile} className="absolute inset-0 h-full w-full object-cover" />
        </CuboMagicoLens>
        <CuboMagicoFundo enabled={cuboAtivo} mobile={false} variant="dark" />
      </div>
    );
    return (
      <section
        className={cn('relative w-full max-w-full flex flex-col overflow-hidden', minH)}
        style={{ scrollSnapAlign: 'start', ...SLIDE_CONTAINER_STYLE, ...cuboMagicoPeriodStyle(false) }}
      >
        {textoPrimeiro ? <>{blocoTexto}{blocoFoto}</> : <>{blocoFoto}{blocoTexto}</>}
        <ImagensExtrasDoBloco bloco={bloco} mobile={mobile} previewMode={previewMode} px={px} />
      </section>
    );
  }

  // Desktop com foto lateral (esquerda ou direita)
  if (capaMidia && !mobile) {
    const textoPrimeiro = textoAntesImagem(textoPos);
    const fotoEl = (
      <div className="relative min-w-0 shrink-0 flex items-center justify-center bg-black/5 overflow-hidden" style={larguraImg}>
        <div className="relative w-full h-full min-h-full" style={{ aspectRatio: capaAspect }}>
          <CuboMagicoLens enabled={cuboAtivo} kind="bg" className="absolute inset-0">
            <SlideImagem src={capaMidia.file_url} mobile={mobile} tamanho="hero" priority={mobile} className="absolute inset-0 h-full w-full object-cover" />
          </CuboMagicoLens>
          <div className="absolute inset-0 z-[2] bg-gradient-to-r from-black/20 via-transparent to-black/35" />
          <CuboMagicoFundo enabled={cuboAtivo} mobile={false} variant="dark" />
        </div>
      </div>
    );
    const textoEl = (
      <div
        className={cn('relative flex min-w-0 flex-1 flex-col justify-center px-8 py-12', textAlign.items, textAlign.text)}
        style={{ background: leg.fundoPainel }}
      >
        <div className={cn('flex w-full max-w-md flex-col', textAlign.items)}>{textoCapa}</div>
      </div>
    );
    return (
      <section
        className={cn('relative w-full max-w-full flex flex-col overflow-hidden', minH)}
        style={{ scrollSnapAlign: 'start', ...SLIDE_CONTAINER_STYLE, ...cuboMagicoPeriodStyle(false) }}
      >
        <div className="flex flex-1 min-h-0 flex-row">
          {textoPrimeiro ? <>{textoEl}{fotoEl}</> : <>{fotoEl}{textoEl}</>}
        </div>
        <ImagensExtrasDoBloco bloco={bloco} mobile={mobile} previewMode={previewMode} px={px} />
      </section>
    );
  }

  return (
    <section
      className={cn('relative w-full max-w-full flex flex-col overflow-hidden', minH)}
      style={{ scrollSnapAlign: 'start', ...SLIDE_CONTAINER_STYLE, ...cuboMagicoPeriodStyle(mobile) }}
    >
      <div className="relative flex flex-1 min-h-0 overflow-hidden">
        <div className="absolute inset-0" style={{ background: leg.fundoAlternativo }} />
        {(capaMidia || p.fundoUrl) && (
          <>
            <CuboMagicoLens enabled={cuboAtivo} kind="bg" className="absolute inset-0 z-[1]">
              {capaMidia ? (
                <SlideImagem
                  src={capaMidia.file_url}
                  mobile={mobile}
                  tamanho="hero"
                  priority={mobile}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              ) : (
                <div
                  className="absolute inset-0 bg-cover bg-center"
                  style={{ backgroundImage: `url(${urlImagemApresentacao(p.fundoUrl, mobile, 'fundo')})` }}
                />
              )}
            </CuboMagicoLens>
            <div className="absolute inset-0 z-[2] bg-black/50" />
            <CuboMagicoFundo enabled={cuboAtivo} mobile={mobile} variant="dark" />
          </>
        )}
        <div
          className={cn(
            'relative z-10 flex min-w-0 w-full flex-col justify-center',
            mobile ? 'py-8 gap-3.5' : 'py-10 gap-5',
            textAlign.items,
            textAlign.text,
          )}
          style={{
            paddingLeft: mobile ? `max(${px}px, env(safe-area-inset-left))` : px,
            paddingRight: mobile ? `max(${px}px, env(safe-area-inset-right))` : px,
          }}
        >
          <div className={cn('flex w-full flex-col', mobile ? mobileTextoColClass : 'max-w-lg', textAlign.items)}>
            {textoCapa}
          </div>
        </div>
      </div>
      <ImagensExtrasDoBloco bloco={bloco} mobile={mobile} previewMode={previewMode} px={px} />
    </section>
  );
}

// ── Bloco: VALORIZAÇÃO ────────────────────────────────────────────────────────
// Layout alternado: foto como card flutuante, painel marrom + strip pêssego
function BlocoValorizacao({
  bloco, template, midias, indice, viewport, previewMode,
}: { bloco: OrcamentoSlideBloco; template: OrcamentoSlideTemplate | null; midias: OrcamentoSlideMidia[]; indice: number; viewport?: ViewportMode; previewMode?: boolean }) {
  const p = usePaleta(template);
  const leg = useEstilosLegibilidadeFundo(p);
  const mobile = isMobileViewport(viewport);
  const layout = resolveBlocoLayout(bloco.tipo, bloco.config, mobile ? 'mobile' : 'desktop');
  const foto = midiaValorizacao(midias, urlDoConfig(bloco.config, 'imagem_url'));
  const fotoOrientacao = orientacaoDoConfig(bloco.config);
  const imgAlign = layout.imagem_alinhamento;
  const painelEsquerda = imgAlign === 'direita';
  const imgCentered = imgAlign === 'centro';

  const pct = (bloco.config.percentual as string) || '30%';
  const titulo = (bloco.config.titulo as string) || 'Valorização Garantida';
  const texto = (bloco.config.texto as string) || 'Móveis planejados elevam o valor do seu imóvel e transformam a qualidade da sua vida.';

  const typo = slideTypography(mobile);
  const minH = useSectionMinH();
  const px = slidePaddingX(layout, mobile);
  const textAlign = mobile
    ? alinhamentoFlexClasses('centro')
    : alinhamentoFlexClasses(layout.alinhamento);
  const textoPos = layout.texto_posicao_imagem;
  const overlayDesktop = !mobile && !!foto && textoSobreImagem(textoPos);
  const sombraTexto = sombraTextoComFundo(overlayDesktop, leg);
  // No celular a foto ocupa a largura útil e fica centralizada (não herda alinhamento desktop).
  const larguraImg = larguraImagemStyle(mobile ? 100 : layout.foto_largura_pct);
  const textoCol = (
    <div
      className={cn(
        'flex min-w-0 flex-col justify-center gap-4',
        textAlign.items,
        textAlign.text,
        mobile ? 'mx-auto w-full max-w-[min(36rem,88%)] py-6' : 'gap-6 py-12 md:py-20',
      )}
      style={{
        width: overlayDesktop ? '100%' : mobile ? '100%' : `${layout.painel_largura_pct}%`,
        paddingLeft: overlayDesktop ? undefined : px,
        paddingRight: overlayDesktop ? undefined : px,
      }}
    >
      <div className="font-serif font-black leading-none" style={{ fontFamily: `'${p.tituloFont}', serif`, color: p.secundaria, ...typo.blocoDestaque, ...sombraTexto, ...reveal(0, previewMode) }} data-reveal={!previewMode || undefined}>
        {pct}
      </div>
      <h2 className="font-serif font-bold text-white" style={{ fontFamily: `'${p.tituloFont}', serif`, ...typo.blocoTitulo, ...sombraTexto, ...reveal(150, previewMode) }} data-reveal={!previewMode || undefined}>
        {titulo}
      </h2>
      <p style={{ color: 'rgba(255,255,255,0.72)', fontFamily: `'${p.corpoFont}', sans-serif`, ...typo.corpo, ...sombraTexto, ...reveal(280, previewMode) }} data-reveal={!previewMode || undefined}>
        {texto}
      </p>
    </div>
  );

  const fotoBoxStyle = mobile
    ? {
        // Celular: mantém o formato 1920×1080 (paisagem 16:9).
        aspectRatio: '16 / 9',
        width: '100%',
        maxWidth: '100%',
        height: 'auto',
        borderRadius: 12,
      }
    : {
        ...estiloContainerImagem(fotoOrientacao, { maxWidthRetratoDesktop: imgCentered ? 360 : 420 }),
        borderRadius: 16,
        maxHeight: fotoOrientacao === 'paisagem' ? 'min(70vh, 1080px)' : undefined,
        width: undefined as string | undefined,
        minHeight: undefined as string | undefined,
        height: undefined as string | undefined,
      };

  const fotoInner = foto ? (
    <div
      className="overflow-hidden shadow-2xl w-full"
      data-orcamento-imagem-frame=""
      data-orcamento-ratio="16/9"
      style={fotoBoxStyle}
    >
      <SlideImagem src={foto.file_url} alt="Projeto" mobile={mobile} tamanho="large" className="w-full h-full object-cover" />
    </div>
  ) : (
    <div
      className="w-full rounded-xl border-2 border-dashed flex items-center justify-center"
      data-orcamento-imagem-frame=""
      data-orcamento-ratio="16/9"
      style={{
        ...fotoBoxStyle,
        borderColor: `${p.secundaria}40`,
        color: `${p.secundaria}60`,
        ...reveal(100, previewMode),
      }}
      data-reveal={!previewMode || undefined}
    >
      <span style={{ fontFamily: `'${p.corpoFont}', sans-serif`, fontSize: 13 }}>Adicione imagens</span>
    </div>
  );

  const fotoCol = (
    <div
      className={cn(
        'flex items-center',
        mobile || imgCentered ? 'justify-center w-full' : imgAlign === 'esquerda' ? 'justify-start' : 'justify-end',
        mobile ? 'mx-auto w-full max-w-[min(36rem,88%)] px-0 pb-6' : 'py-8 px-4',
      )}
      style={{
        width: mobile || imgCentered ? '100%' : larguraImg.width,
        paddingLeft: mobile ? 0 : undefined,
        paddingRight: mobile ? 0 : undefined,
      }}
    >
      <div
        className={cn(mobile || imgCentered ? 'mx-auto w-full' : 'w-full')}
        style={mobile || imgCentered ? { width: '100%', maxWidth: '100%' } : { width: '100%' }}
      >
        {fotoInner}
      </div>
    </div>
  );

  if (!mobile && foto && textoSobreImagem(textoPos)) {
    return (
      <section
        className={cn('relative w-full max-w-full flex flex-col overflow-hidden', minH)}
        style={{ scrollSnapAlign: 'start', ...SLIDE_CONTAINER_STYLE }}
      >
        <div className="relative flex flex-1 min-h-0 overflow-hidden">
          <SlideImagem
            src={foto.file_url}
            alt="Projeto"
            mobile={mobile}
            tamanho="large"
            className="absolute inset-0 h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-black/40" />
          <div className="relative z-10 flex w-full flex-1 items-center justify-center px-8 py-12">
            <div
              className={cn('flex w-full max-w-xl flex-col', textAlign.items, textAlign.text)}
              style={{ ...ESTILO_PAINEL_TEXTO_SOBRE_IMAGEM, padding: '2.5rem 2rem' }}
            >
              {textoCol}
            </div>
          </div>
        </div>
        <ImagensExtrasDoBloco bloco={bloco} mobile={mobile} previewMode={previewMode} px={px} />
      </section>
    );
  }

  if (!mobile && imgCentered) {
    const textoPrimeiro = textoAntesImagem(textoPos);
    return (
      <section
        className={cn('relative w-full max-w-full flex flex-col overflow-hidden', minH)}
        style={{ scrollSnapAlign: 'start', ...SLIDE_CONTAINER_STYLE }}
      >
        <div className="absolute inset-0" style={{ background: leg.fundoAlternativo }} />
        <div className="absolute inset-0" style={{ background: leg.fundoPainel, height: '55%' }} />
        <div
          className="relative z-10 flex w-full flex-1 flex-col"
          style={{ flexDirection: textoPrimeiro ? 'column' : 'column-reverse' }}
        >
          <div style={{ width: '100%' }}>{textoCol}</div>
          <div style={{ background: leg.fundoAlternativo }}>{fotoCol}</div>
        </div>
        <ImagensExtrasDoBloco bloco={bloco} mobile={mobile} previewMode={previewMode} px={px} />
      </section>
    );
  }

  const flexDesktop = !mobile && !textoAntesImagem(textoPos) ? 'flex-row-reverse' : 'flex-row';

  return (
    <section
      className={cn(
        'relative w-full max-w-full flex flex-col overflow-hidden',
        minH,
        mobile && 'items-center',
      )}
      style={{ scrollSnapAlign: 'start', ...SLIDE_CONTAINER_STYLE }}
    >
      <div
        className={cn(
          'relative flex flex-1 min-h-0 items-stretch overflow-hidden',
          mobile && 'w-full items-center justify-center',
        )}
      >
        <div className="absolute inset-0" style={{ background: leg.fundoAlternativo }} />
        {!mobile && !imgCentered && (
          <div
            className="absolute top-0 h-full"
            style={{
              width: `${layout.painel_largura_pct}%`,
              background: leg.fundoPainel,
              left: painelEsquerda ? 0 : 'auto',
              right: painelEsquerda ? 'auto' : 0,
            }}
          />
        )}
        {mobile && <div className="absolute inset-0" style={{ background: leg.fundoPainel }} />}
        <div
          className={cn(
            'relative z-10 flex w-full min-w-0',
            mobile ? 'flex-col items-center justify-center px-0' : flexDesktop,
          )}
          style={mobile && layout.ordem_mobile === 'imagem_primeiro' ? { flexDirection: 'column-reverse' } : undefined}
        >
          {textoCol}
          {fotoCol}
        </div>
      </div>
      <ImagensExtrasDoBloco bloco={bloco} mobile={mobile} previewMode={previewMode} px={px} />
    </section>
  );
}

// ── Bloco: GALERIA DE PROJETOS ────────────────────────────────────────────────
function BlocoGaleria({
  bloco, template, midiasOrcamento, viewport, previewMode,
}: {
  bloco: OrcamentoSlideBloco;
  template: OrcamentoSlideTemplate | null;
  midiasOrcamento: OrcamentoSlideMidia[];
  viewport?: ViewportMode;
  previewMode?: boolean;
}) {
  const p = usePaleta(template);
  const leg = useEstilosLegibilidadeFundo(p);
  const mobile = isMobileViewport(viewport);
  const layout = resolveBlocoLayout(bloco.tipo, bloco.config, mobile ? 'mobile' : 'desktop');
  const etiqueta = textoDoConfig(bloco.config, 'etiqueta', 'galeria_projetos') || 'Portfólio';
  const titulo = textoDoConfig(bloco.config, 'titulo', 'galeria_projetos') || 'Nossos Projetos';
  const fotosConfig = imagensGaleriaDoConfig(bloco.config);
  const fotos = midiasGaleriaConfiguracao(fotosConfig);
  const orientacoesGaleria = fotosConfig;
  const cols = mobile ? 1 : Math.min(Math.max(fotos.length, 1), layout.colunas);
  const typo = slideTypography(mobile);
  const px = slidePaddingX(layout, mobile);
  const imgAlign = layout.imagem_alinhamento;
  // Celular: sempre centralizado (não herda alinhamento desktop).
  const textAlign = mobile
    ? alinhamentoFlexClasses('centro')
    : alinhamentoFlexClasses(layout.alinhamento);
  const larguraGaleria = mobile
    ? { width: '100%', maxWidth: 'min(36rem, 92%)' }
    : larguraImagemStyle(layout.foto_largura_pct);
  const minH = useSectionMinH();

  return (
    <section
      className={cn(
        'w-full max-w-full flex flex-col overflow-hidden',
        minH,
        mobile && 'items-center',
      )}
      style={{ background: leg.fundoSecao, scrollSnapAlign: 'start', ...SLIDE_CONTAINER_STYLE }}
    >
      <div
        className={cn(
          'pt-8 pb-5 flex-shrink-0 min-w-0 flex flex-col',
          textAlign.items,
          textAlign.text,
          mobile && 'mx-auto w-full max-w-[min(36rem,92%)]',
        )}
        style={{ paddingLeft: px, paddingRight: px }}
      >
        <p
          style={{
            color: `${p.secundaria}90`,
            fontFamily: `'${p.corpoFont}', sans-serif`,
            ...typo.etiqueta,
            ...leg.sombraTexto,
            ...reveal(0, previewMode),
          }}
          data-reveal={!previewMode || undefined}
        >
          {etiqueta}
        </p>
        <h2
          style={{ fontFamily: `'${p.tituloFont}', serif`, color: p.secundaria, fontWeight: 900, marginTop: 6, ...typo.blocoTitulo, ...leg.sombraTexto, ...reveal(100, previewMode) }}
          data-reveal={!previewMode || undefined}
        >
          {titulo}
        </h2>
      </div>

      <div
        className={cn(
          'flex-1 min-w-0 pb-8 mx-auto',
          mobile ? 'flex w-full flex-col items-center gap-3' : 'grid gap-3',
        )}
        style={{
          paddingLeft: px,
          paddingRight: px,
          ...larguraGaleria,
          gridTemplateColumns: mobile ? undefined : `repeat(${cols}, minmax(0, 1fr))`,
          justifyItems: !mobile && imgAlign === 'centro' ? 'center' : undefined,
        }}
      >
        {fotos.map((m, i) => {
          // Celular: sempre 1920×1080 (paisagem). Desktop respeita a orientação configurada.
          const orientacao = mobile ? 'paisagem' : (orientacoesGaleria[i]?.orientacao ?? 'paisagem');
          return (
            <div
              key={m.id}
              className={cn(
                'overflow-hidden w-full',
                mobile ? 'rounded-xl' : 'rounded-2xl',
                (mobile || imgAlign === 'centro') && 'mx-auto',
              )}
              data-orcamento-imagem-frame=""
              data-orcamento-ratio="16/9"
              style={{
                boxShadow: mobile ? `0 4px 24px ${p.primaria}80` : undefined,
                ...estiloContainerImagem(orientacao, { maxWidthRetratoDesktop: 320 }),
                ...(mobile
                  ? {
                      aspectRatio: '16 / 9',
                      width: '100%',
                      maxWidth: '100%',
                      height: 'auto',
                    }
                  : null),
              }}
            >
              <SlideImagem
                src={m.file_url}
                alt={m.file_name || 'Projeto'}
                mobile={mobile}
                tamanho="medium"
                className="w-full h-full object-cover"
              />
            </div>
          );
        })}
        {fotos.length === 0 && (
          <div
            className="rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-3 px-4 text-center"
            style={{ borderColor: `${p.secundaria}30`, minHeight: mobile ? 200 : '50vh' }}
          >
            <span style={{ color: `${p.secundaria}50`, fontFamily: `'${p.corpoFont}', sans-serif`, ...typo.corpo }}>
              Configure as imagens deste bloco nas configurações do template
            </span>
          </div>
        )}
      </div>
    </section>
  );
}

// Fotos e vídeos da etapa Visual — imagens em slides; vídeos empilhados um sob o outro.
function BlocoImagensOrcamento({
  bloco,
  template,
  orcamento,
  midiasOrcamento,
  perguntas,
  viewport,
  previewMode,
}: {
  bloco: OrcamentoSlideBloco;
  template: OrcamentoSlideTemplate | null;
  orcamento: OrcamentoSlide;
  midiasOrcamento: OrcamentoSlideMidia[];
  perguntas?: OrcamentoPergunta[];
  viewport?: ViewportMode;
  previewMode?: boolean;
}) {
  const p = usePaleta(template);
  const leg = useEstilosLegibilidadeFundo(p);
  const mobile = isMobileViewport(viewport);
  const { omitVideos } = useSlideLayoutContext();
  const layout = resolveBlocoLayout(bloco.tipo, bloco.config, mobile ? 'mobile' : 'desktop');
  const fotos = resolverFotosImagensOrcamento(
    midiasOrcamento,
    orcamento.dados?.respostas ?? {},
    perguntas ?? [],
  );
  const imagens = fotos.filter((f) => !isOrcamentoMidiaVideo(f));
  const videos = fotos.filter((f) => isOrcamentoMidiaVideo(f));
  const typo = slideTypography(mobile);
  const px = slidePaddingX(layout, mobile);
  const py = mobile ? 28 : 40;
  const textAlign = alinhamentoFlexClasses(layout.alinhamento);
  const etiqueta = textoDoConfig(bloco.config, 'etiqueta', 'imagens_orcamento') || 'Projeto';
  const titulo = textoDoConfig(bloco.config, 'titulo', 'imagens_orcamento') || 'Imagens do seu orçamento';
  const minH = useSectionMinH();
  const temFundo = !!urlImagemFundoDoConfig(bloco.config);

  if (fotos.length === 0 && !previewMode && !temFundo) return null;

  const paginasImagem: (OrcamentoSlideMidia | null)[] =
    imagens.length === 0 && videos.length === 0 ? [null] : imagens;
  const indiceCabecalho = paginasImagem.length > 0 ? 0 : -1;

  const cabecalho = (
    <div className={cn('shrink-0 min-w-0 flex flex-col mb-4 md:mb-6', textAlign.items, textAlign.text)}>
      <p
        style={{
          color: `${p.secundaria}90`,
          fontFamily: `'${p.corpoFont}', sans-serif`,
          ...typo.etiqueta,
          ...leg.sombraTexto,
          ...reveal(0, previewMode),
        }}
        data-reveal={!previewMode || undefined}
      >
        {etiqueta}
      </p>
      <h2
        style={{
          fontFamily: `'${p.tituloFont}', serif`,
          color: p.secundaria,
          fontWeight: 900,
          marginTop: 6,
          ...typo.blocoTitulo,
          ...leg.sombraTexto,
          ...reveal(100, previewMode),
        }}
        data-reveal={!previewMode || undefined}
      >
        {titulo}
      </h2>
    </div>
  );

  const renderFrameMidia = (
    foto: OrcamentoSlideMidia,
    opts: { isVideo: boolean; priority?: boolean; fillMobileVideo?: boolean },
  ) => {
    const { isVideo, priority = false, fillMobileVideo = false } = opts;
    const fill = fillMobileVideo && mobile && isVideo;

    return (
      <div
        data-orcamento-foto-frame=""
        className={cn(
          'relative flex min-h-0 items-center justify-center overflow-hidden',
          fill
            ? 'h-full w-full rounded-none'
            : cn(
                'h-full w-full',
                mobile ? 'rounded-xl' : 'rounded-2xl',
                !isVideo &&
                  'bg-[radial-gradient(ellipse_at_center,rgba(255,248,240,0.08),transparent_70%)]',
              ),
        )}
        style={{
          boxShadow: fill
            ? undefined
            : isVideo
              ? `0 12px 36px rgba(0,0,0,0.5)`
              : `0 6px 28px ${p.secundaria}18, inset 0 0 0 1px ${p.secundaria}12`,
          background: isVideo ? '#000' : 'rgba(0,0,0,0.06)',
          ...(fill
            ? { width: '100%', height: '100%', maxHeight: '100%' }
            : isVideo
              ? {
                  width: '100%',
                  maxWidth: mobile ? '100%' : 520,
                  aspectRatio: '9 / 16',
                  maxHeight: mobile ? 'min(78dvh, 720px)' : 'min(72dvh, 820px)',
                  marginInline: 'auto',
                }
              : {
                  ...estiloContainerImagem('paisagem'),
                  maxHeight: previewMode
                    ? '100%'
                    : !mobile
                      ? 'min(calc(100dvh - 80px), 1080px)'
                      : '100%',
                  height: previewMode ? '100%' : undefined,
                }),
        }}
      >
        <SlideMidia
          src={foto.file_url}
          alt={foto.file_name || (isVideo ? 'Vídeo do orçamento' : 'Imagem do orçamento')}
          fileName={foto.file_name}
          mobile={mobile}
          tamanho="hero"
          redimensionar={fill ? 'cover' : isVideo ? 'cover' : 'contain'}
          priority={priority}
          forceFillMobile={fill}
          className={
            fill || isVideo
              ? 'h-full w-full object-cover'
              : 'max-h-full max-w-full object-contain'
          }
          wrapperClassName={
            fill || isVideo
              ? 'absolute inset-0 h-full w-full'
              : 'flex h-full w-full items-center justify-center'
          }
        />
      </div>
    );
  };

  const cabecalhoVideo = (indice: number) => (
    <div className={cn('shrink-0 min-w-0 flex flex-col mb-4 md:mb-6', textAlign.items, textAlign.text)}>
      <p
        style={{
          color: `${p.secundaria}90`,
          fontFamily: `'${p.corpoFont}', sans-serif`,
          ...typo.etiqueta,
          ...leg.sombraTexto,
          ...reveal(0, previewMode),
        }}
        data-reveal={!previewMode || undefined}
      >
        Vídeos{videos.length > 1 ? ` · ${indice + 1}/${videos.length}` : ''}
      </p>
      <h2
        style={{
          fontFamily: `'${p.tituloFont}', serif`,
          color: p.secundaria,
          fontWeight: 900,
          marginTop: 6,
          ...typo.blocoTitulo,
          ...leg.sombraTexto,
          ...reveal(80, previewMode),
        }}
        data-reveal={!previewMode || undefined}
      >
        Do seu projeto
      </h2>
      <div
        className="mt-3 h-px w-12"
        style={{ background: `linear-gradient(90deg, ${p.secundaria}, transparent)` }}
        aria-hidden
      />
    </div>
  );

  return (
    <>
      {paginasImagem.map((foto, i) => {
        const isLastImage = i === paginasImagem.length - 1;
        const showExtras = isLastImage && videos.length === 0;

        return (
          <OrcamentoSlideShell key={foto?.id ?? `${bloco.id}-vazio`} bloco={bloco}>
            <section
              className={cn('w-full max-w-full flex flex-col overflow-hidden', minH)}
              style={{
                background: leg.fundoSecao,
                padding: `${py}px ${px}px`,
                ...SLIDE_CONTAINER_STYLE,
              }}
            >
              {i === indiceCabecalho && cabecalho}

              {foto ? (
                <div
                  className="flex-1 min-h-0 w-full max-w-6xl mx-auto flex items-center justify-center"
                  style={reveal(80 + i * 40, previewMode)}
                  data-reveal={!previewMode || undefined}
                >
                  {renderFrameMidia(foto, {
                    isVideo: false,
                    priority: previewMode || i === indiceCabecalho,
                  })}
                </div>
              ) : (
                <div
                  className="flex-1 min-h-0 flex items-center justify-center rounded-xl border border-dashed px-6"
                  style={{ borderColor: `${p.secundaria}35`, color: `${p.secundaria}70` }}
                >
                  <p style={{ fontFamily: `'${p.corpoFont}', sans-serif`, ...typo.corpo, textAlign: 'center' }}>
                    As imagens e vídeos aparecem aqui quando forem enviados na etapa Visual do orçamento.
                  </p>
                </div>
              )}

              {showExtras && (
                <ImagensExtrasDoBloco bloco={bloco} mobile={mobile} previewMode={previewMode} px={px} />
              )}
            </section>
          </OrcamentoSlideShell>
        );
      })}

  // Também não renderiza a lista de slides de vídeo (evita montar players).
      {omitVideos
        ? null
        : videos.map((video, i) => {
        const isLastVideo = i === videos.length - 1;
        const fillMobile = mobile && !previewMode;

        return (
          <OrcamentoSlideShell key={video.id} bloco={bloco} videoSlide>
            <section
              className={cn(
                'w-full max-w-full flex flex-col overflow-hidden',
                fillMobile ? 'absolute inset-0 h-full min-h-0' : minH,
              )}
              style={{
                background: fillMobile ? '#000' : leg.fundoSecao,
                padding: fillMobile ? 0 : `${py}px ${px}px`,
                ...SLIDE_CONTAINER_STYLE,
              }}
            >
              {!fillMobile && cabecalhoVideo(i)}

              <div
                className={cn(
                  'flex min-h-0 w-full flex-1 items-center justify-center',
                  fillMobile ? 'absolute inset-0 max-w-none' : 'mx-auto max-w-6xl',
                )}
                style={reveal(80 + i * 40, previewMode)}
                data-reveal={!previewMode || undefined}
              >
                {renderFrameMidia(video, {
                  isVideo: true,
                  priority: i === 0,
                  fillMobileVideo: fillMobile,
                })}
              </div>

              {isLastVideo && !fillMobile && (
                <ImagensExtrasDoBloco bloco={bloco} mobile={mobile} previewMode={previewMode} px={px} />
              )}
            </section>
          </OrcamentoSlideShell>
        );
      })}
    </>
  );
}

function FerragemCard({
  item,
  p,
  mobile,
  previewMode,
  index,
  escalaVisual,
  compact = false,
}: {
  item: FerragemExibicao;
  p: ReturnType<typeof usePaleta>;
  mobile: boolean;
  previewMode?: boolean;
  index: number;
  escalaVisual?: BlocoEscalaVisual;
  /** Modo compacto — cabe vários cards na mesma página do celular. */
  compact?: boolean;
}) {
  const imgH = alturaCardFerragem(mobile, escalaVisual);
  const tituloPx = mobile ? (compact ? 13 : 15) : 17;
  const descPx = mobile ? (compact ? 11 : 12) : 13;
  const fator = escalaVisual === 'maxima' ? 1.38 : escalaVisual === 'grande' ? 1.18 : 1;

  return (
    <article
      className={cn(
        'ferragem-card group relative flex h-full overflow-hidden rounded-2xl',
        mobile ? 'flex-row items-stretch gap-0' : 'flex-col',
      )}
      style={{
        ['--fc-i' as string]: index,
        background: 'linear-gradient(165deg, #FFF9F1 0%, #F3E6D4 100%)',
        boxShadow: '0 10px 28px rgba(20, 10, 4, 0.18), inset 0 1px 0 rgba(255,255,255,0.65)',
        ...reveal(80 + index * 70, previewMode),
      }}
      data-reveal={!previewMode || undefined}
      data-animate={!previewMode ? 'true' : undefined}
    >
      <div
        className="pointer-events-none absolute left-0 top-0 z-[4] h-full w-[3px]"
        style={{ background: `linear-gradient(180deg, ${p.secundaria}, ${p.secundaria}40)` }}
        aria-hidden
      />
      <div
        className={cn(
          'ferragem-card__media flex shrink-0 items-center justify-center overflow-hidden',
          mobile ? (compact ? 'w-[34%] min-w-[5.75rem]' : 'w-[42%] min-w-[8.25rem]') : 'w-full',
        )}
        style={{
          background: 'radial-gradient(ellipse at 40% 30%, #FFFDF8, #E8D5BC)',
          height: mobile ? 'auto' : imgH,
          minHeight: mobile ? (compact ? 76 : 128) : undefined,
        }}
      >
        {item.imagem_url ? (
          <SlideImagem
            src={item.imagem_url}
            alt={item.titulo}
            mobile={mobile}
            tamanho={mobile ? 'medium' : 'small'}
            redimensionar="contain"
            className={cn(
              'object-contain transition-transform duration-500 ease-out group-hover:scale-[1.04]',
              mobile ? (compact ? 'h-full w-full p-1.5' : 'h-full w-full p-2.5') : 'max-h-full max-w-full p-3',
            )}
            data-orcamento-icone-ferragem=""
          />
        ) : (
          <span
            className="ferragem-card__index select-none"
            style={{
              color: p.primaria,
              fontFamily: `'${p.tituloFont}', serif`,
              fontSize: mobile ? (compact ? 26 : 34) : 40,
              fontWeight: 900,
              opacity: mobile ? 0.78 : 0.55,
              letterSpacing: '-0.03em',
              textShadow: `0 1px 0 rgba(255,255,255,0.55), 0 0 0 1px ${p.secundaria}33`,
            }}
            aria-hidden
          >
            {String(index + 1).padStart(2, '0')}
          </span>
        )}
      </div>
      <div
        className={cn(
          'relative z-[1] flex min-w-0 flex-1 flex-col justify-center',
          mobile
            ? compact
              ? 'gap-0.5 px-2 py-1.5'
              : 'gap-1.5 px-3.5 py-3.5'
            : 'gap-2 px-5 pb-5 pt-4',
        )}
      >
        <p
          style={{
            fontFamily: `'${p.tituloFont}', serif`,
            fontWeight: 700,
            fontSize: tituloPx * fator,
            lineHeight: 1.2,
            color: p.primaria,
          }}
        >
          {item.titulo}
        </p>
        {item.descricao?.trim() ? (
          <p
            style={{
              fontFamily: `'${p.corpoFont}', sans-serif`,
              fontSize: descPx * fator,
              lineHeight: 1.45,
              color: '#6B4E35',
              display: '-webkit-box',
              WebkitLineClamp: compact ? 2 : 3,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {item.descricao}
          </p>
        ) : null}
      </div>
    </article>
  );
}

// ── Bloco: COMPARATIVO FERRAGENS ──────────────────────────────────────────────
function BlocoComparativoFerragens({
  bloco,
  orcamento,
  template,
  midias,
  perguntas,
  catalogoFerragens,
  viewport,
  previewMode,
}: {
  bloco: OrcamentoSlideBloco;
  orcamento: OrcamentoSlide;
  template: OrcamentoSlideTemplate | null;
  midias: OrcamentoSlideMidia[];
  perguntas?: OrcamentoPergunta[];
  catalogoFerragens?: OrcamentoCatalogoItem[];
  viewport?: ViewportMode;
  previewMode?: boolean;
}) {
  const p = usePaleta(template);
  const leg = useEstilosLegibilidadeFundo(p);
  const mobile = isMobileViewport(viewport);
  const etiqueta = textoDoConfig(bloco.config, 'etiqueta', 'comparativo_ferragens') || 'Qualidade';
  const titulo = textoDoConfig(bloco.config, 'titulo', 'comparativo_ferragens') || 'Ferragens Premium';
  const intro = textoDoConfig(bloco.config, 'texto', 'comparativo_ferragens')
    || 'Usamos apenas ferragens certificadas que garantem durabilidade, suavidade e acabamento impecável.';
  const itensConfig = (bloco.config.itens as Array<{ titulo: string; descricao: string; imagem_url?: string }>) ?? [];
  const ferragensEscolhidas = resolverFerragensSelecionadas(
    orcamento.dados?.respostas ?? {},
    perguntas ?? [],
    catalogoFerragens ?? [],
  );
  const catalogoAtivo = (catalogoFerragens ?? []).filter((c) => c.categoria === 'ferragem' && c.ativo);

  const enriquecerComCatalogo = (item: FerragemExibicao): FerragemExibicao => {
    if (item.imagem_url?.trim()) return item;
    const chave = item.titulo
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '');
    const match = catalogoAtivo.find((c) => {
      const ct = c.titulo
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_|_$/g, '');
      return ct === chave || ct.includes(chave) || chave.includes(ct);
    });
    if (!match?.imagem_url?.trim()) return item;
    return {
      ...item,
      descricao: item.descricao?.trim() || match.descricao?.trim() || '',
      imagem_url: match.imagem_url.trim(),
    };
  };

  const itens: FerragemExibicao[] =
    (ferragensEscolhidas.length > 0
      ? ferragensEscolhidas
      : itensConfig.map((item) => ({
          titulo: item.titulo,
          descricao: item.descricao,
          imagem_url: item.imagem_url,
        }))
    ).map(enriquecerComCatalogo);
  const layout = resolveBlocoLayout(bloco.tipo, bloco.config, mobile ? 'mobile' : 'desktop');
  const typo = slideTypography(mobile, layout.escala_visual);
  const minH = useSectionMinH(layout);
  const px = slidePaddingX(layout, mobile);
  const fotoComparativoRaw = midiaComparativoFerragens(midias, urlDoConfig(bloco.config, 'imagem_url'));
  // Nunca renderiza vídeo nesta página (evita player/gradiente flutuando sobre os cards).
  const fotoComparativo =
    fotoComparativoRaw && !isOrcamentoMidiaVideo(fotoComparativoRaw) ? fotoComparativoRaw : null;
  const textAlign = mobile
    ? alinhamentoFlexClasses('centro')
    : alinhamentoFlexClasses(layout.alinhamento);
  // Compacta cards no celular para caber todos na mesma página.
  const cardsCompactos = mobile && itens.length >= 3;

  const cabecalho = (
    <header
      className={cn(
        'relative z-10 flex flex-col',
        mobile ? (cardsCompactos ? 'gap-1.5' : 'gap-2.5') : 'gap-3',
        textAlign.items,
        textAlign.text,
      )}
    >
      <p
        style={{
          color: `${p.secundaria}90`,
          fontFamily: `'${p.corpoFont}', sans-serif`,
          letterSpacing: '0.18em',
          ...typo.etiqueta,
          ...(cardsCompactos ? { fontSize: 11 } : null),
          ...leg.sombraTexto,
          ...reveal(0, previewMode),
        }}
        data-reveal={!previewMode || undefined}
      >
        {etiqueta}
      </p>
      <h2
        style={{
          fontFamily: `'${p.tituloFont}', serif`,
          color: p.secundaria,
          fontWeight: 900,
          ...typo.blocoTitulo,
          ...(cardsCompactos ? { fontSize: 24, lineHeight: 1.15 } : null),
          ...leg.sombraTexto,
          ...reveal(90, previewMode),
        }}
        data-reveal={!previewMode || undefined}
      >
        {titulo}
      </h2>
      <div
        className={cn(mobile ? 'h-px w-10 mx-auto' : 'h-0.5 w-14')}
        style={{
          background: `linear-gradient(90deg, ${p.secundaria}, transparent)`,
          ...reveal(140, previewMode),
          ...(cardsCompactos ? { display: 'none' } : null),
        }}
        data-reveal={!previewMode || undefined}
        aria-hidden
      />
      <p
        className={cn(textAlign.self, mobile && 'mx-auto')}
        style={{
          color: 'rgba(255,248,238,0.72)',
          fontFamily: `'${p.corpoFont}', sans-serif`,
          maxWidth: mobile ? 'min(36rem, 92%)' : 520,
          ...typo.corpo,
          ...(cardsCompactos
            ? {
                fontSize: 12,
                lineHeight: 1.3,
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
              }
            : null),
          ...leg.sombraTexto,
          ...reveal(180, previewMode),
        }}
        data-reveal={!previewMode || undefined}
      >
        {intro}
      </p>
    </header>
  );

  const gradeItens = itens.length > 0 && (
    <div
      className={cn(
        'relative z-10 grid w-full',
        mobile
          ? cn('mx-auto max-w-[min(36rem,92%)] grid-cols-1', cardsCompactos ? 'gap-1.5' : 'gap-3')
          : cn('gap-4 lg:gap-5', classesGridFerragens(itens.length, false)),
      )}
      style={{
        paddingLeft: mobile ? `max(${px}px, env(safe-area-inset-left))` : px,
        paddingRight: mobile ? `max(${px}px, env(safe-area-inset-right))` : px,
      }}
    >
      {itens.map((item, i) => (
        <FerragemCard
          key={`${item.titulo}-${i}`}
          item={item}
          p={p}
          mobile={mobile}
          previewMode={previewMode}
          index={i}
          escalaVisual={layout.escala_visual}
          compact={cardsCompactos}
        />
      ))}
    </div>
  );

  // Mobile: todos os cards na mesma página (compactos se forem muitos).
  if (mobile) {
    return (
      <OrcamentoSlideShell bloco={bloco}>
        <section
          className={cn('relative w-full flex flex-col overflow-hidden items-center', minH)}
          style={{
            background: leg.fundoSecao,
            scrollSnapAlign: 'start',
            ...SLIDE_CONTAINER_STYLE,
          }}
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-40"
            style={{
              background: `radial-gradient(ellipse at 20% 0%, ${p.secundaria}18, transparent 55%)`,
            }}
            aria-hidden
          />
          <div
            className={cn(
              'relative z-10 flex min-h-0 w-full flex-1 flex-col items-center justify-center overflow-hidden',
              cardsCompactos ? 'gap-2.5 py-4' : 'gap-5 py-7',
            )}
          >
            <div
              className="w-full max-w-[min(36rem,92%)]"
              style={{
                paddingLeft: `max(${px}px, env(safe-area-inset-left))`,
                paddingRight: `max(${px}px, env(safe-area-inset-right))`,
              }}
            >
              {cabecalho}
            </div>
            {!cardsCompactos && fotoComparativo && (
              <div
                className="relative mx-auto w-full overflow-hidden rounded-xl"
                style={{
                  maxWidth: 'min(36rem, 92%)',
                  aspectRatio: '16 / 10',
                  maxHeight: '22%',
                  marginLeft: `max(${px}px, env(safe-area-inset-left))`,
                  marginRight: `max(${px}px, env(safe-area-inset-right))`,
                  boxShadow: '0 12px 32px rgba(0,0,0,0.28)',
                }}
              >
                <img
                  src={urlImagemApresentacao(fotoComparativo.file_url, true, 'large', 'cover')}
                  alt={fotoComparativo.file_name || 'Comparativo de ferragens'}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 to-transparent"
                  aria-hidden
                />
              </div>
            )}
            {gradeItens}
          </div>
          <ImagensExtrasDoBloco bloco={bloco} mobile={mobile} previewMode={previewMode} px={px} />
        </section>
      </OrcamentoSlideShell>
    );
  }

  // Desktop: composição editorial — cabeçalho + grade (sem Cubo Mágico).
  return (
    <OrcamentoSlideShell bloco={bloco}>
      <section
        className={cn('relative w-full flex flex-col overflow-hidden', minH)}
        style={{
          background: leg.fundoSecao,
          scrollSnapAlign: 'start',
          ...SLIDE_CONTAINER_STYLE,
        }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background: `
            radial-gradient(ellipse at 12% 18%, ${p.secundaria}14, transparent 42%),
            radial-gradient(ellipse at 88% 80%, rgba(0,0,0,0.22), transparent 50%)
          `,
          }}
          aria-hidden
        />
        <div className="relative z-10 flex min-h-0 flex-1 flex-col justify-center gap-8 py-10">
          <div
            className={cn(
              'flex w-full items-end justify-between gap-8',
              textAlign.items === 'items-center' && 'flex-col items-center text-center',
            )}
            style={{ paddingLeft: px, paddingRight: px }}
          >
            {cabecalho}
            {fotoComparativo && (
              <div
                className="relative hidden shrink-0 overflow-hidden rounded-2xl lg:block"
                style={{
                  width: 'min(34%, 380px)',
                  aspectRatio: '4 / 3',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.35)',
                  ...reveal(220, previewMode),
                }}
                data-reveal={!previewMode || undefined}
              >
                <img
                  src={urlImagemApresentacao(fotoComparativo.file_url, false, 'large', 'cover')}
                  alt={fotoComparativo.file_name || 'Comparativo de ferragens'}
                  className="absolute inset-0 h-full w-full object-cover"
                  loading="lazy"
                  decoding="async"
                />
                <div
                  className="pointer-events-none absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-black/10"
                  aria-hidden
                />
              </div>
            )}
          </div>
          {gradeItens}
        </div>
        <ImagensExtrasDoBloco bloco={bloco} mobile={mobile} previewMode={previewMode} px={px} />
      </section>
    </OrcamentoSlideShell>
  );
}

// ── Bloco: PRECIFICAÇÃO ───────────────────────────────────────────────────────
function BlocoPrecificacao({
  bloco, orcamento, template, viewport, previewMode, valorOrcamentoLead = 0, formasPagamento = [],
}: {
  bloco: OrcamentoSlideBloco;
  orcamento: OrcamentoSlide;
  template: OrcamentoSlideTemplate | null;
  viewport?: ViewportMode;
  previewMode?: boolean;
  valorOrcamentoLead?: number;
  formasPagamento?: OrcamentoFormaPagamento[];
}) {
  const p = usePaleta(template);
  const leg = useEstilosLegibilidadeFundo(p);
  const mobile = isMobileViewport(viewport);
  const layout = resolveBlocoLayout(bloco.tipo, bloco.config, mobile ? 'mobile' : 'desktop');
  const typo = slideTypography(mobile, layout.escala_visual);
  const minH = useSectionMinH(layout);
  const px = slidePaddingX(layout, mobile);
  const textAlign = alinhamentoFlexClasses(layout.alinhamento);
  const titulo = (bloco.config.titulo as string) || 'Investimento';
  const prec = resolverPrecificacaoApresentacao({
    dados: orcamento.dados,
    valorOrcamentoLead,
    formasPagamento,
  });
  const temValor = precificacaoTemValor(prec);
  const opcoesPagamento = opcoesPagamentoApresentacao(prec, formasPagamento);
  const multiplasFormas = opcoesPagamento.length > 1;
  const fator = layout.escala_visual === 'maxima' ? 1.38 : layout.escala_visual === 'grande' ? 1.18 : 1;
  const paletaPrec = {
    primaria: p.primaria,
    secundaria: p.secundaria,
    tituloFont: p.tituloFont,
    corpoFont: p.corpoFont,
  };

  const mostrarMarkup =
    precificacaoMarkupAtivo(prec) && markupComposicaoTemConteudo(prec.markup_composicao);
  const linhasMarkup = mostrarMarkup
    ? linhasMarkupComposicaoApresentacao(prec.markup_composicao)
    : [];
  const totalMarkup = mostrarMarkup ? somaMarkupComposicao(prec.markup_composicao) : 0;

  return (
    <section
      className={cn('w-full max-w-full flex flex-col justify-safe-center py-10 gap-6', textAlign.items, minH)}
      style={{ background: leg.fundoSecao, scrollSnapAlign: 'start', paddingLeft: px, paddingRight: px, ...SLIDE_CONTAINER_STYLE }}
    >
      <p style={{ color: `${p.secundaria}80`, fontFamily: `'${p.corpoFont}', sans-serif`, ...typo.etiqueta, ...leg.sombraTexto, ...reveal(0, previewMode) }} data-reveal={!previewMode || undefined}>
        Proposta financeira
      </p>
      <h2
        className={cn('font-serif font-bold text-white max-w-full text-balance', textAlign.text)}
        style={{ fontFamily: `'${p.tituloFont}', serif`, ...typo.blocoTitulo, ...leg.sombraTexto, ...reveal(80, previewMode) }}
        data-reveal={!previewMode || undefined}
      >
        {titulo}
      </h2>

      {mostrarMarkup && (
        <div className={cn('flex w-full max-w-2xl flex-col gap-3', textAlign.self)}>
          <p
            style={{
              color: `${p.secundaria}90`,
              fontFamily: `'${p.corpoFont}', sans-serif`,
              ...typo.etiqueta,
              ...leg.sombraTexto,
              ...reveal(120, previewMode),
            }}
            data-reveal={!previewMode || undefined}
          >
            Composição do investimento
          </p>
          <div
            className="w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-black/25 backdrop-blur-sm"
            style={{
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 20px 40px rgba(0,0,0,0.3)',
              ...reveal(160, previewMode),
            }}
            data-reveal={!previewMode || undefined}
          >
            {linhasMarkup.map((linha, i) => (
              <div
                key={linha.chave}
                className={cn(
                  'flex items-baseline justify-between gap-4 px-5 py-3.5 sm:px-6 sm:py-4',
                  i < linhasMarkup.length - 1 && 'border-b border-white/[0.07]',
                )}
                style={reveal(180 + i * 60, previewMode)}
                data-reveal={!previewMode || undefined}
              >
                <span
                  className="min-w-0 flex-1 text-left leading-snug"
                  style={{
                    color: 'rgba(255,255,255,0.78)',
                    fontFamily: `'${p.corpoFont}', sans-serif`,
                    fontSize: (mobile ? 14 : 16) * fator,
                  }}
                >
                  {linha.label}
                </span>
                <span
                  className="shrink-0 tabular-nums font-semibold"
                  style={{
                    color: p.secundaria,
                    fontFamily: `'${p.tituloFont}', serif`,
                    fontSize: (mobile ? 16 : 18) * fator,
                  }}
                >
                  {BRL(linha.valor)}
                </span>
              </div>
            ))}
            <div
              className="flex items-baseline justify-between gap-4 border-t border-amber-400/25 bg-amber-500/[0.08] px-5 py-4 sm:px-6"
              style={reveal(360, previewMode)}
              data-reveal={!previewMode || undefined}
            >
              <span
                className="font-medium"
                style={{
                  color: 'rgba(255,255,255,0.92)',
                  fontFamily: `'${p.corpoFont}', sans-serif`,
                  fontSize: (mobile ? 14 : 15) * fator,
                }}
              >
                Total
              </span>
              <span
                className="tabular-nums font-bold"
                style={{
                  color: p.secundaria,
                  fontFamily: `'${p.tituloFont}', serif`,
                  fontSize: (mobile ? 20 : 24) * fator,
                }}
              >
                {BRL(totalMarkup)}
              </span>
            </div>
          </div>
        </div>
      )}

      {temValor ? (
        <div className={cn('flex min-w-0 flex-col gap-5 w-full max-w-full', textAlign.items)}>
          {opcoesPagamento.length > 0 && (
            <div className={cn('flex w-full max-w-full flex-col gap-4', multiplasFormas || mostrarMarkup ? 'mt-1' : '')}>
              {(multiplasFormas || mostrarMarkup) && (
                <p
                  style={{
                    color: `${p.secundaria}90`,
                    fontFamily: `'${p.corpoFont}', sans-serif`,
                    ...typo.etiqueta,
                    ...leg.sombraTexto,
                    ...reveal(mostrarMarkup ? 400 : 160, previewMode),
                  }}
                  data-reveal={!previewMode || undefined}
                >
                  {mostrarMarkup ? 'Preço e pagamento' : 'Opções de pagamento'}
                </p>
              )}
              <div className={cn('grid w-full max-w-2xl grid-cols-1 gap-4', textAlign.self)}>
                {opcoesPagamento.map((opcao, opcaoIndex) => (
                  <div
                    key={opcao.formaId}
                    className="w-full"
                    style={reveal((mostrarMarkup ? 440 : 200) + opcaoIndex * 90, previewMode)}
                    data-reveal={!previewMode || undefined}
                  >
                    <PrecificacaoOpcaoCard
                      opcao={opcao}
                      paleta={paletaPrec}
                      mobile={mobile}
                      fator={fator}
                      variant={multiplasFormas ? 'slide' : 'slide-hero'}
                      textAlign={
                        textAlign.text === 'text-center'
                          ? 'center'
                          : textAlign.text === 'text-right'
                            ? 'right'
                            : 'left'
                      }
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <p style={{ color: 'rgba(255,255,255,0.5)', fontFamily: `'${p.corpoFont}', sans-serif`, ...typo.corpo }}>
          Valor a definir em reunião.
        </p>
      )}

      <div className="w-16 h-0.5" style={{ background: `${p.secundaria}60`, ...reveal(450, previewMode) }} data-reveal={!previewMode || undefined} />
      <ImagensExtrasDoBloco bloco={bloco} mobile={mobile} previewMode={previewMode} px={0} />
    </section>
  );
}

// ── Bloco: PREÇOS FRACIONADOS ───────────────────────────────────────────────────
function BlocoPrecosFracionados({
  bloco, orcamento, template, viewport, previewMode,
}: {
  bloco: OrcamentoSlideBloco;
  orcamento: OrcamentoSlide;
  template: OrcamentoSlideTemplate | null;
  viewport?: ViewportMode;
  previewMode?: boolean;
}) {
  const p = usePaleta(template);
  const leg = useEstilosLegibilidadeFundo(p);
  const mobile = isMobileViewport(viewport);
  const layout = resolveBlocoLayout(bloco.tipo, bloco.config, mobile ? 'mobile' : 'desktop');
  const typo = slideTypography(mobile, layout.escala_visual);
  const minH = useSectionMinH(layout);
  const px = slidePaddingX(layout, mobile);
  const textAlign = alinhamentoFlexClasses(layout.alinhamento);
  const fator = layout.escala_visual === 'maxima' ? 1.38 : layout.escala_visual === 'grande' ? 1.18 : 1;

  const { faithfulPreview } = useSlideLayoutContext();
  const modoExemplo = slidePrecosFracionadosModoExemplo({ previewMode, faithfulPreview });
  const prec = normalizarPrecificacao(orcamento.dados?.precificacao);
  const fracionarAtivo = precificacaoFracionadaAtiva(prec);

  if (!fracionarAtivo && !modoExemplo) return null;

  const grupos = resolverGruposFracionadosApresentacao({
    precificacao: prec,
    itensTemplate: itensFracionadosDoConfig(bloco.config),
    permitirItensTemplate: modoExemplo,
  });

  if (!grupos.length && !modoExemplo) return null;

  const etiqueta = textoDoConfig(bloco.config, 'etiqueta', 'precos_fracionados') || 'Detalhamento';
  const titulo = textoDoConfig(bloco.config, 'titulo', 'precos_fracionados') || 'Valores separados';

  const gruposExibir = grupos.length > 0
    ? grupos
    : modoExemplo
      ? [
          {
            id: 'exemplo',
            itens: [
              { label: 'Cozinha', valor: 7807 },
              { label: 'Quarto — roupeiro, escrivaninha e painel', valor: 11900 },
              { label: 'Banheiro (sem espelho)', valor: 500 },
              { label: 'Lavanderia', valor: 4230 },
              { label: 'Cristaleira', valor: 4000 },
            ],
            exibir_total: true,
          },
        ]
      : [];

  let revealOffset = 160;

  return (
    <section
      className={cn('w-full max-w-full flex flex-col justify-safe-center py-10 gap-7', textAlign.items, minH)}
      style={{ background: leg.fundoSecao, scrollSnapAlign: 'start', paddingLeft: px, paddingRight: px, ...SLIDE_CONTAINER_STYLE }}
    >
      <p
        style={{ color: `${p.secundaria}80`, fontFamily: `'${p.corpoFont}', sans-serif`, ...typo.etiqueta, ...leg.sombraTexto, ...reveal(0, previewMode) }}
        data-reveal={!previewMode || undefined}
      >
        {etiqueta}
      </p>
      <h2
        className={cn('font-serif font-bold text-white max-w-full', textAlign.text)}
        style={{ fontFamily: `'${p.tituloFont}', serif`, ...typo.blocoTitulo, ...leg.sombraTexto, ...reveal(80, previewMode) }}
        data-reveal={!previewMode || undefined}
      >
        {titulo}
      </h2>

      <div className={cn('flex w-full max-w-2xl flex-col gap-6', textAlign.items)}>
        {gruposExibir.map((grupo) => {
          const itensExibir = grupo.itens;
          const total = somaItensFracionados(itensExibir);
          const mostrarTotal = modoExemplo ? true : grupo.exibir_total !== false;
          const grupoStart = revealOffset;
          revealOffset += itensExibir.length * 70 + (mostrarTotal ? 80 : 40);

          return (
            <div key={grupo.id} className="flex w-full flex-col gap-3">
              {grupo.titulo && (
                <p
                  className={cn('font-serif font-semibold text-white/90', textAlign.text)}
                  style={{
                    fontFamily: `'${p.tituloFont}', serif`,
                    fontSize: (mobile ? 16 : 18) * fator,
                    ...leg.sombraTexto,
                    ...reveal(grupoStart - 40, previewMode),
                  }}
                  data-reveal={!previewMode || undefined}
                >
                  {grupo.titulo}
                </p>
              )}
              <div
                className="w-full overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20 backdrop-blur-sm"
                style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06), 0 24px 48px rgba(0,0,0,0.35)' }}
              >
                {itensExibir.map((item, i) => (
                  <div
                    key={`${grupo.id}-${item.label}-${i}`}
                    className={cn(
                      'flex items-baseline justify-between gap-4 px-5 py-4 sm:px-6 sm:py-5',
                      i < itensExibir.length - 1 && 'border-b border-white/[0.07]',
                    )}
                    style={reveal(grupoStart + i * 70, previewMode)}
                    data-reveal={!previewMode || undefined}
                  >
                    <span
                      className="min-w-0 flex-1 text-left leading-snug"
                      style={{
                        color: 'rgba(255,255,255,0.88)',
                        fontFamily: `'${p.corpoFont}', sans-serif`,
                        fontSize: (mobile ? 15 : 17) * fator,
                        fontWeight: 500,
                        ...leg.sombraTexto,
                      }}
                    >
                      {item.label}
                    </span>
                    <span
                      className="shrink-0 tabular-nums font-semibold tracking-tight"
                      style={{
                        color: p.secundaria,
                        fontFamily: `'${p.tituloFont}', serif`,
                        fontSize: (mobile ? 16 : 19) * fator,
                        ...leg.sombraTexto,
                      }}
                    >
                      {BRL(item.valor)}
                    </span>
                  </div>
                ))}
              </div>

              {mostrarTotal && total > 0 && (
                <div
                  className={cn('flex w-full items-center justify-between gap-4 pt-1', textAlign.text === 'text-center' && 'justify-center')}
                  style={reveal(grupoStart + itensExibir.length * 70 + 40, previewMode)}
                  data-reveal={!previewMode || undefined}
                >
                  <span
                    style={{
                      color: 'rgba(255,255,255,0.45)',
                      fontFamily: `'${p.corpoFont}', sans-serif`,
                      fontSize: (mobile ? 12 : 13) * fator,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                    }}
                  >
                    Total parcial
                  </span>
                  <span
                    className="tabular-nums font-black"
                    style={{
                      color: '#FFFFFF',
                      fontFamily: `'${p.tituloFont}', serif`,
                      fontSize: (mobile ? 20 : 24) * fator,
                      ...leg.sombraTexto,
                    }}
                  >
                    {BRL(total)}
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="w-16 h-0.5" style={{ background: `${p.secundaria}60`, ...reveal(500, previewMode) }} data-reveal={!previewMode || undefined} />
      <ImagensExtrasDoBloco bloco={bloco} mobile={mobile} previewMode={previewMode} px={0} />
    </section>
  );
}

// ── Bloco: PRAZOS ─────────────────────────────────────────────────────────────
function BlocoPrazos({
  bloco, orcamento, template, viewport, previewMode,
}: { bloco: OrcamentoSlideBloco; orcamento: OrcamentoSlide; template: OrcamentoSlideTemplate | null; viewport?: ViewportMode; previewMode?: boolean }) {
  const p = usePaleta(template);
  const leg = useEstilosLegibilidadeFundo(p);
  const mobile = isMobileViewport(viewport);
  const layout = resolveBlocoLayout(bloco.tipo, bloco.config, mobile ? 'mobile' : 'desktop');
  const typo = slideTypography(mobile);
  const px = slidePaddingX(layout, mobile);
  const textAlign = alinhamentoFlexClasses(layout.alinhamento);
  const titulo = textoDoConfig(bloco.config, 'titulo', 'prazos') || 'Prazos de Execução';
  const corpo = textoDoConfig(bloco.config, 'texto', 'prazos')
    || 'Trabalhamos com planejamento rigoroso para entregar no prazo combinado, sem surpresas.';
  const dados = orcamento.dados;
  const minH = useSectionMinH();
  const prevista = resolverDataPrevistaEntrega(dados ?? {});
  const diasPrazo = prevista?.dias;
  const prazoLabel =
    diasPrazo != null
      ? formatarPrazoEmDias(diasPrazo)
      : dados?.prazo_entrega?.trim() || '';
  const temPrazo = orcamentoTemDadosDePrazo(dados);

  // Sem dados de prazo: não renderiza slide em branco.
  if (!temPrazo) return null;

  const cardPrazoStyle = {
    background: `${p.secundaria}12`,
    border: `1px solid ${p.secundaria}28`,
  };
  const cardDestaqueStyle = {
    background: `linear-gradient(145deg, ${p.secundaria}22 0%, ${p.secundaria}10 55%, transparent 100%)`,
    border: `1px solid ${p.secundaria}45`,
    boxShadow: `0 10px 28px ${p.secundaria}14`,
  };

  const cardsPrazo = (
    <>
      {dados?.inicio_execucao && (
        <div className="rounded-xl px-5 py-4 shadow-md" style={{ ...cardPrazoStyle, ...reveal(0, previewMode) }} data-reveal={!previewMode || undefined}>
          <p style={{ color: `${p.secundaria}80`, fontFamily: `'${p.corpoFont}', sans-serif`, ...typo.etiqueta }}>Início da execução</p>
          <p style={{ fontFamily: `'${p.tituloFont}', serif`, color: p.secundaria, fontSize: mobile ? '1.35rem' : 28, fontWeight: 900, marginTop: 4 }}>{formatarDataInicioExecucao(dados.inicio_execucao)}</p>
        </div>
      )}
      {prazoLabel && (
        <div className="rounded-xl px-5 py-4 shadow-md" style={{ ...cardPrazoStyle, ...reveal(120, previewMode) }} data-reveal={!previewMode || undefined}>
          <p style={{ color: `${p.secundaria}80`, fontFamily: `'${p.corpoFont}', sans-serif`, ...typo.etiqueta }}>Prazo de entrega</p>
          <p style={{ fontFamily: `'${p.tituloFont}', serif`, color: p.secundaria, fontSize: mobile ? '1.5rem' : 32, fontWeight: 900, marginTop: 4 }}>{prazoLabel}</p>
        </div>
      )}
      {prevista && (
        <div className="rounded-xl px-5 py-4" style={{ ...cardDestaqueStyle, ...reveal(220, previewMode) }} data-reveal={!previewMode || undefined}>
          <p style={{ color: `${p.secundaria}90`, fontFamily: `'${p.corpoFont}', sans-serif`, letterSpacing: '0.12em', textTransform: 'uppercase', fontSize: mobile ? 10 : 11, fontWeight: 700 }}>
            Data prevista de entrega
          </p>
          <p
            style={{
              fontFamily: `'${p.tituloFont}', serif`,
              color: p.secundaria,
              fontSize: mobile ? '1.65rem' : 36,
              fontWeight: 900,
              marginTop: 6,
              letterSpacing: '-0.02em',
            }}
          >
            {prevista.label}
          </p>
          {dados?.inicio_execucao && (
            <p style={{ color: `${p.secundaria}70`, fontFamily: `'${p.corpoFont}', sans-serif`, marginTop: 6, fontSize: mobile ? 12 : 13 }}>
              {prazoLabel} a partir do início
            </p>
          )}
        </div>
      )}
    </>
  );

  if (mobile) {
    return (
      <section
        className={cn('relative w-full flex flex-col overflow-hidden', minH)}
        style={{ background: leg.fundoSecao, scrollSnapAlign: 'start', ...SLIDE_CONTAINER_STYLE }}
      >
        <div
          className={cn('py-8 flex flex-col', textAlign.items, textAlign.text)}
          style={{ background: leg.fundoPainel, paddingLeft: px, paddingRight: px }}
        >
          <p style={{ color: `${p.secundaria}70`, fontFamily: `'${p.corpoFont}', sans-serif`, ...typo.etiqueta, ...leg.sombraTexto, ...reveal(0, previewMode) }} data-reveal={!previewMode || undefined}>Cronograma</p>
          <h2 style={{ fontFamily: `'${p.tituloFont}', serif`, color: p.secundaria, fontWeight: 900, marginTop: 8, ...typo.blocoTitulo, ...reveal(80, previewMode) }} data-reveal={!previewMode || undefined}>
            {titulo}
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.72)', fontFamily: `'${p.corpoFont}', sans-serif`, marginTop: 12, ...typo.corpo, ...reveal(160, previewMode) }} data-reveal={!previewMode || undefined}>
            {corpo}
          </p>
        </div>
        <div className="flex flex-col gap-3 py-8 flex-1" style={{ paddingLeft: px, paddingRight: px }}>
          {cardsPrazo}
        </div>
        <ImagensExtrasDoBloco bloco={bloco} mobile={mobile} previewMode={previewMode} px={px} />
      </section>
    );
  }

  return (
    <section
      className={cn('relative w-full flex flex-col overflow-hidden', minH)}
      style={{ background: leg.fundoSecao, scrollSnapAlign: 'start', ...SLIDE_CONTAINER_STYLE }}
    >
      <div className="relative z-10 flex w-full flex-1 min-h-0 flex-row">
        <div className="flex flex-col justify-center px-10 md:px-14 py-16 gap-6 w-[45%]">
          {cardsPrazo}
        </div>
        <div className={cn('flex flex-col justify-center px-10 md:px-14 py-16 gap-5 w-[55%]', textAlign.items, textAlign.text)}>
          <p style={{ color: `${p.secundaria}70`, fontFamily: `'${p.corpoFont}', sans-serif`, ...typo.etiqueta, ...leg.sombraTexto, ...reveal(80, previewMode) }} data-reveal={!previewMode || undefined}>Cronograma</p>
          <h2 style={{ fontFamily: `'${p.tituloFont}', serif`, color: p.secundaria, fontWeight: 900, ...typo.blocoTitulo, ...reveal(160, previewMode) }} data-reveal={!previewMode || undefined}>
            {titulo}
          </h2>
          <p
            className={textAlign.self}
            style={{ color: 'rgba(255,255,255,0.65)', fontFamily: `'${p.corpoFont}', sans-serif`, maxWidth: 380, ...typo.corpo, ...reveal(260, previewMode) }}
            data-reveal={!previewMode || undefined}
          >
            {corpo}
          </p>
        </div>
      </div>
      <ImagensExtrasDoBloco bloco={bloco} mobile={mobile} previewMode={previewMode} px={px} />
    </section>
  );
}

// Resumo das respostas do formulário — ambientes, MDF, garantia e demais perguntas.
function BlocoDadosProjeto({
  bloco,
  orcamento,
  template,
  perguntas = [],
  catalogoItens = [],
  viewport,
  previewMode,
}: {
  bloco: OrcamentoSlideBloco;
  orcamento: OrcamentoSlide;
  template: OrcamentoSlideTemplate | null;
  perguntas?: OrcamentoPergunta[];
  catalogoItens?: OrcamentoCatalogoItem[];
  viewport?: ViewportMode;
  previewMode?: boolean;
}) {
  const p = usePaleta(template);
  const leg = useEstilosLegibilidadeFundo(p);
  const mobile = isMobileViewport(viewport);
  const layout = resolveBlocoLayout(bloco.tipo, bloco.config, mobile ? 'mobile' : 'desktop');
  const typo = slideTypography(mobile);
  const px = slidePaddingX(layout, mobile);
  const py = mobile ? 28 : 40;
  const textAlign = alinhamentoFlexClasses(layout.alinhamento);
  const etiqueta = textoDoConfig(bloco.config, 'etiqueta', 'dados_projeto') || 'Seu projeto';
  const titulo = textoDoConfig(bloco.config, 'titulo', 'dados_projeto') || 'Dados do projeto';
  const minH = useSectionMinH();
  const itens = resolverItensDadosProjeto(orcamento, perguntas, catalogoItens);
  const temFundo = !!urlImagemFundoDoConfig(bloco.config);

  if (!dadosProjetoTemConteudo(itens) && !previewMode && !temFundo) return null;

  const cols = mobile ? 1 : 2;
  const itensExibir = itens.length > 0
    ? itens
    : previewMode
      ? (perguntas.length > 0
        ? perguntas.map((pergunta) => ({
            id: pergunta.id,
            label: pergunta.label,
            valor: 'Exemplo de resposta',
            origem: 'pergunta' as const,
          }))
        : [
            { id: '_ex1', label: 'Ambientes', valor: 'Cozinha, Sala', origem: 'pergunta' as const },
            { id: '_ex2', label: 'MDF', valor: 'Premium', origem: 'pergunta' as const },
            { id: '_ex3', label: 'Garantia', valor: '24 meses', origem: 'campo' as const },
          ])
      : [];

  return (
    <section
      className={cn('w-full max-w-full flex flex-col justify-center gap-8 overflow-hidden', minH)}
      style={{
        background: leg.fundoSecao,
        scrollSnapAlign: 'start',
        padding: `${py}px ${px}px`,
        ...SLIDE_CONTAINER_STYLE,
      }}
    >
      <div className={cn('flex flex-col gap-3', textAlign.items, textAlign.text)}>
        <p
          style={{ color: `${p.secundaria}70`, fontFamily: `'${p.corpoFont}', sans-serif`, ...typo.etiqueta, ...leg.sombraTexto, ...reveal(0, previewMode) }}
          data-reveal={!previewMode || undefined}
        >
          {etiqueta}
        </p>
        <h2
          style={{ fontFamily: `'${p.tituloFont}', serif`, color: p.secundaria, fontWeight: 900, ...typo.blocoTitulo, ...leg.sombraTexto, ...reveal(80, previewMode) }}
          data-reveal={!previewMode || undefined}
        >
          {titulo}
        </h2>
      </div>

      <div
        className={cn('grid gap-3 w-full mx-auto', mobile ? 'grid-cols-1 max-w-lg' : 'max-w-4xl')}
        style={{ gridTemplateColumns: mobile ? undefined : `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {itensExibir.map((item, i) => (
          <div
            key={item.id}
            className="rounded-xl px-5 py-4"
            style={{
              background: `${p.secundaria}12`,
              border: `1px solid ${p.secundaria}28`,
              ...reveal(120 + i * 50, previewMode),
            }}
            data-reveal={!previewMode || undefined}
          >
            <p style={{ color: `${p.secundaria}80`, fontFamily: `'${p.corpoFont}', sans-serif`, ...typo.etiqueta }}>
              {item.label}
            </p>
            <p
              style={{
                color: 'white',
                fontFamily: `'${p.corpoFont}', sans-serif`,
                fontWeight: 600,
                marginTop: 6,
                fontSize: mobile ? '0.95rem' : '1.05rem',
                lineHeight: 1.45,
              }}
            >
              {item.valor}
            </p>
          </div>
        ))}
      </div>
      <ImagensExtrasDoBloco bloco={bloco} mobile={mobile} previewMode={previewMode} px={0} />
    </section>
  );
}

// ── Bloco: GARANTIA ───────────────────────────────────────────────────────────
function BlocoGarantia({
  bloco, orcamento, template, viewport, previewMode,
}: { bloco: OrcamentoSlideBloco; orcamento: OrcamentoSlide; template: OrcamentoSlideTemplate | null; viewport?: ViewportMode; previewMode?: boolean }) {
  const p = usePaleta(template);
  const leg = useEstilosLegibilidadeFundo(p);
  const mobile = isMobileViewport(viewport);
  const layout = resolveBlocoLayout(bloco.tipo, bloco.config, mobile ? 'mobile' : 'desktop');
  const typo = slideTypography(mobile);
  const px = slidePaddingX(layout, mobile);
  const textAlign = alinhamentoFlexClasses(layout.alinhamento);
  const titulo = (bloco.config.titulo as string) || 'Garantia';
  const meses = orcamento.dados?.garantia_meses || (bloco.config.meses as string) || '24';
  const texto = (bloco.config.texto as string) || 'Todos os nossos móveis possuem garantia total de fábrica e suporte pós-venda.';
  const minH = useSectionMinH();

  return (
    <section
      className={cn(
        'w-full flex flex-col justify-center py-10 gap-8',
        minH,
        textAlign.items,
        textAlign.text,
      )}
      style={{ background: leg.fundoSecao, scrollSnapAlign: 'start', paddingLeft: px, paddingRight: px, ...SLIDE_CONTAINER_STYLE }}
    >
      <div className={cn('flex flex-col gap-3', textAlign.items)}>
        <p style={{ color: `${p.secundaria}70`, fontFamily: `'${p.corpoFont}', sans-serif`, ...typo.etiqueta, ...leg.sombraTexto, ...reveal(0, previewMode) }} data-reveal={!previewMode || undefined}>
          Compromisso
        </p>
        <h2 style={{ fontFamily: `'${p.tituloFont}', serif`, color: p.secundaria, fontWeight: 900, ...typo.blocoTitulo, ...leg.sombraTexto, ...reveal(80, previewMode) }} data-reveal={!previewMode || undefined}>
          {titulo}
        </h2>
      </div>

      <div
        className={cn('flex gap-5', mobile ? 'flex-col w-full max-w-sm' : 'items-center', textAlign.items)}
        style={{ ...reveal(180, previewMode) }}
        data-reveal={!previewMode || undefined}
      >
        <div
          className="rounded-2xl flex flex-col items-center justify-center shrink-0"
          style={{
            background: `${p.secundaria}15`,
            border: `1px solid ${p.secundaria}30`,
            padding: mobile ? '20px 28px' : 32,
            minWidth: mobile ? 120 : 160,
          }}
        >
          <span style={{ fontFamily: `'${p.tituloFont}', serif`, color: p.secundaria, fontSize: mobile ? '3rem' : 72, fontWeight: 900, lineHeight: 1 }}>
            {meses}
          </span>
          <span style={{ color: `${p.secundaria}80`, ...typo.etiqueta, fontFamily: `'${p.corpoFont}', sans-serif`, marginTop: 4 }}>
            meses
          </span>
        </div>
        <div className={cn('flex flex-col gap-2', textAlign.items)}>
          <p style={{ color: 'white', fontFamily: `'${p.tituloFont}', serif`, fontWeight: 700, fontSize: mobile ? '1.15rem' : 22 }}>
            de Garantia Total
          </p>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontFamily: `'${p.corpoFont}', sans-serif`, maxWidth: mobile ? '100%' : 480, ...typo.corpo }}>
            {texto}
          </p>
        </div>
      </div>
      <ImagensExtrasDoBloco bloco={bloco} mobile={mobile} previewMode={previewMode} px={0} />
    </section>
  );
}

// ── Dispatcher ────────────────────────────────────────────────────────────────
function RenderBloco({
  bloco, orcamento, template, midias, midiasOrcamento, perguntas, catalogoFerragens, catalogoItens, indice, viewport, previewMode,
  valorOrcamentoLead, formasPagamento,
}: {
  bloco: OrcamentoSlideBloco;
  orcamento: OrcamentoSlide;
  template: OrcamentoSlideTemplate | null;
  midias: OrcamentoSlideMidia[];
  midiasOrcamento: OrcamentoSlideMidia[];
  perguntas?: OrcamentoPergunta[];
  catalogoFerragens?: OrcamentoCatalogoItem[];
  catalogoItens?: OrcamentoCatalogoItem[];
  indice: number;
  viewport?: ViewportMode;
  previewMode?: boolean;
  valorOrcamentoLead?: number;
  formasPagamento?: OrcamentoFormaPagamento[];
}) {
  const shared = { viewport, previewMode };
  switch (bloco.tipo) {
    case 'capa':
      return withImagemFundo(bloco, <BlocoCapa bloco={bloco} orcamento={orcamento} template={template} midias={midias} {...shared} />);
    case 'valorizacao':
      return withImagemFundo(bloco, <BlocoValorizacao bloco={bloco} template={template} midias={midias} indice={indice} {...shared} />);
    case 'comparativo_ferragens':
      return (
        <BlocoComparativoFerragens
          bloco={bloco}
          orcamento={orcamento}
          template={template}
          midias={midias}
          perguntas={perguntas}
          catalogoFerragens={catalogoFerragens}
          {...shared}
        />
      );
    case 'galeria_projetos':
      return withImagemFundo(bloco, <BlocoGaleria bloco={bloco} template={template} midiasOrcamento={midiasOrcamento} {...shared} />);
    case 'precificacao':
      return withImagemFundo(
        bloco,
        <BlocoPrecificacao
          bloco={bloco}
          orcamento={orcamento}
          template={template}
          valorOrcamentoLead={valorOrcamentoLead}
          formasPagamento={formasPagamento}
          {...shared}
        />,
      );
    case 'precos_fracionados':
      return withImagemFundo(
        bloco,
        <BlocoPrecosFracionados
          bloco={bloco}
          orcamento={orcamento}
          template={template}
          {...shared}
        />,
      );
    case 'prazos':
      return withImagemFundo(bloco, <BlocoPrazos bloco={bloco} orcamento={orcamento} template={template} viewport={viewport} previewMode={previewMode} />);
    case 'garantia':
      return withImagemFundo(bloco, <BlocoGarantia bloco={bloco} orcamento={orcamento} template={template} viewport={viewport} previewMode={previewMode} />);
    case 'dados_projeto':
      return withImagemFundo(
        bloco,
        <BlocoDadosProjeto
          bloco={bloco}
          orcamento={orcamento}
          template={template}
          perguntas={perguntas}
          catalogoItens={catalogoItens}
          viewport={viewport}
          previewMode={previewMode}
        />,
      );
    case 'imagens_orcamento':
      return (
        <BlocoImagensOrcamento
          bloco={bloco}
          template={template}
          orcamento={orcamento}
          midiasOrcamento={midiasOrcamento}
          perguntas={perguntas}
          viewport={viewport}
          previewMode={previewMode}
        />
      );
    case 'analise_ia':
      return (
        <BlocoAnaliseIASlides
          bloco={bloco}
          orcamento={orcamento}
          template={template}
          viewport={viewport}
          previewMode={previewMode}
        />
      );
    default:
      return null;
  }
}

// ── Componente principal ──────────────────────────────────────────────────────
export const OrcamentoSlideApresentacao = forwardRef<HTMLDivElement, Props>(function OrcamentoSlideApresentacao({
  orcamento,
  template,
  blocos,
  midias,
  perguntas,
  catalogoFerragens,
  className,
  viewport,
  previewMode = false,
  valorOrcamentoLead = 0,
  formasPagamento = [],
  midiasOrcamento,
  embeddedInLayout = false,
  faithfulPreview = false,
  omitVideos = false,
  catalogoItens,
}, ref) {
  const midiasOrcamentoEfetivas = midiasOrcamento ?? midias;
  const containerRef = useRef<HTMLDivElement>(null);
  const effectiveViewport = useEffectiveViewport(viewport);

  const p = usePaleta(template);
  const precificacao = orcamento.dados?.precificacao;
  const precosFracionadosModoExemplo = slidePrecosFracionadosModoExemplo({ previewMode, faithfulPreview });
  // Respeita ocultar também na prévia/PDF (previewMode=true na exportação).
  const ocultarAnaliseIa = isAnaliseIaOcultaNoOrcamento(orcamento);
  const blocosAtivos = blocos
    .filter((b) => b.ativo)
    .filter((b) => !(ocultarAnaliseIa && b.tipo === 'analise_ia'))
    .filter((b) => !(b.tipo === 'prazos' && !orcamentoTemDadosDePrazo(orcamento.dados)))
    .filter(
      (b) =>
        b.tipo !== 'precos_fracionados'
        || precificacaoFracionadaAtiva(precificacao)
        || precosFracionadosModoExemplo,
    )
    .sort((a, b) => a.ordem - b.ordem);
  const catalogoRespostas = catalogoItens ?? catalogoFerragens ?? [];
  // Blocos + viewport: troca desktop↔celular remonta o HTML e precisa re-revelar.
  const revealContentRev = `${effectiveViewport}|${blocosAtivos.map((b) => `${b.id}:${b.ordem}`).join('|')}`;
  const layoutCtx: SlideLayoutContextValue = {
    previewMode,
    mobile: isMobileViewport(effectiveViewport),
    embeddedInLayout,
    faithfulPreview,
    omitVideos,
  };

  useScrollReveal(
    containerRef as React.RefObject<HTMLElement>,
    previewMode,
    embeddedInLayout,
    revealContentRev,
  );

  return (
    <SlideLayoutContext.Provider value={layoutCtx}>
    <div
      ref={(node) => {
        containerRef.current = node;
        if (typeof ref === 'function') ref(node);
        else if (ref) ref.current = node;
      }}
      data-orcamento-apresentacao
      data-viewport={effectiveViewport}
      data-preview-static={previewMode ? 'true' : undefined}
      className={cn(
        'w-full max-w-full overflow-x-hidden overflow-y-auto scroll-smooth',
        embeddedInLayout && 'h-full min-h-0',
        effectiveViewport === 'mobile' && (!previewMode || faithfulPreview) && 'snap-y snap-mandatory',
        className,
      )}
      style={{
        // Celular: snap firme (um slide por gesto). Desktop/tablet: proximity
        // para conseguir rolar slides longos (markup + preços) sem travar.
        scrollSnapType:
          effectiveViewport === 'mobile' && (faithfulPreview || !previewMode)
            ? 'y mandatory'
            : 'y proximity',
        fontFamily: `'${p.corpoFont}', sans-serif`,
        background: p.primaria,
        ...SLIDE_CONTAINER_STYLE,
      }}
    >
      {blocosAtivos.map((bloco, i) => (
        <RenderBloco
          key={bloco.id}
          bloco={bloco}
          orcamento={orcamento}
          template={template}
          midias={midias}
          midiasOrcamento={midiasOrcamentoEfetivas}
          perguntas={perguntas}
          catalogoFerragens={catalogoFerragens}
          catalogoItens={catalogoRespostas}
          indice={i}
          viewport={effectiveViewport}
          previewMode={previewMode}
          valorOrcamentoLead={valorOrcamentoLead}
          formasPagamento={formasPagamento}
        />
      ))}
      {blocosAtivos.length === 0 && (
        <div
          className={cn(
            'w-full flex flex-col items-center justify-center gap-4 text-center px-8',
            embeddedInLayout ? 'h-full min-h-full' : 'min-h-screen',
          )}
          style={{ background: p.primaria }}
        >
          <div style={{ color: `${p.secundaria}60`, fontSize: 48 }}>○</div>
          <p style={{ color: 'rgba(255,255,255,0.4)', fontFamily: `'${p.corpoFont}', sans-serif` }}>
            Nenhum bloco ativo. Configure o template para adicionar blocos.
          </p>
        </div>
      )}
    </div>
    </SlideLayoutContext.Provider>
  );
});

OrcamentoSlideApresentacao.displayName = 'OrcamentoSlideApresentacao';
