import {
  resolveExportPageSize,
  resolvePrintOrientation,
  resolvePrintPageSize,
  type ExportPrintOrientation,
  type OrcamentoExportViewport,
} from './orcamento-slide-export-constants';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

/** Impressão/PDF idêntico à apresentação — clona o DOM renderizado pelo React. */

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildPrintCss(
  slideWidth: number,
  slideHeight: number,
  printWidth: number,
  printHeight: number,
  orientation: ExportPrintOrientation,
): string {
  const pageSizeCss = orientation === 'landscape' ? 'A4 landscape' : 'A4 portrait';
  const pageWidthMm = orientation === 'landscape' ? '297mm' : '210mm';
  const pageHeightMm = orientation === 'landscape' ? '210mm' : '297mm';

  return `
  @page {
    size: ${pageSizeCss};
    margin: 0;
  }

  html, body {
    margin: 0 !important;
    padding: 0 !important;
    width: ${printWidth}px !important;
    max-width: ${printWidth}px !important;
    height: auto !important;
    overflow: visible !important;
    background: #2a1812;
    -webkit-print-color-adjust: exact !important;
    print-color-adjust: exact !important;
  }

  [data-orcamento-apresentacao] {
    overflow: visible !important;
    height: auto !important;
    min-height: auto !important;
    max-height: none !important;
    scroll-snap-type: none !important;
    transform: none !important;
    width: ${printWidth}px !important;
    max-width: ${printWidth}px !important;
    margin: 0 !important;
  }

  [data-orcamento-apresentacao] > section,
  [data-orcamento-apresentacao] [data-orcamento-slide] {
    page-break-after: always;
    break-after: page;
    break-inside: avoid;
    overflow: visible !important;
    scroll-snap-align: unset !important;
    position: relative !important;
    transform: none !important;
    width: ${slideWidth}px !important;
    max-width: ${slideWidth}px !important;
    min-height: ${slideHeight}px !important;
    height: auto !important;
    max-height: none !important;
  }

  [data-orcamento-apresentacao] > section:last-child,
  [data-orcamento-apresentacao] [data-orcamento-slide]:last-of-type {
    page-break-after: auto;
  }

  [data-reveal] {
    opacity: 1 !important;
    transform: none !important;
    transition: none !important;
  }

  img {
    max-width: 100%;
    max-height: 100%;
    object-fit: contain;
  }

  [data-orcamento-imagem] {
    max-width: 100% !important;
    max-height: 100% !important;
    object-fit: contain !important;
  }

  [data-orcamento-foto-frame],
  [data-orcamento-imagem-frame] {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    max-height: 100% !important;
    height: 100% !important;
  }

  /* Vídeos só na apresentação web — nunca no PDF/impressão */
  video,
  [data-orcamento-video],
  [data-orcamento-video-slide],
  [data-capa-atmosphere],
  [data-cubo-magico] {
    display: none !important;
  }

  *,
  *::before,
  *::after {
    box-shadow: none !important;
    filter: none !important;
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }

  .orcamento-legivel-sobre-fundo :is(.rounded-xl, .rounded-2xl, .rounded-lg) {
    background-color: rgba(22, 12, 6, 0.9) !important;
    border: 1px solid rgba(201, 160, 123, 0.35) !important;
    box-shadow: none !important;
  }

  .orcamento-legivel-sobre-fundo :is(h1, h2, h3, h4, p, span, label, li) {
    text-shadow: 0 1px 3px rgba(0,0,0,0.85), 0 2px 10px rgba(0,0,0,0.55) !important;
  }

  /* Cada dobra = exatamente uma página A4 no PDF */
  .orcamento-print-pagina {
    width: ${printWidth}px !important;
    height: ${printHeight}px !important;
    max-width: ${printWidth}px !important;
    max-height: ${printHeight}px !important;
    overflow: hidden !important;
    page-break-after: always !important;
    break-after: page !important;
    break-inside: avoid !important;
    page-break-inside: avoid !important;
    position: relative !important;
    background: #2a1812;
    box-sizing: border-box !important;
  }

  /* Evita página em branco no final do PDF/impressão */
  .orcamento-print-pagina:last-child {
    page-break-after: auto !important;
    break-after: auto !important;
  }

  .orcamento-print-pagina > * {
    page-break-after: auto !important;
    break-after: auto !important;
    min-height: unset !important;
    max-height: none !important;
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    transform-origin: top left !important;
  }

  .orcamento-print-pagina .rounded-xl,
  .orcamento-print-pagina .rounded-2xl,
  .orcamento-print-pagina .rounded-lg {
    break-inside: avoid !important;
    page-break-inside: avoid !important;
  }

  @media print {
    html, body {
      width: 100% !important;
      max-width: none !important;
      height: auto !important;
    }

    .orcamento-print-pagina {
      width: ${pageWidthMm} !important;
      height: ${pageHeightMm} !important;
      max-width: ${pageWidthMm} !important;
      max-height: ${pageHeightMm} !important;
      overflow: hidden !important;
    }

    .orcamento-print-pagina:last-child {
      page-break-after: auto !important;
      break-after: auto !important;
    }
  }

  /* PDF celular: layout natural — imagens grandes + texto central com margem */
  ${
    orientation === 'portrait'
      ? `
  [data-orcamento-pdf-mobile='true'] section,
  [data-orcamento-pdf-mobile='true'] [data-orcamento-slide] {
    padding-left: 40px !important;
    padding-right: 40px !important;
    box-sizing: border-box !important;
  }
  [data-orcamento-pdf-mobile='true'] h1,
  [data-orcamento-pdf-mobile='true'] h2,
  [data-orcamento-pdf-mobile='true'] h3 {
    text-align: center !important;
    margin-left: auto !important;
    margin-right: auto !important;
    max-width: min(920px, 88%) !important;
  }
  [data-orcamento-pdf-mobile='true'] p {
    text-align: center !important;
  }
  [data-orcamento-pdf-mobile='true'] .ferragem-card {
    min-height: 200px !important;
    align-items: stretch !important;
    max-width: min(920px, 88%) !important;
    margin-left: auto !important;
    margin-right: auto !important;
  }
  [data-orcamento-pdf-mobile='true'] .ferragem-card__media::after {
    display: none !important;
    opacity: 0 !important;
  }
  [data-orcamento-pdf-mobile='true'] .ferragem-card__media {
    width: 46% !important;
    min-width: 220px !important;
    min-height: 200px !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    background: radial-gradient(ellipse at 40% 30%, #FFFDF8 0%, #F4E6D2 55%, #E6D2B8 100%) !important;
  }
  [data-orcamento-pdf-mobile='true'] .ferragem-card__media img,
  [data-orcamento-pdf-mobile='true'] [data-orcamento-icone-ferragem] {
    max-width: calc(100% - 16px) !important;
    max-height: 176px !important;
    min-width: 110px !important;
    min-height: 110px !important;
    padding: 8px !important;
    object-fit: contain !important;
    opacity: 1 !important;
    filter: none !important;
  }
  [data-orcamento-pdf-mobile='true'] .ferragem-card__index {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: center !important;
    min-width: 88px !important;
    min-height: 88px !important;
    padding: 12px 16px !important;
    border-radius: 18px !important;
    background: linear-gradient(165deg, #FFF9F1 0%, #F0DCC0 100%) !important;
    box-shadow: inset 0 0 0 2px rgba(201, 160, 123, 0.55) !important;
    font-size: 56px !important;
    line-height: 1 !important;
    opacity: 0.92 !important;
    font-weight: 900 !important;
  }
  `
      : ''
  }
`;
}

function coletarEstilosDocumento(): string {
  const partes: string[] = [];
  document.querySelectorAll('link[rel="stylesheet"]').forEach((link) => {
    partes.push(link.outerHTML);
  });
  document.querySelectorAll('style').forEach((style) => {
    partes.push(style.outerHTML);
  });
  return partes.join('\n');
}

/** Aguarda imagens e fontes — sem rolar slide a slide (muito mais rápido). */
async function aguardarRecursosNoRoot(root: HTMLElement, timeoutMs = 20_000): Promise<void> {
  const imagens = Array.from(root.querySelectorAll('img'));

  const imagensProntas = Promise.all(
    imagens.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.loading === 'lazy') img.loading = 'eager';
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.onload = done;
          img.onerror = done;
          // Imagem travada/CORS: não segura a exportação para sempre.
          window.setTimeout(done, Math.min(timeoutMs, 12_000));
        }),
    ),
  );

  const fontesProntas = document.fonts?.ready ?? Promise.resolve();

  await Promise.race([
    Promise.all([imagensProntas, fontesProntas]),
    new Promise<void>((resolve) => window.setTimeout(resolve, timeoutMs)),
  ]);

  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
}

/** Dispara lazy-load percorrendo os slides uma vez (sem pausa entre cada um). */
async function prepararConteudoParaCaptura(root: HTMLElement): Promise<void> {
  const secoes = root.querySelectorAll('section, [data-orcamento-slide]');
  secoes.forEach((secao) => secao.scrollIntoView({ block: 'start' }));
  root.scrollTop = 0;
  await aguardarRecursosNoRoot(root);
}

function revelarElementosOcultos(root: HTMLElement): void {
  root.querySelectorAll('[data-reveal]').forEach((el) => {
    const html = el as HTMLElement;
    html.style.opacity = '1';
    html.style.transform = 'none';
    html.style.transition = 'none';
  });

  root.querySelectorAll('*').forEach((el) => {
    const html = el as HTMLElement;
    html.style.boxShadow = 'none';
    html.style.filter = 'none';
    html.style.backdropFilter = 'none';
    html.style.webkitBackdropFilter = 'none';
  });
}

function coletarSlidesDoRoot(root: HTMLElement): HTMLElement[] {
  return Array.from(
    root.querySelectorAll<HTMLElement>(':scope > [data-orcamento-slide], :scope > section'),
  );
}

function escalaCapturaPdf(viewport: OrcamentoExportViewport): number {
  // Celular 1080×1920 já é pesado — escala 1 reduz risco de travar/OOM.
  if (viewport === 'mobile') {
    return 1;
  }
  return Math.min(Math.max(window.devicePixelRatio || 1, 1), 1.5);
}

function prepararClone(
  root: HTMLElement,
  viewport: OrcamentoExportViewport,
  slideWidth: number,
  slideHeight: number,
): HTMLElement {
  const clone = root.cloneNode(true) as HTMLElement;

  // Vídeos só no site — remove players e páginas só de vídeo do PDF/impressão.
  clone.querySelectorAll('[data-orcamento-video-slide]').forEach((el) => el.remove());
  clone.querySelectorAll('[data-orcamento-video], video').forEach((el) => el.remove());

  clone.querySelectorAll('[data-reveal]').forEach((el) => {
    const html = el as HTMLElement;
    html.style.opacity = '1';
    html.style.transform = 'none';
    html.style.transition = 'none';
  });

  clone.querySelectorAll('*').forEach((el) => {
    const html = el as HTMLElement;
    html.style.boxShadow = 'none';
    html.style.filter = 'none';
    html.style.backdropFilter = 'none';
    html.style.webkitBackdropFilter = 'none';
  });

  const slideHeightPx = `${slideHeight}px`;
  const slideWidthPx = `${slideWidth}px`;

  clone.querySelectorAll('[data-orcamento-slide], [data-orcamento-apresentacao] > section').forEach((section) => {
    const s = section as HTMLElement;
    s.style.minHeight = slideHeightPx;
    s.style.height = slideHeightPx;
    s.style.maxHeight = slideHeightPx;
    s.style.width = slideWidthPx;
    s.style.maxWidth = slideWidthPx;
    s.style.overflow = 'hidden';
    s.style.breakInside = 'avoid';
    s.style.transform = 'none';
    s.style.transformOrigin = 'top left';
  });

  clone.style.overflow = 'visible';
  clone.style.height = 'auto';
  clone.style.minHeight = 'auto';
  clone.style.maxHeight = 'none';
  clone.style.scrollSnapType = 'none';
  clone.style.transform = 'none';
  clone.setAttribute('data-export-viewport', viewport);
  clone.setAttribute('data-viewport', viewport);

  if (viewport === 'mobile') {
    otimizarIconesPdfMobile(clone, slideHeight);
  }

  return clone;
}

function aguardarRecursos(janela: Window): Promise<void> {
  const doc = janela.document;
  const imagens = Array.from(doc.images);

  const imagensProntas = Promise.all(
    imagens.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) {
            resolve();
            return;
          }
          img.onload = () => resolve();
          img.onerror = () => resolve();
        }),
    ),
  );

  const fontesProntas = doc.fonts?.ready ?? Promise.resolve();

  return Promise.all([imagensProntas, fontesProntas]).then(() => undefined);
}

/**
 * Escala o slide para caber inteiro na página A4 (contain — igual à pré-visualização).
 */
function aplicarEscalaPagina(
  slide: HTMLElement,
  slideWidth: number,
  slideHeight: number,
  printWidth: number,
  printHeight: number,
): void {
  const contentHeight = slideHeight;

  const scale = Math.min(printWidth / slideWidth, printHeight / contentHeight);

  const scaledW = slideWidth * scale;
  const scaledH = contentHeight * scale;
  const offsetX = (printWidth - scaledW) / 2;
  const offsetY = (printHeight - scaledH) / 2;

  slide.style.width = `${slideWidth}px`;
  slide.style.maxWidth = `${slideWidth}px`;
  slide.style.height = `${contentHeight}px`;
  slide.style.minHeight = `${slideHeight}px`;
  slide.style.maxHeight = `${slideHeight}px`;
  slide.style.overflow = 'hidden';
  slide.style.transform = `translate(${offsetX}px, ${offsetY}px) scale(${scale})`;
  slide.style.transformOrigin = 'top left';
}

/**
 * Uma dobra = uma página A4. Conteúdo escalado para ocupar a folha.
 */
function encapsularSlidesUmaPagina(
  janela: Window,
  slideWidth: number,
  slideHeight: number,
  printWidth: number,
  printHeight: number,
): void {
  const doc = janela.document;
  const raiz = doc.querySelector('[data-orcamento-apresentacao]');
  if (!raiz) return;

  const slides = Array.from(
    raiz.querySelectorAll<HTMLElement>(':scope > [data-orcamento-slide], :scope > section'),
  );

  slides.forEach((slide) => {
    const wrapper = doc.createElement('div');
    wrapper.className = 'orcamento-print-pagina';
    slide.parentNode?.insertBefore(wrapper, slide);
    wrapper.appendChild(slide);
    aplicarEscalaPagina(slide, slideWidth, slideHeight, printWidth, printHeight);
  });
}

function coletarSlidesExportacao(doc: Document): HTMLElement[] {
  const raiz = doc.querySelector('[data-orcamento-apresentacao]');
  if (!raiz) return [];
  return Array.from(
    raiz.querySelectorAll<HTMLElement>(':scope > [data-orcamento-slide], :scope > section'),
  );
}

function prepararSlidesParaCaptura(
  slides: HTMLElement[],
  slideWidth: number,
  slideHeight: number,
): void {
  const slideWidthPx = `${slideWidth}px`;
  const slideHeightPx = `${slideHeight}px`;

  slides.forEach((slide) => {
    slide.style.width = slideWidthPx;
    slide.style.maxWidth = slideWidthPx;
    slide.style.height = slideHeightPx;
    slide.style.minHeight = slideHeightPx;
    slide.style.maxHeight = slideHeightPx;
    slide.style.overflow = 'hidden';
    slide.style.transform = 'none';
    slide.style.transformOrigin = 'top left';
    slide.style.boxShadow = 'none';
    slide.style.filter = 'none';
    slide.style.backdropFilter = 'none';
    slide.style.webkitBackdropFilter = 'none';
  });
}

/**
 * Se o conteúdo passou da altura da página, reduz em escala (sem cortar no meio).
 * Garante 1 slide = 1 página visualmente completa.
 */
function encaixarConteudoNosSlides(
  slides: HTMLElement[],
  slideWidth: number,
  slideHeight: number,
): void {
  slides.forEach((slide) => {
    if (slide.querySelector('[data-orcamento-print-fit]')) return;

    slide.style.width = `${slideWidth}px`;
    slide.style.maxWidth = `${slideWidth}px`;
    slide.style.height = 'auto';
    slide.style.minHeight = '0';
    slide.style.maxHeight = 'none';
    slide.style.overflow = 'visible';
    slide.style.transform = 'none';

    const contentHeight = Math.ceil(
      Math.max(slide.scrollHeight, slide.offsetHeight, slide.getBoundingClientRect().height),
    );

    slide.style.height = `${slideHeight}px`;
    slide.style.minHeight = `${slideHeight}px`;
    slide.style.maxHeight = `${slideHeight}px`;
    slide.style.overflow = 'hidden';

    if (contentHeight <= slideHeight + 4) return;

    const scale = Math.min(1, slideHeight / contentHeight);
    if (scale >= 0.995) return;

    const fit = slide.ownerDocument.createElement('div');
    fit.setAttribute('data-orcamento-print-fit', '');
    fit.style.width = `${slideWidth}px`;
    fit.style.height = `${contentHeight}px`;
    fit.style.transformOrigin = 'top center';
    fit.style.transform = `scale(${scale})`;
    fit.style.willChange = 'transform';

    while (slide.firstChild) {
      fit.appendChild(slide.firstChild);
    }
    slide.appendChild(fit);
  });
}

/**
 * PDF/imagem no formato celular: layout natural de telefone.
 * Imagens grandes, textos centralizados com margem, tipografia legível.
 * Só altera o DOM temporário da exportação.
 */
function otimizarIconesPdfMobile(root: HTMLElement, slideHeightHint = 1920): void {
  root.setAttribute('data-orcamento-pdf-mobile', 'true');

  const MARGIN_X = 40; // ~3.7% de 1080 — margem lateral confortável
  const TEXT_MAX = 'min(920px, 88%)';

  // Tipografia e centralização em todo o slide.
  root.querySelectorAll<HTMLElement>('h1, h2, h3').forEach((el) => {
    const current = Number.parseFloat(getComputedStyle(el).fontSize) || 28;
    el.style.fontSize = `${Math.max(current * 1.22, 36)}px`;
    el.style.lineHeight = '1.12';
    el.style.textAlign = 'center';
    el.style.marginLeft = 'auto';
    el.style.marginRight = 'auto';
    el.style.maxWidth = TEXT_MAX;
  });

  root.querySelectorAll<HTMLElement>('p, span, label, li').forEach((el) => {
    // Não mexe em números/ícones de card (já tratados abaixo).
    if (el.classList.contains('ferragem-card__index')) return;
    if (el.closest('.ferragem-card__media')) return;

    const tag = el.tagName.toLowerCase();
    if (tag === 'p' || tag === 'li') {
      const current = Number.parseFloat(getComputedStyle(el).fontSize) || 15;
      el.style.fontSize = `${Math.max(current * 1.18, 18)}px`;
      el.style.lineHeight = '1.55';
    }
    el.style.textAlign = 'center';
  });

  // Colunas de texto: centraliza e respeita margem.
  root.querySelectorAll<HTMLElement>('section, [data-orcamento-slide]').forEach((slide) => {
    slide.style.paddingLeft = `${MARGIN_X}px`;
    slide.style.paddingRight = `${MARGIN_X}px`;
    slide.style.boxSizing = 'border-box';

    slide.querySelectorAll<HTMLElement>('.flex.flex-col, [class*="max-w-"]').forEach((col) => {
      if (col.querySelector('img, video, [data-orcamento-imagem], .ferragem-card')) return;
      const onlyText = col.querySelector('h1, h2, h3, p');
      if (!onlyText) return;
      col.style.marginLeft = 'auto';
      col.style.marginRight = 'auto';
      col.style.maxWidth = TEXT_MAX;
      col.style.width = '100%';
      col.style.alignItems = 'center';
      col.style.textAlign = 'center';
    });
  });

  // Fotos hero / projeto: grandes, mas sempre dentro da página (evita cortar no meio).
  const HERO_MAX = Math.round(slideHeightHint * 0.52);
  const HERO_MIN = Math.round(slideHeightHint * 0.28);

  // Quadros 1920×1080 (paisagem): preserva 16:9 no PDF celular.
  root.querySelectorAll<HTMLElement>('[data-orcamento-ratio="16/9"]').forEach((frame) => {
    frame.style.aspectRatio = '16 / 9';
    frame.style.width = '100%';
    frame.style.maxWidth = '100%';
    frame.style.height = 'auto';
    frame.style.minHeight = '0';
    frame.style.maxHeight = 'none';
    frame.style.marginLeft = 'auto';
    frame.style.marginRight = 'auto';
    const img = frame.querySelector<HTMLImageElement>('img, [data-orcamento-imagem]');
    if (img) {
      img.style.width = '100%';
      img.style.height = '100%';
      img.style.maxWidth = '100%';
      img.style.maxHeight = '100%';
      img.style.objectFit = 'cover';
    }
  });

  root
    .querySelectorAll<HTMLElement>(
      '[data-orcamento-foto-frame], [data-orcamento-imagem-frame], [data-orcamento-imagem]',
    )
    .forEach((el) => {
      if (el.closest('.ferragem-card')) return;
      if (el.closest('[data-orcamento-ratio="16/9"]')) return;
      if (el.getAttribute('data-orcamento-ratio') === '16/9') return;
      if (el.tagName === 'IMG' || el.hasAttribute('data-orcamento-imagem')) {
        const img = el as HTMLImageElement;
        // Não forçar cover em logos pequenos.
        const rect = img.getBoundingClientRect();
        if (rect.height > 0 && rect.height < 120) return;
        img.style.width = '100%';
        img.style.maxWidth = '100%';
        img.style.height = 'auto';
        img.style.maxHeight = `${HERO_MAX}px`;
        img.style.objectFit = 'cover';
        return;
      }
      el.style.width = '100%';
      el.style.maxWidth = '100%';
      el.style.minHeight = `${HERO_MIN}px`;
      el.style.height = 'auto';
      el.style.maxHeight = `${HERO_MAX}px`;
      el.style.flex = '1 1 auto';
      el.style.marginLeft = 'auto';
      el.style.marginRight = 'auto';
    });

  // Blocos de foto da capa (div com overflow + aspect ratio).
  root.querySelectorAll<HTMLElement>('section .relative.overflow-hidden, section [class*="overflow-hidden"]').forEach((box) => {
    if (box.closest('.ferragem-card')) return;
    if (box.closest('[data-orcamento-ratio="16/9"]') || box.getAttribute('data-orcamento-ratio') === '16/9') {
      return;
    }
    const hasHeroImg = box.querySelector('img[data-orcamento-imagem], [data-orcamento-imagem]');
    if (!hasHeroImg) return;
    const rect = box.getBoundingClientRect();
    if (rect.height > 0 && rect.height < 200) {
      box.style.minHeight = `${HERO_MIN}px`;
      box.style.height = `${Math.min(HERO_MIN + 80, HERO_MAX)}px`;
      box.style.maxHeight = `${HERO_MAX}px`;
      box.style.width = '100%';
      box.style.maxWidth = '100%';
    } else if (rect.height > 0 && rect.height < 700) {
      box.style.minHeight = `${Math.min(Math.max(rect.height, HERO_MIN), HERO_MAX)}px`;
      box.style.maxHeight = `${HERO_MAX}px`;
      box.style.width = '100%';
    }
  });

  // Remove véu soft-light que apaga ícones no html2canvas.
  root.querySelectorAll<HTMLElement>('.ferragem-card__media').forEach((media) => {
    media.style.setProperty('--fc-wash', '0');
  });

  const cardCount = root.querySelectorAll('.ferragem-card').length;
  const cardMinH = cardCount >= 4 ? 156 : cardCount >= 3 ? 172 : 188;

  root.querySelectorAll<HTMLElement>('.ferragem-card').forEach((card) => {
    card.style.minHeight = `${cardMinH}px`;
    card.style.alignItems = 'stretch';
    card.style.boxShadow = 'inset 0 0 0 1px rgba(242, 216, 146, 0.35)';
    card.style.width = '100%';
    card.style.maxWidth = TEXT_MAX;
    card.style.marginLeft = 'auto';
    card.style.marginRight = 'auto';

    const media = card.querySelector<HTMLElement>('.ferragem-card__media');
    if (media) {
      media.style.width = '46%';
      media.style.minWidth = '200px';
      media.style.minHeight = `${cardMinH}px`;
      media.style.height = 'auto';
      media.style.display = 'flex';
      media.style.alignItems = 'center';
      media.style.justifyContent = 'center';
      media.style.flexShrink = '0';
      media.style.background =
        'radial-gradient(ellipse at 40% 30%, #FFFDF8 0%, #F4E6D2 55%, #E6D2B8 100%)';

      const img =
        media.querySelector<HTMLImageElement>('[data-orcamento-icone-ferragem]') ||
        media.querySelector<HTMLImageElement>('img');
      if (img) {
        const raw = img.getAttribute('src') || '';
        if (raw.includes('/render/image/public/')) {
          const original = raw
            .split('?')[0]
            .replace('/storage/v1/render/image/public/', '/storage/v1/object/public/');
          if (original && original !== raw.split('?')[0]) {
            img.src = original;
          }
        }
        img.style.maxWidth = 'calc(100% - 16px)';
        img.style.maxHeight = `${Math.round(cardMinH * 0.88)}px`;
        img.style.minWidth = '96px';
        img.style.minHeight = '96px';
        img.style.width = 'auto';
        img.style.height = 'auto';
        img.style.padding = '8px';
        img.style.margin = '0 auto';
        img.style.objectFit = 'contain';
        img.style.opacity = '1';
        img.style.filter = 'none';
      }
    }

    const index = card.querySelector<HTMLElement>('.ferragem-card__index');
    if (index) {
      index.style.display = 'inline-flex';
      index.style.alignItems = 'center';
      index.style.justifyContent = 'center';
      index.style.minWidth = '72px';
      index.style.minHeight = '72px';
      index.style.padding = '10px 14px';
      index.style.borderRadius = '16px';
      index.style.background = 'linear-gradient(165deg, #FFF9F1 0%, #F0DCC0 100%)';
      index.style.boxShadow = 'inset 0 0 0 2px rgba(201, 160, 123, 0.55)';
      index.style.fontSize = cardCount >= 4 ? '44px' : '52px';
      index.style.lineHeight = '1';
      index.style.opacity = '0.92';
      index.style.fontWeight = '900';
      index.style.letterSpacing = '-0.03em';
      index.style.textAlign = 'center';
    }

    const texto = media?.nextElementSibling as HTMLElement | null;
    if (texto) {
      texto.style.padding = '16px 18px';
      texto.style.gap = '8px';
      texto.style.justifyContent = 'center';
      texto.style.textAlign = 'center';
      texto.style.alignItems = 'center';
    }
  });

  // Ícones SVG (Lucide etc.) ficam legíveis no A4 retrato.
  root.querySelectorAll<SVGElement>('svg').forEach((svg) => {
    const box = svg.getBoundingClientRect();
    const attrW = Number.parseFloat(svg.getAttribute('width') || '0');
    const classHint = svg.getAttribute('class') || '';
    const looksSmall =
      (box.width > 0 && box.width < 34) ||
      (attrW > 0 && attrW < 34) ||
      /\bh-(2\.5|3|3\.5|4)\b/.test(classHint);

    if (looksSmall || box.width === 0) {
      svg.style.width = '32px';
      svg.style.height = '32px';
      svg.style.minWidth = '32px';
      svg.style.minHeight = '32px';
      svg.style.flexShrink = '0';
      svg.setAttribute('stroke-width', '2.25');
    }
  });
}

/**
 * Vídeos só na apresentação web — remove páginas e players antes do PDF/imagem.
 * Também prepara imagens (eager + encaixe) para saírem nítidas na captura.
 */
function excluirVideosEPrepararImagensParaExport(root: HTMLElement): void {
  root.querySelectorAll<HTMLElement>('[data-orcamento-video-slide]').forEach((el) => {
    el.remove();
  });

  root.querySelectorAll<HTMLElement>('[data-orcamento-video], video').forEach((el) => {
    el.remove();
  });

  root.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
    if (img.loading === 'lazy') img.loading = 'eager';
    img.style.objectFit = img.style.objectFit || 'contain';
    img.style.maxWidth = '100%';
    img.style.maxHeight = '100%';
    img.decoding = 'sync';
  });

  // Molduras de foto do projeto: preenchem o slide sem depender de 100dvh da janela.
  root
    .querySelectorAll<HTMLElement>('[data-orcamento-foto-frame], [data-orcamento-imagem-frame]')
    .forEach((frame) => {
      frame.style.maxHeight = '100%';
      frame.style.height = '100%';
      frame.style.width = '100%';
      frame.style.display = 'flex';
      frame.style.alignItems = 'center';
      frame.style.justifyContent = 'center';
    });
}

function coletarSlidesExportaveis(root: HTMLElement): HTMLElement[] {
  return coletarSlidesDoRoot(root).filter(
    (slide) =>
      !slide.hasAttribute('data-orcamento-video-slide') &&
      !slide.querySelector('[data-orcamento-video], video'),
  );
}

/** Encaixa conteúdo na página mantendo proporção (sem cortar). */
function calcularEncaixeContainMm(
  contentWidth: number,
  contentHeight: number,
  pageWidthMm: number,
  pageHeightMm: number,
): { x: number; y: number; w: number; h: number } {
  const ratio = contentWidth / contentHeight;
  const pageRatio = pageWidthMm / pageHeightMm;

  if (ratio > pageRatio) {
    const w = pageWidthMm;
    const h = pageWidthMm / ratio;
    return { x: 0, y: (pageHeightMm - h) / 2, w, h };
  }

  const h = pageHeightMm;
  const w = pageHeightMm * ratio;
  return { x: (pageWidthMm - w) / 2, y: 0, w, h };
}

interface ExportDocumento {
  html: string;
  slideSize: ReturnType<typeof resolveExportPageSize>;
  printSize: ReturnType<typeof resolvePrintPageSize>;
  orientation: ExportPrintOrientation;
}

async function montarDocumentoExportacao(
  rootElement: HTMLElement,
  titulo: string,
  viewport: OrcamentoExportViewport,
): Promise<ExportDocumento> {
  const slideSize = resolveExportPageSize(viewport);
  const printSize = resolvePrintPageSize(viewport);
  const orientation = resolvePrintOrientation(viewport);

  await prepararConteudoParaCaptura(rootElement);

  const clone = prepararClone(rootElement, viewport, slideSize.width, slideSize.height);
  const estilos = coletarEstilosDocumento();
  const baseHref = `<base href="${esc(window.location.origin)}/" />`;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=${printSize.width}, height=${printSize.height}" />
  <title>${esc(titulo)} — Proposta Comercial</title>
  ${baseHref}
  ${estilos}
  <style>${buildPrintCss(slideSize.width, slideSize.height, printSize.width, printSize.height, orientation)}</style>
</head>
<body data-export-viewport="${viewport}">
  ${clone.outerHTML}
</body>
</html>`;

  return { html, slideSize, printSize, orientation };
}

function criarIframeOculto(width: number, height: number): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.tabIndex = -1;
  iframe.style.cssText = [
    'position:fixed',
    'left:0',
    'top:0',
    `width:${width}px`,
    `height:${Math.max(height, 600)}px`,
    'border:0',
    'opacity:0',
    'pointer-events:none',
    'z-index:-1',
  ].join(';');
  document.body.appendChild(iframe);
  return iframe;
}

async function injetarHtmlNoIframe(
  html: string,
  slideSize: ExportDocumento['slideSize'],
  printSize: ExportDocumento['printSize'],
  prepararPaginasImpressao = true,
): Promise<{ iframe: HTMLIFrameElement; janela: Window }> {
  const iframe = criarIframeOculto(slideSize.width, slideSize.height);
  const janela = iframe.contentWindow;
  if (!janela) {
    iframe.remove();
    throw new Error('Não foi possível preparar o PDF.');
  }

  janela.document.open();
  janela.document.write(html);
  janela.document.close();

  await aguardarRecursos(janela);

  if (prepararPaginasImpressao) {
    encapsularSlidesUmaPagina(
      janela,
      slideSize.width,
      slideSize.height,
      printSize.width,
      printSize.height,
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  return { iframe, janela };
}

function triggerBlobDownload(blob: Blob, downloadName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = downloadName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2000);
}

function slugTituloExport(titulo: string): string {
  return (
    titulo
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'proposta'
  );
}

function buildPdfFileName(titulo: string): string {
  return `proposta-${slugTituloExport(titulo)}.pdf`;
}

async function canvasToJpegBlob(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falha ao converter slide em imagem.'))),
      'image/jpeg',
      quality,
    );
  });
}

function aguardarMs(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

async function capturarSlidesComoCanvas(
  rootElement: HTMLElement,
  viewport: OrcamentoExportViewport,
): Promise<{ canvases: HTMLCanvasElement[]; slideWidth: number; slideHeight: number }> {
  const slideSize = resolveExportPageSize(viewport);

  excluirVideosEPrepararImagensParaExport(rootElement);
  await prepararConteudoParaCaptura(rootElement);
  revelarElementosOcultos(rootElement);

  if (viewport === 'mobile') {
    otimizarIconesPdfMobile(rootElement, slideSize.height);
  }

  const slides = coletarSlidesExportaveis(rootElement);
  if (slides.length === 0) {
    throw new Error('Nenhum slide encontrado para exportar.');
  }

  // Primeiro mede/encaixa o conteúdo; depois trava cada slide numa página fixa.
  encaixarConteudoNosSlides(slides, slideSize.width, slideSize.height);
  prepararSlidesParaCaptura(slides, slideSize.width, slideSize.height);
  await aguardarRecursosNoRoot(rootElement);
  await new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));

  const scale = escalaCapturaPdf(viewport);
  const canvases: HTMLCanvasElement[] = [];

  for (let i = 0; i < slides.length; i++) {
    // Garante que o slide está “na tela” do container (evita captura vazia por overflow).
    slides[i].scrollIntoView({ block: 'start', inline: 'nearest' });
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    let canvas: HTMLCanvasElement;
    try {
      canvas = await html2canvas(slides[i], {
        scale,
        useCORS: true,
        // allowTaint:true + toDataURL quebra com SecurityError em imagens cross-origin.
        allowTaint: false,
        backgroundColor: '#2a1812',
        logging: false,
        width: slideSize.width,
        height: slideSize.height,
        windowWidth: slideSize.width,
        windowHeight: slideSize.height,
        // Ignora qualquer vídeo remanescente (html2canvas não renderiza <video> bem).
        ignoreElements: (el) =>
          el instanceof HTMLElement &&
          (el.tagName === 'VIDEO' ||
            el.hasAttribute('data-orcamento-video') ||
            el.hasAttribute('data-orcamento-video-slide')),
      });
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'erro desconhecido';
      throw new Error(`Falha ao capturar o slide ${i + 1}: ${detail}`);
    }

    if (canvas.width === 0 || canvas.height === 0) {
      throw new Error(`Falha ao capturar o slide ${i + 1}. Tente novamente.`);
    }
    canvases.push(canvas);
  }

  return {
    canvases,
    slideWidth: slideSize.width,
    slideHeight: slideSize.height,
  };
}

/**
 * Gera e baixa o PDF diretamente — captura cada slide no DOM (sem iframe, mais rápido).
 */
export async function baixarOrcamentoApresentacaoPdf(
  rootElement: HTMLElement,
  titulo: string,
  viewport: OrcamentoExportViewport,
): Promise<void> {
  const orientation = resolvePrintOrientation(viewport);
  const { canvases, slideWidth, slideHeight } = await capturarSlidesComoCanvas(rootElement, viewport);

  const pdfOrientation = orientation === 'landscape' ? 'landscape' : 'portrait';
  const pdf = new jsPDF({ orientation: pdfOrientation, unit: 'mm', format: 'a4' });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const PDF_BG = { r: 42, g: 24, b: 18 };

  for (let i = 0; i < canvases.length; i++) {
    if (i > 0) pdf.addPage();

    pdf.setFillColor(PDF_BG.r, PDF_BG.g, PDF_BG.b);
    pdf.rect(0, 0, pageW, pageH, 'F');

    const encaixe = calcularEncaixeContainMm(slideWidth, slideHeight, pageW, pageH);
    let imgData: string;
    try {
      imgData = canvases[i].toDataURL('image/jpeg', 0.92);
    } catch {
      throw new Error(
        'Não foi possível converter os slides em PDF (imagem bloqueada pelo navegador). Tente novamente.',
      );
    }
    pdf.addImage(imgData, 'JPEG', encaixe.x, encaixe.y, encaixe.w, encaixe.h);
    // Libera memória do canvas assim que a página for gravada.
    canvases[i].width = 0;
    canvases[i].height = 0;
  }

  triggerBlobDownload(pdf.output('blob'), buildPdfFileName(titulo));
}

/**
 * Captura cada slide como JPEG e baixa as imagens diretamente (uma por página).
 */
export async function baixarOrcamentoApresentacaoImagens(
  rootElement: HTMLElement,
  titulo: string,
  viewport: OrcamentoExportViewport,
): Promise<void> {
  const { canvases } = await capturarSlidesComoCanvas(rootElement, viewport);
  const slug = slugTituloExport(titulo);
  const pad = String(canvases.length).length;

  for (let i = 0; i < canvases.length; i++) {
    const page = String(i + 1).padStart(Math.max(pad, 2), '0');
    const blob = await canvasToJpegBlob(canvases[i]);
    triggerBlobDownload(blob, `${slug}-pagina-${page}.jpg`);
    // Pequena pausa para o navegador não bloquear vários downloads seguidos.
    if (i < canvases.length - 1) {
      await aguardarMs(350);
    }
  }
}

/**
 * Abre janela de impressão com cópia fiel da apresentação no viewport escolhido.
 * O usuário escolhe "Salvar como PDF" no diálogo do navegador.
 */
export async function imprimirOrcamentoApresentacao(
  rootElement: HTMLElement,
  titulo: string,
  viewport: OrcamentoExportViewport,
): Promise<boolean> {
  const documento = await montarDocumentoExportacao(rootElement, titulo, viewport);

  const janela = window.open('', '_blank');
  if (!janela) {
    return false;
  }

  janela.document.open();
  janela.document.write(documento.html);
  janela.document.close();

  await aguardarRecursos(janela);
  encapsularSlidesUmaPagina(
    janela,
    documento.slideSize.width,
    documento.slideSize.height,
    documento.printSize.width,
    documento.printSize.height,
  );
  await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  janela.focus();
  janela.print();
  return true;
}
