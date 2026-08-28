import { formatarDataInicioExecucao, resolverDataPrevistaEntrega, formatarPrazoEmDias } from '@/lib/orcamento-slide-datas';
import type {
  OrcamentoCatalogoItem,
  OrcamentoPergunta,
  OrcamentoSlide,
} from '@/lib/orcamento-slide-types';

export interface ItemDadosProjeto {
  id: string;
  label: string;
  valor: string;
  origem: 'pergunta' | 'campo';
}

/**
 * Perguntas cadastradas que repetem os campos fixos do formulário
 * (prazo, início, garantia). No formulário e nos dados do projeto
 * usamos só a seção dedicada — evita o mesmo campo duas vezes.
 */
export function isPerguntaCampoDedicado(pergunta: OrcamentoPergunta): boolean {
  const label = pergunta.label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

  if (label.includes('garantia')) return true;
  if (label.includes('prazo')) return true;
  if (label.includes('inicio') && (label.includes('execucao') || label.includes('previsto'))) {
    return true;
  }
  return false;
}

/** Toggle do formulário que libera imagens do projeto na apresentação. */
export function isPerguntaToggleImagens(pergunta: OrcamentoPergunta): boolean {
  if (pergunta.tipo !== 'toggle') return false;
  const label = pergunta.label
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
  // Não confundir com "Solicitar fotos do ambiente"
  if (label.includes('solicitar')) return false;
  return (
    label.includes('imagem') ||
    label.includes('image') ||
    (label.includes('foto') && (label.includes('projeto') || label.includes('adicionar')))
  );
}

/**
 * Imagens do projeto na apresentação.
 * Só esconde se o usuário marcou explicitamente "Não".
 * Sem resposta (ou "Sim") → permite exibir fotos já salvas no orçamento.
 */
export function toggleImagensProjetoAtivo(
  respostas: Record<string, string | string[]>,
  perguntas: OrcamentoPergunta[],
): boolean {
  const pergunta = perguntas.find(isPerguntaToggleImagens);
  if (!pergunta) return true;
  return respostas[pergunta.id] !== 'nao';
}

/** Garante array de opções válidas — evita spread acidental de string ("mdf_15" → m,d,f,…). */
export function normalizarRespostaMulti(
  resposta: string | string[] | undefined,
): string[] {
  if (resposta == null) return [];
  const lista = Array.isArray(resposta) ? resposta : [resposta];
  return [...new Set(lista.filter((v) => typeof v === 'string' && v.length > 1))];
}

/** Normaliza respostas multi no formulário (corrige dados antigos corrompidos). */
export function normalizarRespostasFormulario(
  respostas: Record<string, string | string[]>,
  perguntas: OrcamentoPergunta[],
): Record<string, string | string[]> {
  const out = { ...respostas };
  for (const pergunta of perguntas) {
    if (pergunta.tipo !== 'multi' || out[pergunta.id] === undefined) continue;
    out[pergunta.id] = normalizarRespostaMulti(out[pergunta.id]);
  }
  return out;
}

function normalizarChave(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
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

function labelDaOpcao(pergunta: OrcamentoPergunta, valor: string): string | undefined {
  return pergunta.opcoes?.find((o) => o.valor === valor)?.label;
}

function resolverValorExibicao(
  pergunta: OrcamentoPergunta,
  valor: string,
  catalogo: OrcamentoCatalogoItem[],
): string {
  const labelOpcao = labelDaOpcao(pergunta, valor);
  const catalogItem = encontrarNoCatalogo(valor, labelOpcao, catalogo);
  if (catalogItem) return catalogItem.titulo;
  if (labelOpcao) return labelOpcao;
  return valor;
}

/** Converte a resposta bruta de uma pergunta em texto legível na apresentação. */
export function formatarRespostaPergunta(
  pergunta: OrcamentoPergunta,
  resposta: string | string[] | undefined,
  catalogo: OrcamentoCatalogoItem[] = [],
): string {
  if (resposta === undefined || resposta === null) return 'Não informado';

  if (pergunta.tipo === 'multi') {
    const valores = normalizarRespostaMulti(resposta);
    if (valores.length === 0) return 'Não informado';
    return valores.map((v) => resolverValorExibicao(pergunta, v, catalogo)).join(', ');
  }

  if (Array.isArray(resposta)) {
    if (resposta.length === 0) return 'Não informado';
    return resposta.map((v) => resolverValorExibicao(pergunta, v, catalogo)).join(', ');
  }

  const texto = String(resposta).trim();
  if (!texto) return 'Não informado';

  switch (pergunta.tipo) {
    case 'select':
      return resolverValorExibicao(pergunta, texto, catalogo);
    case 'toggle':
      if (texto === 'sim') return 'Sim';
      if (texto === 'nao') return 'Não';
      return texto;
    case 'data':
      return formatarDataInicioExecucao(texto) || texto;
    case 'numero':
    case 'texto':
    case 'imagem':
    default:
      return texto;
  }
}

/** Lista perguntas (exceto campos dedicados) + prazo/início/garantia do formulário. */
export function resolverItensDadosProjeto(
  orcamento: OrcamentoSlide,
  perguntas: OrcamentoPergunta[],
  catalogo: OrcamentoCatalogoItem[] = [],
): ItemDadosProjeto[] {
  const respostas = orcamento.dados?.respostas ?? {};
  const ordenadas = [...perguntas]
    .filter((p) => !isPerguntaCampoDedicado(p))
    .sort((a, b) => a.ordem - b.ordem);

  const itens: ItemDadosProjeto[] = ordenadas.map((pergunta) => ({
    id: pergunta.id,
    label: pergunta.label,
    valor: formatarRespostaPergunta(pergunta, respostas[pergunta.id], catalogo),
    origem: 'pergunta',
  }));

  const dados = orcamento.dados;
  if (!dados) return itens;

  if (dados.garantia_meses?.trim()) {
    itens.push({
      id: '_garantia',
      label: 'Garantia',
      valor: `${dados.garantia_meses.trim()} meses`,
      origem: 'campo',
    });
  }

  if (dados.inicio_execucao?.trim()) {
    itens.push({
      id: '_inicio',
      label: 'Início da execução',
      valor: formatarDataInicioExecucao(dados.inicio_execucao) || dados.inicio_execucao.trim(),
      origem: 'campo',
    });
  }

  if (dados.prazo_entrega?.trim()) {
    const prevista = resolverDataPrevistaEntrega(dados);
    itens.push({
      id: '_prazo',
      label: 'Prazo de entrega',
      valor: prevista ? formatarPrazoEmDias(prevista.dias) : dados.prazo_entrega.trim(),
      origem: 'campo',
    });
    if (prevista) {
      itens.push({
        id: '_data_entrega',
        label: 'Data prevista de entrega',
        valor: prevista.label,
        origem: 'campo',
      });
    }
  }

  return itens;
}

export function dadosProjetoTemConteudo(itens: ItemDadosProjeto[]): boolean {
  return itens.length > 0;
}
