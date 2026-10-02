import { jsPDF } from 'jspdf';
import { dataUrlToFile } from '@/lib/contrato-anexo-upload';

/** Cartão de nota da lousa (~A5 paisagem) — abre como imagem nos anexos. */
const NOTE_W = 1400;
const NOTE_H = 1000;
const JPEG_QUALITY = 0.92;

export interface WhiteboardNoteExportInput {
  /** Foto já exportada da lousa (com desenhos) — vira a miniatura. */
  photoFile: File;
  /** Texto digitado em “Notas da foto”. */
  noteText: string;
  /** Nome do arquivo da foto de referência (ex.: cozinha-parede.jpg). */
  photoFileName: string;
  /** Base do nome dos arquivos gerados (sem extensão). */
  baseName: string;
  leadId?: number | null;
}

export interface WhiteboardNoteExportResult {
  /** Imagem da nota (miniatura + texto) — abre na galeria. */
  imageFile: File;
  /** PDF da mesma nota — para baixar/imprimir. */
  pdfFile: File;
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const paragraphs = text.replace(/\r\n/g, '\n').split('\n');
  const lines: string[] = [];
  for (const paragraph of paragraphs) {
    if (!paragraph.trim()) {
      lines.push('');
      continue;
    }
    const words = paragraph.split(/\s+/);
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (ctx.measureText(next).width <= maxWidth) {
        current = next;
      } else {
        if (current) lines.push(current);
        current = word;
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível carregar a miniatura da foto.'));
    };
    img.src = url;
  });
}

function drawRoundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function canvasToJpegFile(canvas: HTMLCanvasElement, fileName: string): Promise<File> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Não foi possível gerar a imagem da nota.'));
          return;
        }
        resolve(new File([blob], fileName, { type: 'image/jpeg' }));
      },
      'image/jpeg',
      JPEG_QUALITY,
    );
  });
}

/**
 * Gera um arquivo de nota separado (JPG + PDF) com miniatura da foto de referência
 * e o texto digitado na lousa — para guardar na mesma pasta da foto.
 */
export async function buildWhiteboardNoteAttachmentFiles(
  input: WhiteboardNoteExportInput,
): Promise<WhiteboardNoteExportResult> {
  const note = input.noteText.trim();
  if (!note) {
    throw new Error('Não há texto de nota para salvar.');
  }

  const photo = await loadImageFromFile(input.photoFile);
  const canvas = document.createElement('canvas');
  canvas.width = NOTE_W;
  canvas.height = NOTE_H;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Não foi possível gerar a nota.');

  // Fundo papel
  const grad = ctx.createLinearGradient(0, 0, 0, NOTE_H);
  grad.addColorStop(0, '#fffef9');
  grad.addColorStop(0.5, '#ffffff');
  grad.addColorStop(1, '#f7efe4');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, NOTE_W, NOTE_H);

  // Moldura
  ctx.strokeStyle = '#8b6914';
  ctx.lineWidth = 4;
  ctx.strokeRect(24, 24, NOTE_W - 48, NOTE_H - 48);
  ctx.strokeStyle = 'rgba(139, 105, 20, 0.35)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(38, 38, NOTE_W - 76, NOTE_H - 76);

  const left = 72;
  const right = NOTE_W - 72;
  let y = 78;

  ctx.textAlign = 'left';
  ctx.fillStyle = '#8b6914';
  ctx.font = '700 14px Georgia, "Times New Roman", serif';
  ctx.fillText('LOUSA · NOTA DA FOTO', left, y);

  y += 36;
  ctx.fillStyle = '#1a100c';
  ctx.font = '700 36px Georgia, "Times New Roman", serif';
  ctx.fillText('Nota vinculada à foto', left, y);

  y += 28;
  ctx.fillStyle = '#5a4636';
  ctx.font = '16px Georgia, "Times New Roman", serif';
  const refLabel = `Referência: ${input.photoFileName}`;
  ctx.fillText(refLabel, left, y);

  if (input.leadId) {
    ctx.textAlign = 'right';
    ctx.fillText(`Lead #${input.leadId}`, right, y);
    ctx.textAlign = 'left';
  }

  y += 22;
  ctx.strokeStyle = '#8b6914';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(left, y);
  ctx.lineTo(right, y);
  ctx.stroke();

  // Miniatura da foto de referência
  y += 28;
  const thumbMaxW = 420;
  const thumbMaxH = 320;
  const scale = Math.min(thumbMaxW / photo.width, thumbMaxH / photo.height, 1);
  const thumbW = Math.max(120, Math.round(photo.width * scale));
  const thumbH = Math.max(90, Math.round(photo.height * scale));
  const thumbX = left;
  const thumbY = y;

  ctx.fillStyle = '#1a100c';
  drawRoundRect(ctx, thumbX - 6, thumbY - 6, thumbW + 12, thumbH + 12, 14);
  ctx.fill();
  ctx.save();
  drawRoundRect(ctx, thumbX, thumbY, thumbW, thumbH, 10);
  ctx.clip();
  ctx.drawImage(photo, thumbX, thumbY, thumbW, thumbH);
  ctx.restore();
  ctx.strokeStyle = '#8b6914';
  ctx.lineWidth = 3;
  drawRoundRect(ctx, thumbX, thumbY, thumbW, thumbH, 10);
  ctx.stroke();

  ctx.fillStyle = '#8b6914';
  ctx.font = '700 12px Georgia, "Times New Roman", serif';
  ctx.fillText('MINIATURA DA FOTO', thumbX, thumbY + thumbH + 22);

  // Texto da nota ao lado / abaixo da miniatura
  const textLeft = thumbX + thumbW + 36;
  const textWidth = right - textLeft;
  let textY = thumbY + 8;

  ctx.fillStyle = '#1a100c';
  ctx.font = '700 18px Georgia, "Times New Roman", serif';
  ctx.fillText('Observação', textLeft, textY);
  textY += 28;

  ctx.fillStyle = '#2a1812';
  ctx.font = '20px Georgia, "Times New Roman", serif';
  const lines = wrapText(ctx, note, textWidth);
  const lineHeight = 30;
  const maxLinesBeside = Math.floor((thumbH - 20) / lineHeight);
  let lineIndex = 0;

  for (; lineIndex < Math.min(lines.length, maxLinesBeside); lineIndex += 1) {
    ctx.fillText(lines[lineIndex] || ' ', textLeft, textY);
    textY += lineHeight;
  }

  // Continua abaixo se o texto for longo
  if (lineIndex < lines.length) {
    let belowY = Math.max(thumbY + thumbH + 48, textY + 24);
    ctx.fillStyle = '#2a1812';
    ctx.font = '20px Georgia, "Times New Roman", serif';
    for (; lineIndex < lines.length; lineIndex += 1) {
      if (belowY > NOTE_H - 80) {
        ctx.fillStyle = '#8b6914';
        ctx.font = '16px Georgia, "Times New Roman", serif';
        ctx.fillText('… (texto completo no PDF)', left, belowY);
        break;
      }
      ctx.fillText(lines[lineIndex] || ' ', left, belowY);
      belowY += lineHeight;
    }
  }

  // Rodapé
  ctx.fillStyle = '#5a4636';
  ctx.font = '14px Georgia, "Times New Roman", serif';
  ctx.textAlign = 'left';
  ctx.fillText('Arquivo de nota da lousa · mesma pasta da foto', left, NOTE_H - 48);
  ctx.textAlign = 'right';
  ctx.fillText(
    new Date().toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
    right,
    NOTE_H - 48,
  );

  const imageName = `${input.baseName}-nota.jpg`;
  const pdfName = `${input.baseName}-nota.pdf`;
  const imageFile = await canvasToJpegFile(canvas, imageName);

  // PDF com a mesma arte (abre e imprime com a miniatura)
  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
  const pdf = new jsPDF({
    orientation: 'landscape',
    unit: 'pt',
    format: 'a4',
  });
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const margin = 28;
  const maxW = pageW - margin * 2;
  const maxH = pageH - margin * 2;
  const fit = Math.min(maxW / NOTE_W, maxH / NOTE_H);
  const drawW = NOTE_W * fit;
  const drawH = NOTE_H * fit;
  const dx = (pageW - drawW) / 2;
  const dy = (pageH - drawH) / 2;
  pdf.addImage(dataUrl, 'JPEG', dx, dy, drawW, drawH);
  const pdfBlob = pdf.output('blob');
  const pdfFile = new File([pdfBlob], pdfName, { type: 'application/pdf' });

  // Garante que o JPG também exista como File tipado (dataUrlToFile fallback se toBlob falhar em edge cases)
  if (!imageFile.size) {
    return {
      imageFile: dataUrlToFile(dataUrl, imageName),
      pdfFile,
    };
  }

  return { imageFile, pdfFile };
}
