import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors.ts';

interface SaveSecretsBody {
  openai_api_key?: string;
  serp_api_key?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Método não permitido' }), {
        status: 405,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let body: SaveSecretsBody;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'JSON inválido' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const openaiKey =
      typeof body.openai_api_key === 'string' ? body.openai_api_key.trim() : undefined;
    const serpKey =
      typeof body.serp_api_key === 'string' ? body.serp_api_key.trim() : undefined;

    if (!openaiKey && !serpKey) {
      return new Response(
        JSON.stringify({ error: 'Informe ao menos uma chave (OpenAI ou SerpAPI)' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Sempre tabelas crm_multiempresas_* (CRM multi empresas)
    const { data: config, error: configError } = await supabase
      .from('crm_multiempresas_marketing_ai_studio_config')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (configError || !config) {
      return new Response(JSON.stringify({ error: 'Configuração do studio não encontrada' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const updates: Record<string, string> = {
      atualizado_em: new Date().toISOString(),
    };
    if (openaiKey) updates.openai_api_key = openaiKey;
    if (serpKey) updates.serp_api_key = serpKey;

    const { data: existingSecrets } = await supabase
      .from('crm_multiempresas_marketing_ai_studio_secrets')
      .select('id')
      .eq('config_id', config.id)
      .maybeSingle();

    if (existingSecrets) {
      const { error: updateError } = await supabase
        .from('crm_multiempresas_marketing_ai_studio_secrets')
        .update(updates)
        .eq('config_id', config.id);

      if (updateError) throw updateError;
    } else {
      const { error: insertError } = await supabase
        .from('crm_multiempresas_marketing_ai_studio_secrets')
        .insert({
          config_id: config.id,
          openai_api_key: openaiKey ?? null,
          serp_api_key: serpKey ?? null,
        });

      if (insertError) throw insertError;
    }

    return new Response(
      JSON.stringify({
        success: true,
        openai_updated: Boolean(openaiKey),
        serp_updated: Boolean(serpKey),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('salvar-marketing-ai-secrets error:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Erro ao salvar chaves',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
