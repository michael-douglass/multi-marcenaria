import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { supabase } from '@/integrations/supabase/client';
import type { MarkupConfig, MarkupDespesaTemplate, MarkupServicoTemplate } from '@/lib/markup-types';
import { MARKUP_DEFAULT_CONFIG } from '@/lib/markup-types';
import { normalizarPercentualAuditorLucro } from '@/lib/markup-auditor-lucro';
import { MARKUP_IA_AGENT_PROMPTS_DEFAULT, MARKUP_IA_DEFAULT_AUDITOR_MODEL, normalizarAgentPromptsFromRow } from '@/lib/markup-ia-prompts';
import { normalizarChecklistVerificacao } from '@/lib/markup-ia-verificacao';
import {
  MARKUP_TIMBRADO_BUCKET,
  markupConfigQueryKey,
  markupDespesaTemplatesQueryKey,
  markupServicoTemplatesQueryKey,
  markupSchemaExtra,
  resolveMarkupTable,
} from '@/lib/markup-tables';
import { isTabelaMarkupInexistente } from '@/lib/markup-servicos';

function normalizeConfig(row: MarkupConfig | null): MarkupConfig {
  if (!row) {
    return { id: '', ...MARKUP_DEFAULT_CONFIG };
  }
  return {
    ...row,
    valor_hora_marcenaria: Number(row.valor_hora_marcenaria),
    fator_sobras: Number(row.fator_sobras),
    margem_lucro: Number(row.margem_lucro),
    percentual_imposto: Number(row.percentual_imposto),
    taxas_financeiras: Number(row.taxas_financeiras),
    custo_frete_padrao: Number(row.custo_frete_padrao),
    horas_projeto_padrao: Number(row.horas_projeto_padrao ?? 0),
    horas_producao_padrao: Number(row.horas_producao_padrao ?? 0),
    horas_instalacao_padrao: Number(row.horas_instalacao_padrao ?? 0),
    markup_ia_prompt: row.markup_ia_prompt ?? MARKUP_DEFAULT_CONFIG.markup_ia_prompt,
    markup_ia_model: row.markup_ia_model ?? MARKUP_DEFAULT_CONFIG.markup_ia_model,
    markup_ia_ativo: row.markup_ia_ativo ?? MARKUP_DEFAULT_CONFIG.markup_ia_ativo,
    markup_ia_verificacao: normalizarChecklistVerificacao(row.markup_ia_verificacao),
    markup_ia_auditor_model:
      row.markup_ia_auditor_model?.trim() || MARKUP_IA_DEFAULT_AUDITOR_MODEL,
    markup_ia_agent_prompts: normalizarAgentPromptsFromRow(row.markup_ia_agent_prompts),
    auditor_lucro_percentual: normalizarPercentualAuditorLucro(row.auditor_lucro_percentual),
  };
}

export function useMarkupConfig() {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const qc = useQueryClient();
  const table = resolveMarkupTable(schemaEmpresa, 'config');

  const query = useQuery({
    queryKey: markupConfigQueryKey(schemaEmpresa),
    enabled: !!user?.id && queriesReady,
    queryFn: async (): Promise<MarkupConfig> => {
      const { data, error } = await db
        .from(table as 'markup_config')
        .select('*')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return normalizeConfig(data as MarkupConfig | null);
    },
  });

  const salvarConfig = useMutation({
    mutationFn: async (input: Partial<Omit<MarkupConfig, 'id'>>) => {
      const atual = query.data;
      const payload = {
        ...MARKUP_DEFAULT_CONFIG,
        ...atual,
        ...input,
        atualizado_em: new Date().toISOString(),
        ...markupSchemaExtra(schemaEmpresa),
      };

      if (atual?.id) {
        const { error } = await db
          .from(table as 'markup_config')
          .update(payload)
          .eq('id', atual.id);
        if (error) throw error;
      } else {
        const { error } = await db.from(table as 'markup_config').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: markupConfigQueryKey(schemaEmpresa) });
      toast.success('Configurações salvas!');
    },
    onError: (e: Error) => toast.error('Erro ao salvar configurações', { description: e.message }),
  });

  const uploadTimbrado = async (file: File): Promise<string> => {
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `${schemaEmpresa ?? 'public'}/timbrado/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from(MARKUP_TIMBRADO_BUCKET).upload(path, file, { upsert: true });
    if (error) throw error;
    const { data: { publicUrl } } = supabase.storage.from(MARKUP_TIMBRADO_BUCKET).getPublicUrl(path);
    return publicUrl;
  };

  return { ...query, config: query.data ?? normalizeConfig(null), salvarConfig, uploadTimbrado };
}

export function useMarkupDespesaTemplates() {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const qc = useQueryClient();
  const table = resolveMarkupTable(schemaEmpresa, 'despesaTemplates');

  const query = useQuery({
    queryKey: markupDespesaTemplatesQueryKey(schemaEmpresa),
    enabled: !!user?.id && queriesReady,
    queryFn: async (): Promise<MarkupDespesaTemplate[]> => {
      const { data, error } = await db
        .from(table as 'markup_despesa_templates')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });
      if (error) throw error;
      return ((data ?? []) as MarkupDespesaTemplate[]).map((d) => ({
        ...d,
        valor_padrao: Number(d.valor_padrao),
      }));
    },
  });

  const salvarTemplate = useMutation({
    mutationFn: async (
      input: Partial<MarkupDespesaTemplate> & { id?: string; nome: string; silent?: boolean },
    ) => {
      const { silent: _silent, ...data } = input;
      if (data.id) {
        const { error } = await db
          .from(table as 'markup_despesa_templates')
          .update({
            nome: data.nome,
            valor_padrao: data.valor_padrao ?? 0,
            ordem: data.ordem ?? 0,
            ativo: data.ativo ?? true,
          })
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await db.from(table as 'markup_despesa_templates').insert({
          nome: data.nome,
          valor_padrao: data.valor_padrao ?? 0,
          ordem: data.ordem ?? 0,
          ativo: true,
          ...markupSchemaExtra(schemaEmpresa),
        });
        if (error) throw error;
      }
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: markupDespesaTemplatesQueryKey(schemaEmpresa) });
      if (!input.silent) {
        toast.success('Despesa salva!');
      }
    },
    onError: (e: Error) => {
      toast.error('Erro ao salvar despesa', { description: e.message });
    },
  });

  const removerTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from(table as 'markup_despesa_templates')
        .update({ ativo: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: markupDespesaTemplatesQueryKey(schemaEmpresa) });
      toast.success('Despesa removida!');
    },
    onError: (e: Error) => toast.error('Erro ao remover despesa', { description: e.message }),
  });

  return { ...query, salvarTemplate, removerTemplate };
}

export function useMarkupServicoTemplates() {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const qc = useQueryClient();
  const table = resolveMarkupTable(schemaEmpresa, 'servicoTemplates');

  const query = useQuery({
    queryKey: markupServicoTemplatesQueryKey(schemaEmpresa),
    enabled: !!user?.id && queriesReady,
    retry: (failureCount, error) => !isTabelaMarkupInexistente(error as { code?: string; message?: string }) && failureCount < 2,
    queryFn: async (): Promise<MarkupServicoTemplate[]> => {
      const { data, error } = await db
        .from(table as 'markup_servico_templates')
        .select('*')
        .eq('ativo', true)
        .order('ordem', { ascending: true });
      if (error) {
        if (isTabelaMarkupInexistente(error)) return [];
        throw error;
      }
      return ((data ?? []) as MarkupServicoTemplate[]).map((s) => ({
        ...s,
        valor_hora_padrao: Number(
          (s as MarkupServicoTemplate & { horas_padrao?: number }).valor_hora_padrao ??
            (s as MarkupServicoTemplate & { horas_padrao?: number }).horas_padrao ??
            0,
        ),
      }));
    },
  });

  const salvarTemplate = useMutation({
    mutationFn: async (
      input: Partial<MarkupServicoTemplate> & { id?: string; nome: string; silent?: boolean },
    ) => {
      const { silent: _silent, ...data } = input;
      if (data.id) {
        const payload: {
          nome: string;
          valor_hora_padrao: number;
          ativo: boolean;
          ordem?: number;
        } = {
          nome: data.nome,
          valor_hora_padrao: data.valor_hora_padrao ?? 0,
          ativo: data.ativo ?? true,
        };
        if (typeof data.ordem === 'number') {
          payload.ordem = data.ordem;
        }
        const { error } = await db
          .from(table as 'markup_servico_templates')
          .update(payload)
          .eq('id', data.id);
        if (error) throw error;
      } else {
        const { error } = await db.from(table as 'markup_servico_templates').insert({
          nome: data.nome,
          valor_hora_padrao: data.valor_hora_padrao ?? 0,
          ordem: data.ordem ?? 0,
          ativo: true,
          ...markupSchemaExtra(schemaEmpresa),
        });
        if (error) throw error;
      }
    },
    onSuccess: (_data, input) => {
      qc.invalidateQueries({ queryKey: markupServicoTemplatesQueryKey(schemaEmpresa) });
      if (!input.silent) {
        toast.success('Serviço salvo!');
      }
    },
    onError: (e: Error) => {
      toast.error('Erro ao salvar serviço', { description: e.message });
    },
  });

  const removerTemplate = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db
        .from(table as 'markup_servico_templates')
        .update({ ativo: false })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: markupServicoTemplatesQueryKey(schemaEmpresa) });
      toast.success('Serviço removido!');
    },
    onError: (e: Error) => toast.error('Erro ao remover serviço', { description: e.message }),
  });

  /** Atualiza a ordem dos campos de mão de obra (1-based). */
  const reordenarTemplates = useMutation({
    mutationFn: async (ordenados: Array<{ id: string; ordem: number }>) => {
      const results = await Promise.all(
        ordenados.map(({ id, ordem }) =>
          db
            .from(table as 'markup_servico_templates')
            .update({ ordem })
            .eq('id', id),
        ),
      );
      const firstError = results.find((r) => r.error)?.error;
      if (firstError) throw firstError;
    },
    onMutate: async (ordenados) => {
      await qc.cancelQueries({ queryKey: markupServicoTemplatesQueryKey(schemaEmpresa) });
      const previous = qc.getQueryData<MarkupServicoTemplate[]>(
        markupServicoTemplatesQueryKey(schemaEmpresa),
      );
      if (previous) {
        const ordemPorId = new Map(ordenados.map((o) => [o.id, o.ordem]));
        qc.setQueryData<MarkupServicoTemplate[]>(
          markupServicoTemplatesQueryKey(schemaEmpresa),
          [...previous]
            .map((t) => ({ ...t, ordem: ordemPorId.get(t.id) ?? t.ordem }))
            .sort((a, b) => a.ordem - b.ordem),
        );
      }
      return { previous };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.previous) {
        qc.setQueryData(markupServicoTemplatesQueryKey(schemaEmpresa), ctx.previous);
      }
      toast.error('Erro ao reordenar campos', { description: e.message });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: markupServicoTemplatesQueryKey(schemaEmpresa) });
    },
  });

  return { ...query, salvarTemplate, removerTemplate, reordenarTemplates };
}
