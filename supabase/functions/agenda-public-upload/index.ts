import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MASTER_TABLES = {
  config: 'CRM-multi-empresas>agenda_config<',
  reunioes: 'CRM-multi-empresas>agenda_reunioes<',
  leads: 'CRM-multi-empresas>leads<',
} as const;

const EMPRESA_TABLES = {
  config: 'agenda_config',
  reunioes: 'agenda_reunioes',
  leads: 'leads',
} as const;

const ALLOWED_MIME = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'application/pdf',
]);

const MAX_BYTES = 50 * 1024 * 1024;
const BUCKET = 'agenda-form-uploads';

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getClient(supabase: ReturnType<typeof createClient>, schema: string | null) {
  if (schema) return supabase.schema(schema);
  return supabase;
}

function getTables(schema: string | null) {
  return schema ? EMPRESA_TABLES : MASTER_TABLES;
}

function sanitizePath(value: string): string {
  return value.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 80);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { status: 204, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const formData = await req.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return jsonResponse({ error: 'Arquivo é obrigatório' }, 400);
    }

    if (!ALLOWED_MIME.has(file.type)) {
      return jsonResponse({ error: 'Tipo de arquivo não permitido' }, 400);
    }

    if (file.size > MAX_BYTES) {
      return jsonResponse({ error: 'Arquivo muito grande (máx. 50MB)' }, 400);
    }

    const schema = (formData.get('schema') as string | null)?.trim() || null;
    const configId = (formData.get('config_id') as string | null)?.trim();
    const fieldKey = (formData.get('field_key') as string | null)?.trim() || 'anexo';

    if (!configId) {
      return jsonResponse({ error: 'config_id é obrigatório' }, 400);
    }

    const db = getClient(supabase, schema);
    const tables = getTables(schema);

    const { data: config, error: configError } = await db
      .from(tables.config)
      .select('id, ativo')
      .eq('id', configId)
      .eq('ativo', true)
      .maybeSingle();

    if (configError || !config) {
      return jsonResponse({ error: 'Agenda não encontrada ou inativa' }, 404);
    }

    const ext = file.name.includes('.') ? file.name.split('.').pop() : 'bin';
    const prefix = schema ? sanitizePath(schema) : 'master';
    const path = `${prefix}/${configId}/${sanitizePath(fieldKey)}/${crypto.randomUUID()}.${ext}`;

    const buffer = await file.arrayBuffer();
    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, buffer, {
        contentType: file.type,
        upsert: false,
      });

    if (uploadError) {
      console.error('Erro upload agenda:', uploadError);
      return jsonResponse({ error: 'Falha ao salvar arquivo' }, 500);
    }

    const { data: publicUrl } = supabase.storage.from(BUCKET).getPublicUrl(path);

    return jsonResponse({
      url: publicUrl.publicUrl,
      name: file.name,
      mime_type: file.type,
      size: file.size,
      path,
    });
  } catch (error) {
    console.error('agenda-public-upload:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return jsonResponse({ error: message }, 500);
  }
});
