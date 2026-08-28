import { useCallback, useEffect, useRef, useState, type CSSProperties } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  type CarouselApi,
} from '@/components/ui/carousel';
import {
  GARBO_APRESENTACAO_PROJETOS,
  type GarboProjetoMediaItem,
} from './garbo-apresentacao-content';
import { revealStyle } from './GarboApresentacaoSection';
import { GARBO_APRESENTACAO_THEME } from './garbo-apresentacao-theme';

const AUTO_ADVANCE_MS = 4800;

/** Galeria imersiva: projetos agrupados em carrossel vertical 1080×1920. */
export function GarboApresentacaoProjetos() {
  const { eyebrow, title, subtitle, hint, items } = GARBO_APRESENTACAO_PROJETOS;

  return (
    <>
      <section
        id="projetos"
        data-garbo-section="projetos"
        className="relative isolate flex min-h-[100dvh] w-full snap-start snap-always flex-col overflow-hidden pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
        style={{ background: GARBO_APRESENTACAO_THEME.bgBase }}
      >
        <div
          className="pointer-events-none absolute inset-0"
          aria-hidden
          style={{
            background: `
              radial-gradient(ellipse 70% 55% at 50% 42%, rgba(242,216,146,0.10), transparent 62%),
              radial-gradient(ellipse 50% 40% at 85% 90%, rgba(196,168,130,0.07), transparent 55%),
              linear-gradient(180deg, #1a1612 0%, #0a0908 100%)
            `,
          }}
        />
        <div className="pointer-events-none absolute inset-0 grain-overlay opacity-40" aria-hidden />
        <div
          className="pointer-events-none absolute inset-y-0 right-0 w-12 opacity-[0.1] sm:w-20"
          aria-hidden
          style={{
            backgroundImage:
              'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(242,216,146,0.4) 3px, rgba(242,216,146,0.4) 4px)',
          }}
        />

        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col px-4 pt-10 sm:px-8 sm:pt-12">
          <header className="mx-auto mb-6 max-w-xl text-center sm:mb-8">
            <p
              data-reveal
              style={{
                ...revealStyle(0),
                fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
                color: GARBO_APRESENTACAO_THEME.gold,
              }}
              className="mb-3 text-xs font-semibold tracking-[0.35em] uppercase"
            >
              {eyebrow}
            </p>

            <h2
              data-reveal
              style={{
                ...revealStyle(80),
                fontFamily: GARBO_APRESENTACAO_THEME.fontDisplay,
                color: GARBO_APRESENTACAO_THEME.textPrimary,
              }}
              className="mb-3 text-[clamp(1.75rem,5vw,2.75rem)] font-light leading-tight text-balance"
            >
              {title}
            </h2>

            <p
              data-reveal
              style={{
                ...revealStyle(160),
                fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
                color: GARBO_APRESENTACAO_THEME.textMuted,
              }}
              className="text-sm leading-relaxed sm:text-base"
            >
              {subtitle}
            </p>
          </header>

          <div data-reveal style={revealStyle(240)} className="flex min-h-0 flex-1 flex-col">
            <ProjetosCarousel items={items} hint={hint} />
          </div>
        </div>
      </section>

      <style>{`
        .garbo-projetos-frame {
          aspect-ratio: 1080 / 1920;
          width: 100%;
          max-height: min(62dvh, 34rem);
        }
        @media (min-width: 640px) {
          .garbo-projetos-frame {
            max-height: min(68dvh, 40rem);
          }
        }
        .garbo-projetos-slide-card {
          transform: scale(0.88) translate3d(0, 8px, 0);
          opacity: 0.45;
          filter: brightness(0.72);
          transition:
            transform 650ms cubic-bezier(0.22, 1, 0.36, 1),
            opacity 500ms cubic-bezier(0, 0, 0.2, 1),
            filter 500ms ease;
        }
        .garbo-projetos-slide-card.is-active {
          transform: scale(1) translate3d(0, 0, 0);
          opacity: 1;
          filter: brightness(1);
        }
        .garbo-projetos-kenburns {
          animation: garbo-projetos-kenburns 14s cubic-bezier(0.25, 0.1, 0.25, 1) infinite alternate;
        }
        @keyframes garbo-projetos-kenburns {
          0% { transform: scale(1) translate3d(0, 0, 0); }
          100% { transform: scale(1.1) translate3d(-1%, -1.5%, 0); }
        }
        .garbo-projetos-progress {
          transform-origin: left center;
          animation: garbo-projetos-progress var(--garbo-auto-ms, 4800ms) linear forwards;
        }
        @keyframes garbo-projetos-progress {
          from { transform: scaleX(0); }
          to { transform: scaleX(1); }
        }
        .garbo-projetos-swipe-hint {
          animation: garbo-projetos-swipe 2.2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        @keyframes garbo-projetos-swipe {
          0%, 100% { transform: translateX(0); opacity: 0.45; }
          50% { transform: translateX(6px); opacity: 1; }
        }
        @media (prefers-reduced-motion: reduce) {
          .garbo-projetos-kenburns,
          .garbo-projetos-progress,
          .garbo-projetos-swipe-hint {
            animation: none !important;
          }
          .garbo-projetos-slide-card {
            transition: none;
            transform: none;
            opacity: 1;
            filter: none;
          }
        }
      `}</style>
    </>
  );
}

interface ProjetosCarouselProps {
  items: readonly GarboProjetoMediaItem[];
  hint: string;
}

function ProjetosCarousel({ items, hint }: ProjetosCarouselProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [activeIndex, setActiveIndex] = useState(0);
  const [progressKey, setProgressKey] = useState(0);
  const [paused, setPaused] = useState(false);
  const [sectionVisible, setSectionVisible] = useState(false);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const prefersReducedRef = useRef(false);
  const pauseTimerRef = useRef<number | null>(null);

  const syncApiState = useCallback((embla: NonNullable<CarouselApi>) => {
    setActiveIndex(embla.selectedScrollSnap());
    setCanScrollPrev(embla.canScrollPrev());
    setCanScrollNext(embla.canScrollNext());
    setProgressKey((k) => k + 1);
  }, []);

  useEffect(() => {
    prefersReducedRef.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  useEffect(() => {
    if (!api) return;
    syncApiState(api);
    api.on('select', syncApiState);
    api.on('reInit', syncApiState);
    return () => {
      api.off('select', syncApiState);
      api.off('reInit', syncApiState);
    };
  }, [api, syncApiState]);

  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const scrollRoot = el.closest('[data-garbo-apresentacao]') as HTMLElement | null;

    const obs = new IntersectionObserver(
      (entries) => {
        setSectionVisible(entries.some((e) => e.isIntersecting && e.intersectionRatio >= 0.4));
      },
      { root: scrollRoot ?? undefined, threshold: [0.25, 0.4, 0.6] },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    if (!api || paused || !sectionVisible || prefersReducedRef.current || items.length < 2) return;

    const timer = window.setInterval(() => {
      if (api.canScrollNext()) api.scrollNext();
      else api.scrollTo(0);
    }, AUTO_ADVANCE_MS);

    return () => window.clearInterval(timer);
  }, [api, paused, sectionVisible, items.length, activeIndex]);

  useEffect(() => {
    return () => {
      if (pauseTimerRef.current) window.clearTimeout(pauseTimerRef.current);
    };
  }, []);

  const pauseBriefly = () => {
    setPaused(true);
    if (pauseTimerRef.current) window.clearTimeout(pauseTimerRef.current);
    pauseTimerRef.current = window.setTimeout(() => setPaused(false), AUTO_ADVANCE_MS);
  };

  const goTo = (index: number) => {
    pauseBriefly();
    api?.scrollTo(index);
  };

  const goPrev = () => {
    pauseBriefly();
    if (!api) return;
    if (api.canScrollPrev()) api.scrollPrev();
    else api.scrollTo(items.length - 1);
  };

  const goNext = () => {
    pauseBriefly();
    if (!api) return;
    if (api.canScrollNext()) api.scrollNext();
    else api.scrollTo(0);
  };

  return (
    <div
      ref={rootRef}
      className="relative mx-auto flex w-full max-w-xl flex-1 flex-col sm:max-w-2xl"
      onPointerDown={pauseBriefly}
      onFocusCapture={pauseBriefly}
    >
      <Carousel
        setApi={setApi}
        opts={{
          align: 'center',
          loop: items.length > 1,
          skipSnaps: false,
          containScroll: false,
          duration: 28,
        }}
        className="w-full"
        aria-label="Carrossel de projetos e obras"
      >
        {/* Slides ~82%: sempre sobra overflow para o Embla conseguir avançar */}
        <CarouselContent className="-ml-4 sm:-ml-6">
          {items.map((item, index) => (
            <CarouselItem
              key={item.id}
              className="basis-[82%] pl-4 sm:basis-[78%] sm:pl-6"
            >
              <ProjetoCarouselCard
                item={item}
                index={index}
                total={items.length}
                isActive={index === activeIndex}
                isSectionVisible={sectionVisible}
              />
            </CarouselItem>
          ))}
        </CarouselContent>
      </Carousel>

      <div className="mt-5 flex flex-col items-center gap-4 pb-8 sm:mt-6 sm:pb-10">
        {items.length > 1 && !prefersReducedRef.current && sectionVisible && !paused && (
          <div
            className="h-0.5 w-24 overflow-hidden rounded-full"
            style={{ background: 'rgba(242,216,146,0.2)' }}
            aria-hidden
          >
            <div
              key={progressKey}
              className="garbo-projetos-progress h-full w-full rounded-full"
              style={
                {
                  background: GARBO_APRESENTACAO_THEME.gold,
                  '--garbo-auto-ms': `${AUTO_ADVANCE_MS}ms`,
                } as CSSProperties
              }
            />
          </div>
        )}

        <div className="flex items-center gap-4">
          <button
            type="button"
            aria-label="Projeto anterior"
            onClick={goPrev}
            disabled={items.length < 2}
            className="flex h-11 w-11 items-center justify-center rounded-full transition-[transform,background,opacity] duration-300 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-35"
            style={{
              background: 'rgba(242,216,146,0.12)',
              color: GARBO_APRESENTACAO_THEME.gold,
              outlineColor: GARBO_APRESENTACAO_THEME.gold,
              opacity: items.length < 2 ? 0.35 : canScrollPrev || items.length > 1 ? 1 : 0.35,
            }}
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex items-center gap-2" role="tablist" aria-label="Indicadores do carrossel">
            {items.map((item, index) => {
              const isActive = index === activeIndex;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="tab"
                  aria-label={`Ir para ${item.title}`}
                  aria-selected={isActive}
                  onClick={() => goTo(index)}
                  className="flex h-11 w-11 items-center justify-center"
                >
                  <span
                    className={cn(
                      'block rounded-full transition-all duration-400',
                      isActive ? 'h-2.5 w-6' : 'h-2 w-2',
                    )}
                    style={{
                      background: isActive
                        ? GARBO_APRESENTACAO_THEME.gold
                        : 'rgba(242,216,146,0.35)',
                      boxShadow: isActive ? '0 0 12px rgba(242,216,146,0.45)' : 'none',
                    }}
                  />
                </button>
              );
            })}
          </div>

          <button
            type="button"
            aria-label="Próximo projeto"
            onClick={goNext}
            disabled={items.length < 2}
            className="flex h-11 w-11 items-center justify-center rounded-full transition-[transform,background,opacity] duration-300 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:opacity-35"
            style={{
              background: 'rgba(242,216,146,0.12)',
              color: GARBO_APRESENTACAO_THEME.gold,
              outlineColor: GARBO_APRESENTACAO_THEME.gold,
              opacity: items.length < 2 ? 0.35 : canScrollNext || items.length > 1 ? 1 : 0.35,
            }}
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <p
          className="garbo-projetos-swipe-hint text-[10px] font-medium tracking-[0.28em] uppercase"
          style={{
            fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
            color: GARBO_APRESENTACAO_THEME.goldMuted,
          }}
        >
          {hint} →
        </p>
      </div>
    </div>
  );
}

interface ProjetoCarouselCardProps {
  item: GarboProjetoMediaItem;
  index: number;
  total: number;
  isActive: boolean;
  isSectionVisible: boolean;
}

function ProjetoCarouselCard({
  item,
  index,
  total,
  isActive,
  isSectionVisible,
}: ProjetoCarouselCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || item.type !== 'video') return;

    if (isActive && isSectionVisible) {
      video.muted = true;
      void video.play().catch(() => {
        /* autoplay pode falhar — mantém poster */
      });
    } else {
      video.pause();
    }
  }, [isActive, isSectionVisible, item.type]);

  return (
    <article
      className={cn('garbo-projetos-slide-card flex justify-center', isActive && 'is-active')}
      aria-hidden={!isActive}
    >
      <figure
        className="garbo-projetos-frame relative overflow-hidden rounded-sm"
        style={{
          boxShadow: isActive
            ? '0 28px 90px rgba(0,0,0,0.62), 0 0 0 1px rgba(242,216,146,0.22)'
            : '0 12px 40px rgba(0,0,0,0.4)',
          transition: 'box-shadow 650ms cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {item.type === 'video' ? (
          <video
            ref={videoRef}
            src={item.src}
            poster={item.poster}
            muted
            playsInline
            loop
            preload="metadata"
            controls={false}
            disablePictureInPicture
            className="absolute inset-0 h-full w-full object-cover"
            aria-label={item.title}
          />
        ) : (
          <img
            src={item.src}
            alt={item.title}
            width={1080}
            height={1920}
            loading={index === 0 ? 'eager' : 'lazy'}
            decoding="async"
            className={cn(
              'absolute inset-0 h-full w-full object-cover',
              isActive && isSectionVisible && 'garbo-projetos-kenburns',
            )}
          />
        )}

        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5"
          aria-hidden
          style={{
            background:
              'linear-gradient(180deg, transparent 0%, rgba(8,6,4,0.55) 55%, rgba(8,6,4,0.9) 100%)',
          }}
        />

        <figcaption className="absolute inset-x-0 bottom-0 z-10 px-4 pb-5 pt-10 text-left sm:px-5 sm:pb-6">
          <p
            className="mb-1 text-[10px] font-semibold tracking-[0.28em] uppercase"
            style={{
              fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
              color: GARBO_APRESENTACAO_THEME.gold,
            }}
          >
            {item.type === 'video' ? 'Vídeo' : 'Obra'} · {String(index + 1).padStart(2, '0')}/
            {String(total).padStart(2, '0')}
          </p>
          <h3
            className="mb-1 text-[clamp(1.05rem,2.8vw,1.35rem)] font-light leading-snug"
            style={{
              fontFamily: GARBO_APRESENTACAO_THEME.fontDisplay,
              color: GARBO_APRESENTACAO_THEME.textPrimary,
            }}
          >
            {item.title}
          </h3>
          <p
            className="text-xs leading-relaxed sm:text-sm"
            style={{
              fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
              color: GARBO_APRESENTACAO_THEME.textMuted,
            }}
          >
            {item.caption}
          </p>
        </figcaption>
      </figure>
    </article>
  );
}
