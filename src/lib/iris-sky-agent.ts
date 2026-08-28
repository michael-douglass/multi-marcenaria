import {
  IRIS_SKY_DEFAULT_CHAT_PROMPT,
  applyIrisSkyChatPromptPlaceholders,
} from '@/lib/pipeline-lead-ai-config';

export const IRIS_SKY_AGENT = {
  name: 'Íris Sky',
  tagline: 'Consultora privada de projetos Sky',
  subtitle: 'Consulta relatório, documentos e dados do lead',
} as const;

export const IRIS_SKY_SUGGESTED_PROMPTS = [
  'Quais ambientes estão no projeto, incluindo lavanderia?',
  'Qual o telefone e dados de contato deste lead?',
  'Resuma os principais riscos deste projeto.',
] as const;

/** Monta o prompt do chat (mesma lógica da Edge Function). */
export function buildIrisSkySystemPrompt(vars: {
  leadName?: string;
  leadOrigin?: string;
  relatorio: string;
  briefing: string | null;
  retrievedContext?: string;
  chatPromptTemplate?: string;
}): string {
  const template = vars.chatPromptTemplate?.trim() || IRIS_SKY_DEFAULT_CHAT_PROMPT;
  return applyIrisSkyChatPromptPlaceholders(template, {
    nomeLead: vars.leadName,
    origem: vars.leadOrigin,
    relatorio: vars.relatorio,
    briefing: vars.briefing,
    conhecimento: vars.retrievedContext,
  });
}
