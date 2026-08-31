import type { Lead } from '@/types/selletos';

/** Mantém só dígitos — útil para comparar telefones com ou sem máscara. */
export function normalizePhoneDigits(value: string | null | undefined): string {
  return (value ?? '').replace(/\D/g, '');
}

/**
 * Texto para busca: minúsculas e sem acento.
 * Assim "angela" encontra "Ângela", "sao" encontra "São".
 */
export function normalizeSearchText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

/** Textos usados na busca global do Pipeline (nome, telefone, região/cidade, etc.). */
export function getLeadSearchableValues(lead: Lead): string[] {
  return [
    String(lead.id),
    lead.name,
    lead.email,
    lead.phone,
    normalizePhoneDigits(lead.phone),
    lead.company ?? '',
    lead.origin ?? '',
    lead.status ?? '',
    lead.regiao ?? '',
    lead.regiaoTabela ?? '',
    lead.vendor ?? '',
    lead.observations ?? '',
    lead.webhookName ?? '',
    lead.lossReason ?? '',
    String(lead.dealValue ?? ''),
    String(lead.budgetValue ?? ''),
  ];
}

/** Verifica se o lead corresponde ao termo de busca (qualquer campo relevante). */
export function leadMatchesSearchQuery(lead: Lead, query: string): boolean {
  const term = normalizeSearchText(query);
  if (!term) return true;

  const termDigits = normalizePhoneDigits(query);
  const values = getLeadSearchableValues(lead);

  const textHit = values.some((value) => {
    const v = normalizeSearchText(String(value));
    return v.length > 0 && v.includes(term);
  });
  if (textHit) return true;

  if (termDigits.length >= 3) {
    const phoneDigits = normalizePhoneDigits(lead.phone);
    if (phoneDigits.includes(termDigits) || termDigits.includes(phoneDigits)) {
      return true;
    }
  }

  return false;
}

/** Ordena resultados: nome que começa com o termo primeiro, depois demais. */
export function sortLeadsBySearchRelevance(leads: Lead[], query: string): Lead[] {
  const term = normalizeSearchText(query);
  if (!term) return leads;

  return [...leads].sort((a, b) => {
    const aName = normalizeSearchText(a.name);
    const bName = normalizeSearchText(b.name);
    const aStarts = aName.startsWith(term) ? 0 : 1;
    const bStarts = bName.startsWith(term) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return aName.localeCompare(bName, 'pt-BR');
  });
}
