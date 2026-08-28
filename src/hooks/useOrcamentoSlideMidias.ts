import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { isSchemaApiExposed } from '@/lib/empresa-tables';
import { supabase } from '@/integrations/supabase/client';
import { processarImagemSlide } from '@/lib/orcamento-slide-imagem-spec';
import type { OrcamentoSlideMidia, MidiaTipo, MidiaOrigem } from '@/lib/orcamento-slide-types';

const PUBLIC_TABLE = 'CRM-multi-empresas>orcamento_slide_midias<' as const;
const BUCKET = 'orcamento-slides';

function resolveTable(schema: string | null | undefined) {
  return isSchemaApiExposed(schema) ? 'orcamento_slide_midias' : PUBLIC_TABLE;
}

async function proximaOrdemMidia(
  db: ReturnType<typeof useEmpresaSupabase>,
  table: string,
  orcId: string,
): Promise<number> {
  const { data, error } = await db
    .from(table as 'orcamento_slide_midias')
    .select('ordem')
    .eq('orcamento_id', orcId)
    .order('ordem', { ascending: false })
    .limit(1);
  if (error) throw error;
  const max = data?.[0]?.ordem;
  return (typeof max === 'number' ? max : -1) + 1;
}

export function useOrcamentoSlideMidias(orcamentoId: string | null | undefined) {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const qc = useQueryClient();
  const table = resolveTable(schemaEmpresa);
  const qKey = ['orcamento-slide-midias', schemaEmpresa, orcamentoId];

  const query = useQuery({
    queryKey: qKey,
    enabled: queriesReady && !!orcamentoId,
    queryFn: async (): Promise<OrcamentoSlideMidia[]> => {
      const { data, error } = await db
        .from(table as 'orcamento_slide_midias')
        .select('*')
        .eq('orcamento_id', orcamentoId!)
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data ?? []) as OrcamentoSlideMidia[];
    },
  });

  const uploadMidia = useMutation({
    mutationFn: async ({
      file,
      tipo,
      orcId,
    }: {
      file: File;
      tipo: MidiaTipo;
      orcId: string;
    }): Promise<OrcamentoSlideMidia> => {
      let arquivo = file;
      if (file.type.startsWith('image/')) {
        const { file: processado } = await processarImagemSlide(file);
        arquivo = processado;
      }

      const ext = arquivo.name.split('.').pop() ?? 'jpg';
      const path = `${schemaEmpresa ?? 'public'}/${orcId}/${tipo}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, arquivo, { upsert: true });
      if (upErr) throw upErr;
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);

      const ordem = await proximaOrdemMidia(db, table, orcId);
      const { data, error } = await db
        .from(table as 'orcamento_slide_midias')
        .insert({
          orcamento_id: orcId,
          tipo,
          file_url: publicUrl,
          file_name: arquivo.name,
          origem: 'upload' as MidiaOrigem,
          ordem,
          ...(isSchemaApiExposed(schemaEmpresa) ? {} : { schema_nome: schemaEmpresa }),
        })
        .select()
        .single();
      if (error) throw error;
      return data as OrcamentoSlideMidia;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); },
    onError: (e: Error) => toast.error('Erro ao fazer upload', { description: e.message }),
  });

  const importarMidiaLead = useMutation({
    mutationFn: async ({
      orcId,
      tipo,
      file_url,
      file_name,
      origem,
      source_id,
      ordem,
    }: {
      orcId: string;
      tipo: MidiaTipo;
      file_url: string;
      file_name: string;
      origem: MidiaOrigem;
      source_id?: string;
      ordem?: number;
    }): Promise<OrcamentoSlideMidia> => {
      const ordemFinal = ordem ?? (await proximaOrdemMidia(db, table, orcId));
      const { data, error } = await db
        .from(table as 'orcamento_slide_midias')
        .insert({
          orcamento_id: orcId,
          tipo,
          file_url,
          file_name,
          origem,
          source_id: source_id ?? null,
          ordem: ordemFinal,
          ...(isSchemaApiExposed(schemaEmpresa) ? {} : { schema_nome: schemaEmpresa }),
        })
        .select()
        .single();
      if (error) throw error;
      return data as OrcamentoSlideMidia;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); },
    onError: (e: Error) => toast.error('Erro ao importar mídia', { description: e.message }),
  });

  const removerMidia = useMutation({
    mutationFn: async ({ id, file_url, origem }: { id: string; file_url: string; origem: MidiaOrigem }) => {
      const { error } = await db.from(table as 'orcamento_slide_midias').delete().eq('id', id);
      if (error) throw error;
      if (origem === 'upload') {
        const url = new URL(file_url);
        const pathParts = url.pathname.split(`/${BUCKET}/`);
        if (pathParts.length > 1) {
          await supabase.storage.from(BUCKET).remove([pathParts[1]]);
        }
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); },
    onError: (e: Error) => toast.error('Erro ao remover mídia', { description: e.message }),
  });

  const atualizarOrdem = useMutation({
    mutationFn: async (items: { id: string; ordem: number }[]) => {
      await Promise.all(
        items.map(({ id, ordem }) =>
          db.from(table as 'orcamento_slide_midias').update({ ordem }).eq('id', id)
        )
      );
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); },
  });

  return {
    midias: query.data ?? [],
    isLoading: query.isLoading,
    uploadMidia,
    importarMidiaLead,
    removerMidia,
    atualizarOrdem,
  };
}
