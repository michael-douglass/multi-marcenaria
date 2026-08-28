import type { MarkupCategoria, MarkupProduto } from '@/lib/markup-types';

/** Atributo no <html> enquanto a calculadora de markup está aberta (esconde zoom flutuante). */
export const MARKUP_CALCULATOR_OPEN_ATTR = 'data-markup-calculator-open';

/** Atributo no <html> enquanto o orçamento simples (PDF/JPG) está aberto. */
export const MARKUP_ORCAMENTO_SIMPLES_OPEN_ATTR = 'data-markup-orcamento-simples-open';

/** Rótulo de categoria igual ao da tela de Configurações (nome + subcategoria). */
export function formatarCategoriaMarkup(
  categoria: Pick<MarkupCategoria, 'nome' | 'subcategoria'> | null | undefined,
): string {
  if (!categoria?.nome) return '—';
  return categoria.subcategoria
    ? `${categoria.nome} (${categoria.subcategoria})`
    : categoria.nome;
}

export function rotuloCategoriaProdutoMarkup(
  produto: Pick<MarkupProduto, 'categoria'> | null | undefined,
): string {
  return formatarCategoriaMarkup(produto?.categoria);
}

/** Chave do card de categoria na aba Materiais (agrupa produtos no catálogo). */
export function chaveCardCatalogoMarkup(
  produto: Pick<MarkupProduto, 'categoria'> | null | undefined,
): string {
  const catNome = produto?.categoria?.nome ?? 'Outros';
  return produto?.categoria?.subcategoria
    ? `${catNome} — ${produto.categoria.subcategoria}`
    : catNome;
}

type ProdutoOrdenavel = Pick<MarkupProduto, 'id' | 'nome' | 'ordem'>;

/**
 * Ordena produtos de um card: usa ordem salva do lead, se existir;
 * senão, itens com quantidade > 0 sobem e o restante segue a ordem do catálogo.
 */
export function ordenarProdutosCardCatalogo<T extends ProdutoOrdenavel>(
  items: T[],
  ordemCustom?: readonly string[] | null,
  qtdPorProduto?: ReadonlyMap<string, number>,
): T[] {
  if (ordemCustom && ordemCustom.length > 0) {
    const rank = new Map(ordemCustom.map((id, i) => [id, i]));
    return [...items].sort((a, b) => {
      const ra = rank.get(a.id);
      const rb = rank.get(b.id);
      if (ra != null && rb != null && ra !== rb) return ra - rb;
      if (ra != null && rb == null) return -1;
      if (ra == null && rb != null) return 1;
      return (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR');
    });
  }

  return [...items].sort((a, b) => {
    const qa = qtdPorProduto?.get(a.id) ?? 0;
    const qb = qtdPorProduto?.get(b.id) ?? 0;
    const prioridadeA = qa > 0 ? 0 : 1;
    const prioridadeB = qb > 0 ? 0 : 1;
    if (prioridadeA !== prioridadeB) return prioridadeA - prioridadeB;
    return (a.ordem ?? 0) - (b.ordem ?? 0) || a.nome.localeCompare(b.nome, 'pt-BR');
  });
}

/** Aplica arraste de um produto dentro da lista completa do card. */
export function aplicarReordenacaoCatalogo(
  idsVisiveisNaOrdemAtual: readonly string[],
  activeId: string,
  overId: string,
): string[] | null {
  const oldIndex = idsVisiveisNaOrdemAtual.indexOf(activeId);
  const newIndex = idsVisiveisNaOrdemAtual.indexOf(overId);
  if (oldIndex < 0 || newIndex < 0 || oldIndex === newIndex) return null;

  const next = [...idsVisiveisNaOrdemAtual];
  const [moved] = next.splice(oldIndex, 1);
  if (!moved) return null;
  next.splice(newIndex, 0, moved);
  return next;
}

export function setMarkupCalculatorOpenFlag(open: boolean) {
  if (typeof document === 'undefined') return;
  if (open) {
    document.documentElement.setAttribute(MARKUP_CALCULATOR_OPEN_ATTR, 'true');
  } else {
    document.documentElement.removeAttribute(MARKUP_CALCULATOR_OPEN_ATTR);
  }
}

export function isMarkupCalculatorOpenFlag(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute(MARKUP_CALCULATOR_OPEN_ATTR) === 'true';
}

export function setMarkupOrcamentoSimplesOpenFlag(open: boolean) {
  if (typeof document === 'undefined') return;
  if (open) {
    document.documentElement.setAttribute(MARKUP_ORCAMENTO_SIMPLES_OPEN_ATTR, 'true');
  } else {
    document.documentElement.removeAttribute(MARKUP_ORCAMENTO_SIMPLES_OPEN_ATTR);
  }
}

export function isMarkupOrcamentoSimplesOpenFlag(): boolean {
  if (typeof document === 'undefined') return false;
  return document.documentElement.getAttribute(MARKUP_ORCAMENTO_SIMPLES_OPEN_ATTR) === 'true';
}
