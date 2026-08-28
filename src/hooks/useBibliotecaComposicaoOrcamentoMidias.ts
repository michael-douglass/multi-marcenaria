import { useQuery } from '@tanstack/react-query';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { resolveMarketingMediasConfig } from '@/lib/empresa-tables';
import { getOrCreateComposicaoOrcamentoFolder } from '@/lib/biblioteca-composicao-orcamento';

export interface BibliotecaComposicaoMidia {
  id: string;
  sourceId: string;
  titulo: string;
  file_url: string;
  file_name: string;
  criado_em: string;
  /** imagem | video — pasta composição aceita ambos. */
  tipo: 'imagem' | 'video';
  mime_type: string | null;
}

/**
 * Imagens e vídeos da pasta automática "composição de orçamento" — para o wizard de slides.
 */
export function useBibliotecaComposicaoOrcamentoMidias() {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const mediasConfig = resolveMarketingMediasConfig(schemaEmpresa);

  return useQuery({
    queryKey: ['biblioteca-composicao-orcamento', schemaEmpresa ?? 'master'],
    enabled: queriesReady,
    queryFn: async (): Promise<BibliotecaComposicaoMidia[]> => {
      const folderId = await getOrCreateComposicaoOrcamentoFolder(schemaEmpresa);

      const { data, error } = await db
        .from(mediasConfig.mediasTable as 'marketing_medias')
        .select('id, titulo, file_url, file_name, criado_em, tipo, mime_type, lead_id')
        .eq('folder_id', folderId)
        .in('tipo', ['imagem', 'video'])
        .is('lead_id', null)
        .order('criado_em', { ascending: false });

      if (error) throw error;

      return (data ?? []).map((row) => {
        const sourceId = row.id as string;
        const tipo = row.tipo === 'video' ? 'video' : 'imagem';
        return {
          id: `bib:${sourceId}`,
          sourceId,
          titulo: (row.titulo as string) || (row.file_name as string) || 'Sem título',
          file_url: row.file_url as string,
          file_name: (row.file_name as string) || (tipo === 'video' ? 'video.mp4' : 'imagem.jpg'),
          criado_em: row.criado_em as string,
          tipo,
          mime_type: (row.mime_type as string | null) ?? null,
        };
      });
    },
  });
}
