/** Extrai mensagem legível de erros do supabase.functions.invoke. */
export async function parseSupabaseFunctionError(
  error: unknown,
  data: unknown,
): Promise<string> {
  if (data && typeof data === 'object' && 'error' in data) {
    const message = (data as { error?: unknown }).error;
    if (typeof message === 'string' && message.trim()) return message;
  }

  if (error && typeof error === 'object' && 'context' in error) {
    const context = (error as { context?: Response }).context;
    if (context instanceof Response) {
      try {
        const body = (await context.clone().json()) as {
          error?: unknown;
          step?: unknown;
          imageModel?: unknown;
        };
        if (typeof body.error === 'string' && body.error.trim()) {
          const step = typeof body.step === 'string' ? body.step : '';
          const imageModel = typeof body.imageModel === 'string' ? body.imageModel : '';
          if (step === 'vision') return `Falha ao analisar o esboço: ${body.error}`;
          if (step === 'render') {
            const hint = imageModel ? ` (modelo: ${imageModel})` : '';
            return `Falha ao gerar a imagem${hint}: ${body.error}`;
          }
          return body.error;
        }
      } catch {
        // corpo não-JSON
      }
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return 'Erro ao processar resposta do servidor';
}
