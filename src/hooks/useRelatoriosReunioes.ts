import { useEffect, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface RelatorioReuniaoRow {
  id: string;
  criado_em: string | null;
  reuniao_id: string | null;
  uid_aluno: string | null;
  telefone: string | null;
  relatorio_reunioes: string | null;
}

function soDigitos(s: string | null | undefined): string {
  if (s == null) return '';
  return String(s).replace(/\D/g, '');
}

/**
 * Busca relatórios por reuniao_id OU por telefone. O telefone da tabela pode bater
 * com qualquer um dos dois campos do card: convidado_whatsapp ou telefone do formulário.
 */
export function useRelatoriosReunioesByReuniao(
  reuniaoId: string | null,
  telefonesCard: (string | null | undefined)[]
) {
  const queryClient = useQueryClient();
  const telefonesNorm = useMemo(
    () => [...new Set(telefonesCard.map(soDigitos).filter(Boolean))],
    [telefonesCard]
  );
  const hasTelefone = telefonesNorm.length > 0;

  useEffect(() => {
    const channel = supabase
      .channel('relatorios-reunioes-realtime')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'CRM-multi-empresas>relatorios_reunioes<',
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ['relatorios-reunioes'] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: ['relatorios-reunioes', reuniaoId, telefonesNorm.join(',')],
    queryFn: async (): Promise<RelatorioReuniaoRow[]> => {
      if (!reuniaoId && !hasTelefone) return [];

      const { data, error } = await supabase
        .from('CRM-multi-empresas>relatorios_reunioes<')
        .select('id, criado_em, reuniao_id, uid_aluno, telefone, relatorio_reunioes')
        .order('criado_em', { ascending: false });

      if (error) {
        console.error('Erro ao buscar relatórios de reunião:', error);
        return [];
      }

      const rows = (data ?? []) as RelatorioReuniaoRow[];
      const filtrado = rows.filter((row) => {
        if (reuniaoId && row.reuniao_id === reuniaoId) return true;
        const rowTel = soDigitos(row.telefone);
        if (rowTel && telefonesNorm.some((t) => t === rowTel)) return true;
        return false;
      });

      return filtrado.sort((a, b) => {
        const da = a.criado_em ? new Date(a.criado_em).getTime() : 0;
        const db = b.criado_em ? new Date(b.criado_em).getTime() : 0;
        return db - da;
      });
    },
    enabled: !!reuniaoId || hasTelefone,
  });
}
