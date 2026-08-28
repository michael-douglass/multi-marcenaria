/** Título padrão de quem entra no Pontua Garbo (programa de arquitetos da Garbo). */
export const PONTUA_GARBO_TITULO_PADRAO = 'Arquiteto';

/**
 * Nome de exibição do título: se o cadastro não tiver título,
 * a pessoa é reconhecida como Arquiteto do programa.
 */
export function tituloReconhecidoPontuaGarbo(titulo: string | null | undefined): string {
  const raw = titulo?.trim();
  if (!raw) return PONTUA_GARBO_TITULO_PADRAO;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function iniciaisNomeArquiteto(nome: string): string {
  const parts = nome.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'A';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  const first = parts[0][0] ?? '';
  const last = parts[parts.length - 1][0] ?? '';
  return `${first}${last}`.toUpperCase();
}

export function labelDesdeCadastro(isoDate: string | null | undefined): string | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) return null;
  const label = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: 'numeric' }).format(date);
  return `Desde ${label}`;
}

export function formatBRLPontua(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor);
}

/** Só os dígitos do telefone, ou null se estiver vazio. */
export function telefonePrestadorDigits(telefone: string | null | undefined): string | null {
  if (!telefone?.trim()) return null;
  const clean = telefone.replace(/\D/g, '');
  return clean.length > 0 ? clean : null;
}

/**
 * Telefone pronto para ligar (DDI 55 quando o número for só DDD + celular).
 */
export function telefonePrestadorHref(telefone: string | null | undefined): string | null {
  const digits = telefonePrestadorDigits(telefone);
  if (!digits) return null;
  const withDdi = digits.length === 10 || digits.length === 11 ? `55${digits}` : digits;
  return `tel:+${withDdi}`;
}

/** Telefone brasileiro formatado para leitura. */
export function formatTelefonePrestador(telefone: string | null | undefined): string | null {
  const digits = telefonePrestadorDigits(telefone);
  if (!digits) return null;
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 13 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith('55')) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  return telefone?.trim() ?? null;
}
