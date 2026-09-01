import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import { GARBO_LOGO_SRC } from '@/lib/garbo-brand';

export interface LoadedPrintImage {
  dataUrl: string;
  width: number;
  height: number;
  format: 'JPEG' | 'PNG';
}

export interface LeadAIRenderExportOpts {
  sketchUrl: string | null;
  sketchLabel?: string;
  outputUrl: string | null;
  logoUrl?: string | null;
  nomeEmpresa?: string | null;
  cnpj?: string | null;
  leadName?: string | null;
  leadId?: number | null;
}

const PAPER = '#f4ead6';
const INK = '#2a1812';
const GOLD = '#9a7b3c';
const MUTED = '#6b5344';
const RULE = '#c4a574';

function triggerBlobDownload(blob: Blob, downloadName: string): void {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = downloadName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(objectUrl);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Erro ao ler imagem'));
    reader.readAsDataURL(blob);
  });
}

function loadHtmlImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    if (!url.startsWith('data:') && !url.startsWith('blob:')) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Não foi possível carregar a imagem.'));
    img.src = url;
  });
}

async function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((result) => resolve(result), type, quality);
  });
  if (!blob) throw new Error('Não foi possível gerar o arquivo.');
  return blob;
}

function fitImageInBox(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
): { width: number; height: number; x: number; y: number } {
  const ratio = Math.min(boxW / imgW, boxH / imgH);
  const width = imgW * ratio;
  const height = imgH * ratio;
  return {
    width,
    height,
    x: (boxW - width) / 2,
    y: (boxH - height) / 2,
  };
}

export function slugifyLeadExportName(leadName?: string | null): string {
  return (
    leadName
      ?.trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40)
      .toLowerCase() || 'projeto'
  );
}

export function buildLeadAIRenderExportBaseName(opts: Pick<LeadAIRenderExportOpts, 'leadName' | 'leadId'>): string {
  const datePart = format(new Date(), 'yyyy-MM-dd');
  const slug = slugifyLeadExportName(opts.leadName);
  if (opts.leadId) return `garbo-${slug}-${opts.leadId}-${datePart}`;
  return `garbo-${slug}-${datePart}`;
}

export async function fetchImageForPrint(url: string): Promise<LoadedPrintImage> {
  if (url.startsWith('data:')) {
    const img = await loadHtmlImage(url);
    const format: LoadedPrintImage['format'] = url.startsWith('data:image/png') ? 'PNG' : 'JPEG';
    return { dataUrl: url, width: img.naturalWidth, height: img.naturalHeight, format };
  }

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error('fetch');
    const blob = await response.blob();
    const dataUrl = await blobToDataUrl(blob);
    const img = await loadHtmlImage(dataUrl);
    const format: LoadedPrintImage['format'] = blob.type.includes('png') ? 'PNG' : 'JPEG';
    return { dataUrl, width: img.naturalWidth, height: img.naturalHeight, format };
  } catch {
    const img = await loadHtmlImage(url);
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas indisponível');
    ctx.drawImage(img, 0, 0);
    const dataUrl = canvas.toDataURL('image/png');
    return { dataUrl, width: img.naturalWidth, height: img.naturalHeight, format: 'PNG' };
  }
}

async function toJpegDataUrl(image: LoadedPrintImage, quality = 0.92): Promise<LoadedPrintImage> {
  if (image.format === 'JPEG' && !image.dataUrl.startsWith('data:image/png')) {
    return image;
  }
  const img = await loadHtmlImage(image.dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  return {
    dataUrl: canvas.toDataURL('image/jpeg', quality),
    width: img.naturalWidth,
    height: img.naturalHeight,
    format: 'JPEG',
  };
}

async function imageToPngBlob(image: LoadedPrintImage): Promise<Blob> {
  const img = await loadHtmlImage(image.dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível');
  ctx.drawImage(img, 0, 0);
  return canvasToBlob(canvas, 'image/png');
}

export async function loadLeadAIRenderExportAssets(opts: LeadAIRenderExportOpts): Promise<{
  sketch: LoadedPrintImage | null;
  output: LoadedPrintImage | null;
  logo: LoadedPrintImage | null;
}> {
  const logoSrc = opts.logoUrl?.trim() || GARBO_LOGO_SRC;
  const [sketch, output, logo] = await Promise.all([
    opts.sketchUrl ? fetchImageForPrint(opts.sketchUrl).catch(() => null) : Promise.resolve(null),
    opts.outputUrl && opts.outputUrl !== opts.sketchUrl
      ? fetchImageForPrint(opts.outputUrl).catch(() => null)
      : Promise.resolve(null),
    fetchImageForPrint(logoSrc).catch(() => null),
  ]);
  return { sketch, output, logo };
}

export async function downloadLeadAIRenderPng(
  outputUrl: string,
  fileName = `render-projeto-${Date.now()}.png`,
): Promise<void> {
  const image = await fetchImageForPrint(outputUrl);
  const blob = await imageToPngBlob(image);
  const safe = /\.png$/i.test(fileName) ? fileName : `${fileName}.png`;
  triggerBlobDownload(blob, safe);
}

export async function downloadLeadAIRenderPairPngs(opts: LeadAIRenderExportOpts): Promise<void> {
  const base = buildLeadAIRenderExportBaseName(opts);
  const { sketch, output } = await loadLeadAIRenderExportAssets(opts);
  if (!sketch && !output) {
    throw new Error('Nenhuma imagem disponível para exportar.');
  }
  if (sketch) {
    triggerBlobDownload(await imageToPngBlob(sketch), `${base}-antes.png`);
  }
  if (output) {
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    triggerBlobDownload(await imageToPngBlob(output), `${base}-depois.png`);
  }
}

function paintPrintBoard(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  input: {
    sketch: LoadedPrintImage | null;
    output: LoadedPrintImage | null;
    logo: LoadedPrintImage | null;
    sketchImg: HTMLImageElement | null;
    outputImg: HTMLImageElement | null;
    logoImg: HTMLImageElement | null;
    nomeEmpresa: string;
    cnpj?: string | null;
    leadName?: string | null;
    sketchLabel: string;
    dataGeracao: string;
  },
): void {
  const margin = Math.round(width * 0.038);
  ctx.fillStyle = PAPER;
  ctx.fillRect(0, 0, width, height);

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(2, width * 0.0024);
  ctx.strokeRect(margin * 0.45, margin * 0.45, width - margin * 0.9, height - margin * 0.9);

  ctx.strokeStyle = RULE;
  ctx.lineWidth = Math.max(1, width * 0.0008);
  ctx.strokeRect(margin * 0.62, margin * 0.62, width - margin * 1.24, height - margin * 1.24);

  let headerBottom = margin;
  if (input.logoImg) {
    const logoH = Math.round(height * 0.07);
    const logoW = Math.min(
      width * 0.18,
      (input.logoImg.naturalWidth / input.logoImg.naturalHeight) * logoH,
    );
    ctx.drawImage(input.logoImg, margin, margin, logoW, logoH);
    headerBottom = margin + logoH;
  }

  ctx.fillStyle = INK;
  ctx.font = `600 ${Math.round(width * 0.018)}px "Palatino Linotype", Palatino, Georgia, serif`;
  ctx.textBaseline = 'top';
  ctx.fillText(input.nomeEmpresa || 'Garbo Movelaria', margin + width * 0.2, margin + 4);

  ctx.fillStyle = GOLD;
  ctx.font = `500 ${Math.round(width * 0.011)}px "Palatino Linotype", Palatino, Georgia, serif`;
  ctx.fillText('PRANCHA DE APRESENTAÇÃO  ·  ANTES E DEPOIS', margin + width * 0.2, margin + height * 0.032);

  ctx.fillStyle = MUTED;
  ctx.font = `${Math.round(width * 0.009)}px Georgia, serif`;
  const rightMeta = [input.leadName?.trim(), input.dataGeracao].filter(Boolean).join('  ·  ');
  ctx.textAlign = 'right';
  ctx.fillText(rightMeta, width - margin, margin + 8);
  ctx.textAlign = 'left';

  const ruleY = Math.max(headerBottom, margin + height * 0.078) + height * 0.018;
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(1.5, width * 0.0015);
  ctx.beginPath();
  ctx.moveTo(margin, ruleY);
  ctx.lineTo(width - margin, ruleY);
  ctx.stroke();

  const footerTop = height - margin - height * 0.055;
  const gap = width * 0.028;
  const cols = input.sketch && input.output ? 2 : 1;
  const colW = (width - margin * 2 - (cols - 1) * gap) / cols;
  const labelH = height * 0.046;
  const frameTop = ruleY + height * 0.028;
  const frameH = footerTop - frameTop - labelH - height * 0.012;

  const drawCol = (
    x: number,
    badge: string,
    label: string,
    image: LoadedPrintImage | null,
    htmlImg: HTMLImageElement | null,
  ) => {
    ctx.fillStyle = GOLD;
    ctx.font = `600 ${Math.round(width * 0.01)}px "Palatino Linotype", Palatino, Georgia, serif`;
    ctx.fillText(badge, x, frameTop);
    ctx.fillStyle = MUTED;
    ctx.font = `${Math.round(width * 0.0085)}px Georgia, serif`;
    ctx.fillText(label, x, frameTop + height * 0.018);

    const boxY = frameTop + labelH;
    ctx.fillStyle = '#efe4cc';
    ctx.fillRect(x, boxY, colW, frameH);
    ctx.strokeStyle = RULE;
    ctx.lineWidth = Math.max(1, width * 0.001);
    ctx.strokeRect(x, boxY, colW, frameH);

    if (image && htmlImg) {
      const inner = width * 0.01;
      const fitted = fitImageInBox(image.width, image.height, colW - inner * 2, frameH - inner * 2);
      ctx.drawImage(htmlImg, x + inner + fitted.x, boxY + inner + fitted.y, fitted.width, fitted.height);
    }
  };

  if (input.sketch && input.output) {
    drawCol(margin, 'ANTES', input.sketchLabel, input.sketch, input.sketchImg);
    drawCol(margin + colW + gap, 'DEPOIS', 'Render fotorrealista', input.output, input.outputImg);
  } else {
    const only = input.output ?? input.sketch;
    const onlyImg = input.outputImg ?? input.sketchImg;
    drawCol(
      margin,
      input.output ? 'DEPOIS' : 'ANTES',
      input.output ? 'Render fotorrealista' : input.sketchLabel,
      only,
      onlyImg,
    );
  }

  ctx.strokeStyle = GOLD;
  ctx.lineWidth = Math.max(1, width * 0.001);
  ctx.beginPath();
  ctx.moveTo(margin, footerTop);
  ctx.lineTo(width - margin, footerTop);
  ctx.stroke();

  ctx.fillStyle = MUTED;
  ctx.font = `${Math.round(width * 0.008)}px Georgia, serif`;
  ctx.textBaseline = 'middle';
  const cnpj = input.cnpj?.trim() ? `CNPJ ${input.cnpj.trim()}` : '';
  ctx.fillText(
    [input.nomeEmpresa || 'Garbo Movelaria', cnpj, 'Documento para apresentação ao cliente']
      .filter(Boolean)
      .join('  ·  '),
    margin,
    footerTop + (height - margin - footerTop) / 2,
  );
  ctx.textAlign = 'right';
  ctx.fillText('Impressão ateliê', width - margin, footerTop + (height - margin - footerTop) / 2);
  ctx.textAlign = 'left';
}

async function decodePrintImages(assets: {
  sketch: LoadedPrintImage | null;
  output: LoadedPrintImage | null;
  logo: LoadedPrintImage | null;
}) {
  const [sketchImg, outputImg, logoImg] = await Promise.all([
    assets.sketch ? loadHtmlImage(assets.sketch.dataUrl) : Promise.resolve(null),
    assets.output ? loadHtmlImage(assets.output.dataUrl) : Promise.resolve(null),
    assets.logo ? loadHtmlImage(assets.logo.dataUrl) : Promise.resolve(null),
  ]);
  return { sketchImg, outputImg, logoImg };
}

export async function exportLeadAIRenderComparisonPng(opts: LeadAIRenderExportOpts): Promise<void> {
  const assets = await loadLeadAIRenderExportAssets(opts);
  if (!assets.sketch && !assets.output) {
    throw new Error('Nenhuma imagem disponível para exportar.');
  }
  const decoded = await decodePrintImages(assets);
  const width = 2480;
  const height = 1754;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas indisponível');

  paintPrintBoard(ctx, width, height, {
    ...assets,
    ...decoded,
    nomeEmpresa: opts.nomeEmpresa?.trim() || 'Garbo Movelaria',
    cnpj: opts.cnpj,
    leadName: opts.leadName,
    sketchLabel: opts.sketchLabel || 'Composição de ambiente',
    dataGeracao: format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }),
  });

  const blob = await canvasToBlob(canvas, 'image/png');
  triggerBlobDownload(blob, `${buildLeadAIRenderExportBaseName(opts)}-prancha.png`);
}

export async function exportLeadAIRenderPdf(opts: LeadAIRenderExportOpts): Promise<void> {
  const assets = await loadLeadAIRenderExportAssets(opts);
  const sketch = assets.sketch ? await toJpegDataUrl(assets.sketch) : null;
  const output = assets.output ? await toJpegDataUrl(assets.output) : null;
  const logo = assets.logo ? await toJpegDataUrl(assets.logo) : null;

  if (!sketch && !output) {
    throw new Error('Nenhuma imagem disponível para exportar.');
  }

  const twoCols = Boolean(sketch && output);
  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 11;
  const nomeDisplay = opts.nomeEmpresa?.trim() || 'Garbo Movelaria';
  const dataGeracao = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const sketchLabel = opts.sketchLabel || 'Composição de ambiente';

  doc.setFillColor(244, 234, 214);
  doc.rect(0, 0, pageW, pageH, 'F');
  doc.setDrawColor(154, 123, 60);
  doc.setLineWidth(0.45);
  doc.rect(5.5, 5.5, pageW - 11, pageH - 11);
  doc.setDrawColor(196, 165, 116);
  doc.setLineWidth(0.18);
  doc.rect(7.2, 7.2, pageW - 14.4, pageH - 14.4);

  let headerBottom = margin;
  if (logo) {
    const logoBox = fitImageInBox(logo.width, logo.height, 28, 12);
    doc.addImage(logo.dataUrl, 'JPEG', margin, margin, logoBox.width, logoBox.height);
    headerBottom = margin + logoBox.height;
  }

  doc.setFont('times', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(42, 24, 18);
  doc.text(nomeDisplay, margin + 32, margin + 6);
  doc.setFont('times', 'italic');
  doc.setFontSize(8);
  doc.setTextColor(154, 123, 60);
  doc.text('PRANCHA DE APRESENTAÇÃO  ·  ANTES E DEPOIS', margin + 32, margin + 11);

  doc.setFont('times', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(107, 83, 68);
  const rightMeta = [opts.leadName?.trim(), dataGeracao].filter(Boolean).join('  ·  ');
  doc.text(rightMeta, pageW - margin, margin + 7, { align: 'right' });

  const ruleY = Math.max(headerBottom, margin + 12) + 4;
  doc.setDrawColor(154, 123, 60);
  doc.setLineWidth(0.35);
  doc.line(margin, ruleY, pageW - margin, ruleY);

  const footerTop = pageH - margin - 8;
  const gap = 7;
  const cols = twoCols ? 2 : 1;
  const colW = (pageW - margin * 2 - (cols - 1) * gap) / cols;
  const labelH = 9;
  const frameTop = ruleY + 6;
  const frameH = footerTop - frameTop - labelH - 3;

  const drawCol = (x: number, badge: string, label: string, image: LoadedPrintImage) => {
    doc.setFont('times', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(154, 123, 60);
    doc.text(badge, x, frameTop + 3);
    doc.setFont('times', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(107, 83, 68);
    doc.text(label, x, frameTop + 7.5);

    const boxY = frameTop + labelH;
    doc.setFillColor(239, 228, 204);
    doc.rect(x, boxY, colW, frameH, 'F');
    doc.setDrawColor(196, 165, 116);
    doc.setLineWidth(0.2);
    doc.rect(x, boxY, colW, frameH);

    const inner = 2.2;
    const fitted = fitImageInBox(image.width, image.height, colW - inner * 2, frameH - inner * 2);
    doc.addImage(
      image.dataUrl,
      'JPEG',
      x + inner + fitted.x,
      boxY + inner + fitted.y,
      fitted.width,
      fitted.height,
    );
  };

  if (twoCols && sketch && output) {
    drawCol(margin, 'ANTES', sketchLabel, sketch);
    drawCol(margin + colW + gap, 'DEPOIS', 'Render fotorrealista', output);
  } else {
    const only = output ?? sketch;
    if (only) {
      drawCol(
        margin,
        output ? 'DEPOIS' : 'ANTES',
        output ? 'Render fotorrealista' : sketchLabel,
        only,
      );
    }
  }

  doc.setDrawColor(154, 123, 60);
  doc.setLineWidth(0.25);
  doc.line(margin, footerTop, pageW - margin, footerTop);
  doc.setFont('times', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(107, 83, 68);
  const cnpj = opts.cnpj?.trim() ? `CNPJ ${opts.cnpj.trim()}` : '';
  doc.text(
    [nomeDisplay, cnpj, 'Documento para apresentação ao cliente'].filter(Boolean).join('  ·  '),
    margin,
    pageH - margin - 2,
  );
  doc.text('Impressão ateliê', pageW - margin, pageH - margin - 2, { align: 'right' });

  const blob = doc.output('blob');
  triggerBlobDownload(blob, `${buildLeadAIRenderExportBaseName(opts)}-prancha.pdf`);
}

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export async function openLeadAIRenderPrintPage(opts: LeadAIRenderExportOpts): Promise<void> {
  const assets = await loadLeadAIRenderExportAssets(opts);
  if (!assets.sketch && !assets.output) {
    throw new Error('Nenhuma imagem disponível para imprimir.');
  }

  const nomeDisplay = opts.nomeEmpresa?.trim() || 'Garbo Movelaria';
  const dataGeracao = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
  const sketchLabel = opts.sketchLabel || 'Composição de ambiente';
  const twoCols = Boolean(assets.sketch && assets.output);
  const titulo = opts.leadName?.trim()
    ? `Prancha Garbo — ${opts.leadName.trim()}`
    : 'Prancha Garbo — Antes e depois';

  const col = (badge: string, label: string, src: string) => `
    <article class="col">
      <p class="badge">${esc(badge)}</p>
      <p class="label">${esc(label)}</p>
      <div class="frame"><img src="${src}" alt="${esc(label)}" /></div>
    </article>
  `;

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${esc(titulo)}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    @page { size: A4 landscape; margin: 0; }
    html, body { background: #f4ead6; color: #2a1812; }
    body {
      font-family: "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif;
      min-height: 100vh;
    }
    .pagina {
      width: 297mm;
      height: 210mm;
      padding: 12mm 14mm 11mm;
      position: relative;
    }
    .pagina:before {
      content: "";
      position: absolute;
      inset: 6mm;
      border: 0.45mm solid #9a7b3c;
      pointer-events: none;
    }
    .topo { display: flex; align-items: flex-start; justify-content: space-between; gap: 12mm; }
    .marca { display: flex; gap: 8mm; align-items: center; }
    .marca img { height: 14mm; width: auto; object-fit: contain; }
    .marca h1 { font-size: 15pt; font-weight: 600; letter-spacing: 0.04em; }
    .marca p { margin-top: 1.5mm; font-size: 8pt; color: #9a7b3c; letter-spacing: 0.18em; }
    .meta { text-align: right; font-size: 8.5pt; color: #6b5344; line-height: 1.45; }
    .filete { height: 0; border-top: 0.35mm solid #9a7b3c; margin: 5mm 0 6mm; }
    .grade { display: grid; grid-template-columns: ${twoCols ? '1fr 1fr' : '1fr'}; gap: 7mm; }
    .badge { font-size: 8pt; letter-spacing: 0.22em; color: #9a7b3c; font-weight: 700; }
    .label { font-size: 8pt; color: #6b5344; margin: 1mm 0 2.5mm; }
    .frame {
      height: 128mm;
      background: #efe4cc;
      border: 0.25mm solid #c4a574;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
    }
    .frame img { max-width: 100%; max-height: 100%; object-fit: contain; }
    .rodape {
      position: absolute;
      left: 14mm; right: 14mm; bottom: 9mm;
      display: flex; justify-content: space-between;
      border-top: 0.25mm solid #9a7b3c;
      padding-top: 3mm;
      font-size: 8pt;
      color: #6b5344;
    }
    @media print {
      html, body { width: 297mm; height: 210mm; }
    }
  </style>
</head>
<body>
  <div class="pagina">
    <header class="topo">
      <div class="marca">
        ${assets.logo ? `<img src="${assets.logo.dataUrl}" alt="${esc(nomeDisplay)}" />` : ''}
        <div>
          <h1>${esc(nomeDisplay)}</h1>
          <p>PRANCHA DE APRESENTAÇÃO  ·  ANTES E DEPOIS</p>
        </div>
      </div>
      <div class="meta">
        ${opts.leadName?.trim() ? `<p>${esc(opts.leadName.trim())}</p>` : ''}
        <p>${esc(dataGeracao)}</p>
      </div>
    </header>
    <div class="filete"></div>
    <section class="grade">
      ${assets.sketch ? col('ANTES', sketchLabel, assets.sketch.dataUrl) : ''}
      ${assets.output ? col('DEPOIS', 'Render fotorrealista', assets.output.dataUrl) : ''}
    </section>
    <footer class="rodape">
      <span>${esc([nomeDisplay, opts.cnpj?.trim() ? `CNPJ ${opts.cnpj.trim()}` : '', 'Documento para apresentação ao cliente'].filter(Boolean).join('  ·  '))}</span>
      <span>Impressão ateliê</span>
    </footer>
  </div>
  <script>
    function waitForImages() {
      var imgs = Array.prototype.slice.call(document.images);
      if (imgs.length === 0) return Promise.resolve();
      return Promise.all(imgs.map(function(img) {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();
        return new Promise(function(resolve) {
          img.onload = resolve;
          img.onerror = resolve;
        });
      }));
    }
    window.onload = function() {
      waitForImages().then(function() {
        requestAnimationFrame(function() {
          window.focus();
          window.print();
        });
      });
    };
  </script>
</body>
</html>`;

  const popup = window.open('', '_blank', 'noopener,noreferrer,width=1200,height=850');
  if (!popup) {
    throw new Error('O navegador bloqueou a janela de impressão. Autorize pop-ups para este site.');
  }
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}
