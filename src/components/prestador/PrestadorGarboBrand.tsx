import { GARBO_LOGO_SRC } from '@/lib/garbo-brand';

export const GARBO_MOVELARIA_LABEL = 'Garbo movelaria';

const brandCss = `
  @keyframes garbo-brand-rise {
    from {
      opacity: 0;
      transform: translateY(-6px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
  .garbo-brand-enter {
    animation: garbo-brand-rise 0.65s cubic-bezier(0.22, 1, 0.36, 1) both;
  }
`;

interface PrestadorGarboBrandProps {
  /** Fundo discreto para ler bem sobre o banner */
  overBanner?: boolean;
  className?: string;
  animate?: boolean;
  /** Ao clicar na logo — voltar à página principal do portal */
  onGoHome?: () => void;
}

export function PrestadorGarboBrand({
  overBanner = false,
  className = '',
  animate = true,
  onGoHome,
}: PrestadorGarboBrandProps) {
  return (
    <>
      <style>{brandCss}</style>
      <div
        className={`flex flex-col items-start shrink-0 max-w-[min(100%,11rem)] ${animate ? 'garbo-brand-enter' : ''} ${className}`}
        style={{ gap: 6 }}
      >
        <div
          className="flex flex-col items-start w-full"
          style={{
            gap: 8,
            ...(overBanner
              ? {
                  padding: '8px 10px',
                  borderRadius: 12,
                  background: 'rgba(0,0,0,0.52)',
                  backdropFilter: 'blur(14px)',
                  border: '1px solid rgba(196, 165, 116, 0.28)',
                  boxShadow: '0 8px 28px rgba(0,0,0,0.45)',
                }
              : {}),
          }}
        >
          {onGoHome ? (
            <button
              type="button"
              onClick={onGoHome}
              aria-label="Ir para a página principal do portal"
              className="relative overflow-hidden rounded-lg flex items-center justify-center cursor-pointer transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400/70"
              style={{
                padding: 6,
                background:
                  'linear-gradient(145deg, rgba(196,165,116,0.12) 0%, rgba(8,8,8,0.88) 100%)',
                border: '1px solid rgba(196, 165, 116, 0.35)',
              }}
            >
              <img
                src={GARBO_LOGO_SRC}
                alt=""
                width={44}
                height={44}
                className="object-contain block sm:hidden pointer-events-none"
                style={{
                  width: 44,
                  height: 44,
                  filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
                }}
              />
              <img
                src={GARBO_LOGO_SRC}
                alt=""
                width={52}
                height={52}
                className="object-contain hidden sm:block pointer-events-none"
                style={{
                  width: 52,
                  height: 52,
                  filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
                }}
              />
            </button>
          ) : (
            <div
              className="relative overflow-hidden rounded-lg flex items-center justify-center"
              style={{
                padding: 6,
                background:
                  'linear-gradient(145deg, rgba(196,165,116,0.12) 0%, rgba(8,8,8,0.88) 100%)',
                border: '1px solid rgba(196, 165, 116, 0.35)',
              }}
            >
              <img
                src={GARBO_LOGO_SRC}
                alt={GARBO_MOVELARIA_LABEL}
                width={44}
                height={44}
                className="object-contain block sm:hidden"
                style={{
                  width: 44,
                  height: 44,
                  filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
                }}
              />
              <img
                src={GARBO_LOGO_SRC}
                alt={GARBO_MOVELARIA_LABEL}
                width={52}
                height={52}
                className="object-contain hidden sm:block"
                style={{
                  width: 52,
                  height: 52,
                  filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.5))',
                }}
              />
            </div>
          )}

          <span
            className="font-display uppercase leading-tight"
            style={{
              fontSize: '0.68rem',
              letterSpacing: '0.2em',
              color: 'rgba(196, 165, 116, 0.95)',
              textShadow: '0 1px 8px rgba(0,0,0,0.65)',
            }}
          >
            {GARBO_MOVELARIA_LABEL}
          </span>
        </div>
      </div>
    </>
  );
}
