import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { corsHeaders } from "../_shared/cors.ts";
import { dbFromSchema, MASTER_TABLES, resolveEmpresaDb } from "../_shared/empresa-tables.ts";
import { ensurePontuaGarboPartnerLead } from "../_shared/pontua-garbo-lead.ts";

const ALLOWED_ROLES = new Set(["vendedor", "marketing", "nenhum"]);
const ALLOWED_TIPOS = new Set(["prestador_servico", "lead", "colaborador"]);

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const { nome, email, telefone, senha, tipo_usuario, role, empresaId, schemaNome, titulo } =
      await req.json();

    // ── Validações básicas ───────────────────────────────────────────────────
    if (!nome?.trim()) throw new Error("Nome é obrigatório.");
    if (!email?.trim()) throw new Error("Email é obrigatório.");
    if (!senha || senha.length < 6) throw new Error("Senha deve ter no mínimo 6 caracteres.");
    if (!empresaId || !schemaNome) throw new Error("Contexto de empresa ausente. Use o link fornecido pelo administrador.");
    if (!ALLOWED_TIPOS.has(tipo_usuario)) throw new Error("Tipo de usuário inválido.");
    if (!ALLOWED_ROLES.has(role)) throw new Error("Papel inválido.");

    // ── Verifica se email já existe ──────────────────────────────────────────
    const { data: existingUsers, error: listErr } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (listErr) throw listErr;
    const existing = existingUsers?.users?.find(
      (u: { email?: string }) => u.email?.toLowerCase() === email.trim().toLowerCase(),
    );
    if (existing) throw new Error("Este email já está cadastrado. Entre em contato com o administrador.");

    // ── Cria usuário no Auth ─────────────────────────────────────────────────
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email: email.trim().toLowerCase(),
      password: senha,
      email_confirm: true,
      user_metadata: { name: nome.trim(), phone: telefone?.replace(/\D/g, "") || null },
    });
    if (authError) throw authError;
    if (!authData.user) throw new Error("Falha ao criar usuário.");

    const userId = authData.user.id;
    const target = resolveEmpresaDb(schemaNome);
    const db = dbFromSchema(admin, target.schema);

    // ── Insere em usuarios (ATIVO — acesso imediato ao sistema) ─────────────
    const { error: insertErr } = await db.from(target.usuariosTable).insert({
      id: userId,
      nome: nome.trim(),
      email: email.trim().toLowerCase(),
      telefone: telefone?.replace(/\D/g, "") || null,
      status_convite: "ATIVO",
      tipo_usuario,
      // Prestadores pelo link público entram no Pontua Garbo (página Financeiro)
      comissao_ativa: tipo_usuario === "prestador_servico",
      titulo:
        tipo_usuario === "prestador_servico"
          ? (typeof titulo === "string" && titulo.trim() ? titulo.trim() : "Arquiteto")
          : null,
    });
    if (insertErr) throw insertErr;

    // ── Insere role ──────────────────────────────────────────────────────────
    const { error: roleErr } = await db.from(target.rolesTable).insert({ user_id: userId, role });
    if (roleErr) throw roleErr;

    // ── Vincula à empresa ────────────────────────────────────────────────────
    const { error: linkErr } = await admin.from(MASTER_TABLES.usuario_empresa).upsert(
      { user_id: userId, empresa_id: empresaId },
      { onConflict: "user_id,empresa_id" },
    );
    if (linkErr) throw linkErr;

    if (tipo_usuario === "prestador_servico") {
      try {
        await ensurePontuaGarboPartnerLead(admin, target, {
          usuarioId: userId,
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          telefone: telefone?.replace(/\D/g, "") || null,
        });
      } catch (leadErr) {
        console.error("register-public: falha ao criar lead Pontua Garbo", leadErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, userId }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error("register-public error:", error);
    return new Response(
      JSON.stringify({ success: false, error: msg }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 200 },
    );
  }
});
