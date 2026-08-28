import { getAgendaFileCategory } from '@/lib/agenda-file-types';
import { renderPdfFileToImages } from '@/lib/pdf-render';

const PDF_RENDER_WIDTH_PX = 1600;

function dataUrlToJpegFile(dataUrl: string, name: string): File {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new File([bytes], name, { type: mime });
}

/** PDF vira uma imagem JPEG por página; demais arquivos seguem inalterados. */
export async function preprocessAgendaFormFiles(files: File[]): Promise<File[]> {
  const result: File[] = [];

  for (const file of files) {
    if (getAgendaFileCategory(file.type) === 'pdf') {
      const pages = await renderPdfFileToImages(file, PDF_RENDER_WIDTH_PX);
      const baseName = file.name.replace(/\.pdf$/i, '') || 'documento';
      for (const page of pages) {
        result.push(dataUrlToJpegFile(page.src, `${baseName}-pagina-${page.pageNumber}.jpg`));
      }
      continue;
    }
    result.push(file);
  }

  return result;
}
