import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { isSchemaApiExposed } from '@/lib/empresa-tables';
import type { OrcamentoPergunta, OrcamentoPerguntaOpcao } from '@/lib/orcamento-slide-types';

const PUBLIC_P = 'CRM-multi-empresas>orcamento_slide_perguntas<' as const;
const PUBLIC_O = 'CRM-multi-empresas>orcamento_slide_pergunta_opcoes<' as const;

function resolvePTable(schema: string | null | undefined) {
  return isSchemaApiExposed(schema) ? 'orcamento_slide_perguntas' : PUBLIC_P;
}
function resolveOTable(schema: string | null | undefined) {
  return isSchemaApiExposed(schema) ? 'orcamento_slide_pergunta_opcoes' : PUBLIC_O;
}

export function useOrcamentoSlidePerguntas() {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const qc = useQueryClient();
  const pTable = resolvePTable(schemaEmpresa);
  const oTable = resolveOTable(schemaEmpresa);

  const query = useQuery({
    queryKey: ['orcamento-slide-perguntas', schemaEmpresa],
    enabled: !!user?.id && queriesReady,
    queryFn: async (): Promise<OrcamentoPergunta[]> => {
      const { data: perguntas, error: pe } = await db
        .from(pTable as 'orcamento_slide_perguntas')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });
      if (pe) throw pe;

      const ids = (perguntas ?? []).map((p) => p.id);
      if (!ids.length) return [] as OrcamentoPergunta[];

      const { data: opcoes, error: oe } = await db
        .from(oTable as 'orcamento_slide_pergunta_opcoes')
        .select('*')
        .in('pergunta_id', ids)
        .order('ordem', { ascending: true });
      if (oe) throw oe;

      return (perguntas ?? []).map((p) => ({
        ...p,
        opcoes: (opcoes ?? []).filter((o) => o.pergunta_id === p.id),
      })) as OrcamentoPergunta[];
    },
  });

  const criarPergunta = useMutation({
    mutationFn: async (input: Pick<OrcamentoPergunta, 'label' | 'tipo' | 'obrigatorio' | 'ordem'>) => {
      const { data, error } = await db
        .from(pTable as 'orcamento_slide_perguntas')
        .insert({ ...input, ...(isSchemaApiExposed(schemaEmpresa) ? {} : { schema_nome: schemaEmpresa }) })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orcamento-slide-perguntas', schemaEmpresa] }); toast.success('Pergunta criada!'); },
    onError: (e: Error) => toast.error('Erro', { description: e.message }),
  });

  const atualizarPergunta = useMutation({
    mutationFn: async ({ id, ...input }: Partial<OrcamentoPergunta> & { id: string }) => {
      const { error } = await db.from(pTable as 'orcamento_slide_perguntas').update(input).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orcamento-slide-perguntas', schemaEmpresa] }); toast.success('Pergunta atualizada!'); },
    onError: (e: Error) => toast.error('Erro', { description: e.message }),
  });

  const removerPergunta = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from(pTable as 'orcamento_slide_perguntas').update({ ativo: false }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orcamento-slide-perguntas', schemaEmpresa] }); toast.success('Pergunta removida!'); },
    onError: (e: Error) => toast.error('Erro', { description: e.message }),
  });

  const criarOpcao = useMutation({
    mutationFn: async (input: Pick<OrcamentoPerguntaOpcao, 'pergunta_id' | 'label' | 'valor' | 'ordem'>) => {
      const { data, error } = await db
        .from(oTable as 'orcamento_slide_pergunta_opcoes')
        .insert({ ...input, ...(isSchemaApiExposed(schemaEmpresa) ? {} : { schema_nome: schemaEmpresa }) })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orcamento-slide-perguntas', schemaEmpresa] }); },
    onError: (e: Error) => toast.error('Erro ao criar opção', { description: e.message }),
  });

  const removerOpcao = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from(oTable as 'orcamento_slide_pergunta_opcoes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orcamento-slide-perguntas', schemaEmpresa] }); },
    onError: (e: Error) => toast.error('Erro', { description: e.message }),
  });

  const atualizarOpcao = useMutation({
    mutationFn: async ({ id, ...input }: Partial<OrcamentoPerguntaOpcao> & { id: string }) => {
      const { error } = await db.from(oTable as 'orcamento_slide_pergunta_opcoes').update(input).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['orcamento-slide-perguntas', schemaEmpresa] }); },
    onError: (e: Error) => toast.error('Erro ao atualizar opção', { description: e.message }),
  });

  return {
    perguntas: query.data ?? [],
    isLoading: query.isLoading,
    criarPergunta,
    atualizarPergunta,
    removerPergunta,
    criarOpcao,
    atualizarOpcao,
    removerOpcao,
  };
}
