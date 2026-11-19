import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useApp } from '@/context/AppContext';
import type { Empresa } from '@/contexts/EmpresaContext';
import { toast } from 'sonner';

export interface EmpresaBrandingInput {
  nome: string;
  cor_primaria: string;
  logo_url?: string | null;
}

/** Dados cadastrais gravados pela RPC `empresa_atualizar_dados` (whitelist do banco). */
export interface EmpresaDadosInput {
  nome?: string;
  razao_social?: string | null;
  /** Com ou sem máscara: o banco guarda só os 14 dígitos. */
  cnpj?: string | null;
  cep?: string | null;
  logradouro?: string | null;
  numero?: string | null;
  complemento?: string | null;
  bairro?: string | null;
  cidade?: string | null;
  uf?: string | null;
  telefone?: string | null;
  email?: string | null;
  logo_url?: string | null;
  cor_primaria?: string | null;
  representante_nome?: string | null;
  /** Com ou sem máscara: o banco guarda só os 11 dígitos e valida. */
  representante_cpf?: string | null;
  representante_qualificacao?: string | null;
}

/** Envia a logo para o bucket público `empresa-branding` (pasta da empresa) e devolve a URL. */
export async function uploadLogo(empresaId: string, file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
  const filePath = `${empresaId}/logo.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from('empresa-branding')
    .upload(filePath, file, { upsert: true, contentType: file.type });

  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('empresa-branding').getPublicUrl(filePath);
  return `${data.publicUrl}?t=${Date.now()}`;
}

/**
 * Grava dados da empresa ATIVA pela RPC (só admin da empresa ou master com acesso total).
 * O UPDATE direto na tabela falha por recursão de policy — ver docs/identidade-empresa/DESIGN.md §2.1.
 */
export async function atualizarDadosEmpresa(dados: EmpresaDadosInput): Promise<void> {
  const { error } = await supabase.rpc('empresa_atualizar_dados' as never, { p_dados: dados } as never);
  if (error) throw new Error(error.message);
}

/**
 * Logo, nome, cor e dados cadastrais da empresa ativa.
 * `empresaAlvo` existe por compatibilidade com telas antigas; a RPC só grava a empresa ativa.
 */
export function useEmpresaBranding(empresaAlvo?: Empresa | null) {
  const { empresa: ativa, recarregarEmpresa } = useApp();
  const queryClient = useQueryClient();
  const empresaId = empresaAlvo?.id ?? ativa?.id ?? null;

  const garantirEmpresaAtiva = () => {
    if (!empresaId) throw new Error('Nenhuma empresa selecionada');
    if (!ativa || ativa.id !== empresaId) {
      throw new Error('Só é possível alterar a empresa em que você está trabalhando.');
    }
    return empresaId;
  };

  const aposSalvar = () => {
    recarregarEmpresa();
    queryClient.invalidateQueries({ queryKey: ['empresas-lista'] });
    queryClient.invalidateQueries({ queryKey: ['contratos-empresa-config'] });
  };

  const salvarBranding = useMutation({
    mutationFn: async ({ dados, logoFile }: { dados: EmpresaBrandingInput; logoFile?: File | null }) => {
      const id = garantirEmpresaAtiva();
      let logo_url = dados.logo_url ?? empresaAlvo?.logo_url ?? ativa?.logoUrl ?? null;
      if (logoFile) logo_url = await uploadLogo(id, logoFile);
      await atualizarDadosEmpresa({ nome: dados.nome.trim(), cor_primaria: dados.cor_primaria, logo_url });
    },
    onSuccess: () => {
      aposSalvar();
      toast.success('Identidade visual atualizada!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar identidade visual', { description: error.message });
    },
  });

  const removerLogo = useMutation({
    mutationFn: async () => {
      garantirEmpresaAtiva();
      await atualizarDadosEmpresa({ logo_url: null });
    },
    onSuccess: () => {
      aposSalvar();
      toast.success('Logo removida');
    },
    onError: (error: Error) => {
      toast.error('Erro ao remover logo', { description: error.message });
    },
  });

  const salvarDadosEmpresa = useMutation({
    mutationFn: async ({ dados, logoFile }: { dados: EmpresaDadosInput; logoFile?: File | null }) => {
      const id = garantirEmpresaAtiva();
      const payload: EmpresaDadosInput = { ...dados };
      if (logoFile) payload.logo_url = await uploadLogo(id, logoFile);
      await atualizarDadosEmpresa(payload);
    },
    onSuccess: () => {
      aposSalvar();
      toast.success('Dados da empresa salvos!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao salvar dados da empresa', { description: error.message });
    },
  });

  return {
    empresa: empresaAlvo ?? null,
    empresaAtiva: ativa,
    salvarBranding,
    removerLogo,
    salvarDadosEmpresa,
  };
}
