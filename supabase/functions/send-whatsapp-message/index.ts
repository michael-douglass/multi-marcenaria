import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SendMessageRequest {
  telefone: string;
  mensagem?: string;
  tipo?: 'texto' | 'audio' | 'pdf' | 'imagem';
  arquivo?: string; // base64
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

    // Verificar autenticação
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Usuário não autenticado' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 });
    }

    // Verificar permissão (vendedor e admin podem enviar)
    const { data: hasPermission, error: permError } = await supabase.rpc('has_permission', {
      _user_id: user.id,
      _resource: 'send_whatsapp',
      _action: 'edit'
    });

    if (permError) {
      console.error('Erro ao verificar permissão:', permError);
      return new Response(JSON.stringify({ error: 'Erro ao verificar permissão' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
    if (!hasPermission) {
      return new Response(JSON.stringify({ error: 'Sem permissão para enviar mensagens WhatsApp' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 });
    }

    let body: SendMessageRequest;
    try {
      body = await req.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Corpo da requisição inválido (JSON)' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    const { telefone, mensagem, tipo = 'texto', arquivo } = body;

    if (!telefone || typeof telefone !== 'string' || telefone.replace(/\D/g, '').length < 10) {
      return new Response(JSON.stringify({ error: 'Telefone inválido ou ausente' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }
    if (tipo === 'texto' && (mensagem === undefined || mensagem === null || (typeof mensagem === 'string' && !mensagem.trim()))) {
      return new Response(JSON.stringify({ error: 'Mensagem de texto não pode estar vazia' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 });
    }

    console.log('📤 Enviando mensagem WhatsApp:', { telefone, tipo });

    // Normalizar telefone (remover caracteres especiais)
    const telefoneNormalizado = telefone.replace(/\D/g, '');

    // Mapeamento de região amigável para tabela de chat n8n
    const regiaoParaTabelaChat: Record<string, string> = {
      'Minas Gerais': 'n8n_chat_histories',
      'São Paulo': 'n8n_chat_histories_proforco_saopaulo',
    };

    // NOVO: Primeiro tentar buscar a região diretamente do lead
    console.log('🔍 Buscando região do lead no banco...');
    
    const { data: lead } = await supabase
      .from('CRM-Selletos>leads<')
      .select('id, regiao, regiao_tabela')
      .or(`telefone.eq.${telefone},telefone.eq.${telefoneNormalizado},telefone.ilike.%${telefoneNormalizado}%`)
      .limit(1)
      .single();

    let tabelaOrigem = 'n8n_chat_histories'; // Default: Minas Gerais
    let regiaoDetectada = 'Minas Gerais';

    if (lead?.regiao && regiaoParaTabelaChat[lead.regiao]) {
      // Lead tem região definida, usar diretamente
      regiaoDetectada = lead.regiao;
      tabelaOrigem = regiaoParaTabelaChat[lead.regiao];
      console.log(`📍 Região encontrada no lead: ${lead.regiao}`);
    } else {
      // Fallback: detectar via histórico de chat
      console.log('🔍 Lead sem região definida, buscando histórico...');

      const [historyMG, historySP] = await Promise.all([
        supabase
          .from('n8n_chat_histories')
          .select('id')
          .ilike('session_id', `%${telefoneNormalizado}%`)
          .limit(1),
        supabase
          .from('n8n_chat_histories_proforco_saopaulo')
          .select('id')
          .ilike('session_id', `%${telefoneNormalizado}%`)
          .limit(1)
      ]);

      if (historySP.data && historySP.data.length > 0) {
        tabelaOrigem = 'n8n_chat_histories_proforco_saopaulo';
        regiaoDetectada = 'São Paulo';
        console.log('📍 Lead encontrado em histórico: São Paulo');
      } else if (historyMG.data && historyMG.data.length > 0) {
        tabelaOrigem = 'n8n_chat_histories';
        regiaoDetectada = 'Minas Gerais';
        console.log('📍 Lead encontrado em histórico: Minas Gerais');
      } else {
        // Fallback final: usar DDD para decidir
        const ddd = telefoneNormalizado.substring(2, 4); // Pega DDD (após +55)
        
        // DDDs de São Paulo: 11, 12, 13, 14, 15, 16, 17, 18, 19
        const dddsSaoPaulo = ['11', '12', '13', '14', '15', '16', '17', '18', '19'];
        
        if (dddsSaoPaulo.includes(ddd)) {
          tabelaOrigem = 'n8n_chat_histories_proforco_saopaulo';
          regiaoDetectada = 'São Paulo';
          console.log(`📍 Lead novo (sem histórico). DDD ${ddd} → São Paulo`);
        } else {
          tabelaOrigem = 'n8n_chat_histories';
          regiaoDetectada = 'Minas Gerais';
          console.log(`📍 Lead novo (sem histórico). DDD ${ddd} → Minas Gerais`);
        }
      }
    }

    console.log('🔍 Detecção de webhook:');
    console.log(`   📞 Telefone: ${telefone}`);
    console.log(`   📍 Região detectada: ${regiaoDetectada}`);
    console.log(`   🎯 Tabela de chat: ${tabelaOrigem}`);

    // Buscar webhook correto baseado na tabela de origem; fallback para qualquer webhook ativo
    let { data: webhook, error: webhookError } = await supabase
      .from('CRM-Selletos>webhooks_api<')
      .select('url, nome, id')
      .eq('tipo', 'whatsapp')
      .eq('ativo', true)
      .eq('tabela_origem', tabelaOrigem)
      .maybeSingle();

    if (webhookError) {
      console.error('❌ Erro ao buscar webhook:', webhookError);
      return new Response(JSON.stringify({ error: 'Erro ao buscar configuração de envio' }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 });
    }
    if (!webhook) {
      const { data: fallback } = await supabase
        .from('CRM-Selletos>webhooks_api<')
        .select('url, nome, id')
        .eq('tipo', 'whatsapp')
        .eq('ativo', true)
        .limit(1)
        .maybeSingle();
      if (fallback) {
        webhook = fallback;
        console.log(`⚠️ Usando webhook fallback (${webhook.nome}) para região ${regiaoDetectada}`);
      }
    }
    if (!webhook) {
      return new Response(JSON.stringify({ error: `Webhook WhatsApp não configurado para região ${regiaoDetectada}. Configure em Configurações > Webhooks.` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 404 });
    }

    console.log(`   🌐 Webhook: ${webhook.nome}`);
    console.log(`   🔗 URL: ${webhook.url}`);

    // Montar payload para n8n com suporte a mídia e região
    const payload: Record<string, unknown> = {
      chat_id: telefone,
      tipo: tipo,
      texto: tipo === 'texto' ? mensagem : null,
      region: regiaoDetectada === 'São Paulo' ? 'sao-paulo' : 'minas-gerais',
      recipientId: telefoneNormalizado
    };

    // Se for mídia, adicionar dados específicos
    if (tipo !== 'texto' && arquivo) {
      payload.data = {
        content: arquivo,
        type: tipo,
        mimeType: tipo === 'audio' ? 'audio/ogg' : tipo === 'imagem' ? 'image/jpeg' : 'application/pdf'
      };
    } else if (tipo === 'texto') {
      // Manter compatibilidade com formato antigo
      payload.texto = mensagem;
    }

    console.log('📡 Chamando webhook n8n:', webhook.url);
    console.log('📦 Payload:', JSON.stringify({ ...payload, data: payload.data ? '...(base64)' : undefined }));

    // Chamar webhook n8n
    const webhookResponse = await fetch(webhook.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!webhookResponse.ok) {
      const errorText = await webhookResponse.text();
      console.error('❌ Erro do webhook:', errorText);
      return new Response(JSON.stringify({ error: `Falha ao enviar mensagem: ${webhookResponse.statusText}. ${errorText.slice(0, 200)}` }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 502 });
    }

    console.log('✅ Mensagem enviada com sucesso');

    // =============================================
    // NOVO: Persistir mensagem enviada no banco local
    // =============================================
    try {
      console.log('💾 Salvando mensagem no banco local...');

      // Buscar ou criar contato
      let contato;
      const { data: existingContato } = await supabase
        .from('crm_selletos_chat_contatos')
        .select('id')
        .eq('telefone', telefoneNormalizado)
        .single();

      if (existingContato) {
        contato = existingContato;
      } else {
        // Tentar encontrar lead associado
        const { data: lead } = await supabase
          .from('CRM-Selletos>leads<')
          .select('id, nome')
          .or(`telefone.eq.${telefone},telefone.eq.${telefoneNormalizado},telefone.ilike.%${telefoneNormalizado}%`)
          .limit(1)
          .single();

        const { data: novoContato, error: contatoError } = await supabase
          .from('crm_selletos_chat_contatos')
          .insert({
            telefone: telefoneNormalizado,
            nome: lead?.nome || null,
            lead_id: lead?.id || null,
            webhook_id: webhook.id,
            ultima_mensagem_em: new Date().toISOString()
          })
          .select()
          .single();

        if (contatoError) {
          console.error('⚠️ Erro ao criar contato:', contatoError);
        } else {
          contato = novoContato;
        }
      }

      // Verificar duplicatas antes de inserir (mesmo conteúdo + telefone nos últimos 30 segundos)
      const conteudoMensagem = tipo === 'texto' ? mensagem : null;
      const trintaSegundosAtras = new Date(Date.now() - 30000).toISOString();
      
      let isDuplicate = false;
      if (conteudoMensagem) {
        const { data: existingMsg } = await supabase
          .from('crm_selletos_chat_mensagens')
          .select('id')
          .eq('telefone', telefoneNormalizado)
          .eq('conteudo', conteudoMensagem)
          .eq('tipo_remetente', 'atendente')
          .gte('criado_em', trintaSegundosAtras)
          .limit(1)
          .maybeSingle();
        
        isDuplicate = !!existingMsg;
        if (isDuplicate && existingMsg) {
          console.log('⚠️ Mensagem duplicada detectada, não será salva novamente:', existingMsg.id);
        }
      }

      // Inserir mensagem apenas se não for duplicada
      if (!isDuplicate) {
        const { error: insertMsgError } = await supabase
          .from('crm_selletos_chat_mensagens')
          .insert({
            contato_id: contato?.id || null,
            telefone: telefoneNormalizado,
            tipo_remetente: 'atendente',
            usuario_id: user.id,
            tipo_mensagem: tipo,
            conteudo: conteudoMensagem,
            url_midia: tipo !== 'texto' && arquivo ? arquivo : null,
            file_name: tipo === 'pdf' ? 'documento.pdf' : null,
            mime_type: tipo === 'audio' ? 'audio/ogg' : tipo === 'imagem' ? 'image/jpeg' : tipo === 'pdf' ? 'application/pdf' : null,
            origem: 'crm',
            lida: true,
            enviada: true
          });

        if (insertMsgError) {
          console.error('⚠️ Erro ao salvar mensagem:', insertMsgError);
        } else {
          console.log('✅ Mensagem salva no banco local');
        }
      }

      // Registrar log
      await supabase
        .from('crm_selletos_chat_logs')
        .insert({
          contato_id: contato?.id || null,
          telefone: telefoneNormalizado,
          evento: 'mensagem_enviada',
          detalhes: {
            tipo: tipo,
            usuario_id: user.id,
            webhook_id: webhook.id
          }
        });

    } catch (persistError) {
      console.error('⚠️ Erro ao persistir mensagem (não crítico):', persistError);
      // Não falhar a requisição por causa disso
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mensagem enviada com sucesso' 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Erro ao enviar mensagem:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao enviar mensagem';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    );
  }
});
