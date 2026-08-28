import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { isSchemaApiExposed } from '@/lib/empresa-tables';
import {
  VARIAVEL_CPF_FIXO,
  VARIAVEL_CPF_FIXO_LABEL,
} from '@/lib/contratos-print';

export interface ContratoVariavel {
  id: string;
  nome: string;
  label: string;
  tipo: 'texto' | 'data' | 'valor' | 'cpf';
  obrigatorio: boolean;
  ordem: number;
  /** Quando true, o campo aparece no formulário público de início de orçamento do lead. */
  mostrar_no_link_publico?: boolean;
}

function resolveVariaveisTable(schema: string | null | undefined) {
  if (isSchemaApiExposed(schema)) return 'contratos_variaveis';
  return 'CRM-multi-empresas>contratos_variaveis<';
}

export function useContratosVariaveis() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = resolveVariaveisTable(schemaEmpresa);
  const queryKey = ['contratos-variaveis', schemaEmpresa];

  const { data: variaveis = [], isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      const { data, error } = await db
        .from(table as 'contratos_variaveis')
        .select('*')
        .order('ordem', { ascending: true });
      if (error) throw error;
      let lista = (data ?? []) as ContratoVariavel[];

      if (!lista.some((v) => v.nome === VARIAVEL_CPF_FIXO)) {
        const insert: Record<string, unknown> = {
          nome: VARIAVEL_CPF_FIXO,
          label: VARIAVEL_CPF_FIXO_LABEL,
          tipo: 'cpf',
          obrigatorio: true,
          ordem: -1,
        };
        if (!isSchemaApiExposed(schemaEmpresa)) {
          insert.schema_nome = schemaEmpresa;
        }
        const { data: criada, error: insErr } = await db
          .from(table as 'contratos_variaveis')
          .insert([insert])
          .select()
          .single();
        if (!insErr && criada) {
          lista = [criada as ContratoVariavel, ...lista];
        }
      }

      return lista.sort((a, b) => a.ordem - b.ordem);
    },
    enabled: !!user?.id && queriesReady,
  });

  const criarVariavel = useMutation({
    mutationFn: async (nova: Omit<ContratoVariavel, 'id'>) => {
      const insert: Record<string, unknown> = { ...nova };
      if (!isSchemaApiExposed(schemaEmpresa)) {
        insert.schema_nome = schemaEmpresa;
      }
      const { data, error } = await db
        .from(table as 'contratos_variaveis')
        .insert([insert])
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Campo criado!');
    },
    onError: (e: Error) => toast.error('Erro ao criar campo', { description: e.message }),
  });

  const atualizarVariavel = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<ContratoVariavel> }) => {
      const { data, error } = await db
        .from(table as 'contratos_variaveis')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error('Erro ao atualizar campo', { description: e.message }),
  });

  const excluirVariavel = useMutation({
    mutationFn: async (id: string) => {
      const alvo = variaveis.find((v) => v.id === id);
      if (alvo?.nome === VARIAVEL_CPF_FIXO) {
        throw new Error('O campo CPF é fixo do sistema e não pode ser excluído.');
      }
      const { error } = await db
        .from(table as 'contratos_variaveis')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success('Campo removido!');
    },
    onError: (e: Error) => toast.error('Erro ao remover campo', { description: e.message }),
  });

  const reordenarVariaveis = useMutation({
    mutationFn: async (ids: string[]) => {
      const updates = ids.map((id, index) => ({ id, ordem: index }));
      for (const u of updates) {
        await db
          .from(table as 'contratos_variaveis')
          .update({ ordem: u.ordem })
          .eq('id', u.id);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });

  return {
    variaveis,
    isLoading,
    criarVariavel,
    atualizarVariavel,
    excluirVariavel,
    reordenarVariaveis,
  };
}
