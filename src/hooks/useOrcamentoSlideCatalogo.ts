import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { isSchemaApiExposed } from '@/lib/empresa-tables';
import { supabase } from '@/integrations/supabase/client';
import type { OrcamentoCatalogoItem, CatalogCategoria } from '@/lib/orcamento-slide-types';

const PUBLIC_TABLE = 'CRM-multi-empresas>orcamento_slide_catalogo<' as const;
const BUCKET = 'orcamento-slides';

function resolveTable(schema: string | null | undefined) {
  return isSchemaApiExposed(schema) ? 'orcamento_slide_catalogo' : PUBLIC_TABLE;
}

export function useOrcamentoSlideCatalogo(categoria?: CatalogCategoria) {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const qc = useQueryClient();
  const table = resolveTable(schemaEmpresa);

  const query = useQuery({
    queryKey: ['orcamento-slide-catalogo', schemaEmpresa, categoria],
    enabled: !!user?.id && queriesReady,
    queryFn: async (): Promise<OrcamentoCatalogoItem[]> => {
      let q = db
        .from(table as 'orcamento_slide_catalogo')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });
      if (categoria) q = q.eq('categoria', categoria);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as OrcamentoCatalogoItem[];
    },
  });

  const criarItem = useMutation({
    mutationFn: async (input: Omit<OrcamentoCatalogoItem, 'id' | 'criado_em'>) => {
      const { data, error } = await db
        .from(table as 'orcamento_slide_catalogo')
        .insert({ ...input, ...(isSchemaApiExposed(schemaEmpresa) ? {} : { schema_nome: schemaEmpresa }) })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orcamento-slide-catalogo', schemaEmpresa] }); toast.success('Item criado!'); },
    onError: (e: Error) => toast.error('Erro', { description: e.message }),
  });

  const atualizarItem = useMutation({
    mutationFn: async ({ id, ...input }: Partial<OrcamentoCatalogoItem> & { id: string }) => {
      const { error } = await db.from(table as 'orcamento_slide_catalogo').update(input).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orcamento-slide-catalogo', schemaEmpresa] }); toast.success('Item atualizado!'); },
    onError: (e: Error) => toast.error('Erro', { description: e.message }),
  });

  const removerItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from(table as 'orcamento_slide_catalogo').update({ ativo: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orcamento-slide-catalogo', schemaEmpresa] }); toast.success('Item removido!'); },
    onError: (e: Error) => toast.error('Erro', { description: e.message }),
  });

  const uploadImagem = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() ?? 'jpg';
    const path = `${schemaEmpresa ?? 'public'}/catalogo/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return publicUrl;
  };

  return { itens: query.data ?? [], isLoading: query.isLoading, criarItem, atualizarItem, removerItem, uploadImagem };
}
