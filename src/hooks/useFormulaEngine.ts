import { useCallback } from 'react';
import { MktConfigColuna, MktLancamento } from './useMarketingGastos';

interface FormulaContext {
  colunas: MktConfigColuna[];
  lancamentos: MktLancamento[];
  data: string;
  // Função opcional para buscar valores de colunas "auto" (sistema)
  getSystemValue?: (coluna: MktConfigColuna, date: string) => number | null;
}

/**
 * Hook para processar fórmulas dinâmicas nas colunas do controle de gastos
 * Fórmulas suportadas: [nome_coluna] + - * / ( )
 * Exemplo: [custo] / [cliques]
 */
export function useFormulaEngine() {
  
  /**
   * Extrai variáveis de uma fórmula (texto entre colchetes)
   * Ex: "[custo] / [cliques]" => ["custo", "cliques"]
   */
  const extractVariables = useCallback((formula: string): string[] => {
    const matches = formula.match(/\[([^\]]+)\]/g);
    if (!matches) return [];
    return matches.map(m => m.slice(1, -1));
  }, []);

  /**
   * Encontra o valor de uma coluna para uma data específica
   * Suporta tanto lançamentos manuais quanto dados do sistema (auto)
   */
  const getColumnValue = useCallback((
    colunaNome: string,
    context: FormulaContext
  ): number | null => {
    // Encontra a coluna pelo nome
    const coluna = context.colunas.find(
      c => c.nome.trim().toLowerCase() === colunaNome.trim().toLowerCase()
    );
    
    if (!coluna) return null;

    // Se é uma coluna de dados do sistema (auto), busca via callback
    if (coluna.is_system_data && context.getSystemValue) {
      return context.getSystemValue(coluna, context.data);
    }

    // Senão, busca nos lançamentos manuais
    const lancamento = context.lancamentos.find(
      l => l.coluna_id === coluna.id && l.data === context.data
    );

    return lancamento?.valor_numerico ?? null;
  }, []);

  /**
   * Avalia uma fórmula matemática substituindo variáveis pelos valores
   */
  const evaluateFormula = useCallback((
    formula: string,
    context: FormulaContext
  ): number | null => {
    if (!formula) return null;

    try {
      const matches = formula.match(/\[([^\]]+)\]/g);
      if (!matches) return null;

      let expression = formula;
      for (const match of matches) {
        const varName = match.slice(1, -1);
        const value = getColumnValue(varName, context);
        if (value === null) {
          // Se qualquer variável for nula, o resultado é nulo
          return null;
        }
        expression = expression.split(match).join(value.toString());
      }

      // Remove caracteres não permitidos (segurança)
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
      
      // Avalia a expressão
      // eslint-disable-next-line no-new-func
      const result = new Function(`return ${sanitized}`)();
      
      // Verifica se é um número válido
      if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
        return null;
      }

      return result;
    } catch (error) {
      console.error('Erro ao avaliar fórmula:', formula, error);
      return null;
    }
  }, [getColumnValue]);

  /**
   * Calcula o valor de uma coluna considerando fórmulas
   */
  const calculateColumnValue = useCallback((
    coluna: MktConfigColuna,
    context: FormulaContext
  ): number | null => {
    // Se tem fórmula, calcula
    if (coluna.formula) {
      return evaluateFormula(coluna.formula, context);
    }

    // Senão, busca o lançamento direto
    const lancamento = context.lancamentos.find(
      l => l.coluna_id === coluna.id && l.data === context.data
    );

    return lancamento?.valor_numerico ?? null;
  }, [evaluateFormula]);

  /**
   * Formata um valor de acordo com o tipo da coluna
   */
  const formatValue = useCallback((
    value: number | null,
    tipo: 'number' | 'percent' | 'currency',
    decimals: number = 2
  ): string => {
    if (value === null || value === undefined) return '-';

    switch (tipo) {
      case 'currency':
        return new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL',
          minimumFractionDigits: decimals,
          maximumFractionDigits: decimals,
        }).format(value);
      
      case 'percent':
        return `${value.toFixed(decimals)}%`;
      
      case 'number':
      default:
        return new Intl.NumberFormat('pt-BR', {
          minimumFractionDigits: 0,
          maximumFractionDigits: decimals,
        }).format(value);
    }
  }, []);

  /**
   * Valida se uma fórmula é válida
   */
  const validateFormula = useCallback((
    formula: string,
    availableColumns: string[]
  ): { valid: boolean; error?: string } => {
    if (!formula) return { valid: true };

    const matches = formula.match(/\[([^\]]+)\]/g);
    if (!matches) return { valid: true };

    for (const match of matches) {
      const varName = match.slice(1, -1);
      const exists = availableColumns.some(
        col => col.trim().toLowerCase() === varName.trim().toLowerCase()
      );
      if (!exists) {
        return {
          valid: false,
          error: `Coluna não encontrada: ${varName.trim() || varName}`,
        };
      }
    }

    // Tenta avaliar com valores de teste
    try {
      let testExpression = formula;
      for (const match of matches) {
        testExpression = testExpression.split(match).join('1');
      }
      const sanitized = testExpression.replace(/[^0-9+\-*/().%\s]/g, '');
      // eslint-disable-next-line no-new-func
      new Function(`return ${sanitized}`)();
      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: 'Fórmula inválida. Verifique a sintaxe.',
      };
    }
  }, [extractVariables]);

  return {
    extractVariables,
    evaluateFormula,
    calculateColumnValue,
    formatValue,
    validateFormula,
    getColumnValue,
  };
}
