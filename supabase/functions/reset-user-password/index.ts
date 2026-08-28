import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors.ts';
import { dbFromSchema, MASTER_TABLES, resolveEmpresaDb } from '../_shared/empresa-tables.ts';

const MIN_PASSWORD_LENGTH = 6;
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function jsonResponse(body: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const o = error as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message) return o.message;
    if (typeof o.msg === 'string' && o.msg) return o.msg;
    if (typeof o.error_description === 'string') return o.error_description;
    if (typeof o.code === 'string') return o.code;
  }
  return 'Erro ao redefinir senha';
}

function validatePassword(password: string): string | null {
  if (password.length < MIN_PASSWORD_LENGTH) {
    return `Senha deve ter no mínimo ${MIN_PASSWORD_LENGTH} caracteres`;
  }
  return null;
}

function mapAuthPasswordError(raw: string): string {
  const msg = raw.toLowerCase();
  if (msg.includes('pwned') || msg.includes('leaked') || msg.includes('known to be weak')) {
    return 'Esta senha é fraca ou já vazou na internet. Escolha outra mais segura.';
  }
  const minMatch = msg.match(/at least (\d+) character/);
  if (minMatch) {
    return `Senha deve ter no mínimo ${minMatch[1]} caracteres`;
  }
  if (msg.includes('weak_password') || msg.includes('weak password')) {
    return 'Senha rejeitada pelas regras de segurança do login. Tente outra combinação de números.';
  }
  if (msg.includes('same_password') || msg.includes('different from the old')) {
    return 'A nova senha precisa ser diferente da senha atual.';
  }
  return raw;
}

const LEGACY_ROLES_TABLE = 'CRM-Selletos>user_roles<';

async function hasAdminRole(
  rows: Array<{ role?: string | null }> | null | undefined,
): Promise<boolean> {
  return (rows ?? []).some((row) => row.role === 'admin');
}

async function callerCanResetPassword(
  admin: ReturnType<typeof createClient>,
  callerId: string,
  schemaNome?: string | null,
): Promise<boolean> {
  try {
    const { data: isSuper, error: rpcError } = await admin.rpc('me_is_super_admin', {
      _user_id: callerId,
    });
    if (!rpcError && isSuper === true) return true;
  } catch (e) {
    console.warn('me_is_super_admin:', e);
  }

  try {
    const { data: masterRoles } = await admin
      .from(MASTER_TABLES.user_roles)
      .select('role')
      .eq('user_id', callerId);
    if (await hasAdminRole(masterRoles)) return true;
  } catch (e) {
    console.warn('master role check:', e);
  }

  // Tabela antiga do CRM Selletos — ainda usada por alguns admins em produção.
  try {
    const { data: legacyRoles } = await admin
      .from(LEGACY_ROLES_TABLE)
      .select('role')
      .eq('user_id', callerId);
    if (await hasAdminRole(legacyRoles)) return true;
  } catch (e) {
    console.warn('legacy selletos role check:', e);
  }

  if (schemaNome) {
    try {
      const target = resolveEmpresaDb(schemaNome);
      const db = dbFromSchema(admin, target.schema);
      const { data: empresaRoles } = await db
        .from(target.rolesTable)
        .select('role')
        .eq('user_id', callerId);
      if (await hasAdminRole(empresaRoles)) return true;
    } catch (e) {
      console.warn('empresa role check:', e);
    }
  }

  return false;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    if (!supabaseUrl || !serviceKey) {
      return jsonResponse({ error: 'Configuração do servidor incompleta' }, 500);
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return jsonResponse({ error: 'Não autenticado' }, 401);
    }

    const jwt = authHeader.replace('Bearer ', '').trim();
    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    const caller = userData?.user;

    if (userError || !caller) {
      console.error('getUser:', userError);
      return jsonResponse({ error: 'Sessão inválida ou expirada. Faça login novamente.' }, 401);
    }

    let body: { userId?: string; newPassword?: string; schemaNome?: string | null };
    try {
      body = await req.json();
    } catch {
      return jsonResponse({ error: 'Corpo da requisição inválido' }, 400);
    }

    const { userId, newPassword, schemaNome } = body;

    if (!userId || typeof userId !== 'string') {
      return jsonResponse({ error: 'ID do usuário é obrigatório' }, 400);
    }
    if (!UUID_RE.test(userId)) {
      return jsonResponse({ error: 'ID do usuário inválido' }, 400);
    }
    if (!newPassword || typeof newPassword !== 'string') {
      return jsonResponse({ error: 'Nova senha é obrigatória' }, 400);
    }
    const passwordError = validatePassword(newPassword);
    if (passwordError) {
      return jsonResponse({ error: passwordError }, 400);
    }

    const allowed = await callerCanResetPassword(admin, caller.id, schemaNome ?? null);
    if (!allowed) {
      return jsonResponse({
        error: 'Apenas administradores podem redefinir senhas',
      }, 403);
    }

    let targetUser: { user?: { id: string } } | null = null;
    try {
      const result = await admin.auth.admin.getUserById(userId);
      if (result.error || !result.data?.user) {
        console.error('getUserById:', result.error);
        return jsonResponse({
          error: 'Usuário alvo não encontrado no sistema de login',
        }, 404);
      }
      targetUser = result.data;
    } catch (e) {
      console.error('getUserById exception:', e);
      return jsonResponse({
        error: 'Usuário alvo não encontrado no sistema de login',
      }, 404);
    }
    if (!targetUser?.user) {
      return jsonResponse({
        error: 'Usuário alvo não encontrado no sistema de login',
      }, 404);
    }

    const { error: updateError } = await admin.auth.admin.updateUserById(userId, {
      password: newPassword,
    });

    if (updateError) {
      console.error('updateUserById:', updateError);
      const msg = mapAuthPasswordError(errorMessage(updateError));
      return jsonResponse({ error: msg }, 400);
    }

    return jsonResponse({ success: true, message: 'Senha redefinida com sucesso' }, 200);
  } catch (error: unknown) {
    console.error('reset-user-password:', error);
    return jsonResponse({ error: errorMessage(error) }, 500);
  }
});
