/** Variáveis disponíveis nas fórmulas do card Orçamentos (sintaxe: [nome_variavel]). */

export const ORCAMENTO_CARD_VARIABLES = [
  { key: 'valor_total', label: 'Valor total' },
  { key: 'total_orcamentos', label: 'Total de orçamentos' },
  { key: 'ticket_medio', label: 'Ticket médio' },
] as const;

export const ORCAMENTO_COLUNA_VARIABLES = [
  { key: 'valor_orcamento', label: 'Valor do orçamento (lead)' },
  { key: 'valor_negocio', label: 'Valor do negócio (lead)' },
  ...ORCAMENTO_CARD_VARIABLES,
] as const;

export type OrcamentoMetricaTipo = 'card' | 'coluna';
export type OrcamentoMetricaFormato = 'currency' | 'number' | 'percent';

/** Campo somado ao usar variável soma_kanban (página Kanban + coluna). */
export type KanbanSomaCampo = 'orcamento' | 'negocio' | 'quantidade';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const KANBAN_SOMA_PREFIX = 'soma_kanban:';
const METRICA_SOMA_PREFIX = 'soma_metrica:';

export function buildKanbanSomaVariableKey(
  columnId: string,
  campo: KanbanSomaCampo = 'orcamento',
): string {
  if (campo === 'orcamento') {
    return `${KANBAN_SOMA_PREFIX}${columnId}`;
  }
  return `${KANBAN_SOMA_PREFIX}${columnId}:${campo}`;
}

export function buildMetricaSomaVariableKey(metricaId: string): string {
  return `${METRICA_SOMA_PREFIX}${metricaId}`;
}

export function parseKanbanSomaVariable(
  varName: string,
): { columnId: string; campo: KanbanSomaCampo } | null {
  const normalized = varName.trim().toLowerCase();
  if (!normalized.startsWith(KANBAN_SOMA_PREFIX)) return null;

  const rest = normalized.slice(KANBAN_SOMA_PREFIX.length);
  const parts = rest.split(':');
  const columnId = parts[0];
  if (!UUID_RE.test(columnId)) return null;

  const campoRaw = parts[1];
  if (!campoRaw || campoRaw === 'orcamento') {
    return { columnId, campo: 'orcamento' };
  }
  if (campoRaw === 'negocio' || campoRaw === 'quantidade') {
    return { columnId, campo: campoRaw };
  }
  return null;
}

export function parseMetricaSomaVariable(varName: string): { metricaId: string } | null {
  const normalized = varName.trim().toLowerCase();
  if (!normalized.startsWith(METRICA_SOMA_PREFIX)) return null;
  const metricaId = normalized.slice(METRICA_SOMA_PREFIX.length);
  if (!UUID_RE.test(metricaId)) return null;
  return { metricaId };
}

export function isDynamicOrcamentoVariable(varName: string): boolean {
  return (
    parseKanbanSomaVariable(varName) !== null || parseMetricaSomaVariable(varName) !== null
  );
}

export function isOrcamentoVariableAllowed(
  varName: string,
  tipo: OrcamentoMetricaTipo,
): boolean {
  const normalized = varName.trim().toLowerCase();
  const staticKeys = getOrcamentoVariableKeys(tipo);
  if (staticKeys.some((k) => k.toLowerCase() === normalized)) return true;
  if (parseKanbanSomaVariable(normalized)) return true;
  if (parseMetricaSomaVariable(normalized)) return true;
  return false;
}

export function getOrcamentoVariableKeys(tipo: OrcamentoMetricaTipo): string[] {
  const list = tipo === 'card' ? ORCAMENTO_CARD_VARIABLES : ORCAMENTO_COLUNA_VARIABLES;
  return list.map((v) => v.key);
}

export function evaluateOrcamentoFormula(
  formula: string,
  values: Record<string, number>,
): number | null {
  if (!formula?.trim()) return null;

  try {
    const matches = formula.match(/\[([^\]]+)\]/g);
    if (!matches?.length) return null;

    let expression = formula;
    for (const match of matches) {
      const varName = match.slice(1, -1).trim().toLowerCase();
      const key = Object.keys(values).find((k) => k.toLowerCase() === varName);
      if (key === undefined) return null;
      const value = values[key];
      if (value === null || value === undefined || Number.isNaN(value)) return null;
      expression = expression.split(match).join(String(value));
    }

    const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${sanitized})`)();

    if (typeof result !== 'number' || Number.isNaN(result) || !Number.isFinite(result)) {
      return null;
    }
    return result;
  } catch {
    return null;
  }
}

export function validateOrcamentoFormula(
  formula: string,
  tipo: OrcamentoMetricaTipo,
): { valid: boolean; error?: string } {
  if (!formula?.trim()) {
    return { valid: false, error: 'Informe uma fórmula' };
  }

  const matches = formula.match(/\[([^\]]+)\]/g);
  if (!matches?.length) {
    return {
      valid: false,
      error: 'Use variáveis entre colchetes, ex.: [valor_total] * 0.6',
    };
  }

  for (const match of matches) {
    const varName = match.slice(1, -1).trim();
    if (!isOrcamentoVariableAllowed(varName, tipo)) {
      return { valid: false, error: `Variável desconhecida: ${match}` };
    }
  }

  try {
    let testExpression = formula;
    for (const match of matches) {
      testExpression = testExpression.split(match).join('1');
    }
    const sanitized = testExpression.replace(/[^0-9+\-*/().%\s]/g, '');
    // eslint-disable-next-line no-new-func
    new Function(`return (${sanitized})`)();
    return { valid: true };
  } catch {
    return { valid: false, error: 'Sintaxe inválida. Use + - * / e parênteses.' };
  }
}

export function formatOrcamentoMetricValue(
  value: number | null,
  formato: OrcamentoMetricaFormato,
): string {
  if (value === null || Number.isNaN(value)) return '—';

  switch (formato) {
    case 'currency':
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(value);
    case 'percent':
      return `${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(value)}%`;
    case 'number':
    default:
      return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(value);
  }
}
