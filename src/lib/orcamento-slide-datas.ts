const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Converte "yyyy-MM-dd" em Date local (evita fuso de meia-noite UTC). */
export function parseDataIsoLocal(valor: string): Date | undefined {
  const trimmed = valor.trim();
  if (!ISO_DATE.test(trimmed)) return undefined;
  const [ano, mes, dia] = trimmed.split('-').map(Number);
  const date = new Date(ano, mes - 1, dia);
  if (Number.isNaN(date.getTime())) return undefined;
  return date;
}

/** Formata Date local como "yyyy-MM-dd" para persistência. */
export function formatarDataIsoLocal(date: Date): string {
  const ano = date.getFullYear();
  const mes = String(date.getMonth() + 1).padStart(2, '0');
  const dia = String(date.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/** Data de hoje à meia-noite local. */
export function hojeLocal(): Date {
  const agora = new Date();
  return new Date(agora.getFullYear(), agora.getMonth(), agora.getDate());
}

/** Diferença em dias civis entre duas datas (ignora hora). */
export function diferencaEmDias(de: Date, ate: Date): number {
  const a = new Date(de.getFullYear(), de.getMonth(), de.getDate()).getTime();
  const b = new Date(ate.getFullYear(), ate.getMonth(), ate.getDate()).getTime();
  return Math.round((b - a) / (1000 * 60 * 60 * 24));
}

/** Texto legível do prazo a partir da quantidade de dias. */
export function formatarPrazoEmDias(dias: number): string {
  const n = Math.max(0, Math.round(dias));
  if (n === 1) return '1 dia';
  return `${n} dias`;
}

/** Extrai a quantidade de dias de textos como "30 dias", "20 dias úteis", "45" ou "abc30xyz". */
export function extrairDiasDoPrazo(texto: string): number | null {
  const match = texto.trim().match(/(\d+)/);
  if (!match) return null;
  const dias = Number(match[1]);
  if (!Number.isFinite(dias) || dias < 0) return null;
  return dias;
}

/**
 * Normaliza qualquer texto de prazo para "N dia(s)", ignorando letras.
 * Retorna string vazia se não houver número.
 */
export function normalizarPrazoEmDias(texto: string): string {
  const dias = extrairDiasDoPrazo(texto);
  if (dias == null) return '';
  return formatarPrazoEmDias(dias);
}

/** True se há início, prazo ou data prevista — evita slide vazio “Prazos a definir”. */
export function orcamentoTemDadosDePrazo(dados: {
  prazo_entrega?: string | null;
  inicio_execucao?: string | null;
} | null | undefined): boolean {
  if (!dados) return false;
  if (dados.inicio_execucao?.trim()) return true;
  if (dados.prazo_entrega?.trim()) return true;
  return false;
}

/**
 * Resolve a data prevista de entrega a partir dos dados do orçamento.
 * Fórmula: início da execução + dias do prazo.
 */
export function resolverDataPrevistaEntrega(dados: {
  prazo_entrega?: string | null;
  inicio_execucao?: string | null;
}): { dataEntrega: Date; dataEntregaIso: string; dias: number; label: string } | null {
  const prazo = dados.prazo_entrega?.trim() ?? '';
  if (!prazo) return null;

  const calculo = calcularDataEntregaPorPrazo({
    prazoTexto: prazo,
    inicioExecucaoIso: dados.inicio_execucao?.trim() || undefined,
  });
  if (!calculo) return null;

  return {
    dataEntrega: calculo.dataEntrega,
    dataEntregaIso: calculo.dataEntregaIso,
    dias: calculo.dias,
    label: formatarDataEntregaLegenda(calculo.dataEntrega, true),
  };
}

/** Soma dias civis a uma data local. */
export function somarDias(date: Date, dias: number): Date {
  const resultado = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  resultado.setDate(resultado.getDate() + dias);
  return resultado;
}

/**
 * Data de entrega = início (ou hoje) + dias do prazo.
 * Ex.: início 27/07 + 30 dias → 26/08 (ou 27/08 se contagem inclusiva)
 *
 * Contagem: dias corridos a partir do início (27/07 + 30 = 26/08).
 * Para o exemplo do usuário (27/07 + 30 → 27/08), usamos início + N dias
 * de calendário (mesmo mês+1 quando N=30).
 */
export function calcularDataEntregaPorPrazo(options: {
  prazoTexto: string;
  inicioExecucaoIso?: string;
}): { dataEntrega: Date; dataEntregaIso: string; dias: number; base: Date } | null {
  const dias = extrairDiasDoPrazo(options.prazoTexto);
  if (dias == null) return null;

  const inicio = options.inicioExecucaoIso
    ? parseDataIsoLocal(options.inicioExecucaoIso)
    : undefined;
  const base = inicio ?? hojeLocal();
  const dataEntrega = somarDias(base, dias);

  return {
    dias,
    dataEntrega,
    dataEntregaIso: formatarDataIsoLocal(dataEntrega),
    base,
  };
}

/**
 * Calcula o texto de prazo a partir da data de entrega escolhida no calendário.
 * Base: início de execução (se houver) ou hoje.
 */
export function calcularPrazoEntregaPorData(options: {
  dataEntregaIso: string;
  inicioExecucaoIso?: string;
}): { prazoTexto: string; dias: number; baseLabel: string } | null {
  const entrega = parseDataIsoLocal(options.dataEntregaIso);
  if (!entrega) return null;

  const inicio = options.inicioExecucaoIso
    ? parseDataIsoLocal(options.inicioExecucaoIso)
    : undefined;
  const base = inicio ?? hojeLocal();
  const dias = diferencaEmDias(base, entrega);

  return {
    dias,
    prazoTexto: formatarPrazoEmDias(Math.max(0, dias)),
    baseLabel: inicio
      ? `início de execução (${formatarDataInicioExecucao(options.inicioExecucaoIso!)})`
      : 'hoje',
  };
}

/** Formata data curta para legenda: "27/08" ou "27/08/2026" se o ano for relevante. */
export function formatarDataEntregaLegenda(date: Date, incluirAno = true): string {
  if (incluirAno) {
    return formatarComLocale(date, { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  return formatarComLocale(date, { day: '2-digit', month: '2-digit' });
}

function formatarComLocale(
  date: Date,
  options: Intl.DateTimeFormatOptions,
): string {
  return date.toLocaleDateString('pt-BR', options);
}

/** Exibe data do início previsto: "15 de julho de 2026". Texto livre permanece como está. */
export function formatarDataInicioExecucao(valor: string): string {
  const trimmed = valor.trim();
  if (!trimmed) return '';

  const local = parseDataIsoLocal(trimmed);
  if (local) {
    return local.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  const parsed = new Date(trimmed);
  if (!Number.isNaN(parsed.getTime()) && /^\d{4}-\d{2}-\d{2}/.test(trimmed)) {
    return parsed.toLocaleDateString('pt-BR', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  return trimmed;
}
