import { supabase } from '@/integrations/supabase/client';

function isMissingEdgeFunction(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const name = 'name' in error ? String((error as { name?: string }).name) : '';
  const message = 'message' in error ? String((error as { message?: string }).message) : '';
  const context =
    'context' in error && (error as { context?: { status?: number } }).context?.status;

  return (
    context === 404 ||
    name === 'FunctionsFetchError' ||
    name === 'FunctionsHttpError' ||
    message.includes('404') ||
    message.includes('NOT_FOUND') ||
    message.includes('Failed to send a request to the Edge Function')
  );
}

/** Dispara Edge Function se existir; ignora silenciosamente quando não está publicada. */
export async function invokeOptionalEdgeFunction(
  functionName: string,
  body: Record<string, unknown>,
): Promise<void> {
  try {
    const { error } = await supabase.functions.invoke(functionName, { body });
    if (error && !isMissingEdgeFunction(error)) {
      console.warn(`[${functionName}]`, error);
    }
  } catch (error) {
    if (!isMissingEdgeFunction(error)) {
      console.warn(`[${functionName}]`, error);
    }
  }
}
