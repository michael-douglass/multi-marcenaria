import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";
import type { EmpresaDbTarget } from "./empresa-tables.ts";
import { dbFromSchema } from "./empresa-tables.ts";

export const PONTUA_GARBO_LEAD_ORIGEM = "Pontua Garbo";
const MIN_SCORE_VINCULO = 70;
const STOPWORDS = new Set([
  "de",
  "da",
  "do",
  "dos",
  "das",
  "e",
  "arquiteto",
  "arquiteta",
  "arquitetura",
  "arquitetos",
  "estudio",
  "studio",
  "consultor",
  "prestador",
]);

function digitsOnly(value: string | null | undefined): string {
  return (value ?? "").replace(/\D/g, "");
}

function todaySaoPaulo(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

function normalizePartnerName(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function partnerNameTokens(value: string | null | undefined): string[] {
  return normalizePartnerName(value)
    .split(" ")
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

function tokenInList(token: string, list: string[]): boolean {
  return list.some((item) => item === token || item.startsWith(token) || token.startsWith(item));
}

interface PartnerLeadRow {
  id: number;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  status?: string | null;
  pontua_garbo_usuario_id?: string | null;
}

function scorePartnerLeadMatch(
  user: { usuarioId?: string; nome: string; email?: string | null; telefone?: string | null },
  lead: PartnerLeadRow,
): number {
  const userTokens = partnerNameTokens(user.nome);
  const leadTokens = partnerNameTokens(lead.nome);
  if (userTokens.length === 0 || leadTokens.length === 0) return 0;

  const userNorm = normalizePartnerName(user.nome);
  const leadNorm = normalizePartnerName(lead.nome);
  const startsWithUser =
    leadNorm.startsWith(userNorm) ||
    (userTokens.length >= 2 && leadTokens[0] === userTokens[0] && leadTokens[1] === userTokens[1]);
  const firstMatches = leadTokens[0] === userTokens[0];
  const remainingUser = userTokens.slice(1);
  const remainingMatched = remainingUser.filter((token) => tokenInList(token, leadTokens));

  let score = 0;
  if (startsWithUser) score = 90;
  else if (firstMatches && remainingUser.length === 0) score = leadTokens.length <= 2 ? 75 : 20;
  else if (firstMatches && remainingMatched.length >= 1 && leadTokens.length <= userTokens.length + 2) score = 80;
  else if (firstMatches && remainingMatched.length >= 1) score = 40;

  if (userTokens.length === 1 && leadTokens.length > 2) score = Math.min(score, 20);

  const userEmail = (user.email ?? "").trim().toLowerCase();
  const leadEmail = (lead.email ?? "").trim().toLowerCase();
  if (userEmail && leadEmail && userEmail === leadEmail) score = Math.max(score, 85);

  const status = (lead.status ?? "").toLowerCase();
  const nomeBruto = (lead.nome ?? "").toLowerCase();
  if (status.includes("arquitet") || nomeBruto.includes("arquitet")) score += 6;

  return Math.min(100, score);
}

function pickBestPartnerLead(
  user: { usuarioId?: string; nome: string; email?: string | null; telefone?: string | null },
  candidates: PartnerLeadRow[],
): PartnerLeadRow | null {
  let best: PartnerLeadRow | null = null;
  let bestScore = 0;
  for (const candidate of candidates) {
    const linkedToOther =
      Boolean(candidate.pontua_garbo_usuario_id) &&
      candidate.pontua_garbo_usuario_id !== user.usuarioId;
    if (linkedToOther) continue;
    const score = scorePartnerLeadMatch(user, candidate);
    if (score > bestScore) {
      bestScore = score;
      best = candidate;
    }
  }
  if (bestScore < MIN_SCORE_VINCULO) return null;
  return best;
}

async function ensureOrigemPontuaGarbo(
  db: ReturnType<typeof dbFromSchema>,
  schema: string | null,
) {
  const originsTable = schema ? "lead_origins" : 'CRM-multi-empresas>lead_origins<';
  const { data: existing } = await db
    .from(originsTable)
    .select("id")
    .ilike("nome", "Pontua Garbo")
    .limit(1)
    .maybeSingle();
  if (existing?.id) return;
  await db.from(originsTable).insert({ nome: PONTUA_GARBO_LEAD_ORIGEM, is_default: false });
}

async function linkLeadToUsuario(
  db: ReturnType<typeof dbFromSchema>,
  leadsTable: string,
  leadId: number,
  usuarioId: string,
): Promise<void> {
  const { data: current } = await db
    .from(leadsTable)
    .select("id")
    .eq("pontua_garbo_usuario_id", usuarioId)
    .maybeSingle();
  if (current?.id && current.id !== leadId) {
    const { error: unlinkErr } = await db
      .from(leadsTable)
      .update({ pontua_garbo_usuario_id: null, atualizado_em: new Date().toISOString() })
      .eq("id", current.id);
    if (unlinkErr) throw unlinkErr;
  }
  const { error } = await db
    .from(leadsTable)
    .update({
      pontua_garbo_usuario_id: usuarioId,
      atualizado_em: new Date().toISOString(),
    })
    .eq("id", leadId);
  if (error) throw error;
}

/**
 * Garante um card de lead para o parceiro Pontua Garbo.
 * Reusa o card da pessoa (pelo nome), não um cliente que só compartilhou o telefone.
 */
export async function ensurePontuaGarboPartnerLead(
  admin: SupabaseClient,
  target: EmpresaDbTarget,
  input: {
    usuarioId: string;
    nome: string;
    email?: string | null;
    telefone?: string | null;
    existingLeadId?: number | null;
  },
): Promise<{ leadId: number | null; created: boolean }> {
  const db = dbFromSchema(admin, target.schema);
  const email = input.email?.trim().toLowerCase() || null;
  const telefone = digitsOnly(input.telefone) || null;
  const userRef = {
    usuarioId: input.usuarioId,
    nome: input.nome,
    email,
    telefone,
  };

  try {
    await ensureOrigemPontuaGarbo(db, target.schema);
  } catch (err) {
    console.warn("ensurePontuaGarboPartnerLead: origem", err);
  }

  if (input.existingLeadId) {
    await linkLeadToUsuario(db, target.leadsTable, input.existingLeadId, input.usuarioId);
    return { leadId: input.existingLeadId, created: false };
  }

  const { data: alreadyLinked, error: linkedErr } = await db
    .from(target.leadsTable)
    .select("id, nome, email, telefone, status, pontua_garbo_usuario_id")
    .eq("pontua_garbo_usuario_id", input.usuarioId)
    .maybeSingle();
  if (linkedErr) throw linkedErr;

  const rawFirst = (input.nome.trim().split(/\s+/)[0] ?? "").replace(/[%_,]/g, " ").trim();
  const firstToken = (partnerNameTokens(input.nome)[0] ?? rawFirst).replace(/[%_,]/g, " ").trim();
  const filters: string[] = [];
  if (email) filters.push(`email.ilike.${email}`);
  if (rawFirst.length >= 3) filters.push(`nome.ilike.%${rawFirst}%`);
  if (firstToken.length >= 3 && firstToken.toLowerCase() !== rawFirst.toLowerCase()) {
    filters.push(`nome.ilike.%${firstToken}%`);
  }

  let candidates: PartnerLeadRow[] = [];
  if (filters.length > 0) {
    const { data: nameRows } = await db
      .from(target.leadsTable)
      .select("id, nome, email, telefone, status, pontua_garbo_usuario_id")
      .or(filters.join(","))
      .order("id", { ascending: true })
      .limit(80);
    candidates = (nameRows ?? []) as PartnerLeadRow[];
  }

  const best = pickBestPartnerLead(userRef, candidates);
  const bestScore = best ? scorePartnerLeadMatch(userRef, best) : 0;
  const linkedScore = alreadyLinked
    ? scorePartnerLeadMatch(userRef, alreadyLinked as PartnerLeadRow)
    : 0;
  const shouldRelink =
    Boolean(best) &&
    bestScore >= MIN_SCORE_VINCULO &&
    (!alreadyLinked || best!.id !== alreadyLinked.id) &&
    (linkedScore < MIN_SCORE_VINCULO || bestScore > linkedScore + 10);

  if (shouldRelink && best) {
    await linkLeadToUsuario(db, target.leadsTable, best.id, input.usuarioId);
    return { leadId: best.id, created: false };
  }
  if (alreadyLinked?.id && linkedScore >= MIN_SCORE_VINCULO) {
    return { leadId: alreadyLinked.id as number, created: false };
  }
  if (best) {
    await linkLeadToUsuario(db, target.leadsTable, best.id, input.usuarioId);
    return { leadId: best.id, created: false };
  }
  if (alreadyLinked?.id) {
    return { leadId: alreadyLinked.id as number, created: false };
  }

  const { data: created, error: insertErr } = await db
    .from(target.leadsTable)
    .insert({
      nome: input.nome.trim(),
      email,
      telefone,
      origem: PONTUA_GARBO_LEAD_ORIGEM,
      status: "Novo Lead",
      valor_negocio: 0,
      valor_orcamento: 0,
      data_chegada: todaySaoPaulo(),
      pontua_garbo_usuario_id: input.usuarioId,
      observacoes: "Cadastro automático pelo programa Pontua Garbo.",
    })
    .select("id")
    .single();

  if (insertErr) throw insertErr;
  return { leadId: (created?.id as number) ?? null, created: true };
}
