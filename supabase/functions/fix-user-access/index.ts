import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const TABLE_USUARIOS = 'CRM-Selletos>usuarios<';
const TABLE_ROLES = 'CRM-Selletos>user_roles<';

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    const supabaseClient = createClient(supabaseUrl, supabaseAnonKey);
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Não autenticado');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user: authUser }, error: authError } = await supabaseClient.auth.getUser(token);
    if (authError || !authUser) {
      throw new Error('Usuário não autenticado');
    }

    const { data: roleData, error: roleError } = await supabaseAdmin
      .from(TABLE_ROLES)
      .select('role')
      .eq('user_id', authUser.id)
      .maybeSingle();

    if (roleError || roleData?.role !== 'admin') {
      throw new Error('Apenas administradores podem corrigir acesso');
    }

    let body: { email?: string; userId?: string };
    try {
      body = await req.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'Corpo da requisição inválido (JSON)' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }
    const email = body?.email != null ? String(body.email).trim() : '';
    const userIdFromBody = body?.userId != null ? String(body.userId).trim() : '';

    let userId: string;

    // Preferir email: garante que corrigimos o id que realmente faz login (auth.uid()), não o id da linha na tabela
    if (email) {
      const normalizedEmail = email.toLowerCase();
      let page = 1;
      const perPage = 1000;
      const maxPages = 5;
      let targetUser: { id: string } | null = null;
      while (page <= maxPages) {
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
        if (listError) throw listError;
        const found = users.find((u) => (u.email || '').toLowerCase() === normalizedEmail);
        if (found) {
          targetUser = found;
          break;
        }
        if (users.length < perPage) break;
        page += 1;
      }
      if (!targetUser) {
        return new Response(
          JSON.stringify({ success: false, error: 'Usuário não encontrado no Auth com este email' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
        );
      }
      userId = targetUser.id;
    } else if (userIdFromBody) {
      userId = userIdFromBody;
    } else {
      throw new Error('email ou userId é obrigatório');
    }

    const { data: usuario } = await supabaseAdmin
      .from(TABLE_USUARIOS)
      .select('id, status_convite')
      .eq('id', userId)
      .maybeSingle();

    const emailForLookup = email ? email.toLowerCase() : (await supabaseAdmin.auth.admin.getUserById(userId)).data?.user?.email?.toLowerCase();

    if (usuario) {
      if (usuario.status_convite !== 'ATIVO') {
        const { error: upUsu } = await supabaseAdmin
          .from(TABLE_USUARIOS)
          .update({ status_convite: 'ATIVO' })
          .eq('id', userId);
        if (upUsu) throw upUsu;
      }
    } else if (emailForLookup) {
      // Pode já existir linha com mesmo email mas outro id (ex.: criada antes do Auth) -> evita duplicate key
      const { data: existingByEmail } = await supabaseAdmin
        .from(TABLE_USUARIOS)
        .select('id')
        .ilike('email', emailForLookup)
        .maybeSingle();

      if (existingByEmail && existingByEmail.id !== userId) {
        const oldId = existingByEmail.id;
        // user_roles.user_id referencia usuarios(id): precisamos atualizar usuarios primeiro.
        // 1) Remover role antiga (senão o UPDATE em usuarios falha por FK).
        const { error: delRole } = await supabaseAdmin.from(TABLE_ROLES).delete().eq('user_id', oldId);
        if (delRole) throw delRole;
        // 2) Atualizar o id da linha em usuarios (oldId -> userId); agora existe usuarios(id = userId).
        const { error: e0 } = await supabaseAdmin.from(TABLE_USUARIOS).update({ id: userId, status_convite: 'ATIVO' }).eq('id', oldId);
        if (e0) throw e0;
        // 3) Atualizar as demais FKs que ainda apontam para oldId (agora podem apontar para userId).
        const { error: e2 } = await supabaseAdmin.from('CRM-Selletos>leads<').update({ vendedor_responsavel_id: userId }).eq('vendedor_responsavel_id', oldId);
        if (e2) throw e2;
        const { error: e3 } = await supabaseAdmin.from('CRM-Selletos>agenda_reunioes<').update({ responsavel_id: userId }).eq('responsavel_id', oldId);
        if (e3) throw e3;
        const { error: e4 } = await supabaseAdmin.from('CRM-Selletos>agenda_bloqueios<').update({ criado_por: userId }).eq('criado_por', oldId);
        if (e4) throw e4;
        const { error: e5 } = await supabaseAdmin.from('crm_selletos_chat_mensagens').update({ usuario_id: userId }).eq('usuario_id', oldId);
        if (e5) throw e5;
        // 4) Inserir role marketing para userId (feito mais abaixo no fluxo comum).
      } else if (!existingByEmail) {
        const { data: { user: authUserForInsert } } = await supabaseAdmin.auth.admin.getUserById(userId);
        const nome = authUserForInsert?.user_metadata?.name || authUserForInsert?.email?.split('@')[0] || 'Usuário';
        const emailInsert = authUserForInsert?.email ?? null;
        const { error: insUsu } = await supabaseAdmin.from(TABLE_USUARIOS).insert({
          id: userId,
          nome,
          email: emailInsert,
          status_convite: 'ATIVO',
        });
        if (insUsu) throw insUsu;
      }
      // Se existingByEmail.id === userId não deveria acontecer (já teríamos usuario)
    } else {
      const { data: { user: authUserForInsert } } = await supabaseAdmin.auth.admin.getUserById(userId);
      const nome = authUserForInsert?.user_metadata?.name || authUserForInsert?.email?.split('@')[0] || 'Usuário';
      const emailInsert = authUserForInsert?.email ?? null;
      const { error: insUsu } = await supabaseAdmin.from(TABLE_USUARIOS).insert({
        id: userId,
        nome,
        email: emailInsert,
        status_convite: 'ATIVO',
      });
      if (insUsu) throw insUsu;
    }

    const { data: roleRow } = await supabaseAdmin
      .from(TABLE_ROLES)
      .select('role')
      .eq('user_id', userId)
      .maybeSingle();

    if (roleRow) {
      if (roleRow.role !== 'marketing') {
        const { error: upRole } = await supabaseAdmin
          .from(TABLE_ROLES)
          .update({ role: 'marketing' })
          .eq('user_id', userId);
        if (upRole) throw upRole;
      }
    } else {
      const { error: insRole } = await supabaseAdmin.from(TABLE_ROLES).insert({
        user_id: userId,
        role: 'marketing',
      });
      if (insRole) throw insRole;
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Acesso corrigido. Usuária com status ATIVO e perfil marketing.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error
        ? error.message
        : typeof (error as { message?: string })?.message === 'string'
          ? (error as { message: string }).message
          : 'Erro ao corrigir acesso';
    return new Response(
      JSON.stringify({ success: false, error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    );
  }
});
