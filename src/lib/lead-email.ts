/**
 * Normaliza e valida e-mail de lead para auto-save e cadastro no Pontua Garbo.
 * Cobre erros comuns de digitação no Brasil (vírgula no domínio, hotmail/gmail).
 */

const INVISIBLE_CHARS = /[\u200B-\u200D\uFEFF\u00AD\u2060]/g;

const DOMAIN_TYPOS: Record<string, string> = {
  'htomail.com': 'hotmail.com',
  'hotmial.com': 'hotmail.com',
  'hotmal.com': 'hotmail.com',
  'hotamil.com': 'hotmail.com',
  'hotmai.com': 'hotmail.com',
  'gnail.com': 'gmail.com',
  'gamil.com': 'gmail.com',
  'gmial.com': 'gmail.com',
  'gmai.com': 'gmail.com',
  'gmal.com': 'gmail.com',
  'outlok.com': 'outlook.com',
  'outllok.com': 'outlook.com',
  'outloo.com': 'outlook.com',
};

/** Regex alinhada ao Auth da Supabase: precisa de @ e domínio com pelo menos um ponto. */
const AUTH_EMAIL_RE =
  /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/i;

export const EMAIL_FORMATO_INVALIDO =
  'Use o formato nome@dominio.com — com @ e ponto. Vírgula no lugar do ponto (ex.: gmail,com) não vale.';

export function normalizeLeadEmail(raw: string | null | undefined): string {
  if (raw == null) return '';

  let value = String(raw)
    .replace(INVISIBLE_CHARS, '')
    .replace(/\u00a0/g, ' ')
    .trim();
  if (!value) return '';

  const angle = value.match(/<([^>]+)>/);
  if (angle?.[1]) value = angle[1].trim();

  value = value.replace(/＠/g, '@').toLowerCase();

  const simpleEmail = /^[^\s@]+@[^\s@]+$/.test(value);
  if (!simpleEmail) {
    const extracted = value.match(/[^\s,;<>]+@[^\s,;<>]+/);
    if (extracted) value = extracted[0];
  }

  const at = value.lastIndexOf('@');
  if (at <= 0 || at === value.length - 1) return value.trim();

  const local = value.slice(0, at).trim();
  const domain = value
    .slice(at + 1)
    .trim()
    .replace(/,/g, '.')
    .replace(/\.+/g, '.')
    .replace(/^\.+|\.+$/g, '');

  if (!local || !domain) return '';
  return `${local}@${DOMAIN_TYPOS[domain] ?? domain}`;
}

export function isValidLeadEmail(email: string): boolean {
  if (!email || email.length > 255) return false;
  return AUTH_EMAIL_RE.test(email);
}

export function parseLeadEmail(raw: string | null | undefined): {
  normalized: string;
  valid: boolean;
} {
  const normalized = normalizeLeadEmail(raw);
  if (!normalized) return { normalized: '', valid: true };
  return { normalized, valid: isValidLeadEmail(normalized) };
}
