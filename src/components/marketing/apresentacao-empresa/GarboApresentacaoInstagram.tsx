import { useState } from 'react';
import { Instagram, Phone, MessageCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { GARBO_APRESENTACAO_INSTAGRAM } from './garbo-apresentacao-content';
import { revealStyle } from './GarboApresentacaoSection';
import { GARBO_APRESENTACAO_THEME } from './garbo-apresentacao-theme';

/** Seção final: feed real do Instagram ampliado + contato. */
export function GarboApresentacaoInstagram() {
  const {
    eyebrow,
    title,
    subtitle,
    handle,
    profileUrl,
    embedUrl,
    profileCta,
    phoneDisplay,
    phoneTel,
    phoneWhatsApp,
    phoneLabel,
  } = GARBO_APRESENTACAO_INSTAGRAM;

  const [iframeReady, setIframeReady] = useState(false);

  return (
    <section
      id="instagram"
      data-garbo-section="instagram"
      className="relative isolate flex min-h-[100dvh] w-full snap-start snap-always flex-col overflow-hidden pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]"
      style={{ background: GARBO_APRESENTACAO_THEME.bgBase }}
    >
      {/* Atmosfera da oficina */}
      <div
        className="pointer-events-none absolute inset-0"
        aria-hidden
        style={{
          background: `
            radial-gradient(ellipse 70% 50% at 50% 12%, rgba(242,216,146,0.12), transparent 58%),
            radial-gradient(ellipse 45% 35% at 90% 80%, rgba(196,168,130,0.07), transparent 55%),
            linear-gradient(185deg, #120f0c 0%, #0a0908 50%, #15110e 100%)
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

      <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col px-3 py-10 sm:px-6 sm:py-12 lg:px-10 lg:py-14">
        <header className="mx-auto mb-6 max-w-2xl shrink-0 text-center sm:mb-8">
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
            className="mb-3 text-[clamp(1.75rem,5vw,2.85rem)] font-light leading-tight text-balance"
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
            className="mx-auto max-w-lg text-sm leading-relaxed sm:text-base"
          >
            {subtitle}
          </p>

          <a
            data-reveal
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              ...revealStyle(240),
              fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
              color: GARBO_APRESENTACAO_THEME.gold,
            }}
            className={cn(
              'mt-4 inline-flex items-center gap-2 text-sm font-semibold tracking-[0.12em]',
              'transition-transform duration-300 ease-out hover:scale-105 active:scale-[0.97]',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4',
            )}
          >
            <Instagram className="h-4 w-4" aria-hidden />
            {handle}
          </a>
        </header>

        {/* Feed real ampliado — moldura Garbo */}
        <div
          data-reveal
          style={revealStyle(280)}
          className="relative mx-auto flex w-full max-w-4xl flex-1 flex-col"
        >
          {/* Filete de madeira no topo */}
          <div
            className="h-1 w-full shrink-0 rounded-t-sm"
            style={{
              background:
                'linear-gradient(90deg, #5c3d1e 0%, #c4a882 35%, #f2d892 50%, #c4a882 65%, #5c3d1e 100%)',
            }}
            aria-hidden
          />

          <div
            className="garbo-ig-frame relative flex min-h-0 flex-1 flex-col overflow-hidden border border-t-0 border-[rgba(242,216,146,0.22)] shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
            style={{ background: 'rgba(14,11,9,0.92)' }}
          >
            {!iframeReady && (
              <div
                className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3"
                style={{ color: GARBO_APRESENTACAO_THEME.gold, background: '#0e0b09' }}
                aria-hidden
              >
                <Instagram className="h-8 w-8 animate-pulse" />
                <span
                  className="text-xs tracking-[0.2em] uppercase"
                  style={{ fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
                >
                  Carregando feed…
                </span>
              </div>
            )}

            <iframe
              title="Feed Instagram Garbo Movelaria"
              src={embedUrl}
              className={cn(
                'h-full w-full flex-1 border-0 bg-[#0e0b09] transition-opacity duration-500',
                iframeReady ? 'opacity-100' : 'opacity-0',
              )}
              loading="lazy"
              referrerPolicy="strict-origin-when-cross-origin"
              allow="encrypted-media; clipboard-write; fullscreen"
              onLoad={() => setIframeReady(true)}
            />
          </div>

          <p
            className="mt-3 shrink-0 text-center text-[11px] tracking-wide"
            style={{ color: 'rgba(255,250,244,0.4)', fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
          >
            Feed oficial · role para ver todos os posts
          </p>
        </div>

        {/* Contato */}
        <div
          data-reveal
          style={revealStyle(360)}
          className="mx-auto mt-8 flex w-full max-w-xl shrink-0 flex-col items-center gap-4 sm:mt-10 sm:gap-5"
        >
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-sm px-6 text-sm font-semibold tracking-wide sm:w-auto sm:min-w-[240px]',
              'transition-transform duration-300 ease-out hover:scale-[1.03] active:scale-[0.97]',
              'hover:shadow-[0_0_36px_rgba(242,216,146,0.28)]',
              'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
            )}
            style={{
              fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
              background: GARBO_APRESENTACAO_THEME.gold,
              color: GARBO_APRESENTACAO_THEME.bgBase,
              outlineColor: GARBO_APRESENTACAO_THEME.gold,
            }}
          >
            <Instagram className="h-4 w-4" aria-hidden />
            {profileCta}
          </a>

          <div className="flex w-full flex-col items-center gap-3 sm:flex-row sm:justify-center sm:gap-4">
            <a
              href={`tel:${phoneTel}`}
              className={cn(
                'inline-flex min-h-11 items-center gap-2 text-base font-medium tracking-wide',
                'underline decoration-[rgba(242,216,146,0.35)] underline-offset-4',
                'transition-colors duration-200 hover:decoration-[rgba(242,216,146,0.9)]',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4',
              )}
              style={{
                fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
                color: GARBO_APRESENTACAO_THEME.textPrimary,
                outlineColor: GARBO_APRESENTACAO_THEME.gold,
              }}
              aria-label={`Ligar para ${phoneDisplay}`}
            >
              <Phone className="h-4 w-4 shrink-0" style={{ color: GARBO_APRESENTACAO_THEME.gold }} aria-hidden />
              {phoneDisplay}
            </a>

            <a
              href={phoneWhatsApp}
              target="_blank"
              rel="noopener noreferrer"
              className={cn(
                'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-sm border px-5 text-sm font-semibold tracking-wide sm:w-auto',
                'transition-transform duration-300 ease-out hover:scale-[1.03] active:scale-[0.97]',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
              )}
              style={{
                fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
                borderColor: 'rgba(242,216,146,0.45)',
                color: GARBO_APRESENTACAO_THEME.gold,
                background: 'rgba(242,216,146,0.06)',
                outlineColor: GARBO_APRESENTACAO_THEME.gold,
              }}
              aria-label={`WhatsApp ${phoneDisplay}`}
            >
              <MessageCircle className="h-4 w-4" aria-hidden />
              {phoneLabel}
            </a>
          </div>

          <p
            className="text-center text-[11px] tracking-wide"
            style={{ color: 'rgba(255,250,244,0.4)', fontFamily: GARBO_APRESENTACAO_THEME.fontBody }}
          >
            Garbo Movelaria · {handle}
          </p>
        </div>
      </div>
    </section>
  );
}
