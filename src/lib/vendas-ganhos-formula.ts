/** Variáveis nas fórmulas do card Negócios Ganhos — reutiliza avaliador de orçamentos. */

import {
  evaluateOrcamentoFormula,
  formatOrcamentoMetricValue,
  buildKanbanSomaVariableKey,
  buildMetricaSomaVariableKey,
  parseKanbanSomaVariable,
  parseMetricaSomaVariable,
  type KanbanSomaCampo,
  type OrcamentoMetricaFormato,
  type OrcamentoMetricaTipo,
} from '@/lib/orcamento-formula';

export {
  evaluateOrcamentoFormula as evaluateVendasGanhosFormula,
  formatOrcamentoMetricValue as formatVendasGanhosMetricValue,
  buildKanbanSomaVariableKey,
  buildMetricaSomaVariableKey,
  parseKanbanSomaVariable,
  parseMetricaSomaVariable,
  type KanbanSomaCampo,
  type OrcamentoMetricaFormato as VendasGanhosMetricaFormato,
  type OrcamentoMetricaTipo as VendasGanhosMetricaTipo,
};

export const VENDAS_GANHOS_CARD_VARIABLES = [
  { key: 'faturamento_total', label: 'Faturamento total (mês)' },
  { key: 'total_vendas', label: 'Total de vendas (mês)' },
  { key: 'ticket_medio', label: 'Ticket médio' },
  { key: 'total_leads_mes', label: 'Total de leads no mês' },
  { key: 'taxa_conversao_leads', label: 'Taxa conversão leads (%)' },
] as const;

export const VENDAS_GANHOS_COLUNA_VARIABLES = [
  { key: 'valor_negocio', label: 'Valor do negócio (lead)' },
  { key: 'valor_orcamento', label: 'Valor do orçamento (lead)' },
  ...VENDAS_GANHOS_CARD_VARIABLES,
] as const;

export function getVendasGanhosVariableKeys(tipo: 'card' | 'coluna'): string[] {
  const list = tipo === 'card' ? VENDAS_GANHOS_CARD_VARIABLES : VENDAS_GANHOS_COLUNA_VARIABLES;
  return list.map((v) => v.key);
}

export function isVendasGanhosVariableAllowed(varName: string, tipo: 'card' | 'coluna'): boolean {
  const normalized = varName.trim().toLowerCase();
  const staticKeys = getVendasGanhosVariableKeys(tipo);
  if (staticKeys.some((k) => k.toLowerCase() === normalized)) return true;
  if (parseKanbanSomaVariable(normalized)) return true;
  if (parseMetricaSomaVariable(normalized)) return true;
  return false;
}

export function validateVendasGanhosFormula(
  formula: string,
  tipo: 'card' | 'coluna',
): { valid: boolean; error?: string } {
  if (!formula?.trim()) {
    return { valid: false, error: 'Informe uma fórmula' };
  }
  const matches = formula.match(/\[([^\]]+)\]/g);
  if (!matches?.length) {
    return {
      valid: false,
      error: 'Use variáveis entre colchetes, ex.: [faturamento_total] * 0.1',
    };
  }
  for (const match of matches) {
    const varName = match.slice(1, -1).trim();
    if (!isVendasGanhosVariableAllowed(varName, tipo)) {
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
