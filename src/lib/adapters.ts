import { Lead, User, TabelaOrigemInfo } from '@/types/selletos';
import { LeadWithVendor } from '@/hooks/useLeads';
import type { DatabaseUser } from '@/hooks/useUsers';
import { formatInTimeZone } from 'date-fns-tz';
import { formatInternationalPhone } from '@/lib/utils';

/**
 * Adapter para converter dados do Supabase para o formato esperado pelos componentes
 * 
 * IMPORTANTE: Todas as datas são convertidas para o fuso de São Paulo (America/Sao_Paulo)
 * para garantir que o card "Leads Hoje" e outras métricas reflitam o dia operacional correto.
 */

/**
 * Converte um timestamp UTC para data no formato yyyy-MM-dd no fuso de São Paulo
 */
function toSaoPauloDateString(timestamp: string | null | undefined, fallback?: string): string {
  if (!timestamp) {
    return fallback || '';
  }
  try {
    return formatInTimeZone(new Date(timestamp), 'America/Sao_Paulo', 'yyyy-MM-dd');
  } catch {
    // Se falhar, tenta extrair apenas a data
    return timestamp.includes('T') ? timestamp.split('T')[0] : timestamp;
  }
}

export function adaptLeadFromDatabase(dbLead: LeadWithVendor): Lead {
  // Usar criado_em (TIMESTAMPTZ) para calcular o dia de chegada no fuso de São Paulo
  // Fallback para data_chegada se criado_em não existir
  const dateArrived = toSaoPauloDateString(dbLead.criado_em) || 
    (dbLead.data_chegada.includes('T') ? dbLead.data_chegada.split('T')[0] : dbLead.data_chegada);
  
  const updatedAt = toSaoPauloDateString(dbLead.atualizado_em) || dateArrived;
  
  const saleDate = dbLead.venda_realizada_em 
    ? toSaoPauloDateString(dbLead.venda_realizada_em)
    : undefined;

  return {
    id: dbLead.id,
    name: dbLead.nome,
    email: dbLead.email || '',
    phone: formatInternationalPhone(dbLead.telefone || ''),
    origin: dbLead.origem || 'Outros',
    vendor: dbLead.vendedor?.nome || 'Sem vendedor',
    status: dbLead.status as any,
    dateArrived,
    updatedAt,
    saleDate,
    dealValue: Number(dbLead.valor_negocio),
    budgetValue: Number(dbLead.valor_orcamento ?? 0),
    lossReason: dbLead.motivo_perda || undefined,
    company: dbLead.empresa || undefined,
    observations: dbLead.observacoes || undefined,
    manualOrder: dbLead.ordem_manual || undefined,
    webhookName: dbLead.webhook_nome || undefined,
    // Usar campo regiao diretamente do banco
    regiao: dbLead.regiao || dbLead.tabela_origem || undefined,
    regiaoTabela: dbLead.regiao_tabela || undefined,
    // DEPRECATED - mantidos para compatibilidade
    tabelaOrigem: dbLead.regiao || dbLead.tabela_origem || undefined,
    tabelaOrigemInfo: dbLead.regiao ? {
      nomeAmigavel: dbLead.regiao,
      nomeTabela: dbLead.regiao_tabela || 'unknown'
    } : dbLead.tabela_origem_info || undefined,
    // Flag para priorizar lead no topo da coluna
    needsAttention: Boolean(dbLead.dar_atencao),
    pontuaGarboUsuarioId: dbLead.pontua_garbo_usuario_id ?? null,
  };
}

export function adaptUserFromDatabase(dbUser: DatabaseUser): User {
  return {
    id: 0, // Mock ID for compatibility with existing components
    name: dbUser.nome,
    email: dbUser.email || '',
    role: dbUser.role.toUpperCase() as 'ADMIN' | 'VENDEDOR' | 'MARKETING' | 'NENHUM',
    phone: dbUser.telefone || undefined,
    avatarUrl: dbUser.avatar_url || undefined,
    inviteSent: true,
    createdAt: dbUser.criado_em,
  };
}

export function adaptUserForAvatar(dbUser: DatabaseUser): { name: string; avatarUrl?: string } {
  return {
    name: dbUser.nome,
    avatarUrl: dbUser.avatar_url || undefined,
  };
}
