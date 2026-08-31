import type { ComissaoLead } from '@/hooks/usePontuaGarboFinanceiro';
import { normalizePhoneDigits, normalizeSearchText } from '@/lib/lead-search';

function getPrestadorLeadSearchableValues(lead: ComissaoLead): string[] {
  return [
    String(lead.leadId),
    lead.leadNome,
    lead.leadStatus,
    lead.fieldNome,
    lead.leadEmail ?? '',
    lead.leadTelefone ?? '',
    normalizePhoneDigits(lead.leadTelefone),
    lead.leadEmpresa ?? '',
    lead.leadOrigem ?? '',
    lead.leadRegiao ?? '',
    String(lead.valorOrcamento ?? ''),
    String(lead.percentual ?? ''),
    String(lead.comissao ?? ''),
  ];
}

export function prestadorLeadMatchesSearch(lead: ComissaoLead, query: string): boolean {
  const term = normalizeSearchText(query);
  if (!term) return true;

  const termDigits = normalizePhoneDigits(query);
  const values = getPrestadorLeadSearchableValues(lead);

  const textHit = values.some((value) => {
    const v = normalizeSearchText(String(value));
    return v.length > 0 && v.includes(term);
  });
  if (textHit) return true;

  if (termDigits.length >= 3) {
    const phoneDigits = normalizePhoneDigits(lead.leadTelefone);
    if (phoneDigits.includes(termDigits) || termDigits.includes(phoneDigits)) {
      return true;
    }
  }

  return false;
}

export function sortPrestadorLeadsBySearchRelevance(
  leads: ComissaoLead[],
  query: string,
): ComissaoLead[] {
  const term = normalizeSearchText(query);
  if (!term) return leads;

  return [...leads].sort((a, b) => {
    const aName = normalizeSearchText(a.leadNome);
    const bName = normalizeSearchText(b.leadNome);
    const aStarts = aName.startsWith(term) ? 0 : 1;
    const bStarts = bName.startsWith(term) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return aName.localeCompare(bName, 'pt-BR');
  });
}
