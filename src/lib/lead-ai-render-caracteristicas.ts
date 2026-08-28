export interface LeadAIRenderCaracteristicas {
  cor?: string;
  material?: string;
  detalhes?: string;
}

export function formatLeadAIRenderCaracteristicas(
  input: LeadAIRenderCaracteristicas,
): string | undefined {
  const parts: string[] = [];
  const cor = input.cor?.trim();
  const material = input.material?.trim();
  const detalhes = input.detalhes?.trim();

  if (cor) parts.push(`Cor: ${cor}`);
  if (material) parts.push(`Material/acabamento: ${material}`);
  if (detalhes) parts.push(`Detalhes: ${detalhes}`);

  return parts.length > 0 ? parts.join('\n') : undefined;
}

export function hasLeadAIRenderCaracteristicas(input: LeadAIRenderCaracteristicas): boolean {
  return Boolean(formatLeadAIRenderCaracteristicas(input));
}

export { appendCaracteristicasToRenderPrompt } from '../../supabase/functions/_shared/render-prompts.ts';
