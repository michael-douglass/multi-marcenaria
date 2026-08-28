import { supabase } from '@/integrations/supabase/client';
import { isSchemaApiExposed, resolveMarketingMediasConfig } from '@/lib/empresa-tables';

/** Pasta automática da Biblioteca usada no wizard de orçamento em slides. */
export const COMPOSICAO_ORCAMENTO_FOLDER_NAME = 'composição de orçamento';

export const COMPOSICAO_ORCAMENTO_FOLDER_DESCRICAO =
  'Imagens e vídeos prontos para usar na composição do orçamento em slides';

function getMarketingDb(schema: string | null) {
  return schema && isSchemaApiExposed(schema) ? supabase.schema(schema) : supabase;
}

/**
 * Garante que a pasta "composição de orçamento" exista no schema da empresa.
 * Retorna o id da pasta.
 */
export async function getOrCreateComposicaoOrcamentoFolder(
  schemaNome: string | null | undefined,
): Promise<string> {
  const config = resolveMarketingMediasConfig(schemaNome);
  const db = getMarketingDb(config.schema);

  const { data: existing } = await db
    .from(config.foldersTable)
    .select('id')
    .eq('nome', COMPOSICAO_ORCAMENTO_FOLDER_NAME)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data: created, error } = await db
    .from(config.foldersTable)
    .insert({
      nome: COMPOSICAO_ORCAMENTO_FOLDER_NAME,
      descricao: COMPOSICAO_ORCAMENTO_FOLDER_DESCRICAO,
    })
    .select('id')
    .single();

  if (error) throw error;
  return created.id as string;
}

export function isComposicaoOrcamentoFolder(nome: string | null | undefined): boolean {
  return (nome ?? '').trim().toLowerCase() === COMPOSICAO_ORCAMENTO_FOLDER_NAME;
}
