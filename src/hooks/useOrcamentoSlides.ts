import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { isSchemaApiExposed } from '@/lib/empresa-tables';
import { supabase } from '@/integrations/supabase/client';
import {
  montarMidiasDuplicadas,
  montarPayloadOrcamentoDuplicado,
  pathDestinoCopiaMidia,
  pathStorageOrcamentoSlide,
} from '@/lib/orcamento-slide-duplicar';
import type { OrcamentoSlide, OrcamentoSlideStatus, OrcamentoDados, OrcamentoSlideMidia } from '@/lib/orcamento-slide-types';

const PUBLIC_TABLE = 'CRM-multi-empresas>orcamento_slides<' as const;
const PUBLIC_MIDIAS_TABLE = 'CRM-multi-empresas>orcamento_slide_midias<' as const;
const STORAGE_BUCKET = 'orcamento-slides';

function resolveTable(schema: string | null | undefined) {
  return isSchemaApiExposed(schema) ? 'orcamento_slides' : PUBLIC_TABLE;
}

function resolveMidiasTable(schema: string | null | undefined) {
  return isSchemaApiExposed(schema) ? 'orcamento_slide_midias' : PUBLIC_MIDIAS_TABLE;
}

/**
 * Uploads próprios: copia o arquivo no Storage para o novo orçamento
 * (assim apagar imagem numa cópia não quebra a original).
 * Demais origens (lead, biblioteca): reutiliza a mesma URL.
 */
async function resolverUrlMidiaDuplicada(
  midia: OrcamentoSlideMidia,
  novoOrcamentoId: string,
  schema: string,
): Promise<string> {
  if (midia.origem !== 'upload') return midia.file_url;

  const pathOrigem = pathStorageOrcamentoSlide(midia.file_url);
  if (!pathOrigem) return midia.file_url;

  const pathDestino = pathDestinoCopiaMidia({
    schema,
    orcamentoId: novoOrcamentoId,
    tipo: midia.tipo,
    fileName: midia.file_name || pathOrigem.split('/').pop() || 'arquivo.bin',
  });

  const { error: copyErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .copy(pathOrigem, pathDestino);

  if (!copyErr) {
    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(pathDestino);
    return data.publicUrl;
  }

  // Fallback: baixar + reenviar (alguns buckets/políticas não permitem copy).
  const { data: blob, error: downErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .download(pathOrigem);
  if (downErr || !blob) return midia.file_url;

  const { error: upErr } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(pathDestino, blob, { upsert: true });
  if (upErr) return midia.file_url;

  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(pathDestino);
  return data.publicUrl;
}

export const orcamentoSlidesQueryKey = (schema: string | null | undefined) =>
  ['orcamento-slides', schema] as const;

export const orcamentoPorLeadQueryKey = (schema: string | null | undefined, leadId: number | null | undefined) =>
  ['orcamento-slides-lead', schema, leadId] as const;

export const orcamentoLeadMapQueryKey = (schema: string | null | undefined) =>
  ['orcamento-slides-lead-map', schema] as const;

export const orcamentoRascunhoAtualQueryKey = (
  schema: string | null | undefined,
  userId: string | null | undefined,
  leadId?: number | null,
) => ['orcamento-slide-rascunho-atual', schema, userId, leadId ?? 'any'] as const;

export interface CriarOrcamentoInput {
  identificador: string;
  lead_id?: number | null;
  cliente_nome: string;
  dados: OrcamentoDados;
  status?: OrcamentoSlideStatus;
}

export interface SalvarOrcamentoInput extends CriarOrcamentoInput {
  id?: string;
}

export interface SalvarProgressoOrcamentoInput extends CriarOrcamentoInput {
  id?: string;
  /** Em edição, mantém o status atual (pronto, enviado, etc.). */
  status?: OrcamentoSlideStatus;
}

export function useOrcamentoSlides() {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const qc = useQueryClient();
  const table = resolveTable(schemaEmpresa);

  const query = useQuery({
    queryKey: orcamentoSlidesQueryKey(schemaEmpresa),
    enabled: !!user?.id && queriesReady,
    queryFn: async (): Promise<OrcamentoSlide[]> => {
      const { data, error } = await db
        .from(table as 'orcamento_slides')
        .select('*')
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrcamentoSlide[];
    },
  });

  const criarOrcamento = useMutation({
    mutationFn: async (input: CriarOrcamentoInput): Promise<OrcamentoSlide> => {
      const { data, error } = await db
        .from(table as 'orcamento_slides')
        .insert({
          ...input,
          criado_por: user!.id,
          status: (input.status ?? 'rascunho') as OrcamentoSlideStatus,
          ...(isSchemaApiExposed(schemaEmpresa) ? {} : { schema_nome: schemaEmpresa }),
        })
        .select()
        .single();
      if (error) throw error;
      return data as OrcamentoSlide;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: orcamentoSlidesQueryKey(schemaEmpresa) });
      if (data.lead_id) {
        qc.invalidateQueries({ queryKey: orcamentoPorLeadQueryKey(schemaEmpresa, data.lead_id) });
      }
      qc.invalidateQueries({ queryKey: orcamentoLeadMapQueryKey(schemaEmpresa) });
      toast.success('Orçamento criado!');
    },
    onError: (e: Error) => toast.error('Erro ao criar orçamento', { description: e.message }),
  });

  const salvarProgressoOrcamento = useMutation({
    mutationFn: async (input: SalvarProgressoOrcamentoInput): Promise<OrcamentoSlide> => {
      const status = (input.status ?? 'rascunho') as OrcamentoSlideStatus;
      if (input.id) {
        const { data, error } = await db
          .from(table as 'orcamento_slides')
          .update({
            identificador: input.identificador,
            lead_id: input.lead_id ?? null,
            cliente_nome: input.cliente_nome,
            dados: input.dados,
            status,
            atualizado_em: new Date().toISOString(),
          })
          .eq('id', input.id)
          .select()
          .single();
        if (error) throw error;
        return data as OrcamentoSlide;
      }

      const { data, error } = await db
        .from(table as 'orcamento_slides')
        .insert({
          identificador: input.identificador,
          lead_id: input.lead_id ?? null,
          cliente_nome: input.cliente_nome,
          dados: input.dados,
          status,
          criado_por: user!.id,
          ...(isSchemaApiExposed(schemaEmpresa) ? {} : { schema_nome: schemaEmpresa }),
        })
        .select()
        .single();
      if (error) throw error;
      return data as OrcamentoSlide;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: orcamentoSlidesQueryKey(schemaEmpresa) });
      qc.invalidateQueries({ queryKey: ['orcamento-slide-por-id', schemaEmpresa, data.id] });
      qc.invalidateQueries({
        queryKey: orcamentoRascunhoAtualQueryKey(schemaEmpresa, user?.id, data.lead_id),
      });
      qc.invalidateQueries({
        queryKey: orcamentoRascunhoAtualQueryKey(schemaEmpresa, user?.id, null),
      });
      if (data.lead_id) {
        qc.invalidateQueries({ queryKey: orcamentoPorLeadQueryKey(schemaEmpresa, data.lead_id) });
      }
      qc.invalidateQueries({ queryKey: orcamentoLeadMapQueryKey(schemaEmpresa) });
    },
  });

  const salvarOrcamento = useMutation({
    mutationFn: async ({ id, ...input }: SalvarOrcamentoInput): Promise<OrcamentoSlide> => {
      if (id) {
        const { data, error } = await db
          .from(table as 'orcamento_slides')
          .update({ ...input, atualizado_em: new Date().toISOString() })
          .eq('id', id)
          .select()
          .single();
        if (error) throw error;
        return data as OrcamentoSlide;
      }
      return criarOrcamento.mutateAsync(input);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: orcamentoSlidesQueryKey(schemaEmpresa) });
      qc.invalidateQueries({ queryKey: ['orcamento-slide-por-id', schemaEmpresa, data.id] });
      if (data.lead_id) qc.invalidateQueries({ queryKey: orcamentoPorLeadQueryKey(schemaEmpresa, data.lead_id) });
      qc.invalidateQueries({ queryKey: orcamentoLeadMapQueryKey(schemaEmpresa) });
      toast.success('Orçamento salvo!');
    },
    onError: (e: Error) => toast.error('Erro ao salvar orçamento', { description: e.message }),
  });

  const atualizarStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: OrcamentoSlideStatus }) => {
      const { error } = await db
        .from(table as 'orcamento_slides')
        .update({ status, atualizado_em: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orcamentoSlidesQueryKey(schemaEmpresa) });
      qc.invalidateQueries({ queryKey: orcamentoLeadMapQueryKey(schemaEmpresa) });
      toast.success('Status atualizado!');
    },
    onError: (e: Error) => toast.error('Erro', { description: e.message }),
  });

  const atualizarLinkPublico = useMutation({
    mutationFn: async ({
      id,
      dados,
      lead_id,
      oculto,
    }: {
      id: string;
      dados: OrcamentoDados;
      lead_id: number | null;
      oculto: boolean;
    }) => {
      const novosDados: OrcamentoDados = {
        ...dados,
        _meta: { ...dados._meta, link_publico_oculto: oculto },
      };
      const { error } = await db
        .from(table as 'orcamento_slides')
        .update({ dados: novosDados, atualizado_em: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
      return { lead_id };
    },
    onSuccess: ({ lead_id }, { oculto }) => {
      qc.invalidateQueries({ queryKey: orcamentoSlidesQueryKey(schemaEmpresa) });
      if (lead_id) {
        qc.invalidateQueries({ queryKey: orcamentoPorLeadQueryKey(schemaEmpresa, lead_id) });
      }
      toast.success(oculto ? 'Link público ocultado' : 'Link público ativado', {
        description: oculto
          ? 'Visitantes não conseguem mais ver este orçamento pelo link.'
          : 'Qualquer pessoa com o link pode visualizar o orçamento.',
      });
    },
    onError: (e: Error) => toast.error('Erro ao atualizar link', { description: e.message }),
  });

  const excluirOrcamento = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await db.from(table as 'orcamento_slides').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: orcamentoSlidesQueryKey(schemaEmpresa) });
      qc.invalidateQueries({ queryKey: ['orcamento-slides-lead', schemaEmpresa] });
      qc.invalidateQueries({ queryKey: orcamentoLeadMapQueryKey(schemaEmpresa) });
      toast.success('Orçamento excluído!');
    },
    onError: (e: Error) => toast.error('Erro ao excluir', { description: e.message }),
  });

  /**
   * Duplica orçamento completo: dados (textos, preços, respostas) + todas as mídias
   * (imagens, hotspots, ordem). A cópia nasce como rascunho no mesmo lead.
   */
  const duplicarOrcamento = useMutation({
    mutationFn: async (origem: OrcamentoSlide): Promise<OrcamentoSlide> => {
      const midiasTable = resolveMidiasTable(schemaEmpresa);
      const schema = schemaEmpresa ?? 'public';
      const payload = montarPayloadOrcamentoDuplicado(origem);

      const { data: criado, error: createErr } = await db
        .from(table as 'orcamento_slides')
        .insert({
          ...payload,
          criado_por: user!.id,
          ...(isSchemaApiExposed(schemaEmpresa) ? {} : { schema_nome: schemaEmpresa }),
        })
        .select()
        .single();
      if (createErr) throw createErr;

      const novo = criado as OrcamentoSlide;

      const { data: midiasOrigem, error: midiasErr } = await db
        .from(midiasTable as 'orcamento_slide_midias')
        .select('*')
        .eq('orcamento_id', origem.id)
        .order('ordem', { ascending: true });
      if (midiasErr) throw midiasErr;

      const midias = (midiasOrigem ?? []) as OrcamentoSlideMidia[];
      if (midias.length > 0) {
        const linhas = await montarMidiasDuplicadas(midias, novo.id, (m) =>
          resolverUrlMidiaDuplicada(m, novo.id, schema),
        );

        const { error: insertMidiasErr } = await db
          .from(midiasTable as 'orcamento_slide_midias')
          .insert(
            linhas.map((linha) => ({
              ...linha,
              ...(isSchemaApiExposed(schemaEmpresa) ? {} : { schema_nome: schemaEmpresa }),
            })),
          );
        if (insertMidiasErr) {
          // Rollback do orçamento se as mídias falharem (CASCADE limpa o que houver).
          await db.from(table as 'orcamento_slides').delete().eq('id', novo.id);
          throw insertMidiasErr;
        }
      }

      return novo;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: orcamentoSlidesQueryKey(schemaEmpresa) });
      qc.invalidateQueries({ queryKey: ['orcamento-slide-midias', schemaEmpresa, data.id] });
      if (data.lead_id) {
        qc.invalidateQueries({ queryKey: orcamentoPorLeadQueryKey(schemaEmpresa, data.lead_id) });
      }
      qc.invalidateQueries({ queryKey: orcamentoLeadMapQueryKey(schemaEmpresa) });
      toast.success('Orçamento duplicado!', {
        description: 'A cópia foi criada como rascunho, com imagens e textos.',
      });
    },
    onError: (e: Error) => toast.error('Erro ao duplicar orçamento', { description: e.message }),
  });

  return {
    orcamentos: query.data ?? [],
    isLoading: query.isLoading,
    criarOrcamento,
    salvarProgressoOrcamento,
    salvarOrcamento,
    atualizarStatus,
    atualizarLinkPublico,
    excluirOrcamento,
    duplicarOrcamento,
  };
}

export function useOrcamentoRascunhoAtual(
  leadId?: number | null,
  options?: { enabled?: boolean },
) {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = resolveTable(schemaEmpresa);

  return useQuery({
    queryKey: orcamentoRascunhoAtualQueryKey(schemaEmpresa, user?.id, leadId),
    enabled: (options?.enabled ?? true) && !!user?.id && queriesReady,
    staleTime: 10_000,
    queryFn: async (): Promise<OrcamentoSlide | null> => {
      let q = db
        .from(table as 'orcamento_slides')
        .select('*')
        .eq('status', 'rascunho')
        .eq('criado_por', user!.id)
        .order('atualizado_em', { ascending: false })
        .limit(1);
      if (leadId != null) {
        q = q.eq('lead_id', leadId);
      }
      const { data, error } = await q.maybeSingle();
      if (error) throw error;
      return (data as OrcamentoSlide | null) ?? null;
    },
  });
}

export function useOrcamentoRascunhoPorId(id: string | null | undefined, options?: { enabled?: boolean }) {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = resolveTable(schemaEmpresa);

  return useQuery({
    queryKey: ['orcamento-slide-rascunho', schemaEmpresa, id],
    enabled: (options?.enabled ?? true) && queriesReady && !!id,
    queryFn: async (): Promise<OrcamentoSlide | null> => {
      const { data, error } = await db
        .from(table as 'orcamento_slides')
        .select('*')
        .eq('id', id!)
        .eq('status', 'rascunho')
        .maybeSingle();
      if (error) throw error;
      return data as OrcamentoSlide | null;
    },
  });
}

export function useOrcamentoPorId(id: string | null | undefined) {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = resolveTable(schemaEmpresa);

  return useQuery({
    queryKey: ['orcamento-slide-por-id', schemaEmpresa, id],
    enabled: queriesReady && !!id,
    staleTime: 30_000,
    placeholderData: (previous) => previous,
    queryFn: async (): Promise<OrcamentoSlide | null> => {
      const { data, error } = await db
        .from(table as 'orcamento_slides')
        .select('*')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as OrcamentoSlide | null;
    },
  });
}

export function useOrcamentosPorLead(leadId: number | null | undefined) {
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = resolveTable(schemaEmpresa);

  return useQuery({
    queryKey: orcamentoPorLeadQueryKey(schemaEmpresa, leadId),
    enabled: queriesReady && !!leadId,
    queryFn: async (): Promise<OrcamentoSlide[]> => {
      const { data, error } = await db
        .from(table as 'orcamento_slides')
        .select('*')
        .eq('lead_id', leadId!)
        .order('criado_em', { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrcamentoSlide[];
    },
  });
}

export function useOrcamentosLeadMap() {
  const { user } = useAuth();
  const { schemaEmpresa, queriesReady } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = resolveTable(schemaEmpresa);

  return useQuery({
    queryKey: orcamentoLeadMapQueryKey(schemaEmpresa),
    enabled: !!user?.id && queriesReady,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await db
        .from(table as 'orcamento_slides')
        .select('id, lead_id')
        .not('lead_id', 'is', null);
      if (error) throw error;
      const map = new Map<number, number>();
      for (const row of data ?? []) {
        const lid = row.lead_id as number;
        if (lid) map.set(lid, (map.get(lid) ?? 0) + 1);
      }
      return map;
    },
  });
}
