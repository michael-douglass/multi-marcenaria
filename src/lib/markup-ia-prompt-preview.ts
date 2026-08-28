import {
  applyMarkupIAPromptPlaceholders,
  type MarkupIAPromptPreviewVars,
} from '@/lib/markup-ia-prompts';
import { formatChecklistForPrompt, type MarkupIAVerificacaoCategoria } from '@/lib/markup-ia-verificacao';

const PLACEHOLDER_DINAMICO = '[preenchido na hora da composição com dados do lead]';

export type { MarkupIAPromptPreviewVars };
export { applyMarkupIAPromptPlaceholders };

export function buildMarkupIAPromptPreview(
  prompt: string,
  checklist: MarkupIAVerificacaoCategoria[],
  extra?: Partial<MarkupIAPromptPreviewVars>,
): string {
  return applyMarkupIAPromptPlaceholders(prompt, {
    nomeLead: 'Exemplo: Cliente Silva',
    catalogo: PLACEHOLDER_DINAMICO,
    catalogoLookup: PLACEHOLDER_DINAMICO,
    servicosCatalogo: PLACEHOLDER_DINAMICO,
    despesasCatalogo: PLACEHOLDER_DINAMICO,
    parametros: PLACEHOLDER_DINAMICO,
    analise: PLACEHOLDER_DINAMICO,
    conhecimento: PLACEHOLDER_DINAMICO,
    checklistVerificacao: formatChecklistForPrompt(checklist),
    inventarioJson: PLACEHOLDER_DINAMICO,
    composicaoJson: PLACEHOLDER_DINAMICO,
    faltantesCriticos: 'Ferragens: falta dobradiça ou corrediça na composição',
    categoriaId: 'ferragens_corr_dobr',
    categoriaNome: 'Ferragens (corrediças e dobradiças)',
    checklistCategoria: formatChecklistForPrompt(checklist.filter((c) => c.id === 'ferragens_corr_dobr')),
    levantamentoProjetistaJson: PLACEHOLDER_DINAMICO,
    ...extra,
  });
}

export function buildAgentPromptPreview(
  prompt: string,
  agentId: keyof import('@/lib/markup-types').MarkupIAAgentPrompts,
  checklist: MarkupIAVerificacaoCategoria[],
): string {
  if (agentId === 'inventariante' || agentId === 'inventariante_retry') {
    return buildMarkupIAPromptPreview(prompt, checklist, {
      categoriaId: 'ferragens_corr_dobr',
      categoriaNome: 'Ferragens (corrediças e dobradiças)',
      faltantesCriticos: 'DOBRADIÇA RETA ausente; FITA MADEIRA 22 ausente',
    });
  }
  return buildMarkupIAPromptPreview(prompt, checklist);
}
