/**
 * Motor de IA do card do lead (docs/ia-lead, ADR 0007) — usado por render-lead-project,
 * render-lead-ambiente e edit-lead-render.
 *
 * Fluxo: `autorizarIaCardLead` (identidade, plano, motor+chave da plataforma) → `checarCota`
 * → chamada à OpenAI → `registrarUso`. A chave da plataforma fica em `plataforma_ia_segredos`
 * (sem policy para usuários): só o service role lê. `empresa_id` vem SEMPRE do chamador (JWT),
 * nunca do body.
 */
import { getCallerTenant, MSG_SOMENTE_LEITURA, serviceClient, type ServiceClient } from './tenant.ts';
import { corsHeaders } from './cors.ts';

export const FUNCAO_IA_CARD_LEAD = 'iaCardLead';

export type IaRecusaCode =
  | 'nao_autenticado'
  | 'sem_empresa'
  | 'empresa_suspensa'
  | 'somente_leitura'
  | 'funcao_bloqueada'
  | 'sem_plano'
  | 'cota_estourada'
  | 'motor_indisponivel'
  | 'recurso_desativado';

export interface IaRecusa {
  status: 401 | 403 | 429 | 503;
  code: IaRecusaCode;
  error: string;
}

export interface MotorIa {
  ativo: boolean;
  render_ativo: boolean;
  render_ambiente_ativo: boolean;
  vision_model: string;
  image_model: string;
  render_analysis_prompt: string | null;
  render_prompt: string | null;
  render_ambiente_analysis_prompt: string | null;
  render_ambiente_prompt: string | null;
  tokens_por_imagem_fixa: number;
}

export interface IaCtx {
  userId: string;
  empresaId: string;
  /** Service role com `x-empresa-id` (inserts recebem a empresa; leituras: filtre por `empresa_id`). */
  svc: ServiceClient;
  motor: MotorIa;
  apiKey: string;
}

export type OpenAiUsage = Record<string, unknown> | null | undefined;

const MENSAGENS: Record<IaRecusaCode, string> = {
  nao_autenticado: 'Usuário não autenticado',
  sem_empresa: 'Usuário sem empresa vinculada',
  empresa_suspensa: 'Acesso da empresa suspenso',
  somente_leitura: MSG_SOMENTE_LEITURA,
  funcao_bloqueada: 'A IA no card do lead não está liberada no plano da sua empresa. Fale com o suporte para ativar.',
  sem_plano: 'A IA no card do lead não está liberada no plano da sua empresa. Fale com o suporte para ativar.',
  cota_estourada:
    'O limite mensal de uso da IA foi atingido. A renderização volta a funcionar no dia 1º ou após ajuste do plano.',
  motor_indisponivel: 'A renderização por IA está temporariamente indisponível. Tente novamente mais tarde.',
  recurso_desativado: 'Este tipo de renderização não está disponível no momento.',
};

const STATUS: Record<IaRecusaCode, IaRecusa['status']> = {
  nao_autenticado: 401,
  sem_empresa: 403,
  empresa_suspensa: 403,
  somente_leitura: 403,
  funcao_bloqueada: 403,
  sem_plano: 403,
  cota_estourada: 429,
  motor_indisponivel: 503,
  recurso_desativado: 403,
};

export function recusa(code: IaRecusaCode): IaRecusa {
  return { status: STATUS[code], code, error: MENSAGENS[code] };
}

export function ehRecusa(x: IaCtx | IaRecusa): x is IaRecusa {
  return 'code' in x && 'status' in x;
}

export function respostaRecusa(r: IaRecusa): Response {
  return new Response(JSON.stringify({ error: r.error, code: r.code }), {
    status: r.status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * Valida quem chama e carrega o motor global. O render conta como escrita (gera arquivos, linhas
 * e custo): recusa em somente leitura, inclusive a análise do ambiente (`recurso: 'ambiente'`).
 */
export async function autorizarIaCardLead(
  req: Request,
  recurso: 'render' | 'ambiente',
): Promise<IaCtx | IaRecusa> {
  let t;
  try {
    t = await getCallerTenant(req);
  } catch (e) {
    console.error('autorizarIaCardLead:', e);
    return recusa('motor_indisponivel');
  }
  if (!t) return recusa('nao_autenticado');
  if (!t.empresaId) return recusa('sem_empresa');
  if (!t.isMaster && t.empresaStatus !== 'ativa') return recusa('empresa_suspensa');
  if (t.somenteLeitura) return recusa('somente_leitura');
  if (t.paginasBloqueadas.includes(FUNCAO_IA_CARD_LEAD)) return recusa('funcao_bloqueada');

  // Motor e segredo: tabelas globais, lidas só com service role (sem header de empresa).
  const global = serviceClient();
  const { data: motor, error: motorErr } = await global.from('plataforma_ia_motor').select('*').maybeSingle();
  if (motorErr || !motor) {
    if (motorErr) console.error('plataforma_ia_motor:', motorErr);
    return recusa('motor_indisponivel');
  }
  const { data: seg, error: segErr } = await global
    .from('plataforma_ia_segredos')
    .select('valor')
    .eq('nome', 'openai_card_lead')
    .maybeSingle();
  if (segErr) console.error('plataforma_ia_segredos:', segErr);
  const apiKey = (seg?.valor as string | undefined)?.trim() ?? '';
  if (!motor.ativo || !apiKey) return recusa('motor_indisponivel');
  if (recurso === 'render' && !motor.render_ativo) return recusa('recurso_desativado');
  if (recurso === 'ambiente' && !motor.render_ambiente_ativo) return recusa('recurso_desativado');

  return {
    userId: t.userId,
    empresaId: t.empresaId,
    svc: serviceClient(t.empresaId),
    motor: motor as MotorIa,
    apiKey,
  };
}

/** Cota mensal da empresa (RPC `plataforma_ia_cota`). Chamar uma vez, antes da 1ª chamada à OpenAI. */
export async function checarCota(ctx: IaCtx): Promise<IaRecusa | null> {
  const { data, error } = await ctx.svc.rpc('plataforma_ia_cota', { p_empresa: ctx.empresaId });
  if (error) {
    console.error('plataforma_ia_cota:', error);
    return recusa('motor_indisponivel');
  }
  const row = (Array.isArray(data) ? data[0] : data) as { liberada?: boolean; motivo?: string } | null;
  if (row?.liberada) return null;
  const motivo = row?.motivo;
  if (motivo === 'cota_estourada' || motivo === 'sem_plano' || motivo === 'funcao_bloqueada') {
    return recusa(motivo);
  }
  return recusa('motor_indisponivel');
}

export interface UsoInput {
  funcao: 'render_projeto' | 'render_ambiente_analise' | 'render_ambiente' | 'render_edicao';
  etapa: 'visao' | 'imagem';
  modelo: string;
  leadId?: number;
  refId?: string;
  usage?: OpenAiUsage;
  imagens?: number;
}

function num(v: unknown): number {
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.round(v)) : 0;
}

/**
 * Grava o consumo. Nunca lança: falha vira log (o render já foi pago).
 * Sem `usage` (dall-e-2 ou resposta sem o campo), conta o valor fixo do motor e marca `estimado`.
 */
export async function registrarUso(ctx: IaCtx, u: UsoInput): Promise<void> {
  try {
    const usage = u.usage ?? null;
    const entrada = num(usage?.prompt_tokens ?? usage?.input_tokens);
    const saida = num(usage?.completion_tokens ?? usage?.output_tokens);
    let total = num(usage?.total_tokens) || entrada + saida;
    let estimado = false;
    if (!total && u.etapa === 'imagem') {
      total = num(ctx.motor.tokens_por_imagem_fixa);
      estimado = true;
    }
    const { error } = await ctx.svc.rpc('plataforma_ia_registrar_uso', {
      p_empresa: ctx.empresaId,
      p_user: ctx.userId,
      p_funcao: u.funcao,
      p_etapa: u.etapa,
      p_modelo: u.modelo,
      p_lead: u.leadId ?? null,
      p_ref: u.refId ?? null,
      p_tokens_entrada: entrada,
      p_tokens_saida: saida,
      p_tokens_total: total,
      p_imagens: u.imagens ?? (u.etapa === 'imagem' ? 1 : 0),
      p_estimado: estimado,
    });
    if (error) console.error('plataforma_ia_registrar_uso:', error);
  } catch (e) {
    console.error('registrarUso:', e);
  }
}

/** Erros da OpenAI que revelam chave/cobrança viram "motor indisponível" (log completo no servidor). */
export function mensagemSegura(message: string): string {
  if (/api key|invalid_api_key|insufficient_quota|billing|incorrect api/i.test(message)) {
    return MENSAGENS.motor_indisponivel;
  }
  return message;
}

type ChatMessage = {
  role: string;
  content: string | Array<{ type: string; text?: string; image_url?: { url: string; detail?: string } }>;
};

/** Chat com visão (chat/completions). Devolve o texto e o `usage` para `registrarUso`. */
export async function chatVisao(
  apiKey: string,
  model: string,
  messages: ChatMessage[],
  maxTokens = 2048,
): Promise<{ content: string; usage: OpenAiUsage }> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, max_tokens: maxTokens }),
  });
  if (!res.ok) {
    const errText = await res.text();
    console.error('OpenAI chat error:', res.status, errText);
    let message = 'Erro ao chamar a API da OpenAI';
    try {
      message = JSON.parse(errText)?.error?.message || message;
    } catch {
      // ignore
    }
    throw new Error(mensagemSegura(message));
  }
  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('A IA não retornou análise do esboço');
  return { content, usage: data?.usage ?? null };
}
