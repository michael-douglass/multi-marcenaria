import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase } from '@/hooks/useEmpresaSupabase';
import { resolveEmpresaTableNames } from '@/lib/empresa-tables';
import { normalizeRoles, pickPrimaryRole, rolesEqual } from '@/lib/app-roles';
import type { AppUserRole } from '@/lib/resolve-auth-role';

export type TipoUsuario = 'colaborador' | 'lead' | 'prestador_servico';

export type UserAppRole = AppUserRole;

export interface DatabaseUser {
  id: string;
  nome: string;
  email: string | null;
  telefone: string | null;
  avatar_url?: string | null;
  criado_em: string;
  /** Papel principal (compat). */
  role: UserAppRole;
  /** Todas as funções do usuário. */
  roles: UserAppRole[];
  /** Horário início (HH:mm ou HH:mm:ss). Null = sem restrição */
  horario_acesso_inicio?: string | null;
  /** Horário fim (HH:mm ou HH:mm:ss). Null = sem restrição */
  horario_acesso_fim?: string | null;
  /** Tipo do usuário no sistema */
  tipo_usuario?: TipoUsuario;
  /** Título personalizado para prestadores de serviço */
  titulo?: string | null;
  /** Se true, o prestador participa do Programa Pontua Garbo */
  comissao_ativa?: boolean;
  /** Chave PIX do prestador para recebimentos */
  chave_pix?: string | null;
  /** Tipo da chave PIX: cpf | cnpj | email | telefone | aleatoria */
  tipo_chave_pix?: string | null;
}

export function useUsers() {
  const queryClient = useQueryClient();
  const { empresa, schemaEmpresa } = useEmpresa();
  const db = useEmpresaSupabase();
  const tables = resolveEmpresaTableNames(schemaEmpresa);

  const { data: users, isLoading } = useQuery({
    queryKey: ['users', empresa?.id ?? 'master'],
    queryFn: async () => {
      const { data: usuariosData, error: usuariosError } = await db
        .from(tables.usuarios)
        .select('*')
        .eq('status_convite', 'ATIVO')
        .order('nome');

      if (usuariosError) throw usuariosError;

      const { data: rolesData, error: rolesError } = await db
        .from(tables.user_roles)
        .select('user_id, role');

      if (rolesError) throw rolesError;

      const rolesByUser = new Map<string, UserAppRole[]>();
      for (const row of rolesData ?? []) {
        const list = rolesByUser.get(row.user_id) ?? [];
        list.push(row.role as UserAppRole);
        rolesByUser.set(row.user_id, list);
      }

      const usersWithRoles = usuariosData.map((user) => {
        const roles = normalizeRoles(rolesByUser.get(user.id) ?? ['nenhum']);
        return {
          ...user,
          roles,
          role: pickPrimaryRole(roles),
          tipo_usuario: (user.tipo_usuario as TipoUsuario) ?? 'colaborador',
          titulo: user.titulo ?? null,
        };
      });

      return usersWithRoles as DatabaseUser[];
    },
  });

  const updateUserRoles = useMutation({
    mutationFn: async ({
      userId,
      roles,
    }: {
      userId: string;
      roles: UserAppRole[];
    }) => {
      const nextRoles = normalizeRoles(roles);

      const { error: deleteError } = await db
        .from(tables.user_roles)
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      const { error: insertError } = await db
        .from(tables.user_roles)
        .insert(nextRoles.map((role) => ({ user_id: userId, role })));

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Funções atualizadas com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar funções', {
        description: error.message,
      });
    },
  });

  /** Compat: atualiza para um único papel. */
  const updateUserRole = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: UserAppRole }) => {
      await updateUserRoles.mutateAsync({ userId, roles: [role] });
    },
  });

  const updateUser = useMutation({
    mutationFn: async ({ userId, updates }: {
      userId: string;
      updates: {
        nome?: string;
        email?: string;
        telefone?: string;
        avatar_url?: string;
        horario_acesso_inicio?: string | null;
        horario_acesso_fim?: string | null;
        tipo_usuario?: TipoUsuario;
        titulo?: string | null;
        comissao_ativa?: boolean;
      }
    }) => {
      const { error } = await db
        .from(tables.usuarios)
        .update(updates)
        .eq('id', userId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      toast.success('Usuário atualizado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao atualizar usuário', {
        description: error.message,
      });
    },
  });

  const deleteUser = useMutation({
    mutationFn: async ({ userId, transferToUserId }: { userId: string; transferToUserId?: string }) => {
      const { data, error } = await supabase.functions.invoke('delete-user', {
        body: { userId, transferToUserId, empresaId: empresa?.id, schemaNome: schemaEmpresa },
      });

      const payload = data as {
        ok?: boolean;
        error?: string;
        message?: string;
        partial?: boolean;
      } | null;

      if (payload?.error && payload?.ok !== true) {
        throw new Error(payload.error);
      }

      if (!payload?.ok) {
        throw new Error('Resposta inválida do servidor ao excluir usuário');
      }

      if (error) {
        let message = error.message || 'Erro ao excluir usuário via Edge Function';
        const ctx = (error as { context?: Response }).context;
        if (ctx) {
          try {
            const errBody = (await ctx.clone().json()) as { error?: string };
            if (errBody?.error) message = errBody.error;
          } catch {
            try {
              const text = await ctx.clone().text();
              if (text) message = text;
            } catch {
              /* ignora */
            }
          }
        }
        throw new Error(message);
      }

      return payload;
    },
    onSuccess: (payload) => {
      queryClient.invalidateQueries({ queryKey: ['users'] });
      if (payload?.partial) {
        toast.success('Usuário removido da empresa', {
          description: payload.message,
        });
      } else {
        toast.success(payload?.message ?? 'Usuário excluído com sucesso!');
      }
    },
    onError: (error: Error) => {
      toast.error('Erro ao excluir usuário', {
        description: error.message,
      });
    },
  });

  const createUser = useMutation({
    mutationFn: async ({
      nome,
      email,
      telefone,
      role,
      roles,
      tipo_usuario = 'colaborador',
      titulo,
      comissao_ativa,
    }: {
      nome: string;
      email: string;
      telefone?: string;
      role?: UserAppRole;
      roles?: UserAppRole[];
      tipo_usuario?: TipoUsuario;
      titulo?: string;
      comissao_ativa?: boolean;
    }) => {
      if (!empresa?.id || !schemaEmpresa) {
        throw new Error(
          'Selecione a empresa no menu (Gerenciamento de Empresas → Entrar) antes de cadastrar usuários.'
        );
      }

      const nextRoles = normalizeRoles(roles?.length ? roles : role ? [role] : ['nenhum']);

      const { data, error } = await supabase.functions.invoke('create-user-admin', {
        body: {
          nome,
          email,
          telefone,
          role: pickPrimaryRole(nextRoles),
          roles: nextRoles,
          tipo_usuario,
          titulo: titulo || null,
          comissao_ativa: comissao_ativa ?? false,
          empresaId: empresa.id,
          schemaNome: schemaEmpresa,
        },
      });

      if (error) {
        const message = (data as { error?: string })?.error || error.message || 'Erro ao criar usuário via Edge Function';
        throw new Error(message);
      }

      if (data?.error) {
        throw new Error(data.error as string);
      }

      return data;
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['users'] });
      await queryClient.refetchQueries({ queryKey: ['users'] });
      toast.success('Usuário criado com sucesso!');
    },
    onError: (error: Error) => {
      toast.error('Erro ao criar usuário', {
        description: error.message,
      });
    },
  });

  const resetUserPassword = useMutation({
    mutationFn: async ({
      userId,
      newPassword,
      silent,
    }: {
      userId: string;
      newPassword: string;
      silent?: boolean;
    }) => {
      const { data, error } = await supabase.functions.invoke('reset-user-password', {
        body: { userId, newPassword, schemaNome: schemaEmpresa },
      });

      const payload = data as { error?: string; success?: boolean; message?: string } | null;

      if (payload?.error) {
        throw new Error(payload.error);
      }

      if (error) {
        let message = error.message || 'Erro ao redefinir senha';
        if (message.includes('non-2xx')) {
          message = 'Não foi possível redefinir a senha. Verifique se ela atende às regras de segurança.';
        }
        const ctx = (error as { context?: Response }).context;
        if (ctx) {
          try {
            const errBody = (await ctx.clone().json()) as { error?: string };
            if (errBody?.error) message = errBody.error;
          } catch {
            try {
              const text = await ctx.clone().text();
              if (text) {
                try {
                  const parsed = JSON.parse(text) as { error?: string };
                  message = parsed.error || text;
                } catch {
                  message = text;
                }
              }
            } catch {
              /* ignora */
            }
          }
        }
        throw new Error(message);
      }

      if (!payload?.success) {
        throw new Error('Resposta inválida do servidor');
      }

      return { ...payload, silent: !!silent };
    },
    onSuccess: (result) => {
      if (!result.silent) {
        toast.success('Senha redefinida com sucesso!');
      }
    },
    onError: (error: Error) => {
      toast.error('Erro ao redefinir senha', {
        description: error.message,
      });
    },
  });

  return {
    users,
    isLoading,
    updateUserRole,
    updateUserRoles,
    updateUser,
    deleteUser,
    createUser,
    resetUserPassword,
    rolesEqual,
    empresaAtiva: empresa,
    hasEmpresaSelecionada: !!empresa?.id && !!schemaEmpresa,
  };
}
