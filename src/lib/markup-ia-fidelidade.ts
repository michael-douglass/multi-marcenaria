/**
 * Inventário de fidelidade do markup — mesmo espírito do YAML do render:
 * copiar o documento, não inventar móvel. Saída no idioma do catálogo.
 */

import { casarProdutoNoCatalogo } from '@/lib/markup-match';
import type { MarkupIAVerificacaoCategoriaResultado } from '@/lib/markup-ia-verificacao';

export interface MarkupIAFidelidadeModulo {
  posicao: number;
  tipo: string;
  largura_relativa_pct: number | null;
  detalhes: string | null;
}

export interface MarkupIAFidelidadeCor {
  hex: string | null;
  name: string;
  uso: string;
}

export interface MarkupIAFidelidadeHardware {
  nome: string;
  quantidade: number | null;
  variacao: string | null;
}

export interface MarkupIAFidelidadeMovel {
  nome_tipo: string;
  comodo: string;
  vista: string;
  silhueta: string;
  modulos: MarkupIAFidelidadeModulo[];
  color_scheme: MarkupIAFidelidadeCor[];
  materiais_aparentes: string;
  hardware: MarkupIAFidelidadeHardware[];
}

export interface MarkupIAFidelidadeInventario {
  paginas_lidas: number;
  paginas_texto: number;
  tipo_documento: string;
  chapas_especiais_solicitadas: boolean;
  nomes_chapas_especiais: string[];
  nao_adicionar: string[];
  moveis: MarkupIAFidelidadeMovel[];
  quantitativo_resumo: string;
}

export interface MarkupFidelidadeCatalogItem {
  id: string;
  nome: string;
  variacao: string | null;
  unidade?: string | null;
  preco_unitario?: number | null;
}

const TOKENS_CHAPA_ESPECIAL = ['ULTRA', 'NEUTRO', 'ESPECIAL'];

export const MARKUP_IA_FIDELIDADE_PROMPT = `Você está LENDO o projeto do lead — não criando um móvel novo.

Mesmo espírito do render fotorrealista: se houver dúvida entre ficar fiel ao documento ou ficar “completo/bonito”, escolha FIDELIDADE.

Leia TODAS as páginas do texto nativo (--- Página N ---) e as imagens. Conte QUANT de tudo que o documento listar.

REGRAS INVIOLÁVEIS:
- Mesma quantidade de módulos, portas, gavetas e prateleiras do documento/esboço
- Copie nomes comerciais (Branco eucatex, Beige Matt Arauco, Freijo…) — não troque por apelido MDF BRANCO/ULTRA se o PDF tiver marca
- Se o documento NÃO pedir chapa especial (ULTRA, NEUTRO, fita ESPECIAL), marque chapas_especiais_solicitadas: false e coloque ULTRA/NEUTRO/ESPECIAL em nao_adicionar
- Hardware (puxador, trilho, dobradiça, parafuso, LED): só o que aparecer com QUANT ou estiver visível/listado. NÃO invente parafuso se não estiver no papel nem no catálogo
- nao_adicionar = lista explícita do que NÃO está no projeto

Retorne APENAS JSON (sem markdown):
{
  "paginas_lidas": 0,
  "tipo_documento": "planilha|esboco|misto",
  "chapas_especiais_solicitadas": false,
  "nomes_chapas_especiais": [],
  "nao_adicionar": ["ULTRA", "pessoas", "plantas"],
  "quantitativo_resumo": "1–2 frases: o que foi contado",
  "moveis": [
    {
      "nome_tipo": "guarda-roupa",
      "comodo": "quarto",
      "vista": "frontal",
      "silhueta": "largura × altura aparente",
      "modulos": [
        { "posicao": 1, "tipo": "porta", "largura_relativa_pct": 50, "detalhes": "puxador" }
      ],
      "color_scheme": [{ "hex": null, "name": "Branco eucatex", "uso": "corpo" }],
      "materiais_aparentes": "não indicado",
      "hardware": [{ "nome": "DOBRADIÇA", "quantidade": 8, "variacao": "RETA" }]
    }
  ]
}

Lead: {{nome_lead}}
Análise prévia: {{analise}}
`;

export function nomeIndicaChapaEspecial(nome: string): boolean {
  const n = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
  return TOKENS_CHAPA_ESPECIAL.some((token) => {
    const re = new RegExp(`(^|[^A-Z0-9])${token}([^A-Z0-9]|$)`);
    return re.test(n);
  });
}

export function documentoSolicitaChapaEspecial(
  fidelidade: MarkupIAFidelidadeInventario | null,
  textoNativo: string,
): boolean {
  if (fidelidade?.chapas_especiais_solicitadas) return true;
  if ((fidelidade?.nomes_chapas_especiais ?? []).some((n) => nomeIndicaChapaEspecial(n))) {
    return true;
  }
  const linhas = textoNativo.split(/\r?\n/);
  for (const linha of linhas) {
    const upper = linha.toUpperCase();
    const temQuant = /\bQUANT\b/.test(upper) || /\bQTD\b/.test(upper) || /\b\d+\s*(CHAPA|UN|PC|PÇ)/.test(upper);
    if (!temQuant) continue;
    if (nomeIndicaChapaEspecial(linha)) return true;
  }
  return false;
}

export function contarPaginasTextoNativo(texto: string): number {
  const marcas = texto.match(/--- Página \d+ ---/g);
  return marcas?.length ?? 0;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseModulo(raw: unknown, index: number): MarkupIAFidelidadeModulo {
  const o = asRecord(raw) ?? {};
  const pct = Number(o.largura_relativa_pct);
  return {
    posicao: Number(o.posicao) || index + 1,
    tipo: String(o.tipo ?? 'nicho').trim() || 'nicho',
    largura_relativa_pct: Number.isFinite(pct) ? pct : null,
    detalhes: o.detalhes != null ? String(o.detalhes) : null,
  };
}

function parseHardware(raw: unknown): MarkupIAFidelidadeHardware {
  const o = asRecord(raw) ?? {};
  const qtd = Number(o.quantidade);
  return {
    nome: String(o.nome ?? '').trim(),
    quantidade: Number.isFinite(qtd) && qtd > 0 ? qtd : null,
    variacao: o.variacao != null ? String(o.variacao) : null,
  };
}

function parseMovel(raw: unknown): MarkupIAFidelidadeMovel {
  const o = asRecord(raw) ?? {};
  const modulos = Array.isArray(o.modulos) ? o.modulos.map(parseModulo) : [];
  const cores = Array.isArray(o.color_scheme)
    ? o.color_scheme.map((c) => {
        const cr = asRecord(c) ?? {};
        return {
          hex: cr.hex != null && String(cr.hex).trim() ? String(cr.hex) : null,
          name: String(cr.name ?? '').trim() || 'não identificado',
          uso: String(cr.uso ?? cr.superficie ?? 'corpo'),
        };
      })
    : [];
  const hardware = Array.isArray(o.hardware)
    ? o.hardware.map(parseHardware).filter((h) => Boolean(h.nome))
    : [];
  return {
    nome_tipo: String(o.nome_tipo ?? o.nome ?? 'móvel').trim() || 'móvel',
    comodo: String(o.comodo ?? o.comodo_provavel ?? 'não identificado').trim(),
    vista: String(o.vista ?? 'frontal').trim(),
    silhueta: String(o.silhueta ?? '').trim(),
    modulos,
    color_scheme: cores,
    materiais_aparentes: String(o.materiais_aparentes ?? 'não indicado'),
    hardware,
  };
}

export function parseFidelidadeJson(
  raw: string,
  paginasImagem: number,
  paginasTexto: number,
): MarkupIAFidelidadeInventario | null {
  let text = raw.trim();
  const fence = text.match(/```(?:json|yaml)?\s*([\s\S]*?)```/i);
  if (fence) text = fence[1].trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start < 0 || end <= start) return null;
  try {
    const parsed = JSON.parse(text.slice(start, end + 1)) as unknown;
    const o = asRecord(parsed);
    if (!o) return null;
    const moveisRaw = Array.isArray(o.moveis) ? o.moveis : [];
    const especiais = Array.isArray(o.nomes_chapas_especiais)
      ? o.nomes_chapas_especiais.map((n) => String(n))
      : [];
    const nao = Array.isArray(o.nao_adicionar) ? o.nao_adicionar.map((n) => String(n)) : [];
    const paginasLidas = Number(o.paginas_lidas);
    return {
      paginas_lidas: Number.isFinite(paginasLidas) && paginasLidas > 0 ? paginasLidas : paginasImagem,
      paginas_texto: paginasTexto,
      tipo_documento: String(o.tipo_documento ?? 'misto'),
      chapas_especiais_solicitadas: o.chapas_especiais_solicitadas === true,
      nomes_chapas_especiais: especiais,
      nao_adicionar: nao,
      moveis: moveisRaw.map(parseMovel),
      quantitativo_resumo: String(o.quantitativo_resumo ?? '').trim(),
    };
  } catch {
    return null;
  }
}

export function fidelidadeFallback(
  paginasImagem: number,
  paginasTexto: number,
): MarkupIAFidelidadeInventario {
  return {
    paginas_lidas: paginasImagem,
    paginas_texto: paginasTexto,
    tipo_documento: 'misto',
    chapas_especiais_solicitadas: false,
    nomes_chapas_especiais: [],
    nao_adicionar: ['ULTRA', 'NEUTRO', 'ESPECIAL', 'pessoas', 'plantas', 'decoração'],
    moveis: [],
    quantitativo_resumo: 'Leitura de fidelidade indisponível — inventário segue o documento.',
  };
}

export function contarModulosPorTipo(
  fidelidade: MarkupIAFidelidadeInventario | null,
  tipo: string,
): number {
  if (!fidelidade) return 0;
  const alvo = tipo.toLowerCase();
  let total = 0;
  for (const movel of fidelidade.moveis) {
    for (const modulo of movel.modulos) {
      if (modulo.tipo.toLowerCase().includes(alvo)) total += 1;
    }
  }
  return total;
}

export function filtrarChapasEspeciaisDoInventario(
  inventario: MarkupIAVerificacaoCategoriaResultado[],
  permitirEspeciais: boolean,
): MarkupIAVerificacaoCategoriaResultado[] {
  if (permitirEspeciais) return inventario;
  return inventario.map((cat) => ({
    ...cat,
    itens: (cat.itens ?? []).map((item) => {
      if (!nomeIndicaChapaEspecial(item.nome)) return item;
      if ((item.quantidade ?? 0) <= 0) return item;
      return {
        ...item,
        quantidade: 0,
        status: 'referencia_apenas' as const,
        motivo: 'Chapa especial não solicitada no documento — não entra no markup.',
      };
    }),
  }));
}

function categoriaTemEncontrado(
  inventario: MarkupIAVerificacaoCategoriaResultado[],
  categoriaId: string,
  trechoNome: string,
): boolean {
  const cat = inventario.find((c) => c.categoria_id === categoriaId);
  const alvo = trechoNome.toUpperCase();
  return (cat?.itens ?? []).some(
    (i) =>
      i.status === 'encontrado' &&
      (i.quantidade ?? 0) > 0 &&
      i.nome.toUpperCase().includes(alvo),
  );
}

function upsertItem(
  inventario: MarkupIAVerificacaoCategoriaResultado[],
  categoriaId: string,
  nomeCat: string,
  item: {
    item_id: string;
    nome: string;
    variacao: string | null;
    quantidade: number;
    motivo: string;
  },
): MarkupIAVerificacaoCategoriaResultado[] {
  const next = inventario.map((c) => ({ ...c, itens: [...(c.itens ?? [])] }));
  let cat = next.find((c) => c.categoria_id === categoriaId);
  if (!cat) {
    cat = { categoria_id: categoriaId, nome: nomeCat, itens: [] };
    next.push(cat);
  }
  const idx = cat.itens.findIndex(
    (i) =>
      i.nome.toUpperCase() === item.nome.toUpperCase() &&
      (i.variacao ?? '') === (item.variacao ?? ''),
  );
  if (idx >= 0) {
    const atual = cat.itens[idx];
    if ((atual.quantidade ?? 0) > 0 && atual.status === 'encontrado') return next;
    cat.itens[idx] = {
      ...atual,
      status: 'encontrado',
      quantidade: item.quantidade,
      motivo: item.motivo,
    };
    return next;
  }
  cat.itens.push({
    item_id: item.item_id,
    nome: item.nome,
    variacao: item.variacao,
    status: 'encontrado',
    quantidade: item.quantidade,
    motivo: item.motivo,
  });
  return next;
}

/**
 * Sem planilha Cortecloud: completa ferragens a partir do YAML (portas→dobradiças, gavetas→corrediças)
 * e hardware listado. Nunca inventa se o catálogo não tiver o SKU com preço.
 */
export function mesclarFerragensDeFidelidade(
  inventario: MarkupIAVerificacaoCategoriaResultado[],
  fidelidade: MarkupIAFidelidadeInventario | null,
  catalog: MarkupFidelidadeCatalogItem[],
  modoCortecloud: boolean,
): MarkupIAVerificacaoCategoriaResultado[] {
  if (!fidelidade || modoCortecloud) return inventario;
  let next = inventario;

  const portas = contarModulosPorTipo(fidelidade, 'porta');
  const gavetas = contarModulosPorTipo(fidelidade, 'gaveta');

  if (portas > 0 && !categoriaTemEncontrado(next, 'ferragens_corr_dobr', 'DOBRADI')) {
    const match = casarProdutoNoCatalogo('DOBRADIÇA', 'RETA', catalog);
    if (match.produto && (match.produto.preco_unitario ?? 0) > 0) {
      next = upsertItem(next, 'ferragens_corr_dobr', 'Ferragens', {
        item_id: 'dobradica_fidelidade',
        nome: match.produto.nome,
        variacao: match.produto.variacao,
        quantidade: portas * 2,
        motivo: `Estimativa fiel: ${portas} porta(s) × 2 dobradiças`,
      });
    }
  }

  if (gavetas > 0 && !categoriaTemEncontrado(next, 'ferragens_corr_dobr', 'CORREDI')) {
    const match = casarProdutoNoCatalogo('CORREDIÇA OCULTA', '45', catalog);
    const fallback = match.produto ?? casarProdutoNoCatalogo('CORREDIÇA', null, catalog).produto;
    if (fallback && (fallback.preco_unitario ?? 0) > 0) {
      next = upsertItem(next, 'ferragens_corr_dobr', 'Ferragens', {
        item_id: 'corredica_fidelidade',
        nome: fallback.nome,
        variacao: fallback.variacao,
        quantidade: gavetas,
        motivo: `Estimativa fiel: ${gavetas} gaveta(s) → corrediças`,
      });
    }
  }

  for (const movel of fidelidade.moveis) {
    for (const hw of movel.hardware) {
      if (!hw.nome || (hw.quantidade ?? 0) <= 0) continue;
      const match = casarProdutoNoCatalogo(hw.nome, hw.variacao, catalog);
      if (!match.produto || (match.produto.preco_unitario ?? 0) <= 0) {
        next = upsertItem(next, 'outras_ferragens', 'Outras ferragens', {
          item_id: `hw_${hw.nome}`.toLowerCase().replace(/\s+/g, '_'),
          nome: hw.nome,
          variacao: hw.variacao,
          quantidade: hw.quantidade ?? 0,
          motivo: 'Listado no projeto — conferir cadastro (sem SKU com preço).',
        });
        continue;
      }
      const catId = /dobradi|corredi|pistao|pistão/i.test(hw.nome)
        ? 'ferragens_corr_dobr'
        : /led|rm-3|ilumin/i.test(hw.nome)
          ? 'iluminacao'
          : 'outras_ferragens';
      next = upsertItem(next, catId, catId, {
        item_id: `hw_${match.produto.id}`,
        nome: match.produto.nome,
        variacao: match.produto.variacao,
        quantidade: hw.quantidade ?? 0,
        motivo: 'Hardware listado no inventário de fidelidade',
      });
    }
  }

  return next;
}

export function runMarkupFidelidadeSelfTests(): { ok: true } | { ok: false; erro: string } {
  if (!nomeIndicaChapaEspecial('ULTRA 15')) {
    return { ok: false, erro: 'ULTRA deveria ser especial' };
  }
  if (nomeIndicaChapaEspecial('Branco eucatex 15mm')) {
    return { ok: false, erro: 'eucatex não é especial' };
  }
  const inv: MarkupIAVerificacaoCategoriaResultado[] = [
    {
      categoria_id: 'chapas_mdf',
      nome: 'Chapas',
      itens: [
        { item_id: 'u', nome: 'ULTRA', variacao: '15', status: 'encontrado', quantidade: 3 },
        { item_id: 'b', nome: 'Branco eucatex', variacao: '15', status: 'encontrado', quantidade: 4 },
      ],
    },
  ];
  const filtrado = filtrarChapasEspeciaisDoInventario(inv, false);
  const ultra = filtrado[0].itens.find((i) => i.nome === 'ULTRA');
  const branco = filtrado[0].itens.find((i) => i.nome === 'Branco eucatex');
  if (ultra?.quantidade !== 0 || ultra.status !== 'referencia_apenas') {
    return { ok: false, erro: 'ULTRA deveria ser zerada' };
  }
  if (branco?.quantidade !== 4) {
    return { ok: false, erro: 'SKU comercial não deveria ser filtrado' };
  }
  return { ok: true };
}
