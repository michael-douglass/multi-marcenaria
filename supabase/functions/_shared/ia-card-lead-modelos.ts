/**
 * Modelos permitidos no motor de IA do card do lead (docs/ia-lead).
 * PAR de src/lib/ia-card-lead-modelos.ts — ao mudar um lado, mude o outro.
 * A RPC `master_ia_motor_salvar` valida contra a mesma lista (migration 20261120110000).
 */
export const IA_CARD_LEAD_VISION_MODELS = ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1'] as const;
export const IA_CARD_LEAD_IMAGE_MODELS = ['gpt-image-1.5', 'gpt-image-1', 'dall-e-2'] as const;
export const IA_CARD_LEAD_DEFAULT_VISION_MODEL = 'gpt-4o';
export const IA_CARD_LEAD_DEFAULT_IMAGE_MODEL = 'gpt-image-1.5';

export function modeloVisaoPermitido(m: unknown): string {
  return IA_CARD_LEAD_VISION_MODELS.includes(m as never) ? (m as string) : IA_CARD_LEAD_DEFAULT_VISION_MODEL;
}

export function modeloImagemPermitido(m: unknown): string {
  return IA_CARD_LEAD_IMAGE_MODELS.includes(m as never) ? (m as string) : IA_CARD_LEAD_DEFAULT_IMAGE_MODEL;
}
