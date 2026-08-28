import { useLayoutEffect, type RefObject } from 'react';
import { marcarElementoRevelado } from '@/lib/orcamento-slide-reveal';

/** Revela elementos `[data-reveal]` ao entrarem na área visível do container. */
export function useGarboApresentacaoReveal(
  containerRef: RefObject<HTMLElement | null>,
  disabled = false,
) {
  useLayoutEffect(() => {
    if (disabled) return;
    const root = containerRef.current;
    if (!root) return;

    const revelar = (el: HTMLElement) => marcarElementoRevelado(el);

    const els = root.querySelectorAll('[data-reveal]:not([data-revealed="true"])');
    if (!els.length) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      els.forEach((el) => revelar(el as HTMLElement));
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) revelar(e.target as HTMLElement);
        });
      },
      { root, threshold: 0.08, rootMargin: '0px 0px -4% 0px' },
    );

    els.forEach((el) => {
      const html = el as HTMLElement;
      obs.observe(html);
      const rect = html.getBoundingClientRect();
      const rootRect = root.getBoundingClientRect();
      if (rect.top < rootRect.bottom && rect.bottom > rootRect.top) {
        revelar(html);
      }
    });

    return () => obs.disconnect();
  }, [containerRef, disabled]);
}
