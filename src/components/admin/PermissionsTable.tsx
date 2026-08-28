import { useState, useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { Loader2 } from 'lucide-react';

interface PermissionRow {
  resource: string;
  label: string;
  category: string;
  viewKey: string;
  editKey?: string;
}

const PERMISSION_ROWS: PermissionRow[] = [
  // Dashboard
  { resource: 'dashboard', label: 'Dashboard Completo', category: 'Dashboard', viewKey: 'dashboard' },
  { resource: 'dashboard_total_revenue', label: 'Valor Total da Empresa', category: 'Dashboard', viewKey: 'dashboard_total_revenue' },
  { resource: 'dashboard_origin_chart', label: 'Gráfico Leads/Vendas por Origem', category: 'Dashboard', viewKey: 'dashboard_origin_chart' },
  
  // Dados do Lead
  { resource: 'lead_phone', label: 'Telefone do Lead', category: 'Dados do Lead', viewKey: 'lead_phone', editKey: 'lead_phone' },
  { resource: 'lead_email', label: 'Email do Lead', category: 'Dados do Lead', viewKey: 'lead_email', editKey: 'lead_email' },
  { resource: 'lead_company', label: 'Empresa do Lead', category: 'Dados do Lead', viewKey: 'lead_company', editKey: 'lead_company' },
  { resource: 'lead_origin', label: 'Origem do Lead', category: 'Dados do Lead', viewKey: 'lead_origin', editKey: 'lead_origin' },
  { resource: 'lead_value', label: 'Valor do Negócio', category: 'Dados do Lead', viewKey: 'lead_value', editKey: 'lead_value' },
  { resource: 'lead_vendor', label: 'Vendedor Responsável', category: 'Dados do Lead', viewKey: 'lead_vendor', editKey: 'lead_vendor' },
  { resource: 'lead_status', label: 'Status do Lead', category: 'Dados do Lead', viewKey: 'lead_status', editKey: 'lead_status' },
  { resource: 'lead_name', label: 'Nome do Lead', category: 'Dados do Lead', viewKey: 'lead_name', editKey: 'lead_name' },
  { resource: 'lead_observations', label: 'Observações do Lead', category: 'Dados do Lead', viewKey: 'lead_observations', editKey: 'lead_observations' },
  { resource: 'lead_whatsapp_history', label: 'Histórico WhatsApp do Lead', category: 'Dados do Lead', viewKey: 'lead_whatsapp_history' },
  
  // Acesso Geral
  { resource: 'all_leads', label: 'Ver Todos os Leads', category: 'Acesso Geral', viewKey: 'all_leads' },
  { resource: 'leads', label: 'Página de Leads', category: 'Acesso Geral', viewKey: 'leads' },
  { resource: 'pipeline', label: 'Página de Pipeline', category: 'Acesso Geral', viewKey: 'pipeline' },
  
  // Automações
  { resource: 'numeros_negativados', label: 'Ver Números Negativados', category: 'Automações', viewKey: 'numeros_negativados' },
];

interface PermissionsTableProps {
  role: 'vendedor' | 'nenhum';
}

export function PermissionsTable({ role }: PermissionsTableProps) {
  const queryClient = useQueryClient();
  const [localPermissions, setLocalPermissions] = useState<Record<string, boolean>>({});

  const { data: permissions, isLoading } = useQuery({
    queryKey: ['permissions', role],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('CRM-multi-empresas>user_permissions<')
        .select('*')
        .eq('role', role);

      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (permissions) {
      const permMap: Record<string, boolean> = {};
      permissions.forEach((perm) => {
        const key = `${perm.resource}_${perm.action}`;
        permMap[key] = perm.allowed;
      });
      setLocalPermissions(permMap);
    }
  }, [permissions]);

  const updatePermissionMutation = useMutation({
    mutationFn: async ({ resource, action, allowed }: { resource: string; action: string; allowed: boolean }) => {
      const { error } = await supabase
        .from('CRM-multi-empresas>user_permissions<')
        .upsert(
          { role, resource, action, allowed },
          { onConflict: 'role,resource,action' }
        );

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['permissions', role] });
      toast({
        title: 'Permissão atualizada',
        description: 'A permissão foi atualizada com sucesso.',
      });
    },
    onError: (error) => {
      console.error('Error updating permission:', error);
      toast({
        title: 'Erro ao atualizar permissão',
        description: 'Ocorreu um erro ao atualizar a permissão.',
        variant: 'destructive',
      });
    },
  });

  const handleToggle = (resource: string, action: 'view' | 'edit', currentValue: boolean) => {
    const newValue = !currentValue;
    const key = `${resource}_${action}`;
    
    setLocalPermissions((prev) => ({ ...prev, [key]: newValue }));
    updatePermissionMutation.mutate({ resource, action, allowed: newValue });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  const groupedRows = PERMISSION_ROWS.reduce((acc, row) => {
    if (!acc[row.category]) {
      acc[row.category] = [];
    }
    acc[row.category].push(row);
    return acc;
  }, {} as Record<string, PermissionRow[]>);

  return (
    <div className="space-y-6">
      {Object.entries(groupedRows).map(([category, rows]) => (
        <div key={category} className="space-y-3">
          <h3 className="font-semibold text-lg">{category}</h3>
          <div className="space-y-2 pl-4">
            {rows.map((row) => {
              const viewKey = `${row.viewKey}_view`;
              const editKey = row.editKey ? `${row.editKey}_edit` : null;
              const canView = localPermissions[viewKey] ?? true;
              const canEdit = editKey ? (localPermissions[editKey] ?? true) : null;

              return (
                <div key={row.resource} className="flex items-center justify-between py-2 border-b">
                  <Label className="text-sm">{row.label}</Label>
                  <div className="flex items-center gap-6">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs text-muted-foreground">Pode Ver</Label>
                      <Switch
                        checked={canView}
                        onCheckedChange={() => handleToggle(row.viewKey, 'view', canView)}
                      />
                    </div>
                    {editKey && (
                      <div className="flex items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Pode Editar</Label>
                        <Switch
                          checked={canEdit ?? true}
                          onCheckedChange={() => handleToggle(row.editKey!, 'edit', canEdit ?? true)}
                          disabled={!canView}
                        />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
