/**
 * Modelos do motor de IA do card do lead (docs/ia-lead), configurados pelo master em /master/modelos.
 * PAR de supabase/functions/_shared/ia-card-lead-modelos.ts — ao mudar um lado, mude o outro.
 */
export const IA_CARD_LEAD_VISION_MODELS = [
  { value: 'gpt-4o-mini', label: 'GPT-4o Mini', description: 'Mais rápido e econômico' },
  { value: 'gpt-4o', label: 'GPT-4o', description: 'Melhor qualidade visual — recomendado' },
  { value: 'gpt-4.1', label: 'GPT-4.1', description: 'Maior precisão em detalhes' },
] as const

export const IA_CARD_LEAD_IMAGE_MODELS = [
  { value: 'gpt-image-1.5', label: 'GPT Image 1.5', description: 'Recomendado — alta fidelidade ao esboço' },
  { value: 'gpt-image-1', label: 'GPT Image 1', description: 'Boa fidelidade ao layout original' },
  {
    value: 'dall-e-2',
    label: 'DALL·E 2',
    description: 'Legado, menor fidelidade. Não informa tokens: cada imagem conta um valor fixo.',
  },
] as const

export const IA_CARD_LEAD_DEFAULT_VISION_MODEL = 'gpt-4o'
export const IA_CARD_LEAD_DEFAULT_IMAGE_MODEL = 'gpt-image-1.5'
