import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { jsPDF } from 'jspdf';
import { downloadImageFromUrl } from '@/lib/download-file';

interface LoadedImage {
  dataUrl: string;
  width: number;
  height: number;
  format: 'JPEG' | 'PNG';
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

function convertDataUrlToJpeg(dataUrl: string, quality = 0.92): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas indisponível'));
        return;
      }
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Erro ao converter imagem'));
    img.src = dataUrl;
  });
}

async function fetchImageForPdf(url: string): Promise<LoadedImage> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Não foi possível carregar a imagem para o PDF.');
  }
  const blob = await response.blob();
  let dataUrl = await blobToDataUrl(blob);
  let format: LoadedImage['format'] = blob.type.includes('png') ? 'PNG' : 'JPEG';

  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Erro ao decodificar imagem'));
    img.src = dataUrl;
  });

  if (blob.type.includes('webp')) {
    dataUrl = await convertDataUrlToJpeg(dataUrl);
    format = 'JPEG';
  }

  return { dataUrl, ...dimensions, format };
}

function fitImageInBox(
  imgW: number,
  imgH: number,
  boxW: number,
  boxH: number,
): { width: number; height: number } {
  const ratio = Math.min(boxW / imgW, boxH / imgH);
  return { width: imgW * ratio, height: imgH * ratio };
}

export interface LeadAIRenderExportOpts {
  sketchUrl: string | null;
  sketchLabel?: string;
  outputUrl: string | null;
  logoUrl?: string | null;
  nomeEmpresa?: string | null;
  cnpj?: string | null;
}

export async function downloadLeadAIRenderPng(
  outputUrl: string,
  fileName = `render-projeto-${Date.now()}.png`,
): Promise<void> {
  await downloadImageFromUrl(outputUrl, fileName);
}

export async function exportLeadAIRenderPdf(opts: LeadAIRenderExportOpts): Promise<void> {
  const {
    sketchUrl,
    sketchLabel = 'Esboço',
    outputUrl,
    logoUrl,
    nomeEmpresa,
    cnpj,
  } = opts;

  if (!sketchUrl && !outputUrl) {
    throw new Error('Nenhuma imagem disponível para exportar.');
  }

  const [sketch, output, logo] = await Promise.all([
    sketchUrl ? fetchImageForPdf(sketchUrl) : Promise.resolve(null),
    outputUrl && outputUrl !== sketchUrl ? fetchImageForPdf(outputUrl) : Promise.resolve(null),
    logoUrl?.trim()
      ? fetchImageForPdf(logoUrl.trim()).catch(() => null)
      : Promise.resolve(null),
  ]);

  const single = output ?? sketch;
  if (!single) {
    throw new Error('Nenhuma imagem disponível para exportar.');
  }

  const twoCols = Boolean(sketch && output);
  const doc = new jsPDF({
    orientation: twoCols ? 'landscape' : 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const nomeDisplay = nomeEmpresa?.trim() || '';
  const dataGeracao = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });

  let cursorY = margin;
  if (logo) {
    const logoBox = fitImageInBox(logo.width, logo.height, 32, 14);
    doc.addImage(logo.dataUrl, logo.format, margin, cursorY, logoBox.width, logoBox.height);
  }
  if (nomeDisplay) {
    doc.setFontSize(14);
    doc.setTextColor(42, 24, 18);
    doc.text(nomeDisplay, logo ? margin + 36 : margin, cursorY + 8);
  }
  if (cnpj?.trim()) {
    doc.setFontSize(9);
    doc.setTextColor(102, 102, 102);
    doc.text(`CNPJ: ${cnpj.trim()}`, logo ? margin + 36 : margin, cursorY + 14);
  }

  cursorY += 18;
  doc.setDrawColor(201, 160, 123);
  doc.setLineWidth(0.4);
  doc.line(margin, cursorY, pageW - margin, cursorY);

  doc.setFontSize(12);
  doc.setTextColor(42, 24, 18);
  doc.text(
    twoCols ? 'Comparação Visual — Renderização IA' : 'Renderização IA',
    margin,
    cursorY + 8,
  );
  doc.setFontSize(9);
  doc.setTextColor(102, 102, 102);
  doc.text(`${sketchLabel} · Gerado em ${dataGeracao}`, margin, cursorY + 14);

  const contentTop = cursorY + 20;
  const footerTop = pageH - margin - 8;
  const contentH = footerTop - contentTop - 8;
  const gap = 8;

  const drawLabeledImage = (
    image: LoadedImage,
    x: number,
    boxW: number,
    badge: string,
    label: string,
  ) => {
    doc.setFontSize(8);
    doc.setTextColor(139, 105, 20);
    doc.text(badge.toUpperCase(), x, contentTop);
    doc.setFontSize(9);
    doc.setTextColor(68, 68, 68);
    doc.text(label, x, contentTop + 6);
    const fitted = fitImageInBox(image.width, image.height, boxW, contentH - 10);
    const imgY = contentTop + 10 + (contentH - 10 - fitted.height) / 2;
    doc.addImage(image.dataUrl, image.format, x, imgY, fitted.width, fitted.height);
  };

  if (twoCols && sketch && output) {
    const colW = (pageW - margin * 2 - gap) / 2;
    drawLabeledImage(sketch, margin, colW, 'Antes', sketchLabel);
    drawLabeledImage(output, margin + colW + gap, colW, 'Depois', 'Render fotorrealista');
  } else {
    const contentW = pageW - margin * 2;
    const fitted = fitImageInBox(single.width, single.height, contentW, contentH);
    const imgX = margin + (contentW - fitted.width) / 2;
    const imgY = contentTop + (contentH - fitted.height) / 2;
    doc.addImage(single.dataUrl, single.format, imgX, imgY, fitted.width, fitted.height);
  }

  doc.setFontSize(8);
  doc.setTextColor(136, 136, 136);
  const rodape = `${nomeDisplay ? `${nomeDisplay} · ` : ''}Documento gerado pelo CRM Selletos`;
  doc.text(rodape, pageW / 2, pageH - margin, { align: 'center' });

  const blob = doc.output('blob');
  triggerBlobDownload(blob, `render-projeto-${Date.now()}.pdf`);
}
