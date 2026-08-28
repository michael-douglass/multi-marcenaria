import type { ImagemSlideConfig } from '@/lib/orcamento-slide-bloco-imagens';
import { isOrcamentoMidiaVideo } from '@/lib/orcamento-slide-midia-video';
import { toggleImagensProjetoAtivo } from '@/lib/orcamento-slide-perguntas-resolver';
import type {
  BlocoTipo,
  OrcamentoPergunta,
  OrcamentoSlideMidia,
} from '@/lib/orcamento-slide-types';

function isFerragensMidia(m: OrcamentoSlideMidia) {
  // Vídeos do projeto (ex.: Reel “Mercatto Ferragens…”) não são a foto comparativa.
  if (isOrcamentoMidiaVideo(m)) return false;
  const ref = `${m.file_name} ${m.file_url}`.toLowerCase();
  return ref.includes('ferragem') || ref.includes('ferragens');
}

function midiaDeUrl(url: string, tipo: OrcamentoSlideMidia['tipo'], fileName?: string): OrcamentoSlideMidia {
  return {
    id: `url-${url}`,
    orcamento_id: '',
    tipo,
    file_url: url,
    file_name: fileName ?? url.split('/').pop() ?? 'imagem',
    hotspots: [],
    origem: 'upload',
    source_id: null,
    ordem: 0,
    criado_em: '',
  };
}

/** Só imagem estática — vídeos não entram no bloco de ferragens. */
function isMidiaImagemEstatica(m: OrcamentoSlideMidia | null | undefined): m is OrcamentoSlideMidia {
  if (!m?.file_url) return false;
  return !isOrcamentoMidiaVideo(m);
}

function ordenarMidiasPorOrdem(midias: OrcamentoSlideMidia[]) {
  return [...midias].sort(
    (a, b) => a.ordem - b.ordem || (a.criado_em || '').localeCompare(b.criado_em || ''),
  );
}

/** Upload direto no orçamento (exclui sintéticos de template/config). */
export function isMidiaUploadOrcamento(m: OrcamentoSlideMidia): boolean {
  if (!m.orcamento_id || m.orcamento_id === 'template') return false;
  if (m.id.startsWith('lead-') || m.id.startsWith('config-') || m.id.startsWith('url-')) return false;
  return true;
}

/** Foto de projeto salva no orçamento (upload ou importação explícita do lead). */
export function isMidiaProjetoOrcamento(m: OrcamentoSlideMidia): boolean {
  if (m.tipo !== 'projeto' || isFerragensMidia(m)) return false;
  if (!m.orcamento_id || m.orcamento_id === 'template') return false;
  if (m.id.startsWith('config-') || m.id.startsWith('url-') || m.id.startsWith('lead-')) return false;
  return true;
}

/** Fotos adicionadas no orçamento — extras da galeria (no final), não capa/valorização. */
export function midiasGaleriaExtrasOrcamento(midias: OrcamentoSlideMidia[]) {
  return ordenarMidiasPorOrdem(midias.filter(isMidiaProjetoOrcamento));
}

/**
 * Fotos do bloco "Imagens do Orçamento" — as escolhidas/importadas no orçamento.
 * Fotos já salvas sempre entram; o toggle "Não" esconde o bloco.
 */
export function resolverFotosImagensOrcamento(
  midiasOrcamento: OrcamentoSlideMidia[],
  respostas: Record<string, string | string[]>,
  perguntas: OrcamentoPergunta[],
): OrcamentoSlideMidia[] {
  const fotos = ordenarMidiasPorOrdem(midiasOrcamento.filter(isMidiaProjetoOrcamento));
  if (fotos.length === 0) return [];
  if (!toggleImagensProjetoAtivo(respostas, perguntas)) return [];
  return fotos;
}

/** @deprecated Use midiasGaleriaExtrasOrcamento ou midiasGaleriaParaApresentacao. */
export function midiasGaleria(midias: OrcamentoSlideMidia[]) {
  return midiasGaleriaExtrasOrcamento(midias);
}

/** Capa: tipo capa explícito ou imagem do template — não consome fotos da galeria do orçamento. */
export function midiaCapa(midias: OrcamentoSlideMidia[], fallbackUrl?: string | null) {
  const capaOrcamento = midias.find((m) => m.tipo === 'capa');
  if (capaOrcamento) return capaOrcamento;
  if (fallbackUrl) return midiaDeUrl(fallbackUrl, 'capa');
  return null;
}

/** Valorização: só imagem configurada no template — fotos do orçamento ficam na galeria ao final. */
export function midiaValorizacao(_midias: OrcamentoSlideMidia[], fallbackUrl?: string | null) {
  if (fallbackUrl) return midiaDeUrl(fallbackUrl, 'projeto');
  return null;
}

/** Ferragens: imagem do template → foto nomeada como ferragens no orçamento (nunca vídeo). */
export function midiaComparativoFerragens(midias: OrcamentoSlideMidia[], fallbackUrl?: string | null) {
  if (fallbackUrl) {
    const fromUrl = midiaDeUrl(fallbackUrl, 'ambiente_cliente', 'ferragens-comparativo.jpg');
    return isMidiaImagemEstatica(fromUrl) ? fromUrl : null;
  }
  const candidata = midias.find(isFerragensMidia) ?? null;
  return isMidiaImagemEstatica(candidata) ? candidata : null;
}

/** Somente imagens configuradas no bloco Galeria do template. */
export function midiasGaleriaConfiguracao(imagensConfig: ImagemSlideConfig[]): OrcamentoSlideMidia[] {
  const urlsVistos = new Set<string>();
  const merged: OrcamentoSlideMidia[] = [];

  for (const [i, img] of imagensConfig.entries()) {
    if (urlsVistos.has(img.url)) continue;
    urlsVistos.add(img.url);
    merged.push(midiaDeUrl(img.url, 'projeto', `galeria-config-${i + 1}`));
  }

  return merged;
}

/** Uploads do orçamento que não estão na config da galeria — vão ao final da apresentação. */
export function midiasGaleriaExtrasSemConfig(
  midiasOrcamento: OrcamentoSlideMidia[],
  imagensConfig: ImagemSlideConfig[],
) {
  const urlsConfig = new Set(imagensConfig.map((i) => i.url));
  return midiasGaleriaExtrasOrcamento(midiasOrcamento).filter((m) => !urlsConfig.has(m.file_url));
}

/**
 * @deprecated Galeria usa só config; extras vão em seção final via midiasGaleriaExtrasSemConfig.
 */
export function midiasGaleriaParaApresentacao(
  midiasOrcamento: OrcamentoSlideMidia[],
  imagensConfig: ImagemSlideConfig[],
) {
  return [
    ...midiasGaleriaConfiguracao(imagensConfig),
    ...midiasGaleriaExtrasSemConfig(midiasOrcamento, imagensConfig),
  ];
}

/** @deprecated Preferir midiasGaleriaConfiguracao + midiasGaleriaExtrasSemConfig. */
export function midiasGaleriaComFallback(
  midias: OrcamentoSlideMidia[],
  fallbackImagens: ImagemSlideConfig[],
) {
  return midiasGaleriaParaApresentacao(midias, fallbackImagens);
}

/** Colunas e linhas da grade para caber todas as fotos extras em uma tela, sem rolagem interna. */
export function calcularGradeFotosExtras(total: number, mobile: boolean): { cols: number; rows: number } {
  if (total <= 0) return { cols: 1, rows: 1 };
  if (mobile) {
    if (total === 1) return { cols: 1, rows: 1 };
    return { cols: 2, rows: Math.ceil(total / 2) };
  }
  if (total === 1) return { cols: 1, rows: 1 };
  if (total === 2) return { cols: 2, rows: 1 };
  if (total <= 4) return { cols: 2, rows: 2 };
  if (total <= 6) return { cols: 3, rows: 2 };
  return { cols: 3, rows: Math.ceil(total / 3) };
}

export function midiasParaBloco(midias: OrcamentoSlideMidia[], tipo: BlocoTipo) {
  switch (tipo) {
    case 'capa':
      return midiaCapa(midias) ? [midiaCapa(midias)!] : [];
    case 'valorizacao':
      return midiaValorizacao(midias) ? [midiaValorizacao(midias)!] : [];
    case 'galeria_projetos':
      return midiasGaleriaExtrasOrcamento(midias);
    case 'comparativo_ferragens':
      return midiaComparativoFerragens(midias) ? [midiaComparativoFerragens(midias)!] : [];
    default:
      return [];
  }
}
