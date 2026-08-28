import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors.ts';
import { dbFromSchema, MASTER_TABLES, resolveEmpresaDb } from '../_shared/empresa-tables.ts';

interface DeleteUserResponse {
  ok: boolean;
  message?: string;
  error?: string;
  partial?: boolean;
}

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

/** Erros de negócio sempre em 200 para o cliente ler o JSON (evita 500 genérico no navegador). */
function respond(payload: DeleteUserResponse) {
  return new Response(JSON.stringify(payload), {
    headers: jsonHeaders,
    status: 200,
  });
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === 'object' && error !== null) {
    const o = error as Record<string, unknown>;
    if (typeof o.message === 'string' && o.message) return o.message;
  }
  return 'Erro desconhecido ao excluir usuário';
}

async function callerCanDeleteUser(
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
    const { data: masterRole } = await admin
      .from(MASTER_TABLES.user_roles)
      .select('role')
      .eq('user_id', callerId)
      .maybeSingle();
    if (masterRole?.role === 'admin') return true;
  } catch (e) {
    console.warn('master role check:', e);
  }

  if (schemaNome) {
    try {
      const target = resolveEmpresaDb(schemaNome);
      const db = dbFromSchema(admin, target.schema);
      const { data: empresaRole } = await db
        .from(target.rolesTable)
        .select('role')
        .eq('user_id', callerId)
        .maybeSingle();
      if (empresaRole?.role === 'admin') return true;
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
      return respond({ ok: false, error: 'Configuração do servidor incompleta' });
    }

    const admin = createClient(supabaseUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return respond({ ok: false, error: 'Token de autenticação não fornecido' });
    }

    const jwt = authHeader.replace('Bearer ', '').trim();
    const { data: userData, error: userError } = await admin.auth.getUser(jwt);
    const caller = userData?.user;

    if (userError || !caller) {
      console.error('getUser:', userError);
      return respond({ ok: false, error: 'Usuário não autenticado' });
    }

    let body: {
      userId?: string;
      transferToUserId?: string;
      schemaNome?: string | null;
      empresaId?: string | null;
    };
    try {
      body = await req.json();
    } catch {
      return respond({ ok: false, error: 'Corpo da requisição inválido' });
    }

    const { userId, transferToUserId, schemaNome, empresaId } = body;

    if (!userId || typeof userId !== 'string') {
      return respond({ ok: false, error: 'ID do usuário não fornecido' });
    }

    if (userId === caller.id) {
      return respond({ ok: false, error: 'Não é possível excluir seu próprio usuário' });
    }

    const allowed = await callerCanDeleteUser(admin, caller.id, schemaNome ?? null);
    if (!allowed) {
      return respond({
        ok: false,
        error: 'Acesso negado: apenas administradores podem excluir usuários',
      });
    }

    const target = resolveEmpresaDb(schemaNome ?? null);
    const db = dbFromSchema(admin, target.schema);

    console.log('Excluindo usuário:', { userId, schemaNome: target.schema, empresaId });

    const { data: leadsData, error: leadsError } = await db
      .from(target.leadsTable)
      .select('id')
      .eq('vendedor_responsavel_id', userId)
      .limit(1);

    if (leadsError) {
      console.error('Erro ao verificar leads:', leadsError);
      return respond({
        ok: false,
        error: `Erro ao verificar leads associados: ${leadsError.message}`,
      });
    }

    if (leadsData && leadsData.length > 0) {
      if (!transferToUserId) {
        return respond({ ok: false, error: 'LEADS_ASSOCIATED' });
      }

      if (transferToUserId === userId) {
        return respond({
          ok: false,
          error: 'Selecione outro usuário para receber os leads associados.',
        });
      }

      const { data: targetRoleData, error: targetRoleError } = await db
        .from(target.rolesTable)
        .select('role')
        .eq('user_id', transferToUserId)
        .maybeSingle();

      if (
        targetRoleError ||
        !targetRoleData ||
        !['admin', 'vendedor'].includes(targetRoleData.role as string)
      ) {
        return respond({
          ok: false,
          error: 'Selecione um administrador ou vendedor válido para receber os leads.',
        });
      }

      const { error: transferError } = await db
        .from(target.leadsTable)
        .update({ vendedor_responsavel_id: transferToUserId })
        .eq('vendedor_responsavel_id', userId);

      if (transferError) {
        console.error('Erro ao transferir leads:', transferError);
        return respond({
          ok: false,
          error: `Erro ao transferir leads: ${transferError.message}`,
        });
      }
    }

    // CASCADE em user_roles ao remover usuarios
    const { error: usuariosError } = await db
      .from(target.usuariosTable)
      .delete()
      .eq('id', userId);

    if (usuariosError) {
      console.error('Erro ao deletar usuarios:', usuariosError);
      return respond({
        ok: false,
        error: `Erro ao deletar usuário da empresa: ${usuariosError.message}`,
      });
    }

    if (empresaId) {
      const { error: unlinkError } = await admin
        .from(MASTER_TABLES.usuario_empresa)
        .delete()
        .eq('user_id', userId)
        .eq('empresa_id', empresaId);

      if (unlinkError) {
        console.error('Erro ao desvincular usuario_empresa:', unlinkError);
        return respond({
          ok: false,
          error: `Erro ao desvincular usuário da empresa: ${unlinkError.message}`,
        });
      }
    }

    const { data: remainingLinks, error: linksError } = await admin
      .from(MASTER_TABLES.usuario_empresa)
      .select('empresa_id')
      .eq('user_id', userId);

    if (linksError) {
      console.warn('Não foi possível verificar vínculos restantes:', linksError);
    }

    const hasOtherEmpresas = (remainingLinks?.length ?? 0) > 0;
    let authDeleted = false;
    let partial = false;

    if (!hasOtherEmpresas) {
      await admin.from(MASTER_TABLES.user_roles).delete().eq('user_id', userId);
      await admin.from(MASTER_TABLES.usuarios).delete().eq('id', userId);

      const { error: limparError } = await admin.rpc('me_limpar_vinculos_auth_user', {
        _user_id: userId,
      });
      if (limparError) {
        console.warn('me_limpar_vinculos_auth_user:', limparError);
      }

      const { error: authError } = await admin.auth.admin.deleteUser(userId);
      if (authError) {
        console.error('Erro ao deletar auth:', authError);
        partial = true;
      } else {
        authDeleted = true;
      }
    }

    if (hasOtherEmpresas) {
      return respond({
        ok: true,
        message: 'Usuário removido desta empresa (ainda vinculado a outras empresas)',
      });
    }

    if (partial) {
      return respond({
        ok: true,
        partial: true,
        message:
          'Usuário removido desta empresa. O login não pôde ser apagado por vínculos em outros módulos do sistema.',
      });
    }

    return respond({
      ok: true,
      message: authDeleted
        ? 'Usuário excluído com sucesso'
        : 'Usuário removido da empresa',
    });
  } catch (error) {
    console.error('Erro na exclusão de usuário:', error);
    return respond({ ok: false, error: errorMessage(error) });
  }
});
