/** Erros de rede que o navegador mostra em inglês (“Failed to fetch”). */
export function isNetworkFailure(error: unknown): boolean {
  if (!error) return false
  const message = error instanceof Error ? error.message : String(error)
  const name = error instanceof Error ? error.name : ''
  return (
    name === 'AbortError'
    || name === 'TimeoutError'
    || /failed to fetch/i.test(message)
    || /networkerror/i.test(message)
    || /load failed/i.test(message)
    || /network request failed/i.test(message)
    || /fetch failed/i.test(message)
    || /abort/i.test(message)
  )
}

export const NETWORK_FAILURE_USER_MESSAGE =
  'Não foi possível conectar. Verifique a internet do celular e tente de novo.'

export function toUserNetworkError(error: unknown, fallback = 'Erro inesperado.'): string {
  if (isNetworkFailure(error)) return NETWORK_FAILURE_USER_MESSAGE
  if (error instanceof Error && error.message.trim()) return error.message
  return fallback
}
