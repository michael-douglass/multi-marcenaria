import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WebhookPayload {
  telefone: string;
  tipo?: 'texto' | 'audio' | 'imagem' | 'pdf';
  conteudo?: string;
  url_midia?: string;
  origem?: string;
  nome_contato?: string;
  webhook_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Obter webhook_id da query string (opcional)
    const url = new URL(req.url);
    const webhookIdFromQuery = url.searchParams.get('webhook_id');

    const payload: WebhookPayload = await req.json();
    
    console.log('📥 Webhook recebido:', JSON.stringify(payload, null, 2));

    const {
      telefone,
      tipo = 'texto',
      conteudo,
      url_midia,
      origem = 'webhook',
      nome_contato,
      webhook_id = webhookIdFromQuery
    } = payload;

    if (!telefone) {
      throw new Error('Telefone é obrigatório');
    }

    // Normalizar telefone (remover caracteres especiais)
    const telefoneNormalizado = telefone.replace(/\D/g, '');
    console.log('📞 Telefone normalizado:', telefoneNormalizado);

    // Buscar ou criar contato
    let { data: contato, error: contatoError } = await supabase
      .from('crm_selletos_chat_contatos')
      .select('*')
      .eq('telefone', telefoneNormalizado)
      .single();

    if (contatoError && contatoError.code === 'PGRST116') {
      // Contato não existe, criar novo
      console.log('👤 Criando novo contato...');
      
      // Tentar encontrar lead associado
      const { data: lead } = await supabase
        .from('CRM-Selletos>leads<')
        .select('id, nome')
        .or(`telefone.eq.${telefone},telefone.eq.${telefoneNormalizado},telefone.ilike.%${telefoneNormalizado}%`)
        .limit(1)
        .single();

      const { data: novoContato, error: insertError } = await supabase
        .from('crm_selletos_chat_contatos')
        .insert({
          telefone: telefoneNormalizado,
          nome: nome_contato || lead?.nome || null,
          lead_id: lead?.id || null,
          webhook_id: webhook_id || null,
          ultima_mensagem_em: new Date().toISOString()
        })
        .select()
        .single();

      if (insertError) {
        console.error('❌ Erro ao criar contato:', insertError);
        throw insertError;
      }

      contato = novoContato;
      console.log('✅ Contato criado:', contato.id);
    } else if (contatoError) {
      throw contatoError;
    } else {
      console.log('👤 Contato existente:', contato.id);
      
      // Atualizar nome se fornecido e não existir
      if (nome_contato && !contato.nome) {
        await supabase
          .from('crm_selletos_chat_contatos')
          .update({ nome: nome_contato })
          .eq('id', contato.id);
      }
    }

    // Inserir mensagem
    const { data: mensagem, error: mensagemError } = await supabase
      .from('crm_selletos_chat_mensagens')
      .insert({
        contato_id: contato.id,
        telefone: telefoneNormalizado,
        tipo_remetente: 'lead',
        tipo_mensagem: tipo,
        conteudo: conteudo,
        url_midia: url_midia,
        origem: origem,
        lida: false,
        enviada: true
      })
      .select()
      .single();

    if (mensagemError) {
      console.error('❌ Erro ao inserir mensagem:', mensagemError);
      throw mensagemError;
    }

    console.log('✅ Mensagem salva:', mensagem.id);

    // Registrar log
    await supabase
      .from('crm_selletos_chat_logs')
      .insert({
        contato_id: contato.id,
        telefone: telefoneNormalizado,
        evento: 'mensagem_recebida',
        detalhes: {
          mensagem_id: mensagem.id,
          tipo: tipo,
          origem: origem,
          webhook_id: webhook_id
        }
      });

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Mensagem recebida e salva',
        data: {
          contato_id: contato.id,
          mensagem_id: mensagem.id
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    );

  } catch (error) {
    console.error('❌ Erro no webhook:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao processar webhook';
    
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    );
  }
});
