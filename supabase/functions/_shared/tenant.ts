/**
 * Multi-empresa nas Edge Functions (ver docs/multi-empresa/DESIGN.md §4).
 *
 * - `getCallerTenant(req)`: quem chama e em qual empresa ele está (RPC `app_minha_empresa` com o JWT dele).
 * - `serviceClient(empresaId)`: cliente service role que envia `x-empresa-id`. O PostgREST
 *   (`app_pre_request`) transforma o header no contexto da empresa e o trigger `aaa_tenant_fill`
 *   preenche `empresa_id` nos inserts. ATENÇÃO: service role ignora RLS nas LEITURAS — filtre por
 *   `empresa_id` ou por ids já validados.
 * - `assertCallerIsEmpresaAdmin` / `assertUsuarioDaEmpresa`: checagens de permissão entre empresas.
 */
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

/**
 * Mesmo tipo que `createClient(url, key)` devolve nas funções (banco sem tipos gerados → `any`),
 * para o cliente com header de empresa ser um substituto exato do anterior.
 */
// deno-lint-ignore no-explicit-any -- banco sem tipos gerados nas Edge Functions
export type ServiceClient = ReturnType<typeof createClient<any>>;

/**
 * As Edge Functions não têm os tipos gerados do banco, então as consultas devolvem `never`.
 * Para as checagens abaixo usamos o cliente sem tipagem de tabelas e tipamos o retorno à mão.
 */
// deno-lint-ignore no-explicit-any -- cliente sem tipos gerados do banco (ver comentário acima)
type LooseClient = any;

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';
const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const USUARIO_EMPRESA = 'CRM-multi-empresas>usuario_empresa<';
const SUPER_ADMINS = 'CRM-multi-empresas>super_admins<';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface CallerTenant {
  userId: string;
  empresaId: string | null;
  empresaStatus: 'ativa' | 'bloqueada' | 'inativa' | null;
  isMaster: boolean;
}

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v);
}

/** Cliente service role; com `empresaId`, os inserts recebem essa empresa automaticamente. */
export function serviceClient(empresaId?: string | null): ServiceClient {
  return createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: empresaId ? { headers: { 'x-empresa-id': empresaId } } : undefined,
  });
}

/** Identifica o usuário do JWT e a empresa em que ele está. `null` se não houver usuário. */
export async function getCallerTenant(req: Request): Promise<CallerTenant | null> {
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!/^bearer\s+/i.test(authHeader)) return null;
  const userClient = createClient(SUPABASE_URL, ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userData, error: userErr } = await userClient.auth.getUser();
  if (userErr || !userData?.user) return null;

  const { data, error } = await userClient.rpc('app_minha_empresa');
  if (error) throw new Error(`Não foi possível identificar a empresa: ${error.message}`);
  const row = (Array.isArray(data) ? data[0] : null) as Record<string, unknown> | null;
  return {
    userId: userData.user.id,
    empresaId: (row?.id as string | undefined) ?? null,
    empresaStatus: (row?.status as CallerTenant['empresaStatus']) ?? null,
    isMaster: row?.is_master === true,
  };
}

/** Exige usuário autenticado com empresa ativa (o master sempre passa). */
export async function requireCallerTenant(req: Request): Promise<CallerTenant & { empresaId: string }> {
  const t = await getCallerTenant(req);
  if (!t) throw new Error('Usuário não autenticado');
  if (!t.empresaId) throw new Error('Usuário sem empresa vinculada');
  if (!t.isMaster && t.empresaStatus !== 'ativa') throw new Error('Acesso da empresa suspenso');
  return t as CallerTenant & { empresaId: string };
}

/**
 * Empresa alvo de uma operação: o master pode indicar outra empresa (UUID no body);
 * os demais usuários sempre operam na própria empresa.
 */
export function empresaAlvo(t: CallerTenant & { empresaId: string }, pedida?: unknown): string {
  if (t.isMaster && isUuid(pedida)) return pedida;
  return t.empresaId;
}

/** Quem chama precisa ser master ou administrador (núcleo ou CRM) da empresa. */
export async function assertCallerIsEmpresaAdmin(
  svc: LooseClient,
  t: CallerTenant & { empresaId: string },
): Promise<void> {
  if (t.isMaster) return;
  const db = svc as LooseClient;
  const { data: mov } = await db
    .from('movelaria_usuarios')
    .select('perfil, ativo')
    .eq('id', t.userId)
    .eq('empresa_id', t.empresaId)
    .maybeSingle();
  if (mov?.perfil === 'administrador' && mov.ativo) return;
  const { data: crmAdmin } = await db
    .schema('crm')
    .from('user_roles')
    .select('role')
    .eq('user_id', t.userId)
    .eq('empresa_id', t.empresaId)
    .eq('role', 'admin')
    .maybeSingle();
  if (crmAdmin) return;
  throw new Error('Apenas administradores da empresa podem executar esta ação');
}

/** O usuário alvo precisa ser da empresa (ou ainda sem empresa); o master só é alterado por ele mesmo. */
export async function assertUsuarioDaEmpresa(
  svc: LooseClient,
  t: CallerTenant & { empresaId: string },
  targetUserId: string,
  empresaId: string,
): Promise<void> {
  const db = svc as LooseClient;
  const { data: alvoMaster } = await db.from(SUPER_ADMINS).select('user_id').eq('user_id', targetUserId).maybeSingle();
  if (alvoMaster && !t.isMaster) throw new Error('Acesso negado: usuário master');
  if (t.isMaster) return;
  const { data: vinculo } = await db
    .from(USUARIO_EMPRESA)
    .select('empresa_id')
    .eq('user_id', targetUserId)
    .maybeSingle();
  if (vinculo?.empresa_id && vinculo.empresa_id !== empresaId) {
    throw new Error('Acesso negado: usuário de outra empresa');
  }
}

/**
 * Empresa de quem chamou a função (ou `null` se a chamada não tiver usuário — ex.: webhook externo).
 * Uso típico: `const supabase = serviceClient(await empresaDoChamador(req))`.
 */
export async function empresaDoChamador(req: Request): Promise<string | null> {
  try {
    const t = await getCallerTenant(req);
    return t?.empresaId ?? null;
  } catch (e) {
    console.warn('empresaDoChamador:', e);
    return null;
  }
}
