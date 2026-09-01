/**
 * Exporta a folha comercial em PDF/JPG.
 * Captura fora do diálogo (ancestrais com transform quebram o html2canvas).
 */

import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import {
  MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX,
  nomeArquivoOrcamentoSimples,
} from '@/lib/markup-orcamento-simples';

const EXPORT_SCALE = 2.4;
const A4_W_MM = 210;
const A4_H_MM = 297;
const JPEG_QUALITY = 0.92;
const EMBED_MAX_SIDE = 1400;

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
    ctx.fillStyle = '#fbf6ec';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();
    return canvas.toDataURL('image/jpeg', 0.86);
  } catch {
    return url;
  }
}

function montarIframeCaptura(): HTMLIFrameElement {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('aria-hidden', 'true');
  iframe.style.cssText = [
    'position:fixed',
    `left:-${MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX + 40}px`,
    'top:0',
    `width:${MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX}px`,
    'height:1600px',
    'border:none',
    'opacity:0',
    'pointer-events:none',
  ].join(';');
  document.body.appendChild(iframe);
  return iframe;
}

async function capturarFolhaCanvas(folhaEl: HTMLElement): Promise<HTMLCanvasElement> {
  const iframe = montarIframeCaptura();
  const doc = iframe.contentDocument ?? iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    throw new Error('Não foi possível preparar a folha para exportar.');
  }

  doc.open();
  doc.write('<!doctype html><html><head></head><body style="margin:0;background:#fbf6ec;"></body></html>');
  doc.close();

  const clone = folhaEl.cloneNode(true) as HTMLElement;
  clone.style.transform = 'none';
  clone.style.width = `${MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX}px`;
  clone.style.margin = '0';
  clone.style.opacity = '1';
  clone.style.position = 'static';
  doc.body.appendChild(clone);

  try {
    await waitForImages(clone);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));

    const width = MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX;
    const height = Math.max(clone.scrollHeight, clone.offsetHeight, 1);

    iframe.style.height = `${height}px`;

    return await html2canvas(clone, {
      scale: EXPORT_SCALE,
      useCORS: true,
      allowTaint: false,
      backgroundColor: '#fbf6ec',
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

function fatiarPdf(canvas: HTMLCanvasElement, fileName: string): void {
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = A4_W_MM;
  const pageH = A4_H_MM;
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;

  if (imgH <= pageH + 0.4) {
    pdf.addImage(canvas.toDataURL('image/jpeg', JPEG_QUALITY), 'JPEG', 0, 0, imgW, imgH);
    pdf.save(fileName);
    return;
  }

  const pageHeightPx = Math.round((pageH / pageW) * canvas.width);
  let y = 0;
  let primeira = true;

  while (y < canvas.height) {
    const sliceH = Math.min(pageHeightPx, canvas.height - y);
    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = sliceH;
    const ctx = slice.getContext('2d');
    if (!ctx) break;
    ctx.fillStyle = '#fbf6ec';
    ctx.fillRect(0, 0, slice.width, slice.height);
    ctx.drawImage(canvas, 0, y, canvas.width, sliceH, 0, 0, canvas.width, sliceH);

    const sliceImgH = (sliceH * imgW) / canvas.width;
    if (!primeira) pdf.addPage();
    pdf.addImage(slice.toDataURL('image/jpeg', JPEG_QUALITY), 'JPEG', 0, 0, imgW, sliceImgH);
    primeira = false;
    y += sliceH;
  }

  pdf.save(fileName);
}

export async function exportarOrcamentoSimplesPdf(
  folhaEl: HTMLElement,
  titulo: string,
): Promise<void> {
  const canvas = await capturarFolhaCanvas(folhaEl);
  if (canvas.width < 2 || canvas.height < 2) {
    throw new Error('A folha saiu em branco. Tente de novo.');
  }
  fatiarPdf(canvas, nomeArquivoOrcamentoSimples(titulo, 'pdf'));
}

export async function exportarOrcamentoSimplesJpg(
  folhaEl: HTMLElement,
  titulo: string,
): Promise<void> {
  const canvas = await capturarFolhaCanvas(folhaEl);
  if (canvas.width < 2 || canvas.height < 2) {
    throw new Error('A folha saiu em branco. Tente de novo.');
  }
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('Falha ao gerar JPG'))),
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
  triggerDownload(blob, nomeArquivoOrcamentoSimples(titulo, 'jpg'));
}
