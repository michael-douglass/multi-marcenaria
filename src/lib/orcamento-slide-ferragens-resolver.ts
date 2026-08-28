import type {
  OrcamentoCatalogoItem,
  OrcamentoPergunta,
} from '@/lib/orcamento-slide-types';
import { normalizarRespostaMulti } from '@/lib/orcamento-slide-perguntas-resolver';

export interface FerragemExibicao {
  titulo: string;
  descricao: string;
  imagem_url?: string;
}

function normalizarChave(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
}

export function isPerguntaFerragens(pergunta: OrcamentoPergunta): boolean {
  return /ferragem/i.test(pergunta.label);
}

function valoresSelecionados(resposta: string | string[] | undefined): string[] {
  return normalizarRespostaMulti(resposta);
}

function encontrarNoCatalogo(
  valor: string,
  labelOpcao: string | undefined,
  catalogo: OrcamentoCatalogoItem[],
): OrcamentoCatalogoItem | undefined {
  const chaveValor = normalizarChave(valor);
  const chaveLabel = labelOpcao ? normalizarChave(labelOpcao) : '';

  return catalogo.find((item) => {
    if (item.id === valor) return true;
    const chaveTitulo = normalizarChave(item.titulo);
    return chaveTitulo === chaveValor || (chaveLabel && chaveTitulo === chaveLabel);
  });
}

/** Ferragens marcadas nas perguntas do orçamento, enriquecidas com o catálogo (foto/descrição). */
export function resolverFerragensSelecionadas(
  respostas: Record<string, string | string[]>,
  perguntas: OrcamentoPergunta[],
  catalogo: OrcamentoCatalogoItem[],
): FerragemExibicao[] {
  const perguntaFerragens = perguntas.find(isPerguntaFerragens);
  if (!perguntaFerragens) return [];

  const selecionados = valoresSelecionados(respostas[perguntaFerragens.id]);
  if (selecionados.length === 0) return [];

  const catalogoFerragem = catalogo.filter((c) => c.categoria === 'ferragem' && c.ativo);
  const resultado: FerragemExibicao[] = [];

  for (const valor of selecionados) {
    const opcao = perguntaFerragens.opcoes?.find((o) => o.valor === valor);
    const catalogItem = encontrarNoCatalogo(valor, opcao?.label, catalogoFerragem);

    if (catalogItem) {
      resultado.push({
        titulo: catalogItem.titulo,
        descricao: catalogItem.descricao?.trim() ?? '',
        imagem_url: catalogItem.imagem_url?.trim() || undefined,
      });
      continue;
    }

    if (opcao) {
      resultado.push({
        titulo: opcao.label,
        descricao: '',
      });
    }
  }

  return resultado;
}

/** Classes Tailwind para distribuir N ferragens na tela. */
export function classesGridFerragens(quantidade: number, mobile: boolean): string {
  if (mobile) return 'grid-cols-1';
  if (quantidade <= 1) return 'grid-cols-1 max-w-sm mx-auto';
  if (quantidade === 2) return 'grid-cols-2';
  if (quantidade === 3) return 'grid-cols-3';
  if (quantidade === 4) return 'grid-cols-2 xl:grid-cols-4';
  if (quantidade === 5) return 'grid-cols-2 lg:grid-cols-3 xl:grid-cols-5';
  return 'grid-cols-2 lg:grid-cols-3';
}
