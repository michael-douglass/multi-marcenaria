import type { MarkupCatalogProduct } from './markup-ia-prompts.ts';
import { casarProdutoNoCatalogo, deveAutoAceitarMatch } from './markup-match.ts';

export interface LinhaMaterialComposicao {
  produto_id: string;
  quantidade: number;
  origem_ia?: 'cortecloud' | 'projetista' | 'projetista_complemento' | 'documento';
}

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

export function buildCatalogLookupIndex(
  catalog: MarkupCatalogProduct[],
): Map<string, MarkupCatalogProduct> {
  const map = new Map<string, MarkupCatalogProduct>();
  for (const produto of catalog) {
    map.set(chaveCatalogo(produto.nome, produto.variacao), produto);
    map.set(normalizarTextoCatalogo(produto.nome), produto);
  }
  return map;
}

export function formatCatalogLookupTable(catalog: MarkupCatalogProduct[]): string {
  const linhas = catalog
    .filter((p) => p.preco_unitario != null)
    .map((p) => {
      const vari = p.variacao ? ` | VARI: ${p.variacao}` : '';
      return `- ${p.nome}${vari} → id: ${p.id} | R$ ${p.preco_unitario} | ${p.unidade}`;
    });
  return linhas.join('\n');
}

export function detectCortecloudContext(...textos: Array<string | undefined | null>): boolean {
  const texto = textos.filter(Boolean).join(' ').toLowerCase();
  return (
    texto.includes('cortecloud') ||
    texto.includes('corte cloud') ||
    texto.includes('orçamento corte') ||
    texto.includes('orcamento corte') ||
    texto.includes('planilha orçamento') ||
    texto.includes('planilha orcamento') ||
    // Sinais tabulares frequentes em PDFs de orçamento
    (texto.includes('quant') && (texto.includes('vari') || texto.includes('material'))) ||
    (texto.includes('chapas de mdf') && texto.includes('fita de borda'))
  );
}

export function contarLinhasMateriais(
  comodos: Array<{ moveis?: Array<{ linhas?: LinhaMaterialComposicao[] }> }>,
): number {
  let total = 0;
  for (const comodo of comodos ?? []) {
    for (const movel of comodo.moveis ?? []) {
      total += (movel.linhas ?? []).filter((l) => l.quantidade > 0).length;
    }
  }
  return total;
}

export function calcularSubtotalMateriais(
  comodos: Array<{ moveis?: Array<{ linhas?: LinhaMaterialComposicao[] }> }>,
  catalogById: Map<string, MarkupCatalogProduct>,
): number {
  let subtotal = 0;
  for (const comodo of comodos ?? []) {
    for (const movel of comodo.moveis ?? []) {
      for (const linha of movel.linhas ?? []) {
        const produto = catalogById.get(linha.produto_id);
        if (!produto?.preco_unitario) continue;
        subtotal += linha.quantidade * produto.preco_unitario;
      }
    }
  }
  return Math.round(subtotal * 100) / 100;
}

export function hashBase64Payload(dataUrlOrBase64: string): string {
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

type OpenAIImagePart = {
  type: 'image_url';
  image_url: { url: string; detail?: 'low' | 'high' | 'auto' };
};

export function deduplicateImageParts<T extends { type: string; image_url?: { url: string } }>(
  parts: T[],
): T[] {
  const seen = new Set<string>();
  const result: T[] = [];
  for (const part of parts) {
    if (part.type !== 'image_url' || !part.image_url?.url) {
      result.push(part);
      continue;
    }
    const hash = hashBase64Payload(part.image_url.url);
    if (seen.has(hash)) continue;
    seen.add(hash);
    result.push(part);
  }
  return result;
}

export function extrairSubtotalDocumento(texto: string): number | null {
  const padroes = [
    /subtotal\s*(?:de\s*)?materiais?[:\s]*r?\$?\s*([\d.,]+)/i,
    /materiais?\s*(?:total|subtotal)[:\s]*r?\$?\s*([\d.,]+)/i,
    /total\s*materiais?[:\s]*r?\$?\s*([\d.,]+)/i,
    /valor\s*total\s*(?:materiais?)?[:\s]*r?\$?\s*([\d.,]+)/i,
  ];
  for (const re of padroes) {
    const m = texto.match(re);
    if (m?.[1]) {
      const n = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
      if (Number.isFinite(n) && n > 0) return n;
    }
  }
  return null;
}

/** Referência de transcrição Cortecloud (método — quantidades vêm do QUANT do documento). */
export const CORTECLOUD_LINHAS_REFERENCIA = [
  { nome: 'MDF BRANCO', variacao: '15', quantidade: 2, secao: 'chapas' },
  { nome: 'MADEIRA', variacao: '15', quantidade: 2, secao: 'chapas' },
  { nome: 'CORREDIÇA OCULTA', variacao: '45', quantidade: 4, secao: 'ferragens' },
  { nome: 'DOBRADIÇA', variacao: 'RETA', quantidade: 20, secao: 'ferragens' },
  { nome: 'DOBRADIÇA', variacao: 'CURVA', quantidade: 10, secao: 'ferragens' },
  { nome: 'MDF BRANCO', variacao: '22', quantidade: 1, secao: 'fita' },
  { nome: 'MADEIRA', variacao: '22', quantidade: 3, secao: 'fita' },
] as const;

export function resolverProdutoNoCatalogo(
  nome: string,
  variacao: string | null,
  categoriaInventarioId: string,
  catalog: MarkupCatalogProduct[],
): MarkupCatalogProduct | undefined {
  const match = casarProdutoNoCatalogo(nome, variacao, catalog, {
    categoriaInventarioId,
  });
  if (!deveAutoAceitarMatch(match.confianca, match.produto) || !match.produto) return undefined;
  return catalog.find((p) => p.id === match.produto?.id);
}

export function mapearInventarioParaLinhas(
  inventario: Array<{
    categoria_id: string;
    itens: Array<{
      nome: string;
      variacao: string | null;
      status: string;
      quantidade?: number;
    }>;
  }>,
  catalog: MarkupCatalogProduct[],
  origemIa: LinhaMaterialComposicao['origem_ia'] = 'cortecloud',
): LinhaMaterialComposicao[] {
  const qtdPorProduto = new Map<string, number>();

  for (const cat of inventario) {
    for (const item of cat.itens) {
      const qtd = item.quantidade ?? 0;
      // Aceita QUANT > 0 mesmo se a IA errou o status (ex.: ausente_documento com qtd)
      const aproveitar =
        qtd > 0 &&
        item.status !== 'referencia_apenas' &&
        item.status !== 'nao_aplicavel';
      if (!aproveitar) continue;
      const produto = resolverProdutoNoCatalogo(
        item.nome,
        item.variacao,
        cat.categoria_id,
        catalog,
      );
      if (!produto) continue;
      qtdPorProduto.set(
        produto.id,
        (qtdPorProduto.get(produto.id) ?? 0) + qtd,
      );
    }
  }

  return Array.from(qtdPorProduto.entries()).map(([produto_id, quantidade]) => ({
    produto_id,
    quantidade,
    origem_ia: origemIa,
  }));
}

export function construirComodosDeInventario(
  linhas: LinhaMaterialComposicao[],
  nomeComodo = 'Orçamento Cortecloud',
  nomeMovel = 'Materiais do documento',
): Array<{ nome: string; moveis: Array<{ nome: string; linhas: LinhaMaterialComposicao[] }> }> {
  if (linhas.length === 0) return [];
  return [{
    nome: nomeComodo,
    moveis: [{ nome: nomeMovel, linhas }],
  }];
}

/**
 * Garante que todo item com status encontrado no inventário Cortecloud
 * esteja na composição com origem_ia cortecloud.
 */
export function garantirInventarioNaComposicao(
  parsed: {
    comodos: Array<{
      nome: string;
      moveis: Array<{ nome: string; linhas?: LinhaMaterialComposicao[] }>;
    }>;
  },
  inventario: Array<{
    categoria_id: string;
    itens: Array<{
      nome: string;
      variacao: string | null;
      status: string;
      quantidade?: number;
    }>;
  }>,
  catalog: MarkupCatalogProduct[],
): { comodos: typeof parsed.comodos; produtoIds: string[] } {
  const linhasInventario = mapearInventarioParaLinhas(inventario, catalog);
  if (linhasInventario.length === 0) {
    return { comodos: parsed.comodos, produtoIds: [] };
  }

  const produtoIds = linhasInventario.map((l) => l.produto_id);
  const linhaPorProduto = new Map<string, LinhaMaterialComposicao>();

  for (const comodo of parsed.comodos) {
    for (const movel of comodo.moveis ?? []) {
      for (const linha of movel.linhas ?? []) {
        linhaPorProduto.set(linha.produto_id, { ...linha });
      }
    }
  }

  for (const linha of linhasInventario) {
    const existente = linhaPorProduto.get(linha.produto_id);
    if (existente) {
      if (existente.quantidade < linha.quantidade) {
        existente.quantidade = linha.quantidade;
      }
      if (!existente.origem_ia) existente.origem_ia = linha.origem_ia ?? 'cortecloud';
      linhaPorProduto.set(linha.produto_id, existente);
    } else {
      linhaPorProduto.set(linha.produto_id, { ...linha });
    }
  }

  const comodos = parsed.comodos.map((c) => ({
    ...c,
    moveis: (c.moveis ?? []).map((m) => ({
      ...m,
      linhas: [...(m.linhas ?? [])],
    })),
  }));

  const nomeComodo = 'Orçamento Cortecloud';
  const nomeMovel = 'Materiais do documento';
  let comodo = comodos.find((c) => c.nome === nomeComodo);
  if (!comodo) {
    comodo = { nome: nomeComodo, moveis: [] };
    comodos.push(comodo);
  }
  let movel = comodo.moveis.find((m) => m.nome === nomeMovel);
  if (!movel) {
    movel = { nome: nomeMovel, linhas: [] };
    comodo.moveis.push(movel);
  }

  for (const linha of linhasInventario) {
    const merged = linhaPorProduto.get(linha.produto_id) ?? linha;
    const idx = movel.linhas!.findIndex((x) => x.produto_id === linha.produto_id);
    if (idx >= 0) {
      movel.linhas![idx] = merged;
    } else {
      movel.linhas!.push(merged);
    }
  }

  for (const comodo of comodos) {
    for (const movel of comodo.moveis ?? []) {
      movel.linhas = (movel.linhas ?? []).map((linha) => {
        const merged = linhaPorProduto.get(linha.produto_id);
        return merged ?? linha;
      });
    }
  }

  return { comodos, produtoIds };
}

/** Dica Cortecloud por categoria do checklist (Fase 1 inventariante). */
export function getCortecloudInventarioHint(categoriaId: string): string {
  switch (categoriaId) {
    case 'chapas_mdf':
      return `Seção CHAPAS / MDF: VARI 15/18/6 = espessura mm.
Transcreva o NOME COMERCIAL da coluna MATERIAL (ex.: Branco eucatex, Beige Matt Arauco, Freijo puro Duratex).
NÃO substitua por apelidos MDF BRANCO / ULTRA / MADEIRA se o PDF tiver marca.
Formato: {"nome":"Branco eucatex","variacao":"15mm","status":"encontrado","quantidade":N} com N = QUANT EXATO (some linhas iguais).
PROIBIDO inventar chapas sem QUANT > 0. NÃO invente 18 se o documento só tem 15 e/ou 6.`;
    case 'ferragens_corr_dobr':
      return `Seção FERRAGENS — PRIORIDADE MÁXIMA.
Procure DOBRADIÇA (VARI RETA/CURVA/S CURVA/GAFAN) e CORREDIÇA OCULTA ou TELES (VARI 25–45).
Formato: {"nome":"DOBRADIÇA","variacao":"RETA","status":"encontrado","quantidade":N}
Formato: {"nome":"CORREDIÇA OCULTA","variacao":"45","status":"encontrado","quantidade":N}
Se QUANT > 0 → status "encontrado". Nunca marque ausente_documento com quantidade positiva.
PROIBIDO pular dobradiças/corrediças. NÃO copie quantidades de exemplos.`;
    case 'fita_borda':
      return `Seção FITAS DE BORDA: VARI 22/35/64 = largura do rolo (NÃO é chapa).
Inclua SOMENTE linhas com QUANT > 0. Copie o nome comercial da fita (BRANCA, MADEIRA, NEUTRO, ESPECIAL).
Formato: {"nome":"MADEIRA","variacao":"22","status":"encontrado","quantidade":N}`;
    case 'outras_ferragens':
      return `Seção outras ferragens: puxadores, trilhos, dispositivos, TAB, RO82.
Transcreva o nome do documento com QUANT > 0. Não invente se não houver QUANT.`;
    case 'iluminacao':
      return `Seção iluminação: perfis de LED (RM-331, RM-330, RM-329) com QUANT > 0.`;
  }
  return '';
}

export function inventarioCategoriaTemEncontrado(
  inventario: Array<{ categoria_id: string; itens: Array<{ status: string; quantidade?: number }> }>,
  categoriaId: string,
): boolean {
  const cat = inventario.find((c) => c.categoria_id === categoriaId);
  return (cat?.itens ?? []).some((i) => i.status === 'encontrado' && (i.quantidade ?? 0) > 0);
}

export const CORTECLOUD_RETRY_PROMPT = `MODO TRANSCRIÇÃO CORTECLOUD — segunda tentativa.

IGNORE fotos de ambientes/renders para quantidades de materiais.
Leia SOMENTE a planilha "Orçamento Cortecloud" nas imagens anexadas.

Para CADA linha da planilha em que a coluna QUANT seja maior que zero:
1. Identifique MATERIAL + VARI (variação).
2. Encontre o produto_id correspondente na tabela de lookup abaixo (nome + variacao).
3. Use a quantidade EXATA da coluna QUANT — não estime, não arredonde, não invente.

PROIBIDO:
- Inventar materiais que não aparecem com QUANT > 0 na planilha.
- Usar fotos para estimar chapas, ferragens ou fitas.
- Incluir linha "SERVIÇO" ou totais do documento como material.
- Dividir por cômodos: use cômodo "Orçamento Cortecloud" e móvel "Materiais do documento".

Exemplo de transcrição correta (só formato — substitua N pelo QUANT real do PDF):
| MATERIAL | VARI | QUANT | → produto no catálogo |
| MDF BRANCO | 15 | N | MDF BRANCO variacao 15 |
| MADEIRA | 15 | N | MADEIRA variacao 15 |
| CORREDIÇA OCULTA | 45 | N | CORREDIÇA OCULTA variacao 45 |
| DOBRADIÇA | RETA | N | DOBRADIÇA variacao RETA |
| MDF BRANCO (fita) | 22 | N | MDF BRANCO variacao 22 (rolo fita) |
| MADEIRA (fita) | 22 | N | MADEIRA variacao 22 (rolo fita) |

PROIBIDO copiar quantidades de exemplos. Leia a coluna QUANT do documento anexado.

No resumo_texto informe:
- Subtotal de materiais calculado (soma qtd × preço do catálogo).
- Subtotal visível no documento (se houver).
- Lista de cada linha transcrita.

Retorne APENAS JSON válido no mesmo formato da composição (comodos, servicos, despesas, resumo_texto, itens_nao_catalogados).

--- TABELA DE LOOKUP (nome + variacao → produto_id) ---
{{catalogo_lookup}}`;
