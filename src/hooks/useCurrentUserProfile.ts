import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useEmpresa } from '@/contexts/EmpresaContext';
import { useEmpresaSupabase, useTableName } from '@/hooks/useEmpresaSupabase';
import { isSchemaApiExposed, MASTER_TABLES } from '@/lib/empresa-tables';
import type { DatabaseUser } from '@/hooks/useUsers';

/** Carrega apenas o usuário logado (não depende da lista completa de usuários). */
export function useCurrentUserProfile() {
  const { user } = useAuth();
  const db = useEmpresaSupabase();
  const table = useTableName();
  const { schemaEmpresa } = useEmpresa();

  return useQuery({
    queryKey: ['current-user-profile', user?.id, schemaEmpresa],
    enabled: !!user?.id,
    queryFn: async (): Promise<DatabaseUser | null> => {
      if (!user?.id) return null;

      const usuariosTable = table('usuarios', MASTER_TABLES.usuarios);
      const rolesTable = table('user_roles', MASTER_TABLES.user_roles);

      const { data: usuario, error: usuarioError } = await db
        .from(usuariosTable)
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (usuarioError) throw usuarioError;

      let resolvedUsuario = usuario;
      let roleDb = db;
      let resolvedRolesTable = rolesTable;

      // Super admin / master: perfil pode estar só em public, não no schema da empresa ativa
      if (!resolvedUsuario && schemaEmpresa && isSchemaApiExposed(schemaEmpresa)) {
        const { data: masterUsuario, error: masterError } = await supabase
          .from(MASTER_TABLES.usuarios)
          .select('*')
          .eq('id', user.id)
          .maybeSingle();
        if (masterError) throw masterError;
        if (masterUsuario) {
          resolvedUsuario = masterUsuario;
          roleDb = supabase;
          resolvedRolesTable = MASTER_TABLES.user_roles;
        }
      }

      if (!resolvedUsuario) return null;

      const { data: roleRow, error: roleError } = await roleDb
        .from(resolvedRolesTable)
        .select('role')
        .eq('user_id', user.id)
        .maybeSingle();

      if (roleError) throw roleError;

      return {
        ...resolvedUsuario,
        role: (roleRow?.role as DatabaseUser['role']) || 'nenhum',
      } as DatabaseUser;
    },
    staleTime: 60_000,
  });
}
