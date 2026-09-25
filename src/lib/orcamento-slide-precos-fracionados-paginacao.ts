import type { GrupoPrecosFracionados, PrecoFracionadoItem } from '@/lib/orcamento-slide-types';
import { somaItensFracionados } from '@/lib/orcamento-slide-precificacao';

/** Fatia de um grupo em uma página do slide “Valores separados”. */
export interface GrupoFracionadoPagina {
  id: string;
  /** Título do grupo (só quando faz sentido nesta página). */
  titulo?: string;
  itens: PrecoFracionadoItem[];
  /** Soma parcial só na última página que contém itens deste grupo. */
  exibir_total: boolean;
  /** Soma de todos os itens do grupo (não só desta página). */
  total_grupo: number;
  /** Itens deste grupo continuam em páginas posteriores. */
  continuacao: boolean;
}

export interface PaginaPrecosFracionados {
  grupos: GrupoFracionadoPagina[];
}

export interface PaginarPrecosFracionadosOptions {
  /**
   * PDF / prévia fiel (1920px no celular) — mais linhas por página.
   * Sem densificar (apresentação ao vivo em 100dvh) — menos linhas.
   */
  densificar?: boolean;
}

/**
 * Quantos “slots” cabem numa página sem cortar.
 * Cabeçalho da 1ª página consome mais espaço que o “continuação”.
 */
function limitesPagina(
  mobile: boolean,
  densificar: boolean,
): { primeiro: number; demais: number } {
  if (mobile) {
    // PDF celular = 1920px; apresentação ao vivo ≈ 100dvh (bem menor).
    return densificar ? { primeiro: 16, demais: 18 } : { primeiro: 9, demais: 11 };
  }
  // Desktop 1080px.
  return densificar ? { primeiro: 11, demais: 13 } : { primeiro: 9, demais: 11 };
}

function pesoTituloGrupo(titulo?: string): number {
  return titulo?.trim() ? 0.75 : 0;
}

/**
 * Divide grupos/itens em páginas — cada uma vira uma dobra no PDF e na apresentação.
 * Não parte um item ao meio; prefere quebrar entre itens (e entre grupos).
 */
export function paginarGruposPrecosFracionados(
  grupos: GrupoPrecosFracionados[],
  mobile: boolean,
  options: PaginarPrecosFracionadosOptions = {},
): PaginaPrecosFracionados[] {
  if (grupos.length === 0) return [];

  const densificar = options.densificar === true;
  const { primeiro, demais } = limitesPagina(mobile, densificar);
  const pages: PaginaPrecosFracionados[] = [];

  let currentGrupos: GrupoFracionadoPagina[] = [];
  let weight = 0;
  let currentGrupo: GrupoFracionadoPagina | null = null;
  let itensJaNoGrupo = 0;

  const limiteAtual = () => (pages.length === 0 ? primeiro : demais);

  const pushGrupoAtual = () => {
    if (!currentGrupo || currentGrupo.itens.length === 0) {
      currentGrupo = null;
      return;
    }
    currentGrupos.push(currentGrupo);
    currentGrupo = null;
  };

  const flush = () => {
    pushGrupoAtual();
    if (currentGrupos.length === 0) return;
    pages.push({ grupos: currentGrupos });
    currentGrupos = [];
    weight = 0;
  };

  for (const grupo of grupos) {
    const itens = grupo.itens.filter((item) => item.label.trim().length > 0);
    if (itens.length === 0) continue;

    const mostrarTotalGrupo = grupo.exibir_total !== false;
    const totalGrupo = somaItensFracionados(itens);
    itensJaNoGrupo = 0;

    for (let i = 0; i < itens.length; i++) {
      const item = itens[i];
      const isFirstOfGrupoOnPage = !currentGrupo || currentGrupo.id !== grupo.id;
      const tituloNestaPagina =
        isFirstOfGrupoOnPage && itensJaNoGrupo === 0 ? grupo.titulo : undefined;
      const tituloContinuacao =
        isFirstOfGrupoOnPage && itensJaNoGrupo > 0
          ? grupo.titulo
            ? `${grupo.titulo} · continuação`
            : undefined
          : undefined;
      const tituloExibir = tituloNestaPagina ?? tituloContinuacao;
      const addWeight = (isFirstOfGrupoOnPage ? pesoTituloGrupo(tituloExibir) : 0) + 1;

      const pageJaTemConteudo =
        currentGrupos.length > 0 || (currentGrupo?.itens.length ?? 0) > 0;

      if (weight + addWeight > limiteAtual() && pageJaTemConteudo) {
        flush();
        const tituloAposQuebra =
          itensJaNoGrupo > 0
            ? grupo.titulo
              ? `${grupo.titulo} · continuação`
              : undefined
            : grupo.titulo;
        currentGrupo = {
          id: grupo.id,
          titulo: tituloAposQuebra,
          itens: [item],
          exibir_total: false,
          total_grupo: totalGrupo,
          continuacao: itensJaNoGrupo > 0,
        };
        weight = pesoTituloGrupo(tituloAposQuebra) + 1;
        itensJaNoGrupo += 1;
        continue;
      }

      if (!currentGrupo || currentGrupo.id !== grupo.id) {
        currentGrupo = {
          id: grupo.id,
          titulo: tituloExibir,
          itens: [],
          exibir_total: false,
          total_grupo: totalGrupo,
          continuacao: itensJaNoGrupo > 0,
        };
      }

      currentGrupo.itens.push(item);
      weight += addWeight;
      itensJaNoGrupo += 1;
    }

    // Total do grupo só na última fatia deste grupo.
    if (currentGrupo && currentGrupo.id === grupo.id) {
      currentGrupo.exibir_total = mostrarTotalGrupo;
      currentGrupo.total_grupo = totalGrupo;
      pushGrupoAtual();
    }
  }

  flush();
  return pages.length > 0 ? pages : [];
}
