import { useCallback, useState } from 'react';
import { cn } from '@/lib/utils';
import { GARBO_APRESENTACAO_IMAGES } from './garbo-apresentacao-content';
import { revealStyle } from './GarboApresentacaoSection';
import { GarboHeroMagicCube } from './GarboHeroMagicCube';
import { GARBO_APRESENTACAO_THEME } from './garbo-apresentacao-theme';

/** Banner principal — foto full-bleed + cubo mágico com zoom na logo. */
export function GarboApresentacaoHero() {
  const [lensZoom, setLensZoom] = useState(false);

  const handleLensFocus = useCallback((focused: boolean) => {
    setLensZoom(focused);
  }, []);

  return (
    <section
      id="hero"
      data-garbo-section="hero"
      className="relative isolate flex min-h-[100dvh] w-full snap-start snap-always flex-col justify-center overflow-hidden pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
      style={{ background: GARBO_APRESENTACAO_THEME.bgBase }}
    >
      <img
        src={GARBO_APRESENTACAO_IMAGES.hero}
        alt=""
        width={1920}
        height={1080}
        fetchPriority="high"
        decoding="async"
        className={cn(
          'absolute inset-0 h-full w-full object-cover transition-transform duration-700 ease-out motion-reduce:transition-none',
          lensZoom && 'garbo-hero-bg-lens-zoom',
        )}
        aria-hidden
      />

      <div
        className="absolute inset-0 z-[1]"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 55% 50% at 50% 42%, rgba(8,6,4,0.08), transparent 70%),
            linear-gradient(180deg, rgba(8,6,4,0.28) 0%, rgba(8,6,4,0.12) 40%, rgba(8,6,4,0.42) 100%)
          `,
        }}
      />

      <GarboHeroMagicCube onLensFocus={handleLensFocus} />

      {/* Halo de lente quando a onda cruza a logo */}
      <div
        className={cn(
          'pointer-events-none absolute left-1/2 top-[42%] z-[4] h-[min(58vw,420px)] w-[min(58vw,420px)] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-500 motion-reduce:transition-none',
          lensZoom ? 'opacity-100' : 'opacity-0',
        )}
        aria-hidden
        style={{
          background: `
            radial-gradient(circle at 35% 30%, rgba(255,250,244,0.2), transparent 42%),
            radial-gradient(circle, rgba(242,216,146,0.12) 0%, transparent 68%)
          `,
          boxShadow: lensZoom
            ? 'inset 0 0 0 1px rgba(242,216,146,0.35), 0 0 60px rgba(242,216,146,0.2)'
            : 'none',
        }}
      />

      <div className="pointer-events-none absolute inset-0 z-[3] grain-overlay opacity-20" aria-hidden />

      <div
        className={cn(
          'relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-6 py-24 text-center sm:px-10 sm:py-28',
          'transition-transform duration-700 ease-[cubic-bezier(0.34,1.2,0.64,1)] motion-reduce:transition-none',
          lensZoom && 'garbo-hero-logo-lens-zoom',
        )}
      >
        <p
          data-reveal
          style={{
            ...revealStyle(200),
            fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
            color: GARBO_APRESENTACAO_THEME.gold,
          }}
          className="mb-4 text-[10px] font-semibold tracking-[0.42em] uppercase sm:text-[11px]"
        >
          Garbo Movelaria
        </p>

        <h1
          data-reveal
          style={{
            ...revealStyle(320),
            fontFamily: GARBO_APRESENTACAO_THEME.fontDisplay,
            color: GARBO_APRESENTACAO_THEME.textPrimary,
            textShadow: lensZoom
              ? '0 0 40px rgba(242,216,146,0.45), 0 8px 40px rgba(0,0,0,0.55)'
              : '0 8px 40px rgba(0,0,0,0.55)',
          }}
          className="text-[clamp(2.75rem,12vw,6.5rem)] font-light leading-[0.92] tracking-[0.08em] text-balance uppercase transition-[text-shadow] duration-500"
          translate="no"
        >
          Garbo
        </h1>

        <p
          data-reveal
          style={{
            ...revealStyle(420),
            fontFamily: GARBO_APRESENTACAO_THEME.fontDisplay,
            color: GARBO_APRESENTACAO_THEME.gold,
          }}
          className="mt-2 text-[clamp(1.35rem,4vw,2.25rem)] font-light tracking-[0.32em] uppercase"
          translate="no"
        >
          Movelaria
        </p>

        <div data-reveal style={revealStyle(520)} className="mt-6 h-px w-16 sm:w-24" aria-hidden>
          <div
            className="h-full w-full"
            style={{
              background: `linear-gradient(90deg, transparent, ${GARBO_APRESENTACAO_THEME.gold}, transparent)`,
            }}
          />
        </div>

        <p
          data-reveal
          style={{
            ...revealStyle(600),
            fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
            color: GARBO_APRESENTACAO_THEME.textMuted,
          }}
          className="mt-6 max-w-md text-sm leading-relaxed text-pretty sm:text-base"
        >
          Precisão cirúrgica para arquitetos que levam o próprio nome a sério.
        </p>
      </div>

      <div
        className="absolute bottom-8 left-1/2 z-10 flex -translate-x-1/2 flex-col items-center gap-2"
        aria-hidden
      >
        <span
          className="text-[10px] uppercase tracking-[0.3em]"
          style={{ color: GARBO_APRESENTACAO_THEME.goldMuted }}
        >
          Role para continuar
        </span>
        <div
          className="h-10 w-px motion-reduce:animate-none animate-pulse"
          style={{
            background: `linear-gradient(to bottom, ${GARBO_APRESENTACAO_THEME.gold}, transparent)`,
          }}
        />
      </div>
    </section>
  );
}
