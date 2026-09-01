import gsap from 'gsap';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';

gsap.registerPlugin(ScrollToPlugin);

const SECTION_ATTR = 'data-lead-section';
const SCROLL_ATTR = 'data-lead-modal-scroll';

export function getLeadModalScrollEl(): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${SCROLL_ATTR}="true"]`);
}

export function getLeadModalSectionEl(sectionId: string): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[${SECTION_ATTR}="${sectionId}"]`);
}

/**
 * Rola o corpo do card até a seção pedida, com movimento suave.
 * Se a pessoa pediu menos movimento, o salto é instantâneo.
 */
export function scrollLeadModalToSection(sectionId: string, offsetY = 10): boolean {
  const scroller = getLeadModalScrollEl();
  const target = getLeadModalSectionEl(sectionId);
  if (!scroller || !target) return false;

  const top =
    target.getBoundingClientRect().top -
    scroller.getBoundingClientRect().top +
    scroller.scrollTop -
    offsetY;

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReduced) {
    scroller.scrollTo({ top: Math.max(0, top), behavior: 'auto' });
    return true;
  }

  gsap.to(scroller, {
    duration: 0.62,
    ease: 'power3.out',
    overwrite: 'auto',
    scrollTo: { y: Math.max(0, top) },
  });
  return true;
}

/** Espera a seção existir (troca de aba) e então rola. */
export function waitAndScrollLeadModalToSection(sectionId: string, maxFrames = 24): void {
  let tries = 0;
  const tick = () => {
    tries += 1;
    if (scrollLeadModalToSection(sectionId)) return;
    if (tries < maxFrames) window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}
