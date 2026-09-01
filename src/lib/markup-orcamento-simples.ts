/** Modelo e totais da folha comercial (orçamento simples) do markup. */

import { addDays, format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { arredondar } from '@/lib/markup-calculo';
import type {
  MarkupOrcamento,
  MarkupOrcamentoSimples,
  MarkupOrcamentoSimplesDescontoTipo,
  MarkupOrcamentoSimplesFoto,
  MarkupOrcamentoSimplesItem,
} from '@/lib/markup-types';

export const MARKUP_ORCAMENTO_SIMPLES_MAX_FOTOS = 18;
export const MARKUP_ORCAMENTO_SIMPLES_MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MARKUP_ORCAMENTO_SIMPLES_VALIDADE_PADRAO = 15;
export const MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX = 794;
export const MARKUP_ORCAMENTO_SIMPLES_ALTURA_MIN_PX = 1123;
export const MARKUP_ORCAMENTO_SIMPLES_TIPOS_UPLOAD = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

export interface MarkupOrcamentoSimplesTotais {
  subtotal_centavos: number;
  desconto_centavos: number;
  total_centavos: number;
}

export function reaisParaCentavos(valor: number): number {
  const n = Number(valor);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(arredondar(n) * 100);
}

export function centavosParaReais(centavos: number): number {
  return arredondar(Math.max(0, Math.round(centavos) || 0) / 100);
}

/** Aceita "78.082,11", "78082,11" ou "78082.11". */
export function parseMoedaBrParaCentavos(texto: string): number {
  const bruto = texto.trim();
  if (!bruto) return 0;
  const limpo = bruto.replace(/[^\d,.-]/g, '');
  if (!limpo) return 0;
  const temVirgula = limpo.includes(',');
  const normalizado = temVirgula
    ? limpo.replace(/\./g, '').replace(',', '.')
    : limpo.replace(/,/g, '');
  const n = Number(normalizado);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

export function novoIdOrcamentoSimples(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `os-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function criarItemOrcamentoSimples(
  descricao: string,
  unitarioCentavos: number,
  quantidade = 1,
): MarkupOrcamentoSimplesItem {
  return {
    id: novoIdOrcamentoSimples(),
    descricao: descricao.trim() || 'Item',
    quantidade: Math.max(0, Number(quantidade) || 0),
    unitario_centavos: Math.max(0, Math.round(unitarioCentavos) || 0),
  };
}

export function criarOrcamentoSimplesPadrao(orcamento: Pick<MarkupOrcamento, 'titulo' | 'preco_final'>): MarkupOrcamentoSimples {
  const titulo = orcamento.titulo.trim() || 'Orçamento';
  return {
    titulo,
    itens: [criarItemOrcamentoSimples(titulo, reaisParaCentavos(orcamento.preco_final), 1)],
    desconto_tipo: 'percent',
    desconto_valor: 0,
    validade_dias: MARKUP_ORCAMENTO_SIMPLES_VALIDADE_PADRAO,
    fotos: [],
    observacoes: '',
  };
}

function lerItem(raw: unknown): MarkupOrcamentoSimplesItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const descricao = typeof row.descricao === 'string' ? row.descricao : '';
  const quantidade = Number(row.quantidade);
  const unitario = Number(row.unitario_centavos);
  return {
    id: typeof row.id === 'string' && row.id ? row.id : novoIdOrcamentoSimples(),
    descricao,
    quantidade: Number.isFinite(quantidade) ? Math.max(0, quantidade) : 0,
    unitario_centavos: Number.isFinite(unitario) ? Math.max(0, Math.round(unitario)) : 0,
  };
}

function lerFoto(raw: unknown): MarkupOrcamentoSimplesFoto | null {
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const url = typeof row.url === 'string' ? row.url.trim() : '';
  if (!url) return null;
  const origem = row.origem === 'local' ? 'local' : 'lead';
  if (origem === 'local' && !url.startsWith('data:')) return null;
  return {
    id: typeof row.id === 'string' && row.id ? row.id : novoIdOrcamentoSimples(),
    url,
    origem,
  };
}

export function normalizarOrcamentoSimples(
  raw: unknown,
  fallback: Pick<MarkupOrcamento, 'titulo' | 'preco_final'>,
): MarkupOrcamentoSimples {
  const padrao = criarOrcamentoSimplesPadrao(fallback);
  if (!raw || typeof raw !== 'object') return padrao;
  const row = raw as Record<string, unknown>;
  const itens = Array.isArray(row.itens)
    ? row.itens.map(lerItem).filter((item): item is MarkupOrcamentoSimplesItem => item != null)
    : [];
  const tipo: MarkupOrcamentoSimplesDescontoTipo =
    row.desconto_tipo === 'reais' ? 'reais' : 'percent';
  const validade = Number(row.validade_dias);
  const fotos = Array.isArray(row.fotos)
    ? row.fotos
        .map(lerFoto)
        .filter((foto): foto is MarkupOrcamentoSimplesFoto => foto != null)
        .slice(0, MARKUP_ORCAMENTO_SIMPLES_MAX_FOTOS)
    : [];

  return {
    titulo: typeof row.titulo === 'string' && row.titulo.trim() ? row.titulo.trim() : padrao.titulo,
    itens: itens.length > 0 ? itens : padrao.itens,
    desconto_tipo: tipo,
    desconto_valor: Number.isFinite(Number(row.desconto_valor))
      ? Math.max(0, Number(row.desconto_valor))
      : 0,
    validade_dias: Number.isFinite(validade) ? Math.max(1, Math.round(validade)) : padrao.validade_dias,
    fotos,
    observacoes: typeof row.observacoes === 'string' ? row.observacoes : '',
  };
}

export function calcularTotaisOrcamentoSimples(
  doc: MarkupOrcamentoSimples,
): MarkupOrcamentoSimplesTotais {
  const subtotal_centavos = doc.itens.reduce((acc, item) => {
    const qtd = Math.max(0, Number(item.quantidade) || 0);
    const unit = Math.max(0, Math.round(item.unitario_centavos) || 0);
    return acc + Math.round(qtd * unit);
  }, 0);

  let desconto_centavos = 0;
  if (doc.desconto_tipo === 'percent') {
    const pct = Math.min(100, Math.max(0, Number(doc.desconto_valor) || 0));
    desconto_centavos = Math.round(subtotal_centavos * (pct / 100));
  } else {
    desconto_centavos = Math.min(
      subtotal_centavos,
      Math.max(0, Math.round(Number(doc.desconto_valor) || 0)),
    );
  }

  return {
    subtotal_centavos,
    desconto_centavos,
    total_centavos: Math.max(0, subtotal_centavos - desconto_centavos),
  };
}

/** Fotos locais (data URL) não entram no banco. */
export function fotosPersistiveisOrcamentoSimples(
  fotos: MarkupOrcamentoSimplesFoto[],
): MarkupOrcamentoSimplesFoto[] {
  return fotos.filter((foto) => foto.origem === 'lead' && foto.url && !foto.url.startsWith('data:'));
}

export function documentoPersistivelOrcamentoSimples(
  doc: MarkupOrcamentoSimples,
): MarkupOrcamentoSimples {
  return {
    ...doc,
    titulo: doc.titulo.trim() || 'Orçamento',
    itens: doc.itens.length > 0 ? doc.itens : criarOrcamentoSimplesPadrao({ titulo: doc.titulo, preco_final: 0 }).itens,
    fotos: fotosPersistiveisOrcamentoSimples(doc.fotos).slice(0, MARKUP_ORCAMENTO_SIMPLES_MAX_FOTOS),
    observacoes: doc.observacoes.trim(),
    validade_dias: Math.max(1, Math.round(doc.validade_dias) || MARKUP_ORCAMENTO_SIMPLES_VALIDADE_PADRAO),
  };
}

export function dataValidadeOrcamentoSimples(validadeDias: number, hoje = new Date()): Date {
  return addDays(hoje, Math.max(1, Math.round(validadeDias) || MARKUP_ORCAMENTO_SIMPLES_VALIDADE_PADRAO));
}

export function formatarDataOrcamentoSimples(data: Date): string {
  return format(data, "d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

export function slugArquivoOrcamentoSimples(titulo: string): string {
  const slug = titulo
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 48);
  return slug || 'proposta';
}

export function nomeArquivoOrcamentoSimples(titulo: string, extensao: 'pdf' | 'jpg', hoje = new Date()): string {
  return `orcamento-${slugArquivoOrcamentoSimples(titulo)}-${format(hoje, 'yyyy-MM-dd')}.${extensao}`;
}

export function colunasGaleriaOrcamentoSimples(qtd: number): 1 | 2 | 3 {
  if (qtd <= 1) return 1;
  if (qtd === 2) return 2;
  return 3;
}
