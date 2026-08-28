import { useEffect, useState, type RefObject } from 'react';
import { cn } from '@/lib/utils';
import {
  GARBO_APRESENTACAO_NAV,
  type GarboApresentacaoNavItem,
} from './garbo-apresentacao-content';
import { GARBO_APRESENTACAO_THEME } from './garbo-apresentacao-theme';

interface GarboApresentacaoProgressProps {
  containerRef: RefObject<HTMLElement | null>;
  /** Chamado quando a pessoa escolhe uma seção manualmente (pausa a rolagem auto). */
  onManualNavigate?: () => void;
  /** Seções da bolinha lateral (padrão = apresentação completa). */
  items?: readonly GarboApresentacaoNavItem[];
}

export function GarboApresentacaoProgress({
  containerRef,
  onManualNavigate,
  items = GARBO_APRESENTACAO_NAV,
}: GarboApresentacaoProgressProps) {
  const [activeId, setActiveId] = useState(items[0]?.id ?? 'hero');

  useEffect(() => {
    const root = containerRef.current;
    if (!root) return;

    const sections = items
      .map((item) => root.querySelector<HTMLElement>(`#${item.id}`))
      .filter(Boolean) as HTMLElement[];

    if (!sections.length) return;

    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { root, threshold: [0.25, 0.5, 0.75] },
    );

    sections.forEach((s) => obs.observe(s));
    return () => obs.disconnect();
  }, [containerRef, items]);

  const activeIndex = Math.max(0, items.findIndex((n) => n.id === activeId));
  const progress = ((activeIndex + 1) / Math.max(1, items.length)) * 100;

  const scrollTo = (id: string) => {
    onManualNavigate?.();
    const root = containerRef.current;
    if (!root) return;
    const el = root.querySelector<HTMLElement>(`#${id}`);
    if (!el) return;
    const top = el.getBoundingClientRect().top - root.getBoundingClientRect().top + root.scrollTop;
    root.scrollTo({ top, behavior: 'smooth' });
  };

  return (
    <>
      <div
        className="pointer-events-none fixed inset-x-0 top-0 z-40 h-1 sm:hidden"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Progresso da apresentação"
      >
        <div
          className="h-full transition-all duration-500 ease-out"
          style={{
            width: `${progress}%`,
            background: GARBO_APRESENTACAO_THEME.gold,
          }}
        />
      </div>

      <nav
        className="fixed right-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-3 sm:flex lg:right-6"
        aria-label="Navegação por seções"
      >
        {items.map((item) => {
          const isActive = item.id === activeId;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => scrollTo(item.id)}
              aria-label={item.label}
              aria-current={isActive ? 'step' : undefined}
              className={cn(
                'group flex min-h-11 min-w-11 items-center justify-center rounded-full transition-all duration-300',
                'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2',
              )}
              style={{ outlineColor: GARBO_APRESENTACAO_THEME.gold }}
            >
              <span
                className={cn(
                  'block rounded-full transition-all duration-300',
                  isActive ? 'h-3 w-3' : 'h-2 w-2 group-hover:h-2.5 group-hover:w-2.5',
                )}
                style={{
                  background: isActive
                    ? GARBO_APRESENTACAO_THEME.gold
                    : 'rgba(242, 216, 146, 0.35)',
                  boxShadow: isActive ? '0 0 12px rgba(242,216,146,0.5)' : 'none',
                }}
              />
            </button>
          );
        })}
      </nav>
    </>
  );
}
