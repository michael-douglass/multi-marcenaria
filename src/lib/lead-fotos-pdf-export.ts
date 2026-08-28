import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function esc(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

const FOTOS_PDF_CSS = `
  * { box-sizing: border-box; margin: 0; padding: 0; }

  @page {
    size: A4 portrait;
    margin: 12mm;
  }

  html, body {
    width: 100%;
    margin: 0;
    padding: 0;
    background: #fff;
  }

  body {
    font-family: 'Segoe UI', system-ui, sans-serif;
    font-size: 11pt;
    color: #1a1a1a;
  }

  /* Exatamente uma página A4 por seção — evita quebra interna e páginas em branco */
  .pagina {
    width: 186mm;
    height: 273mm;
    max-height: 273mm;
    margin: 0 auto;
    padding: 0;
    overflow: hidden;
    page-break-after: always;
    break-after: page;
    page-break-inside: avoid;
    break-inside: avoid;
    display: flex;
    flex-direction: column;
  }

  .pagina:last-child {
    page-break-after: auto;
    break-after: auto;
  }

  .cabecalho {
    display: flex;
    align-items: center;
    gap: 16px;
    padding-bottom: 10px;
    margin-bottom: 8px;
    border-bottom: 2px solid #c9a07b;
    flex-shrink: 0;
  }

  .logo {
    max-height: 48px;
    max-width: 110px;
    object-fit: contain;
    flex-shrink: 0;
  }

  .empresa-info {
    flex: 1;
    min-width: 0;
  }

  .empresa-nome {
    font-size: 15pt;
    font-weight: 700;
    color: #2a1812;
    word-wrap: break-word;
  }

  .empresa-cnpj {
    font-size: 9pt;
    color: #666;
    margin-top: 2px;
  }

  .subtitulo {
    font-size: 9pt;
    color: #666;
    margin-bottom: 8px;
    flex-shrink: 0;
  }

  .foto-area {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    padding: 2mm 0;
  }

  .foto-imagem {
    display: block;
    max-width: 100%;
    max-height: 100%;
    width: auto;
    height: auto;
    object-fit: contain;
    border: 1px solid #ddd;
    border-radius: 4px;
    background: #fafafa;
  }

  .foto-legenda {
    font-size: 9pt;
    color: #555;
    text-align: center;
    margin-top: 6px;
    flex-shrink: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .rodape {
    padding-top: 8px;
    margin-top: 4px;
    border-top: 1px solid #e5e5e5;
    font-size: 8pt;
    color: #888;
    text-align: center;
    flex-shrink: 0;
  }

  @media print {
    html, body {
      width: auto;
      height: auto;
    }
    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .pagina {
      margin: 0;
      page-break-inside: avoid;
      break-inside: avoid;
    }
  }
`;

export interface LeadFotosPdfExportInput {
  imageUrls: string[];
  imageLabels?: string[];
  logoUrl?: string | null;
  nomeEmpresa?: string | null;
  cnpj?: string | null;
  leadName?: string | null;
  leadId?: number | null;
}

function buildCabecalhoHtml(
  logoUrl: string | null | undefined,
  nomeEmpresa: string | null | undefined,
  cnpj: string | null | undefined,
): string {
  const nomeDisplay = nomeEmpresa?.trim() || '';
  return `
    <div class="cabecalho">
      ${logoUrl ? `<img src="${esc(logoUrl)}" alt="Logo" class="logo" crossorigin="anonymous" />` : ''}
      <div class="empresa-info">
        ${nomeDisplay ? `<div class="empresa-nome">${esc(nomeDisplay)}</div>` : ''}
        ${cnpj?.trim() ? `<div class="empresa-cnpj">CNPJ: ${esc(cnpj.trim())}</div>` : ''}
      </div>
    </div>
  `;
}

function buildSubtitulo(leadName: string | null | undefined, dataGeracao: string, pageIndex: number, total: number): string {
  const parts: string[] = [];
  if (leadName?.trim()) parts.push(esc(leadName.trim()));
  parts.push(`Foto ${pageIndex + 1} de ${total}`);
  parts.push(`Gerado em ${esc(dataGeracao)}`);
  return parts.join(' · ');
}

function buildPaginasHtml(input: LeadFotosPdfExportInput): string {
  const { imageUrls, imageLabels, logoUrl, nomeEmpresa, cnpj, leadName } = input;
  const nomeDisplay = nomeEmpresa?.trim() || '';
  const dataGeracao = format(new Date(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  const cabecalho = buildCabecalhoHtml(logoUrl, nomeEmpresa, cnpj);

  return imageUrls
    .map((url, index) => {
      const label = imageLabels?.[index]?.trim();
      return `
    <section class="pagina">
      ${cabecalho}
      <p class="subtitulo">${buildSubtitulo(leadName, dataGeracao, index, imageUrls.length)}</p>
      <div class="foto-area">
        <img src="${esc(url)}" alt="${esc(label || `Foto ${index + 1}`)}" class="foto-imagem" crossorigin="anonymous" />
      </div>
      ${label ? `<p class="foto-legenda">${esc(label)}</p>` : ''}
      <div class="rodape">
        ${nomeDisplay ? `${esc(nomeDisplay)} · ` : ''}Documento gerado pelo CRM Selletos
      </div>
    </section>`;
    })
    .join('\n');
}

export function buildLeadFotosPdfFileName(leadId?: number | null): string {
  const datePart = format(new Date(), 'yyyy-MM-dd');
  return leadId ? `fotos-lead-${leadId}-${datePart}.pdf` : `fotos-${datePart}.pdf`;
}

export function openLeadFotosPdfPrint(input: LeadFotosPdfExportInput): void {
  if (input.imageUrls.length === 0) {
    throw new Error('Nenhuma foto selecionada para exportar.');
  }

  const titulo = input.leadName?.trim()
    ? `Fotos — ${input.leadName.trim()}`
    : 'Fotos do projeto';

  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <title>${esc(titulo)}</title>
  <style>${FOTOS_PDF_CSS}</style>
</head>
<body>
  ${buildPaginasHtml(input)}
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
          setTimeout(function() { window.close(); }, 500);
        });
      });
    };
  </script>
</body>
</html>`;

  const janela = window.open('', '_blank', 'width=900,height=700');
  if (!janela) {
    throw new Error('Permita pop-ups para exportar o PDF.');
  }
  janela.document.open();
  janela.document.write(html);
  janela.document.close();
}

function loadScriptOnce(src: string, id: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.getElementById(id)) {
      resolve();
      return;
    }
    const script = document.createElement('script');
    script.id = id;
    script.src = src;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error(`Não foi possível carregar ${src}`));
    document.head.appendChild(script);
  });
}

interface LoadedImage {
  dataUrl: string;
  width: number;
  height: number;
  format: 'JPEG' | 'PNG' | 'WEBP';
}

async function fetchImageForPdf(url: string): Promise<LoadedImage> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error('Não foi possível carregar uma das fotos.');
  }
  const blob = await response.blob();
  let dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Erro ao ler imagem'));
    reader.readAsDataURL(blob);
  });

  let format: LoadedImage['format'] = blob.type.includes('png')
    ? 'PNG'
    : blob.type.includes('webp')
      ? 'WEBP'
      : 'JPEG';

  const dimensions = await new Promise<{ width: number; height: number }>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('Erro ao decodificar imagem'));
    img.src = dataUrl;
  });

  // jsPDF não suporta WEBP de forma confiável — converte para JPEG
  if (format === 'WEBP') {
    dataUrl = await convertDataUrlToJpeg(dataUrl);
    format = 'JPEG';
  }

  return { dataUrl, ...dimensions, format };
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
      ctx.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => reject(new Error('Erro ao converter imagem'));
    img.src = dataUrl;
  });
}

interface JsPDFInstance {
  addPage(): void;
  addImage(
    imageData: string,
    format: string,
    x: number,
    y: number,
    width: number,
    height: number,
  ): void;
  setFontSize(size: number): void;
  setTextColor(r: number, g: number, b: number): void;
  setDrawColor(r: number, g: number, b: number): void;
  setLineWidth(width: number): void;
  line(x1: number, y1: number, x2: number, y2: number): void;
  text(text: string, x: number, y: number, options?: { align?: 'center' | 'left' | 'right' }): void;
  output(type: 'blob'): Blob;
  internal: {
    pageSize: { getWidth(): number; getHeight(): number };
  };
}

type JsPDFConstructor = new (options?: {
  orientation?: 'portrait' | 'landscape';
  unit?: string;
  format?: string;
}) => JsPDFInstance;

async function getJsPDF(): Promise<JsPDFConstructor> {
  await loadScriptOnce(
    'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
    'jspdf-cdn',
  );
  const jspdfGlobal = (window as unknown as { jspdf?: { jsPDF: JsPDFConstructor } }).jspdf;
  if (!jspdfGlobal?.jsPDF) {
    throw new Error('Biblioteca jsPDF indisponível.');
  }
  return jspdfGlobal.jsPDF;
}

async function loadLogoForPdf(logoUrl: string | null | undefined): Promise<LoadedImage | null> {
  if (!logoUrl?.trim()) return null;
  try {
    return await fetchImageForPdf(logoUrl.trim());
  } catch {
    return null;
  }
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

function sanitizeDownloadBaseName(fileName: string, fallback = 'imagem'): string {
  const trimmed = fileName.trim().replace(/\.[^.]+$/, '');
  return trimmed || fallback;
}

/** Baixa uma foto do lead como JPG (converte PNG/WebP se necessário). */
export async function downloadLeadImageAsJpg(imageUrl: string, fileName: string): Promise<void> {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error('Não foi possível carregar a imagem.');
  }
  const blob = await response.blob();
  const jpgName = `${sanitizeDownloadBaseName(fileName)}.jpg`;

  if (blob.type.includes('jpeg') || blob.type.includes('jpg')) {
    triggerBlobDownload(blob, jpgName);
    return;
  }

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Erro ao ler imagem'));
    reader.readAsDataURL(blob);
  });

  const jpegDataUrl = await convertDataUrlToJpeg(dataUrl);
  const jpegResponse = await fetch(jpegDataUrl);
  const jpegBlob = await jpegResponse.blob();
  triggerBlobDownload(jpegBlob, jpgName);
}

/** Gera e baixa um PDF de uma ou mais fotos com logo e nome da empresa. */
export async function downloadLeadFotosPdf(input: LeadFotosPdfExportInput): Promise<void> {
  const file = await buildLeadFotosPdfFile(input);
  triggerBlobDownload(file, file.name);
}

export async function buildLeadFotosPdfFile(input: LeadFotosPdfExportInput): Promise<File> {
  if (input.imageUrls.length === 0) {
    throw new Error('Nenhuma foto selecionada para exportar.');
  }

  const JsPDF = await getJsPDF();
  const [images, logo] = await Promise.all([
    Promise.all(input.imageUrls.map((url) => fetchImageForPdf(url))),
    loadLogoForPdf(input.logoUrl),
  ]);

  const doc = new JsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const headerBottomY = margin + 26;
  const footerTopY = pageH - margin - 8;
  const contentTop = headerBottomY + 4;
  const contentBottom = footerTopY - 6;
  const contentH = contentBottom - contentTop;
  const contentW = pageW - margin * 2;

  const nomeDisplay = input.nomeEmpresa?.trim() || '';
  const dataGeracao = format(new Date(), "dd/MM/yyyy HH:mm", { locale: ptBR });

  images.forEach((image, index) => {
    if (index > 0) doc.addPage();

    let cursorY = margin;

    if (logo) {
      const logoBox = fitImageInBox(logo.width, logo.height, 30, 14);
      doc.addImage(logo.dataUrl, logo.format, margin, cursorY, logoBox.width, logoBox.height);
    }

    if (nomeDisplay) {
      doc.setFontSize(14);
      doc.setTextColor(42, 24, 18);
      doc.text(nomeDisplay, logo ? margin + 34 : margin, cursorY + 8);
    }
    if (input.cnpj?.trim()) {
      doc.setFontSize(9);
      doc.setTextColor(102, 102, 102);
      doc.text(`CNPJ: ${input.cnpj.trim()}`, logo ? margin + 34 : margin, cursorY + 14);
    }

    cursorY += 18;
    doc.setDrawColor(201, 160, 123);
    doc.setLineWidth(0.4);
    doc.line(margin, cursorY, pageW - margin, cursorY);

    doc.setFontSize(9);
    doc.setTextColor(102, 102, 102);
    const subtitleParts: string[] = [];
    if (input.leadName?.trim()) subtitleParts.push(input.leadName.trim());
    subtitleParts.push(`Foto ${index + 1} de ${images.length}`);
    subtitleParts.push(`Gerado em ${dataGeracao}`);
    doc.text(subtitleParts.join(' · '), margin, cursorY + 5);

    const fitted = fitImageInBox(image.width, image.height, contentW, contentH);
    const imgX = margin + (contentW - fitted.width) / 2;
    const imgY = contentTop + (contentH - fitted.height) / 2;
    doc.addImage(image.dataUrl, image.format, imgX, imgY, fitted.width, fitted.height);

    const label = input.imageLabels?.[index]?.trim();
    if (label) {
      doc.setFontSize(8);
      doc.setTextColor(85, 85, 85);
      doc.text(label, pageW / 2, footerTopY - 2, { align: 'center' });
    }

    doc.setFontSize(8);
    doc.setTextColor(136, 136, 136);
    const rodape = `${nomeDisplay ? `${nomeDisplay} · ` : ''}Documento gerado pelo CRM Selletos`;
    doc.text(rodape, pageW / 2, pageH - margin, { align: 'center' });
  });

  const blob = doc.output('blob');
  return new File([blob], buildLeadFotosPdfFileName(input.leadId), { type: 'application/pdf' });
}
