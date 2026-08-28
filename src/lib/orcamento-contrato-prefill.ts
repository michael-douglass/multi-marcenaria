import type { OrcamentoSlide } from '@/lib/orcamento-slide-types';

/** Extrai os campos de contrato preenchidos no formulário público do orçamento mais recente do lead. */
export function extrairCamposContratoDoOrcamentoLead(
  orcamentos: OrcamentoSlide[],
): Record<string, string> | null {
  for (const orc of orcamentos) {
    const campos = orc.dados?._meta?.campos_contrato_preenchidos;
    if (campos && typeof campos === 'object' && Object.keys(campos).length > 0) {
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(campos)) {
        if (typeof v === 'string' && v.trim()) out[k] = v;
      }
      if (Object.keys(out).length > 0) return out;
    }
  }
  return null;
}
