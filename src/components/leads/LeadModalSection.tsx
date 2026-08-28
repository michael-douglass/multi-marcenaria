import type { LucideIcon } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { cn } from '@/lib/utils';
import {
  getLeadModalArrowScrollDelta,
  shouldLeadModalHandleArrowScroll,
} from '@/lib/lead-modal-arrow-scroll';

interface LeadModalSectionProps {
  title: string;
  icon?: LucideIcon;
  badge?: ReactNode;
  actions?: ReactNode;
  description?: string;
  variant?: 'default' | 'accent' | 'alert';
  className?: string;
  children: ReactNode;
}

const variantStyles = {
  default: {
    shell: 'border-gold-border-subtle/25 bg-gradient-to-b from-mahogany-card/50 to-mahogany-elevated/20',
    accent: 'via-gold/35',
    title: 'text-cream-secondary',
    icon: 'text-gold',
  },
  accent: {
    shell: 'border-gold/30 bg-gradient-to-br from-gold/8 via-mahogany-card/40 to-mahogany-elevated/30',
    accent: 'via-gold/60',
    title: 'text-foreground',
    icon: 'text-gold',
  },
  alert: {
    shell: 'border-amber-500/35 bg-gradient-to-br from-amber-500/8 via-mahogany-card/30 to-mahogany-elevated/20',
    accent: 'via-amber-400/50',
    title: 'text-foreground',
    icon: 'text-amber-500',
  },
};

export function LeadModalSection({
  title,
  icon: Icon,
  badge,
  actions,
  description,
  variant = 'default',
  className,
  children,
}: LeadModalSectionProps) {
  const styles = variantStyles[variant];

  return (
    <section
      className={cn(
        'relative overflow-hidden rounded-xl border shadow-sm shadow-black/5',
        styles.shell,
        className,
      )}
    >
      <div
        className={cn(
          'pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent to-transparent',
          styles.accent,
        )}
      />

      <header className="flex items-start justify-between gap-3 border-b border-gold-border-subtle/15 px-4 py-3 sm:px-5">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            {Icon && <Icon className={cn('h-4 w-4 shrink-0', styles.icon)} aria-hidden />}
            <h3
              className={cn(
                'text-[11px] font-semibold uppercase tracking-[0.18em]',
                styles.title,
              )}
            >
              {title}
            </h3>
            {badge}
          </div>
          {description && (
            <p className="text-xs text-cream-muted leading-relaxed">{description}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </header>

      <div className="px-4 py-4 sm:px-5 sm:py-4">{children}</div>
    </section>
  );
}

/** Área rolável do modal com fundo sutil */
export function LeadModalScrollBody({
  className,
  contentClassName,
  children,
}: {
  className?: string;
  contentClassName?: string;
  children: ReactNode;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    el?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      const scrollEl = scrollRef.current;
      if (!shouldLeadModalHandleArrowScroll(event, scrollEl) || !scrollEl) return;

      const delta = getLeadModalArrowScrollDelta(event.key, scrollEl.clientHeight);
      if (delta == null) return;
      if (scrollEl.scrollHeight <= scrollEl.clientHeight + 1) return;

      event.preventDefault();
      event.stopPropagation();
      scrollEl.scrollBy({ top: delta, behavior: 'auto' });
    };

    // capture: pega a seta antes de abas, botões e o dialog do Radix.
    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, []);

  return (
    <div
      ref={scrollRef}
      tabIndex={0}
      data-lead-modal-scroll="true"
      aria-label="Conteúdo do card do lead"
      className={cn(
        'flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain outline-none',
        'bg-[radial-gradient(ellipse_at_top,_rgba(242,216,146,0.04)_0%,_transparent_50%)]',
        'bg-mahogany-muted/10',
        className,
      )}
    >
      <div
        className={cn(
          'mx-auto w-full min-w-0 max-w-full space-y-4 px-3 py-4 sm:space-y-5 sm:px-4 sm:py-5 pb-6',
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
