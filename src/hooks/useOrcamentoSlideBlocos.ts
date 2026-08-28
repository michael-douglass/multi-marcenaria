import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { isSchemaApiExposed } from '@/lib/empresa-tables';
import type { OrcamentoSlideBloco, BlocoTipo } from '@/lib/orcamento-slide-types';
import { configPadraoDoBloco } from '@/lib/orcamento-slide-bloco-defaults';

const PUBLIC_TABLE = 'CRM-multi-empresas>orcamento_slide_blocos<' as const;
const BUCKET = 'orcamento-slides';

function resolveTable(schema: string | null | undefined) {
  return isSchemaApiExposed(schema) ? 'orcamento_slide_blocos' : PUBLIC_TABLE;
}

function mensagemErroBloco(e: Error): string {
  const msg = e.message ?? '';
  if (msg.includes('orcamento_slide_blocos_tipo_check') || msg.includes('check constraint')) {
    return 'Este tipo de bloco ainda não está liberado no banco. Atualize as migrations do Supabase e tente novamente.';
  }
  return msg;
}

export function useOrcamentoSlideBlocos(templateId: string | null | undefined) {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const qc = useQueryClient();
  const table = resolveTable(schemaEmpresa);
  const qKey = ['orcamento-slide-blocos', schemaEmpresa, templateId];

  const query = useQuery({
    queryKey: qKey,
    enabled: !!user?.id && queriesReady && !!templateId,
    queryFn: async (): Promise<OrcamentoSlideBloco[]> => {
      const { data, error } = await db
        .from(table as 'orcamento_slide_blocos')
        .select('*')
        .eq('template_id', templateId!)
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data ?? []) as OrcamentoSlideBloco[];
    },
  });

  const criarBloco = useMutation({
    mutationFn: async (input: { tipo: BlocoTipo; config?: Record<string, unknown>; ordem?: number }) => {
      const maxOrdem = (query.data?.length ?? 0);
      const { data, error } = await db
        .from(table as 'orcamento_slide_blocos')
        .insert({
          template_id: templateId!,
          tipo: input.tipo,
          config: input.config ?? configPadraoDoBloco(input.tipo),
          ordem: input.ordem ?? maxOrdem,
          ...(isSchemaApiExposed(schemaEmpresa) ? {} : { schema_nome: schemaEmpresa }),
        })
        .select()
        .single();
      if (error) throw error;
      return data as OrcamentoSlideBloco;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); toast.success('Bloco adicionado!'); },
    onError: (e: Error) => toast.error('Erro', { description: mensagemErroBloco(e) }),
  });

  const atualizarBloco = useMutation({
    mutationFn: async ({ id, ...input }: Partial<OrcamentoSlideBloco> & { id: string }) => {
      const { error } = await db.from(table as 'orcamento_slide_blocos').update(input).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); toast.success('Bloco atualizado!'); },
    onError: (e: Error) => toast.error('Erro', { description: e.message }),
  });

  const reordenarBlocos = useMutation({
    mutationFn: async (items: { id: string; ordem: number }[]) => {
      await Promise.all(
        items.map(({ id, ordem }) =>
          db.from(table as 'orcamento_slide_blocos').update({ ordem }).eq('id', id)
        )
      );
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); },
    onError: (e: Error) => toast.error('Erro ao reordenar blocos', { description: e.message }),
  });

  const removerBloco = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from(table as 'orcamento_slide_blocos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); toast.success('Bloco removido!'); },
    onError: (e: Error) => toast.error('Erro', { description: e.message }),
  });

  const toggleBloco = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await db.from(table as 'orcamento_slide_blocos').update({ ativo }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: qKey }); },
  });

  const uploadImagemBloco = useMutation({
    mutationFn: async ({ file, blocoId }: { file: File; blocoId: string }): Promise<string> => {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `template/${schemaEmpresa ?? 'public'}/blocos/${blocoId}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return data.publicUrl;
    },
    onError: (e: Error) => toast.error('Erro ao enviar imagem', { description: e.message }),
  });

  return {
    blocos: query.data ?? [],
    isLoading: query.isLoading,
    criarBloco,
    atualizarBloco,
    reordenarBlocos,
    removerBloco,
    toggleBloco,
    uploadImagemBloco,
  };
}
