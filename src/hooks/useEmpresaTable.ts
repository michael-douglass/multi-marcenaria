import { useMemo } from 'react';
import { useTableName } from '@/hooks/useEmpresaSupabase';
import { MASTER_TABLES, PUBLIC_LEAD_AI, PUBLIC_WHITEBOARD } from '@/lib/empresa-tables';

/** Nomes de tabelas resolvidos para o schema da empresa ativa. */
export function useEmpresaTable() {
  const table = useTableName();

  return useMemo(
    () => ({
      usuarios: table('usuarios', MASTER_TABLES.usuarios),
      user_roles: table('user_roles', MASTER_TABLES.user_roles),
      presence_sessions: table('presence_sessions', MASTER_TABLES.presence_sessions),
      ponto_registros: table('ponto_registros', MASTER_TABLES.ponto_registros),
      uso_config: table('uso_config', MASTER_TABLES.uso_config),
      notifications: table('notifications', MASTER_TABLES.notifications),
      whiteboard_images: table('lead_whiteboard_images', PUBLIC_WHITEBOARD.images),
      whiteboard_drawings: table('lead_whiteboard_drawings', PUBLIC_WHITEBOARD.drawings),
      lead_whiteboard_text_config: table(
        'lead_whiteboard_text_config',
        PUBLIC_WHITEBOARD.text_config,
      ),
      pipeline_lead_ai_config: table(
        'pipeline_lead_ai_config',
        PUBLIC_LEAD_AI.config,
      ),
      pipeline_lead_ai_config_public: table(
        'pipeline_lead_ai_config_public',
        PUBLIC_LEAD_AI.configPublic,
      ),
      lead_ai_analises: table('lead_ai_analises', PUBLIC_LEAD_AI.analises),
      lead_ai_renders: table('lead_ai_renders', PUBLIC_LEAD_AI.renders),
      lead_ai_chat_messages: table('lead_ai_chat_messages', PUBLIC_LEAD_AI.chatMessages),
      lead_ai_knowledge_chunks: table('lead_ai_knowledge_chunks', PUBLIC_LEAD_AI.knowledgeChunks),
      lead_ai_knowledge_meta: table('lead_ai_knowledge_meta', PUBLIC_LEAD_AI.knowledgeMeta),
    }),
    [table],
  );
}
