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
        JSON.stringify({ success: false, error: 'reuniao_id é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: reuniao, error: reuniaoError } = await supabase
      .from('CRM-Selletos>agenda_reunioes<')
      .select('*')
      .eq('id', reuniao_id)
      .single();

    if (reuniaoError || !reuniao) {
      console.error('Erro ao buscar reunião:', reuniaoError);
      return new Response(
        JSON.stringify({ success: false, error: 'Reunião não encontrada', details: reuniaoError }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: config, error: configError } = await supabase
      .from('CRM-Selletos>agenda_config<')
      .select('webhook_relatorio_reunioes_id')
      .eq('ativo', true)
      .limit(1)
      .maybeSingle();

    if (configError) {
      console.error('Erro ao buscar config agenda:', configError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao ler configuração da agenda.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!config?.webhook_relatorio_reunioes_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'Webhook Relatório de reuniões não configurado. Em Configurações da Agenda, selecione um webhook em "Webhook: Relatório de reuniões" e salve.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { data: webhook, error: webhookError } = await supabase
      .from('CRM-Selletos>webhooks_api<')
      .select('url, ativo')
      .eq('id', config.webhook_relatorio_reunioes_id)
      .single();

    if (webhookError || !webhook) {
      console.error('Webhook não encontrado:', webhookError);
      return new Response(
        JSON.stringify({ success: false, error: 'Webhook não encontrado. Verifique se ainda existe em Configuração de Webhooks.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!webhook.ativo) {
      return new Response(
        JSON.stringify({ success: false, error: 'Webhook está inativo. Ative-o em Configuração de Webhooks.' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dataInicio = reuniao.data_hora_inicio ? new Date(reuniao.data_hora_inicio) : null;
    const dataFim = reuniao.data_hora_fim ? new Date(reuniao.data_hora_fim) : null;

    const payload = {
      tipo_disparo: 'relatorio_aula_experimental',
      reuniao_id: reuniao.id,
      titulo: reuniao.titulo,
      descricao: reuniao.descricao,
      status: reuniao.status,
      tipo: reuniao.tipo,
      // Data e horário
      data_reuniao: dataInicio ? dataInicio.toISOString().slice(0, 10) : null,
      data_reuniao_formatada: dataInicio ? dataInicio.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : null,
      horario_inicio: dataInicio ? dataInicio.toTimeString().slice(0, 5) : null,
      horario_fim: dataFim ? dataFim.toTimeString().slice(0, 5) : null,
      duracao_minutos: reuniao.duracao_minutos,
      data_hora_inicio: reuniao.data_hora_inicio,
      data_hora_fim: reuniao.data_hora_fim,
      // Convidado
      convidado_nome: reuniao.convidado_nome,
      convidado_whatsapp: reuniao.convidado_whatsapp,
      convidado_email: reuniao.convidado_email,
      telefone: reuniao.convidado_whatsapp,
      // Formulário e sistema
      resposta_formulario: reuniao.resposta_formulario,
      resposta_formulario_parsed: parseRespostaFormulario(reuniao.resposta_formulario),
      observacoes: reuniao.observacoes,
      link_video_conferencia: reuniao.link_video_conferencia,
      metadata_capturada: reuniao.metadata_capturada,
      // Datas de controle
      criado_em: reuniao.criado_em,
      atualizado_em: reuniao.atualizado_em,
      confirmado_em: reuniao.confirmado_em,
      concluido_em: reuniao.concluido_em,
      cancelado_em: reuniao.cancelado_em,
      lembrete_enviado_em: reuniao.lembrete_enviado_em,
      confirmacao_enviada_em: reuniao.confirmacao_enviada_em,
      lead_id: reuniao.lead_id,
      responsavel_id: reuniao.responsavel_id,
      uid_aluno: reuniao.lead_id != null ? String(reuniao.lead_id) : null,
    };

    console.log('Disparando webhook Relatório de reuniões para:', webhook.url);

    const webhookResponse = await fetch(webhook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Relatório de aula experimental enviado',
        webhook_status: webhookResponse.status,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Erro no disparo de relatório:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Erro interno', details: String(error) }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function parseRespostaFormulario(resposta: string | null): Record<string, string> | null {
  if (!resposta) return null;
  try {
    return JSON.parse(resposta) as Record<string, string>;
  } catch {
    return null;
  }
}
