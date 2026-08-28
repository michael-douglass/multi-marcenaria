import type { SupabaseClient } from '@supabase/supabase-js';
import {
  isSchemaApiExposed,
  resolveEmpresaTableNames,
} from '@/lib/empresa-tables';
import { normalizeRoles, pickPrimaryRole } from '@/lib/app-roles';

export type AppUserRole =
  | 'admin'
  | 'vendedor'
  | 'marketing'
  | 'projetista'
  | 'projetista_admin'
  | 'nenhum';

export interface AccessHours {
  inicio: string | null;
  fim: string | null;
}

interface UsuarioAccessRow {
  status_convite?: string;
  horario_acesso_inicio?: string | null;
  horario_acesso_fim?: string | null;
  tipo_usuario?: string | null;
}

export interface ResolvedAuthRole {
  /** Papel principal (compat legado). */
  role: AppUserRole;
  /** Todas as funções do usuário. */
  roles: AppUserRole[];
  accessHours: AccessHours | null;
  isSuperAdmin: boolean;
  tipoUsuario: string | null;
}

function parseAccessHours(usuario: UsuarioAccessRow | null): AccessHours | null {
  const inicio = usuario?.horario_acesso_inicio
    ? String(usuario.horario_acesso_inicio).slice(0, 5)
    : null;
  const fim = usuario?.horario_acesso_fim
    ? String(usuario.horario_acesso_fim).slice(0, 5)
    : null;
  return inicio || fim ? { inicio, fim } : null;
}

async function loadUsuarioRow(
  db: SupabaseClient,
  usuariosTable: string,
  userId: string,
): Promise<UsuarioAccessRow | null> {
  const { data: full, error } = await db
    .from(usuariosTable)
    .select('status_convite, horario_acesso_inicio, horario_acesso_fim, tipo_usuario')
    .eq('id', userId)
    .maybeSingle();

  if (!error) return full as UsuarioAccessRow | null;

  if (error.code === '42703') {
    const { data: fallback, error: fallbackError } = await db
      .from(usuariosTable)
      .select('status_convite')
      .eq('id', userId)
      .maybeSingle();
    if (fallbackError) throw fallbackError;
    return fallback as UsuarioAccessRow | null;
  }

  throw error;
}

async function loadRoles(
  db: SupabaseClient,
  rolesTable: string,
  userId: string,
): Promise<AppUserRole[]> {
  const { data, error } = await db
    .from(rolesTable)
    .select('role')
    .eq('user_id', userId);

  if (error) throw error;
  return normalizeRoles((data ?? []).map((row) => row.role as AppUserRole));
}

function packResolved(params: {
  roles: AppUserRole[];
  accessHours: AccessHours | null;
  isSuperAdmin: boolean;
  tipoUsuario: string | null;
}): ResolvedAuthRole {
  const roles = normalizeRoles(params.roles);
  return {
    role: pickPrimaryRole(roles),
    roles,
    accessHours: params.accessHours,
    isSuperAdmin: params.isSuperAdmin,
    tipoUsuario: params.tipoUsuario,
  };
}

/** Resolve papéis e horário do usuário (master, super admin e empresa vinculada). */
export async function resolveAuthRole(
  supabase: SupabaseClient,
  userId: string,
): Promise<ResolvedAuthRole> {
  const { data: isSuperAdmin, error: superError } = await supabase.rpc('me_is_super_admin', {
    _user_id: userId,
  });
  if (superError) console.error('me_is_super_admin:', superError);

  if (isSuperAdmin === true) {
    return packResolved({
      roles: ['admin'],
      accessHours: null,
      isSuperAdmin: true,
      tipoUsuario: null,
    });
  }

  const masterTables = resolveEmpresaTableNames(null);
  let masterRoles: AppUserRole[] = ['nenhum'];
  let masterUsuario: UsuarioAccessRow | null = null;

  try {
    const { data: rolesRpc, error: rolesRpcError } = await supabase.rpc('me_get_user_roles', {
      _user_id: userId,
    });
    if (!rolesRpcError && Array.isArray(rolesRpc) && rolesRpc.length > 0) {
      masterRoles = normalizeRoles(rolesRpc as AppUserRole[]);
    } else {
      const { data: roleRpc, error: roleRpcError } = await supabase.rpc('me_get_user_role', {
        _user_id: userId,
      });
      if (!roleRpcError && roleRpc) {
        masterRoles = normalizeRoles([roleRpc as AppUserRole]);
      } else {
        masterRoles = await loadRoles(supabase, masterTables.user_roles, userId);
      }
    }
    masterUsuario = await loadUsuarioRow(supabase, masterTables.usuarios, userId);
  } catch (e) {
    console.warn('Perfil master não carregado:', e);
  }

  const masterAtivo = masterUsuario?.status_convite === 'ATIVO';
  const masterPrimary = pickPrimaryRole(masterRoles);
  if (masterAtivo && masterPrimary !== 'nenhum') {
    return packResolved({
      roles: masterRoles,
      accessHours: parseAccessHours(masterUsuario),
      isSuperAdmin: false,
      tipoUsuario: masterUsuario?.tipo_usuario ?? null,
    });
  }
  if (!masterAtivo && masterRoles.includes('marketing')) {
    return packResolved({
      roles: masterRoles,
      accessHours: parseAccessHours(masterUsuario),
      isSuperAdmin: false,
      tipoUsuario: masterUsuario?.tipo_usuario ?? null,
    });
  }

  const { data: schemaEmpresa } = await supabase.rpc('me_get_schema_empresa', {
    _user_id: userId,
  });
  const schema =
    typeof schemaEmpresa === 'string' && isSchemaApiExposed(schemaEmpresa)
      ? schemaEmpresa
      : null;

  if (schema) {
    const db = supabase.schema(schema);
    const tables = resolveEmpresaTableNames(schema);
    const empresaRoles = await loadRoles(db, tables.user_roles, userId);
    const empresaUsuario = await loadUsuarioRow(db, tables.usuarios, userId);
    const empresaAtiva = empresaUsuario?.status_convite === 'ATIVO';
    const empresaPrimary = pickPrimaryRole(empresaRoles);

    if (empresaAtiva || empresaRoles.includes('marketing')) {
      return packResolved({
        roles: empresaRoles,
        accessHours: parseAccessHours(empresaUsuario),
        isSuperAdmin: false,
        tipoUsuario: empresaUsuario?.tipo_usuario ?? null,
      });
    }

    if (empresaUsuario?.tipo_usuario) {
      return packResolved({
        roles: empresaPrimary === 'nenhum' ? ['nenhum'] : empresaRoles,
        accessHours: null,
        isSuperAdmin: false,
        tipoUsuario: empresaUsuario.tipo_usuario,
      });
    }
  }

  return packResolved({
    roles: masterRoles,
    accessHours: parseAccessHours(masterUsuario),
    isSuperAdmin: false,
    tipoUsuario: masterUsuario?.tipo_usuario ?? null,
  });
}
