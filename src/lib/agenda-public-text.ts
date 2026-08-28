/** Subtítulo padrão quando nenhum texto personalizado foi configurado. */
export function getDefaultAgendaPublicSubtitle(duracaoMinutos: number): string {
  return `Agende sua reunião de ${duracaoMinutos} minutos`;
}

/**
 * Resolve o subtítulo da página pública de agendamento.
 * Suporta `{duracao}` no texto personalizado para inserir a duração da reunião.
 */
export function resolveAgendaPublicSubtitle(
  textoPersonalizado: string | null | undefined,
  duracaoMinutos: number,
): string {
  const template = textoPersonalizado?.trim();
  if (!template) {
    return getDefaultAgendaPublicSubtitle(duracaoMinutos);
  }

  return template.replace(/\{duracao\}/gi, String(duracaoMinutos));
}
