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
  medias: 'crm_multiempresas_marketing_medias',
  mediaFolders: 'crm_multiempresas_marketing_media_folders',
} as const;

const EMPRESA_TABLES = {
  config: 'agenda_config',
  reunioes: 'agenda_reunioes',
  leads: 'leads',
  medias: 'marketing_medias',
  mediaFolders: 'marketing_media_folders',
} as const;

interface BookingRequest {
  scope: {
    schema: string | null;
    configId: string;
    agendaSlug: string;
  };
  dados: {
    data_hora_inicio: string;
    convidado_nome: string;
    convidado_whatsapp: string;
    convidado_email?: string | null;
    resposta_formulario?: string;
    metadata_capturada?: Record<string, unknown>;
  };
}

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

function normalizePhone(value: string): string {
  return value.replace(/\D/g, '');
}

function todaySaoPaulo(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' });
}

interface UploadedFileRef {
  url: string;
  name: string;
  mime_type: string;
  size: number;
}

function parseUploadFieldValue(raw: unknown): UploadedFileRef | null {
  if (raw === null || raw === undefined) return null;

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('{')) return null;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) return null;
  const record = parsed as Record<string, unknown>;
  const url = typeof record.url === 'string' ? record.url.trim() : '';
  if (!url.startsWith('http')) return null;

  return {
    url,
    name: typeof record.name === 'string' && record.name.trim() ? record.name.trim() : 'Anexo',
    mime_type:
      typeof record.mime_type === 'string' && record.mime_type.trim()
        ? record.mime_type.trim()
        : 'application/octet-stream',
    size: typeof record.size === 'number' && record.size >= 0 ? record.size : 0,
  };
}

function parseUploadFieldValues(raw: unknown): UploadedFileRef[] {
  if (raw === null || raw === undefined) return [];

  let parsed: unknown = raw;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!trimmed.startsWith('[') && !trimmed.startsWith('{')) return [];
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      return [];
    }
  }

  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => parseUploadFieldValue(item))
      .filter((item): item is UploadedFileRef => item !== null);
  }

  const single = parseUploadFieldValue(parsed);
  return single ? [single] : [];
}

function extractFormUploads(respostaFormulario: string | null | undefined): UploadedFileRef[] {
  if (!respostaFormulario?.trim()) return [];
  try {
    const parsed = JSON.parse(respostaFormulario) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return [];
    const uploads: UploadedFileRef[] = [];
    for (const value of Object.values(parsed)) {
      uploads.push(...parseUploadFieldValues(value));
    }
    return uploads;
  } catch {
    return [];
  }
}

function mimeToMediaTipo(mimeType: string): 'pdf' | 'imagem' | 'video' | null {
  const mime = mimeType.toLowerCase();
  if (mime === 'application/pdf') return 'pdf';
  if (mime.startsWith('image/')) return 'imagem';
  if (mime.startsWith('video/')) return 'video';
  return null;
}

const ORCAMENTOS_FOLDER_NAME = 'orçamentos';

async function getOrCreateOrcamentosFolder(
  db: ReturnType<typeof getClient>,
  foldersTable: string,
): Promise<string | null> {
  const { data: existing } = await db
    .from(foldersTable)
    .select('id')
    .eq('nome', ORCAMENTOS_FOLDER_NAME)
    .maybeSingle();

  if (existing?.id) return existing.id as string;

  const { data: created, error } = await db
    .from(foldersTable)
    .insert({ nome: ORCAMENTOS_FOLDER_NAME, descricao: 'Orçamentos de leads' })
    .select('id')
    .single();

  if (error) {
    console.error('Erro ao criar pasta orçamentos:', error);
    return null;
  }
  return created.id as string;
}

async function attachFormUploadsToLead(
  db: ReturnType<typeof getClient>,
  tables: typeof MASTER_TABLES | typeof EMPRESA_TABLES,
  leadId: number,
  respostaFormulario: string | null | undefined,
): Promise<void> {
  const uploads = extractFormUploads(respostaFormulario);
  if (uploads.length === 0) return;

  const folderId = await getOrCreateOrcamentosFolder(db, tables.mediaFolders);
  if (!folderId) return;

  const rows = uploads
    .map((upload) => {
      const tipo = mimeToMediaTipo(upload.mime_type);
      if (!tipo) return null;
      return {
        titulo: upload.name.replace(/\.[^.]+$/, '') || 'Anexo agendamento',
        tipo,
        file_url: upload.url,
        file_name: upload.name,
        file_size: upload.size,
        mime_type: upload.mime_type,
        folder_id: folderId,
        lead_id: leadId,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null);

  if (rows.length === 0) return;

  const { error } = await db.from(tables.medias).insert(rows);
  if (error) {
    console.error('Erro ao vincular anexos do agendamento ao lead:', error);
  }
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

    const body = (await req.json()) as BookingRequest;
    const { scope, dados } = body;

    if (!scope?.configId || !dados?.data_hora_inicio || !dados?.convidado_nome || !dados?.convidado_whatsapp) {
      return jsonResponse({ error: 'Dados incompletos para agendamento' }, 400);
    }

    const db = getClient(supabase, scope.schema ?? null);
    const tables = getTables(scope.schema ?? null);

    const { data: config, error: configError } = await db
      .from(tables.config)
      .select('*')
      .eq('id', scope.configId)
      .eq('slug', scope.agendaSlug)
      .eq('ativo', true)
      .maybeSingle();

    if (configError || !config) {
      return jsonResponse({ error: 'Configuração de agenda não encontrada' }, 404);
    }

    const dataInicio = new Date(dados.data_hora_inicio);
    const dataFim = new Date(dataInicio.getTime() + (config.duracao_minutos as number) * 60000);
    const telefone = normalizePhone(dados.convidado_whatsapp);

    const reuniaoPayload = {
      titulo: `Reunião com ${dados.convidado_nome.trim()}`,
      data_hora_inicio: dados.data_hora_inicio,
      data_hora_fim: dataFim.toISOString(),
      duracao_minutos: config.duracao_minutos,
      convidado_nome: dados.convidado_nome.trim(),
      convidado_whatsapp: telefone,
      convidado_email: dados.convidado_email?.trim() || null,
      resposta_formulario: dados.resposta_formulario || null,
      tipo: 'publico',
      status: 'pendente',
      link_video_conferencia: config.link_video_conferencia,
      metadata_capturada: dados.metadata_capturada ?? null,
      lead_id: null as number | null,
      // NULL = todos os colaboradores são titulares ao nascer do formulário público
      titular_ids: null as string[] | null,
    };

    let leadId: number | null = null;
    const shouldCreateLead = config.criar_lead_automatico !== false;

    if (shouldCreateLead) {
      const statusDestino =
        (config.lead_status_destino as string | null)?.trim() || 'Novo Lead';

      const { data: lead, error: leadError } = await db
        .from(tables.leads)
        .insert({
          nome: dados.convidado_nome.trim(),
          telefone,
          email: dados.convidado_email?.trim() || null,
          status: statusDestino,
          origem: (config.lead_origem as string | null)?.trim() || 'Agendamento Público',
          data_chegada: todaySaoPaulo(),
          valor_negocio: 0,
          observacoes: `Lead criado automaticamente via agendamento público (${scope.agendaSlug}).`,
        })
        .select('id')
        .single();

      if (leadError) {
        console.error('Erro ao criar lead:', leadError);
        return jsonResponse({ error: 'Falha ao criar lead no pipeline' }, 500);
      }

      leadId = lead.id as number;
      reuniaoPayload.lead_id = leadId;

      await attachFormUploadsToLead(db, tables, leadId, dados.resposta_formulario);
    }

    const { data: reuniao, error: reuniaoError } = await db
      .from(tables.reunioes)
      .insert(reuniaoPayload)
      .select('id')
      .single();

    if (reuniaoError) {
      console.error('Erro ao criar reunião:', reuniaoError);
      return jsonResponse({ error: 'Falha ao criar agendamento' }, 500);
    }

    return jsonResponse({
      reuniao_id: reuniao.id,
      lead_id: leadId,
    });
  } catch (error) {
    console.error('agenda-public-booking:', error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    return jsonResponse({ error: message }, 500);
  }
});
