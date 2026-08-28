import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// Função auxiliar para disparar o webhook configurado
async function dispararWebhook(
  supabase: any,
  numeroTelefone: string,
  userId: string,
  userEmail: string
) {
  try {
    // Buscar configuração do webhook de negativação
    const { data: config, error: configError } = await supabase
      .from('negativacao_webhook_config')
      .select('webhook_id, ativo')
      .limit(1)
      .maybeSingle();

    if (configError) {
      console.error('Erro ao buscar config de webhook:', configError);
      return;
    }

    if (!config?.ativo || !config?.webhook_id) {
      console.log('Webhook de negativação desativado ou não configurado');
      return;
    }

    // Buscar URL do webhook
    const { data: webhook, error: webhookError } = await supabase
      .from('CRM-Selletos>webhooks_api<')
      .select('url, nome, ativo')
      .eq('id', config.webhook_id)
      .maybeSingle();

    if (webhookError || !webhook) {
      console.error('Erro ao buscar webhook:', webhookError);
      return;
    }

    if (webhook.ativo === false) {
      console.log('Webhook configurado está inativo:', webhook.nome);
      return;
    }

    // Montar payload
    const payload = {
      evento: 'numero_negativado',
      numero_telefone: numeroTelefone,
      usuario_id: userId,
      usuario_email: userEmail,
      timestamp: new Date().toISOString(),
    };

    console.log(`Disparando webhook "${webhook.nome}" para número ${numeroTelefone}`);

    // Disparar webhook
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      console.error(`Webhook retornou status ${response.status}:`, await response.text());
    } else {
      console.log(`Webhook disparado com sucesso para ${numeroTelefone}`);
    }
  } catch (error) {
    console.error('Erro ao disparar webhook:', error);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extrair JWT do header
    const authHeader = req.headers.get('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autorizado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Decodificar JWT para extrair user_id
    let userId: string;
    let userEmail: string;

    try {
      const payload = JSON.parse(atob(token.split('.')[1]));
      userId = payload.sub;
      userEmail = payload.email || 'unknown';
    } catch (e) {
      console.error('Failed to decode JWT:', e);
      return new Response(
        JSON.stringify({ success: false, error: 'Token inválido' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse body - handle both string and object
    let body: any = {};
    try {
      const text = await req.text();
      console.log('Raw request body:', text);
      if (text) {
        body = JSON.parse(text);
      }
    } catch (e) {
      console.error('Failed to parse body:', e);
    }

    console.log('Parsed body:', JSON.stringify(body));
    
    const numeroTelefoneRaw = String(body?.numeroTelefone ?? '').trim();
    const numeroTelefoneClean = numeroTelefoneRaw.replace(/\D/g, '');

    console.log('numeroTelefoneRaw:', numeroTelefoneRaw);
    console.log('numeroTelefoneClean:', numeroTelefoneClean);

    if (!numeroTelefoneClean) {
      return new Response(
        JSON.stringify({ success: false, error: 'Número não fornecido', debug: { body, numeroTelefoneRaw } }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (numeroTelefoneClean.length < 8) {
      return new Response(
        JSON.stringify({ success: false, error: 'Número inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const numeroTelefone = parseInt(numeroTelefoneClean, 10);

    // Verificar permissão (server-side validation)
    const { data: hasPermissionData, error: permError } = await supabase
      .rpc('has_permission', {
        _user_id: userId,
        _resource: 'numeros_negativados',
        _action: 'create',
      });

    if (permError) {
      console.log('❌ [PERMISSION] Error checking permission:', permError);
    }

    if (!hasPermissionData) {
      return new Response(
        JSON.stringify({ success: false, error: 'Sem permissão para negativar números' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verificar duplicidade
    const { data: existing, error: existingError } = await supabase
      .from('Negativacao-proforco-numeros')
      .select('id')
      .eq('numeroTelefone', numeroTelefone)
      .maybeSingle();

    if (existingError) {
      console.error('Erro ao verificar número existente:', existingError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao verificar número' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (existing) {
      // Disparar webhook mesmo para número já existente
      dispararWebhook(supabase, numeroTelefoneClean, userId, userEmail);
      
      return new Response(
        JSON.stringify({ success: true, alreadyExists: true, id: existing.id, numeroTelefone: numeroTelefoneClean }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: inserted, error: insertError } = await supabase
      .from('Negativacao-proforco-numeros')
      .insert([{ numeroTelefone }])
      .select('id, numeroTelefone')
      .single();

    if (insertError) {
      console.error('Erro ao inserir número:', insertError);
      return new Response(
        JSON.stringify({ success: false, error: insertError.message || 'Erro ao inserir número' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`AUDIT: Número ${numeroTelefoneClean} negativado por ${userEmail} (${userId}) em ${new Date().toISOString()}`);

    // Disparar webhook de negativação (async, não bloqueia resposta)
    dispararWebhook(supabase, numeroTelefoneClean, userId, userEmail);

    return new Response(
      JSON.stringify({ success: true, alreadyExists: false, data: inserted, numeroTelefone: numeroTelefoneClean }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro não tratado:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
