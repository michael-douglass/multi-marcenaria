import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { corsHeaders } from "../_shared/cors.ts";
import {
  dbFromSchema,
  MASTER_TABLES,
  resolveEmpresaDb,
  resolveEmpresaId,
} from "../_shared/empresa-tables.ts";
import { ensurePontuaGarboPartnerLead } from "../_shared/pontua-garbo-lead.ts";

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message;
  if (typeof error === "object" && error !== null) {
    const o = error as Record<string, unknown>;
    if (typeof o.message === "string" && o.message.trim()) return o.message;
    if (typeof o.error_description === "string" && o.error_description.trim()) {
      return o.error_description;
    }
  }
  return String(error);
}

async function upsertUsuario(
  admin: ReturnType<typeof createClient>,
  target: ReturnType<typeof resolveEmpresaDb>,
  userId: string,
  nome: string,
  email: string,
  telefone: string | undefined,
  tipo_usuario: string = "colaborador",
  titulo: string | undefined = undefined,
  comissao_ativa: boolean = false,
) {
  const db = dbFromSchema(admin, target.schema);

  const { data: usuarioExistente, error: checkError } = await db
    .from(target.usuariosTable)
    .select("id")
    .eq("id", userId)
    .maybeSingle();

  if (checkError && checkError.code !== "PGRST116") {
    throw checkError;
  }

  if (usuarioExistente) {
    const { error: updateUsuariosError } = await db
      .from(target.usuariosTable)
      .update({
        status_convite: "ATIVO",
        nome,
        telefone,
        tipo_usuario,
        titulo: titulo ?? null,
        comissao_ativa,
      })
      .eq("id", userId);

    if (updateUsuariosError) throw updateUsuariosError;
  } else {
    const { error: insertUsuariosError } = await db
      .from(target.usuariosTable)
      .insert({
        id: userId,
        nome,
        email,
        telefone,
        status_convite: "ATIVO",
        tipo_usuario,
        titulo: titulo ?? null,
        comissao_ativa,
      });

    if (insertUsuariosError) throw insertUsuariosError;
  }
}

async function syncRoles(
  admin: ReturnType<typeof createClient>,
  target: ReturnType<typeof resolveEmpresaDb>,
  userId: string,
  rolesInput: string[] | string | undefined,
) {
  const db = dbFromSchema(admin, target.schema);
  const raw = Array.isArray(rolesInput)
    ? rolesInput
    : rolesInput
      ? [rolesInput]
      : ["nenhum"];

  const allowed = new Set([
    "admin",
    "vendedor",
    "marketing",
    "projetista",
    "projetista_admin",
    "nenhum",
  ]);
  const unique = Array.from(
    new Set(
      raw
        .map((r) => String(r || "").toLowerCase())
        .filter((r) => allowed.has(r)),
    ),
  );

  const operational = unique.filter((r) => r !== "nenhum");
  const roles = operational.length > 0 ? operational : ["nenhum"];

  const { error: deleteError } = await db
    .from(target.rolesTable)
    .delete()
    .eq("user_id", userId);

  if (deleteError) throw deleteError;

  const { error: insertError } = await db
    .from(target.rolesTable)
    .insert(roles.map((role) => ({ user_id: userId, role })));

  if (insertError) throw insertError;
}

async function linkUsuarioEmpresa(
  admin: ReturnType<typeof createClient>,
  userId: string,
  empresaId: string,
) {
  const { error } = await admin
    .from(MASTER_TABLES.usuario_empresa)
    .upsert(
      { user_id: userId, empresa_id: empresaId },
      { onConflict: "user_id,empresa_id" },
    );

  if (error) throw error;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { nome, email, telefone, role, roles, empresaId, schemaNome, tipo_usuario, titulo, comissao_ativa, leadId } =
      await req.json();

    if (!empresaId || !schemaNome) {
      throw new Error(
        "empresaId e schemaNome são obrigatórios. Selecione a empresa antes de cadastrar o usuário.",
      );
    }

    const target = resolveEmpresaDb(schemaNome);
    // Frontend legado pode enviar schema_nome (ex.: emp_garbo) no lugar do UUID.
    const empresaUuid = await resolveEmpresaId(supabaseClient, empresaId, schemaNome);

    console.log("Processing user request:", {
      nome,
      email,
      role,
      roles,
      tipo_usuario,
      empresaId: empresaUuid,
      schemaNome,
    });

    const { data: existingUserData, error: listUsersError } =
      await supabaseClient.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });

    if (listUsersError) throw listUsersError;

    const existingUser =
      existingUserData?.users?.find(
        (u: { email?: string }) => u.email?.toLowerCase() === email.toLowerCase(),
      ) ?? null;

    let userId: string;
    let message: string;

    if (existingUser) {
      const { error: updateAuthError } = await supabaseClient.auth.admin.updateUserById(
        existingUser.id,
        {
          email_confirm: true,
          user_metadata: {
            name: nome,
            phone: telefone,
          },
        },
      );

      if (updateAuthError) throw updateAuthError;

      userId = existingUser.id;
      message = "Usuário reativado e vinculado à empresa com sucesso";
    } else {
      // Senha temporária interna: evita e-mail automático de convite do Auth.
      // O admin define a senha real em Admin → Redefinir senha.
      const tempPassword = crypto.randomUUID() + "Aa1!";
      const { data: authData, error: authError } = await supabaseClient.auth.admin.createUser({
        email,
        password: tempPassword,
        email_confirm: true,
        user_metadata: {
          name: nome,
          phone: telefone,
        },
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error("Falha ao criar usuário");

      userId = authData.user.id;
      message = "Usuário criado e vinculado à empresa com sucesso";
    }

    await upsertUsuario(
      supabaseClient,
      target,
      userId,
      nome,
      email,
      telefone,
      tipo_usuario ?? "colaborador",
      titulo,
      comissao_ativa ?? false,
    );
    await syncRoles(supabaseClient, target, userId, roles ?? role ?? "nenhum");
    await linkUsuarioEmpresa(supabaseClient, userId, empresaUuid);

    const entraPontuaGarbo = (comissao_ativa ?? false) === true;
    let pontuaGarboLeadId: number | null = null;
    if (entraPontuaGarbo) {
      try {
        const existingLeadId =
          typeof leadId === "number" && Number.isFinite(leadId) ? leadId : null;
        const ensured = await ensurePontuaGarboPartnerLead(supabaseClient, target, {
          usuarioId: userId,
          nome,
          email,
          telefone,
          existingLeadId,
        });
        pontuaGarboLeadId = ensured.leadId;
      } catch (leadErr) {
        console.error("create-user-admin: falha ao criar lead Pontua Garbo", leadErr);
      }
    }

    console.log("Operation completed successfully:", {
      userId,
      empresaId: empresaUuid,
      schemaNome,
      tipo_usuario,
    });

    return new Response(
      JSON.stringify({
        success: true,
        userId,
        message,
        leadId: pontuaGarboLeadId,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  } catch (error: unknown) {
    const errMessage = errorMessage(error);
    console.error("Error in create-user-admin:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: errMessage,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      },
    );
  }
});
