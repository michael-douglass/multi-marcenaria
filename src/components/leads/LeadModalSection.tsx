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
  /** Âncora para o índice do topo pular até aqui. */
  sectionId?: string;
  children: ReactNode;
}

const variantStyles = {
  default: {
    shell: 'lead-modal-panel',
    accent: 'via-gold/35',
    title: 'text-[color:var(--lead-cream)]',
    icon: 'text-[color:var(--lead-gold)]',
  },
  accent: {
    shell: 'lead-modal-panel border-[color:var(--lead-line-strong)]',
    accent: 'via-gold/60',
    title: 'text-[color:var(--lead-cream)]',
    icon: 'text-[color:var(--lead-gold)]',
  },
  alert: {
    shell: 'lead-modal-panel border-amber-500/40',
    accent: 'via-amber-400/50',
    title: 'text-amber-800',
    icon: 'text-amber-700',
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
  sectionId,
  children,
}: LeadModalSectionProps) {
  const styles = variantStyles[variant];

  return (
    <section
      id={sectionId ? `lead-sec-${sectionId}` : undefined}
      data-lead-section={sectionId}
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

      <header className="flex items-start justify-between gap-3 border-b border-[color:var(--lead-line)] px-4 py-3 sm:px-5">
        <div className="min-w-0 space-y-0.5">
          <div className="flex flex-wrap items-center gap-2">
            {Icon && <Icon className={cn('h-4 w-4 shrink-0', styles.icon)} aria-hidden />}
            <h3
              className={cn(
                'text-xs font-bold uppercase tracking-[0.12em]',
                styles.title,
              )}
            >
              {title}
            </h3>
            {badge}
          </div>
          {description && (
            <p className="text-xs text-[color:var(--lead-muted)] leading-relaxed">{description}</p>
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
  onScrollTop,
}: {
  className?: string;
  contentClassName?: string;
  children: ReactNode;
  /** scrollTop atual — para ocultar/mostrar o cabeçalho ao rolar */
  onScrollTop?: (scrollTop: number) => void;
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
        'lead-modal-body flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain outline-none',
        className,
      )}
      onScroll={(event) => {
        onScrollTop?.(event.currentTarget.scrollTop);
      }}
    >
      <div
        className={cn(
          'mx-auto w-full min-w-0 max-w-full space-y-4 px-4 py-4 sm:space-y-5 sm:px-6 sm:py-5 pb-8',
          contentClassName,
        )}
      >
        {children}
      </div>
    </div>
  );
}
