import { useLayoutEffect, type RefObject } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

interface UseGarboPontuaScrollOptions {
  /** Container com overflow (a apresentação não usa o scroll da janela). */
  scrollerRef: RefObject<HTMLElement | null>;
  rootRef: RefObject<HTMLElement | null>;
  enabled?: boolean;
}

/**
 * Anima a seção Pontua Garbo com GSAP + ScrollTrigger no scroller interno.
 * IntersectionObserver reforça a entrada (mais estável com scroll-snap).
 */
export function useGarboPontuaScroll({
  scrollerRef,
  rootRef,
  enabled = true,
}: UseGarboPontuaScrollOptions) {
  useLayoutEffect(() => {
    if (!enabled) return;
    const scroller = scrollerRef.current;
    const root = rootRef.current;
    if (!scroller || !root) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      root.querySelectorAll<HTMLElement>('[data-pontua-reveal], [data-pontua-step]').forEach((el) => {
        el.style.opacity = '1';
        el.style.transform = 'none';
      });
      root.querySelectorAll<HTMLElement>('[data-pontua-meter-bar], [data-pontua-chart-bar]').forEach((el) => {
        el.style.transform = 'none';
      });
      return;
    }

    const reveals = gsap.utils.toArray<HTMLElement>('[data-pontua-reveal]', root);
    const steps = gsap.utils.toArray<HTMLElement>('[data-pontua-step]', root);
    const meters = gsap.utils.toArray<HTMLElement>('[data-pontua-meter]', root);
    const chartBars = gsap.utils.toArray<HTMLElement>('[data-pontua-chart-bar]', root);
    const chart = root.querySelector<HTMLElement>('[data-pontua-chart]');

    const ctx = gsap.context(() => {
      gsap.set(reveals, { opacity: 0, y: 36 });
      gsap.set(steps, { opacity: 0.2, y: 36 });
      gsap.set(chartBars, { scaleY: 0.06, transformOrigin: 'bottom center' });
      meters.forEach((meter) => {
        const bar = meter.querySelector<HTMLElement>('[data-pontua-meter-bar]');
        if (bar) gsap.set(bar, { scaleX: 0, transformOrigin: 'left center' });
      });

      const playReveal = (els: Element[]) => {
        gsap.to(els, {
          opacity: 1,
          y: 0,
          duration: 0.85,
          stagger: 0.08,
          ease: 'power3.out',
          overwrite: 'auto',
        });
      };

      ScrollTrigger.batch(reveals, {
        scroller,
        start: 'top 90%',
        once: true,
        onEnter: (batch) => playReveal(batch),
      });

      steps.forEach((step, index) => {
        ScrollTrigger.create({
          trigger: step,
          scroller,
          start: 'top 85%',
          onEnter: () => {
            gsap.to(step, {
              opacity: 1,
              y: 0,
              x: 0,
              duration: 0.9,
              ease: 'power3.out',
              overwrite: 'auto',
            });
          },
          onLeaveBack: () => {
            gsap.set(step, { opacity: 0.2, y: 36, x: index % 2 === 0 ? -20 : 20 });
          },
        });
      });

      meters.forEach((meter) => {
        const bar = meter.querySelector<HTMLElement>('[data-pontua-meter-bar]');
        if (!bar) return;
        ScrollTrigger.create({
          trigger: meter,
          scroller,
          start: 'top 88%',
          onEnter: () => {
            gsap.to(bar, {
              scaleX: 1,
              duration: 1.05,
              ease: 'power2.out',
              overwrite: 'auto',
            });
          },
          onLeaveBack: () => {
            gsap.set(bar, { scaleX: 0 });
          },
        });
      });

      if (chart && chartBars.length) {
        ScrollTrigger.create({
          trigger: chart,
          scroller,
          start: 'top 85%',
          onEnter: () => {
            gsap.to(chartBars, {
              scaleY: 1,
              duration: 0.95,
              stagger: 0.07,
              ease: 'power2.out',
              overwrite: 'auto',
            });
          },
          onLeaveBack: () => {
            gsap.set(chartBars, { scaleY: 0.06 });
          },
        });
      }
    }, root);

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const el = entry.target as HTMLElement;
          if (el.hasAttribute('data-pontua-reveal')) {
            gsap.to(el, { opacity: 1, y: 0, duration: 0.85, ease: 'power3.out', overwrite: 'auto' });
          }
          if (el.hasAttribute('data-pontua-step')) {
            gsap.to(el, { opacity: 1, y: 0, x: 0, duration: 0.9, ease: 'power3.out', overwrite: 'auto' });
          }
          if (el.hasAttribute('data-pontua-meter')) {
            const bar = el.querySelector<HTMLElement>('[data-pontua-meter-bar]');
            if (bar) {
              gsap.to(bar, {
                scaleX: 1,
                duration: 1.05,
                ease: 'power2.out',
                overwrite: 'auto',
              });
            }
          }
          if (el.hasAttribute('data-pontua-chart')) {
            gsap.to(chartBars, {
              scaleY: 1,
              duration: 0.95,
              stagger: 0.07,
              ease: 'power2.out',
              overwrite: 'auto',
            });
          }
        });
      },
      { root: scroller, threshold: 0.2, rootMargin: '0px 0px -8% 0px' },
    );

    [...reveals, ...steps, ...meters].forEach((el) => io.observe(el));
    if (chart) io.observe(chart);

    const onScroll = () => ScrollTrigger.update();
    scroller.addEventListener('scroll', onScroll, { passive: true });

    const refresh = () => {
      ScrollTrigger.refresh();
      ScrollTrigger.update();
    };
    const t1 = window.setTimeout(refresh, 100);
    const t2 = window.setTimeout(refresh, 500);

    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      scroller.removeEventListener('scroll', onScroll);
      io.disconnect();
      ctx.revert();
    };
  }, [scrollerRef, rootRef, enabled]);
}
