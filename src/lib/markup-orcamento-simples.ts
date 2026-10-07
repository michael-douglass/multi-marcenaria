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
/** Largura da folha A4 em 96 DPI (210 mm). */
export const MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX = 794;
/** Altura exata da folha A4 em 96 DPI (297 mm) — cada página usa este valor fixo. */
export const MARKUP_ORCAMENTO_SIMPLES_ALTURA_PX = 1123;
/** @deprecated Use MARKUP_ORCAMENTO_SIMPLES_ALTURA_PX (altura fixa da página). */
export const MARKUP_ORCAMENTO_SIMPLES_ALTURA_MIN_PX = MARKUP_ORCAMENTO_SIMPLES_ALTURA_PX;
export const MARKUP_ORCAMENTO_SIMPLES_TIPOS_UPLOAD = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
] as const;

/** Conteúdo de uma página A4 do orçamento simples. */
export interface MarkupOrcamentoSimplesPagina {
  indice: number;
  total: number;
  /** Cabeçalho completo (marca) só na 1ª página. */
  cabecalhoCompleto: boolean;
  fotos: string[];
  /** Índice visual da 1ª foto desta página (1-based), para legenda 01, 02… contínua. */
  fotoInicio: number;
  /** Itens desta página; vazio = não mostra tabela. */
  itens: MarkupOrcamentoSimplesItem[];
  mostrarCabecalhoTabela: boolean;
  mostrarTotais: boolean;
  observacoes: string;
  /** Texto de observações que veio cortado da página anterior. */
  observacoesContinuacao: boolean;
  mostrarAssinaturas: boolean;
}

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

interface ParteComercialOrcamento {
  descricao: string;
  /** Peso para ratear o preço de venda (em geral o subtotal de custo do móvel/cômodo). */
  peso: number;
}

/**
 * Partes comerciais de um caderno: móveis da composição IA, senão cômodos,
 * senão uma linha com o título + preço final.
 */
export function partesComerciaisDoOrcamento(
  orcamento: Pick<MarkupOrcamento, 'titulo' | 'preco_final' | 'modulos'>,
): ParteComercialOrcamento[] {
  const comodos = orcamento.modulos?.meta?.resumo_ia?.comodos ?? [];
  const moveis = comodos.flatMap((comodo) =>
    (comodo.moveis ?? [])
      .map((movel) => {
        const nomeComodo = comodo.nome?.trim() || '';
        const nomeMovel = movel.nome?.trim() || '';
        if (!nomeComodo && !nomeMovel) return null;
        const descricao =
          nomeComodo && nomeMovel && nomeComodo !== nomeMovel
            ? `${nomeComodo} — ${nomeMovel}`
            : nomeMovel || nomeComodo;
        return {
          descricao,
          peso: Math.max(0, Number(movel.subtotal) || 0),
        };
      })
      .filter((parte): parte is ParteComercialOrcamento => parte != null),
  );
  if (moveis.length > 0) return moveis;

  const soComodos = comodos
    .map((comodo) => {
      const nome = comodo.nome?.trim() || '';
      if (!nome) return null;
      return {
        descricao: nome,
        peso: Math.max(0, Number(comodo.subtotal) || 0),
      };
    })
    .filter((parte): parte is ParteComercialOrcamento => parte != null);
  if (soComodos.length > 0) return soComodos;

  return [
    {
      descricao: orcamento.titulo.trim() || 'Orçamento',
      peso: Math.max(0, Number(orcamento.preco_final) || 0),
    },
  ];
}

/** Rateia o preço de venda do caderno entre as partes comerciais (centavos). */
export function ratearPrecoFinalEmItens(
  partes: ParteComercialOrcamento[],
  precoFinalReais: number,
): MarkupOrcamentoSimplesItem[] {
  if (partes.length === 0) {
    return [criarItemOrcamentoSimples('Item', reaisParaCentavos(precoFinalReais), 1)];
  }
  const totalCentavos = reaisParaCentavos(precoFinalReais);
  if (partes.length === 1) {
    return [criarItemOrcamentoSimples(partes[0].descricao, totalCentavos, 1)];
  }

  const pesoTotal = partes.reduce((acc, parte) => acc + parte.peso, 0);
  let restante = totalCentavos;
  return partes.map((parte, index) => {
    const ultimo = index === partes.length - 1;
    let centavos: number;
    if (pesoTotal <= 0) {
      centavos = ultimo ? restante : Math.floor(totalCentavos / partes.length);
    } else {
      centavos = ultimo
        ? restante
        : Math.round((parte.peso / pesoTotal) * totalCentavos);
    }
    if (!ultimo) {
      restante -= centavos;
      if (restante < 0) {
        centavos += restante;
        restante = 0;
      }
    }
    return criarItemOrcamentoSimples(parte.descricao, Math.max(0, centavos), 1);
  });
}

/** Monta a lista comercial a partir de um ou mais markups selecionados. */
export function itensComerciaisDeOrcamentos(
  orcamentos: Array<Pick<MarkupOrcamento, 'titulo' | 'preco_final' | 'modulos'>>,
): MarkupOrcamentoSimplesItem[] {
  const itens = orcamentos.flatMap((orcamento) =>
    ratearPrecoFinalEmItens(partesComerciaisDoOrcamento(orcamento), orcamento.preco_final),
  );
  return itens.length > 0 ? itens : [criarItemOrcamentoSimples('Item', 0, 1)];
}

/**
 * Junta itens importados à lista atual.
 * Se só havia a linha padrão (1 item), troca pela importação; senão acrescenta no fim.
 */
export function mesclarItensImportadosOrcamentoSimples(
  atuais: MarkupOrcamentoSimplesItem[],
  importados: MarkupOrcamentoSimplesItem[],
): MarkupOrcamentoSimplesItem[] {
  if (importados.length === 0) return atuais;
  if (atuais.length <= 1) return importados;
  return [...atuais, ...importados];
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

/* —— Paginação A4 (altura fixa; sem esmagar o conteúdo) —— */

const FOLHA_PAD_Y = 42 + 36;
const FOLHA_INNER_H = MARKUP_ORCAMENTO_SIMPLES_ALTURA_PX - FOLHA_PAD_Y;
const FOLHA_CONTENT_W = MARKUP_ORCAMENTO_SIMPLES_LARGURA_PX - 96;
const H_CABECALHO = 148;
const H_CABECALHO_CONT = 52;
const H_META = 88;
const H_TABELA_HEAD = 34;
const H_LINHA = 42;
const H_TOTAIS_BASE = 132;
const H_TOTAIS_DESCONTO = 72;
const H_OBS_ROTULO = 34;
const H_ASSINATURAS = 96;
const H_RODAPE_PAGINA = 22;
const OBS_LINE_H = 19.4;
const OBS_CHAR_W = 6.85;

function alturaGaleriaPagina(qtd: number): number {
  if (qtd <= 0) return 0;
  const cols = colunasGaleriaOrcamentoSimples(qtd);
  const rows = Math.ceil(qtd / cols);
  const gap = 10;
  const cellW = (FOLHA_CONTENT_W - gap * (cols - 1)) / cols;
  const cellH = cellW * (3 / 4);
  return rows * cellH + Math.max(0, rows - 1) * gap + 22;
}

function alturaTotaisPagina(temDesconto: boolean): number {
  return H_TOTAIS_BASE + (temDesconto ? H_TOTAIS_DESCONTO : 0);
}

function contarLinhasObs(texto: string): number {
  if (!texto) return 0;
  const charsPorLinha = Math.max(24, Math.floor(FOLHA_CONTENT_W / OBS_CHAR_W));
  let linhas = 0;
  for (const trecho of texto.split('\n')) {
    linhas += Math.max(1, Math.ceil(Math.max(trecho.length, 1) / charsPorLinha));
  }
  return linhas;
}

function alturaBlocoObs(texto: string): number {
  const t = texto.trim();
  if (!t) return 0;
  return H_OBS_ROTULO + contarLinhasObs(t) * OBS_LINE_H;
}

/** Parte o texto das observações para caber numa altura útil (só o corpo, sem o rótulo). */
function fatiarObservacoes(texto: string, alturaCorpoMax: number): { pedaco: string; resto: string } {
  const limpo = texto.replace(/\r\n/g, '\n');
  if (!limpo.trim()) return { pedaco: '', resto: '' };
  if (alturaCorpoMax < OBS_LINE_H) return { pedaco: '', resto: limpo };

  const maxLinhas = Math.max(1, Math.floor(alturaCorpoMax / OBS_LINE_H));
  const charsPorLinha = Math.max(24, Math.floor(FOLHA_CONTENT_W / OBS_CHAR_W));
  const paragrafos = limpo.split('\n');
  let linhasUsadas = 0;
  const pedacos: string[] = [];

  for (let i = 0; i < paragrafos.length; i += 1) {
    const para = paragrafos[i] ?? '';
    const linhasPara = Math.max(1, Math.ceil(Math.max(para.length, 1) / charsPorLinha));
    if (linhasUsadas + linhasPara <= maxLinhas) {
      pedacos.push(para);
      linhasUsadas += linhasPara;
      continue;
    }
    const linhasRestantes = maxLinhas - linhasUsadas;
    if (linhasRestantes <= 0) {
      return {
        pedaco: pedacos.join('\n'),
        resto: paragrafos.slice(i).join('\n'),
      };
    }
    const corteChars = Math.max(8, linhasRestantes * charsPorLinha);
    if (para.length <= corteChars) {
      pedacos.push(para);
      return {
        pedaco: pedacos.join('\n'),
        resto: paragrafos.slice(i + 1).join('\n'),
      };
    }
    let corte = corteChars;
    const espaco = para.lastIndexOf(' ', corte);
    if (espaco > corte * 0.55) corte = espaco;
    pedacos.push(para.slice(0, corte).trimEnd());
    const restoPara = para.slice(corte).trimStart();
    const restoPartes = [restoPara, ...paragrafos.slice(i + 1)];
    return { pedaco: pedacos.join('\n'), resto: restoPartes.join('\n').replace(/^\n+/, '') };
  }

  return { pedaco: pedacos.join('\n'), resto: '' };
}

/**
 * Divide o orçamento em páginas A4 de altura fixa.
 * Nada é esmagado: o que não cabe numa folha vai para a seguinte.
 */
export function paginarOrcamentoSimplesFolha(input: {
  fotos: string[];
  itens: MarkupOrcamentoSimplesItem[];
  observacoes: string;
  temDesconto: boolean;
}): MarkupOrcamentoSimplesPagina[] {
  const fotosFila = [...input.fotos];
  const itensFila = [...input.itens];
  let obsFila = input.observacoes.trim();
  let totaisPendentes = true;
  let fotosJaColocadas = 0;
  let obsJaComecou = false;
  type PaginaBruta = Omit<MarkupOrcamentoSimplesPagina, 'indice' | 'total'>;
  const brutos: PaginaBruta[] = [];

  let guard = 0;
  while (
    guard < 40 &&
    (fotosFila.length > 0 ||
      itensFila.length > 0 ||
      totaisPendentes ||
      obsFila.length > 0 ||
      brutos.length === 0)
  ) {
    guard += 1;
    const primeira = brutos.length === 0;
    let usado = (primeira ? H_CABECALHO : H_CABECALHO_CONT) + H_RODAPE_PAGINA;
    if (primeira) usado += H_META;

    const fotoInicio = fotosJaColocadas + 1;
    const fotosPagina: string[] = [];
    while (fotosFila.length > 0) {
      const tentativa = fotosPagina.length + 1;
      const hGal = alturaGaleriaPagina(tentativa);
      const reservaMin =
        itensFila.length > 0
          ? H_TABELA_HEAD + H_LINHA
          : totaisPendentes
            ? alturaTotaisPagina(input.temDesconto)
            : obsFila
              ? H_OBS_ROTULO + OBS_LINE_H * 2
              : 0;

      if (usado + hGal > FOLHA_INNER_H) break;
      if (fotosPagina.length > 0 && usado + hGal + reservaMin > FOLHA_INNER_H) break;
      if (fotosPagina.length === 0 && usado + hGal + reservaMin > FOLHA_INNER_H && reservaMin > 0) {
        if (usado + hGal <= FOLHA_INNER_H) {
          fotosPagina.push(fotosFila.shift()!);
        }
        break;
      }
      fotosPagina.push(fotosFila.shift()!);
    }
    if (fotosPagina.length > 0) {
      usado += alturaGaleriaPagina(fotosPagina.length);
      fotosJaColocadas += fotosPagina.length;
    }

    const itensPagina: MarkupOrcamentoSimplesItem[] = [];
    let mostrarCabecalhoTabela = false;
    if (itensFila.length > 0 && usado + H_TABELA_HEAD + H_LINHA <= FOLHA_INNER_H) {
      mostrarCabecalhoTabela = true;
      usado += H_TABELA_HEAD;
      while (itensFila.length > 0) {
        const ultimo = itensFila.length === 1;
        const extraTotais =
          ultimo && totaisPendentes ? alturaTotaisPagina(input.temDesconto) : 0;
        if (usado + H_LINHA + extraTotais > FOLHA_INNER_H) break;
        itensPagina.push(itensFila.shift()!);
        usado += H_LINHA;
      }
    }

    let mostrarTotais = false;
    if (itensFila.length === 0 && totaisPendentes) {
      const hTot = alturaTotaisPagina(input.temDesconto);
      if (usado + hTot <= FOLHA_INNER_H) {
        mostrarTotais = true;
        totaisPendentes = false;
        usado += hTot;
      }
    }

    let observacoes = '';
    let observacoesContinuacao = false;
    const podeObs = itensFila.length === 0 && !totaisPendentes && obsFila.length > 0;
    if (podeObs) {
      const reservarAssin = H_ASSINATURAS + 12;
      const livre = FOLHA_INNER_H - usado;
      const hObsTotal = alturaBlocoObs(obsFila);
      const cabeTudoComAssin = livre >= hObsTotal + reservarAssin;
      const alturaParaObs = cabeTudoComAssin ? livre - reservarAssin : livre;
      if (alturaParaObs >= H_OBS_ROTULO + OBS_LINE_H) {
        const corpoMax = alturaParaObs - H_OBS_ROTULO;
        const { pedaco, resto } = fatiarObservacoes(obsFila, corpoMax);
        if (pedaco.trim()) {
          observacoes = pedaco;
          observacoesContinuacao = obsJaComecou;
          obsJaComecou = true;
          obsFila = resto.trim();
          usado += alturaBlocoObs(observacoes);
        }
      }
    }

    const paginaVazia =
      fotosPagina.length === 0 &&
      itensPagina.length === 0 &&
      !mostrarTotais &&
      !observacoes.trim();

    if (paginaVazia) {
      if (totaisPendentes && usado + alturaTotaisPagina(input.temDesconto) <= FOLHA_INNER_H) {
        mostrarTotais = true;
        totaisPendentes = false;
      } else if (obsFila) {
        const { pedaco, resto } = fatiarObservacoes(
          obsFila,
          Math.max(OBS_LINE_H * 3, FOLHA_INNER_H - usado - H_OBS_ROTULO),
        );
        if (pedaco.trim()) {
          observacoes = pedaco;
          observacoesContinuacao = obsJaComecou;
          obsJaComecou = true;
          obsFila = resto.trim();
        } else {
          observacoes = obsFila.slice(0, 280);
          observacoesContinuacao = obsJaComecou;
          obsJaComecou = true;
          obsFila = obsFila.slice(280).trim();
        }
      } else {
        break;
      }
    }

    brutos.push({
      cabecalhoCompleto: primeira,
      fotos: fotosPagina,
      fotoInicio,
      itens: itensPagina,
      mostrarCabecalhoTabela: mostrarCabecalhoTabela && itensPagina.length > 0,
      mostrarTotais,
      observacoes,
      observacoesContinuacao,
      mostrarAssinaturas: false,
    });

    if (
      fotosFila.length === 0 &&
      itensFila.length === 0 &&
      !totaisPendentes &&
      obsFila.length === 0
    ) {
      break;
    }
  }

  if (brutos.length === 0) {
    brutos.push({
      cabecalhoCompleto: true,
      fotos: [],
      fotoInicio: 1,
      itens: input.itens,
      mostrarCabecalhoTabela: input.itens.length > 0,
      mostrarTotais: true,
      observacoes: input.observacoes.trim(),
      observacoesContinuacao: false,
      mostrarAssinaturas: true,
    });
  }

  const ultima = brutos[brutos.length - 1]!;
  const usadoUltimaEstimado = (() => {
    let u = (ultima.cabecalhoCompleto ? H_CABECALHO + H_META : H_CABECALHO_CONT) + H_RODAPE_PAGINA;
    u += alturaGaleriaPagina(ultima.fotos.length);
    if (ultima.itens.length > 0) u += H_TABELA_HEAD + ultima.itens.length * H_LINHA;
    if (ultima.mostrarTotais) u += alturaTotaisPagina(input.temDesconto);
    if (ultima.observacoes.trim()) u += alturaBlocoObs(ultima.observacoes);
    return u;
  })();

  if (usadoUltimaEstimado + H_ASSINATURAS + 8 <= FOLHA_INNER_H) {
    ultima.mostrarAssinaturas = true;
  } else {
    brutos.push({
      cabecalhoCompleto: false,
      fotos: [],
      fotoInicio: fotosJaColocadas + 1,
      itens: [],
      mostrarCabecalhoTabela: false,
      mostrarTotais: false,
      observacoes: '',
      observacoesContinuacao: false,
      mostrarAssinaturas: true,
    });
  }

  const total = brutos.length;
  return brutos.map((pagina, indice) => ({
    ...pagina,
    indice: indice + 1,
    total,
  }));
}
