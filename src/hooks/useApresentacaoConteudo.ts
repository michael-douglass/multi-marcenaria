/**
 * Conteúdo da apresentação para arquitetos / Pontua da empresa ativa (`crm.apresentacao_conteudo`)
 * e do link público (`apresentacao_publica(slug)`). Ver docs/modelos-padrao/DESIGN.md §4.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useAppOptional } from '@/context/AppContext';

export interface ApresentacaoSalva {
  conteudo: Record<string, unknown>;
  pontua: Record<string, unknown>;
}

export interface ApresentacaoPublica extends ApresentacaoSalva {
  empresa_id: string;
  nome: string;
  slug: string;
  logo_url: string | null;
}

type Resultado<T> = { data: T | null; error: { message: string } | null };

function tabelaCrm() {
  // Tabela nova, fora dos tipos gerados: o cast fica restrito a este ponto.
  const crm = supabase.schema('crm' as never) as unknown as {
    from: (t: string) => {
      select: (c: string) => { maybeSingle: () => Promise<Resultado<ApresentacaoSalva>> };
      upsert: (v: Record<string, unknown>, o: { onConflict: string }) => Promise<Resultado<unknown>>;
    };
  };
  return crm.from('apresentacao_conteudo');
}

const chave = (empresaId: string | undefined) => ['apresentacao-conteudo', empresaId ?? 'sem-empresa'] as const;

/** Conteúdo salvo da empresa ativa (null = ainda não editou: usa o padrão). */
export function useApresentacaoConteudo() {
  const empresaId = useAppOptional()?.empresa?.id;
  return useQuery({
    queryKey: chave(empresaId),
    enabled: !!empresaId,
    queryFn: async () => {
      const { data, error } = await tabelaCrm().select('conteudo, pontua').maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 60_000,
  });
}

export function useSalvarApresentacaoConteudo() {
  const empresaId = useAppOptional()?.empresa?.id;
  const userId = useAppOptional()?.user?.id;
  const qc = useQueryClient();
  return useMutation({
    // Cada editor manda só a sua coluna (apresentação → conteudo, Pontua → pontua): o upsert atualiza
    // apenas as colunas enviadas, então um editor não sobrescreve o outro.
    mutationFn: async (v: Partial<ApresentacaoSalva>) => {
      if (!empresaId) throw new Error('Sem empresa ativa');
      const linha: Record<string, unknown> = { empresa_id: empresaId, atualizado_em: new Date().toISOString(), atualizado_por: userId ?? null };
      if (v.conteudo) linha.conteudo = v.conteudo;
      if (v.pontua) linha.pontua = v.pontua;
      // empresa_id vai no onConflict porque a unicidade é por empresa; o trigger preenche no insert.
      const { error } = await tabelaCrm().upsert(linha, { onConflict: 'empresa_id' });
      if (error) throw new Error(error.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: chave(empresaId) }),
  });
}

/** Link público: conteúdo e identidade da empresa pelo slug (sem login). */
export function useApresentacaoPublica(slug: string | undefined) {
  return useQuery({
    queryKey: ['apresentacao-publica', slug],
    enabled: !!slug,
    queryFn: async () => {
      const call = supabase.rpc as unknown as (f: string, a: Record<string, unknown>) => Promise<Resultado<ApresentacaoPublica>>;
      const { data, error } = await call.call(supabase, 'apresentacao_publica', { p_slug: slug });
      if (error) throw new Error(error.message);
      return data;
    },
    staleTime: 5 * 60_000,
  });
}
