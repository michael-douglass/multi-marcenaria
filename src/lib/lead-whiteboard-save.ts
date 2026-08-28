import type { LeadWhiteboardDrawing, LeadWhiteboardImage } from '@/hooks/useLeadWhiteboard';
import { dataUrlToFile } from '@/lib/contrato-anexo-upload';
import { exportWhiteboardImageForRender } from '@/lib/whiteboard-render-export';

export function whiteboardSaveStamp(): string {
  return new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
}

/**
 * Exporta a foto ativa da lousa (com desenhos e formas) como arquivo JPEG
 * pronto para upload em anexos do lead.
 */
export async function buildWhiteboardAttachmentFile(input: {
  image: LeadWhiteboardImage;
  drawings: LeadWhiteboardDrawing[];
  leadId: number;
  legacyFallbackImageId?: string | null;
}): Promise<File> {
  const dataUrl = await exportWhiteboardImageForRender({
    image: input.image,
    drawings: input.drawings,
    legacyFallbackImageId: input.legacyFallbackImageId,
  });

  const stamp = whiteboardSaveStamp();
  const fileName = `lousa-lead-${input.leadId}-${stamp}.jpg`;
  return dataUrlToFile(dataUrl, fileName);
}
