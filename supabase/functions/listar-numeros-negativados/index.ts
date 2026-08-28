import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';
import { corsHeaders } from '../_shared/cors.ts';

const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

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

    // Verificar permissão (server-side validation)
    const { data: hasPermissionData, error: permError } = await supabase
      .rpc('has_permission', {
        _user_id: userId,
        _resource: 'numeros_negativados',
        _action: 'view'
      });

    if (permError) {
      console.log('❌ [PERMISSION] Error checking permission:', permError);
    }

    if (!hasPermissionData) {
      console.log('❌ [PERMISSION] User does not have permission to view numeros_negativados');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Sem permissão para visualizar números negativados' 
        }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ [PERMISSION] User has permission to view numeros_negativados');

    // Obter parâmetro de busca da URL
    const url = new URL(req.url);
    const searchTerm = url.searchParams.get('search') || '';

    console.log(`Listando números negativados - Usuário: ${userEmail}, Busca: "${searchTerm}"`);

    // Query base
    let query = supabase
      .from('Negativacao-proforco-numeros')
      .select('id, numeroTelefone')
      .order('id', { ascending: false });

    // Aplicar filtro de busca se fornecido
    if (searchTerm.trim()) {
      // Converter numeroTelefone para texto e buscar
      query = query.filter('numeroTelefone', 'eq', parseInt(searchTerm.trim()));
    }

    // Limitar a 100 resultados para performance
    query = query.limit(100);

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar números:', error);
      return new Response(
        JSON.stringify({ success: false, error: 'Erro ao buscar números' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Encontrados ${data?.length || 0} números`);

    return new Response(
      JSON.stringify({
        success: true,
        data: data || [],
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
