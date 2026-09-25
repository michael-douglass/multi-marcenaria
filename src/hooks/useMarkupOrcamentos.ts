import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { recalcularModulos } from '@/lib/markup-calculo';
import { comAuditorLucroNaMeta } from '@/lib/markup-auditor-lucro';
import type {
  MarkupAuditorLucroMeta,
  MarkupLeadResumo,
  MarkupModulos,
  MarkupOrcamento,
} from '@/lib/markup-types';
import { criarModulosVazios } from '@/lib/markup-types';
import { normalizarModulosServicos } from '@/lib/markup-servicos';
import {
  markupLeadResumoMapQueryKey,
  markupOrcamentosQueryKey,
  markupSchemaExtra,
  resolveMarkupTable,
} from '@/lib/markup-tables';

function parseOrcamento(row: Record<string, unknown>): MarkupOrcamento {
  const raw = (row.modulos as MarkupModulos | undefined) ?? criarModulosVazios();
  const modulos = recalcularModulos(normalizarModulosServicos(raw));
  return {
    id: row.id as string,
    lead_id: row.lead_id as number | null,
    titulo: (row.titulo as string) ?? 'Markup',
    status: (row.status as MarkupOrcamento['status']) ?? 'rascunho',
    modulos,
    preco_final: Number(row.preco_final ?? 0),
    observacoes_rodape: (row.observacoes_rodape as string) ?? '',
    criado_por: row.criado_por as string | null | undefined,
    criado_em: row.criado_em as string | undefined,
    atualizado_em: row.atualizado_em as string | undefined,
  };
}

export interface SalvarMarkupOrcamentoInput {
  id?: string;
  lead_id?: number | null;
  titulo?: string;
  status?: MarkupOrcamento['status'];
  modulos: MarkupModulos;
  preco_final: number;
  observacoes_rodape?: string;
  /** Auto-save: sem toast e atualiza cache local sem refetch completo. */
  silent?: boolean;
}

function sortOrcamentosPorAtualizacao(lista: MarkupOrcamento[]): MarkupOrcamento[] {
  return [...lista].sort((a, b) =>
    (b.atualizado_em ?? '').localeCompare(a.atualizado_em ?? ''),
  );
}

export function useMarkupOrcamentos(leadId?: number | null) {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const qc = useQueryClient();
  const table = resolveMarkupTable(schemaEmpresa, 'orcamentos');

  const query = useQuery({
    queryKey: markupOrcamentosQueryKey(schemaEmpresa, leadId),
    enabled: !!user?.id && queriesReady,
    queryFn: async (): Promise<MarkupOrcamento[]> => {
      let q = db
        .from(table as 'markup_orcamentos')
        .select('*')
        .order('atualizado_em', { ascending: false });
      if (leadId != null) q = q.eq('lead_id', leadId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []).map((r) => parseOrcamento(r as Record<string, unknown>));
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: markupOrcamentosQueryKey(schemaEmpresa) });
    qc.invalidateQueries({ queryKey: markupLeadResumoMapQueryKey(schemaEmpresa) });
    if (leadId != null) {
      qc.invalidateQueries({ queryKey: markupOrcamentosQueryKey(schemaEmpresa, leadId) });
    }
  };

  const patchOrcamentoInCache = (orcamento: MarkupOrcamento) => {
    const patchList = (keyLeadId: number | null | undefined) => {
      qc.setQueryData(
        markupOrcamentosQueryKey(schemaEmpresa, keyLeadId),
        (old: MarkupOrcamento[] | undefined) => {
          if (!old) return [orcamento];
          const idx = old.findIndex((o) => o.id === orcamento.id);
          if (idx >= 0) {
            const next = [...old];
            next[idx] = orcamento;
            return sortOrcamentosPorAtualizacao(next);
          }
          return sortOrcamentosPorAtualizacao([orcamento, ...old]);
        },
      );
    };

    patchList(leadId);
    patchList(undefined);
    if (orcamento.lead_id != null && orcamento.lead_id !== leadId) {
      patchList(orcamento.lead_id);
    }

    qc.setQueryData(
      markupLeadResumoMapQueryKey(schemaEmpresa),
      (old: MarkupLeadResumo[] | undefined) => {
        if (!orcamento.lead_id) return old;
        const resumo: MarkupLeadResumo = {
          lead_id: orcamento.lead_id,
          orcamento_id: orcamento.id,
          preco_final: orcamento.preco_final,
          titulo: orcamento.titulo,
          atualizado_em: orcamento.atualizado_em ?? new Date().toISOString(),
        };
        const rest = (old ?? []).filter((item) => item.lead_id !== orcamento.lead_id);
        return [resumo, ...rest];
      },
    );
  };

  const salvarOrcamento = useMutation({
    mutationFn: async (input: SalvarMarkupOrcamentoInput): Promise<MarkupOrcamento> => {
      const payload = {
        lead_id: input.lead_id ?? null,
        titulo: input.titulo ?? 'Markup',
        status: input.status ?? 'rascunho',
        modulos: input.modulos,
        preco_final: input.preco_final,
        observacoes_rodape: input.observacoes_rodape ?? '',
        atualizado_em: new Date().toISOString(),
        ...markupSchemaExtra(schemaEmpresa),
      };

      if (input.id) {
        const { data, error } = await db
          .from(table as 'markup_orcamentos')
          .update(payload)
          .eq('id', input.id)
          .select()
          .single();
        if (error) throw error;
        return parseOrcamento(data as Record<string, unknown>);
      }

      const { data, error } = await db
        .from(table as 'markup_orcamentos')
        .insert({ ...payload, criado_por: user!.id })
        .select()
        .single();
      if (error) throw error;
      return parseOrcamento(data as Record<string, unknown>);
    },
    onSuccess: (data, input) => {
      if (input.silent) {
        patchOrcamentoInCache(data);
      } else {
        invalidateAll();
        toast.success('Markup salvo!');
      }
    },
    onError: (e: Error, input) => {
      if (!input.silent) {
        toast.error('Erro ao salvar markup', { description: e.message });
      }
    },
  });

  const removerOrcamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from(table as 'markup_orcamentos').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Markup removido!');
    },
    onError: (e: Error) => toast.error('Erro ao remover markup', { description: e.message }),
  });

  const duplicarOrcamento = useMutation({
    mutationFn: async (origem: MarkupOrcamento) => {
      const { data, error } = await db
        .from(table as 'markup_orcamentos')
        .insert({
          lead_id: origem.lead_id,
          titulo: `${origem.titulo} (cópia)`,
          status: 'rascunho',
          modulos: origem.modulos,
          preco_final: origem.preco_final,
          observacoes_rodape: origem.observacoes_rodape,
          criado_por: user!.id,
          ...markupSchemaExtra(schemaEmpresa),
        })
        .select()
        .single();
      if (error) throw error;
      return parseOrcamento(data as Record<string, unknown>);
    },
    onSuccess: () => {
      invalidateAll();
      toast.success('Markup duplicado!');
    },
    onError: (e: Error) => toast.error('Erro ao duplicar', { description: e.message }),
  });

  /**
   * Propaga o padrão do auditor (geral vs este lead) para TODOS os markups do lead.
   * Assim o percentual fixo do lead vale em qualquer orçamento aberto.
   */
  const aplicarAuditorLucroNoLead = useMutation({
    mutationFn: async ({
      leadId: alvoLeadId,
      meta,
    }: {
      leadId: number;
      meta: MarkupAuditorLucroMeta;
    }): Promise<MarkupOrcamento[]> => {
      const cached =
        qc.getQueryData<MarkupOrcamento[]>(markupOrcamentosQueryKey(schemaEmpresa, alvoLeadId)) ??
        [];
      let lista = cached.filter((o) => o.lead_id === alvoLeadId);
      if (lista.length === 0) {
        const { data, error } = await db
          .from(table as 'markup_orcamentos')
          .select('*')
          .eq('lead_id', alvoLeadId)
          .order('atualizado_em', { ascending: false });
        if (error) throw error;
        lista = (data ?? []).map((r) => parseOrcamento(r as Record<string, unknown>));
      }

      if (lista.length === 0) return [];

      const agora = new Date().toISOString();
      const atualizados = await Promise.all(
        lista.map(async (orcamento) => {
          const modulos = comAuditorLucroNaMeta(orcamento.modulos, meta) as MarkupModulos;
          const { data, error } = await db
            .from(table as 'markup_orcamentos')
            .update({
              modulos,
              atualizado_em: agora,
              ...markupSchemaExtra(schemaEmpresa),
            })
            .eq('id', orcamento.id)
            .select()
            .single();
          if (error) throw error;
          return parseOrcamento(data as Record<string, unknown>);
        }),
      );
      return atualizados;
    },
    onSuccess: (atualizados, variables) => {
      for (const orcamento of atualizados) {
        patchOrcamentoInCache(orcamento);
      }
      qc.invalidateQueries({
        queryKey: markupOrcamentosQueryKey(schemaEmpresa, variables.leadId),
      });
    },
    onError: (e: Error) => {
      toast.error('Não foi possível aplicar o markup em todos os orçamentos do lead', {
        description: e.message,
      });
    },
  });

  return {
    ...query,
    orcamentos: query.data ?? [],
    salvarOrcamento,
    removerOrcamento,
    duplicarOrcamento,
    aplicarAuditorLucroNoLead,
  };
}

/** Mapa lead_id → resumo do markup mais recente (para miniatura no Kanban). */
export function useLeadMarkupResumoMap(): Map<number, MarkupLeadResumo> {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = resolveMarkupTable(schemaEmpresa, 'orcamentos');

  const { data = [] } = useQuery({
    queryKey: markupLeadResumoMapQueryKey(schemaEmpresa),
    enabled: !!user?.id && queriesReady,
    staleTime: 30_000,
    queryFn: async (): Promise<MarkupLeadResumo[]> => {
      const { data: rows, error } = await db
        .from(table as 'markup_orcamentos')
        .select('id, lead_id, titulo, preco_final, atualizado_em')
        .not('lead_id', 'is', null)
        .order('atualizado_em', { ascending: false });
      if (error) throw error;

      const map = new Map<number, MarkupLeadResumo>();
      for (const row of rows ?? []) {
        const lid = row.lead_id as number;
        if (!lid || map.has(lid)) continue;
        map.set(lid, {
          lead_id: lid,
          orcamento_id: row.id as string,
          preco_final: Number(row.preco_final ?? 0),
          titulo: (row.titulo as string) ?? 'Markup',
          atualizado_em: (row.atualizado_em as string) ?? '',
        });
      }
      return Array.from(map.values());
    },
  });

  const result = new Map<number, MarkupLeadResumo>();
  for (const item of data) {
    result.set(item.lead_id, item);
  }
  return result;
}

export function useMarkupOrcamentoPorId(orcamentoId: string | null | undefined) {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = resolveMarkupTable(schemaEmpresa, 'orcamentos');

  return useQuery({
    queryKey: ['markup-orcamento', schemaEmpresa, orcamentoId],
    enabled: !!user?.id && queriesReady && !!orcamentoId,
    queryFn: async (): Promise<MarkupOrcamento | null> => {
      const { data, error } = await db
        .from(table as 'markup_orcamentos')
        .select('*')
        .eq('id', orcamentoId!)
        .maybeSingle();
      if (error) throw error;
      if (!data) return null;
      return parseOrcamento(data as Record<string, unknown>);
    },
  });
}
