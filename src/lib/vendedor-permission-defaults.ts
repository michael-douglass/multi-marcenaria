import type { PermissionAction, PermissionResource } from '@/hooks/usePermissions';

/**
 * Permissões padrão do perfil vendedor quando não há registro explícito no banco.
 * Admin continua podendo restringir via Gestão de Usuários → Permissões.
 */
export const VENDEDOR_PERMISSION_DEFAULTS: Partial<
  Record<`${PermissionResource}_${PermissionAction}`, boolean>
> = {
  // Acesso geral
  pipeline_view: true,
  leads_view: true,
  leads_edit: true,
  all_leads_view: true,

  // Dashboard (sem faturamento total da empresa)
  dashboard_view: true,
  dashboard_total_revenue_view: false,
  dashboard_origin_chart_view: true,

  // Campos do lead
  lead_name_view: true,
  lead_name_edit: true,
  lead_phone_view: true,
  lead_phone_edit: true,
  lead_email_view: true,
  lead_email_edit: true,
  lead_company_view: true,
  lead_company_edit: true,
  lead_origin_view: true,
  lead_origin_edit: true,
  lead_value_view: true,
  lead_value_edit: true,
  lead_vendor_view: true,
  lead_vendor_edit: true,
  lead_status_view: true,
  lead_status_edit: true,
  lead_observations_view: true,
  lead_observations_edit: true,
  lead_whatsapp_history_view: true,

  send_whatsapp_edit: true,
  numeros_negativados_view: true,
  webhooks_api_view: true,
};

export function getVendedorPermissionDefault(
  resource: PermissionResource,
  action: PermissionAction,
): boolean {
  const key = `${resource}_${action}` as keyof typeof VENDEDOR_PERMISSION_DEFAULTS;
  return VENDEDOR_PERMISSION_DEFAULTS[key] ?? false;
}
