import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  KanbanCardOverride,
  KanbanColumn,
  KanbanColumnSource,
  KanbanColumnWithRules,
  KanbanPage,
  KanbanPageComplete,
  KanbanSourceType,
} from '@/types/kanban-config';

const KANBAN_MASTER = {
  pages: 'CRM-multi-empresas>kanban_pages<',
  columns: 'CRM-multi-empresas>kanban_columns<',
  sources: 'CRM-multi-empresas>kanban_column_sources<',
  overrides: 'CRM-multi-empresas>kanban_card_overrides<',
} as const;

const KANBAN_EMPRESA = {
  pages: 'kanban_pages',
  columns: 'kanban_columns',
  sources: 'kanban_column_sources',
  overrides: 'kanban_card_overrides',
} as const;

interface DbKanbanPage {
  id: string;
  nome: string;
  slug: string;
  ativo: boolean;
  ordem: number;
  criado_em: string;
  atualizado_em: string;
}

interface DbKanbanColumn {
  id: string;
  pagina_id: string;
  nome: string;
  ordem: number;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

interface DbKanbanColumnSource {
  id: string;
  coluna_id: string;
  tipo_fonte: KanbanSourceType;
  valor_fonte: string;
  filtro_origem: string | null;
  filtro_regiao: string | null;
  filtro_vendedor_id: string | null;
  filtro_data_de: string | null;
  filtro_data_ate: string | null;
  ativo: boolean;
  criado_em: string;
  atualizado_em: string;
}

interface DbKanbanCardOverride {
  id: string;
  coluna_id: string;
  lead_id: number;
  acao: 'include' | 'exclude';
  ativo: boolean;
  criado_por: string;
  criado_em: string;
  atualizado_em: string;
}

const mapPage = (item: DbKanbanPage): KanbanPage => ({
  id: item.id,
  nome: item.nome,
  slug: item.slug,
  ativo: item.ativo,
  ordem: item.ordem,
  criadoEm: item.criado_em,
  atualizadoEm: item.atualizado_em,
});

const mapColumn = (item: DbKanbanColumn): KanbanColumn => ({
  id: item.id,
  paginaId: item.pagina_id,
  nome: item.nome,
  ordem: item.ordem,
  ativo: item.ativo,
  criadoEm: item.criado_em,
  atualizadoEm: item.atualizado_em,
});

const mapSource = (item: DbKanbanColumnSource): KanbanColumnSource => ({
  id: item.id,
  colunaId: item.coluna_id,
  tipoFonte: item.tipo_fonte,
  valorFonte: item.valor_fonte,
  filtroOrigem: item.filtro_origem,
  filtroRegiao: item.filtro_regiao,
  filtroVendedorId: item.filtro_vendedor_id,
  filtroDataDe: item.filtro_data_de,
  filtroDataAte: item.filtro_data_ate,
  ativo: item.ativo,
  criadoEm: item.criado_em,
  atualizadoEm: item.atualizado_em,
});

const mapOverride = (item: DbKanbanCardOverride): KanbanCardOverride => ({
  id: item.id,
  colunaId: item.coluna_id,
  leadId: item.lead_id,
  acao: item.acao,
  ativo: item.ativo,
  criadoPor: item.criado_por,
  criadoEm: item.criado_em,
  atualizadoEm: item.atualizado_em,
});

const COLUMN_IDS_IN_CHUNK = 120;

async function fetchSourcesAndOverrides(
  db: SupabaseClient,
  tables: { sources: string; overrides: string },
  columnIds: string[],
) {
  if (!columnIds.length) {
    return { sources: [] as DbKanbanColumnSource[], overrides: [] as DbKanbanCardOverride[] };
  }

  const sourcesChunks: DbKanbanColumnSource[] = [];
  const overridesChunks: DbKanbanCardOverride[] = [];

  for (let i = 0; i < columnIds.length; i += COLUMN_IDS_IN_CHUNK) {
    const chunk = columnIds.slice(i, i + COLUMN_IDS_IN_CHUNK);
    const [{ data: sourcesData, error: sourcesError }, { data: overridesData, error: overridesError }] = await Promise.all([
      db
        .from(tables.sources)
        .select('*')
        .in('coluna_id', chunk)
        .order('criado_em', { ascending: true }),
      db
        .from(tables.overrides)
        .select('*')
        .in('coluna_id', chunk)
        .eq('ativo', true)
        .order('criado_em', { ascending: false }),
    ]);

    if (sourcesError) throw sourcesError;
    if (overridesError) throw overridesError;

    if (sourcesData?.length) sourcesChunks.push(...(sourcesData as DbKanbanColumnSource[]));
    if (overridesData?.length) overridesChunks.push(...(overridesData as DbKanbanCardOverride[]));
  }

  sourcesChunks.sort((a, b) => new Date(a.criado_em).getTime() - new Date(b.criado_em).getTime());
  overridesChunks.sort((a, b) => new Date(b.criado_em).getTime() - new Date(a.criado_em).getTime());

  return { sources: sourcesChunks, overrides: overridesChunks };
}

export function useKanbanConfig() {
  const queryClient = useQueryClient();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const kanbanTables = {
    pages: table(KANBAN_EMPRESA.pages, KANBAN_MASTER.pages),
    columns: table(KANBAN_EMPRESA.columns, KANBAN_MASTER.columns),
    sources: table(KANBAN_EMPRESA.sources, KANBAN_MASTER.sources),
    overrides: table(KANBAN_EMPRESA.overrides, KANBAN_MASTER.overrides),
  };
  const queryKey = ['kanban-config-pages', schemaEmpresa ?? 'master'] as const;

  const pagesQuery = useQuery({
    queryKey,
    enabled: queriesReady,
    queryFn: async (): Promise<KanbanPageComplete[]> => {
      const { data: pagesData, error: pagesError } = await db
        .from(kanbanTables.pages)
        .select('*')
        .order('ordem', { ascending: true });

      if (pagesError) throw pagesError;
      const pages = (pagesData as DbKanbanPage[]).map(mapPage);

      if (!pages.length) return [];

      const pageIds = pages.map((page) => page.id);

      /** Uma query por página evita o limite global de linhas (~1000) em `.in(pagina_id, …)`. */
      const columnsPerPage = await Promise.all(
        pageIds.map(async (paginaId) => {
          const { data: cols, error: colsErr } = await db
            .from(kanbanTables.columns)
            .select('*')
            .eq('pagina_id', paginaId)
            .order('ordem', { ascending: true });
          if (colsErr) throw colsErr;
          return (cols ?? []) as DbKanbanColumn[];
        }),
      );

      const columns = columnsPerPage.flat().map(mapColumn);

      const columnIds = columns.map((column) => column.id);
      if (!columnIds.length) {
        return pages.map((page) => ({ ...page, columns: [] }));
      }

      const { sources: sourcesRaw, overrides: overridesRaw } = await fetchSourcesAndOverrides(
        db,
        kanbanTables,
        columnIds,
      );

      const sources = sourcesRaw.map(mapSource);
      const overrides = overridesRaw.map(mapOverride);

      return pages.map((page) => {
        const pageColumns: KanbanColumnWithRules[] = columns
          .filter((column) => column.paginaId === page.id)
          .map((column) => ({
            ...column,
            sources: sources.filter((source) => source.colunaId === column.id),
            overrides: overrides.filter((override) => override.colunaId === column.id),
          }));

        return {
          ...page,
          columns: pageColumns,
        };
      });
    },
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey }),
      /** Recarrega leads escopados das páginas Kanban (colunas/fontes mudaram). */
      queryClient.invalidateQueries({ queryKey: ['leads', 'kanban-page'] }),
    ]);
  };

  const createPage = useMutation({
    mutationFn: async ({ nome, slug }: { nome: string; slug: string }) => {
      const nextOrder = (pagesQuery.data?.length ?? 0) + 1;
      const { error } = await db
        .from(kanbanTables.pages)
        .insert({ nome, slug, ordem: nextOrder, ativo: true });
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Página Kanban criada com sucesso');
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao criar página Kanban'),
  });

  const updatePage = useMutation({
    mutationFn: async ({
      id,
      updates,
      silent,
    }: {
      id: string;
      updates: Partial<Pick<KanbanPage, 'nome' | 'slug' | 'ativo' | 'ordem'>>;
      silent?: boolean;
    }) => {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.nome !== undefined) dbUpdates.nome = updates.nome;
      if (updates.slug !== undefined) dbUpdates.slug = updates.slug;
      if (updates.ativo !== undefined) dbUpdates.ativo = updates.ativo;
      if (updates.ordem !== undefined) dbUpdates.ordem = updates.ordem;

      const { error } = await db.from(kanbanTables.pages).update(dbUpdates).eq('id', id);
      if (error) throw error;
      return { silent: !!silent };
    },
    onSuccess: async (result) => {
      await invalidate();
      if (!result?.silent) toast.success('Página Kanban atualizada');
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao atualizar página Kanban'),
  });

  const deletePage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from(kanbanTables.pages).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Página Kanban removida');
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao remover página Kanban'),
  });

  /** Persiste a ordem global (1, 2, 3…) para todos os usuários da empresa. */
  const reorderPages = useMutation({
    mutationFn: async (orderedPageIds: string[]) => {
      if (!orderedPageIds.length) return;

      const updates = await Promise.all(
        orderedPageIds.map((id, index) =>
          db.from(kanbanTables.pages).update({ ordem: index + 1 }).eq('id', id),
        ),
      );

      const failed = updates.find((result) => result.error);
      if (failed?.error) throw failed.error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Ordem das páginas salva para toda a equipe');
    },
    onError: (error: Error) =>
      toast.error(error.message || 'Erro ao salvar ordem das páginas'),
  });

  const createColumn = useMutation({
    mutationFn: async ({ paginaId, nome }: { paginaId: string; nome: string }) => {
      const page = pagesQuery.data?.find((entry) => entry.id === paginaId);
      const ordens = (page?.columns ?? []).map((c) => c.ordem);
      const nextOrder = ordens.length > 0 ? Math.max(...ordens) + 1 : 1;
      const { error } = await db
        .from(kanbanTables.columns)
        .insert({ pagina_id: paginaId, nome, ordem: nextOrder, ativo: true });
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Coluna adicionada com sucesso');
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao adicionar coluna'),
  });

  const updateColumn = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Pick<KanbanColumn, 'nome' | 'ativo' | 'ordem'>> }) => {
      const dbUpdates: Record<string, unknown> = {};
      if (updates.nome !== undefined) dbUpdates.nome = updates.nome;
      if (updates.ativo !== undefined) dbUpdates.ativo = updates.ativo;
      if (updates.ordem !== undefined) dbUpdates.ordem = updates.ordem;

      const { error } = await db.from(kanbanTables.columns).update(dbUpdates).eq('id', id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Coluna atualizada');
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao atualizar coluna'),
  });

  const deleteColumn = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from(kanbanTables.columns).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Coluna removida');
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao remover coluna'),
  });

  const replaceColumnSources = useMutation({
    mutationFn: async ({ colunaId, sources }: { colunaId: string; sources: Array<Omit<KanbanColumnSource, 'id' | 'colunaId' | 'criadoEm' | 'atualizadoEm'>> }) => {
      const { error: deleteError } = await db.from(kanbanTables.sources).delete().eq('coluna_id', colunaId);
      if (deleteError) throw deleteError;

      if (!sources.length) return;
      const payload = sources.map((source) => ({
        coluna_id: colunaId,
        tipo_fonte: source.tipoFonte,
        valor_fonte: source.valorFonte,
        filtro_origem: source.filtroOrigem,
        filtro_regiao: source.filtroRegiao,
        filtro_vendedor_id: source.filtroVendedorId,
        filtro_data_de: source.filtroDataDe,
        filtro_data_ate: source.filtroDataAte,
        ativo: source.ativo,
      }));

      const { error: insertError } = await db.from(kanbanTables.sources).insert(payload);
      if (insertError) throw insertError;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Fontes da coluna atualizadas');
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao atualizar fontes da coluna'),
  });

  const upsertColumnOverride = useMutation({
    mutationFn: async ({
      colunaId,
      leadId,
      acao,
      criadoPor,
    }: {
      colunaId: string;
      leadId: number;
      acao: 'include' | 'exclude';
      criadoPor: string;
    }) => {
      const { error } = await db
        .from(kanbanTables.overrides)
        .upsert(
          {
            coluna_id: colunaId,
            lead_id: leadId,
            acao,
            criado_por: criadoPor,
            ativo: true,
          },
          {
            onConflict: 'coluna_id,lead_id',
          },
        );
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Ajuste manual salvo');
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao salvar ajuste manual'),
  });

  const removeColumnOverride = useMutation({
    mutationFn: async ({ colunaId, leadId }: { colunaId: string; leadId: number }) => {
      const { error } = await db
        .from(kanbanTables.overrides)
        .delete()
        .eq('coluna_id', colunaId)
        .eq('lead_id', leadId);
      if (error) throw error;
    },
    onSuccess: async () => {
      await invalidate();
      toast.success('Ajuste manual removido');
    },
    onError: (error: Error) => toast.error(error.message || 'Erro ao remover ajuste manual'),
  });

  return {
    pages: pagesQuery.data ?? [],
    isLoading: pagesQuery.isLoading,
    error: pagesQuery.error,
    refetch: pagesQuery.refetch,
    createPage,
    updatePage,
    deletePage,
    reorderPages,
    createColumn,
    updateColumn,
    deleteColumn,
    replaceColumnSources,
    upsertColumnOverride,
    removeColumnOverride,
  };
}
