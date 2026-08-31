import {
  casarProdutoNoCatalogo,
  criarItemExtraido,
  deveAutoAceitarMatch,
  type MarkupItemExtraido,
  type MarkupItemOrigemExtraida,
  type MarkupMatchCatalogItem,
} from '@/lib/markup-match';
import type { MarkupComposeIAResult, MarkupLinhaOrigemIA, MarkupProduto } from '@/lib/markup-types';

export function origemIaDeItem(origem: MarkupItemOrigemExtraida): MarkupLinhaOrigemIA {
  if (origem === 'projetista') return 'projetista';
  if (origem === 'cortecloud') return 'cortecloud';
  return 'documento';
}

function parseNaoCatalogado(texto: string): { nome: string; quantidade: number; especificacao: string | null } {
  const qtdMatch = texto.match(/(\d+(?:[.,]\d+)?)\s*[x×]\s*(.+)/i);
  if (qtdMatch) {
    const quantidade = parseFloat(qtdMatch[1].replace(',', '.'));
    return {
      nome: qtdMatch[2].trim(),
      quantidade: Number.isFinite(quantidade) ? quantidade : 1,
      especificacao: null,
    };
  }
  return { nome: texto.trim(), quantidade: 1, especificacao: null };
}

function chaveItem(nome: string, especificacao: string | null, quantidade: number): string {
  return `${nome.trim().toLowerCase()}|${(especificacao ?? '').toLowerCase()}|${quantidade}`;
}

/**
 * Monta a lista conferível a partir do resultado da IA.
 * Prefere `itens_extraidos` do servidor; se não vier, reconstrói do inventário + linhas + não catalogados.
 */
export function sintetizarItensExtraidos(
  resultado: MarkupComposeIAResult,
  produtos: MarkupProduto[],
): MarkupItemExtraido[] {
  if (resultado.itens_extraidos && resultado.itens_extraidos.length > 0) {
    return resultado.itens_extraidos.map((item) => ({
      ...item,
      status_revisao: item.status_revisao ?? (deveAutoAceitarMatch(item.confianca) ? 'aceito' : 'pendente'),
    }));
  }

  const catalog: MarkupMatchCatalogItem[] = produtos.map((p) => ({
    id: p.id,
    nome: p.nome,
    variacao: p.variacao,
    unidade: p.unidade,
  }));
  const produtoMap = new Map(produtos.map((p) => [p.id, p]));
  const seen = new Set<string>();
  const itens: MarkupItemExtraido[] = [];

  for (const cat of resultado.verificacao_categorias ?? []) {
    for (const [idx, item] of (cat.itens ?? []).entries()) {
      const qtd = item.quantidade ?? 0;
      if (qtd <= 0) continue;
      if (item.status === 'referencia_apenas' || item.status === 'nao_aplicavel') continue;
      const chave = chaveItem(item.nome, item.variacao, qtd);
      if (seen.has(chave)) continue;
      seen.add(chave);
      const match = casarProdutoNoCatalogo(item.nome, item.variacao, catalog, {
        categoriaInventarioId: cat.categoria_id,
      });
      itens.push(
        criarItemExtraido({
          id: `inv:${cat.categoria_id}:${idx}`,
          nome: item.nome,
          quantidade: qtd,
          especificacao: item.variacao,
          origem: 'pdf',
          match,
        }),
      );
    }
  }

  for (const comodo of resultado.comodos ?? []) {
    for (const movel of comodo.moveis ?? []) {
      for (const linha of movel.linhas ?? []) {
        const produto = produtoMap.get(linha.produto_id);
        if (!produto) continue;
        const chave = chaveItem(produto.nome, produto.variacao, linha.quantidade);
        if (seen.has(chave)) continue;
        seen.add(chave);
        const origem: MarkupItemOrigemExtraida =
          linha.origem_ia === 'projetista' || linha.origem_ia === 'projetista_complemento'
            ? 'projetista'
            : linha.origem_ia === 'documento'
              ? 'pdf'
              : 'cortecloud';
        itens.push({
          id: `linha:${linha.produto_id}`,
          nome: produto.nome,
          quantidade: linha.quantidade,
          especificacao: produto.variacao,
          unidade: produto.unidade,
          origem,
          produto_id: produto.id,
          confianca: 'alta',
          score: 1,
          alternativas: [],
          status_revisao: 'aceito',
        });
      }
    }
  }

  for (const [idx, texto] of (resultado.itens_nao_catalogados ?? []).entries()) {
    const parsed = parseNaoCatalogado(texto);
    const chave = chaveItem(parsed.nome, parsed.especificacao, parsed.quantidade);
    if (seen.has(chave)) continue;
    seen.add(chave);
    const match = casarProdutoNoCatalogo(parsed.nome, parsed.especificacao, catalog);
    itens.push(
      criarItemExtraido({
        id: `nc:${idx}`,
        nome: parsed.nome,
        quantidade: parsed.quantidade,
        especificacao: parsed.especificacao,
        origem: 'pdf',
        match,
      }),
    );
  }

  return itens;
}

export function aplicarRevisaoNaComposicao(
  resultado: MarkupComposeIAResult,
  itensRevisados: MarkupItemExtraido[],
): MarkupComposeIAResult {
  const aceitos = itensRevisados.filter(
    (item) => item.status_revisao === 'aceito' && item.produto_id && item.quantidade > 0,
  );

  const qtdPorProduto = new Map<string, { quantidade: number; origem_ia: MarkupLinhaOrigemIA }>();
  for (const item of aceitos) {
    const pid = item.produto_id!;
    const atual = qtdPorProduto.get(pid);
    const origem = origemIaDeItem(item.origem);
    if (atual) {
      atual.quantidade += item.quantidade;
    } else {
      qtdPorProduto.set(pid, { quantidade: item.quantidade, origem_ia: origem });
    }
  }

  const linhas = Array.from(qtdPorProduto.entries()).map(([produto_id, info]) => ({
    produto_id,
    quantidade: info.quantidade,
    origem_ia: info.origem_ia,
  }));

  const naoCatalogados = itensRevisados
    .filter((item) => item.status_revisao !== 'ignorado' && !item.produto_id)
    .map((item) => {
      const spec = item.especificacao ? ` ${item.especificacao}` : '';
      return `${item.quantidade}x ${item.nome}${spec}`.trim();
    });

  const nomeComodo = resultado.comodos?.[0]?.nome?.trim() || 'Ambiente';

  return {
    ...resultado,
    comodos:
      linhas.length > 0
        ? [
            {
              nome: nomeComodo,
              moveis: [{ nome: 'Materiais conferidos', linhas }],
            },
          ]
        : [],
    itens_nao_catalogados: naoCatalogados,
    itens_extraidos: itensRevisados,
    itens_processados: linhas.length,
  };
}

export function contarItensPorConfianca(itens: MarkupItemExtraido[]): {
  alta: number;
  media: number;
  baixa: number;
  nenhuma: number;
} {
  const cont = { alta: 0, media: 0, baixa: 0, nenhuma: 0 };
  for (const item of itens) {
    cont[item.confianca] += 1;
  }
  return cont;
}
