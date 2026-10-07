/**
 * Exporta a folha comercial em PDF/JPG.
 * Captura fora do diálogo (ancestrais com transform quebram o html2canvas).
 * Cada página A4 é capturada e gravada na proporção correta (sem achatar).
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  MARKUP_ORCAMENTO_SIMPLES_ALTURA_PX,
  MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX,
  nomeArquivoOrcamentoSimples,
} from '@/lib/markup-orcamento-simples';

const EXPORT_SCALE = 2.4;
const A4_W_MM = 210;
const A4_H_MM = 297;
const JPEG_QUALITY = 0.92;
const EMBED_MAX_SIDE = 1400;
const CREAM = '#fbf6ec';

function triggerDownload(blob: Blob, fileName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fileName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2_000);
}

function waitForImages(root: HTMLElement): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  if (imgs.length === 0) return Promise.resolve();
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }),
    ),
  ).then(() => undefined);
}

function encaixarLado(width: number, height: number, maxSide: number): { w: number; h: number } {
  const maior = Math.max(width, height);
  if (maior <= maxSide) return { w: width, h: height };
  const fator = maxSide / maior;
  return { w: Math.max(1, Math.round(width * fator)), h: Math.max(1, Math.round(height * fator)) };
}

/**
 * Embute URL remota em JPEG (lado máx. 1400 px) para o PDF não sair sem foto (CORS).
 */
export async function incorporarImagemOrcamento(
  src: string,
  maxSide = EMBED_MAX_SIDE,
): Promise<string> {
  const url = src.trim();
  if (!url) return '';

  try {
    let blob: Blob;
    if (url.startsWith('data:')) {
      const res = await fetch(url);
      blob = await res.blob();
    } else {
      const res = await fetch(url, { mode: 'cors', credentials: 'omit', cache: 'no-cache' });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      blob = await res.blob();
    }

    const bitmap = await createImageBitmap(blob);
    const { w, h } = encaixarLado(bitmap.width, bitmap.height, maxSide);
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      bitmap.close();
      return url;
    }
    ctx.fillStyle = CREAM;
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.86);
  } catch {
    return url;
  }
}

function listarPaginasFolha(root: HTMLElement): HTMLElement[] {
  if (root.matches('[data-markup-orcamento-folha]')) {
    return [root];
  }
  const paginas = Array.from(root.querySelectorAll<HTMLElement>('[data-markup-orcamento-folha]'));
  return paginas.length > 0 ? paginas : [root];
}

function montarIframeCaptura(alturaPx: number): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = [
    'position:fixed',
    `left:-${MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX + 40}px`,
    'top:0',
    `width:${MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX}px`,
    `height:${Math.max(alturaPx, MARKUP_ORCAMENTO_SIMPLES_ALTURA_PX)}px`,
    'border:none',
    'opacity:0',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(iframe);
  return iframe;
}

async function capturarPaginaCanvas(paginaEl: HTMLElement): Promise<HTMLCanvasElement> {
  const iframe = montarIframeCaptura(MARKUP_ORCAMENTO_SIMPLES_ALTURA_PX);
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    throw new Error('Não foi possível preparar a folha para exportar.');
  }

  doc.open();
  doc.write(`<!doctype html><html><head></head><body style="margin:0;background:${CREAM};"></body></html>`);
  doc.close();

  const clone = paginaEl.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none';
  clone.style.width = `${MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX}px`;
  clone.style.height = `${MARKUP_ORCAMENTO_SIMPLES_ALTURA_PX}px`;
  clone.style.margin = '0';
  clone.style.opacity = '1';
  clone.style.position = 'static';
  clone.style.overflow = 'hidden';
  doc.body.appendChild(clone);

  try {
    await waitForImages(clone);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const width = MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX;
    const height = MARKUP_ORCAMENTO_SIMPLES_ALTURA_PX;

    return await html2canvas(clone, {
      scale: EXPORT_SCALE,
      useCORS: true,
      allowTaint: false,
      backgroundColor: CREAM,
      logging: false,
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scrollX: 0,
      scrollY: 0,
      imageTimeout: 15_000,
    });
  } finally {
    iframe.remove();
  }
}

function adicionarPaginaA4(pdf: jsPDF, canvas: HTMLCanvasElement, primeira: boolean): void {
  if (!primeira) pdf.addPage();
  // Página já nasceu em proporção A4 — preenche a folha inteira, sem esticar.
  pdf.addImage(canvas.toDataURL('image/jpeg', JPEG_QUALITY), 'JPEG', 0, 0, A4_W_MM, A4_H_MM);
}

export async function exportarOrcamentoSimplesPdf(
  folhaRoot: HTMLElement,
  titulo: string,
): Promise<void> {
  const paginas = listarPaginasFolha(folhaRoot);
  if (paginas.length === 0) {
    throw new Error('A folha saiu em branco. Tente de novo.');
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  for (let i = 0; i < paginas.length; i += 1) {
    const canvas = await capturarPaginaCanvas(paginas[i]!);
    if (canvas.width < 2 || canvas.height < 2) {
      throw new Error('A folha saiu em branco. Tente de novo.');
    }
    adicionarPaginaA4(pdf, canvas, i === 0);
  }

  pdf.save(nomeArquivoOrcamentoSimples(titulo, 'pdf'));
}

export async function exportarOrcamentoSimplesJpg(
  folhaRoot: HTMLElement,
  titulo: string,
): Promise<void> {
  const paginas = listarPaginasFolha(folhaRoot);
  if (paginas.length === 0) {
    throw new Error('A folha saiu em branco. Tente de novo.');
  }

  const canvases: HTMLCanvasElement[] = [];
  for (const pagina of paginas) {
    const canvas = await capturarPaginaCanvas(pagina);
    if (canvas.width < 2 || canvas.height < 2) {
      throw new Error('A folha saiu em branco. Tente de novo.');
    }
    canvases.push(canvas);
  }

  const gap = Math.round(16 * EXPORT_SCALE);
  const width = canvases[0]!.width;
  const height =
    canvases.reduce((acc, c) => acc + c.height, 0) + gap * Math.max(0, canvases.length - 1);
  const stacked = document.createElement('canvas');
  stacked.width = width;
  stacked.height = height;
  const ctx = stacked.getContext('2d');
  if (!ctx) throw new Error('Falha ao gerar JPG');
  ctx.fillStyle = '#140e0b';
  ctx.fillRect(0, 0, width, height);

  let y = 0;
  for (const canvas of canvases) {
    ctx.drawImage(canvas, 0, y);
    y += canvas.height + gap;
  }

  const blob = await new Promise<Blob>((resolve, reject) => {
    stacked.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falha ao gerar JPG'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
  triggerDownload(blob, nomeArquivoOrcamentoSimples(titulo, 'jpg'));
}
