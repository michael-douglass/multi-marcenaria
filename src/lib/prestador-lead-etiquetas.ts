import type { ComissaoLead } from '@/hooks/usePontuaGarboFinanceiro';
import { arredondarBrl } from '@/lib/pontua-garbo-saque';

export type PrestadorLeadEtiqueta = 'cliente_pagou' | 'voce_ja_sacou';

export const PRESTADOR_LEAD_ETIQUETA_LABELS: Record<PrestadorLeadEtiqueta, string> = {
  cliente_pagou: 'Cliente pagou',
  voce_ja_sacou: 'Você já sacou esse valor',
};

function leadEtiquetaKey(lead: ComissaoLead): string {
  return `${lead.leadId}:${lead.fieldId}`;
}

/**
 * Define etiquetas por lead:
 * - Cliente pagou: venda fechada no CRM
 * - Você já sacou esse valor: comissão liberada já incluída em saque (pendente ou pago), FIFO
 */
export function buildPrestadorLeadEtiquetasMap(
  leads: ComissaoLead[],
  valorSaquePendente: number,
  valorJaRetirado = 0,
): Map<string, PrestadorLeadEtiqueta[]> {
  const map = new Map<string, PrestadorLeadEtiqueta[]>();

  for (const lead of leads) {
    const tags: PrestadorLeadEtiqueta[] = [];
    if (lead.vendaGanha) tags.push('cliente_pagou');
    if (tags.length > 0) map.set(leadEtiquetaKey(lead), tags);
  }

  const totalSacado = arredondarBrl(valorSaquePendente + valorJaRetirado);
  if (totalSacado <= 0) return map;

  const liberadas = leads
    .filter((l) => l.comissaoLiberada)
    .sort((a, b) => {
      const da = a.vendaRealizadaEm ?? a.criadoEm ?? '';
      const db = b.vendaRealizadaEm ?? b.criadoEm ?? '';
      return da.localeCompare(db);
    });

  let restanteCent = Math.round(totalSacado * 100);
  for (const lead of liberadas) {
    if (restanteCent <= 0) break;
    const key = leadEtiquetaKey(lead);
    const tags = map.get(key) ?? (lead.vendaGanha ? ['cliente_pagou'] : []);
    if (!tags.includes('voce_ja_sacou')) tags.push('voce_ja_sacou');
    map.set(key, tags);
    restanteCent -= Math.round(arredondarBrl(lead.comissao) * 100);
  }

  return map;
}

export function getPrestadorLeadEtiquetas(
  lead: ComissaoLead,
  map: Map<string, PrestadorLeadEtiqueta[]>,
): PrestadorLeadEtiqueta[] {
  return map.get(leadEtiquetaKey(lead)) ?? [];
}

/** Cliente já pagou (venda ganha / etiqueta cliente_pagou). */
export function leadClienteJaPagou(
  lead: ComissaoLead,
  map?: Map<string, PrestadorLeadEtiqueta[]>,
): boolean {
  if (lead.vendaGanha) return true;
  if (!map) return false;
  return getPrestadorLeadEtiquetas(lead, map).includes('cliente_pagou');
}
