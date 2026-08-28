import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { MASTER_TABLES } from '@/lib/empresa-tables';
import { toast } from 'sonner';

const PUBLIC_LANC  = 'CRM-multi-empresas>pontua_garbo_lancamentos<' as const;
const PUBLIC_SAQUES = 'CRM-multi-empresas>prestador_saque_pedidos<' as const;

export interface SaquePedido {
  id: string;
  prestador_id: string;
  valor_solicitado: number;
  chave_pix: string;
  tipo_chave_pix: string;
  status: 'pendente' | 'aprovado' | 'rejeitado';
  obs_admin: string | null;
  criado_em: string;
  processado_em: string | null;
}

export type TipoChavePix = 'cpf' | 'cnpj' | 'email' | 'telefone' | 'aleatoria';

export const TIPO_PIX_LABELS: Record<TipoChavePix, string> = {
  cpf:      'CPF',
  cnpj:     'CNPJ',
  email:    'E-mail',
  telefone: 'Telefone',
  aleatoria: 'Chave Aleatória',
};

/** Salva chave PIX no perfil (sem toast — uso em auto-save no modal de saque). */
export function useSalvarChavePixPrestador() {
  const { user } = useAuth();
  const { schemaEmpresa } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const qc = useQueryClient();
  const usersTable = table('usuarios', MASTER_TABLES.usuarios);

  return useMutation({
    mutationFn: async (input: { chave_pix: string; tipo_chave_pix: string }) => {
      if (!user?.id) throw new Error('Não autenticado');
      const chave = input.chave_pix.trim();
      if (!chave) throw new Error('Informe a chave PIX');
      const { error } = await db
        .from(usersTable)
        .update({ chave_pix: chave, tipo_chave_pix: input.tipo_chave_pix })
        .eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-user-profile', user?.id, schemaEmpresa] });
    },
  });
}

/** Update the current prestador's own profile fields */
export function useAtualizarPerfilPrestador() {
  const { user } = useAuth();
  const { schemaEmpresa } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const qc = useQueryClient();

  const usersTable = table('usuarios', MASTER_TABLES.usuarios);

  return useMutation({
    mutationFn: async (updates: {
      telefone?: string | null;
      avatar_url?: string | null;
      chave_pix?: string | null;
      tipo_chave_pix?: string | null;
    }) => {
      if (!user?.id) throw new Error('Não autenticado');
      const { error } = await db.from(usersTable).update(updates).eq('id', user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-user-profile', user?.id, schemaEmpresa] });
      toast.success('Perfil atualizado!');
    },
    onError: (e: Error) => toast.error('Erro ao atualizar perfil', { description: e.message }),
  });
}

/** Upload avatar photo for prestador */
export function useUploadAvatarPrestador() {
  const { user } = useAuth();
  const { schemaEmpresa } = useEmpresa();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const qc = useQueryClient();
  const usersTable = table('usuarios', MASTER_TABLES.usuarios);

  return useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error('Não autenticado');
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `prestadores/${user.id}/avatar.${ext}`;
      const { error: uploadErr } = await supabase.storage
        .from('empresa-branding')
        .upload(path, file, { upsert: true, contentType: file.type });
      if (uploadErr) throw uploadErr;
      const { data } = supabase.storage.from('empresa-branding').getPublicUrl(path);
      const url = `${data.publicUrl}?t=${Date.now()}`;
      const { error: updateErr } = await db.from(usersTable).update({ avatar_url: url }).eq('id', user.id);
      if (updateErr) throw updateErr;
      return url;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['current-user-profile', user?.id, schemaEmpresa] });
      toast.success('Foto atualizada!');
    },
    onError: (e: Error) => toast.error('Erro ao enviar foto', { description: e.message }),
  });
}

/** Prestador-initiated withdrawal request */
export function useSaquePedidos(prestadorId: string | null | undefined) {
  const { schemaEmpresa } = useEmpresa();
  const { user } = useAuth();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const qc = useQueryClient();
  const saquesTable = table('prestador_saque_pedidos', PUBLIC_SAQUES);
  const lancTable    = table('pontua_garbo_lancamentos', PUBLIC_LANC);
  const queryKey = ['prestador-saque-pedidos', schemaEmpresa, prestadorId] as const;

  const { data: pedidos = [] } = useMutation({
    // We use a query via React Query useQuery instead, but to keep in one hook:
    mutationFn: async () => [] as SaquePedido[],
  });

  const solicitarSaque = useMutation({
    mutationFn: async (input: { valor: number; chave_pix: string; tipo_chave_pix: string }) => {
      if (!prestadorId) throw new Error('Prestador não identificado');
      const { error } = await db.from(saquesTable).insert({
        prestador_id: prestadorId,
        valor_solicitado: input.valor,
        chave_pix: input.chave_pix,
        tipo_chave_pix: input.tipo_chave_pix,
        status: 'pendente',
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prestador-saque-pedidos', schemaEmpresa, prestadorId] });
      qc.invalidateQueries({ queryKey: ['minha-pontua-garbo', schemaEmpresa, prestadorId] });
      toast.success('Solicitação de retirada enviada ao administrador!');
    },
    onError: (e: Error) => toast.error('Erro ao solicitar retirada', { description: e.message }),
  });

  // Admin approves a pedido → creates a lancamento
  const aprovarSaque = useMutation({
    mutationFn: async (pedidoId: string) => {
      const { data: pedido, error: fetchErr } = await db
        .from(saquesTable)
        .select('*')
        .eq('id', pedidoId)
        .single();
      if (fetchErr) throw fetchErr;
      const p = pedido as SaquePedido;

      const { error: lancErr } = await db.from(lancTable).insert({
        prestador_id: p.prestador_id,
        tipo: 'saque',
        valor: p.valor_solicitado,
        descricao: `Retirada via ${TIPO_PIX_LABELS[p.tipo_chave_pix as TipoChavePix] ?? p.tipo_chave_pix}: ${p.chave_pix}`,
        criado_por: user?.id ?? null,
      });
      if (lancErr) throw lancErr;

      const { error: updateErr } = await db
        .from(saquesTable)
        .update({ status: 'aprovado', processado_em: new Date().toISOString(), processado_por: user?.id ?? null })
        .eq('id', pedidoId);
      if (updateErr) throw updateErr;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prestador-saque-pedidos'] });
      qc.invalidateQueries({ queryKey: ['pontua-garbo-financeiro'] });
      qc.invalidateQueries({ queryKey: ['minha-pontua-garbo'] });
      toast.success('Retirada aprovada e lançada!');
    },
    onError: (e: Error) => toast.error('Erro ao aprovar retirada', { description: e.message }),
  });

  const rejeitarSaque = useMutation({
    mutationFn: async ({ pedidoId, obs }: { pedidoId: string; obs?: string }) => {
      const { error } = await db
        .from(saquesTable)
        .update({
          status: 'rejeitado',
          obs_admin: obs ?? null,
          processado_em: new Date().toISOString(),
          processado_por: user?.id ?? null,
        })
        .eq('id', pedidoId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['prestador-saque-pedidos'] });
      toast.success('Pedido rejeitado');
    },
    onError: (e: Error) => toast.error('Erro ao rejeitar', { description: e.message }),
  });

  return { solicitarSaque, aprovarSaque, rejeitarSaque, pedidos };
}
