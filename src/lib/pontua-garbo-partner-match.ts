/** Une o usuário Pontua Garbo ao card de lead que é a pessoa, não o cliente dela. */

const STOPWORDS = new Set([
  'de',
  'da',
  'do',
  'dos',
  'das',
  'e',
  'arquiteto',
  'arquiteta',
  'arquitetura',
  'arquitetos',
  'estudio',
  'studio',
  'consultor',
  'prestador',
]);

export const MIN_SCORE_VINCULO_PONTUA = 70;

export interface PartnerLeadCandidate {
  id: number;
  nome: string;
  email?: string | null;
  telefone?: string | null;
  status?: string | null;
  pontua_garbo_usuario_id?: string | null;
}

export interface PartnerUserRef {
  usuarioId?: string | null;
  nome: string;
  email?: string | null;
  telefone?: string | null;
}

export function normalizePartnerName(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function partnerNameTokens(value: string | null | undefined): string[] {
  return normalizePartnerName(value)
    .split(' ')
    .filter((token) => token.length >= 3 && !STOPWORDS.has(token));
}

export function digitsOnlyPhone(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

export function phonesLookAlike(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const a = digitsOnlyPhone(left);
  const b = digitsOnlyPhone(right);
  if (a.length < 8 || b.length < 8) return false;
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  const tail = short.slice(-8);
  return long.endsWith(short) || long.endsWith(tail) || long.includes(tail);
}

function tokenInList(token: string, list: string[]): boolean {
  return list.some((item) => item === token || item.startsWith(token) || token.startsWith(item));
}

/**
 * Pontuação 0–100: o card é a ficha do arquiteto?
 * Telefone sozinho não vale — clientes costumam usar o número do parceiro.
 */
export function scorePartnerLeadMatch(
  user: PartnerUserRef,
  lead: PartnerLeadCandidate,
): number {
  const userTokens = partnerNameTokens(user.nome);
  const leadTokens = partnerNameTokens(lead.nome);
  if (userTokens.length === 0 || leadTokens.length === 0) return 0;

  const userNorm = normalizePartnerName(user.nome);
  const leadNorm = normalizePartnerName(lead.nome);
  const startsWithUser =
    leadNorm.startsWith(userNorm) ||
    (userTokens.length >= 2 &&
      leadTokens[0] === userTokens[0] &&
      leadTokens[1] === userTokens[1]);

  const firstMatches = leadTokens[0] === userTokens[0];
  const remainingUser = userTokens.slice(1);
  const remainingMatched = remainingUser.filter((token) => tokenInList(token, leadTokens));

  let score = 0;
  if (startsWithUser) {
    score = 90;
  } else if (firstMatches && remainingUser.length === 0) {
    score = leadTokens.length <= 2 ? 75 : 20;
  } else if (firstMatches && remainingMatched.length >= 1 && leadTokens.length <= userTokens.length + 2) {
    score = 80;
  } else if (firstMatches && remainingMatched.length >= 1) {
    score = 40;
  }

  if (userTokens.length === 1 && leadTokens.length > 2) {
    score = Math.min(score, 20);
  }

  const userEmail = (user.email ?? '').trim().toLowerCase();
  const leadEmail = (lead.email ?? '').trim().toLowerCase();
  if (userEmail && leadEmail && userEmail === leadEmail) {
    score = Math.max(score, 85);
  }

  if (score >= MIN_SCORE_VINCULO_PONTUA && phonesLookAlike(user.telefone, lead.telefone)) {
    score += 5;
  }

  const status = (lead.status ?? '').toLowerCase();
  const nomeBruto = (lead.nome ?? '').toLowerCase();
  if (status.includes('arquitet') || nomeBruto.includes('arquitet')) {
    score += 6;
  }

  return Math.min(100, score);
}

export function pickBestPartnerLead(
  user: PartnerUserRef,
  candidates: PartnerLeadCandidate[],
): PartnerLeadCandidate | null {
  let best: PartnerLeadCandidate | null = null;
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

  if (bestScore < MIN_SCORE_VINCULO_PONTUA) return null;
  return best;
}
