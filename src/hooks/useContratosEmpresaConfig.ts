import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useAuth } from '@/contexts/AuthContext';

const EMPRESAS_TABLE = 'CRM-multi-empresas>empresas<' as const;

export interface ContratosEmpresaConfig {
  razaoSocial: string;
  cnpj: string;
  nomeFantasia: string;
}

/** Máscara CNPJ: XX.XXX.XXX/XXXX-XX */
function formatCNPJ(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0, 2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8)}`;
  return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
}

export function useContratosEmpresaConfig() {
  const { empresa, recarregarEmpresa } = useEmpresa();
  const { user } = useAuth();
  const qc = useQueryClient();
  const queryKey = ['contratos-empresa-config', empresa?.id] as const;

  const { data, isLoading } = useQuery({
    queryKey,
    enabled: !!empresa?.id,
    queryFn: async (): Promise<ContratosEmpresaConfig> => {
      const { data: row, error } = await supabase
        .from(EMPRESAS_TABLE as never)
        .select('nome, cnpj, razao_social')
        .eq('id', empresa!.id)
        .maybeSingle();
      if (error) throw error;
      const r = row as { nome?: string; cnpj?: string | null; razao_social?: string | null } | null;
      return {
        nomeFantasia: r?.nome ?? empresa!.nome,
        razaoSocial: r?.razao_social ?? '',
        cnpj: r?.cnpj ?? '',
      };
    },
  });

  const salvar = useMutation({
    mutationFn: async (input: { razaoSocial: string; cnpj: string }) => {
      if (!empresa?.id) throw new Error('Nenhuma empresa selecionada');
      const { error } = await supabase
        .from(EMPRESAS_TABLE as never)
        .update({
          razao_social: input.razaoSocial.trim() || null,
          cnpj: input.cnpj.trim() || null,
        } as never)
        .eq('id', empresa.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      if (user?.id) await recarregarEmpresa(user.id);
      qc.invalidateQueries({ queryKey });
      toast.success('Dados da contratada salvos!');
    },
    onError: (e: Error) =>
      toast.error('Erro ao salvar', { description: e.message }),
  });

  return {
    config: data,
    isLoading,
    salvar,
    formatCNPJ,
  };
}

/** Lê config da empresa ativa (para preview/impressão). */
export function getContratosEmpresaFromContext(
  empresa: { nome?: string; razao_social?: string | null; cnpj?: string | null } | null | undefined,
) {
  if (!empresa) {
    return { nomeFantasia: '', razaoSocial: '', cnpj: '' };
  }
  return {
    nomeFantasia: empresa.nome ?? '',
    razaoSocial: empresa.razao_social ?? '',
    cnpj: empresa.cnpj ?? '',
  };
}
