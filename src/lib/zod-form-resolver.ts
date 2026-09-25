import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { ZodType } from 'zod';

/**
 * Resolver compatível com Zod 4 para react-hook-form.
 *
 * O `@hookform/resolvers@3` espera `ZodError.errors` (formato Zod 3).
 * No Zod 4 a lista veio em `issues` — o resolver antigo relança o erro
 * em vez de mostrar a mensagem no campo (ex.: "As senhas não coincidem").
 */
export function zodFormResolver<TFieldValues extends FieldValues>(
  schema: ZodType<TFieldValues>,
): Resolver<TFieldValues> {
  return async (values) => {
    const parsed = await schema.safeParseAsync(values);
    if (parsed.success) {
      return { values: parsed.data, errors: {} };
    }

    const errors = {} as FieldErrors<TFieldValues>;

    for (const issue of parsed.error.issues) {
      const rootKey = issue.path[0];
      if (rootKey === undefined) continue;

      const key = String(rootKey) as keyof FieldErrors<TFieldValues>;
      if (errors[key]) continue;

      (errors as Record<string, { type: string; message: string }>)[String(rootKey)] = {
        type: issue.code,
        message: issue.message,
      };
    }

    return { values: {}, errors };
  };
}
