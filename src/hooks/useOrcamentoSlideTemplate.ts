import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { isSchemaApiExposed } from '@/lib/empresa-tables';
import type { OrcamentoSlideTemplate } from '@/lib/orcamento-slide-types';

const BUCKET = 'orcamento-slides';

const PUBLIC_TABLE = 'CRM-multi-empresas>orcamento_slide_templates<' as const;

function resolveTable(schema: string | null | undefined) {
  return isSchemaApiExposed(schema) ? 'orcamento_slide_templates' : PUBLIC_TABLE;
}

export function useOrcamentoSlideTemplate() {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const qc = useQueryClient();
  const table = resolveTable(schemaEmpresa);

  const query = useQuery({
    queryKey: ['orcamento-slide-template', schemaEmpresa],
    enabled: !!user?.id && queriesReady,
    queryFn: async (): Promise<OrcamentoSlideTemplate | null> => {
      const { data, error } = await db
        .from(table as 'orcamento_slide_templates')
        .select('*')
        .eq('ativo', true)
        .order('criado_em', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as OrcamentoSlideTemplate | null;
    },
  });

  const upsertTemplate = useMutation({
    mutationFn: async (input: Partial<OrcamentoSlideTemplate> & { id?: string }) => {
      if (input.id) {
        const { data, error } = await db
          .from(table as 'orcamento_slide_templates')
          .update({ ...input, atualizado_em: new Date().toISOString() })
          .eq('id', input.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
      const { data, error } = await db
        .from(table as 'orcamento_slide_templates')
        .insert({ ...input, ...(isSchemaApiExposed(schemaEmpresa) ? {} : { schema_nome: schemaEmpresa }) })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['orcamento-slide-template', schemaEmpresa] });
      toast.success('Template salvo!');
    },
    onError: (e: Error) => toast.error('Erro ao salvar template', { description: e.message }),
  });

  const uploadImagem = useMutation({
    mutationFn: async ({
      file,
      campo,
    }: {
      file: File;
      campo: 'logo_url' | 'fundo_url';
    }): Promise<string> => {
      const ext = file.name.split('.').pop() ?? 'jpg';
      const path = `template/${schemaEmpresa ?? 'public'}/${campo}-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      return data.publicUrl;
    },
    onError: (e: Error) => toast.error('Erro ao enviar imagem', { description: e.message }),
  });

  return { template: query.data ?? null, isLoading: query.isLoading, upsertTemplate, uploadImagem };
}
