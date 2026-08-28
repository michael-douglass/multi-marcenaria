import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import type { MarkupCategoria, MarkupProduto } from '@/lib/markup-types';
import {
  markupCategoriasQueryKey,
  markupProdutosQueryKey,
  markupSchemaExtra,
  resolveMarkupTable,
} from '@/lib/markup-tables';

export interface MarkupProdutoComCategoria extends MarkupProduto {
  categoria?: MarkupCategoria;
}

export function useMarkupCategorias() {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = resolveMarkupTable(schemaEmpresa, 'categorias');

  return useQuery({
    queryKey: markupCategoriasQueryKey(schemaEmpresa),
    enabled: !!user?.id && queriesReady,
    queryFn: async (): Promise<MarkupCategoria[]> => {
      const { data, error } = await db
        .from(table as 'markup_categorias')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });
      if (error) throw error;
      return (data ?? []) as MarkupCategoria[];
    },
  });
}

export function useMarkupProdutos(incluirInativos = false) {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const qc = useQueryClient();
  const tableProdutos = resolveMarkupTable(schemaEmpresa, 'produtos');
  const tableCategorias = resolveMarkupTable(schemaEmpresa, 'categorias');

  const query = useQuery({
    queryKey: [...markupProdutosQueryKey(schemaEmpresa), incluirInativos],
    enabled: !!user?.id && queriesReady,
    queryFn: async (): Promise<MarkupProdutoComCategoria[]> => {
      const [prodRes, catRes] = await Promise.all([
        (() => {
          let q = db
            .from(tableProdutos as 'markup_produtos')
            .select('*')
            .order('ordem', { ascending: true });
          if (!incluirInativos) q = q.eq('ativo', true);
          return q;
        })(),
        db
          .from(tableCategorias as 'markup_categorias')
          .select('*')
          .order('ordem', { ascending: true }),
      ]);
      if (prodRes.error) throw prodRes.error;
      if (catRes.error) throw catRes.error;
      const catMap = new Map(
        ((catRes.data ?? []) as MarkupCategoria[]).map((c) => [c.id, c]),
      );
      return ((prodRes.data ?? []) as MarkupProduto[]).map((p) => ({
        ...p,
        preco_unitario: p.preco_unitario != null ? Number(p.preco_unitario) : null,
        categoria: catMap.get(p.categoria_id),
      }));
    },
  });

  const criarProduto = useMutation({
    mutationFn: async (input: Omit<MarkupProduto, 'id' | 'criado_em' | 'atualizado_em'>) => {
      const { data, error } = await db
        .from(tableProdutos as 'markup_produtos')
        .insert({ ...input, ...markupSchemaExtra(schemaEmpresa) })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: markupProdutosQueryKey(schemaEmpresa) });
      toast.success('Produto cadastrado!');
    },
    onError: (e: Error) => toast.error('Erro ao cadastrar produto', { description: e.message }),
  });

  const atualizarProduto = useMutation({
    mutationFn: async ({ id, ...input }: Partial<MarkupProduto> & { id: string }) => {
      const { error } = await db
        .from(tableProdutos as 'markup_produtos')
        .update({ ...input, atualizado_em: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: markupProdutosQueryKey(schemaEmpresa) });
      toast.success('Produto atualizado!');
    },
    onError: (e: Error) => toast.error('Erro ao atualizar produto', { description: e.message }),
  });

  const removerProduto = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from(tableProdutos as 'markup_produtos')
        .update({ ativo: false, atualizado_em: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: markupProdutosQueryKey(schemaEmpresa) });
      toast.success('Produto removido!');
    },
    onError: (e: Error) => toast.error('Erro ao remover produto', { description: e.message }),
  });

  /** Persiste a ordem nativa do catálogo (1-based). Afeta a lista padrão em todo o markup. */
  const reordenarProdutos = useMutation({
    mutationFn: async (ordenados: Array<{ id: string; ordem: number }>) => {
      const agora = new Date().toISOString();
      const results = await Promise.all(
        ordenados.map(({ id, ordem }) =>
          db
            .from(tableProdutos as 'markup_produtos')
            .update({ ordem, atualizado_em: agora })
            .eq('id', id),
        ),
      );
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;
    },
    onMutate: async (ordenados) => {
      await qc.cancelQueries({ queryKey: markupProdutosQueryKey(schemaEmpresa) });
      const ordemPorId = new Map(ordenados.map((o) => [o.id, o.ordem]));
      const aplicarOrdem = (lista: MarkupProdutoComCategoria[] | undefined) => {
        if (!lista) return lista;
        return [...lista]
          .map((p) => ({ ...p, ordem: ordemPorId.get(p.id) ?? p.ordem }))
          .sort(
            (a, b) =>
              (a.ordem ?? 0) - (b.ordem ?? 0) ||
              a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }),
          );
      };
      const previousTrue = qc.getQueryData<MarkupProdutoComCategoria[]>([
        ...markupProdutosQueryKey(schemaEmpresa),
        true,
      ]);
      const previousFalse = qc.getQueryData<MarkupProdutoComCategoria[]>([
        ...markupProdutosQueryKey(schemaEmpresa),
        false,
      ]);
      qc.setQueryData(
        [...markupProdutosQueryKey(schemaEmpresa), true],
        aplicarOrdem(previousTrue),
      );
      qc.setQueryData(
        [...markupProdutosQueryKey(schemaEmpresa), false],
        aplicarOrdem(previousFalse),
      );
      return { previousTrue, previousFalse };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.previousTrue) {
        qc.setQueryData(
          [...markupProdutosQueryKey(schemaEmpresa), true],
          ctx.previousTrue,
        );
      }
      if (ctx?.previousFalse) {
        qc.setQueryData(
          [...markupProdutosQueryKey(schemaEmpresa), false],
          ctx.previousFalse,
        );
      }
      toast.error('Erro ao reordenar produtos', { description: e.message });
    },
    onSuccess: () => {
      toast.success('Ordem do catálogo salva!');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: markupProdutosQueryKey(schemaEmpresa) });
    },
  });

  const criarCategoria = useMutation({
    mutationFn: async (input: Omit<MarkupCategoria, 'id' | 'criado_em'>) => {
      const { data, error } = await db
        .from(tableCategorias as 'markup_categorias')
        .insert({ ...input, ...markupSchemaExtra(schemaEmpresa) })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: markupCategoriasQueryKey(schemaEmpresa) });
      toast.success('Categoria criada!');
    },
    onError: (e: Error) => toast.error('Erro ao criar categoria', { description: e.message }),
  });

  return {
    ...query,
    criarProduto,
    atualizarProduto,
    removerProduto,
    reordenarProdutos,
    criarCategoria,
  };
}
