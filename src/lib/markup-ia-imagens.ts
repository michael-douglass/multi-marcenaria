import type { LeadAIAnalysisItemPayload } from '@/lib/lead-ai-media-sources';
import { PIPELINE_LEAD_AI_MAX_IMAGES_PER_ANALYSIS } from '@/lib/pipeline-lead-ai-config';

/**
 * Espelha hashBase64Payload de supabase/functions/_shared/markup-cortecloud.ts —
 * tem que ser byte-a-byte o mesmo algoritmo. O índice que o agente Projetista devolve
 * em localizacao.imagem_indice é calculado no servidor sobre a lista de imagens já sem
 * duplicatas (mesmo hash); pra desenhar o marcador na imagem certa, o cliente precisa
 * chegar exatamente na mesma lista deduplicada, na mesma ordem.
 */
function hashBase64Payload(dataUrlOrBase64: string): string {
  const payload = dataUrlOrBase64.includes(',')
    ? dataUrlOrBase64.slice(dataUrlOrBase64.indexOf(',') + 1)
    : dataUrlOrBase64;
  let hash = 0;
  const sample = payload.length > 8000 ? payload.slice(0, 4000) + payload.slice(-4000) : payload;
  for (let i = 0; i < sample.length; i++) {
    hash = ((hash << 5) - hash + sample.charCodeAt(i)) | 0;
  }
  return `${payload.length}:${hash}`;
}

export interface MarkupIAImagemOrdenada {
  /** 1-based — é o valor que localizacao.imagem_indice referencia. */
  indice: number;
  dataUrl: string;
  itemId: string;
  itemLabel: string;
  /** 1-based dentro do item de origem (só relevante pra PDF). */
  pagina?: number;
}

/**
 * Mesma ordem e mesmo corte de buildImageParts (compose-markup-ia/index.ts):
 * PDFs primeiro (achatados por página, na ordem das páginas), depois imagens soltas;
 * duplicata exata (mesmo hash) descartada, mantendo a primeira ocorrência.
 */
export function buildOrderedUniqueImages(itens: LeadAIAnalysisItemPayload[]): MarkupIAImagemOrdenada[] {
  const pdfs = itens.filter((item) => (item.pagesBase64?.length ?? 0) > 0);
  const imagens = itens.filter((item) => !item.pagesBase64?.length && item.imageUrl);
  const ordenados = [...pdfs, ...imagens];

  const seen = new Set<string>();
  const result: MarkupIAImagemOrdenada[] = [];

  for (const item of ordenados) {
    if (result.length >= PIPELINE_LEAD_AI_MAX_IMAGES_PER_ANALYSIS) break;

    if (item.pagesBase64?.length) {
      item.pagesBase64.forEach((page, pageIdx) => {
        if (result.length >= PIPELINE_LEAD_AI_MAX_IMAGES_PER_ANALYSIS) return;
        const dataUrl = page.startsWith('data:') ? page : `data:image/jpeg;base64,${page}`;
        const hash = hashBase64Payload(dataUrl);
        if (seen.has(hash)) return;
        seen.add(hash);
        result.push({
          indice: result.length + 1,
          dataUrl,
          itemId: item.id,
          itemLabel: item.label,
          pagina: pageIdx + 1,
        });
      });
      continue;
    }

    if (item.imageUrl) {
      // Limitação conhecida: para foto solta (não-PDF), o payload manda a URL de
      // storage crua — o servidor baixa e converte pra base64 antes de fazer hash,
      // então esse hash não bate com o do servidor (ao contrário do PDF, que já
      // chega em base64 nos dois lados). Só importa se houver a MESMA foto duplicada
      // entre os anexos selecionados; nesse caso raro o marcador pode cair na foto
      // errada dentro do conjunto — a lista em texto (fallback) continua correta.
      const hash = hashBase64Payload(item.imageUrl);
      if (seen.has(hash)) continue;
      seen.add(hash);
      result.push({
        indice: result.length + 1,
        dataUrl: item.imageUrl,
        itemId: item.id,
        itemLabel: item.label,
      });
    }
  }

  return result;
}
