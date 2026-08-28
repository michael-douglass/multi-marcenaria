import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { getVendedorPermissionDefault } from '@/lib/vendedor-permission-defaults';

export type PermissionResource = 
  | 'dashboard'
  | 'dashboard_total_revenue'
  | 'dashboard_origin_chart'
  | 'lead_phone'
  | 'lead_email'
  | 'lead_company'
  | 'lead_origin'
  | 'lead_value'
  | 'lead_vendor'
  | 'lead_status'
  | 'lead_name'
  | 'lead_observations'
  | 'lead_whatsapp_history'
  | 'send_whatsapp'
  | 'webhooks_api'
  | 'all_leads'
  | 'leads'
  | 'pipeline'
  | 'numeros_negativados';

export type PermissionAction = 'view' | 'edit';

export interface Permission {
  id: string;
  role: string;
  resource: string;
  action: string;
  allowed: boolean;
  criado_em: string;
}

export function usePermissions() {
  const { userRole, userRoles, user, isSuperAdmin, hasRole } = useAuth();

  const { data: permissions = [], isLoading: isQueryLoading } = useQuery({
    queryKey: ['permissions', userRoles],
    queryFn: async () => {
      const rolesToLoad = (userRoles.length ? userRoles : userRole ? [userRole] : [])
        .filter((role) => role !== 'nenhum');

      if (rolesToLoad.length === 0) return [];

      const { data, error } = await supabase
        .from('CRM-multi-empresas>user_permissions<')
        .select('*')
        .in('role', rolesToLoad);

      if (error) {
        console.error('Error fetching permissions:', error);
        return [];
      }

      return data as Permission[];
    },
    enabled:
      !!userRole &&
      (userRoles.some((role) => role !== 'nenhum') || (userRole !== 'nenhum')),
  });

  // Considerar loading se userRole ainda não foi definido (AuthContext ainda carregando)
  // ou se a query está efetivamente carregando
  const isLoading = userRole === null || isQueryLoading;

  const hasPermission = (resource: PermissionResource, action: PermissionAction): boolean => {
    // Admin e usuário master sempre têm todas as permissões
    if (hasRole('admin') || isSuperAdmin) return true;

    // Nenhum não tem nenhuma permissão
    if (!userRole || (userRoles.length === 0 && userRole === 'nenhum') || (userRoles.length === 1 && userRoles[0] === 'nenhum')) {
      return false;
    }

    const matching = permissions.filter(
      (p) => p.resource === resource && p.action === action
    );

    if (matching.length > 0) {
      return matching.some((p) => p.allowed);
    }

    // Vendedor: defaults de CRM (pipeline, leads, edição) quando o admin não configurou o item
    if (hasRole('vendedor')) {
      return getVendedorPermissionDefault(resource, action);
    }

    return false;
  };

  return {
    hasPermission,
    permissions,
    isLoading,
    userRole,
    userRoles,
    hasRole,
    user,
  };
}
