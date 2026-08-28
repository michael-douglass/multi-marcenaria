import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReuniaoParaConfirmacao {
  id: string;
  titulo: string;
  data_hora_inicio: string;
  convidado_nome: string | null;
  convidado_whatsapp: string | null;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json().catch(() => ({}));
    const { reuniao_id } = body;

    if (!reuniao_id) {
      return new Response(JSON.stringify({ error: 'reuniao_id é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('📧 Disparando confirmação para reunião:', reuniao_id);

    // Buscar a reunião
    const { data: reuniao, error: reuniaoError } = await supabase
      .from('CRM-Selletos>agenda_reunioes<')
      .select('id, titulo, data_hora_inicio, convidado_nome, convidado_whatsapp, confirmacao_enviada_em')
      .eq('id', reuniao_id)
      .single();

    if (reuniaoError || !reuniao) {
      console.error('Erro ao buscar reunião:', reuniaoError);
      return new Response(JSON.stringify({ error: 'Reunião não encontrada' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se já foi enviada
    if (reuniao.confirmacao_enviada_em) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Confirmação já foi enviada anteriormente' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verificar se tem telefone
    if (!reuniao.convidado_whatsapp) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Reunião não tem telefone de contato' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar configuração com template e webhook
    const { data: config, error: configError } = await supabase
      .from('CRM-Selletos>agenda_config<')
      .select('template_confirmacao_id, webhook_lembrete_id')
      .eq('ativo', true)
      .single();

    if (configError || !config?.webhook_lembrete_id) {
      console.log('Webhook não configurado, pulando disparo');
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Webhook não configurado' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar URL do webhook
    const { data: webhook, error: webhookError } = await supabase
      .from('CRM-Selletos>webhooks_api<')
      .select('url, nome')
      .eq('id', config.webhook_lembrete_id)
      .eq('ativo', true)
      .single();

    if (webhookError || !webhook) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Webhook não encontrado ou inativo' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Formatar data/hora com timezone de São Paulo
    const dataHora = new Date(reuniao.data_hora_inicio);
    const dataFormatada = dataHora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const horaFormatada = dataHora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

    // Buscar e processar o template se configurado
    let mensagemTemplate: string | null = null;
    if (config.template_confirmacao_id) {
      const { data: template } = await supabase
        .from('atalhos')
        .select('mensagem')
        .eq('id', config.template_confirmacao_id)
        .single();

      if (template?.mensagem) {
        mensagemTemplate = template.mensagem
          .replace(/\{\{nome\}\}/g, reuniao.convidado_nome || 'Visitante')
          .replace(/\{\{telefone\}\}/g, reuniao.convidado_whatsapp || '')
          .replace(/\{\{titulo\}\}/g, reuniao.titulo || 'Reunião')
          .replace(/\{\{data\}\}/g, dataFormatada)
          .replace(/\{\{horario\}\}/g, horaFormatada)
          .replace(/\{\{reuniao_id\}\}/g, reuniao.id);
      }
    }

    // Montar payload para o webhook
    const payload = {
      tipo_disparo: 'confirmacao',
      telefone: reuniao.convidado_whatsapp,
      nome: reuniao.convidado_nome,
      titulo: reuniao.titulo,
      data: dataFormatada,
      horario: horaFormatada,
      data_hora_inicio: reuniao.data_hora_inicio,
      reuniao_id: reuniao.id,
      mensagem: mensagemTemplate, // Mensagem do template já processada (ou null)
    };

    console.log('📤 Disparando webhook de confirmação:', JSON.stringify(payload));

    // Disparar o webhook
    const response = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro do webhook:', response.status, errorText);
      return new Response(JSON.stringify({ 
        success: false, 
        error: `HTTP ${response.status}: ${errorText}` 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Marcar como enviada
    await supabase
      .from('CRM-Selletos>agenda_reunioes<')
      .update({ confirmacao_enviada_em: new Date().toISOString() })
      .eq('id', reuniao_id);

    console.log('✅ Confirmação enviada com sucesso para:', reuniao.convidado_whatsapp);

    return new Response(JSON.stringify({
      success: true,
      message: 'Confirmação enviada com sucesso!',
      reuniao: reuniao.titulo,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: unknown) {
    console.error('Erro na edge function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
