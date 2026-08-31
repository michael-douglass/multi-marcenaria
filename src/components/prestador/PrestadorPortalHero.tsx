import { ChevronDown, Sparkles } from 'lucide-react';
import { GARBO_APRESENTACAO_THEME } from '@/components/marketing/apresentacao-empresa/garbo-apresentacao-theme';

interface PrestadorPortalHeroProps {
  nome: string;
  titulo: string;
  hasContent: boolean;
}

/** Bloco de identidade do arquiteto — editorial, sobre o banner e o 3D. */
export function PrestadorPortalHero({ nome, titulo, hasContent }: PrestadorPortalHeroProps) {
  return (
    <div
      className="relative z-10 px-8 pb-10 md:px-14 md:pb-12"
      style={{ marginTop: 'auto', paddingTop: hasContent ? '4rem' : undefined }}
    >
      <p
        className="anim-fade mb-4 inline-flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.22em]"
        style={{
          animationDelay: '400ms',
          color: GARBO_APRESENTACAO_THEME.gold,
          fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
        }}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Pontua Garbo
      </p>

      <div
        className="anim-rule mb-7 h-px bg-amber-400/70"
        style={{ animationDelay: '500ms', width: 0 }}
      />

      <h1
        className="anim-up leading-none"
        style={{
          fontFamily: GARBO_APRESENTACAO_THEME.fontDisplay,
          fontSize: 'clamp(2.75rem, 8vw, 6.5rem)',
          fontWeight: 300,
          letterSpacing: '-0.02em',
          color: GARBO_APRESENTACAO_THEME.textPrimary,
          textShadow: GARBO_APRESENTACAO_THEME.textShadowTitle,
          animationDelay: '600ms',
        }}
      >
        {nome}
      </h1>

      <div className="mt-5 inline-flex anim-fade" style={{ animationDelay: '900ms' }}>
        <span
          className="inline-flex items-center rounded-full px-4 py-1.5 text-xs font-medium uppercase tracking-widest"
          style={{
            border: '1px solid rgba(242,216,146,0.4)',
            background: 'rgba(242,216,146,0.08)',
            color: GARBO_APRESENTACAO_THEME.gold,
            letterSpacing: '0.18em',
            backdropFilter: 'blur(8px)',
            fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
          }}
        >
          {titulo}
        </span>
      </div>

      <p
        className="prestador-welcome-glow mt-4 text-sm anim-fade"
        style={{
          animationDelay: '1100ms',
          letterSpacing: '0.08em',
          fontFamily: GARBO_APRESENTACAO_THEME.fontBody,
        }}
      >
        Bem-vindo ao seu portal
      </p>

      {hasContent && (
        <div className="mt-8 anim-scroll">
          <ChevronDown className="h-5 w-5 text-white/30" />
        </div>
      )}
    </div>
  );
}
