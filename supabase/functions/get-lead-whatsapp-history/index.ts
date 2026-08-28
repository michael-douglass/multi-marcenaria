import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface ChatMessage {
  id: number
  type: 'human' | 'ai'
  content: string
  empresa: string
  criado_em?: string
}

// Função para detectar mensagens de sistema
function isSystemMessage(content: string): boolean {
  const systemPatterns = [
    /hora e dia:/i,
    /#Sua identidade:/i,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/,
    /você é uma atendente/i,
    /Seu nome é \w+/i,
    /reforço escolar: Pro-forco/i,
  ];

  return systemPatterns.some(pattern => pattern.test(content));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { telefone } = await req.json()
    
    if (!telefone) {
      return new Response(
        JSON.stringify({ error: 'Telefone é obrigatório' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Normalizar telefone (remover caracteres especiais)
    const telefoneNormalizado = telefone.replace(/\D/g, '')
    console.log(`📞 Telefone recebido: ${telefone}`)
    console.log(`📞 Telefone normalizado: ${telefoneNormalizado}`)
    console.log(`📊 Query: .like('session_id', '%${telefoneNormalizado}%')`)

    // Buscar em ambas as tabelas - AUMENTAR LIMITE para pegar todas as mensagens
    const [history1, history2] = await Promise.all([
      supabaseClient
        .from('n8n_chat_histories')
        .select('id, session_id, message')
        .like('session_id', `%${telefoneNormalizado}%`)
        .order('id', { ascending: true })
        .limit(500),
      
      supabaseClient
        .from('n8n_chat_histories_proforco_saopaulo')
        .select('id, session_id, message')
        .like('session_id', `%${telefoneNormalizado}%`)
        .order('id', { ascending: true })
        .limit(500)
    ])

    let rawCount1 = history1.data?.length || 0
    let rawCount2 = history2.data?.length || 0
    console.log(`📊 Resultados brutos:`)
    console.log(`   - Betim (n8n_chat_histories): ${rawCount1} mensagens`)
    console.log(`   - São Paulo (n8n_chat_histories_proforco_saopaulo): ${rawCount2} mensagens`)
    
    // Mostrar exemplos de session_id encontrados
    if (history1.data && history1.data.length > 0) {
      console.log(`   - Exemplo session_id Betim: ${history1.data[0].session_id}`)
    }
    if (history2.data && history2.data.length > 0) {
      console.log(`   - Exemplo session_id São Paulo: ${history2.data[0].session_id}`)
    }

    // Processar e FILTRAR mensagens
    const messages: ChatMessage[] = []
    let filteredCount = 0
    
    // Calcular offset de ID para sincronizar timestamps entre tabelas
    // IDs de n8n_chat_histories começam em ~100000
    // IDs de n8n_chat_histories_proforco_saopaulo começam em ~15000
    // Precisamos normalizar para uma timeline comum
    
    // Encontrar o menor e maior ID de cada tabela para normalização
    const minIdBetim = history1.data && history1.data.length > 0 ? Math.min(...history1.data.map(r => r.id)) : 0;
    const minIdSP = history2.data && history2.data.length > 0 ? Math.min(...history2.data.map(r => r.id)) : 0;
    
    console.log(`📊 Min ID Betim: ${minIdBetim}, Min ID SP: ${minIdSP}`);
    
    if (history1.data) {
      history1.data.forEach(row => {
        if (!isSystemMessage(row.message.content)) {
          messages.push({
            id: row.id,
            type: row.message.type,
            content: row.message.content,
            empresa: 'Pro-Forco Betim',
            // Não enviar criado_em - vamos usar o ID para ordenação
          })
        } else {
          filteredCount++
        }
      })
    }

    if (history2.data) {
      history2.data.forEach(row => {
        if (!isSystemMessage(row.message.content)) {
          messages.push({
            id: row.id,
            type: row.message.type,
            content: row.message.content,
            empresa: 'Pro-Forco São Paulo',
            // Não enviar criado_em - vamos usar o ID para ordenação
          })
        } else {
          filteredCount++
        }
      })
    }

    // Ordenar por ID (mais antigas primeiro - cronológico) - retornar TODAS
    const sortedMessages = messages.sort((a, b) => a.id - b.id)

    console.log(`Mensagens filtradas: ${filteredCount} mensagens de sistema removidas`)
    console.log(`Total de mensagens retornadas: ${sortedMessages.length}`)

    return new Response(
      JSON.stringify({ messages: sortedMessages }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('Error fetching WhatsApp history:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
