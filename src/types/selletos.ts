export type UserRole = 'ADMIN' | 'VENDEDOR' | 'MARKETING' | 'NENHUM';

export type LeadSortBy = 'ultima_interacao' | 'data_cadastro' | 'manual';

export type LeadStatus =
  | 'Novo Lead'
  | 'Aula Experimental Marcada'
  | 'Não Entraram para Aula Experimental'
  | 'Aula Realizada'
  | 'Negociação'
  | 'Venda Realizada (Matriculado)'
  | 'Interesse Futuro'
  | 'Orçamentos Perdidos'
  | 'Clientes Já Cadastrados';

export type LeadOrigin = string; // Dynamic origins

export interface LeadOriginConfig {
  id: string;
  name: string;
  isDefault: boolean;
  createdAt: string;
}

export interface TabelaOrigemInfo {
  nomeAmigavel: string;
  nomeTabela: string;
}

export interface TabelaOrigemConfig {
  id: string;
  nomeTabela: string;
  nomeAmigavel: string;
  criadoEm: string;
  atualizadoEm: string;
}

export interface User {
  id: number;
  name: string;
  email: string;
  role: UserRole;
  phone?: string;
  inviteSent?: boolean;
  inviteToken?: string | null;
  createdAt?: string;
  avatarUrl?: string;
}

export interface Lead {
  id: number;
  name: string;
  email: string;
  phone: string;
  origin: LeadOrigin;
  vendor: string;
  status: LeadStatus;
  dateArrived: string;
  updatedAt: string; // Data da última atualização
  saleDate?: string; // Data em que a venda foi fechada (para KPIs)
  dealValue: number;
  /** Valor do orçamento informado no lead (card Orçamentos no Pipeline) */
  budgetValue: number;
  lossReason?: string;
  company?: string;
  observations?: string;
  manualOrder?: number;
  webhookName?: string;
  regiao?: string; // Região do lead (São Paulo, Minas Gerais, etc.)
  regiaoTabela?: string; // Nome técnico da tabela de origem
  tabelaOrigem?: string; // DEPRECATED - usar regiao
  tabelaOrigemInfo?: TabelaOrigemInfo; // DEPRECATED - usar regiao/regiaoTabela
  needsAttention?: boolean; // Flag para priorizar lead no topo da coluna
  /** Se preenchido, este card é de um parceiro Pontua Garbo. */
  pontuaGarboUsuarioId?: string | null;
}

export type PeriodFilter = 'today' | 'week' | 'month' | 'all';
