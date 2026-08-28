/** Schemas expostos na API REST do Supabase (Dashboard → API → Exposed schemas). */
export const API_EXPOSED_SCHEMAS = new Set(['public', 'graphql_public', 'emp_garbo']);

/** Schema de empresa isolado (emp_slug) — tratado como exposto quando provisionado no Supabase. */
export function isEmpresaSchema(schema: string | null | undefined): boolean {
  return !!schema && /^emp_[a-z0-9_]+$/.test(schema);
}

export function isSchemaApiExposed(schema: string | null | undefined): schema is string {
  if (!schema) return false;
  if (isEmpresaSchema(schema)) return true;
  return API_EXPOSED_SCHEMAS.has(schema);
}

export const MASTER_TABLES = {
  usuarios: 'CRM-multi-empresas>usuarios<',
  user_roles: 'CRM-multi-empresas>user_roles<',
  usuario_empresa: 'CRM-multi-empresas>usuario_empresa<',
  leads: 'CRM-multi-empresas>leads<',
  lead_lembretes: 'CRM-multi-empresas>lead_lembretes<',
  lead_sinalizacoes: 'CRM-multi-empresas>lead_sinalizacoes<',
  webhooks_api: 'CRM-multi-empresas>webhooks_api<',
  presence_sessions: 'CRM-multi-empresas>presence_sessions<',
  ponto_registros: 'CRM-multi-empresas>ponto_registros<',
  uso_config: 'CRM-multi-empresas>uso_config<',
  notifications: 'CRM-multi-empresas>notifications<',
} as const;

export interface LeadsQueryConfig {
  schema: string | null;
  leadsTable: string;
  usuariosFkTable: string;
  webhooksTable: string;
  /** PostgREST não suporta embed em tabelas master com nome `CRM-multi-empresas>...<`. */
  embedVendorInSelect: boolean;
}

/** Cliente + nomes de tabela de leads conforme empresa ativa (emp_* ou master public). */
export function resolveLeadsQueryConfig(schemaNome: string | null | undefined): LeadsQueryConfig {
  if (isSchemaApiExposed(schemaNome)) {
    return {
      schema: schemaNome,
      leadsTable: 'leads',
      usuariosFkTable: 'usuarios',
      webhooksTable: 'webhooks_api',
      embedVendorInSelect: true,
    };
  }
  return {
    schema: null,
    leadsTable: MASTER_TABLES.leads,
    usuariosFkTable: MASTER_TABLES.usuarios,
    webhooksTable: MASTER_TABLES.webhooks_api,
    embedVendorInSelect: false,
  };
}

export function buildLeadsSelect(config: LeadsQueryConfig): string {
  if (config.embedVendorInSelect) {
    return `*, vendedor:${config.usuariosFkTable}!vendedor_responsavel_id(id, nome, email)`;
  }
  return '*';
}

export const PUBLIC_WHITEBOARD = {
  images: 'crm_multiempresas_lead_whiteboard_images',
  drawings: 'crm_multiempresas_lead_whiteboard_drawings',
  text_config: 'CRM-multi-empresas>lead_whiteboard_text_config<',
} as const;

export const PUBLIC_LEAD_AI = {
  config: 'CRM-multi-empresas>pipeline_lead_ai_config<',
  configPublic: 'CRM-multi-empresas>pipeline_lead_ai_config_public<',
  analises: 'CRM-multi-empresas>lead_ai_analises<',
  renders: 'CRM-multi-empresas>lead_ai_renders<',
  chatMessages: 'CRM-multi-empresas>lead_ai_chat_messages<',
  knowledgeChunks: 'CRM-multi-empresas>lead_ai_knowledge_chunks<',
  knowledgeMeta: 'CRM-multi-empresas>lead_ai_knowledge_meta<',
} as const;

export interface EmpresaTableNames {
  usuarios: string;
  user_roles: string;
}

/** Nomes de tabela conforme o schema da empresa ativa (ou master em public). */
export function resolveEmpresaTableNames(schemaNome: string | null | undefined): EmpresaTableNames {
  if (isSchemaApiExposed(schemaNome)) {
    return { usuarios: 'usuarios', user_roles: 'user_roles' };
  }
  return {
    usuarios: MASTER_TABLES.usuarios,
    user_roles: MASTER_TABLES.user_roles,
  };
}

/** Tabela no schema da empresa (emp_*) ou no cadastro master (public). */
export function resolveScopedTableName(
  schemaNome: string | null | undefined,
  empresaTable: string,
  masterTable: string,
): string {
  return isSchemaApiExposed(schemaNome) ? empresaTable : masterTable;
}

export interface MarketingMediasQueryConfig {
  schema: string | null;
  mediasTable: string;
  foldersTable: string;
}

export interface LeadLembretesQueryConfig {
  schema: string | null;
  lembretesTable: string;
  leadsTable: string;
  usuariosTable: string;
}

export interface LeadSinalizacoesQueryConfig {
  schema: string | null;
  sinalizacoesTable: string;
}

/** Sinalizações de lead por titular (popup global). */
export function resolveLeadSinalizacoesQueryConfig(
  schemaNome: string | null | undefined,
): LeadSinalizacoesQueryConfig {
  if (isSchemaApiExposed(schemaNome)) {
    return {
      schema: schemaNome,
      sinalizacoesTable: 'lead_sinalizacoes',
    };
  }
  return {
    schema: null,
    sinalizacoesTable: MASTER_TABLES.lead_sinalizacoes,
  };
}

/** Lembretes de lead: schema emp_* (FK com leads da empresa) ou master public. */
export function resolveLeadLembretesQueryConfig(
  schemaNome: string | null | undefined,
): LeadLembretesQueryConfig {
  if (isSchemaApiExposed(schemaNome)) {
    return {
      schema: schemaNome,
      lembretesTable: 'lead_lembretes',
      leadsTable: 'leads',
      usuariosTable: 'usuarios',
    };
  }
  return {
    schema: null,
    lembretesTable: MASTER_TABLES.lead_lembretes,
    leadsTable: MASTER_TABLES.leads,
    usuariosTable: MASTER_TABLES.usuarios,
  };
}

/** PDFs de lead: tabelas no schema emp_* (FK com leads da empresa) ou master public. */
export function resolveMarketingMediasConfig(
  schemaNome: string | null | undefined,
): MarketingMediasQueryConfig {
  if (isEmpresaSchema(schemaNome)) {
    return {
      schema: schemaNome,
      mediasTable: 'marketing_medias',
      foldersTable: 'marketing_media_folders',
    };
  }
  return {
    schema: null,
    mediasTable: 'crm_multiempresas_marketing_medias',
    foldersTable: 'crm_multiempresas_marketing_media_folders',
  };
}

export interface ChatContatosQueryConfig {
  schema: string | null;
  contatosTable: string;
}

/** Contatos do WhatsApp/chat: schema emp_* ou tabela master em public. */
export function resolveChatContatosQueryConfig(
  schemaNome: string | null | undefined,
): ChatContatosQueryConfig {
  if (isEmpresaSchema(schemaNome)) {
    return {
      schema: schemaNome,
      contatosTable: 'chat_contatos',
    };
  }
  return {
    schema: null,
    contatosTable: 'crm_multiempresas_chat_contatos',
  };
}
