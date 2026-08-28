/** Normaliza o markdown do relatório de IA para edição e exibição em slides. */
export function normalizarRelatorioAnaliseIa(raw: string): string {
  return raw
    .replace(/\r\n/g, '\n')
    // Títulos colados no mesmo parágrafo (ex.: "...texto #### 1. Seção")
    .replace(/([^\n])\s*####\s+/g, '$1\n### ')
    .replace(/^######\s+/gm, '### ')
    .replace(/^#####\s+/gm, '### ')
    .replace(/^####\s+/gm, '### ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
