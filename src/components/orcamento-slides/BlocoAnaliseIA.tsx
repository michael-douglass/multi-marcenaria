import { useMemo } from 'react';
import type { CSSProperties } from 'react';
import { Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { OrcamentoSlide, OrcamentoSlideBloco, OrcamentoSlideTemplate } from '@/lib/orcamento-slide-types';
import {
  alinhamentoFlexClasses,
  isMobileViewport,
  resolveBlocoLayout,
  type ViewportMode,
} from '@/lib/orcamento-slide-layout';
import { urlImagemFundoDoConfig } from '@/lib/orcamento-slide-bloco-imagens';
import {
  OrcamentoSlideShell,
  useEstilosLegibilidadeFundo,
} from '@/components/orcamento-slides/bloco-fundo-imagem';
import { SlideMarkdownContent } from '@/components/orcamento-slides/SlideMarkdownContent';
import { normalizarRelatorioAnaliseIa } from '@/lib/lead-ai-relatorio-markdown';
import {
  analiseIaTemConteudo,
  ANALISE_IA_TEXTO_PREVIEW,
  resolveAnaliseIaConteudo,
} from '@/lib/orcamento-slide-analise-ia';
import { paginarConteudoAnaliseIa } from '@/lib/orcamento-slide-analise-ia-paginacao';
import type { MarkdownContentBlock } from '@/lib/lead-ai-formatted-content';
import { PALETA_PADRAO } from '@/lib/orcamento-slide-types';
import {
  slidePaddingX,
  slideTypography,
  SLIDE_CONTAINER_STYLE,
} from '@/lib/orcamento-slide-typography';

function reveal(delay = 0, previewMode = false): CSSProperties {
  if (previewMode) return { opacity: 1, transform: 'none' };
  return { '--reveal-delay': `${delay}ms` } as React.CSSProperties;
}

function usePaleta(template: OrcamentoSlideTemplate | null) {
  return {
    primaria: template?.cor_primaria ?? PALETA_PADRAO.corPrimaria,
    secundaria: template?.cor_secundaria ?? PALETA_PADRAO.corSecundaria,
    fundo: template?.cor_fundo ?? PALETA_PADRAO.corFundo,
    texto: template?.cor_texto ?? '#FFFFFF',
    tituloFont: template?.fonte_titulo ?? 'Playfair Display',
    corpoFont: template?.fonte_corpo ?? 'Lato',
    logoUrl: template?.logo_url ?? null,
    fundoUrl: template?.fundo_url ?? null,
  };
}

interface BlocoAnaliseIAPaginaProps {
  bloco: OrcamentoSlideBloco;
  template: OrcamentoSlideTemplate | null;
  viewport?: ViewportMode;
  previewMode?: boolean;
  etiqueta: string;
  titulo: string;
  blocks: MarkdownContentBlock[];
  pageIndex: number;
  totalPages: number;
  showFullHeader: boolean;
}

function BlocoAnaliseIAPagina({
  bloco,
  template,
  viewport,
  previewMode,
  etiqueta,
  titulo,
  blocks,
  pageIndex,
  totalPages,
  showFullHeader,
}: BlocoAnaliseIAPaginaProps) {
  const p = usePaleta(template);
  const leg = useEstilosLegibilidadeFundo(p);
  const mobile = isMobileViewport(viewport);
  const layout = resolveBlocoLayout(bloco.tipo, bloco.config, mobile ? 'mobile' : 'desktop');
  const typo = slideTypography(mobile);
  const px = slidePaddingX(layout, mobile);
  const textAlign = alinhamentoFlexClasses(layout.alinhamento);
  const py = mobile ? 20 : 32;
  const paginaLabel = String(pageIndex + 1).padStart(2, '0');
  const totalLabel = String(totalPages).padStart(2, '0');

  return (
    <section
      className="relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden"
      style={{
        background: leg.fundoSecao,
        ...SLIDE_CONTAINER_STYLE,
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.05]"
        style={{
          backgroundImage: `radial-gradient(ellipse 80% 50% at 15% 0%, ${p.secundaria}44 0%, transparent 55%), radial-gradient(ellipse 60% 40% at 95% 100%, ${p.secundaria}28 0%, transparent 50%)`,
        }}
      />

      <div
        className={cn('relative z-10 flex min-h-0 flex-1 flex-col', mobile ? 'gap-4' : 'gap-5')}
        style={{ padding: `${py}px ${px}px` }}
      >
        <header className={cn('flex shrink-0 flex-col gap-2.5', textAlign.items, textAlign.text)}>
          {showFullHeader ? (
            <>
              <div
                className="inline-flex items-center gap-2 rounded-full px-3 py-1"
                style={{
                  background: `${p.secundaria}14`,
                  border: `1px solid ${p.secundaria}33`,
                  ...reveal(0, previewMode),
                }}
                data-reveal={!previewMode || undefined}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0" style={{ color: p.secundaria }} aria-hidden />
                <p
                  style={{
                    color: `${p.secundaria}cc`,
                    fontFamily: `'${p.corpoFont}', sans-serif`,
                    ...typo.etiqueta,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                  }}
                >
                  {etiqueta}
                </p>
              </div>

              <h2
                style={{
                  fontFamily: `'${p.tituloFont}', serif`,
                  color: p.secundaria,
                  fontWeight: 900,
                  ...typo.blocoTitulo,
                  ...leg.sombraTexto,
                  ...reveal(50, previewMode),
                }}
                data-reveal={!previewMode || undefined}
              >
                {titulo}
              </h2>

              <div
                className={cn(mobile ? 'w-14' : 'w-20', 'h-px')}
                style={{
                  background: `linear-gradient(90deg, ${p.secundaria}, transparent)`,
                  ...reveal(90, previewMode),
                }}
                data-reveal={!previewMode || undefined}
              />
            </>
          ) : (
            <div
              className="flex flex-wrap items-center justify-between gap-2 border-b pb-2"
              style={{ borderColor: `${p.secundaria}28`, ...reveal(0, previewMode) }}
              data-reveal={!previewMode || undefined}
            >
              <div className="inline-flex items-center gap-2">
                <Sparkles className="h-3 w-3 shrink-0 opacity-70" style={{ color: p.secundaria }} aria-hidden />
                <p
                  style={{
                    color: `${p.secundaria}aa`,
                    fontFamily: `'${p.corpoFont}', sans-serif`,
                    fontSize: mobile ? '0.62rem' : '0.7rem',
                    letterSpacing: '0.18em',
                    textTransform: 'uppercase',
                  }}
                >
                  {titulo} · continuação
                </p>
              </div>
              <p
                aria-label={`Página ${pageIndex + 1} de ${totalPages}`}
                style={{
                  fontFamily: `'${p.corpoFont}', sans-serif`,
                  fontSize: mobile ? '0.65rem' : '0.72rem',
                  letterSpacing: '0.12em',
                  color: `${p.secundaria}88`,
                }}
              >
                {paginaLabel} / {totalLabel}
              </p>
            </div>
          )}
        </header>

        <div
          className={cn(
            'relative flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl',
            !mobile && 'w-full',
          )}
          style={{
            background: `linear-gradient(165deg, rgba(0,0,0,0.34) 0%, rgba(0,0,0,0.2) 48%, rgba(0,0,0,0.26) 100%)`,
            border: `1px solid ${p.secundaria}26`,
            boxShadow: `inset 0 1px 0 ${p.secundaria}1a, inset 3px 0 0 ${p.secundaria}55`,
            ...reveal(showFullHeader ? 120 : 40, previewMode),
          }}
          data-reveal={!previewMode || undefined}
        >
          <div className={cn('flex min-h-0 flex-1 flex-col p-4 sm:p-5 md:p-7 lg:p-8', textAlign.text)}>
            {blocks.length > 0 ? (
              <SlideMarkdownContent
                blocks={blocks}
                corpoFont={p.corpoFont}
                tituloFont={p.tituloFont}
                corSecundaria={p.secundaria}
                mobile={mobile}
                previewMode={previewMode}
              />
            ) : (
              <p style={{ color: 'rgba(255,255,255,0.55)', fontFamily: `'${p.corpoFont}', sans-serif` }}>
                Conteúdo da análise ainda não foi adicionado a esta apresentação.
              </p>
            )}
          </div>

          {totalPages > 1 && (
            <footer
              className="flex shrink-0 items-center justify-end border-t px-4 py-2 sm:px-6"
              style={{ borderColor: `${p.secundaria}18` }}
            >
              <span
                style={{
                  fontFamily: `'${p.tituloFont}', serif`,
                  fontSize: mobile ? '0.72rem' : '0.8rem',
                  letterSpacing: '0.14em',
                  color: `${p.secundaria}77`,
                }}
              >
                {paginaLabel} · {totalLabel}
              </span>
            </footer>
          )}
        </div>
      </div>
    </section>
  );
}

export interface BlocoAnaliseIASlidesProps {
  bloco: OrcamentoSlideBloco;
  orcamento: OrcamentoSlide;
  template: OrcamentoSlideTemplate | null;
  viewport?: ViewportMode;
  previewMode?: boolean;
}

/** Um slide por página de conteúdo — preenche a tela e quebra no PDF quando necessário. */
export function BlocoAnaliseIASlides({
  bloco,
  orcamento,
  template,
  viewport,
  previewMode,
}: BlocoAnaliseIASlidesProps) {
  const mobile = isMobileViewport(viewport);
  const { etiqueta, titulo, corpo } = resolveAnaliseIaConteudo(orcamento, bloco);
  const temFundo = !!urlImagemFundoDoConfig(bloco.config);

  const corpoExibir = analiseIaTemConteudo(corpo)
    ? normalizarRelatorioAnaliseIa(corpo)
    : previewMode
      ? ANALISE_IA_TEXTO_PREVIEW
      : '';

  const paginas = useMemo(
    () => paginarConteudoAnaliseIa(corpoExibir, mobile),
    [corpoExibir, mobile],
  );

  if (!corpoExibir && !previewMode && !temFundo) return null;

  return (
    <>
      {paginas.map((pageBlocks, pageIndex) => (
        <OrcamentoSlideShell
          key={`${bloco.id}-analise-${pageIndex}`}
          bloco={bloco}
          slidePageIndex={pageIndex + 1}
          slidePageTotal={paginas.length}
        >
          <BlocoAnaliseIAPagina
            bloco={bloco}
            template={template}
            viewport={viewport}
            previewMode={previewMode}
            etiqueta={etiqueta}
            titulo={titulo}
            blocks={pageBlocks}
            pageIndex={pageIndex}
            totalPages={paginas.length}
            showFullHeader={pageIndex === 0}
          />
        </OrcamentoSlideShell>
      ))}
    </>
  );
}
