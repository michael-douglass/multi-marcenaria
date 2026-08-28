import { cn } from '@/lib/utils';
import type { CSSProperties, ReactNode } from 'react';

interface StudioSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  delayMs?: number;
  action?: ReactNode;
}

export function StudioSection({
  title,
  description,
  children,
  className,
  delayMs = 0,
  action,
}: StudioSectionProps) {
  const style = {
    '--studio-delay': `${delayMs}ms`,
  } as CSSProperties;

  return (
    <section
      className={cn(
        'studio-reveal rounded-xl border border-amber-900/10 bg-card/80 p-4 shadow-sm backdrop-blur-sm dark:border-amber-100/10 sm:p-5',
        className,
      )}
      style={style}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="font-serif text-lg tracking-tight text-foreground sm:text-xl">
            {title}
          </h3>
          {description ? (
            <p className="mt-1 text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

export function StudioMotionStyles() {
  return (
    <style>{`
      @keyframes studio-reveal {
        from { opacity: 0; transform: translateY(10px) scale(0.985); }
        to { opacity: 1; transform: translateY(0) scale(1); }
      }
      @keyframes studio-pulse-soft {
        0%, 100% { opacity: 0.55; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.06); }
      }
      @keyframes studio-anticipate {
        0% { transform: scale(1); }
        35% { transform: scale(0.97); }
        100% { transform: scale(1); }
      }
      .studio-reveal {
        animation: studio-reveal 380ms cubic-bezier(0.22, 1, 0.36, 1) both;
        animation-delay: var(--studio-delay, 0ms);
      }
      .studio-cta {
        transition: transform 160ms cubic-bezier(0.4, 0, 0.2, 1), box-shadow 200ms ease;
      }
      .studio-cta:hover {
        transform: scale(1.03);
      }
      .studio-cta:active {
        transform: scale(0.96, 1.04);
      }
      .studio-voice-card {
        transition: transform 220ms cubic-bezier(0.34, 1.4, 0.64, 1), border-color 200ms ease, background-color 200ms ease;
      }
      .studio-voice-card:hover {
        transform: translateY(-2px) scale(1.01);
      }
      .studio-voice-card[data-selected="true"] {
        animation: studio-anticipate 280ms cubic-bezier(0.34, 1.56, 0.64, 1);
      }
      .studio-writing-pulse {
        animation: studio-pulse-soft 1.4s ease-in-out infinite;
      }
      .studio-station {
        transition: border-color 220ms ease, background-color 220ms ease, opacity 220ms ease;
      }
      @media (prefers-reduced-motion: reduce) {
        .studio-reveal,
        .studio-cta,
        .studio-voice-card,
        .studio-writing-pulse,
        .studio-voice-card[data-selected="true"] {
          animation: none !important;
          transition: none !important;
          transform: none !important;
        }
      }
    `}</style>
  );
}
