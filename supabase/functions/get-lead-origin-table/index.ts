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

    const pageSize = 1000;

    // Busca configurações de nomes amigáveis da tabela
    const { data: configData, error: configError } = await supabase
      .from("CRM-Selletos>tabela_origem_config<")
      .select("*");

    if (configError) {
      console.error("Erro ao buscar configs:", configError);
    }

    // Cria mapa de nome_tabela -> nome_amigavel
    const nomeAmigavelMap: Record<string, string> = {};
    (configData || []).forEach((config: any) => {
      nomeAmigavelMap[config.nome_tabela] = config.nome_amigavel;
    });

    // Fallbacks caso a tabela não tenha sido populada
    const ORIGEM_MINAS_GERAIS = nomeAmigavelMap["usuarios"] || "Minas Gerais";
    const ORIGEM_SAO_PAULO = nomeAmigavelMap["usuarios_SaoPaulo_Proforco"] || "São Paulo";

    console.log(`Tabelas de origem: usuarios -> ${ORIGEM_MINAS_GERAIS}, usuarios_SaoPaulo_Proforco -> ${ORIGEM_SAO_PAULO}`);

    // Busca TODOS os leads com telefone (paginado - Supabase limita 1000 por request)
    let leads: { id: number; telefone: string | null }[] = [];
    let leadOffset = 0;

    while (true) {
      const { data: leadsPage, error: leadsError } = await supabase
        .from("CRM-Selletos>leads<")
        .select("id, telefone")
        .not("telefone", "is", null)
        .range(leadOffset, leadOffset + pageSize - 1);

      if (leadsError) throw leadsError;
      if (!leadsPage || leadsPage.length === 0) break;

      leads = leads.concat(leadsPage as any);
      if (leadsPage.length < pageSize) break;
      leadOffset += pageSize;
    }

    const normalizePhone = (value: string | null | undefined) => {
      if (!value) return null;
      let digits = value.replace(/\D/g, "");
      // Remove prefixo do Brasil se vier com +55/55
      if (digits.startsWith("55") && digits.length > 11) digits = digits.slice(2);
      // Em caso de sobras, usa os últimos 11 dígitos (DDD + número)
      if (digits.length > 11) digits = digits.slice(-11);
      return digits || null;
    };

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

    console.log(`MG phones count: ${mgPhones.size}, SP phones count: ${spPhones.size}`);
    console.log(`Sample MG phones: ${Array.from(mgPhones).slice(0, 3).join(', ')}`);
    console.log(`Sample SP phones: ${Array.from(spPhones).slice(0, 3).join(', ')}`);

    // Mapeia cada lead para sua origem (agora com objeto estruturado)
    const leadOrigins: Record<number, { nomeAmigavel: string; nomeTabela: string } | null> = {};

    leads?.forEach((lead) => {
      const phone = normalizePhone(lead.telefone);
      if (!phone) {
        leadOrigins[lead.id] = null;
        return;
      }

      // Primeiro verifica MG (prioridade para a tabela usuarios)
      if (mgPhones.has(phone)) {
        leadOrigins[lead.id] = {
          nomeAmigavel: ORIGEM_MINAS_GERAIS,
          nomeTabela: "usuarios"
        };
      } else if (spPhones.has(phone)) {
        leadOrigins[lead.id] = {
          nomeAmigavel: ORIGEM_SAO_PAULO,
          nomeTabela: "usuarios_SaoPaulo_Proforco"
        };
      } else {
        leadOrigins[lead.id] = null;
      }
    });

    const matchedCount = Object.values(leadOrigins).filter(v => v !== null).length;
    console.log(`Total leads: ${leads?.length}, Matched: ${matchedCount}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: leadOrigins,
        config: configData || []
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
