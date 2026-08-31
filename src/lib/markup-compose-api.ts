import type { LeadAIAnalysisItemPayload } from '@/lib/lead-ai-media-sources';
import type { MarkupIAVerificacaoCategoriaResultado } from '@/lib/markup-ia-verificacao';
import type { MarkupComposeIAResult, MarkupIAProjetistaResult } from '@/lib/markup-types';
import { supabase } from '@/integrations/supabase/client';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? 'https://zzqgtclvuetemzhqzhbq.supabase.co';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

export interface ComposeMarkupIAInput {
  leadId: number;
  leadName?: string;
  empresaSchema: string | null | undefined;
  itens: LeadAIAnalysisItemPayload[];
  stream?: boolean;
  signal?: AbortSignal;
}

export type MarkupIAComposeEventType =
  | 'media_ready'
  | 'cortecloud_mode'
  | 'projetista_scanning'
  | 'projetista_reconcile'
  | 'projetista_result'
  | 'auditor_projetista'
  | 'auditor_inventario'
  | 'inventariante_retry'
  | 'category_scanning'
  | 'category_result'
  | 'catalogo'
  | 'composing'
  | 'validating'
  | 'retry'
  | 'complete'
  | 'error'
  | 'log';

export interface MarkupIAComposeEvent {
  type: MarkupIAComposeEventType;
  message?: string;
  data?: unknown;
}

function mapComposeResult(data: Record<string, unknown>): MarkupComposeIAResult {
  return {
    comodos: Array.isArray(data.comodos) ? data.comodos : [],
    servicos: Array.isArray(data.servicos) ? data.servicos : [],
    despesas: Array.isArray(data.despesas) ? data.despesas : [],
    resumo_texto: typeof data.resumo_texto === 'string' ? data.resumo_texto : '',
    itens_nao_catalogados: Array.isArray(data.itens_nao_catalogados)
      ? data.itens_nao_catalogados
      : [],
    itens_extraidos: Array.isArray(data.itens_extraidos)
      ? (data.itens_extraidos as MarkupComposeIAResult['itens_extraidos'])
      : undefined,
    verificacao_categorias: Array.isArray(data.verificacao_categorias)
      ? (data.verificacao_categorias as MarkupIAVerificacaoCategoriaResultado[])
      : undefined,
    levantamento_projetista:
      data.levantamento_projetista && typeof data.levantamento_projetista === 'object'
        ? (data.levantamento_projetista as MarkupIAProjetistaResult)
        : undefined,
    produtos_origem_projetista: Array.isArray(data.produtos_origem_projetista)
      ? data.produtos_origem_projetista.map((i) => String(i))
      : undefined,
    modelo_usado: typeof data.modelo_usado === 'string' ? data.modelo_usado : undefined,
    itens_processados:
      typeof data.itens_processados === 'number' ? data.itens_processados : undefined,
    bloqueado: data.bloqueado === true,
    faltantes_criticos: Array.isArray(data.faltantes_criticos)
      ? data.faltantes_criticos.map((i) => String(i))
      : undefined,
  };
}

function parseSseLine(line: string): MarkupIAComposeEvent | null {
  if (!line.startsWith('data: ')) return null;
  try {
    return JSON.parse(line.slice(6)) as MarkupIAComposeEvent;
  } catch {
    return null;
  }
}

export async function invokeComposeMarkupIAStream(
  input: ComposeMarkupIAInput,
  onEvent: (event: MarkupIAComposeEvent) => void,
): Promise<MarkupComposeIAResult> {
  const { data: sessionData } = await supabase.auth.getSession();
  const token = sessionData.session?.access_token;
  if (!token) throw new Error('Sessão expirada. Faça login novamente.');

  let res: Response;
  try {
    res = await fetch(`${SUPABASE_URL}/functions/v1/compose-markup-ia`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        apikey: SUPABASE_ANON_KEY,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        leadId: input.leadId,
        leadName: input.leadName,
        empresaSchema: input.empresaSchema,
        itens: input.itens,
        stream: true,
      }),
      signal: input.signal,
    });
  } catch {
    throw new Error(
      'Não foi possível conectar ao serviço de composição IA. Verifique sua conexão e tente novamente.',
    );
  }

  const contentType = res.headers.get('Content-Type') ?? '';

  if (!res.ok && !contentType.includes('text/event-stream')) {
    let errMsg = `Erro ${res.status}`;
    try {
      const body = await res.json();
      if (body?.error) errMsg = String(body.error);
    } catch {
      // ignore
    }
    throw new Error(errMsg);
  }

  if (!contentType.includes('text/event-stream')) {
    const data = await res.json();
    if (data?.error) throw new Error(String(data.error));
    return mapComposeResult(data as Record<string, unknown>);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error('Stream indisponível');

  const decoder = new TextDecoder();
  let buffer = '';
  let finalResult: MarkupComposeIAResult | null = null;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      const event = parseSseLine(trimmed);
      if (!event) continue;

      onEvent(event);

      if (event.type === 'complete' && event.data && typeof event.data === 'object') {
        finalResult = mapComposeResult(event.data as Record<string, unknown>);
      }
      if (event.type === 'error') {
        throw new Error(event.message ?? 'Erro na composição com IA');
      }
    }
  }

  if (!finalResult) {
    throw new Error('Composição encerrada sem resultado.');
  }
  return finalResult;
}

export async function invokeComposeMarkupIA(
  input: ComposeMarkupIAInput,
): Promise<MarkupComposeIAResult> {
  const { data, error } = await supabase.functions.invoke('compose-markup-ia', {
    body: {
      leadId: input.leadId,
      leadName: input.leadName,
      empresaSchema: input.empresaSchema,
      itens: input.itens,
      stream: false,
    },
  });

  if (error) {
    const msg = error.message ?? '';
    let payloadError =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error?: unknown }).error ?? '')
        : '';

    if (!payloadError && 'context' in error) {
      const response = (error as { context?: Response }).context;
      if (response) {
        try {
          const body = await response.clone().json();
          if (body && typeof body === 'object' && 'error' in body) {
            payloadError = String((body as { error?: unknown }).error ?? '');
          }
        } catch {
          // corpo não é JSON
        }
      }
    }

    const isUnreachable =
      msg.includes('Failed to send') ||
      msg.includes('Failed to fetch') ||
      msg.includes('NetworkError') ||
      error.name === 'FunctionsFetchError';
    if (isUnreachable) {
      throw new Error(
        'Serviço de composição IA indisponível. A função compose-markup-ia ainda não foi publicada no Supabase.',
      );
    }
    throw new Error(payloadError || msg || 'Erro ao chamar composição com IA');
  }

  if (!data || typeof data !== 'object') {
    throw new Error('Resposta vazia do serviço de composição com IA.');
  }

  if ('error' in data && data.error) {
    throw new Error(String(data.error));
  }

  return mapComposeResult(data as Record<string, unknown>);
}
