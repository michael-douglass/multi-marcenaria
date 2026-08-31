import type { CSSProperties, ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { GarboCoverImage } from './GarboCoverImage';
import { GARBO_APRESENTACAO_THEME } from './garbo-apresentacao-theme';

interface GarboApresentacaoSectionProps {
  id: string;
  children: ReactNode;
  backgroundImage?: string;
  /** Overlay mais leve para o hero; soft = foto mais visível */
  variant?: 'image' | 'hero' | 'soft' | 'dark' | 'gradient';
  className?: string;
  /** Classe extra no container do conteúdo (ex.: max-w maior) */
  contentClassName?: string;
  /** Camada absoluta sobre o fundo (ex.: cubos transparentes na página toda) */
  layer?: ReactNode;
}

function SlatPattern() {
  return (
    <div
      className="pointer-events-none absolute inset-y-0 right-0 w-16 opacity-[0.12] sm:w-24"
      aria-hidden
      style={{
        backgroundImage:
          'repeating-linear-gradient(90deg, transparent, transparent 3px, rgba(242,216,146,0.35) 3px, rgba(242,216,146,0.35) 4px)',
      }}
    />
  );
}

export function GarboApresentacaoSection({
  id,
  children,
  backgroundImage,
  variant = 'image',
  className,
  contentClassName,
  layer,
}: GarboApresentacaoSectionProps) {
  const overlay =
    variant === 'hero'
      ? GARBO_APRESENTACAO_THEME.overlayHero
      : variant === 'soft'
        ? GARBO_APRESENTACAO_THEME.overlaySoft
      : variant === 'image'
        ? GARBO_APRESENTACAO_THEME.overlayDark
        : 'transparent';

  return (
    <section
      id={id}
      data-garbo-section={id}
      className={cn(
        'relative isolate flex min-h-[100dvh] w-full snap-start snap-always flex-col justify-center overflow-hidden',
        'pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]',
        className,
      )}
      style={{ background: GARBO_APRESENTACAO_THEME.bgBase }}
    >
      {backgroundImage && (
        <GarboCoverImage
          src={backgroundImage}
          alt=""
          aria-hidden
          loading="lazy"
          decoding="async"
          className="absolute inset-0 h-full w-full object-cover"
        />
      )}

      {variant === 'dark' && (
        <div
          className="absolute inset-0"
          aria-hidden
          style={{
            background: `
              radial-gradient(ellipse 70% 50% at 20% 80%, rgba(196,168,130,0.08), transparent 60%),
              radial-gradient(ellipse 60% 40% at 80% 20%, rgba(242,216,146,0.06), transparent 55%),
              linear-gradient(165deg, #0a0908 0%, #1a1612 45%, #0f0d0b 100%)
            `,
          }}
        />
      )}

      {variant === 'gradient' && (
        <div
          className="absolute inset-0"
          aria-hidden
          style={{
            background: `
              radial-gradient(ellipse 80% 60% at 50% 100%, rgba(242,216,146,0.10), transparent 65%),
              linear-gradient(180deg, #1a1612 0%, #0a0908 100%)
            `,
          }}
        />
      )}

      {(backgroundImage || variant === 'image' || variant === 'hero' || variant === 'soft') &&
        overlay !== 'transparent' && (
        <div
          className="absolute inset-0"
          aria-hidden
          style={{ background: overlay }}
        />
      )}

      <div
        className="pointer-events-none absolute inset-0 grain-overlay opacity-40"
        aria-hidden
      />

      <SlatPattern />

      {layer}

      <div
        className={cn(
          'relative z-10 mx-auto w-full max-w-3xl px-6 py-20 sm:px-10 sm:py-24 lg:max-w-4xl lg:px-14',
          contentClassName,
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function revealStyle(delay = 0): CSSProperties {
  return { '--reveal-delay': `${delay}ms` } as CSSProperties;
}
