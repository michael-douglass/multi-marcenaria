/** Erro PostgREST/Postgres quando tabela/view não existe ou não está exposta na API. */
export function isMissingDbRelationError(error: {
  code?: string;
  message?: string;
  status?: number;
} | null): boolean {
  if (!error) return false;
  return (
    error.code === 'PGRST205' ||
    error.code === '42P01' ||
    error.status === 404 ||
    error.message?.includes('does not exist') === true ||
    error.message?.includes('404') === true ||
    error.message?.includes('Not Found') === true
  );
}

/** Coluna ainda não visível na API REST (cache do PostgREST desatualizado após migration). */
export function isPostgrestColumnError(error: {
  code?: string;
  message?: string;
  status?: number;
} | null): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? '';
  return (
    error.code === 'PGRST204' ||
    error.code === '42703' ||
    message.includes('could not find') ||
    message.includes('iris_sky_') ||
    message.includes('briefing_prompt') ||
    message.includes('render_ativo') ||
    message.includes('render_ambiente') ||
    (message.includes('column') && message.includes('schema cache')) ||
    error.status === 400
  );
}
