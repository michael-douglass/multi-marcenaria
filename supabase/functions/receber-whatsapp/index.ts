import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface IncomingMessage {
  // Campos do novo formato n8n
  nome?: string;            // Nome do contato (pushName)
  telefone?: string;        // Telefone limpo (sem @s.whatsapp.net)
  mensagem?: string;        // Texto da mensagem
  remoteJid: string;        // Ex: 553199999999@s.whatsapp.net
  timestamp?: string;       // Timestamp da mensagem
  type: string;             // Ex: "conversation", "audioMessage", "imageMessage"
  body?: string;            // URL da mídia (para áudio, imagem, etc.)
  isFromMe?: boolean | string; // Se true/"true", mensagem foi ENVIADA pelo sistema (não recebida)
  isGroup?: boolean;        // Se é mensagem de grupo
  
  // Campos do formato antigo (para compatibilidade)
  content?: string;         // Base64 ou URL da mídia, ou texto
  messageId?: string;       // ID único da mensagem no WhatsApp
  regiao?: 'minas-gerais' | 'sao-paulo';
  fileName?: string;        // Nome do arquivo (para documentos)
  mimeType?: string;        // Tipo MIME do arquivo
}

// Extrai telefone do remoteJid
function extractPhone(remoteJid: string): string {
  // Remove @s.whatsapp.net, @c.us, etc.
  const phone = remoteJid.replace(/@.*$/, '');
  // Remove o 55 do início se tiver
  return phone.replace(/\D/g, '');
}

// Mapeia tipo da mensagem para o campo tipo_mensagem do banco
function mapMessageType(type: string): string {
  switch (type) {
    case 'text': 
    case 'conversation':
    case 'extendedTextMessage':
      return 'texto';
    case 'image': 
    case 'imageMessage':
      return 'imagem';
    case 'audio': 
    case 'audioMessage':
      return 'audio';
    case 'video':
    case 'videoMessage':
      return 'video';
    case 'document': 
    case 'documentMessage':
      return 'pdf';
    default: 
      return 'texto';
  }
}

// Verifica se o tipo é mídia
function isMediaType(type: string): boolean {
  return ['image', 'imageMessage', 'audio', 'audioMessage', 'video', 'videoMessage', 'document', 'documentMessage'].includes(type);
}

// Detecta região pelo DDD
function detectRegionByDDD(phone: string): 'minas-gerais' | 'sao-paulo' {
  // Remove 55 do início se tiver
  const phoneClean = phone.startsWith('55') ? phone.substring(2) : phone;
  const ddd = phoneClean.substring(0, 2);
  
  // DDDs de São Paulo: 11, 12, 13, 14, 15, 16, 17, 18, 19
  const dddsSaoPaulo = ['11', '12', '13', '14', '15', '16', '17', '18', '19'];
  
  return dddsSaoPaulo.includes(ddd) ? 'sao-paulo' : 'minas-gerais';
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

    const payload: IncomingMessage = await req.json();
    
    console.log('📥 Mensagem recebida do n8n/Mega-API:', {
      remoteJid: payload.remoteJid,
      telefone: payload.telefone,
      type: payload.type,
      mensagem: payload.mensagem?.substring(0, 50),
      body: payload.body?.substring(0, 100),
      messageId: payload.messageId,
      regiao: payload.regiao,
      isFromMe: payload.isFromMe,
      hasContent: !!payload.content
    });

    // Validações - aceita remoteJid OU telefone
    if (!payload.remoteJid && !payload.telefone) {
      throw new Error('remoteJid ou telefone é obrigatório');
    }

    // Extrair telefone: prioriza campo telefone, depois extrai do remoteJid
    const telefone = payload.telefone 
      ? payload.telefone.replace(/\D/g, '') 
      : extractPhone(payload.remoteJid);
    
    if (!telefone) {
      throw new Error('Não foi possível extrair o telefone');
    }

    console.log(`📞 Telefone: ${telefone}`);

    // Verificar se já existe mensagem com este ID externo (evitar duplicatas)
    if (payload.messageId) {
      const { data: existing } = await supabase
        .from('crm_selletos_chat_mensagens')
        .select('id')
        .eq('message_id_external', payload.messageId)
        .maybeSingle();

      if (existing) {
        console.log('⚠️ Mensagem já processada:', payload.messageId);
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Mensagem já processada anteriormente',
            data: { mensagem_id: existing.id }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Detectar região
    const regiao = payload.regiao || detectRegionByDDD(telefone);
    const regiaoAmigavel = regiao === 'sao-paulo' ? 'São Paulo' : 'Minas Gerais';
    console.log(`📍 Região: ${regiaoAmigavel}`);

    // Buscar ou criar contato
    let contato;
    const { data: existingContato } = await supabase
      .from('crm_selletos_chat_contatos')
      .select('id, lead_id')
      .eq('telefone', telefone)
      .maybeSingle();

    if (existingContato) {
      contato = existingContato;
      console.log('👤 Contato existente:', contato.id);
    } else {
      // Tentar encontrar lead associado
      const { data: lead } = await supabase
        .from('CRM-Selletos>leads<')
        .select('id, nome')
        .or(`telefone.eq.${telefone},telefone.ilike.%${telefone}%`)
        .limit(1)
        .maybeSingle();

      // Criar novo contato
      const { data: novoContato, error: contatoError } = await supabase
        .from('crm_selletos_chat_contatos')
        .insert({
          telefone: telefone,
          nome: payload.nome || lead?.nome || null,
          lead_id: lead?.id || null,
          ultima_mensagem_em: new Date().toISOString()
        })
        .select()
        .single();

      if (contatoError) {
        console.error('❌ Erro ao criar contato:', contatoError);
        throw new Error('Falha ao criar contato');
      }

      contato = novoContato;
      console.log('👤 Novo contato criado:', contato.id);
    }

    // Determinar se é mídia ou texto usando a função helper
    const tipoMensagem = mapMessageType(payload.type);
    const isMedia = isMediaType(payload.type);
    
    // Determinar conteúdo: prioriza mensagem (texto), depois body (mídia), depois content (compatibilidade)
    const conteudoTexto = payload.mensagem || payload.content || '';
    const urlMidia = payload.body || payload.content || '';
    
    // Determinar tipo de remetente baseado em isFromMe (aceita boolean ou string "true")
    const isFromMe = payload.isFromMe === true || payload.isFromMe === 'true';
    const tipoRemetente = isFromMe ? 'atendente' : 'lead';
    console.log(`📤 Tipo remetente: ${tipoRemetente} (isFromMe raw: ${payload.isFromMe}, parsed: ${isFromMe})`);
    
    // Preparar dados da mensagem
    const mensagemData: Record<string, unknown> = {
      contato_id: contato.id,
      telefone: telefone,
      tipo_remetente: tipoRemetente,
      tipo_mensagem: tipoMensagem,
      origem: 'webhook',
      lida: tipoRemetente === 'atendente', // Se enviada pelo sistema, já está lida
      enviada: true,
      remote_jid: payload.remoteJid || `${telefone}@s.whatsapp.net`,
      message_id_external: payload.messageId || null,
      criado_em: payload.timestamp 
        ? (isNaN(Number(payload.timestamp)) ? payload.timestamp : new Date(Number(payload.timestamp) * 1000).toISOString())
        : new Date().toISOString()
    };

    if (isMedia) {
      // Para mídia, armazenar URL
      mensagemData.url_midia = urlMidia || null;
      mensagemData.file_name = payload.fileName || null;
      mensagemData.mime_type = payload.mimeType || null;
      
      // Definir conteúdo descritivo baseado no tipo
      if (tipoMensagem === 'imagem') {
        mensagemData.conteudo = '[Imagem]';
      } else if (tipoMensagem === 'audio') {
        mensagemData.conteudo = '[Áudio]';
      } else if (tipoMensagem === 'video') {
        mensagemData.conteudo = '[Vídeo]';
      } else if (tipoMensagem === 'pdf') {
        mensagemData.conteudo = `[Documento: ${payload.fileName || 'arquivo'}]`;
      }
    } else {
      mensagemData.conteudo = conteudoTexto;
    }

    // Inserir mensagem
    const { data: novaMensagem, error: mensagemError } = await supabase
      .from('crm_selletos_chat_mensagens')
      .insert(mensagemData)
      .select()
      .single();

    if (mensagemError) {
      console.error('❌ Erro ao salvar mensagem:', mensagemError);
      throw new Error('Falha ao salvar mensagem');
    }

    console.log('✅ Mensagem salva:', novaMensagem.id);

    // Atualizar última mensagem do contato
    await supabase
      .from('crm_selletos_chat_contatos')
      .update({ 
        ultima_mensagem_em: new Date().toISOString(),
        nome: payload.nome || contato.nome // Atualizar nome se veio um novo
      })
      .eq('id', contato.id);

    // Atualizar região do lead se encontrado e não tiver região definida
    if (contato.lead_id) {
      const { data: leadData } = await supabase
        .from('CRM-Selletos>leads<')
        .select('regiao')
        .eq('id', contato.lead_id)
        .single();

      if (leadData && !leadData.regiao) {
        await supabase
          .from('CRM-Selletos>leads<')
          .update({ regiao: regiaoAmigavel })
          .eq('id', contato.lead_id);
        console.log(`📍 Região do lead atualizada para: ${regiaoAmigavel}`);
      }
    }

    // Registrar log
    await supabase
      .from('crm_selletos_chat_logs')
      .insert({
        contato_id: contato.id,
        telefone: telefone,
        evento: 'mensagem_recebida',
        detalhes: {
          tipo: payload.type,
          message_id: payload.messageId,
          regiao: regiao,
          remote_jid: payload.remoteJid
        }
      });

    console.log('📋 Log registrado');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Mensagem recebida e salva',
        data: {
          contato_id: contato.id,
          mensagem_id: novaMensagem.id
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error) {
    console.error('❌ Erro ao processar mensagem:', error);
    const errorMessage = error instanceof Error ? error.message : 'Erro ao processar mensagem';
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});
