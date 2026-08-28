import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReuniaoParaLembrete {
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
    const { reuniao_id, modo, template_id } = body; // modo: 'manual' | 'automatico', template_id: opcional

    // Se for disparo manual de uma reunião específica
    if (modo === 'manual' && reuniao_id) {
      console.log('🔔 Disparo manual de lembrete para reunião:', reuniao_id, template_id ? `(template: ${template_id})` : '');
      
      // Buscar a reunião específica
      const { data: reuniao, error: reuniaoError } = await supabase
        .from('CRM-Selletos>agenda_reunioes<')
        .select('id, titulo, data_hora_inicio, convidado_nome, convidado_whatsapp')
        .eq('id', reuniao_id)
        .single();

      if (reuniaoError || !reuniao) {
        console.error('Erro ao buscar reunião:', reuniaoError);
        return new Response(JSON.stringify({ error: 'Reunião não encontrada' }), {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Buscar configuração da agenda para o webhook e template
      const { data: config, error: configError } = await supabase
        .from('CRM-Selletos>agenda_config<')
        .select('webhook_lembrete_id, template_lembrete_id')
        .eq('ativo', true)
        .single();

      if (configError || !config?.webhook_lembrete_id) {
        return new Response(JSON.stringify({ error: 'Webhook de lembrete não configurado' }), {
          status: 400,
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
        return new Response(JSON.stringify({ error: 'Webhook não encontrado ou inativo' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Buscar e processar o template (usa template_id do request ou o configurado)
      let mensagemTemplate: string | null = null;
      const templateIdToUse = template_id || config.template_lembrete_id;
      
      if (templateIdToUse) {
        const dataHora = new Date(reuniao.data_hora_inicio);
        const dataFormatada = dataHora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const horaFormatada = dataHora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

        const { data: template } = await supabase
          .from('atalhos')
          .select('mensagem')
          .eq('id', templateIdToUse)
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

      // Disparar o webhook com template processado
      const resultado = await dispararWebhook(webhook.url, reuniao as ReuniaoParaLembrete, mensagemTemplate);

      if (resultado.success) {
        // Atualizar a reunião com o timestamp do lembrete
        await supabase
          .from('CRM-Selletos>agenda_reunioes<')
          .update({ lembrete_enviado_em: new Date().toISOString() })
          .eq('id', reuniao_id);
      }

      return new Response(JSON.stringify({
        success: resultado.success,
        message: resultado.success ? 'Lembrete enviado com sucesso!' : 'Erro ao enviar lembrete',
        reuniao: reuniao.titulo,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Modo automático: verificar todas as reuniões que precisam de lembrete
    console.log('🔔 Verificando reuniões para disparo automático de lembretes...');

    // Buscar configuração da agenda
    const { data: config, error: configError } = await supabase
      .from('CRM-Selletos>agenda_config<')
      .select('webhook_lembrete_id, minutos_antecedencia_lembrete, template_lembrete_id')
      .eq('ativo', true)
      .single();

    if (configError || !config?.webhook_lembrete_id) {
      return new Response(JSON.stringify({ 
        message: 'Webhook de lembrete não configurado',
        enviados: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const minutos = config.minutos_antecedencia_lembrete || 60;

    // Buscar URL do webhook
    const { data: webhook, error: webhookError } = await supabase
      .from('CRM-Selletos>webhooks_api<')
      .select('url, nome')
      .eq('id', config.webhook_lembrete_id)
      .eq('ativo', true)
      .single();

    if (webhookError || !webhook) {
      return new Response(JSON.stringify({ 
        message: 'Webhook não encontrado ou inativo',
        enviados: 0 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Buscar template se configurado
    let templateMensagem: string | null = null;
    if (config.template_lembrete_id) {
      const { data: template } = await supabase
        .from('atalhos')
        .select('mensagem')
        .eq('id', config.template_lembrete_id)
        .single();
      templateMensagem = template?.mensagem || null;
    }

    // Calcular janela de tempo para lembretes
    // Reuniões que estão entre (agora + minutos) e (agora + minutos + 5min)
    // Isso permite uma margem de 5 minutos para o cron job
    const agora = new Date();
    const limiteInicio = new Date(agora.getTime() + (minutos * 60 * 1000));
    const limiteFim = new Date(limiteInicio.getTime() + (5 * 60 * 1000));

    console.log(`Buscando reuniões entre ${limiteInicio.toISOString()} e ${limiteFim.toISOString()}`);

    // Buscar reuniões pendentes/confirmadas que precisam de lembrete
    const { data: reunioes, error: reunioesError } = await supabase
      .from('CRM-Selletos>agenda_reunioes<')
      .select('id, titulo, data_hora_inicio, convidado_nome, convidado_whatsapp')
      .in('status', ['pendente', 'confirmado'])
      .gte('data_hora_inicio', limiteInicio.toISOString())
      .lte('data_hora_inicio', limiteFim.toISOString())
      .is('lembrete_enviado_em', null)
      .not('convidado_whatsapp', 'is', null);

    if (reunioesError) {
      console.error('Erro ao buscar reuniões:', reunioesError);
      return new Response(JSON.stringify({ error: 'Erro ao buscar reuniões' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Encontradas ${reunioes?.length || 0} reuniões para enviar lembrete`);

    let enviados = 0;
    const erros: string[] = [];

    for (const reuniao of reunioes || []) {
      // Processar template para cada reunião
      let mensagemProcessada: string | null = null;
      if (templateMensagem) {
        const dataHora = new Date(reuniao.data_hora_inicio);
        const dataFormatada = dataHora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
        const horaFormatada = dataHora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });
        
        mensagemProcessada = templateMensagem
          .replace(/\{\{nome\}\}/g, reuniao.convidado_nome || 'Visitante')
          .replace(/\{\{telefone\}\}/g, reuniao.convidado_whatsapp || '')
          .replace(/\{\{titulo\}\}/g, reuniao.titulo || 'Reunião')
          .replace(/\{\{data\}\}/g, dataFormatada)
          .replace(/\{\{horario\}\}/g, horaFormatada)
          .replace(/\{\{reuniao_id\}\}/g, reuniao.id);
      }

      const resultado = await dispararWebhook(webhook.url, reuniao as ReuniaoParaLembrete, mensagemProcessada);
      
      if (resultado.success) {
        // Marcar lembrete como enviado
        await supabase
          .from('CRM-Selletos>agenda_reunioes<')
          .update({ lembrete_enviado_em: new Date().toISOString() })
          .eq('id', reuniao.id);
        enviados++;
      } else {
        erros.push(`${reuniao.titulo}: ${resultado.error}`);
      }
    }

    return new Response(JSON.stringify({
      success: true,
      message: `${enviados} lembrete(s) enviado(s)`,
      enviados,
      erros: erros.length > 0 ? erros : undefined,
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

async function dispararWebhook(
  webhookUrl: string, 
  reuniao: ReuniaoParaLembrete,
  mensagemTemplate?: string | null
): Promise<{ success: boolean; error?: string }> {
  try {
    // Formatar data/hora para exibição
    const dataHora = new Date(reuniao.data_hora_inicio);
    const dataFormatada = dataHora.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
    const horaFormatada = dataHora.toLocaleTimeString('pt-BR', { timeZone: 'America/Sao_Paulo', hour: '2-digit', minute: '2-digit' });

    const payload = {
      tipo_disparo: 'lembrete',
      telefone: reuniao.convidado_whatsapp,
      nome: reuniao.convidado_nome,
      titulo: reuniao.titulo,
      data: dataFormatada,
      horario: horaFormatada,
      data_hora_inicio: reuniao.data_hora_inicio,
      reuniao_id: reuniao.id,
      mensagem: mensagemTemplate || null, // Mensagem do template já processada (ou null)
    };

    console.log('📤 Disparando webhook para:', reuniao.convidado_whatsapp, 'Payload:', JSON.stringify(payload));

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Erro do webhook:', response.status, errorText);
      return { success: false, error: `HTTP ${response.status}: ${errorText}` };
    }

    console.log('✅ Webhook disparado com sucesso para:', reuniao.titulo);
    return { success: true };
  } catch (error: unknown) {
    console.error('Erro ao disparar webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return { success: false, error: errorMessage };
  }
}
