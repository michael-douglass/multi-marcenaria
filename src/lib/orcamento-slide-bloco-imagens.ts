import type { ImagemOrientacaoSlide } from '@/lib/orcamento-slide-imagem-spec';
import type {
  BlocoTipo,
  LeadMidiaDisponivel,
  MidiaTipo,
  OrcamentoSlideBloco,
  OrcamentoSlideMidia,
} from '@/lib/orcamento-slide-types';

export interface ImagemSlideConfig {
  url: string;
  orientacao: ImagemOrientacaoSlide;
}

/** Todos os tipos de bloco aceitam fotos via `config.imagens` (galeria). */
export const BLOCOS_COM_IMAGEM: BlocoTipo[] = [
  'capa',
  'valorizacao',
  'comparativo_ferragens',
  'galeria_projetos',
  'antes_depois',
  'imagem_interativa',
  'precificacao',
  'precos_fracionados',
  'prazos',
  'garantia',
  'dados_projeto',
  'imagens_orcamento',
  'texto_livre',
  'script',
  'comparativo_mdf',
  'solicitar_fotos',
  'analise_ia',
];

export function urlDoConfig(config: Record<string, unknown>, key: string): string | null {
  const v = config[key];
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

export function orientacaoDoConfig(
  config: Record<string, unknown>,
  key = 'imagem_orientacao',
): ImagemOrientacaoSlide {
  return config[key] === 'retrato' ? 'retrato' : 'paisagem';
}

export function urlImagemFundoDoConfig(config: Record<string, unknown>): string | null {
  return urlDoConfig(config, 'imagem_fundo_url');
}

export function orientacaoImagemFundoDoConfig(config: Record<string, unknown>): ImagemOrientacaoSlide {
  return orientacaoDoConfig(config, 'imagem_fundo_orientacao');
}

export function blocoTemImagemFundo(config: Record<string, unknown>): boolean {
  return !!urlImagemFundoDoConfig(config);
}

function parseItemGaleria(item: unknown): ImagemSlideConfig | null {
  if (typeof item === 'string' && item.trim()) {
    return { url: item.trim(), orientacao: 'paisagem' };
  }
  if (item && typeof item === 'object' && 'url' in item) {
    const row = item as { url?: unknown; orientacao?: unknown };
    if (typeof row.url === 'string' && row.url.trim()) {
      return {
        url: row.url.trim(),
        orientacao: row.orientacao === 'retrato' ? 'retrato' : 'paisagem',
      };
    }
  }
  return null;
}

export function imagensGaleriaDoConfig(config: Record<string, unknown>): ImagemSlideConfig[] {
  const imgs = config.imagens;
  if (!Array.isArray(imgs)) return [];
  return imgs.map(parseItemGaleria).filter((i): i is ImagemSlideConfig => i !== null);
}

/** @deprecated Preferir imagensGaleriaDoConfig */
export function urlsGaleriaDoConfig(config: Record<string, unknown>): string[] {
  return imagensGaleriaDoConfig(config).map((i) => i.url);
}

function midiaSintetica(
  url: string,
  tipo: MidiaTipo,
  ordem: number,
  fileName?: string,
): OrcamentoSlideMidia {
  return {
    id: `config-${tipo}-${ordem}`,
    orcamento_id: 'template',
    tipo,
    file_url: url,
    file_name: fileName ?? url.split('/').pop() ?? 'imagem',
    hotspots: [],
    origem: 'upload',
    source_id: null,
    ordem,
    criado_em: new Date().toISOString(),
  };
}

/** Converte imagens salvas nos blocos do template em mídias para prévia/apresentação. */
export function buildMidiasFromBlocos(blocos: OrcamentoSlideBloco[]): OrcamentoSlideMidia[] {
  const midias: OrcamentoSlideMidia[] = [];
  let ordem = 0;

  for (const bloco of blocos) {
    const { tipo, config } = bloco;

    if (tipo === 'capa') {
      const url = urlDoConfig(config, 'imagem_url');
      if (url) midias.push(midiaSintetica(url, 'capa', ordem++));
    } else if (tipo === 'valorizacao') {
      const url = urlDoConfig(config, 'imagem_url');
      if (url) midias.push(midiaSintetica(url, 'projeto', ordem++));
    } else if (tipo === 'comparativo_ferragens') {
      const url = urlDoConfig(config, 'imagem_url');
      if (url) {
        midias.push(midiaSintetica(url, 'ambiente_cliente', ordem++, 'ferragens-comparativo.jpg'));
      }
    } else if (tipo === 'galeria_projetos') {
      for (const img of imagensGaleriaDoConfig(config)) {
        midias.push(midiaSintetica(img.url, 'projeto', ordem++));
      }
    } else if (tipo === 'antes_depois') {
      const antes = urlDoConfig(config, 'imagem_antes_url');
      const depois = urlDoConfig(config, 'imagem_depois_url');
      if (antes) midias.push(midiaSintetica(antes, 'antes', ordem++));
      if (depois) midias.push(midiaSintetica(depois, 'depois', ordem++));
    } else if (tipo === 'imagem_interativa') {
      const url = urlDoConfig(config, 'imagem_url');
      if (url) midias.push(midiaSintetica(url, 'projeto', ordem++));
    }

    if (tipo !== 'galeria_projetos') {
      for (const img of imagensGaleriaDoConfig(config)) {
        midias.push(midiaSintetica(img.url, 'projeto', ordem++));
      }
    }
  }

  return midias;
}

/** Usa mídias do orçamento; se vazio, cai nas imagens configuradas nos blocos. */
export function mergeMidiasOrcamentoETemplate(
  midias: OrcamentoSlideMidia[],
  blocos: OrcamentoSlideBloco[],
): OrcamentoSlideMidia[] {
  if (midias.length > 0) return midias;
  return buildMidiasFromBlocos(blocos);
}

/** Inclui anotações/lousa do lead que ainda não foram importadas no orçamento. */
export function enriquecerMidiasComLead(
  midiasOrcamento: OrcamentoSlideMidia[],
  leadMidias: LeadMidiaDisponivel[],
  orcamentoId = '',
): OrcamentoSlideMidia[] {
  if (leadMidias.length === 0) return midiasOrcamento;

  const urlsExistentes = new Set(midiasOrcamento.map((m) => m.file_url));
  const sourceIdsExistentes = new Set(
    midiasOrcamento.map((m) => m.source_id).filter((id): id is string => !!id),
  );

  const extras: OrcamentoSlideMidia[] = [];
  let ordem = midiasOrcamento.length;

  for (const lm of leadMidias) {
    if (urlsExistentes.has(lm.file_url) || sourceIdsExistentes.has(lm.id)) continue;
    extras.push({
      id: `lead-${lm.id}`,
      orcamento_id: orcamentoId,
      tipo: 'projeto',
      file_url: lm.file_url,
      file_name: lm.file_name,
      hotspots: [],
      origem: lm.origem,
      source_id: lm.id,
      ordem: ordem++,
      criado_em: lm.criado_em,
    });
    urlsExistentes.add(lm.file_url);
  }

  return extras.length > 0 ? [...midiasOrcamento, ...extras] : midiasOrcamento;
}

/** Mídias finais para capa/valorização — só as do orçamento ou fallback do template. */
export function resolverMidiasApresentacao(
  midiasOrcamento: OrcamentoSlideMidia[],
  blocos: OrcamentoSlideBloco[],
): OrcamentoSlideMidia[] {
  return mergeMidiasOrcamentoETemplate(midiasOrcamento, blocos);
}
