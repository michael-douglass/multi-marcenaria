import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReuniaoPayload {
  reuniao_id: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: ReuniaoPayload = await req.json();
    const { reuniao_id } = body;

    if (!reuniao_id) {
      return new Response(
        JSON.stringify({ error: 'reuniao_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar dados da reunião
    const { data: reuniao, error: reuniaoError } = await supabase
      .from('CRM-Selletos>agenda_reunioes<')
      .select('*')
      .eq('id', reuniao_id)
      .single();

    if (reuniaoError || !reuniao) {
      console.error('Erro ao buscar reunião:', reuniaoError);
      return new Response(
        JSON.stringify({ error: 'Reunião não encontrada', details: reuniaoError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar configuração da agenda para obter o webhook de conclusão
    const { data: config, error: configError } = await supabase
      .from('CRM-Selletos>agenda_config<')
      .select('webhook_concluido_id')
      .limit(1)
      .single();

    if (configError || !config?.webhook_concluido_id) {
      console.log('Webhook de conclusão não configurado');
      return new Response(
        JSON.stringify({ success: true, message: 'Nenhum webhook de conclusão configurado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar URL do webhook
    const { data: webhook, error: webhookError } = await supabase
      .from('CRM-Selletos>webhooks_api<')
      .select('url, ativo')
      .eq('id', config.webhook_concluido_id)
      .single();

    if (webhookError || !webhook || !webhook.ativo) {
      console.log('Webhook não encontrado ou inativo');
      return new Response(
        JSON.stringify({ success: true, message: 'Webhook não encontrado ou inativo' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Montar payload
    const payload = {
      tipo_disparo: 'conclusao',
      reuniao_id: reuniao.id,
      titulo: reuniao.titulo,
      data_hora_inicio: reuniao.data_hora_inicio,
      data_hora_fim: reuniao.data_hora_fim,
      duracao_minutos: reuniao.duracao_minutos,
      convidado_nome: reuniao.convidado_nome,
      convidado_whatsapp: reuniao.convidado_whatsapp,
      convidado_email: reuniao.convidado_email,
      tipo: reuniao.tipo,
      status: reuniao.status,
      concluido_em: reuniao.concluido_em,
      observacoes: reuniao.observacoes,
      resposta_formulario: reuniao.resposta_formulario,
      metadata_capturada: reuniao.metadata_capturada,
    };

    console.log('Disparando webhook de conclusão para:', webhook.url);
    console.log('Payload:', JSON.stringify(payload));

    // Disparar webhook
    const webhookResponse = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const responseStatus = webhookResponse.status;
    console.log('Webhook response status:', responseStatus);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook de conclusão disparado',
        webhook_status: responseStatus
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Erro no disparo de conclusão:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
