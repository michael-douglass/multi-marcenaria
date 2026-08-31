/**
 * Casamento de itens extraídos (PDF/foto) com o catálogo de markup.
 * Cópia da Edge — manter alinhada com src/lib/markup-match.ts.
 */

export type MarkupMatchConfianca = 'alta' | 'media' | 'baixa' | 'nenhuma';

export interface MarkupMatchCatalogItem {
  id: string;
  nome: string;
  variacao: string | null;
  unidade?: string | null;
}

export interface MarkupMatchAlternativa {
  produto_id: string;
  nome: string;
  variacao: string | null;
  score: number;
}

export interface MarkupMatchResultado {
  produto: MarkupMatchCatalogItem | null;
  confianca: MarkupMatchConfianca;
  score: number;
  alternativas: MarkupMatchAlternativa[];
}

export type MarkupItemOrigemExtraida = 'pdf' | 'imagem' | 'cortecloud' | 'projetista';

export interface MarkupItemExtraido {
  id: string;
  nome: string;
  quantidade: number;
  especificacao: string | null;
  unidade: string | null;
  origem: MarkupItemOrigemExtraida;
  produto_id: string | null;
  confianca: MarkupMatchConfianca;
  score: number;
  alternativas: MarkupMatchAlternativa[];
  status_revisao: 'pendente' | 'aceito' | 'ignorado';
}

const SCORE_ALTA = 0.92;
const SCORE_MEDIA = 0.72;
const SCORE_BAIXA = 0.5;
const EMPATE_DELTA = 0.05;

const UNIDADE_POR_CATEGORIA: Record<string, string> = {
  chapas_mdf: 'chapa',
  fita_borda: 'rolo',
};

export function normalizarTextoCatalogo(valor: string): string {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9/]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function chaveCatalogo(nome: string, variacao: string | null | undefined): string {
  const n = normalizarTextoCatalogo(nome);
  const v = variacao ? normalizarTextoCatalogo(variacao) : '';
  return v ? `${n}|${v}` : n;
}

export function distanciaLevenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;

  const prev = new Array<number>(b.length + 1);
  const curr = new Array<number>(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;

  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + custo);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

export function similaridadeTexto(a: string, b: string): number {
  const na = normalizarTextoCatalogo(a);
  const nb = normalizarTextoCatalogo(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  const dist = distanciaLevenshtein(na, nb);
  return 1 - dist / Math.max(na.length, nb.length);
}

function tokens(texto: string): string[] {
  return normalizarTextoCatalogo(texto)
    .split(' ')
    .filter((t) => t.length >= 2);
}

function jaccardTokens(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  if (ta.size === 0 && tb.size === 0) return 1;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const uniao = ta.size + tb.size - inter;
  return uniao === 0 ? 0 : inter / uniao;
}

function scoreCatalogo(
  nome: string,
  variacao: string | null,
  produto: MarkupMatchCatalogItem,
): number {
  const chaveQuery = chaveCatalogo(nome, variacao);
  const chaveProd = chaveCatalogo(produto.nome, produto.variacao);
  if (chaveQuery === chaveProd) return 1;

  const nomeScore = similaridadeTexto(nome, produto.nome);
  const tokenScore = jaccardTokens(
    `${nome} ${variacao ?? ''}`,
    `${produto.nome} ${produto.variacao ?? ''}`,
  );
  let varScore = 1;
  if (variacao && produto.variacao) {
    varScore = similaridadeTexto(variacao, produto.variacao);
  } else if (variacao && !produto.variacao) {
    const varNoNome = normalizarTextoCatalogo(produto.nome).includes(normalizarTextoCatalogo(variacao));
    varScore = varNoNome ? 0.9 : 0.65;
  }

  return Math.max(0, Math.min(1, nomeScore * 0.5 + tokenScore * 0.35 + varScore * 0.15));
}

function classificarConfianca(score: number, empatado: boolean): MarkupMatchConfianca {
  if (empatado && score >= SCORE_MEDIA) return 'media';
  if (score >= SCORE_ALTA) return 'alta';
  if (score >= SCORE_MEDIA) return 'media';
  if (score >= SCORE_BAIXA) return 'baixa';
  return 'nenhuma';
}

export function casarProdutoNoCatalogo(
  nome: string,
  variacao: string | null,
  catalog: MarkupMatchCatalogItem[],
  options?: { categoriaInventarioId?: string },
): MarkupMatchResultado {
  const vazio: MarkupMatchResultado = {
    produto: null,
    confianca: 'nenhuma',
    score: 0,
    alternativas: [],
  };
  if (!nome.trim() || catalog.length === 0) return vazio;

  const chave = chaveCatalogo(nome, variacao);
  const exatos = catalog.filter((p) => chaveCatalogo(p.nome, p.variacao) === chave);
  if (exatos.length === 1) {
    return { produto: exatos[0], confianca: 'alta', score: 1, alternativas: [] };
  }
  if (exatos.length > 1) {
    const unidade = options?.categoriaInventarioId
      ? UNIDADE_POR_CATEGORIA[options.categoriaInventarioId]
      : undefined;
    const porUnidade = unidade ? exatos.find((p) => p.unidade === unidade) : undefined;
    const escolhido = porUnidade ?? exatos[0];
    return {
      produto: escolhido,
      confianca: 'alta',
      score: 1,
      alternativas: exatos
        .filter((p) => p.id !== escolhido.id)
        .map((p) => ({
          produto_id: p.id,
          nome: p.nome,
          variacao: p.variacao,
          score: 1,
        })),
    };
  }

  if (!variacao) {
    const soNome = catalog.filter(
      (p) => normalizarTextoCatalogo(p.nome) === normalizarTextoCatalogo(nome),
    );
    if (soNome.length === 1) {
      return { produto: soNome[0], confianca: 'alta', score: 0.97, alternativas: [] };
    }
  }

  const ranqueados = catalog
    .map((p) => ({ produto: p, score: scoreCatalogo(nome, variacao, p) }))
    .sort((a, b) => b.score - a.score);

  const melhor = ranqueados[0];
  if (!melhor || melhor.score < SCORE_BAIXA) return vazio;

  const segundo = ranqueados[1];
  const empatado = Boolean(segundo && melhor.score - segundo.score < EMPATE_DELTA);

  const alternativas = ranqueados
    .slice(1, 4)
    .filter((r) => r.score >= SCORE_BAIXA)
    .map((r) => ({
      produto_id: r.produto.id,
      nome: r.produto.nome,
      variacao: r.produto.variacao,
      score: Math.round(r.score * 1000) / 1000,
    }));

  const confianca = classificarConfianca(melhor.score, empatado);

  return {
    produto: confiancaEhSugerivel(confianca) ? melhor.produto : null,
    confianca,
    score: Math.round(melhor.score * 1000) / 1000,
    alternativas,
  };
}

export function confiancaEhSugerivel(confianca: MarkupMatchConfianca): boolean {
  return confianca === 'alta' || confianca === 'media' || confianca === 'baixa';
}

export function deveAutoAceitarMatch(confianca: MarkupMatchConfianca): boolean {
  return confianca === 'alta';
}

export function criarItemExtraido(input: {
  id: string;
  nome: string;
  quantidade: number;
  especificacao?: string | null;
  unidade?: string | null;
  origem: MarkupItemOrigemExtraida;
  match: MarkupMatchResultado;
}): MarkupItemExtraido {
  const auto = deveAutoAceitarMatch(input.match.confianca) && Boolean(input.match.produto);
  return {
    id: input.id,
    nome: input.nome,
    quantidade: Math.max(0, input.quantidade),
    especificacao: input.especificacao?.trim() || null,
    unidade: input.unidade?.trim() || input.match.produto?.unidade || null,
    origem: input.origem,
    produto_id: input.match.produto?.id ?? null,
    confianca: input.match.confianca,
    score: input.match.score,
    alternativas: input.match.alternativas,
    status_revisao: auto ? 'aceito' : 'pendente',
  };
}

export function mapearInventarioParaItensExtraidos(
  inventario: Array<{
    categoria_id: string;
    itens: Array<{
      nome: string;
      variacao: string | null;
      status: string;
      quantidade?: number;
    }>;
  }>,
  catalog: MarkupMatchCatalogItem[],
  origem: MarkupItemOrigemExtraida,
): MarkupItemExtraido[] {
  const itens: MarkupItemExtraido[] = [];
  for (const cat of inventario) {
    for (const [idx, item] of cat.itens.entries()) {
      const qtd = item.quantidade ?? 0;
      if (
        qtd <= 0 ||
        item.status === 'referencia_apenas' ||
        item.status === 'nao_aplicavel'
      ) {
        continue;
      }
      const match = casarProdutoNoCatalogo(item.nome, item.variacao, catalog, {
        categoriaInventarioId: cat.categoria_id,
      });
      itens.push(
        criarItemExtraido({
          id: `inv:${cat.categoria_id}:${idx}`,
          nome: item.nome,
          quantidade: qtd,
          especificacao: item.variacao,
          origem,
          match,
        }),
      );
    }
  }
  return itens;
}
