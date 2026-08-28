import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';

const MASTER_TABLE = 'CRM-multi-empresas>pipeline_custom_stages<';
const EMPRESA_TABLE = 'pipeline_custom_stages';

export const DEFAULT_PIPELINE_STAGES = [
  { nome: 'Novo Lead', is_default: true },
  { nome: 'Aula Experimental Marcada', is_default: true },
  { nome: 'Não Entraram para Aula Experimental', is_default: true },
  { nome: 'Aula Realizada', is_default: true },
  { nome: 'Venda Realizada (Matriculado)', is_default: true },
  { nome: 'Venda Perdida (Não Matriculado)', is_default: true },
  { nome: 'Clientes Já Cadastrados', is_default: true },
];

export interface PipelineCustomStage {
  id: string;
  nome: string;
  cor: string | null;
  ordem: number;
  ativo: boolean;
  is_default: boolean;
  criado_em: string;
  atualizado_em: string;
}

export function usePipelineCustomStages() {
  const queryClient = useQueryClient();
  const { schemaEmpresa } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const stagesTable = table(EMPRESA_TABLE, MASTER_TABLE);
  const queryKey = ['pipeline-custom-stages', schemaEmpresa ?? 'master'] as const;

  const { data: stages = [], isLoading } = useQuery({
    queryKey,
    queryFn: async (): Promise<PipelineCustomStage[]> => {
      const { data, error } = await db
        .from(stagesTable)
        .select('*')
        .order('ordem', { ascending: true })
        .order('criado_em', { ascending: true });
      if (error) throw error;
      return (data ?? []) as PipelineCustomStage[];
    },
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey });

  const createStage = useMutation({
    mutationFn: async (input: { nome: string; cor?: string | null }) => {
      const nome = input.nome.trim();
      if (!nome) throw new Error('Nome obrigatório');
      const maxOrdem = stages.reduce((acc, s) => Math.max(acc, s.ordem), -1);
      const { error } = await db.from(stagesTable).insert({
        nome,
        cor: input.cor ?? null,
        ordem: maxOrdem + 1,
        ativo: true,
        is_default: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Coluna criada');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao criar coluna'),
  });

  const updateStage = useMutation({
    mutationFn: async (input: { id: string; nome?: string; cor?: string | null; ativo?: boolean }) => {
      const updates: Record<string, unknown> = {};
      if (input.nome !== undefined) updates.nome = input.nome.trim();
      if (input.cor !== undefined) updates.cor = input.cor;
      if (input.ativo !== undefined) updates.ativo = input.ativo;
      const { error } = await db.from(stagesTable).update(updates).eq('id', input.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Coluna atualizada');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao atualizar coluna'),
  });

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from(stagesTable).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Coluna excluída');
      invalidate();
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao excluir coluna'),
  });

  const reorderStages = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const results = await Promise.all(
        orderedIds.map((id, index) =>
          db.from(stagesTable).update({ ordem: index }).eq('id', id),
        ),
      );
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;
    },
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast.error(error.message || 'Erro ao reordenar colunas'),
  });

  const seedDefaultStages = useMutation({
    mutationFn: async () => {
      const rows = DEFAULT_PIPELINE_STAGES.map((s, index) => ({
        nome: s.nome,
        cor: null,
        ordem: index,
        ativo: true,
        is_default: s.is_default,
      }));
      const { error } = await db.from(stagesTable).insert(rows);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
    onError: (error: Error) => toast.error(error.message || 'Erro ao inicializar colunas'),
  });

  return {
    stages,
    activeStages: stages.filter((s) => s.ativo),
    isLoading,
    createStage,
    updateStage,
    deleteStage,
    reorderStages,
    seedDefaultStages,
  };
}
