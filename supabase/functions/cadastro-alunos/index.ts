import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import { corsHeaders } from "../_shared/cors.ts";

const CADASTRO_ALUNOS_TABLE = 'CRM-Selletos>cadastro_alunos<';

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Método não permitido" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const nome = typeof body.nome === "string" ? body.nome.trim() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!nome || nome.length < 2) {
      return new Response(
        JSON.stringify({ error: "Nome deve ter no mínimo 2 caracteres" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return new Response(
        JSON.stringify({ error: "E-mail inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const telefone = typeof body.telefone === "string" ? body.telefone.trim() || null : null;
    const nome_aluno = typeof body.nome_aluno === "string" ? body.nome_aluno.trim() || null : null;
    const ano_escolar = typeof body.ano_escolar === "string" ? body.ano_escolar.trim() || null : null;
    const cpf_responsavel = typeof body.cpf_responsavel === "string" ? body.cpf_responsavel.replace(/\D/g, "").trim() || null : null;
    const idade =
      typeof body.idade === "number" && body.idade >= 1 && body.idade <= 120
        ? body.idade
        : typeof body.idade === "string" && /^\d+$/.test(body.idade)
        ? Math.min(120, Math.max(1, parseInt(body.idade, 10)))
        : null;
    const melhores_dias = Array.isArray(body.melhores_dias) ? body.melhores_dias.filter((d: unknown) => typeof d === "string") : [];
    const melhor_horario = Array.isArray(body.melhor_horario) ? body.melhor_horario.filter((h: unknown) => typeof h === "string") : [];
    const plano_id = typeof body.plano_id === "string" && body.plano_id.length > 0 ? body.plano_id : null;
    const dia_pagamento =
      typeof body.dia_pagamento === "number" && body.dia_pagamento >= 1 && body.dia_pagamento <= 31
        ? body.dia_pagamento
        : 10;

    let data_inicio_prevista: string | null = null;
    if (body.data_inicio_prevista != null) {
      const d = new Date(body.data_inicio_prevista);
      if (!isNaN(d.getTime())) data_inicio_prevista = d.toISOString().slice(0, 10);
    }
    const disciplinas = Array.isArray(body.disciplinas) ? body.disciplinas.filter((x: unknown) => typeof x === "string") : [];

    if (melhores_dias.length === 0 || melhor_horario.length === 0) {
      return new Response(
        JSON.stringify({ error: "Selecione ao menos um dia e um horário" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // NÃO criar usuário no Auth — apenas armazenar os dados do formulário.
    // Verificar se já existe um cadastro com esse e-mail para atualizar em vez de duplicar.
    const { data: existingRow } = await (supabase as any)
      .from(CADASTRO_ALUNOS_TABLE)
      .select('id, user_id')
      .eq('email', email)
      .maybeSingle();

    const userId = existingRow?.user_id ?? crypto.randomUUID();

    const row = {
      user_id: userId,
      nome,
      email,
      telefone,
      nome_aluno,
      ano_escolar,
      idade,
      cpf_responsavel,
      melhores_dias,
      melhor_horario,
      plano_id,
      dia_pagamento,
      data_inicio_prevista,
      disciplinas,
      atualizado_em: new Date().toISOString(),
    };

    if (existingRow?.id) {
      // Atualizar registro existente
      const { error: updateError } = await (supabase as any)
        .from(CADASTRO_ALUNOS_TABLE)
        .update(row)
        .eq('id', existingRow.id);

      if (updateError) {
        console.error("update cadastro_alunos error:", updateError);
        return new Response(
          JSON.stringify({ error: updateError.message ?? "Erro ao atualizar cadastro" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    } else {
      // Inserir novo registro
      const { error: insertError } = await (supabase as any)
        .from(CADASTRO_ALUNOS_TABLE)
        .insert(row);

      if (insertError) {
        console.error("insert cadastro_alunos error:", insertError);
        return new Response(
          JSON.stringify({ error: insertError.message ?? "Erro ao salvar cadastro" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: "Cadastro enviado com sucesso!",
        saved: { nome_aluno, cpf_responsavel, ano_escolar, idade, disciplinas },
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("cadastro-alunos error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
