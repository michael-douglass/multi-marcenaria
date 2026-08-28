import type {
  Hotspot,
  OrcamentoDados,
  OrcamentoSlide,
  OrcamentoSlideMidia,
} from '@/lib/orcamento-slide-types';

const BUCKET = 'orcamento-slides';

/**
 * Gera um identificador distinto para a cópia, sem estourar tamanho legível.
 * Ex.: RASC-GLAUCIENE-MIRANDA → RASC-GLAUCIENE-MIRANDA-COPIA
 *      …-COPIA → …-COPIA-A3F9 (sufixo curto se já for cópia)
 */
export function identificadorCopiaOrcamento(identificadorOrigem: string): string {
  const base = (identificadorOrigem || 'ORC').trim().slice(0, 48);
  if (!/-COPIA(?:-|$)/i.test(base)) {
    return `${base}-COPIA`.slice(0, 64);
  }
  const sufixo = Date.now().toString(36).slice(-4).toUpperCase();
  return `${base}-${sufixo}`.slice(0, 64);
}

/** Cópia profunda do JSON do orçamento (textos, preços, respostas, meta). */
export function clonarDadosOrcamento(dados: OrcamentoDados): OrcamentoDados {
  return structuredClone(dados) as OrcamentoDados;
}

function clonarHotspots(hotspots: Hotspot[] | null | undefined): Hotspot[] {
  if (!Array.isArray(hotspots)) return [];
  return structuredClone(hotspots) as Hotspot[];
}

export interface MidiaDuplicataInput {
  orcamento_id: string;
  tipo: OrcamentoSlideMidia['tipo'];
  file_url: string;
  file_name: string;
  hotspots: Hotspot[];
  origem: OrcamentoSlideMidia['origem'];
  source_id: string | null;
  ordem: number;
}

/**
 * Prepara as linhas de mídia para o novo orçamento.
 * `resolverUrl` permite copiar arquivos no storage (upload) e devolver a nova URL.
 */
export async function montarMidiasDuplicadas(
  midiasOrigem: OrcamentoSlideMidia[],
  novoOrcamentoId: string,
  resolverUrl: (midia: OrcamentoSlideMidia) => Promise<string> = async (m) => m.file_url,
): Promise<MidiaDuplicataInput[]> {
  const ordenadas = [...midiasOrigem].sort((a, b) => a.ordem - b.ordem);
  const resultado: MidiaDuplicataInput[] = [];

  for (const midia of ordenadas) {
    const file_url = await resolverUrl(midia);
    resultado.push({
      orcamento_id: novoOrcamentoId,
      tipo: midia.tipo,
      file_url,
      file_name: midia.file_name,
      hotspots: clonarHotspots(midia.hotspots),
      origem: midia.origem,
      source_id: midia.source_id,
      ordem: midia.ordem,
    });
  }

  return resultado;
}

/** Extrai o path interno do bucket a partir da URL pública do Storage. */
export function pathStorageOrcamentoSlide(fileUrl: string): string | null {
  try {
    const url = new URL(fileUrl);
    const marker = `/${BUCKET}/`;
    const idx = url.pathname.indexOf(marker);
    if (idx < 0) return null;
    return decodeURIComponent(url.pathname.slice(idx + marker.length));
  } catch {
    return null;
  }
}

export function pathDestinoCopiaMidia(params: {
  schema: string;
  orcamentoId: string;
  tipo: OrcamentoSlideMidia['tipo'];
  fileName: string;
}): string {
  const ext = params.fileName.split('.').pop()?.replace(/[^a-zA-Z0-9]/g, '') || 'bin';
  const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  return `${params.schema}/${params.orcamentoId}/${params.tipo}/${stamp}.${ext}`;
}

export interface PayloadOrcamentoDuplicado {
  identificador: string;
  lead_id: number | null;
  cliente_nome: string;
  status: 'rascunho';
  dados: OrcamentoDados;
}

/** Monta o registro do orçamento-cópia (sempre nasce como rascunho). */
export function montarPayloadOrcamentoDuplicado(origem: OrcamentoSlide): PayloadOrcamentoDuplicado {
  return {
    identificador: identificadorCopiaOrcamento(origem.identificador),
    lead_id: origem.lead_id,
    cliente_nome: origem.cliente_nome,
    status: 'rascunho',
    dados: clonarDadosOrcamento(origem.dados),
  };
}
