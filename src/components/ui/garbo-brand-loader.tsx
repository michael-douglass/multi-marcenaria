import { cn } from '@/lib/utils';
import { GARBO_LOGO_SRC } from '@/lib/garbo-brand';

export interface GarboBrandLoaderProps {
  /** Texto opcional abaixo da logo (ex.: Carregando…, Atualizando…). */
  message?: string;
  /** fullscreen = tela inteira; inline = bloco centralizado; overlay = camada fixa sobre o conteúdo. */
  variant?: 'fullscreen' | 'inline' | 'overlay';
  /** Tamanho da logo em rotação. */
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const LOGO_SIZE: Record<NonNullable<GarboBrandLoaderProps['size']>, string> = {
  sm: 'h-16 w-16 sm:h-20 sm:w-20',
  md: 'h-24 w-24 sm:h-28 sm:w-28',
  lg: 'h-36 w-36 sm:h-44 sm:w-44 md:h-52 md:w-52',
};

export function GarboBrandLoader({
  message,
  variant = 'fullscreen',
  size = 'lg',
  className,
}: GarboBrandLoaderProps) {
  const isFullscreen = variant === 'fullscreen';
  const isOverlay = variant === 'overlay';

  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-label={message ?? 'Carregando'}
      className={cn(
        'relative flex items-center justify-center',
        isOverlay && 'fixed inset-0 z-[9999]',
        isFullscreen && 'min-h-screen w-full bg-[#f8f4ee]',
        variant === 'inline' && 'min-h-[50vh] w-full py-16',
        isOverlay && 'bg-[#f8f4ee]/92 backdrop-blur-sm',
        className,
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-0 overflow-hidden grain-overlay',
          variant === 'inline' && 'hidden',
        )}
        aria-hidden
      >
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_42%,rgba(242,216,146,0.22),transparent_68%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,252,248,0.35),#f8f4ee_78%)]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 text-center">
        <div className="relative flex items-center justify-center">
          {/* Halo dourado atrás da logo */}
          <div
            className={cn(
              'absolute rounded-full blur-3xl',
              size === 'lg' && 'h-40 w-40 sm:h-48 sm:w-48',
              size === 'md' && 'h-28 w-28 sm:h-32 sm:w-32',
              size === 'sm' && 'h-20 w-20 sm:h-24 sm:w-24',
              'bg-[radial-gradient(circle,rgba(242,216,146,0.35)_0%,transparent_70%)]',
              'animate-pulse',
            )}
            aria-hidden
          />

          {/* Anel decorativo — gira no sentido oposto */}
          <div
            className={cn(
              'absolute rounded-full border border-[rgba(242,216,146,0.22)]',
              size === 'lg' && 'h-[calc(100%+2.5rem)] w-[calc(100%+2.5rem)]',
              size === 'md' && 'h-[calc(100%+1.75rem)] w-[calc(100%+1.75rem)]',
              size === 'sm' && 'h-[calc(100%+1.25rem)] w-[calc(100%+1.25rem)]',
              'animate-[garbo-ring-spin_4.2s_linear_infinite_reverse]',
            )}
            aria-hidden
          />

          <img
            src={GARBO_LOGO_SRC}
            alt="Garbo Movelaria"
            draggable={false}
            className={cn(
              LOGO_SIZE[size],
              'relative object-contain drop-shadow-[0_0_32px_rgba(242,216,146,0.28)]',
              'animate-[garbo-logo-spin_2.8s_linear_infinite]',
              'select-none',
            )}
          />
        </div>

        {message && (
          <p className="max-w-xs text-[11px] font-medium uppercase tracking-[0.28em] text-[#6b5244] animate-pulse sm:text-xs">
            {message}
          </p>
        )}
      </div>
    </div>
  );
}
