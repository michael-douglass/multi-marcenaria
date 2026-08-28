import { z } from 'zod';
import type { Lead } from '@/types/selletos';
import type { DatabaseLead } from '@/hooks/useLeads';
import { formatInternationalPhone } from '@/lib/utils';

const emailSchema = z.string().email().max(255);
const phoneSchema = z.string().regex(/^\d+$/);

export interface BuildChangedLeadUpdatesOptions {
  regiaoToTabelaMap: Record<string, string>;
  vendorUserId: string | null;
  includeStatus: boolean;
}

/**
 * Converte o nome do vendedor do formulário em UUID.
 * - vazio / "Sem vendedor" → null (remove responsável)
 * - nome encontrado na lista → id do usuário
 * - nome ainda não resolvido (lista carregando) → fallback para não apagar o vínculo por engano
 */
export function resolveVendorUserIdFromForm(
  vendorName: string | undefined | null,
  users: Array<{ id: string; nome: string }> | undefined | null,
  fallbackWhenUnresolved: string | null,
): string | null {
  const trimmed = (vendorName ?? '').trim();
  if (
    !trimmed ||
    trimmed === 'Sem vendedor' ||
    trimmed === 'Sem vendedor atribuído'
  ) {
    return null;
  }
  const found = users?.find((u) => u.nome === trimmed);
  if (found) return found.id;
  return fallbackWhenUnresolved;
}

/** Monta apenas os campos alterados e válidos para gravação automática. */
export function buildChangedLeadUpdates(
  formData: Partial<Lead>,
  dbLead: DatabaseLead,
  options: BuildChangedLeadUpdatesOptions,
): Partial<DatabaseLead> | null {
  const updates: Partial<DatabaseLead> = {};
  const trim = (value?: string) => (value ?? '').trim();

  const nextName = trim(formData.name);
  if (nextName !== trim(dbLead.nome) && nextName.length >= 2 && nextName.length <= 100) {
    updates.nome = nextName;
  }

  const nextEmail = formData.email ?? '';
  if (nextEmail !== (dbLead.email ?? '')) {
    if (nextEmail === '' || emailSchema.safeParse(nextEmail).success) {
      updates.email = nextEmail || null;
    }
  }

  const nextPhone = formatInternationalPhone(trim(formData.phone));
  const currentPhone = formatInternationalPhone(trim(dbLead.telefone ?? ''));
  if (nextPhone !== currentPhone && phoneSchema.safeParse(nextPhone).success) {
    updates.telefone = nextPhone;
  }

  const nextCompany = formData.company ?? '';
  if (nextCompany !== (dbLead.empresa ?? '')) {
    updates.empresa = nextCompany || null;
  }

  if (formData.origin && formData.origin !== dbLead.origem) {
    updates.origem = formData.origin;
  }

  const nextRegiao = formData.regiao ?? null;
  if (nextRegiao !== (dbLead.regiao ?? null)) {
    updates.regiao = nextRegiao;
    updates.regiao_tabela = nextRegiao
      ? options.regiaoToTabelaMap[nextRegiao] || null
      : null;
  }

  if (options.vendorUserId !== (dbLead.vendedor_responsavel_id ?? null)) {
    updates.vendedor_responsavel_id = options.vendorUserId;
  }

  const nextBudget = Number(formData.budgetValue ?? 0);
  const currentBudget = Number(dbLead.valor_orcamento ?? 0);
  // Comparação com tolerância monetária (evita falha por ponto flutuante / numeric do Postgres).
  if (Math.abs(nextBudget - currentBudget) >= 0.005) {
    updates.valor_orcamento = nextBudget;
  }

  const nextLoss = formData.lossReason ?? '';
  if (nextLoss !== (dbLead.motivo_perda ?? '')) {
    updates.motivo_perda = nextLoss || null;
  }

  const nextObs = formData.observations ?? '';
  if (nextObs !== (dbLead.observacoes ?? '') && nextObs.length <= 2000) {
    updates.observacoes = nextObs || null;
  }

  if (
    options.includeStatus &&
    formData.status &&
    formData.status !== dbLead.status
  ) {
    updates.status = formData.status;
  }

  return Object.keys(updates).length > 0 ? updates : null;
}
