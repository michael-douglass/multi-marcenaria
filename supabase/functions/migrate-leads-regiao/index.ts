import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Iniciando migração de regiões para leads...");

    const pageSize = 1000;

    // Busca configurações de nomes amigáveis da tabela
    const { data: configData } = await supabase
      .from("CRM-Selletos>tabela_origem_config<")
      .select("*");

    const nomeAmigavelMap: Record<string, string> = {};
    (configData || []).forEach((config: any) => {
      nomeAmigavelMap[config.nome_tabela] = config.nome_amigavel;
    });

    const ORIGEM_MINAS_GERAIS = nomeAmigavelMap["usuarios"] || "Minas Gerais";
    const ORIGEM_SAO_PAULO = nomeAmigavelMap["usuarios_SaoPaulo_Proforco"] || "São Paulo";

    const normalizePhone = (value: string | null | undefined) => {
      if (!value) return null;
      let digits = value.replace(/\D/g, "");
      if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
      if (digits.length > 11) digits = digits.slice(-11);
      return digits || null;
    };

    // Busca TODOS os leads com telefone que ainda não têm região
    let leads: { id: number; telefone: string | null }[] = [];
    let leadOffset = 0;

    while (true) {
      const { data: leadsPage, error: leadsError } = await supabase
        .from("CRM-Selletos>leads<")
        .select("id, telefone")
        .not("telefone", "is", null)
        .is("regiao", null)
        .range(leadOffset, leadOffset + pageSize - 1);

      if (leadsError) throw leadsError;
      if (!leadsPage || leadsPage.length === 0) break;

      leads = leads.concat(leadsPage as any);
      if (leadsPage.length < pageSize) break;
      leadOffset += pageSize;
    }

    console.log(`Leads sem região encontrados: ${leads.length}`);

    if (leads.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum lead para migrar", updated: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Busca TODOS os whatsapps da tabela "usuarios" (Minas Gerais)
    let allMgPhones: { whatsapp: string }[] = [];
    let mgOffset = 0;
    
    while (true) {
      const { data: mgPage, error: mgError } = await supabase
        .from("usuarios")
        .select("whatsapp")
        .not("whatsapp", "is", null)
        .range(mgOffset, mgOffset + pageSize - 1);
      
      if (mgError) throw mgError;
      if (!mgPage || mgPage.length === 0) break;
      
      allMgPhones = allMgPhones.concat(mgPage);
      if (mgPage.length < pageSize) break;
      mgOffset += pageSize;
    }

    // Busca TODOS os whatsapps da tabela "usuarios_SaoPaulo_Proforco" (São Paulo)
    let allSpPhones: { whatsapp: string }[] = [];
    let spOffset = 0;
    
    while (true) {
      const { data: spPage, error: spError } = await supabase
        .from("usuarios_SaoPaulo_Proforco")
        .select("whatsapp")
        .not("whatsapp", "is", null)
        .range(spOffset, spOffset + pageSize - 1);
      
      if (spError) throw spError;
      if (!spPage || spPage.length === 0) break;
      
      allSpPhones = allSpPhones.concat(spPage);
      if (spPage.length < pageSize) break;
      spOffset += pageSize;
    }

    // Cria sets com telefones normalizados
    const mgPhones = new Set<string>();
    allMgPhones.forEach((u) => {
      const phone = normalizePhone(u.whatsapp);
      if (phone) mgPhones.add(phone);
    });

    const spPhones = new Set<string>();
    allSpPhones.forEach((u) => {
      const phone = normalizePhone(u.whatsapp);
      if (phone) spPhones.add(phone);
    });

    console.log(`MG phones: ${mgPhones.size}, SP phones: ${spPhones.size}`);

    // Atualiza cada lead com sua região
    let updatedCount = 0;
    let errorCount = 0;

    for (const lead of leads) {
      const phone = normalizePhone(lead.telefone);
      if (!phone) continue;

      let regiao: string | null = null;
      let regiaoTabela: string | null = null;

      if (mgPhones.has(phone)) {
        regiao = ORIGEM_MINAS_GERAIS;
        regiaoTabela = "usuarios";
      } else if (spPhones.has(phone)) {
        regiao = ORIGEM_SAO_PAULO;
        regiaoTabela = "usuarios_SaoPaulo_Proforco";
      }

      if (regiao) {
        const { error: updateError } = await supabase
          .from("CRM-Selletos>leads<")
          .update({ regiao, regiao_tabela: regiaoTabela })
          .eq("id", lead.id);

        if (updateError) {
          console.error(`Erro ao atualizar lead ${lead.id}:`, updateError);
          errorCount++;
        } else {
          updatedCount++;
        }
      }
    }

    console.log(`Migração concluída: ${updatedCount} leads atualizados, ${errorCount} erros`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Migração concluída`,
        total: leads.length,
        updated: updatedCount,
        errors: errorCount
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    console.error("Error:", error);
    return new Response(
      JSON.stringify({ success: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});
