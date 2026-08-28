import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { dbFromSchema, MASTER_TABLES, resolveEmpresaDb } from './empresa-tables.ts';

const SUPER_ADMINS_TABLE = 'CRM-multi-empresas>super_admins<';

/** Garante que quem chama a função é admin (master, super admin ou admin da empresa). */
export async function assertCallerIsAdmin(
  supabaseAdmin: SupabaseClient,
  authUserId: string,
  schemaNome?: string | null,
): Promise<void> {
  const { data: superAdmin, error: superError } = await supabaseAdmin
    .from(SUPER_ADMINS_TABLE)
    .select('user_id')
    .eq('user_id', authUserId)
    .maybeSingle();

  if (superError) {
    console.error('super_admins check:', superError);
    throw new Error(`[STEP:super_admins_query] ${superError.message}`);
  }
  if (superAdmin) return;

  const { data: masterRole, error: masterError } = await supabaseAdmin
    .from(MASTER_TABLES.user_roles)
    .select('role')
    .eq('user_id', authUserId)
    .maybeSingle();

  if (masterError) {
    console.error('master user_roles check:', masterError);
    throw new Error(`[STEP:master_roles_query] ${masterError.message}`);
  }
  if (masterRole?.role === 'admin') return;

  if (schemaNome) {
    try {
      const target = resolveEmpresaDb(schemaNome);
      const db = dbFromSchema(supabaseAdmin, target.schema);
      const { data: empresaRole, error: empresaError } = await db
        .from(target.rolesTable)
        .select('role')
        .eq('user_id', authUserId)
        .maybeSingle();

      if (empresaError) {
        console.warn('empresa user_roles check (ignorado se master/super):', empresaError);
      } else if (empresaRole?.role === 'admin') {
        return;
      }
    } catch (empresaCheckErr) {
      console.warn('empresa admin check exception:', empresaCheckErr);
    }
  }

  throw new Error('Apenas administradores podem executar esta ação');
}
