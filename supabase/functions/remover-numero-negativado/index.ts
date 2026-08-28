import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const webhookUrl = 'https://primary-production-19cf.up.railway.app/webhook/443ed26f-87ef-452f-a0f0-d1597d621b46';

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
      console.error('No authorization token provided');
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

    console.log('✅ [AUTH] User authenticated:', userId, '(via JWT decode)');

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Obter ID do body
    const { id } = await req.json();

    if (!id) {
      return new Response(
        JSON.stringify({ success: false, error: 'ID não fornecido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Removendo número - ID: ${id}, Usuário: ${userEmail}`);

    // Buscar o número antes de deletar (para logging e webhook)
    const { data: numero, error: fetchError } = await supabase
      .from('Negativacao-proforco-numeros')
      .select('numeroTelefone')
      .eq('id', id)
      .single();

    if (fetchError || !numero) {
      console.error('Número não encontrado:', fetchError);
      return new Response(
        JSON.stringify({ success: false, error: 'Número não encontrado' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const numeroTelefone = numero.numeroTelefone?.toString() ?? '';
    console.log(`Número encontrado: ${numeroTelefone || 'valor nulo'}`);

    // Deletar pelo ID (mais seguro, funciona mesmo se numeroTelefone for null)
    const { error: deleteError } = await supabase
      .from('Negativacao-proforco-numeros')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('Erro ao deletar número:', deleteError);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao deletar número' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Número deletado com sucesso: ${numeroTelefone}`);

    // Audit trail completo no log
    console.log(`AUDIT: Número ${numeroTelefone} removido por ${userEmail} (${userId}) em ${new Date().toISOString()}`);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Número removido com sucesso',
        numeroRemovido: numeroTelefone,
      }),
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
