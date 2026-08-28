import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIM = 1536;
const CHUNK_MAX_CHARS = 1200;
const CHUNK_OVERLAP = 150;
const MAX_MEDIA_VISION = 12;
const MAX_CLIENT_MEDIA_PAGES = 20;
const MAX_WHATSAPP_MESSAGES = 80;
const EMBEDDING_BATCH_SIZE = 64;
const VISION_CONCURRENCY = 4;

interface AgendaFormUploadedFile {
  url: string;
  name: string;
  mime_type: string;
}

export interface ClientMediaItem {
  source: string;
  id: string;
  label: string;
  imageUrl?: string;
  pagesBase64?: string[];
}

export interface KnowledgeChunkInput {
  source_type: string;
  source_id: string;
  chunk_index: number;
  content: string;
  metadata?: Record<string, unknown>;
}

export function isEmpresaSchema(schema: string | null | undefined): boolean {
  return !!schema && /^emp_[a-z0-9_]+$/.test(schema);
}

export function resolveDb(client: SupabaseClient, empresaSchema?: string | null) {
  if (isEmpresaSchema(empresaSchema)) {
    return client.schema(empresaSchema!);
  }
  return client;
}

export function chunksTableName(empresaSchema?: string | null): string {
  return isEmpresaSchema(empresaSchema)
    ? 'lead_ai_knowledge_chunks'
    : 'CRM-multi-empresas>lead_ai_knowledge_chunks<';
}

export function metaTableName(empresaSchema?: string | null): string {
  return isEmpresaSchema(empresaSchema)
    ? 'lead_ai_knowledge_meta'
    : 'CRM-multi-empresas>lead_ai_knowledge_meta<';
}

export function matchRpcName(empresaSchema?: string | null): string {
  return isEmpresaSchema(empresaSchema) ? 'match_lead_knowledge' : 'match_lead_knowledge_me';
}

export function leadsTableName(empresaSchema?: string | null): string {
  return isEmpresaSchema(empresaSchema) ? 'leads' : 'CRM-multi-empresas>leads<';
}

export async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function chunkText(text: string, maxLen = CHUNK_MAX_CHARS, overlap = CHUNK_OVERLAP): string[] {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];
  if (normalized.length <= maxLen) return [normalized];

  const chunks: string[] = [];
  let start = 0;

  while (start < normalized.length) {
    let end = Math.min(start + maxLen, normalized.length);
    if (end < normalized.length) {
      const slice = normalized.slice(start, end);
      const breakAt = Math.max(slice.lastIndexOf('\n\n'), slice.lastIndexOf('. '));
      if (breakAt > maxLen * 0.4) {
        end = start + breakAt + 1;
      }
    }
    const piece = normalized.slice(start, end).trim();
    if (piece) chunks.push(piece);
    if (end >= normalized.length) break;
    start = Math.max(end - overlap, start + 1);
  }

  return chunks;
}

async function fetchEmbeddingBatch(
  apiKey: string,
  texts: string[],
  model: string,
): Promise<number[][]> {
  const openAiRes = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      input: texts,
      dimensions: EMBEDDING_DIM,
    }),
  });

  if (!openAiRes.ok) {
    const errText = await openAiRes.text();
    console.error('OpenAI embeddings error:', openAiRes.status, errText);
    throw new Error(`Erro ao gerar embeddings (${openAiRes.status})`);
  }

  const data = await openAiRes.json();
  const items = (data?.data ?? []) as Array<{ embedding: number[]; index: number }>;
  return items
    .sort((a, b) => a.index - b.index)
    .map((item) => item.embedding);
}

export async function createEmbeddings(
  apiKey: string,
  texts: string[],
  model = EMBEDDING_MODEL,
): Promise<number[][]> {
  if (texts.length === 0) return [];

  const embeddings: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBEDDING_BATCH_SIZE) {
    const batch = texts.slice(i, i + EMBEDDING_BATCH_SIZE);
    const batchEmbeddings = await fetchEmbeddingBatch(apiKey, batch, model);
    embeddings.push(...batchEmbeddings);
  }
  return embeddings;
}

export async function createEmbedding(
  apiKey: string,
  text: string,
  model = EMBEDDING_MODEL,
): Promise<number[]> {
  const [embedding] = await createEmbeddings(apiKey, [text], model);
  if (!embedding) throw new Error('Embedding vazio');
  return embedding;
}

function formatCurrencyBRL(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function summarizeOrcamentoDados(dados: Record<string, unknown> | null | undefined): string {
  if (!dados || typeof dados !== 'object') return 'Sem detalhes estruturados.';

  const lines: string[] = [];
  const prec = dados.precificacao as Record<string, unknown> | undefined;
  if (prec) {
    const valorFinal = Number(prec.valor_final ?? 0);
    if (valorFinal > 0) lines.push(`Valor final: ${formatCurrencyBRL(valorFinal)}`);
    const parcelas = Number(prec.parcelas ?? 0);
    if (parcelas > 0) lines.push(`Parcelas: ${parcelas}x`);
  }
  if (dados.prazo_entrega) lines.push(`Prazo: ${String(dados.prazo_entrega)}`);
  const respostas = dados.respostas as Record<string, unknown> | undefined;
  if (respostas) {
    for (const [key, value] of Object.entries(respostas).slice(0, 15)) {
      const val = Array.isArray(value) ? value.join(', ') : String(value);
      if (val.trim()) lines.push(`${key}: ${val}`);
    }
  }
  return lines.length > 0 ? lines.join('\n') : 'Orçamento sem campos preenchidos.';
}

async function urlToBase64(url: string): Promise<string | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buffer = await res.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const contentType = res.headers.get('content-type') || 'image/jpeg';
    return `data:${contentType};base64,${btoa(binary)}`;
  } catch {
    return null;
  }
}

async function extractTextFromImageUrl(
  apiKey: string,
  imageUrl: string,
  label: string,
): Promise<string | null> {
  let url = imageUrl;
  if (!url.startsWith('data:')) {
    const converted = await urlToBase64(url);
    if (!converted) return null;
    url = converted;
  }

  const openAiRes = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                `Extraia TODO o texto visível e descreva o conteúdo deste documento/imagem (${label}) de forma objetiva para consulta comercial. Inclua medidas, nomes de ambientes, materiais e valores se aparecerem. Português do Brasil.`,
            },
            { type: 'image_url', image_url: { url, detail: 'low' } },
          ],
        },
      ],
    }),
  });

  if (!openAiRes.ok) {
    console.error('Vision OCR error:', await openAiRes.text());
    return null;
  }

  const data = await openAiRes.json();
  return data?.choices?.[0]?.message?.content?.trim() ?? null;
}

function parseAgendaFormUploadValue(raw: unknown): AgendaFormUploadedFile | null {
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
    name:
      typeof record.name === 'string' && record.name.trim()
        ? record.name.trim()
        : 'Anexo do formulário',
    mime_type:
      typeof record.mime_type === 'string' && record.mime_type.trim()
        ? record.mime_type.trim()
        : 'application/octet-stream',
  };
}

function parseAgendaFormUploadFieldValue(raw: unknown): AgendaFormUploadedFile[] {
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
      .map((item) => parseAgendaFormUploadValue(item))
      .filter((item): item is AgendaFormUploadedFile => item !== null);
  }

  const single = parseAgendaFormUploadValue(parsed);
  return single ? [single] : [];
}

function extractAgendaFormUploads(respostaFormulario: string): AgendaFormUploadedFile[] {
  try {
    const parsed = JSON.parse(respostaFormulario) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') return [];

    const uploads: AgendaFormUploadedFile[] = [];
    const seen = new Set<string>();
    for (const value of Object.values(parsed)) {
      for (const file of parseAgendaFormUploadFieldValue(value)) {
        if (seen.has(file.url)) continue;
        seen.add(file.url);
        uploads.push(file);
      }
    }
    return uploads;
  } catch {
    return [];
  }
}

async function mapWithConcurrency<T>(
  items: T[],
  concurrency: number,
  worker: (item: T) => Promise<void>,
): Promise<void> {
  if (items.length === 0) return;
  let index = 0;
  const runners = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await worker(current);
    }
  });
  await Promise.all(runners);
}

function parseFormResponse(raw: string): Record<string, string> {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed as Record<string, unknown>)) {
        out[k] = Array.isArray(v) ? v.join(', ') : String(v ?? '');
      }
      return out;
    }
  } catch {
    // fallback linha a linha
  }
  const out: Record<string, string> = {};
  for (const line of raw.split('\n')) {
    const idx = line.indexOf(':');
    if (idx > 0) {
      out[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
    }
  }
  return out;
}

function isSystemWhatsAppMessage(content: string): boolean {
  return [
    /hora e dia:/i,
    /#Sua identidade:/i,
    /você é uma atendente/i,
  ].some((p) => p.test(content));
}

export interface CollectSourcesOptions {
  includeMediaVision?: boolean;
  includeWhatsapp?: boolean;
  openAiKey?: string;
}

export async function collectLeadKnowledgeSources(
  db: ReturnType<typeof resolveDb>,
  client: SupabaseClient,
  leadId: number,
  empresaSchema: string | null | undefined,
  options: CollectSourcesOptions = {},
): Promise<{ chunks: KnowledgeChunkInput[]; fingerprint: string }> {
  const leadsTable = leadsTableName(empresaSchema);
  const fingerprintParts: string[] = [];
  const rawSources: Array<{ type: string; id: string; text: string; meta?: Record<string, unknown> }> = [];

  const { data: leadRow } = await db
    .from(leadsTable)
    .select(
      'nome, email, telefone, empresa, origem, regiao, observacoes, valor_negocio, valor_orcamento, status, motivo_perda, atualizado_em',
    )
    .eq('id', leadId)
    .maybeSingle();

  if (leadRow) {
    fingerprintParts.push(`lead:${leadRow.atualizado_em ?? ''}`);
    const profileLines = [
      `Nome: ${leadRow.nome ?? 'Não informado'}`,
      `Telefone: ${leadRow.telefone ?? 'Não informado'}`,
      `E-mail: ${leadRow.email ?? 'Não informado'}`,
      `Empresa: ${leadRow.empresa ?? 'Não informada'}`,
      `Origem: ${leadRow.origem ?? 'Não informada'}`,
      `Região: ${leadRow.regiao ?? 'Não informada'}`,
      `Status: ${leadRow.status ?? ''}`,
      `Valor do negócio: ${formatCurrencyBRL(Number(leadRow.valor_negocio ?? 0))}`,
      `Valor orçamento (card): ${formatCurrencyBRL(Number(leadRow.valor_orcamento ?? 0))}`,
    ];
    if (leadRow.motivo_perda) profileLines.push(`Motivo perda: ${leadRow.motivo_perda}`);
    if (leadRow.observacoes?.trim()) profileLines.push(`Observações: ${leadRow.observacoes.trim()}`);
    rawSources.push({
      type: 'lead_profile',
      id: String(leadId),
      text: profileLines.join('\n'),
      meta: { label: 'Dados do lead' },
    });
  }

  const analisesTable = isEmpresaSchema(empresaSchema)
    ? 'lead_ai_analises'
    : 'CRM-multi-empresas>lead_ai_analises<';

  const { data: analises } = await db
    .from(analisesTable)
    .select('id, conteudo, perguntas_briefing, criado_em')
    .eq('lead_id', leadId)
    .order('criado_em', { ascending: false })
    .limit(3);

  for (const analise of analises ?? []) {
    fingerprintParts.push(`analise:${analise.id}:${analise.criado_em}`);
    if (analise.conteudo?.trim()) {
      rawSources.push({
        type: 'analise',
        id: analise.id as string,
        text: analise.conteudo as string,
        meta: { label: 'Análise visual IA', criado_em: analise.criado_em },
      });
    }
    if (analise.perguntas_briefing?.trim()) {
      rawSources.push({
        type: 'briefing',
        id: analise.id as string,
        text: analise.perguntas_briefing as string,
        meta: { label: 'Perguntas de briefing' },
      });
    }
  }

  if (isEmpresaSchema(empresaSchema)) {
    const { data: orcamentos } = await db
      .from('orcamento_slides')
      .select('id, identificador, status, cliente_nome, dados, atualizado_em')
      .eq('lead_id', leadId)
      .order('atualizado_em', { ascending: false })
      .limit(5);

    for (const orc of orcamentos ?? []) {
      fingerprintParts.push(`orc:${orc.id}:${orc.atualizado_em}`);
      rawSources.push({
        type: 'orcamento',
        id: orc.id as string,
        text: [
          `Orçamento: ${orc.identificador} (${orc.status})`,
          `Cliente: ${orc.cliente_nome || 'Não informado'}`,
          summarizeOrcamentoDados(orc.dados as Record<string, unknown>),
        ].join('\n'),
        meta: { label: orc.identificador as string },
      });
    }

    const { data: reuniao } = await db
      .from('agenda_reunioes')
      .select('id, titulo, resposta_formulario, data_hora_inicio, atualizado_em')
      .eq('lead_id', leadId)
      .not('resposta_formulario', 'is', null)
      .order('criado_em', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (reuniao?.resposta_formulario?.trim()) {
      fingerprintParts.push(`form:${reuniao.id}:${reuniao.atualizado_em ?? ''}`);
      const parsed = parseFormResponse(reuniao.resposta_formulario);
      const lines = Object.entries(parsed)
        .filter(([, v]) => v.trim())
        .map(([k, v]) => `${k}: ${v}`);
      if (lines.length > 0) {
        rawSources.push({
          type: 'formulario',
          id: reuniao.id as string,
          text: `Formulário de agendamento (${reuniao.titulo}):\n${lines.join('\n')}`,
          meta: { label: 'Formulário preenchido' },
        });
      }

      const formFiles = extractAgendaFormUploads(reuniao.resposta_formulario);
      for (const file of formFiles) {
        const isImage = file.mime_type.startsWith('image/');
        const isPdf = file.mime_type === 'application/pdf';
        if (!isImage && !isPdf) continue;
        const sourceId = `form-file:${encodeURIComponent(file.url)}`;
        fingerprintParts.push(`formfile:${file.url}`);
        rawSources.push({
          type: 'formulario_arquivo',
          id: sourceId,
          text: `Formulário — ${file.name}`,
          meta: { label: file.name, file_url: file.url },
        });
      }
    }

    const { data: anexos } = await db
      .from('marketing_medias')
      .select('id, titulo, file_name, file_url, tipo, mime_type, criado_em')
      .eq('lead_id', leadId)
      .order('criado_em', { ascending: false })
      .limit(30);

    type VisionCandidate = { sourceId: string; url: string; label: string };
    const visionCandidates: VisionCandidate[] = [];

    for (const anexo of anexos ?? []) {
      fingerprintParts.push(`anexo:${anexo.id}:${anexo.criado_em}`);
      const label = anexo.titulo || anexo.file_name || 'Anexo';
      rawSources.push({
        type: 'anexo',
        id: anexo.id as string,
        text: `Anexo: ${label} (${anexo.tipo ?? 'arquivo'})`,
        meta: { label, file_url: anexo.file_url, tipo: anexo.tipo },
      });

      const isImage =
        anexo.tipo === 'imagem' || (anexo.mime_type?.startsWith('image/') ?? false);
      const isPdf = anexo.tipo === 'pdf' || anexo.mime_type === 'application/pdf';

      if (
        options.includeMediaVision &&
        options.openAiKey &&
        anexo.file_url &&
        (isImage || isPdf)
      ) {
        visionCandidates.push({
          sourceId: anexo.id as string,
          url: anexo.file_url as string,
          label,
        });
      }
    }

    if (reuniao?.resposta_formulario?.trim()) {
      for (const file of extractAgendaFormUploads(reuniao.resposta_formulario)) {
        const isImage = file.mime_type.startsWith('image/');
        const isPdf = file.mime_type === 'application/pdf';
        if (!isImage && !isPdf) continue;
        visionCandidates.push({
          sourceId: `form-file:${encodeURIComponent(file.url)}`,
          url: file.url,
          label: file.name,
        });
      }
    }

    if (options.includeMediaVision && options.openAiKey && visionCandidates.length > 0) {
      const uniqueVision = visionCandidates.filter(
        (item, index, arr) => arr.findIndex((x) => x.sourceId === item.sourceId) === index,
      );
      await mapWithConcurrency(
        uniqueVision.slice(0, MAX_MEDIA_VISION),
        VISION_CONCURRENCY,
        async (candidate) => {
          const extracted = await extractTextFromImageUrl(
            options.openAiKey!,
            candidate.url,
            candidate.label,
          );
          if (!extracted) return;
          const source = rawSources.find((item) => item.id === candidate.sourceId);
          if (source) {
            source.text += `\n\nConteúdo extraído:\n${extracted}`;
          }
        },
      );
    }

    const whiteboardTable = 'lead_whiteboard_images';
    const { data: whiteboardImages } = await db
      .from(whiteboardTable)
      .select('id, titulo, image_url, criado_em')
      .eq('lead_id', leadId)
      .order('criado_em', { ascending: false })
      .limit(15);

    const whiteboardVisionCandidates: VisionCandidate[] = [];
    for (const wb of whiteboardImages ?? []) {
      fingerprintParts.push(`wb:${wb.id}:${wb.criado_em}`);
      rawSources.push({
        type: 'whiteboard',
        id: wb.id as string,
        text: `Lousa: ${wb.titulo || 'Imagem da lousa'}`,
        meta: { label: wb.titulo },
      });
      if (options.includeMediaVision && options.openAiKey && wb.image_url) {
        whiteboardVisionCandidates.push({
          sourceId: wb.id as string,
          url: wb.image_url as string,
          label: wb.titulo || 'Lousa',
        });
      }
    }

    if (options.includeMediaVision && options.openAiKey && whiteboardVisionCandidates.length > 0) {
      await mapWithConcurrency(
        whiteboardVisionCandidates.slice(0, MAX_MEDIA_VISION),
        VISION_CONCURRENCY,
        async (candidate) => {
          const extracted = await extractTextFromImageUrl(
            options.openAiKey!,
            candidate.url,
            candidate.label,
          );
          if (!extracted) return;
          const source = rawSources.find((item) => item.id === candidate.sourceId);
          if (source) {
            source.text += `\n\nConteúdo:\n${extracted}`;
          }
        },
      );
    }

    const { data: renders } = await db
      .from('lead_ai_renders')
      .select('id, prompt, analise_yaml, criado_em')
      .eq('lead_id', leadId)
      .order('criado_em', { ascending: false })
      .limit(5);

    for (const render of renders ?? []) {
      fingerprintParts.push(`render:${render.id}:${render.criado_em}`);
      const parts = [];
      if (render.prompt) parts.push(`Prompt render: ${render.prompt}`);
      if (render.analise_yaml) parts.push(`Análise YAML:\n${render.analise_yaml}`);
      if (parts.length > 0) {
        rawSources.push({
          type: 'render',
          id: render.id as string,
          text: parts.join('\n\n'),
          meta: { label: 'Render IA' },
        });
      }
    }
  } else {
    const { data: anexos } = await client
      .from('crm_multiempresas_marketing_medias')
      .select('id, titulo, file_name, file_url, tipo, mime_type, criado_em')
      .eq('lead_id', leadId)
      .order('criado_em', { ascending: false })
      .limit(30);

    for (const anexo of anexos ?? []) {
      fingerprintParts.push(`anexo:${anexo.id}:${anexo.criado_em}`);
      rawSources.push({
        type: 'anexo',
        id: anexo.id as string,
        text: `Anexo: ${anexo.titulo || anexo.file_name} (${anexo.tipo ?? 'arquivo'})`,
        meta: { label: anexo.titulo },
      });
    }
  }

  if (leadRow?.telefone && options.includeWhatsapp !== false) {
    const telefoneNorm = String(leadRow.telefone).replace(/\D/g, '');
    if (telefoneNorm.length >= 8) {
      const [h1, h2] = await Promise.all([
        client
          .from('n8n_chat_histories')
          .select('id, message')
          .like('session_id', `%${telefoneNorm}%`)
          .order('id', { ascending: true })
          .limit(MAX_WHATSAPP_MESSAGES),
        client
          .from('n8n_chat_histories_proforco_saopaulo')
          .select('id, message')
          .like('session_id', `%${telefoneNorm}%`)
          .order('id', { ascending: true })
          .limit(MAX_WHATSAPP_MESSAGES),
      ]);

      const messages: string[] = [];
      for (const row of [...(h1.data ?? []), ...(h2.data ?? [])]) {
        const msg = row.message as { type?: string; content?: string } | string;
        let content = '';
        let role = '';
        if (typeof msg === 'string') {
          try {
            const parsed = JSON.parse(msg);
            content = parsed?.content ?? parsed?.text ?? msg;
            role = parsed?.type === 'human' ? 'Cliente' : 'Atendimento';
          } catch {
            content = msg;
          }
        } else if (msg && typeof msg === 'object') {
          content = msg.content ?? '';
          role = msg.type === 'human' ? 'Cliente' : 'Atendimento';
        }
        if (!content?.trim() || isSystemWhatsAppMessage(content)) continue;
        messages.push(`${role}: ${content.trim()}`);
      }

      if (messages.length > 0) {
        fingerprintParts.push(`whatsapp:${messages.length}:${messages.at(-1)?.slice(0, 40) ?? ''}`);
        rawSources.push({
          type: 'whatsapp',
          id: telefoneNorm,
          text: `Histórico WhatsApp:\n${messages.join('\n')}`,
          meta: { label: 'WhatsApp' },
        });
      }
    }
  }

  const chunks: KnowledgeChunkInput[] = [];
  for (const source of rawSources) {
    const pieces = chunkText(source.text);
    pieces.forEach((piece, index) => {
      chunks.push({
        source_type: source.type,
        source_id: source.id,
        chunk_index: index,
        content: piece,
        metadata: { ...source.meta, source_type: source.type },
      });
    });
  }

  const fingerprint = await sha256Hex(fingerprintParts.sort().join('|'));
  return { chunks, fingerprint };
}

async function buildChunksFromClientMedia(
  apiKey: string,
  items: ClientMediaItem[],
  maxPages = MAX_CLIENT_MEDIA_PAGES,
): Promise<KnowledgeChunkInput[]> {
  const chunks: KnowledgeChunkInput[] = [];
  let pageBudget = maxPages;

  type PageJob = {
    item: ClientMediaItem;
    pageIndex: number;
    b64: string;
    label: string;
  };

  const pageJobs: PageJob[] = [];

  for (const item of items) {
    if (pageBudget <= 0) break;

    if (item.pagesBase64?.length) {
      for (let i = 0; i < item.pagesBase64.length && pageBudget > 0; i++) {
        const raw = item.pagesBase64[i];
        const b64 = raw.includes(',') ? raw.split(',')[1]! : raw;
        const label =
          item.pagesBase64.length > 1 ? `${item.label} — Pág. ${i + 1}` : item.label;
        pageJobs.push({ item, pageIndex: i, b64, label });
        pageBudget--;
      }
      continue;
    }

    if (item.imageUrl && pageBudget > 0) {
      pageJobs.push({
        item,
        pageIndex: 0,
        b64: '',
        label: item.label,
        imageUrl: item.imageUrl,
      } as PageJob & { imageUrl: string });
      pageBudget--;
    }
  }

  await mapWithConcurrency(pageJobs, VISION_CONCURRENCY, async (job) => {
    const sourceType = job.item.source === 'whiteboard' ? 'whiteboard' : 'anexo';
    const url =
      'imageUrl' in job && typeof job.imageUrl === 'string'
        ? job.imageUrl
        : `data:image/jpeg;base64,${job.b64}`;
    const extracted = await extractTextFromImageUrl(apiKey, url, job.label);
    if (!extracted?.trim()) return;

    const text = `${job.label}\n\nConteúdo extraído:\n${extracted}`;
    chunkText(text).forEach((piece, chunkIndex) => {
      chunks.push({
        source_type: sourceType,
        source_id:
          job.item.pagesBase64 && job.item.pagesBase64.length > 1
            ? `${job.item.id}:p${job.pageIndex + 1}`
            : job.item.id,
        chunk_index: chunkIndex,
        content: piece,
        metadata: {
          label: job.label,
          source_type: sourceType,
          page: job.pageIndex + 1,
        },
      });
    });
  });

  return chunks;
}

function stripShallowMediaChunks(chunks: KnowledgeChunkInput[]): KnowledgeChunkInput[] {
  return chunks.filter((chunk) => {
    if (chunk.source_type !== 'anexo' && chunk.source_type !== 'whiteboard') return true;
    return (
      chunk.content.includes('Conteúdo extraído') ||
      chunk.content.includes('Conteúdo:\n') ||
      chunk.content.length > 120
    );
  });
}

export interface IndexLeadKnowledgeOptions {
  force?: boolean;
  includeMediaVision?: boolean;
  includeWhatsapp?: boolean;
  embeddingModel?: string;
  clientMedia?: ClientMediaItem[];
  clientMediaMaxPages?: number;
}

export async function indexLeadKnowledge(
  client: SupabaseClient,
  leadId: number,
  empresaSchema: string | null | undefined,
  openAiKey: string,
  options: IndexLeadKnowledgeOptions = {},
): Promise<{ chunkCount: number; skipped: boolean }> {
  const db = resolveDb(client, empresaSchema);
  const chunksTable = chunksTableName(empresaSchema);
  const metaTable = metaTableName(empresaSchema);

  const hasClientMedia = (options.clientMedia?.length ?? 0) > 0;

  let { chunks, fingerprint } = await collectLeadKnowledgeSources(
    db,
    client,
    leadId,
    empresaSchema,
    {
      includeMediaVision: options.includeMediaVision ?? true,
      includeWhatsapp: options.includeWhatsapp ?? true,
      openAiKey,
    },
  );

  if (hasClientMedia && options.clientMedia) {
    const clientChunks = await buildChunksFromClientMedia(
      openAiKey,
      options.clientMedia,
      options.clientMediaMaxPages ?? MAX_CLIENT_MEDIA_PAGES,
    );
    chunks = [...stripShallowMediaChunks(chunks), ...clientChunks];
    const clientFingerprint = await sha256Hex(
      options.clientMedia
        .map((m) => `${m.source}:${m.id}:${m.pagesBase64?.length ?? (m.imageUrl ? 1 : 0)}`)
        .sort()
        .join('|'),
    );
    fingerprint = await sha256Hex(`${fingerprint}|client_media:${clientFingerprint}`);
  }

  if (chunks.length === 0) {
    await db.from(metaTable).upsert({
      lead_id: leadId,
      sources_fingerprint: fingerprint,
      chunk_count: 0,
      status: 'ready',
      indexed_at: new Date().toISOString(),
      error_message: null,
    });
    return { chunkCount: 0, skipped: false };
  }

  const { data: existingMeta } = await db
    .from(metaTable)
    .select('sources_fingerprint, status')
    .eq('lead_id', leadId)
    .maybeSingle();

  if (!options.force && existingMeta?.sources_fingerprint === fingerprint) {
    if (existingMeta.status === 'ready') {
      return { chunkCount: 0, skipped: true };
    }
    // Evita loop: outra requisição já está indexando o mesmo conteúdo
    if (existingMeta.status === 'indexing') {
      return { chunkCount: 0, skipped: true };
    }
  }

  await db.from(metaTable).upsert({
    lead_id: leadId,
    sources_fingerprint: fingerprint,
    status: 'indexing',
    error_message: null,
    atualizado_em: new Date().toISOString(),
  });

  try {
    await db.from(chunksTable).delete().eq('lead_id', leadId);

    const embeddingModel = options.embeddingModel?.trim() || EMBEDDING_MODEL;
    const embeddings = await createEmbeddings(
      openAiKey,
      chunks.map((c) => c.content),
      embeddingModel,
    );

    const rows = await Promise.all(
      chunks.map(async (chunk, i) => ({
        lead_id: leadId,
        source_type: chunk.source_type,
        source_id: chunk.source_id,
        chunk_index: chunk.chunk_index,
        content: chunk.content,
        content_hash: await sha256Hex(chunk.content),
        metadata: chunk.metadata ?? {},
        embedding: embeddings[i],
      })),
    );

    const BATCH = 50;
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await db.from(chunksTable).insert(batch);
      if (error) throw error;
    }

    await db.from(metaTable).upsert({
      lead_id: leadId,
      sources_fingerprint: fingerprint,
      chunk_count: rows.length,
      status: 'ready',
      indexed_at: new Date().toISOString(),
      error_message: null,
    });

    return { chunkCount: rows.length, skipped: false };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Erro ao indexar';
    await db.from(metaTable).upsert({
      lead_id: leadId,
      sources_fingerprint: fingerprint,
      status: 'error',
      error_message: message,
    });
    throw err;
  }
}

export async function searchLeadKnowledge(
  client: SupabaseClient,
  leadId: number,
  empresaSchema: string | null | undefined,
  openAiKey: string,
  query: string,
  matchCount = 10,
  embeddingModel = EMBEDDING_MODEL,
): Promise<Array<{ content: string; source_type: string; metadata: Record<string, unknown>; similarity: number }>> {
  const db = resolveDb(client, empresaSchema);
  const embedding = await createEmbedding(openAiKey, query, embeddingModel);
  const rpcName = matchRpcName(empresaSchema);

  const { data, error } = await db.rpc(rpcName, {
    p_lead_id: leadId,
    query_embedding: embedding,
    match_count: matchCount,
    match_threshold: 0.35,
  });

  if (error) {
    console.error('match_lead_knowledge error:', error);
    return [];
  }

  return (data ?? []).map((row: {
    content: string;
    source_type: string;
    metadata: Record<string, unknown>;
    similarity: number;
  }) => ({
    content: row.content,
    source_type: row.source_type,
    metadata: row.metadata ?? {},
    similarity: row.similarity,
  }));
}

export function formatRetrievedContext(
  hits: Array<{ content: string; source_type: string; metadata: Record<string, unknown> }>,
): string {
  if (hits.length === 0) {
    return 'Nenhum trecho adicional recuperado da base de conhecimento deste lead.';
  }

  return hits
    .map((hit, i) => {
      const label =
        (hit.metadata?.label as string | undefined) ||
        hit.source_type;
      return `### Trecho ${i + 1} (${label})\n${hit.content}`;
    })
    .join('\n\n');
}
