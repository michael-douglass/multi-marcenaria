export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)"
  }
  public: {
    Tables: {
      _migration_history: {
        Row: {
          applied_at: string | null
          id: number
          name: string
        }
        Insert: {
          applied_at?: string | null
          id?: number
          name: string
        }
        Update: {
          applied_at?: string | null
          id?: number
          name?: string
        }
        Relationships: []
      }
      crm_multiempresas_agenda_pessoal_admin_titular_filter: {
        Row: {
          filter_mode: string
          filter_titular_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          filter_mode?: string
          filter_titular_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          filter_mode?: string
          filter_titular_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      crm_multiempresas_agenda_pessoal_tarefas: {
        Row: {
          anexos: Json
          atualizado_em: string
          concluida: boolean
          conclusoes_ocorrencias: Json | null
          criado_em: string
          criado_por: string | null
          data: string
          data_fim_recorrencia: string | null
          descricao: string | null
          exclusoes_ocorrencias: Json | null
          hora: string | null
          id: string
          ocultar_de_outros_admins: boolean
          recorrencia_dias_semana: Json | null
          recorrencia_tipo: string | null
          tipo_agendamento: string
          titular_id: string
          titular_nome: string | null
          titulo: string
          cor: string | null
        }
        Insert: {
          anexos?: Json
          atualizado_em?: string
          concluida?: boolean
          conclusoes_ocorrencias?: Json | null
          criado_em?: string
          criado_por?: string | null
          data: string
          data_fim_recorrencia?: string | null
          descricao?: string | null
          exclusoes_ocorrencias?: Json | null
          hora?: string | null
          id?: string
          ocultar_de_outros_admins?: boolean
          recorrencia_dias_semana?: Json | null
          recorrencia_tipo?: string | null
          tipo_agendamento?: string
          titular_id: string
          titular_nome?: string | null
          titulo: string
          cor?: string | null
        }
        Update: {
          anexos?: Json
          atualizado_em?: string
          concluida?: boolean
          conclusoes_ocorrencias?: Json | null
          criado_em?: string
          criado_por?: string | null
          data?: string
          data_fim_recorrencia?: string | null
          descricao?: string | null
          exclusoes_ocorrencias?: Json | null
          hora?: string | null
          id?: string
          ocultar_de_outros_admins?: boolean
          recorrencia_dias_semana?: Json | null
          recorrencia_tipo?: string | null
          tipo_agendamento?: string
          titular_id?: string
          titular_nome?: string | null
          titulo?: string
          cor?: string | null
        }
        Relationships: []
      }
      alimentacao_analysis_history: {
        Row: {
          analysis_result: Json
          created_at: string
          id: string
          image_url: string | null
          user_id: string
          user_notes: string | null
        }
        Insert: {
          analysis_result: Json
          created_at?: string
          id?: string
          image_url?: string | null
          user_id: string
          user_notes?: string | null
        }
        Update: {
          analysis_result?: Json
          created_at?: string
          id?: string
          image_url?: string | null
          user_id?: string
          user_notes?: string | null
        }
        Relationships: []
      }
      alimentacao_token: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          token: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          token: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          token?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      "apostila-proforco_colunas": {
        Row: {
          created_at: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          created_at?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          created_at?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      crm_multiempresas_atalhos: {
        Row: {
          all_can_see: boolean | null
          created_at: string
          id: number
          mensagem: string | null
          titulo: string | null
          url_audio: string | null
          url_img: string | null
          url_pdf: string | null
          user_auth: string | null
        }
        Insert: {
          all_can_see?: boolean | null
          created_at?: string
          id?: number
          mensagem?: string | null
          titulo?: string | null
          url_audio?: string | null
          url_img?: string | null
          url_pdf?: string | null
          user_auth?: string | null
        }
        Update: {
          all_can_see?: boolean | null
          created_at?: string
          id?: number
          mensagem?: string | null
          titulo?: string | null
          url_audio?: string | null
          url_img?: string | null
          url_pdf?: string | null
          user_auth?: string | null
        }
        Relationships: []
      }
      attendant: {
        Row: {
          ativo: boolean | null
          created_at: string
          email: string | null
          id: number
          instance_id: number[] | null
          nome: string | null
          user_auth: string | null
        }
        Insert: {
          ativo?: boolean | null
          created_at?: string
          email?: string | null
          id?: number
          instance_id?: number[] | null
          nome?: string | null
          user_auth?: string | null
        }
        Update: {
          ativo?: boolean | null
          created_at?: string
          email?: string | null
          id?: number
          instance_id?: number[] | null
          nome?: string | null
          user_auth?: string | null
        }
        Relationships: []
      }
      "Chat-Sky-conversas": {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          id: string
          tipo: string | null
          titulo: string
          ultima_mensagem_em: string | null
          user_id: string
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          tipo?: string | null
          titulo?: string
          ultima_mensagem_em?: string | null
          user_id: string
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          tipo?: string | null
          titulo?: string
          ultima_mensagem_em?: string | null
          user_id?: string
        }
        Relationships: []
      }
      "Chat-Sky-digitando": {
        Row: {
          atualizado_em: string | null
          conversa_id: string
          digitando: boolean | null
          id: string
          user_id: string
        }
        Insert: {
          atualizado_em?: string | null
          conversa_id: string
          digitando?: boolean | null
          id?: string
          user_id: string
        }
        Update: {
          atualizado_em?: string | null
          conversa_id?: string
          digitando?: boolean | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "Chat-Sky-digitando_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "Chat-Sky-conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      "Chat-Sky-mensagens": {
        Row: {
          conteudo_texto: string | null
          conversa_id: string
          enviado_em: string | null
          id: string
          lido: boolean | null
          lido_em: string | null
          metadata: Json | null
          nome_arquivo: string | null
          remetente_tipo: string
          tamanho_arquivo: number | null
          tipo_midia: string | null
          tipo_mime: string | null
          url_midia: string | null
          user_id: string | null
        }
        Insert: {
          conteudo_texto?: string | null
          conversa_id: string
          enviado_em?: string | null
          id?: string
          lido?: boolean | null
          lido_em?: string | null
          metadata?: Json | null
          nome_arquivo?: string | null
          remetente_tipo: string
          tamanho_arquivo?: number | null
          tipo_midia?: string | null
          tipo_mime?: string | null
          url_midia?: string | null
          user_id?: string | null
        }
        Update: {
          conteudo_texto?: string | null
          conversa_id?: string
          enviado_em?: string | null
          id?: string
          lido?: boolean | null
          lido_em?: string | null
          metadata?: Json | null
          nome_arquivo?: string | null
          remetente_tipo?: string
          tamanho_arquivo?: number | null
          tipo_midia?: string | null
          tipo_mime?: string | null
          url_midia?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Chat-Sky-mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "Chat-Sky-conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      "Chat-Sky-usuarios": {
        Row: {
          atualizado_em: string | null
          avatar_url: string | null
          criado_em: string | null
          id: string
          nome: string
          status: string | null
          ultima_atividade: string | null
          user_id: string
        }
        Insert: {
          atualizado_em?: string | null
          avatar_url?: string | null
          criado_em?: string | null
          id?: string
          nome: string
          status?: string | null
          ultima_atividade?: string | null
          user_id: string
        }
        Update: {
          atualizado_em?: string | null
          avatar_url?: string | null
          criado_em?: string | null
          id?: string
          nome?: string
          status?: string | null
          ultima_atividade?: string | null
          user_id?: string
        }
        Relationships: []
      }
      "Chat-Sky-webhooks": {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          descricao: string | null
          id: string
          nome: string
          url: string
          user_id: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome: string
          url: string
          user_id: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      chats: {
        Row: {
          audio_reply: string | null
          audio_url: string | null
          created_at: string
          deletado: boolean | null
          from_me: boolean | null
          id: number
          id_chat: string | null
          id_contato: number | null
          imagem_reply: string | null
          imagem_url: string | null
          mensagem: string | null
          mensagem_id: string | null
          message_timestamp: number | null
          pdf_reply: string | null
          pdf_url: string | null
          reply: string | null
          status: boolean | null
          timestamp: string | null
          tipo_mensagem: string | null
        }
        Insert: {
          audio_reply?: string | null
          audio_url?: string | null
          created_at?: string
          deletado?: boolean | null
          from_me?: boolean | null
          id?: number
          id_chat?: string | null
          id_contato?: number | null
          imagem_reply?: string | null
          imagem_url?: string | null
          mensagem?: string | null
          mensagem_id?: string | null
          message_timestamp?: number | null
          pdf_reply?: string | null
          pdf_url?: string | null
          reply?: string | null
          status?: boolean | null
          timestamp?: string | null
          tipo_mensagem?: string | null
        }
        Update: {
          audio_reply?: string | null
          audio_url?: string | null
          created_at?: string
          deletado?: boolean | null
          from_me?: boolean | null
          id?: number
          id_chat?: string | null
          id_contato?: number | null
          imagem_reply?: string | null
          imagem_url?: string | null
          mensagem?: string | null
          mensagem_id?: string | null
          message_timestamp?: number | null
          pdf_reply?: string | null
          pdf_url?: string | null
          reply?: string | null
          status?: boolean | null
          timestamp?: string | null
          tipo_mensagem?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chats_id_contato_fkey"
            columns: ["id_contato"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_id_contato_fkey"
            columns: ["id_contato"]
            isOneToOne: false
            referencedRelation: "vw_contatos"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_email_captures: {
        Row: {
          created_at: string
          email: string
          id: string
          landing_slug: string | null
          product_slug: string
          source: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          landing_slug?: string | null
          product_slug?: string
          source?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          landing_slug?: string | null
          product_slug?: string
          source?: string | null
        }
        Relationships: []
      }
      codigo_completo: {
        Row: {
          arquivo_nome: string
          arquivo_path: string
          atualizado_em: string | null
          categoria: string
          conteudo_linha: string
          criado_em: string | null
          eh_comentario: boolean | null
          eh_funcao: boolean | null
          eh_import: boolean | null
          extensao: string
          id: string
          linguagem: string
          numero_linha: number
          subcategoria: string | null
          total_linhas_arquivo: number
        }
        Insert: {
          arquivo_nome: string
          arquivo_path: string
          atualizado_em?: string | null
          categoria: string
          conteudo_linha: string
          criado_em?: string | null
          eh_comentario?: boolean | null
          eh_funcao?: boolean | null
          eh_import?: boolean | null
          extensao: string
          id?: string
          linguagem: string
          numero_linha: number
          subcategoria?: string | null
          total_linhas_arquivo: number
        }
        Update: {
          arquivo_nome?: string
          arquivo_path?: string
          atualizado_em?: string | null
          categoria?: string
          conteudo_linha?: string
          criado_em?: string | null
          eh_comentario?: boolean | null
          eh_funcao?: boolean | null
          eh_import?: boolean | null
          extensao?: string
          id?: string
          linguagem?: string
          numero_linha?: number
          subcategoria?: string | null
          total_linhas_arquivo?: number
        }
        Relationships: []
      }
      contatos: {
        Row: {
          atendente: string | null
          created_at: string
          id: number
          instance_id: number | null
          mensagens_nao_lida: number | null
          mostrar: boolean | null
          nome: string | null
          nova_mensagem: boolean | null
          push_name: string | null
          remoteid: string | null
          tag_id: number | null
          telefone: string | null
          timestamp: string | null
          ultima_mensagem: string | null
        }
        Insert: {
          atendente?: string | null
          created_at?: string
          id?: number
          instance_id?: number | null
          mensagens_nao_lida?: number | null
          mostrar?: boolean | null
          nome?: string | null
          nova_mensagem?: boolean | null
          push_name?: string | null
          remoteid?: string | null
          tag_id?: number | null
          telefone?: string | null
          timestamp?: string | null
          ultima_mensagem?: string | null
        }
        Update: {
          atendente?: string | null
          created_at?: string
          id?: number
          instance_id?: number | null
          mensagens_nao_lida?: number | null
          mostrar?: boolean | null
          nome?: string | null
          nova_mensagem?: boolean | null
          push_name?: string | null
          remoteid?: string | null
          tag_id?: number | null
          telefone?: string | null
          timestamp?: string | null
          ultima_mensagem?: string | null
        }
        Relationships: []
      }
      crm_multiempresas_chat_contatos: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          lead_id: number | null
          mensagens_nao_lidas: number | null
          nome: string | null
          telefone: string
          ultima_mensagem_em: string | null
          webhook_id: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          lead_id?: number | null
          mensagens_nao_lidas?: number | null
          nome?: string | null
          telefone: string
          ultima_mensagem_em?: string | null
          webhook_id?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          lead_id?: number | null
          mensagens_nao_lidas?: number | null
          nome?: string | null
          telefone?: string
          ultima_mensagem_em?: string | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_multiempresas_chat_contatos_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>leads<"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_multiempresas_chat_contatos_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>webhooks_api<"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_multiempresas_chat_logs: {
        Row: {
          contato_id: string | null
          criado_em: string
          detalhes: Json | null
          evento: string
          id: string
          telefone: string | null
        }
        Insert: {
          contato_id?: string | null
          criado_em?: string
          detalhes?: Json | null
          evento: string
          id?: string
          telefone?: string | null
        }
        Update: {
          contato_id?: string | null
          criado_em?: string
          detalhes?: Json | null
          evento?: string
          id?: string
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_multiempresas_chat_logs_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "crm_multiempresas_chat_contatos"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_multiempresas_chat_mensagens: {
        Row: {
          contato_id: string | null
          conteudo: string | null
          criado_em: string
          enviada: boolean | null
          file_name: string | null
          file_size: number | null
          id: string
          lida: boolean | null
          mensagem_n8n_id: number | null
          message_id_external: string | null
          mime_type: string | null
          origem: string
          remote_jid: string | null
          telefone: string
          tipo_mensagem: string
          tipo_remetente: string
          url_midia: string | null
          usuario_id: string | null
        }
        Insert: {
          contato_id?: string | null
          conteudo?: string | null
          criado_em?: string
          enviada?: boolean | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          lida?: boolean | null
          mensagem_n8n_id?: number | null
          message_id_external?: string | null
          mime_type?: string | null
          origem?: string
          remote_jid?: string | null
          telefone: string
          tipo_mensagem?: string
          tipo_remetente: string
          url_midia?: string | null
          usuario_id?: string | null
        }
        Update: {
          contato_id?: string | null
          conteudo?: string | null
          criado_em?: string
          enviada?: boolean | null
          file_name?: string | null
          file_size?: number | null
          id?: string
          lida?: boolean | null
          mensagem_n8n_id?: number | null
          message_id_external?: string | null
          mime_type?: string | null
          origem?: string
          remote_jid?: string | null
          telefone?: string
          tipo_mensagem?: string
          tipo_remetente?: string
          url_midia?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_multiempresas_chat_mensagens_contato_id_fkey"
            columns: ["contato_id"]
            isOneToOne: false
            referencedRelation: "crm_multiempresas_chat_contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_multiempresas_chat_mensagens_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>usuarios<"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_multiempresas_chat_mensagens_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>vendor_performance_stats<"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      "CRM-multi-empresas>agenda_bloqueios<": {
        Row: {
          criado_em: string
          criado_por: string | null
          data_fim: string
          data_inicio: string
          id: string
          recorrente: boolean
          tipo_recorrencia: string | null
          titulo: string
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          data_fim: string
          data_inicio: string
          id?: string
          recorrente?: boolean
          tipo_recorrencia?: string | null
          titulo: string
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          data_fim?: string
          data_inicio?: string
          id?: string
          recorrente?: boolean
          tipo_recorrencia?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "CRM-multi-empresas>agenda_bloqueios<_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>usuarios<"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CRM-multi-empresas>agenda_bloqueios<_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>vendor_performance_stats<"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      "CRM-multi-empresas>agenda_config<": {
        Row: {
          antecedencia_maxima_dias: number
          antecedencia_minima_horas: number
          ativo: boolean
          atualizado_em: string
          bloqueios_recorrentes: Json | null
          criado_em: string
          dias_disponiveis: number[]
          duracao_minutos: number
          formulario_ativo: boolean
          horario_fim: string
          horario_inicio: string
          id: string
          intervalo_minutos: number
          link_video_conferencia: string | null
          minutos_antecedencia_lembrete: number | null
          nome_agenda: string
          pergunta_personalizada: string | null
          slug: string
          template_confirmacao_id: number | null
          template_lembrete_id: number | null
          webhook_cancelamento_id: string | null
          webhook_concluido_id: string | null
          webhook_lembrete_id: string | null
          webhook_relatorio_reunioes_id: string | null
        }
        Insert: {
          antecedencia_maxima_dias?: number
          antecedencia_minima_horas?: number
          ativo?: boolean
          atualizado_em?: string
          bloqueios_recorrentes?: Json | null
          criado_em?: string
          dias_disponiveis?: number[]
          duracao_minutos?: number
          formulario_ativo?: boolean
          horario_fim?: string
          horario_inicio?: string
          id?: string
          intervalo_minutos?: number
          link_video_conferencia?: string | null
          minutos_antecedencia_lembrete?: number | null
          nome_agenda?: string
          pergunta_personalizada?: string | null
          slug?: string
          template_confirmacao_id?: number | null
          template_lembrete_id?: number | null
          webhook_cancelamento_id?: string | null
          webhook_concluido_id?: string | null
          webhook_lembrete_id?: string | null
          webhook_relatorio_reunioes_id?: string | null
        }
        Update: {
          antecedencia_maxima_dias?: number
          antecedencia_minima_horas?: number
          ativo?: boolean
          atualizado_em?: string
          bloqueios_recorrentes?: Json | null
          criado_em?: string
          dias_disponiveis?: number[]
          duracao_minutos?: number
          formulario_ativo?: boolean
          horario_fim?: string
          horario_inicio?: string
          id?: string
          intervalo_minutos?: number
          link_video_conferencia?: string | null
          minutos_antecedencia_lembrete?: number | null
          nome_agenda?: string
          pergunta_personalizada?: string | null
          slug?: string
          template_confirmacao_id?: number | null
          template_lembrete_id?: number | null
          webhook_cancelamento_id?: string | null
          webhook_concluido_id?: string | null
          webhook_lembrete_id?: string | null
          webhook_relatorio_reunioes_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "CRM-multi-empresas>agenda_config<_template_confirmacao_id_fkey"
            columns: ["template_confirmacao_id"]
            isOneToOne: false
            referencedRelation: "atalhos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CRM-multi-empresas>agenda_config<_template_lembrete_id_fkey"
            columns: ["template_lembrete_id"]
            isOneToOne: false
            referencedRelation: "atalhos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CRM-multi-empresas>agenda_config<_webhook_cancelamento_id_fkey"
            columns: ["webhook_cancelamento_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>webhooks_api<"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CRM-multi-empresas>agenda_config<_webhook_concluido_id_fkey"
            columns: ["webhook_concluido_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>webhooks_api<"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CRM-multi-empresas>agenda_config<_webhook_lembrete_id_fkey"
            columns: ["webhook_lembrete_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>webhooks_api<"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CRM-multi-empresas>agenda_config<_webhook_relatorio_reunioes_id_fkey"
            columns: ["webhook_relatorio_reunioes_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>webhooks_api<"
            referencedColumns: ["id"]
          },
        ]
      }
      "CRM-multi-empresas>agenda_form_fields<": {
        Row: {
          atualizado_em: string
          config_id: string | null
          criado_em: string
          field_key: string
          field_label: string
          field_type: string
          id: string
          options: string[] | null
          ordem: number
          placeholder: string | null
          required: boolean
          visible: boolean
        }
        Insert: {
          atualizado_em?: string
          config_id?: string | null
          criado_em?: string
          field_key: string
          field_label: string
          field_type?: string
          id?: string
          options?: string[] | null
          ordem?: number
          placeholder?: string | null
          required?: boolean
          visible?: boolean
        }
        Update: {
          atualizado_em?: string
          config_id?: string | null
          criado_em?: string
          field_key?: string
          field_label?: string
          field_type?: string
          id?: string
          options?: string[] | null
          ordem?: number
          placeholder?: string | null
          required?: boolean
          visible?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "CRM-multi-empresas>agenda_form_fields<_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>agenda_config<"
            referencedColumns: ["id"]
          },
        ]
      }
      "CRM-multi-empresas>agenda_reunioes<": {
        Row: {
          atualizado_em: string
          cancelado_em: string | null
          concluido_em: string | null
          confirmacao_enviada_em: string | null
          confirmado_em: string | null
          convidado_email: string | null
          convidado_nome: string | null
          convidado_whatsapp: string | null
          criado_em: string
          data_hora_fim: string
          data_hora_inicio: string
          descricao: string | null
          duracao_minutos: number
          id: string
          lead_id: number | null
          lembrete_enviado_em: string | null
          link_video_conferencia: string | null
          metadata_capturada: Json | null
          observacoes: string | null
          responsavel_id: string | null
          resposta_formulario: string | null
          status: string
          tipo: string
          titulo: string
          titular_ids: string[] | null
          cor: string | null
        }
        Insert: {
          atualizado_em?: string
          cancelado_em?: string | null
          concluido_em?: string | null
          confirmacao_enviada_em?: string | null
          confirmado_em?: string | null
          convidado_email?: string | null
          convidado_nome?: string | null
          convidado_whatsapp?: string | null
          criado_em?: string
          data_hora_fim: string
          data_hora_inicio: string
          descricao?: string | null
          duracao_minutos: number
          id?: string
          lead_id?: number | null
          lembrete_enviado_em?: string | null
          link_video_conferencia?: string | null
          metadata_capturada?: Json | null
          observacoes?: string | null
          responsavel_id?: string | null
          resposta_formulario?: string | null
          status?: string
          tipo?: string
          titulo: string
          titular_ids?: string[] | null
          cor?: string | null
        }
        Update: {
          atualizado_em?: string
          cancelado_em?: string | null
          concluido_em?: string | null
          confirmacao_enviada_em?: string | null
          confirmado_em?: string | null
          convidado_email?: string | null
          convidado_nome?: string | null
          convidado_whatsapp?: string | null
          criado_em?: string
          data_hora_fim?: string
          data_hora_inicio?: string
          descricao?: string | null
          duracao_minutos?: number
          id?: string
          lead_id?: number | null
          lembrete_enviado_em?: string | null
          link_video_conferencia?: string | null
          metadata_capturada?: Json | null
          observacoes?: string | null
          responsavel_id?: string | null
          resposta_formulario?: string | null
          status?: string
          tipo?: string
          titulo?: string
          titular_ids?: string[] | null
          cor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "CRM-multi-empresas>agenda_reunioes<_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>leads<"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CRM-multi-empresas>agenda_reunioes<_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>usuarios<"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CRM-multi-empresas>agenda_reunioes<_responsavel_id_fkey"
            columns: ["responsavel_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>vendor_performance_stats<"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      "CRM-multi-empresas>cadastro_alunos<": {
        Row: {
          ano_escolar: string | null
          atualizado_em: string
          cpf_responsavel: string | null
          criado_em: string
          data_inicio_prevista: string | null
          dia_pagamento: number | null
          disciplinas: string[]
          email: string
          id: string
          idade: number | null
          materia_desejada: string | null
          melhor_horario: string[]
          melhores_dias: string[]
          nome: string
          nome_aluno: string | null
          plano_id: string | null
          telefone: string | null
          user_id: string
        }
        Insert: {
          ano_escolar?: string | null
          atualizado_em?: string
          cpf_responsavel?: string | null
          criado_em?: string
          data_inicio_prevista?: string | null
          dia_pagamento?: number | null
          disciplinas?: string[]
          email: string
          id?: string
          idade?: number | null
          materia_desejada?: string | null
          melhor_horario?: string[]
          melhores_dias?: string[]
          nome: string
          nome_aluno?: string | null
          plano_id?: string | null
          telefone?: string | null
          user_id: string
        }
        Update: {
          ano_escolar?: string | null
          atualizado_em?: string
          cpf_responsavel?: string | null
          criado_em?: string
          data_inicio_prevista?: string | null
          dia_pagamento?: number | null
          disciplinas?: string[]
          email?: string
          id?: string
          idade?: number | null
          materia_desejada?: string | null
          melhor_horario?: string[]
          melhores_dias?: string[]
          nome?: string
          nome_aluno?: string | null
          plano_id?: string | null
          telefone?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "CRM-multi-empresas>cadastro_alunos<_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-fin_planos"
            referencedColumns: ["id"]
          },
        ]
      }
      "CRM-multi-empresas>cadastro_config<": {
        Row: {
          atualizado_em: string
          disciplinas: string[]
          id: string
          planos_visiveis: string[]
        }
        Insert: {
          atualizado_em?: string
          disciplinas?: string[]
          id?: string
          planos_visiveis?: string[]
        }
        Update: {
          atualizado_em?: string
          disciplinas?: string[]
          id?: string
          planos_visiveis?: string[]
        }
        Relationships: []
      }
      "CRM-multi-empresas>desmatriculados_colunas<": {
        Row: {
          ativo: boolean
          atualizado_em: string
          cor: string
          criado_em: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          cor?: string
          criado_em?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          cor?: string
          criado_em?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      "CRM-multi-empresas>desmatriculados_kanban<": {
        Row: {
          atualizado_em: string
          coluna_id: string
          criado_em: string
          desmatriculado_id: string
          id: string
          ordem: number
        }
        Insert: {
          atualizado_em?: string
          coluna_id: string
          criado_em?: string
          desmatriculado_id: string
          id?: string
          ordem?: number
        }
        Update: {
          atualizado_em?: string
          coluna_id?: string
          criado_em?: string
          desmatriculado_id?: string
          id?: string
          ordem?: number
        }
        Relationships: [
          {
            foreignKeyName: "CRM-multi-empresas>desmatriculados_kanban<_coluna_id_fkey"
            columns: ["coluna_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>desmatriculados_colunas<"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CRM-multi-empresas>desmatriculados_kanban<_desmatriculado_id_fkey"
            columns: ["desmatriculado_id"]
            isOneToOne: true
            referencedRelation: "CRM-multi-empresas>alunos_desmatriculados<"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CRM-multi-empresas>desmatriculados_kanban<_desmatriculado_id_fkey"
            columns: ["desmatriculado_id"]
            isOneToOne: true
            referencedRelation: "plataforma-pro-forco-registro_desmatriculas"
            referencedColumns: ["id"]
          },
        ]
      }
      "CRM-multi-empresas>desmatriculados_movimentos<": {
        Row: {
          coluna_id: string
          criado_em: string
          desmatriculado_id: string
          id: string
        }
        Insert: {
          coluna_id: string
          criado_em?: string
          desmatriculado_id: string
          id?: string
        }
        Update: {
          coluna_id?: string
          criado_em?: string
          desmatriculado_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "CRM-multi-empresas>desmatriculados_movimentos<_coluna_id_fkey"
            columns: ["coluna_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>desmatriculados_colunas<"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CRM-multi-empresas>desmatriculados_movimentos<_desmatriculado_id_fkey"
            columns: ["desmatriculado_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>alunos_desmatriculados<"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CRM-multi-empresas>desmatriculados_movimentos<_desmatriculado_id_fkey"
            columns: ["desmatriculado_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-registro_desmatriculas"
            referencedColumns: ["id"]
          },
        ]
      }
      "CRM-multi-empresas>kanban_card_overrides<": {
        Row: {
          acao: string
          ativo: boolean
          atualizado_em: string
          coluna_id: string
          criado_em: string
          criado_por: string
          id: string
          lead_id: number
        }
        Insert: {
          acao: string
          ativo?: boolean
          atualizado_em?: string
          coluna_id: string
          criado_em?: string
          criado_por: string
          id?: string
          lead_id: number
        }
        Update: {
          acao?: string
          ativo?: boolean
          atualizado_em?: string
          coluna_id?: string
          criado_em?: string
          criado_por?: string
          id?: string
          lead_id?: number
        }
        Relationships: [
          {
            foreignKeyName: "CRM-multi-empresas>kanban_card_overrides<_coluna_id_fkey"
            columns: ["coluna_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>kanban_columns<"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CRM-multi-empresas>kanban_card_overrides<_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>usuarios<"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CRM-multi-empresas>kanban_card_overrides<_criado_por_fkey"
            columns: ["criado_por"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>vendor_performance_stats<"
            referencedColumns: ["vendedor_id"]
          },
          {
            foreignKeyName: "CRM-multi-empresas>kanban_card_overrides<_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>leads<"
            referencedColumns: ["id"]
          },
        ]
      }
      "CRM-multi-empresas>kanban_column_sources<": {
        Row: {
          ativo: boolean
          atualizado_em: string
          coluna_id: string
          criado_em: string
          filtro_data_ate: string | null
          filtro_data_de: string | null
          filtro_origem: string | null
          filtro_regiao: string | null
          filtro_vendedor_id: string | null
          id: string
          tipo_fonte: string
          valor_fonte: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          coluna_id: string
          criado_em?: string
          filtro_data_ate?: string | null
          filtro_data_de?: string | null
          filtro_origem?: string | null
          filtro_regiao?: string | null
          filtro_vendedor_id?: string | null
          id?: string
          tipo_fonte: string
          valor_fonte: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          coluna_id?: string
          criado_em?: string
          filtro_data_ate?: string | null
          filtro_data_de?: string | null
          filtro_origem?: string | null
          filtro_regiao?: string | null
          filtro_vendedor_id?: string | null
          id?: string
          tipo_fonte?: string
          valor_fonte?: string
        }
        Relationships: [
          {
            foreignKeyName: "CRM-multi-empresas>kanban_column_sources<_coluna_id_fkey"
            columns: ["coluna_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>kanban_columns<"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CRM-multi-empresas>kanban_column_sources<_filtro_vendedor_id_fkey"
            columns: ["filtro_vendedor_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>usuarios<"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CRM-multi-empresas>kanban_column_sources<_filtro_vendedor_id_fkey"
            columns: ["filtro_vendedor_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>vendor_performance_stats<"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      "CRM-multi-empresas>kanban_columns<": {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          id: string
          nome: string
          ordem: number
          pagina_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome: string
          ordem?: number
          pagina_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome?: string
          ordem?: number
          pagina_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "CRM-multi-empresas>kanban_columns<_pagina_id_fkey"
            columns: ["pagina_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>kanban_pages<"
            referencedColumns: ["id"]
          },
        ]
      }
      "CRM-multi-empresas>kanban_pages<": {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          id: string
          nome: string
          ordem: number
          slug: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome: string
          ordem?: number
          slug: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome?: string
          ordem?: number
          slug?: string
        }
        Relationships: []
      }
      "CRM-multi-empresas>lead_lembretes<": {
        Row: {
          anexos: Json
          atualizado_em: string
          concluido_em: string | null
          criado_em: string
          criado_por: string
          data_hora: string
          descricao: string | null
          id: string
          lead_id: number
          status: string
          titular_id: string
          titular_ids: string[]
          titulo: string
          cor: string | null
        }
        Insert: {
          anexos?: Json
          atualizado_em?: string
          concluido_em?: string | null
          criado_em?: string
          criado_por: string
          data_hora: string
          descricao?: string | null
          id?: string
          lead_id: number
          status?: string
          titular_id: string
          titular_ids?: string[]
          titulo: string
          cor?: string | null
        }
        Update: {
          anexos?: Json
          atualizado_em?: string
          concluido_em?: string | null
          criado_em?: string
          criado_por?: string
          data_hora?: string
          descricao?: string | null
          id?: string
          lead_id?: number
          status?: string
          titular_id?: string
          titular_ids?: string[]
          titulo?: string
          cor?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "CRM-multi-empresas>lead_lembretes<_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>leads<"
            referencedColumns: ["id"]
          },
        ]
      }
      "CRM-multi-empresas>lead_origins<": {
        Row: {
          criado_em: string
          id: string
          is_default: boolean | null
          nome: string
        }
        Insert: {
          criado_em?: string
          id?: string
          is_default?: boolean | null
          nome: string
        }
        Update: {
          criado_em?: string
          id?: string
          is_default?: boolean | null
          nome?: string
        }
        Relationships: []
      }
      "CRM-multi-empresas>leads<": {
        Row: {
          atualizado_em: string
          criado_em: string
          dar_atencao: boolean | null
          data_chegada: string
          email: string | null
          empresa: string | null
          id: number
          motivo_perda: string | null
          nome: string
          observacoes: string | null
          ordem_manual: number | null
          origem: string | null
          regiao: string | null
          regiao_tabela: string | null
          status: string
          telefone: string | null
          valor_negocio: number
          valor_orcamento: number
          venda_realizada_em: string | null
          vendedor_responsavel_id: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          dar_atencao?: boolean | null
          data_chegada?: string
          email?: string | null
          empresa?: string | null
          id?: number
          motivo_perda?: string | null
          nome: string
          observacoes?: string | null
          ordem_manual?: number | null
          origem?: string | null
          regiao?: string | null
          regiao_tabela?: string | null
          status?: string
          telefone?: string | null
          valor_negocio?: number
          valor_orcamento?: number
          venda_realizada_em?: string | null
          vendedor_responsavel_id?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          dar_atencao?: boolean | null
          data_chegada?: string
          email?: string | null
          empresa?: string | null
          id?: number
          motivo_perda?: string | null
          nome?: string
          observacoes?: string | null
          ordem_manual?: number | null
          origem?: string | null
          regiao?: string | null
          regiao_tabela?: string | null
          status?: string
          telefone?: string | null
          valor_negocio?: number
          valor_orcamento?: number
          venda_realizada_em?: string | null
          vendedor_responsavel_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "CRM-multi-empresas>leads<_vendedor_responsavel_id_fkey"
            columns: ["vendedor_responsavel_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>usuarios<"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CRM-multi-empresas>leads<_vendedor_responsavel_id_fkey"
            columns: ["vendedor_responsavel_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>vendor_performance_stats<"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      "CRM-multi-empresas>notifications<": {
        Row: {
          created_at: string
          id: string
          lead_id: number | null
          message: string
          notification_type: string
          read: boolean
          user_id: string
          vendor_name: string
        }
        Insert: {
          created_at?: string
          id?: string
          lead_id?: number | null
          message: string
          notification_type: string
          read?: boolean
          user_id: string
          vendor_name: string
        }
        Update: {
          created_at?: string
          id?: string
          lead_id?: number | null
          message?: string
          notification_type?: string
          read?: boolean
          user_id?: string
          vendor_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "CRM-multi-empresas>notifications<_lead_id_fkey"
            columns: ["lead_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>leads<"
            referencedColumns: ["id"]
          },
        ]
      }
      "CRM-multi-empresas>pipeline_custom_stages<": {
        Row: {
          ativo: boolean
          atualizado_em: string
          cor: string | null
          criado_em: string
          id: string
          is_default: boolean
          nome: string
          ordem: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          cor?: string | null
          criado_em?: string
          id?: string
          is_default?: boolean
          nome: string
          ordem?: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          cor?: string | null
          criado_em?: string
          id?: string
          is_default?: boolean
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      "CRM-multi-empresas>pipeline_daily_metrics<": {
        Row: {
          aulas_mes: number
          aulas_mes_crescimento_pct: number
          aulas_mes_tendencia_tipo: string
          aulas_mes_total: number
          aulas_periodo: number
          created_at: string
          data_referencia: string
          id: number
          leads_hoje: number
          leads_mes: number
          leads_periodo: number
          leads_periodo_filtrado: number
          media_30d: number
          media_anterior_15d: number
          media_atual_15d: number
          taxa_conversao_mes: number
          taxa_conversao_periodo: number
          tendencia_percentual_15d: number
          tendencia_tipo: string
          updated_at: string
        }
        Insert: {
          aulas_mes?: number
          aulas_mes_crescimento_pct?: number
          aulas_mes_tendencia_tipo?: string
          aulas_mes_total?: number
          aulas_periodo?: number
          created_at?: string
          data_referencia: string
          id?: number
          leads_hoje?: number
          leads_mes?: number
          leads_periodo?: number
          leads_periodo_filtrado?: number
          media_30d?: number
          media_anterior_15d?: number
          media_atual_15d?: number
          taxa_conversao_mes?: number
          taxa_conversao_periodo?: number
          tendencia_percentual_15d?: number
          tendencia_tipo?: string
          updated_at?: string
        }
        Update: {
          aulas_mes?: number
          aulas_mes_crescimento_pct?: number
          aulas_mes_tendencia_tipo?: string
          aulas_mes_total?: number
          aulas_periodo?: number
          created_at?: string
          data_referencia?: string
          id?: number
          leads_hoje?: number
          leads_mes?: number
          leads_periodo?: number
          leads_periodo_filtrado?: number
          media_30d?: number
          media_anterior_15d?: number
          media_atual_15d?: number
          taxa_conversao_mes?: number
          taxa_conversao_periodo?: number
          tendencia_percentual_15d?: number
          tendencia_tipo?: string
          updated_at?: string
        }
        Relationships: []
      }
      "CRM-multi-empresas>pipeline_time_config<": {
        Row: {
          ativo: boolean
          atualizado_em: string
          cor: string
          criado_em: string
          id: string
          nome_legenda: string
          ordem: number
          tempo_minutos: number
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          cor: string
          criado_em?: string
          id?: string
          nome_legenda: string
          ordem?: number
          tempo_minutos: number
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          cor?: string
          criado_em?: string
          id?: string
          nome_legenda?: string
          ordem?: number
          tempo_minutos?: number
        }
        Relationships: []
      }
      "CRM-multi-empresas>ponto_registros<": {
        Row: {
          data_hora: string
          endereco: string | null
          id: string
          latitude: number | null
          longitude: number | null
          tipo: string
          user_id: string
        }
        Insert: {
          data_hora?: string
          endereco?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          tipo: string
          user_id: string
        }
        Update: {
          data_hora?: string
          endereco?: string | null
          id?: string
          latitude?: number | null
          longitude?: number | null
          tipo?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "CRM-multi-empresas>ponto_registros<_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>usuarios<"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CRM-multi-empresas>ponto_registros<_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>vendor_performance_stats<"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      "CRM-multi-empresas>presence_sessions<": {
        Row: {
          ended_at: string | null
          endereco: string | null
          id: string
          last_heartbeat_at: string
          latitude: number | null
          longitude: number | null
          started_at: string
          user_id: string
        }
        Insert: {
          ended_at?: string | null
          endereco?: string | null
          id?: string
          last_heartbeat_at?: string
          latitude?: number | null
          longitude?: number | null
          started_at?: string
          user_id: string
        }
        Update: {
          ended_at?: string | null
          endereco?: string | null
          id?: string
          last_heartbeat_at?: string
          latitude?: number | null
          longitude?: number | null
          started_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "CRM-multi-empresas>presence_sessions<_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>usuarios<"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CRM-multi-empresas>presence_sessions<_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>vendor_performance_stats<"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      "CRM-multi-empresas>relatorios_reunioes<": {
        Row: {
          criado_em: string
          id: string
          relatorio_reunioes: string | null
          reuniao_id: string | null
          telefone: string | null
          uid_aluno: string | null
        }
        Insert: {
          criado_em?: string
          id?: string
          relatorio_reunioes?: string | null
          reuniao_id?: string | null
          telefone?: string | null
          uid_aluno?: string | null
        }
        Update: {
          criado_em?: string
          id?: string
          relatorio_reunioes?: string | null
          reuniao_id?: string | null
          telefone?: string | null
          uid_aluno?: string | null
        }
        Relationships: []
      }
      "CRM-multi-empresas>tabela_origem_config<": {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          id: string
          nome_amigavel: string
          nome_tabela: string
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          nome_amigavel: string
          nome_tabela: string
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          nome_amigavel?: string
          nome_tabela?: string
        }
        Relationships: []
      }
      "CRM-multi-empresas>user_permissions<": {
        Row: {
          action: string
          allowed: boolean
          criado_em: string | null
          id: string
          resource: string
          role: Database["public"]["Enums"]["selletos_crm_app_role"]
        }
        Insert: {
          action: string
          allowed?: boolean
          criado_em?: string | null
          id?: string
          resource: string
          role: Database["public"]["Enums"]["selletos_crm_app_role"]
        }
        Update: {
          action?: string
          allowed?: boolean
          criado_em?: string | null
          id?: string
          resource?: string
          role?: Database["public"]["Enums"]["selletos_crm_app_role"]
        }
        Relationships: []
      }
      "CRM-multi-empresas>user_roles<": {
        Row: {
          criado_em: string
          id: string
          role: Database["public"]["Enums"]["selletos_crm_app_role"]
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          role?: Database["public"]["Enums"]["selletos_crm_app_role"]
          user_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          role?: Database["public"]["Enums"]["selletos_crm_app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "CRM-multi-empresas>user_roles<_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "CRM-multi-empresas>usuarios<"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "CRM-multi-empresas>user_roles<_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "CRM-multi-empresas>vendor_performance_stats<"
            referencedColumns: ["vendedor_id"]
          },
        ]
      }
      "CRM-multi-empresas>uso_config<": {
        Row: {
          ausencia_alerta_minutos: number
          id: string
          inatividade_minutos: number
          repetir_alerta_minutos: number
        }
        Insert: {
          ausencia_alerta_minutos?: number
          id?: string
          inatividade_minutos?: number
          repetir_alerta_minutos?: number
        }
        Update: {
          ausencia_alerta_minutos?: number
          id?: string
          inatividade_minutos?: number
          repetir_alerta_minutos?: number
        }
        Relationships: []
      }
      "CRM-multi-empresas>usuarios<": {
        Row: {
          atualizado_em: string
          avatar_url: string | null
          criado_em: string
          email: string | null
          horario_acesso_fim: string | null
          horario_acesso_inicio: string | null
          id: string
          nome: string
          status_convite: string
          telefone: string | null
        }
        Insert: {
          atualizado_em?: string
          avatar_url?: string | null
          criado_em?: string
          email?: string | null
          horario_acesso_fim?: string | null
          horario_acesso_inicio?: string | null
          id?: string
          nome: string
          status_convite?: string
          telefone?: string | null
        }
        Update: {
          atualizado_em?: string
          avatar_url?: string | null
          criado_em?: string
          email?: string | null
          horario_acesso_fim?: string | null
          horario_acesso_inicio?: string | null
          id?: string
          nome?: string
          status_convite?: string
          telefone?: string | null
        }
        Relationships: []
      }
      "CRM-multi-empresas>webhooks_api<": {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          descricao: string | null
          id: string
          nome: string
          tabela_origem: string | null
          tipo: string
          url: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome: string
          tabela_origem?: string | null
          tipo: string
          url: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          tabela_origem?: string | null
          tipo?: string
          url?: string
        }
        Relationships: []
      }
      crm_multiempresas_ui_preferences: {
        Row: {
          created_at: string
          disable_message_notifications_popup: boolean
          floating_agenda_side: string
          floating_agenda_zoom: number
          hide_floating_popups: boolean
          minimize_lead_sinalizacoes_popup: boolean
          minimize_lead_whatsapp_history: boolean
          page_zoom: number
          pipeline_indicators: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          disable_message_notifications_popup?: boolean
          floating_agenda_side?: string
          floating_agenda_zoom?: number
          hide_floating_popups?: boolean
          minimize_lead_sinalizacoes_popup?: boolean
          minimize_lead_whatsapp_history?: boolean
          page_zoom?: number
          pipeline_indicators?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          disable_message_notifications_popup?: boolean
          floating_agenda_side?: string
          floating_agenda_zoom?: number
          hide_floating_popups?: boolean
          minimize_lead_sinalizacoes_popup?: boolean
          minimize_lead_whatsapp_history?: boolean
          page_zoom?: number
          pipeline_indicators?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      documents_flutterflow: {
        Row: {
          content: string
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content: string
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      documents_lovable: {
        Row: {
          content: string
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content: string
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      documents_n8n: {
        Row: {
          content: string
          embedding: string | null
          id: number
          metadata: Json | null
        }
        Insert: {
          content: string
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Update: {
          content?: string
          embedding?: string | null
          id?: number
          metadata?: Json | null
        }
        Relationships: []
      }
      "E-commerce-Seletos-caneca_admin_roles": {
        Row: {
          criado_em: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          role?: string
          user_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      "E-commerce-Seletos-caneca_categorias": {
        Row: {
          ativo: boolean
          atualizado_em: string
          carrossel_displays: Json | null
          carrossel_urls: Json | null
          criado_em: string
          descricao: string | null
          exibir_na_home: boolean
          id: string
          imagem_display: Json | null
          imagem_url: string | null
          nome: string
          ordem: number
          video_url: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          carrossel_displays?: Json | null
          carrossel_urls?: Json | null
          criado_em?: string
          descricao?: string | null
          exibir_na_home?: boolean
          id?: string
          imagem_display?: Json | null
          imagem_url?: string | null
          nome: string
          ordem?: number
          video_url?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          carrossel_displays?: Json | null
          carrossel_urls?: Json | null
          criado_em?: string
          descricao?: string | null
          exibir_na_home?: boolean
          id?: string
          imagem_display?: Json | null
          imagem_url?: string | null
          nome?: string
          ordem?: number
          video_url?: string | null
        }
        Relationships: []
      }
      "E-commerce-Seletos-caneca_midias": {
        Row: {
          criado_em: string
          id: string
          mime_type: string | null
          nome: string
          pasta: string | null
          tamanho_bytes: number | null
          tipo: string
          url: string
        }
        Insert: {
          criado_em?: string
          id?: string
          mime_type?: string | null
          nome: string
          pasta?: string | null
          tamanho_bytes?: number | null
          tipo?: string
          url: string
        }
        Update: {
          criado_em?: string
          id?: string
          mime_type?: string | null
          nome?: string
          pasta?: string | null
          tamanho_bytes?: number | null
          tipo?: string
          url?: string
        }
        Relationships: []
      }
      "E-commerce-Seletos-caneca_pagina_secoes": {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          imagem_url: string | null
          link: string | null
          ordem: number
          pagina_slug: string
          payload: Json | null
          secao_chave: string
          subtitulo: string | null
          titulo: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          imagem_url?: string | null
          link?: string | null
          ordem?: number
          pagina_slug: string
          payload?: Json | null
          secao_chave: string
          subtitulo?: string | null
          titulo?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          imagem_url?: string | null
          link?: string | null
          ordem?: number
          pagina_slug?: string
          payload?: Json | null
          secao_chave?: string
          subtitulo?: string | null
          titulo?: string | null
        }
        Relationships: []
      }
      "E-commerce-Seletos-caneca_pedido_itens": {
        Row: {
          acabamento: string | null
          criado_em: string
          id: string
          pedido_id: string
          personalizacao: string | null
          preco_unitario: number
          produto_id: string | null
          produto_nome: string
          quantidade: number
          tamanho: string | null
        }
        Insert: {
          acabamento?: string | null
          criado_em?: string
          id?: string
          pedido_id: string
          personalizacao?: string | null
          preco_unitario: number
          produto_id?: string | null
          produto_nome: string
          quantidade?: number
          tamanho?: string | null
        }
        Update: {
          acabamento?: string | null
          criado_em?: string
          id?: string
          pedido_id?: string
          personalizacao?: string | null
          preco_unitario?: number
          produto_id?: string | null
          produto_nome?: string
          quantidade?: number
          tamanho?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "E-commerce-Seletos-caneca_pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "E-commerce-Seletos-caneca_pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "E-commerce-Seletos-caneca_pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "E-commerce-Seletos-caneca_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      "E-commerce-Seletos-caneca_pedidos": {
        Row: {
          atualizado_em: string
          cliente_email: string | null
          cliente_nome: string
          cliente_telefone: string | null
          criado_em: string
          embalagem_presente: boolean
          endereco_entrega: Json | null
          frete: number
          id: string
          metodo_pagamento: string | null
          observacoes: string | null
          status: string
          subtotal: number
          total: number
          user_id: string | null
          zona_entrega: string | null
        }
        Insert: {
          atualizado_em?: string
          cliente_email?: string | null
          cliente_nome: string
          cliente_telefone?: string | null
          criado_em?: string
          embalagem_presente?: boolean
          endereco_entrega?: Json | null
          frete?: number
          id?: string
          metodo_pagamento?: string | null
          observacoes?: string | null
          status?: string
          subtotal?: number
          total?: number
          user_id?: string | null
          zona_entrega?: string | null
        }
        Update: {
          atualizado_em?: string
          cliente_email?: string | null
          cliente_nome?: string
          cliente_telefone?: string | null
          criado_em?: string
          embalagem_presente?: boolean
          endereco_entrega?: Json | null
          frete?: number
          id?: string
          metodo_pagamento?: string | null
          observacoes?: string | null
          status?: string
          subtotal?: number
          total?: number
          user_id?: string | null
          zona_entrega?: string | null
        }
        Relationships: []
      }
      "E-commerce-Seletos-caneca_produto_midias": {
        Row: {
          id: string
          midia_id: string
          ordem: number
          principal: boolean
          produto_id: string
        }
        Insert: {
          id?: string
          midia_id: string
          ordem?: number
          principal?: boolean
          produto_id: string
        }
        Update: {
          id?: string
          midia_id?: string
          ordem?: number
          principal?: boolean
          produto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "E-commerce-Seletos-caneca_produto_midias_midia_id_fkey"
            columns: ["midia_id"]
            isOneToOne: false
            referencedRelation: "E-commerce-Seletos-caneca_midias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "E-commerce-Seletos-caneca_produto_midias_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "E-commerce-Seletos-caneca_produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      "E-commerce-Seletos-caneca_produtos": {
        Row: {
          acabamentos: string[] | null
          ativo: boolean
          atualizado_em: string
          badge: string | null
          caracteristicas: Json | null
          categoria_id: string | null
          criado_em: string
          descricao: string | null
          destaque: boolean
          detalhes: string | null
          estoque: number
          id: string
          nome: string
          permite_personalizacao: boolean
          preco: number
          preco_atacado: number | null
          tamanhos: string[] | null
        }
        Insert: {
          acabamentos?: string[] | null
          ativo?: boolean
          atualizado_em?: string
          badge?: string | null
          caracteristicas?: Json | null
          categoria_id?: string | null
          criado_em?: string
          descricao?: string | null
          destaque?: boolean
          detalhes?: string | null
          estoque?: number
          id?: string
          nome: string
          permite_personalizacao?: boolean
          preco?: number
          preco_atacado?: number | null
          tamanhos?: string[] | null
        }
        Update: {
          acabamentos?: string[] | null
          ativo?: boolean
          atualizado_em?: string
          badge?: string | null
          caracteristicas?: Json | null
          categoria_id?: string | null
          criado_em?: string
          descricao?: string | null
          destaque?: boolean
          detalhes?: string | null
          estoque?: number
          id?: string
          nome?: string
          permite_personalizacao?: boolean
          preco?: number
          preco_atacado?: number | null
          tamanhos?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "E-commerce-Seletos-caneca_produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "E-commerce-Seletos-caneca_categorias"
            referencedColumns: ["id"]
          },
        ]
      }
      general: {
        Row: {
          created_at: string
          id: number
          index_attendant: number | null
        }
        Insert: {
          created_at?: string
          id?: number
          index_attendant?: number | null
        }
        Update: {
          created_at?: string
          id?: number
          index_attendant?: number | null
        }
        Relationships: []
      }
      instances: {
        Row: {
          apykey: string | null
          created_at: string
          id: number
          name: string | null
          name_fantasy: string | null
          primeira_url: string | null
          primeiro_webhook: boolean | null
          segunda_url: string | null
          segundo_webhook: boolean | null
          status: string | null
          token: string | null
          user_auth: string | null
        }
        Insert: {
          apykey?: string | null
          created_at?: string
          id?: number
          name?: string | null
          name_fantasy?: string | null
          primeira_url?: string | null
          primeiro_webhook?: boolean | null
          segunda_url?: string | null
          segundo_webhook?: boolean | null
          status?: string | null
          token?: string | null
          user_auth?: string | null
        }
        Update: {
          apykey?: string | null
          created_at?: string
          id?: number
          name?: string | null
          name_fantasy?: string | null
          primeira_url?: string | null
          primeiro_webhook?: boolean | null
          segunda_url?: string | null
          segundo_webhook?: boolean | null
          status?: string | null
          token?: string | null
          user_auth?: string | null
        }
        Relationships: []
      }
      landing_page_content: {
        Row: {
          atualizado_em: string | null
          content: Json
          id: string
          page_slug: string
          section: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          atualizado_em?: string | null
          content?: Json
          id?: string
          page_slug?: string
          section: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          atualizado_em?: string | null
          content?: Json
          id?: string
          page_slug?: string
          section?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      Leads_proforco_betim: {
        Row: {
          coluna_id: string | null
          created_at: string
          email: string | null
          followUp: string | null
          lead_id: number
          mensagem: string | null
          nome: string | null
          status: string | null
          telefone: string | null
          ultima_msg: string | null
        }
        Insert: {
          coluna_id?: string | null
          created_at?: string
          email?: string | null
          followUp?: string | null
          lead_id?: number
          mensagem?: string | null
          nome?: string | null
          status?: string | null
          telefone?: string | null
          ultima_msg?: string | null
        }
        Update: {
          coluna_id?: string | null
          created_at?: string
          email?: string | null
          followUp?: string | null
          lead_id?: number
          mensagem?: string | null
          nome?: string | null
          status?: string | null
          telefone?: string | null
          ultima_msg?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Leads_proforco_betim_coluna_id_fkey"
            columns: ["coluna_id"]
            isOneToOne: false
            referencedRelation: "apostila-proforco_colunas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_multiempresas_marketing_ai_webhook_config: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          descricao: string | null
          id: string
          webhook_id: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          webhook_id?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_multiempresas_marketing_ai_webhook_config_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>webhooks_api<"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_multiempresas_marketing_ai_agents: {
        Row: {
          id: string
          slug: string
          nome: string
          descricao: string | null
          system_prompt: string
          user_prompt_template: string
          model: string | null
          ativo: boolean
          ordem: number
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          slug: string
          nome: string
          descricao?: string | null
          system_prompt?: string
          user_prompt_template?: string
          model?: string | null
          ativo?: boolean
          ordem?: number
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          slug?: string
          nome?: string
          descricao?: string | null
          system_prompt?: string
          user_prompt_template?: string
          model?: string | null
          ativo?: boolean
          ordem?: number
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: []
      }
      crm_multiempresas_marketing_ai_personalities: {
        Row: {
          id: string
          nome: string
          descricao: string | null
          system_prompt: string
          user_prompt_template: string
          model: string | null
          ativo: boolean
          is_default: boolean
          ordem: number
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          nome: string
          descricao?: string | null
          system_prompt?: string
          user_prompt_template?: string
          model?: string | null
          ativo?: boolean
          is_default?: boolean
          ordem?: number
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          nome?: string
          descricao?: string | null
          system_prompt?: string
          user_prompt_template?: string
          model?: string | null
          ativo?: boolean
          is_default?: boolean
          ordem?: number
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: []
      }
      crm_multiempresas_marketing_ai_studio_config: {
        Row: {
          id: string
          ativo: boolean
          model_pesquisa: string
          model_copy: string
          criado_em: string
          atualizado_em: string
        }
        Insert: {
          id?: string
          ativo?: boolean
          model_pesquisa?: string
          model_copy?: string
          criado_em?: string
          atualizado_em?: string
        }
        Update: {
          id?: string
          ativo?: boolean
          model_pesquisa?: string
          model_copy?: string
          criado_em?: string
          atualizado_em?: string
        }
        Relationships: []
      }
      crm_multiempresas_marketing_ai_studio_secrets: {
        Row: {
          id: string
          config_id: string
          openai_api_key: string | null
          serp_api_key: string | null
          atualizado_em: string
        }
        Insert: {
          id?: string
          config_id: string
          openai_api_key?: string | null
          serp_api_key?: string | null
          atualizado_em?: string
        }
        Update: {
          id?: string
          config_id?: string
          openai_api_key?: string | null
          serp_api_key?: string | null
          atualizado_em?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_multiempresas_marketing_ai_studio_secrets_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: true
            referencedRelation: "crm_multiempresas_marketing_ai_studio_config"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_multiempresas_marketing_approval_notifications: {
        Row: {
          card_id: string
          card_titulo: string
          criado_em: string
          enviado_por: string | null
          id: string
          lida: boolean
        }
        Insert: {
          card_id: string
          card_titulo: string
          criado_em?: string
          enviado_por?: string | null
          id?: string
          lida?: boolean
        }
        Update: {
          card_id?: string
          card_titulo?: string
          criado_em?: string
          enviado_por?: string | null
          id?: string
          lida?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "crm_multiempresas_marketing_approval_notifications_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "crm_multiempresas_marketing_content_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_multiempresas_marketing_board_templates: {
        Row: {
          atualizado_em: string
          board_data: Json
          criado_em: string
          id: string
          nome: string
          tipo: string
        }
        Insert: {
          atualizado_em?: string
          board_data?: Json
          criado_em?: string
          id?: string
          nome: string
          tipo?: string
        }
        Update: {
          atualizado_em?: string
          board_data?: Json
          criado_em?: string
          id?: string
          nome?: string
          tipo?: string
        }
        Relationships: []
      }
      crm_multiempresas_marketing_central_planning: {
        Row: {
          ativo: boolean
          atualizado_em: string
          conteudo: string
          criado_em: string
          id: string
          imagem_url: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          conteudo: string
          criado_em?: string
          id?: string
          imagem_url?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          conteudo?: string
          criado_em?: string
          id?: string
          imagem_url?: string | null
        }
        Relationships: []
      }
      crm_multiempresas_marketing_columns: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      crm_multiempresas_marketing_content_cards: {
        Row: {
          atualizado_em: string
          column_id: string
          criado_em: string
          funnel_stage_id: string | null
          id: string
          ordem: number
          performando: boolean
          planning_node_id: string | null
          product_id: string | null
          script_copy: string | null
          titulo: string
          traffic_sources: string[] | null
          urgente: boolean
        }
        Insert: {
          atualizado_em?: string
          column_id: string
          criado_em?: string
          funnel_stage_id?: string | null
          id?: string
          ordem?: number
          performando?: boolean
          planning_node_id?: string | null
          product_id?: string | null
          script_copy?: string | null
          titulo: string
          traffic_sources?: string[] | null
          urgente?: boolean
        }
        Update: {
          atualizado_em?: string
          column_id?: string
          criado_em?: string
          funnel_stage_id?: string | null
          id?: string
          ordem?: number
          performando?: boolean
          planning_node_id?: string | null
          product_id?: string | null
          script_copy?: string | null
          titulo?: string
          traffic_sources?: string[] | null
          urgente?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "fk_planning_node"
            columns: ["planning_node_id"]
            isOneToOne: false
            referencedRelation: "crm_multiempresas_marketing_planning_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_multiempresas_marketing_content_cards_column_id_fkey"
            columns: ["column_id"]
            isOneToOne: false
            referencedRelation: "crm_multiempresas_marketing_columns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_multiempresas_marketing_content_cards_funnel_stage_id_fkey"
            columns: ["funnel_stage_id"]
            isOneToOne: false
            referencedRelation: "crm_multiempresas_marketing_funnel_stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "crm_multiempresas_marketing_content_cards_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "crm_multiempresas_marketing_products"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_multiempresas_marketing_funnel_stages: {
        Row: {
          criado_em: string
          id: string
          nome: string
          ordem: number
        }
        Insert: {
          criado_em?: string
          id?: string
          nome: string
          ordem?: number
        }
        Update: {
          criado_em?: string
          id?: string
          nome?: string
          ordem?: number
        }
        Relationships: []
      }
      crm_multiempresas_marketing_media_folders: {
        Row: {
          atualizado_em: string
          criado_em: string
          descricao: string | null
          id: string
          nome: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          nome: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      crm_multiempresas_marketing_medias: {
        Row: {
          atualizado_em: string
          criado_em: string
          file_name: string
          file_size: number | null
          file_url: string
          folder_id: string | null
          id: string
          lead_id: number | null
          mime_type: string | null
          tipo: string
          titulo: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          file_name: string
          file_size?: number | null
          file_url: string
          folder_id?: string | null
          id?: string
          lead_id?: number | null
          mime_type?: string | null
          tipo: string
          titulo: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          file_name?: string
          file_size?: number | null
          file_url?: string
          folder_id?: string | null
          id?: string
          lead_id?: number | null
          mime_type?: string | null
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_multiempresas_marketing_medias_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "crm_multiempresas_marketing_media_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_multiempresas_marketing_planning_drawings: {
        Row: {
          cor: string
          criado_em: string
          id: string
          path_data: string
          stroke_width: number
        }
        Insert: {
          cor?: string
          criado_em?: string
          id?: string
          path_data: string
          stroke_width?: number
        }
        Update: {
          cor?: string
          criado_em?: string
          id?: string
          path_data?: string
          stroke_width?: number
        }
        Relationships: []
      }
      crm_multiempresas_marketing_planning_edges: {
        Row: {
          criado_em: string
          estilo: string | null
          id: string
          label: string | null
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Insert: {
          criado_em?: string
          estilo?: string | null
          id?: string
          label?: string | null
          source_id: string
          source_type: string
          target_id: string
          target_type: string
        }
        Update: {
          criado_em?: string
          estilo?: string | null
          id?: string
          label?: string | null
          source_id?: string
          source_type?: string
          target_id?: string
          target_type?: string
        }
        Relationships: []
      }
      crm_multiempresas_marketing_planning_files: {
        Row: {
          atualizado_em: string
          criado_em: string
          file_name: string
          file_type: string
          file_url: string
          height: number
          id: string
          position_x: number
          position_y: number
          width: number
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          file_name: string
          file_type: string
          file_url: string
          height?: number
          id?: string
          position_x?: number
          position_y?: number
          width?: number
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          file_name?: string
          file_type?: string
          file_url?: string
          height?: number
          id?: string
          position_x?: number
          position_y?: number
          width?: number
        }
        Relationships: []
      }
      crm_multiempresas_marketing_planning_nodes: {
        Row: {
          atualizado_em: string
          card_id: string | null
          classificacao: string | null
          conteudo: string | null
          criado_em: string
          enviado_producao: boolean
          id: string
          position_x: number
          position_y: number
          titulo: string
        }
        Insert: {
          atualizado_em?: string
          card_id?: string | null
          classificacao?: string | null
          conteudo?: string | null
          criado_em?: string
          enviado_producao?: boolean
          id?: string
          position_x?: number
          position_y?: number
          titulo: string
        }
        Update: {
          atualizado_em?: string
          card_id?: string | null
          classificacao?: string | null
          conteudo?: string | null
          criado_em?: string
          enviado_producao?: boolean
          id?: string
          position_x?: number
          position_y?: number
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_multiempresas_marketing_planning_nodes_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "crm_multiempresas_marketing_content_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_multiempresas_marketing_planning_shapes: {
        Row: {
          atualizado_em: string
          card_id: string | null
          cor: string | null
          criado_em: string
          enviado_producao: boolean
          height: number
          id: string
          position_x: number
          position_y: number
          texto: string | null
          tipo: string
          width: number
        }
        Insert: {
          atualizado_em?: string
          card_id?: string | null
          cor?: string | null
          criado_em?: string
          enviado_producao?: boolean
          height?: number
          id?: string
          position_x?: number
          position_y?: number
          texto?: string | null
          tipo: string
          width?: number
        }
        Update: {
          atualizado_em?: string
          card_id?: string | null
          cor?: string | null
          criado_em?: string
          enviado_producao?: boolean
          height?: number
          id?: string
          position_x?: number
          position_y?: number
          texto?: string | null
          tipo?: string
          width?: number
        }
        Relationships: [
          {
            foreignKeyName: "crm_multiempresas_marketing_planning_shapes_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "crm_multiempresas_marketing_content_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_multiempresas_marketing_products: {
        Row: {
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      crm_multiempresas_marketing_tasks: {
        Row: {
          atualizado_em: string
          concluido_em: string | null
          content_card_id: string | null
          criado_em: string
          criado_por: string | null
          data_agendada: string
          descricao: string | null
          destinatario_id: string
          hora_agendada: string | null
          id: string
          status: string
          tipo: string
          titulo: string
        }
        Insert: {
          atualizado_em?: string
          concluido_em?: string | null
          content_card_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data_agendada: string
          descricao?: string | null
          destinatario_id: string
          hora_agendada?: string | null
          id?: string
          status?: string
          tipo: string
          titulo: string
        }
        Update: {
          atualizado_em?: string
          concluido_em?: string | null
          content_card_id?: string | null
          criado_em?: string
          criado_por?: string | null
          data_agendada?: string
          descricao?: string | null
          destinatario_id?: string
          hora_agendada?: string | null
          id?: string
          status?: string
          tipo?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_multiempresas_marketing_tasks_content_card_id_fkey"
            columns: ["content_card_id"]
            isOneToOne: false
            referencedRelation: "crm_multiempresas_marketing_content_cards"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_multiempresas_marketing_traffic_sources: {
        Row: {
          criado_em: string
          id: string
          nome: string
        }
        Insert: {
          criado_em?: string
          id?: string
          nome: string
        }
        Update: {
          criado_em?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      crm_multiempresas_marketing_ugc_webhook_config: {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          webhook_id: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          webhook_id?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_multiempresas_marketing_ugc_webhook_config_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>webhooks_api<"
            referencedColumns: ["id"]
          },
        ]
      }
      member_entitlements: {
        Row: {
          created_at: string
          email_normalized: string
          id: string
          mp_payment_id: number
          product_slug: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email_normalized: string
          id?: string
          mp_payment_id: number
          product_slug?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email_normalized?: string
          id?: string
          mp_payment_id?: number
          product_slug?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "member_entitlements_product_slug_fkey"
            columns: ["product_slug"]
            isOneToOne: false
            referencedRelation: "member_products"
            referencedColumns: ["slug"]
          },
        ]
      }
      member_products: {
        Row: {
          created_at: string
          description: string | null
          download_url: string | null
          slug: string
          title: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          download_url?: string | null
          slug: string
          title: string
        }
        Update: {
          created_at?: string
          description?: string | null
          download_url?: string | null
          slug?: string
          title?: string
        }
        Relationships: []
      }
      crm_multiempresas_mkt_config_colunas: {
        Row: {
          atualizado_em: string
          criado_em: string
          editavel: boolean | null
          formula: string | null
          id: string
          is_system_data: boolean | null
          largura: number | null
          nome: string
          ordem: number | null
          sub_fonte_id: string
          system_data_filter: string | null
          system_data_type: string | null
          tipo: string
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          editavel?: boolean | null
          formula?: string | null
          id?: string
          is_system_data?: boolean | null
          largura?: number | null
          nome: string
          ordem?: number | null
          sub_fonte_id: string
          system_data_filter?: string | null
          system_data_type?: string | null
          tipo?: string
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          editavel?: boolean | null
          formula?: string | null
          id?: string
          is_system_data?: boolean | null
          largura?: number | null
          nome?: string
          ordem?: number | null
          sub_fonte_id?: string
          system_data_filter?: string | null
          system_data_type?: string | null
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "crm_multiempresas_mkt_config_colunas_sub_fonte_id_fkey"
            columns: ["sub_fonte_id"]
            isOneToOne: false
            referencedRelation: "crm_multiempresas_mkt_sub_fontes"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_multiempresas_mkt_fontes: {
        Row: {
          ativo: boolean | null
          atualizado_em: string
          cor: string | null
          criado_em: string
          icone: string | null
          id: string
          nome: string
          ordem: number | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string
          cor?: string | null
          criado_em?: string
          icone?: string | null
          id?: string
          nome: string
          ordem?: number | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string
          cor?: string | null
          criado_em?: string
          icone?: string | null
          id?: string
          nome?: string
          ordem?: number | null
        }
        Relationships: []
      }
      crm_multiempresas_mkt_gastos_config: {
        Row: {
          atualizado_em: string
          chave: string
          criado_em: string
          descricao: string | null
          id: string
          tipo: string | null
          valor: string | null
        }
        Insert: {
          atualizado_em?: string
          chave: string
          criado_em?: string
          descricao?: string | null
          id?: string
          tipo?: string | null
          valor?: string | null
        }
        Update: {
          atualizado_em?: string
          chave?: string
          criado_em?: string
          descricao?: string | null
          id?: string
          tipo?: string | null
          valor?: string | null
        }
        Relationships: []
      }
      crm_multiempresas_mkt_lancamentos: {
        Row: {
          atualizado_em: string
          coluna_id: string
          criado_em: string
          data: string
          id: string
          observacao: string | null
          valor_numerico: number | null
        }
        Insert: {
          atualizado_em?: string
          coluna_id: string
          criado_em?: string
          data: string
          id?: string
          observacao?: string | null
          valor_numerico?: number | null
        }
        Update: {
          atualizado_em?: string
          coluna_id?: string
          criado_em?: string
          data?: string
          id?: string
          observacao?: string | null
          valor_numerico?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_multiempresas_mkt_lancamentos_coluna_id_fkey"
            columns: ["coluna_id"]
            isOneToOne: false
            referencedRelation: "crm_multiempresas_mkt_config_colunas"
            referencedColumns: ["id"]
          },
        ]
      }
      crm_multiempresas_mkt_sub_fontes: {
        Row: {
          ativo: boolean | null
          atualizado_em: string
          criado_em: string
          descricao: string | null
          fonte_id: string
          id: string
          nome: string
          ordem: number | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          fonte_id: string
          id?: string
          nome: string
          ordem?: number | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string
          criado_em?: string
          descricao?: string | null
          fonte_id?: string
          id?: string
          nome?: string
          ordem?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_multiempresas_mkt_sub_fontes_fonte_id_fkey"
            columns: ["fonte_id"]
            isOneToOne: false
            referencedRelation: "crm_multiempresas_mkt_fontes"
            referencedColumns: ["id"]
          },
        ]
      }
      mp_checkout_payments: {
        Row: {
          created_at: string
          currency_id: string | null
          external_reference: string | null
          id: string
          mp_payment_id: number
          paid_at: string | null
          payer_email: string | null
          payment_method_id: string | null
          preference_id: string | null
          raw_last_notification: Json | null
          status: string
          status_detail: string | null
          transaction_amount: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency_id?: string | null
          external_reference?: string | null
          id?: string
          mp_payment_id: number
          paid_at?: string | null
          payer_email?: string | null
          payment_method_id?: string | null
          preference_id?: string | null
          raw_last_notification?: Json | null
          status?: string
          status_detail?: string | null
          transaction_amount?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency_id?: string | null
          external_reference?: string | null
          id?: string
          mp_payment_id?: number
          paid_at?: string | null
          payer_email?: string | null
          payment_method_id?: string | null
          preference_id?: string | null
          raw_last_notification?: Json | null
          status?: string
          status_detail?: string | null
          transaction_amount?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      n8n_chat_histories: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      n8n_chat_histories_proforco_orquestrador: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      n8n_chat_histories_proforco_saopaulo: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      n8n_chat_histories_proforcobetim: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      n8n_chat_historiesproforcobahia: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      n8n_chat_historiesProForcoBahia: {
        Row: {
          id: number
          message: Json
          session_id: string
        }
        Insert: {
          id?: number
          message: Json
          session_id: string
        }
        Update: {
          id?: number
          message?: Json
          session_id?: string
        }
        Relationships: []
      }
      negativacao_ia: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
        }
        Relationships: []
      }
      crm_multiempresas_negativacao_webhook_config: {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          id: string
          webhook_id: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          webhook_id?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "crm_multiempresas_negativacao_webhook_config_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "CRM-multi-empresas>webhooks_api<"
            referencedColumns: ["id"]
          },
        ]
      }
      "CRM-multi-empresas>negativacao_numeros<": {
        Row: {
          id: number
          numeroTelefone: number | null
        }
        Insert: {
          id?: number
          numeroTelefone?: number | null
        }
        Update: {
          id?: number
          numeroTelefone?: number | null
        }
        Relationships: []
      }
      plataforma_proforco_sistemadereuniao_chaves_secretas: {
        Row: {
          account_id: string | null
          active: boolean
          atualizado_em: string | null
          criado_em: string | null
          id: string
          meeting_sdk_key: string | null
          meeting_sdk_secret: string | null
          oauth_client_id: string | null
          oauth_client_secret: string | null
          provider_name: string
          sdk_key: string
          sdk_secret: string
          webhook_secret: string | null
        }
        Insert: {
          account_id?: string | null
          active?: boolean
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          meeting_sdk_key?: string | null
          meeting_sdk_secret?: string | null
          oauth_client_id?: string | null
          oauth_client_secret?: string | null
          provider_name?: string
          sdk_key: string
          sdk_secret: string
          webhook_secret?: string | null
        }
        Update: {
          account_id?: string | null
          active?: boolean
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          meeting_sdk_key?: string | null
          meeting_sdk_secret?: string | null
          oauth_client_id?: string | null
          oauth_client_secret?: string | null
          provider_name?: string
          sdk_key?: string
          sdk_secret?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      "plataforma-pro-forco-alteracoes_horario": {
        Row: {
          admin_id: string
          aula_agendada_id: string
          campo_alterado: string
          criado_em: string | null
          id: string
          valor_anterior: Json
          valor_novo: Json
        }
        Insert: {
          admin_id: string
          aula_agendada_id: string
          campo_alterado: string
          criado_em?: string | null
          id?: string
          valor_anterior: Json
          valor_novo: Json
        }
        Update: {
          admin_id?: string
          aula_agendada_id?: string
          campo_alterado?: string
          criado_em?: string | null
          id?: string
          valor_anterior?: Json
          valor_novo?: Json
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-alteracoes_horario_aula_agendada_id_fkey"
            columns: ["aula_agendada_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-aulas_agendadas"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-alunos": {
        Row: {
          ano_escolar: string | null
          aprovado: boolean | null
          atualizado_em: string | null
          cpf: string | null
          criado_em: string | null
          data_inicio: string
          dia_referencia: number
          email: string | null
          id: string
          idade: number | null
          modalidade: string
          nome: string
          nome_responsavel: string
          observacao_plano: string | null
          observacoes_gerais: string | null
          plano_sugerido_id: string | null
          solicitacao_id: string | null
          status: string
          sugestao_dia_pagamento: number | null
          telefone: string | null
          user_id: string | null
        }
        Insert: {
          ano_escolar?: string | null
          aprovado?: boolean | null
          atualizado_em?: string | null
          cpf?: string | null
          criado_em?: string | null
          data_inicio: string
          dia_referencia: number
          email?: string | null
          id?: string
          idade?: number | null
          modalidade?: string
          nome: string
          nome_responsavel: string
          observacao_plano?: string | null
          observacoes_gerais?: string | null
          plano_sugerido_id?: string | null
          solicitacao_id?: string | null
          status?: string
          sugestao_dia_pagamento?: number | null
          telefone?: string | null
          user_id?: string | null
        }
        Update: {
          ano_escolar?: string | null
          aprovado?: boolean | null
          atualizado_em?: string | null
          cpf?: string | null
          criado_em?: string | null
          data_inicio?: string
          dia_referencia?: number
          email?: string | null
          id?: string
          idade?: number | null
          modalidade?: string
          nome?: string
          nome_responsavel?: string
          observacao_plano?: string | null
          observacoes_gerais?: string | null
          plano_sugerido_id?: string | null
          solicitacao_id?: string | null
          status?: string
          sugestao_dia_pagamento?: number | null
          telefone?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-alunos_plano_sugerido_id_fkey"
            columns: ["plano_sugerido_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-fin_planos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-alunos_solicitacao_id_fkey"
            columns: ["solicitacao_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-solicitacoes_cadastro"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-anotacoes_aulas": {
        Row: {
          aluno_id: string
          anotacao: string
          criado_em: string | null
          id: string
          materia_id: string
          professor_id: string
          registro_aula_id: string
        }
        Insert: {
          aluno_id: string
          anotacao: string
          criado_em?: string | null
          id?: string
          materia_id: string
          professor_id: string
          registro_aula_id: string
        }
        Update: {
          aluno_id?: string
          anotacao?: string
          criado_em?: string | null
          id?: string
          materia_id?: string
          professor_id?: string
          registro_aula_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-anotacoes_aulas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-anotacoes_aulas_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-materias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-anotacoes_aulas_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-professores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-anotacoes_aulas_registro_aula_id_fkey"
            columns: ["registro_aula_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-registros_aulas"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-atividades": {
        Row: {
          aluno_id: string
          atualizado_em: string | null
          conteudo_texto: string | null
          criado_em: string | null
          data_criacao: string | null
          data_entrega: string | null
          enviado_por_id: string
          enviado_por_tipo: string
          id: string
          materia_id: string | null
          status: string | null
          titulo: string
        }
        Insert: {
          aluno_id: string
          atualizado_em?: string | null
          conteudo_texto?: string | null
          criado_em?: string | null
          data_criacao?: string | null
          data_entrega?: string | null
          enviado_por_id: string
          enviado_por_tipo: string
          id?: string
          materia_id?: string | null
          status?: string | null
          titulo: string
        }
        Update: {
          aluno_id?: string
          atualizado_em?: string | null
          conteudo_texto?: string | null
          criado_em?: string | null
          data_criacao?: string | null
          data_entrega?: string | null
          enviado_por_id?: string
          enviado_por_tipo?: string
          id?: string
          materia_id?: string | null
          status?: string | null
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-atividades_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-atividades_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-materias"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-atividades_arquivos": {
        Row: {
          arquivo_nome: string
          arquivo_tamanho: number | null
          arquivo_tipo: string
          arquivo_url: string
          atividade_id: string
          criado_em: string | null
          id: string
        }
        Insert: {
          arquivo_nome: string
          arquivo_tamanho?: number | null
          arquivo_tipo: string
          arquivo_url: string
          atividade_id: string
          criado_em?: string | null
          id?: string
        }
        Update: {
          arquivo_nome?: string
          arquivo_tamanho?: number | null
          arquivo_tipo?: string
          arquivo_url?: string
          atividade_id?: string
          criado_em?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-atividades_arquivos_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-atividades"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-atividades_comentarios": {
        Row: {
          atividade_id: string
          atualizado_em: string | null
          comentario: string
          criado_em: string | null
          id: string
          usuario_id: string
        }
        Insert: {
          atividade_id: string
          atualizado_em?: string | null
          comentario: string
          criado_em?: string | null
          id?: string
          usuario_id: string
        }
        Update: {
          atividade_id?: string
          atualizado_em?: string | null
          comentario?: string
          criado_em?: string | null
          id?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-atividades_comentarios_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-atividades"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-aulas_agendadas": {
        Row: {
          aluno_id: string
          ativo: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          data_fim: string | null
          data_inicio: string
          datas_excluidas: Json | null
          dia_semana: number
          duracao_minutos: number
          hora_inicio: string
          id: string
          materia_id: string
          professor_id: string
        }
        Insert: {
          aluno_id: string
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          data_fim?: string | null
          data_inicio: string
          datas_excluidas?: Json | null
          dia_semana: number
          duracao_minutos: number
          hora_inicio: string
          id?: string
          materia_id: string
          professor_id: string
        }
        Update: {
          aluno_id?: string
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          data_fim?: string | null
          data_inicio?: string
          datas_excluidas?: Json | null
          dia_semana?: number
          duracao_minutos?: number
          hora_inicio?: string
          id?: string
          materia_id?: string
          professor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-aulas_agendadas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-aulas_agendadas_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-materias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-aulas_agendadas_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-professores"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-avisos_alunos": {
        Row: {
          aluno_id: string
          atualizado_em: string | null
          atualizado_por: string | null
          conteudo: string
          criado_em: string | null
          criado_por: string | null
          id: string
        }
        Insert: {
          aluno_id: string
          atualizado_em?: string | null
          atualizado_por?: string | null
          conteudo?: string
          criado_em?: string | null
          criado_por?: string | null
          id?: string
        }
        Update: {
          aluno_id?: string
          atualizado_em?: string | null
          atualizado_por?: string | null
          conteudo?: string
          criado_em?: string | null
          criado_por?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-avisos_alunos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: true
            referencedRelation: "plataforma-pro-forco-alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-avisos_global": {
        Row: {
          atualizado_em: string | null
          atualizado_por: string | null
          conteudo: string
          criado_em: string | null
          criado_por: string | null
          id: string
        }
        Insert: {
          atualizado_em?: string | null
          atualizado_por?: string | null
          conteudo?: string
          criado_em?: string | null
          criado_por?: string | null
          id?: string
        }
        Update: {
          atualizado_em?: string | null
          atualizado_por?: string | null
          conteudo?: string
          criado_em?: string | null
          criado_por?: string | null
          id?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-avisos_professores": {
        Row: {
          atualizado_em: string | null
          atualizado_por: string | null
          conteudo: string
          criado_em: string | null
          criado_por: string | null
          id: string
          professor_id: string
        }
        Insert: {
          atualizado_em?: string | null
          atualizado_por?: string | null
          conteudo?: string
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          professor_id: string
        }
        Update: {
          atualizado_em?: string | null
          atualizado_por?: string | null
          conteudo?: string
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          professor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-avisos_professores_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: true
            referencedRelation: "plataforma-pro-forco-professores"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-avisos_professores_global": {
        Row: {
          atualizado_em: string | null
          atualizado_por: string | null
          conteudo: string
          criado_em: string | null
          criado_por: string | null
          id: string
        }
        Insert: {
          atualizado_em?: string | null
          atualizado_por?: string | null
          conteudo?: string
          criado_em?: string | null
          criado_por?: string | null
          id?: string
        }
        Update: {
          atualizado_em?: string | null
          atualizado_por?: string | null
          conteudo?: string
          criado_em?: string | null
          criado_por?: string | null
          id?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-botao_pagina_alunos": {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          id: string
          link_botao: string
          nome_botao: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          link_botao: string
          nome_botao: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          link_botao?: string
          nome_botao?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-caixa_destinatarios": {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          dados_bancarios: Json | null
          id: string
          nome: string
          observacoes: string | null
          tipo: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          dados_bancarios?: Json | null
          id?: string
          nome: string
          observacoes?: string | null
          tipo?: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          dados_bancarios?: Json | null
          id?: string
          nome?: string
          observacoes?: string | null
          tipo?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-caixa_movimentacoes": {
        Row: {
          ano_referencia: number
          comprovante_url: string | null
          criado_em: string
          criado_por: string | null
          data_movimentacao: string
          data_vencimento: string | null
          descricao: string | null
          destinatario_id: string
          id: string
          mes_referencia: number
          tipo_movimentacao: string
          valor: number
        }
        Insert: {
          ano_referencia: number
          comprovante_url?: string | null
          criado_em?: string
          criado_por?: string | null
          data_movimentacao?: string
          data_vencimento?: string | null
          descricao?: string | null
          destinatario_id: string
          id?: string
          mes_referencia: number
          tipo_movimentacao: string
          valor: number
        }
        Update: {
          ano_referencia?: number
          comprovante_url?: string | null
          criado_em?: string
          criado_por?: string | null
          data_movimentacao?: string
          data_vencimento?: string | null
          descricao?: string | null
          destinatario_id?: string
          id?: string
          mes_referencia?: number
          tipo_movimentacao?: string
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-caixa_movimentacoes_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-caixa_destinatarios"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-caixa_saldo_acumulado": {
        Row: {
          ano_referencia: number
          atualizado_em: string
          destinatario_id: string
          id: string
          mes_referencia: number
          saldo: number
          total_pago: number
          total_reservado: number
        }
        Insert: {
          ano_referencia: number
          atualizado_em?: string
          destinatario_id: string
          id?: string
          mes_referencia: number
          saldo?: number
          total_pago?: number
          total_reservado?: number
        }
        Update: {
          ano_referencia?: number
          atualizado_em?: string
          destinatario_id?: string
          id?: string
          mes_referencia?: number
          saldo?: number
          total_pago?: number
          total_reservado?: number
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-caixa_saldo_acumulado_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-caixa_destinatarios"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-campanhas_disparos": {
        Row: {
          concluido_em: string | null
          criado_em: string | null
          criado_por: string | null
          destinatarios_ids: Json | null
          destinatarios_snapshot: Json | null
          filtro_datas: Json | null
          id: string
          iniciado_em: string | null
          mensagem_id: string | null
          status: string
          tipo_lista: string
          total_destinatarios: number
          total_enviados: number
          total_erros: number
          webhook_id: string | null
        }
        Insert: {
          concluido_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          destinatarios_ids?: Json | null
          destinatarios_snapshot?: Json | null
          filtro_datas?: Json | null
          id?: string
          iniciado_em?: string | null
          mensagem_id?: string | null
          status?: string
          tipo_lista: string
          total_destinatarios?: number
          total_enviados?: number
          total_erros?: number
          webhook_id?: string | null
        }
        Update: {
          concluido_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          destinatarios_ids?: Json | null
          destinatarios_snapshot?: Json | null
          filtro_datas?: Json | null
          id?: string
          iniciado_em?: string | null
          mensagem_id?: string | null
          status?: string
          tipo_lista?: string
          total_destinatarios?: number
          total_enviados?: number
          total_erros?: number
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-campanhas_disparos_mensagem_id_fkey"
            columns: ["mensagem_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-campanhas_mensagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-campanhas_disparos_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-campanhas_webhook"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-campanhas_historico": {
        Row: {
          criado_em: string | null
          destinatario_email: string | null
          destinatario_id: string
          destinatario_nome: string | null
          destinatario_responsavel: string | null
          destinatario_telefone: string | null
          destinatario_tipo: string
          disparo_id: string | null
          enviado_em: string | null
          erro_mensagem: string | null
          id: string
          mensagem_enviada: string
          resposta_webhook: Json | null
          status: string
          webhook_url: string
        }
        Insert: {
          criado_em?: string | null
          destinatario_email?: string | null
          destinatario_id: string
          destinatario_nome?: string | null
          destinatario_responsavel?: string | null
          destinatario_telefone?: string | null
          destinatario_tipo: string
          disparo_id?: string | null
          enviado_em?: string | null
          erro_mensagem?: string | null
          id?: string
          mensagem_enviada: string
          resposta_webhook?: Json | null
          status?: string
          webhook_url: string
        }
        Update: {
          criado_em?: string | null
          destinatario_email?: string | null
          destinatario_id?: string
          destinatario_nome?: string | null
          destinatario_responsavel?: string | null
          destinatario_telefone?: string | null
          destinatario_tipo?: string
          disparo_id?: string | null
          enviado_em?: string | null
          erro_mensagem?: string | null
          id?: string
          mensagem_enviada?: string
          resposta_webhook?: Json | null
          status?: string
          webhook_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-campanhas_historico_disparo_id_fkey"
            columns: ["disparo_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-campanhas_disparos"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-campanhas_mensagens": {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          conteudo: string
          criado_em: string | null
          criado_por: string | null
          id: string
          titulo: string
          variaveis_disponiveis: string[] | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          conteudo: string
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          titulo: string
          variaveis_disponiveis?: string[] | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          conteudo?: string
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          titulo?: string
          variaveis_disponiveis?: string[] | null
        }
        Relationships: []
      }
      "plataforma-pro-forco-campanhas_webhook": {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          criado_por: string | null
          descricao: string | null
          id: string
          nome: string
          url: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome: string
          url: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          criado_por?: string | null
          descricao?: string | null
          id?: string
          nome?: string
          url?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-chamadas_professores": {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          aluno_telefone: string | null
          atendente_nome: string | null
          atendente_user_id: string | null
          atendido_em: string | null
          atualizado_em: string | null
          criado_em: string | null
          data_aula: string | null
          descricao_personalizada: string | null
          duracao_minutos: number
          hora_aula: string | null
          id: string
          lida_pelo_professor: boolean | null
          materia_id: string | null
          materia_nome: string | null
          motivo: string
          observacoes_atendente: string | null
          observacoes_professor: string | null
          professor_id: string
          professor_nome: string | null
          professor_user_id: string
          registro_aula_id: string | null
          resolvida_em: string | null
          status: string
          titulo_personalizado: string | null
        }
        Insert: {
          aluno_id?: string | null
          aluno_nome?: string | null
          aluno_telefone?: string | null
          atendente_nome?: string | null
          atendente_user_id?: string | null
          atendido_em?: string | null
          atualizado_em?: string | null
          criado_em?: string | null
          data_aula?: string | null
          descricao_personalizada?: string | null
          duracao_minutos?: number
          hora_aula?: string | null
          id?: string
          lida_pelo_professor?: boolean | null
          materia_id?: string | null
          materia_nome?: string | null
          motivo?: string
          observacoes_atendente?: string | null
          observacoes_professor?: string | null
          professor_id: string
          professor_nome?: string | null
          professor_user_id: string
          registro_aula_id?: string | null
          resolvida_em?: string | null
          status?: string
          titulo_personalizado?: string | null
        }
        Update: {
          aluno_id?: string | null
          aluno_nome?: string | null
          aluno_telefone?: string | null
          atendente_nome?: string | null
          atendente_user_id?: string | null
          atendido_em?: string | null
          atualizado_em?: string | null
          criado_em?: string | null
          data_aula?: string | null
          descricao_personalizada?: string | null
          duracao_minutos?: number
          hora_aula?: string | null
          id?: string
          lida_pelo_professor?: boolean | null
          materia_id?: string | null
          materia_nome?: string | null
          motivo?: string
          observacoes_atendente?: string | null
          observacoes_professor?: string | null
          professor_id?: string
          professor_nome?: string | null
          professor_user_id?: string
          registro_aula_id?: string | null
          resolvida_em?: string | null
          status?: string
          titulo_personalizado?: string | null
        }
        Relationships: []
      }
      "plataforma-pro-forco-chat_configuracoes": {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          chave: string
          descricao: string | null
          id: string
          valor: string
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave: string
          descricao?: string | null
          id?: string
          valor: string
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          chave?: string
          descricao?: string | null
          id?: string
          valor?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-chat_conversas": {
        Row: {
          atualizado_em: string
          criado_em: string
          id: string
          nome: string | null
          tipo: string
          ultima_mensagem_em: string | null
        }
        Insert: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome?: string | null
          tipo?: string
          ultima_mensagem_em?: string | null
        }
        Update: {
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome?: string | null
          tipo?: string
          ultima_mensagem_em?: string | null
        }
        Relationships: []
      }
      "plataforma-pro-forco-chat_financeiro_contatos": {
        Row: {
          aluno_id: string | null
          ativo: boolean | null
          atualizado_em: string | null
          avatar_url: string | null
          categoria: string
          criado_em: string | null
          email: string | null
          id: string
          nome: string
          nome_responsavel: string | null
          origem: string | null
          professor_id: string | null
          telefone: string | null
          usuario_id: string | null
        }
        Insert: {
          aluno_id?: string | null
          ativo?: boolean | null
          atualizado_em?: string | null
          avatar_url?: string | null
          categoria?: string
          criado_em?: string | null
          email?: string | null
          id?: string
          nome: string
          nome_responsavel?: string | null
          origem?: string | null
          professor_id?: string | null
          telefone?: string | null
          usuario_id?: string | null
        }
        Update: {
          aluno_id?: string | null
          ativo?: boolean | null
          atualizado_em?: string | null
          avatar_url?: string | null
          categoria?: string
          criado_em?: string | null
          email?: string | null
          id?: string
          nome?: string
          nome_responsavel?: string | null
          origem?: string | null
          professor_id?: string | null
          telefone?: string | null
          usuario_id?: string | null
        }
        Relationships: []
      }
      "plataforma-pro-forco-chat_financeiro_logs": {
        Row: {
          acao: string
          admin_id: string | null
          criado_em: string | null
          descricao: string | null
          id: string
          metadados: Json | null
        }
        Insert: {
          acao: string
          admin_id?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          metadados?: Json | null
        }
        Update: {
          acao?: string
          admin_id?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          metadados?: Json | null
        }
        Relationships: []
      }
      "plataforma-pro-forco-chat_financeiro_mensagens": {
        Row: {
          arquivo_conteudo_base64: string | null
          arquivo_nome: string | null
          arquivo_tipo_mime: string | null
          conteudo_texto: string | null
          criado_em: string | null
          destinatario_id: string
          id: string
          lida: boolean | null
          remetente_id: string
          tipo_mensagem: string
          url_midia: string | null
          webhook_enviado: boolean | null
          webhook_enviado_em: string | null
        }
        Insert: {
          arquivo_conteudo_base64?: string | null
          arquivo_nome?: string | null
          arquivo_tipo_mime?: string | null
          conteudo_texto?: string | null
          criado_em?: string | null
          destinatario_id: string
          id?: string
          lida?: boolean | null
          remetente_id: string
          tipo_mensagem?: string
          url_midia?: string | null
          webhook_enviado?: boolean | null
          webhook_enviado_em?: string | null
        }
        Update: {
          arquivo_conteudo_base64?: string | null
          arquivo_nome?: string | null
          arquivo_tipo_mime?: string | null
          conteudo_texto?: string | null
          criado_em?: string | null
          destinatario_id?: string
          id?: string
          lida?: boolean | null
          remetente_id?: string
          tipo_mensagem?: string
          url_midia?: string | null
          webhook_enviado?: boolean | null
          webhook_enviado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-chat_financeiro_mensa_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-chat_financeiro_contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-chat_financeiro_mensagen_remetente_id_fkey"
            columns: ["remetente_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-chat_financeiro_contatos"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-chat_financeiro_webhooks": {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          id: string
          nome: string
          url: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          nome: string
          url: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          nome?: string
          url?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-chat_mensagens": {
        Row: {
          arquivo_nome: string | null
          arquivo_tamanho: number | null
          arquivo_tipo_mime: string | null
          arquivo_url: string | null
          conteudo_texto: string | null
          conversa_id: string
          criado_em: string
          editado: boolean
          editado_em: string | null
          excluido: boolean
          excluido_em: string | null
          id: string
          lido_por: Json
          remetente_id: string
          respondendo_mensagem_id: string | null
          tipo_mensagem: string
        }
        Insert: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo_mime?: string | null
          arquivo_url?: string | null
          conteudo_texto?: string | null
          conversa_id: string
          criado_em?: string
          editado?: boolean
          editado_em?: string | null
          excluido?: boolean
          excluido_em?: string | null
          id?: string
          lido_por?: Json
          remetente_id: string
          respondendo_mensagem_id?: string | null
          tipo_mensagem?: string
        }
        Update: {
          arquivo_nome?: string | null
          arquivo_tamanho?: number | null
          arquivo_tipo_mime?: string | null
          arquivo_url?: string | null
          conteudo_texto?: string | null
          conversa_id?: string
          criado_em?: string
          editado?: boolean
          editado_em?: string | null
          excluido?: boolean
          excluido_em?: string | null
          id?: string
          lido_por?: Json
          remetente_id?: string
          respondendo_mensagem_id?: string | null
          tipo_mensagem?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-chat_mensagen_respondendo_mensagem_id_fkey"
            columns: ["respondendo_mensagem_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-chat_mensagens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-chat_mensagens_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-chat_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-chat_participantes": {
        Row: {
          bloqueado: boolean
          bloqueado_em: string | null
          bloqueado_por: string | null
          conversa_id: string
          criado_em: string
          id: string
          mensagens_nao_lidas: number
          role_no_chat: string
          ultima_visualizacao: string | null
          usuario_id: string
        }
        Insert: {
          bloqueado?: boolean
          bloqueado_em?: string | null
          bloqueado_por?: string | null
          conversa_id: string
          criado_em?: string
          id?: string
          mensagens_nao_lidas?: number
          role_no_chat?: string
          ultima_visualizacao?: string | null
          usuario_id: string
        }
        Update: {
          bloqueado?: boolean
          bloqueado_em?: string | null
          bloqueado_por?: string | null
          conversa_id?: string
          criado_em?: string
          id?: string
          mensagens_nao_lidas?: number
          role_no_chat?: string
          ultima_visualizacao?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-chat_participantes_conversa_id_fkey"
            columns: ["conversa_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-chat_conversas"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-chat_urgencia_contatos": {
        Row: {
          ativo: boolean
          atualizado_em: string | null
          avatar_url: string | null
          categoria: string
          criado_em: string
          email: string | null
          id: string
          nome: string | null
          telefone: string | null
          usuario_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string | null
          avatar_url?: string | null
          categoria: string
          criado_em?: string
          email?: string | null
          id?: string
          nome?: string | null
          telefone?: string | null
          usuario_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string | null
          avatar_url?: string | null
          categoria?: string
          criado_em?: string
          email?: string | null
          id?: string
          nome?: string | null
          telefone?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_urgencia_contatos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "plataforma-pro-forco-usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-chat_urgencia_contatos_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "plataforma-pro-forco-usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-chat_urgencia_logs": {
        Row: {
          acao: string
          admin_id: string
          criado_em: string
          descricao: string
          id: string
          metadados: Json | null
        }
        Insert: {
          acao: string
          admin_id: string
          criado_em?: string
          descricao: string
          id?: string
          metadados?: Json | null
        }
        Update: {
          acao?: string
          admin_id?: string
          criado_em?: string
          descricao?: string
          id?: string
          metadados?: Json | null
        }
        Relationships: []
      }
      "plataforma-pro-forco-chat_urgencia_mensagens": {
        Row: {
          arquivo_conteudo_base64: string | null
          arquivo_nome: string | null
          arquivo_tipo_mime: string | null
          arquivo_url: string | null
          conteudo_texto: string | null
          criado_em: string
          destinatario_id: string
          id: string
          lida: boolean
          remetente_id: string
          tipo_mensagem: string
          webhook_enviado: boolean
          webhook_enviado_em: string | null
        }
        Insert: {
          arquivo_conteudo_base64?: string | null
          arquivo_nome?: string | null
          arquivo_tipo_mime?: string | null
          arquivo_url?: string | null
          conteudo_texto?: string | null
          criado_em?: string
          destinatario_id: string
          id?: string
          lida?: boolean
          remetente_id: string
          tipo_mensagem: string
          webhook_enviado?: boolean
          webhook_enviado_em?: string | null
        }
        Update: {
          arquivo_conteudo_base64?: string | null
          arquivo_nome?: string | null
          arquivo_tipo_mime?: string | null
          arquivo_url?: string | null
          conteudo_texto?: string | null
          criado_em?: string
          destinatario_id?: string
          id?: string
          lida?: boolean
          remetente_id?: string
          tipo_mensagem?: string
          webhook_enviado?: boolean
          webhook_enviado_em?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-chat_urgencia_mensage_destinatario_id_fkey"
            columns: ["destinatario_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-chat_urgencia_contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-chat_urgencia_mensagens_remetente_id_fkey"
            columns: ["remetente_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-chat_urgencia_contatos"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-chat_urgencia_webhooks": {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          id: string
          nome: string
          url: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome: string
          url: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          nome?: string
          url?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-chat_visibilidade_usuarios": {
        Row: {
          atualizado_em: string
          atualizado_por: string | null
          usuario_id: string
          ver_alunos: boolean
          ver_pedagogia: boolean
          ver_professores: boolean
        }
        Insert: {
          atualizado_em?: string
          atualizado_por?: string | null
          usuario_id: string
          ver_alunos?: boolean
          ver_pedagogia?: boolean
          ver_professores?: boolean
        }
        Update: {
          atualizado_em?: string
          atualizado_por?: string | null
          usuario_id?: string
          ver_alunos?: boolean
          ver_pedagogia?: boolean
          ver_professores?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-chat_visibilidade_usua_atualizado_por_fkey"
            columns: ["atualizado_por"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-chat_visibilidade_usuarios_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: true
            referencedRelation: "plataforma-pro-forco-usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-compartilhamento_tela": {
        Row: {
          criado_em: string
          data_fim: string | null
          data_inicio: string
          id: string
          reuniao_id: string
          status: string
          tipo_dispositivo: string
          token_stream: string | null
          usuario_id: string
        }
        Insert: {
          criado_em?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          reuniao_id: string
          status?: string
          tipo_dispositivo: string
          token_stream?: string | null
          usuario_id: string
        }
        Update: {
          criado_em?: string
          data_fim?: string | null
          data_inicio?: string
          id?: string
          reuniao_id?: string
          status?: string
          tipo_dispositivo?: string
          token_stream?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_reuniao"
            columns: ["reuniao_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-reunioes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fk_usuario"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-configuracoes": {
        Row: {
          atualizado_em: string | null
          chave: string
          descricao: string | null
          id: string
          valor: string
        }
        Insert: {
          atualizado_em?: string | null
          chave: string
          descricao?: string | null
          id?: string
          valor: string
        }
        Update: {
          atualizado_em?: string | null
          chave?: string
          descricao?: string | null
          id?: string
          valor?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-configuracoes_webhooks": {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          finalidade: string
          id: string
          tipo: string
          url: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          finalidade: string
          id?: string
          tipo: string
          url: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          finalidade?: string
          id?: string
          tipo?: string
          url?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-contratos": {
        Row: {
          aluno_id: string
          assinado_em: string | null
          assinatura_url: string | null
          atualizado_em: string | null
          conteudo_final: string
          criado_em: string | null
          criado_por: string | null
          dados_preenchidos: Json
          id: string
          modelo_id: string | null
          status: string
        }
        Insert: {
          aluno_id: string
          assinado_em?: string | null
          assinatura_url?: string | null
          atualizado_em?: string | null
          conteudo_final: string
          criado_em?: string | null
          criado_por?: string | null
          dados_preenchidos?: Json
          id?: string
          modelo_id?: string | null
          status?: string
        }
        Update: {
          aluno_id?: string
          assinado_em?: string | null
          assinatura_url?: string | null
          atualizado_em?: string | null
          conteudo_final?: string
          criado_em?: string | null
          criado_por?: string | null
          dados_preenchidos?: Json
          id?: string
          modelo_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-contratos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-contratos_modelo_id_fkey"
            columns: ["modelo_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-contratos_modelos"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-contratos_modelos": {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          conteudo_template: string
          criado_em: string | null
          criado_por: string | null
          id: string
          nome: string
          variaveis_disponiveis: Json | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          conteudo_template: string
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          nome: string
          variaveis_disponiveis?: Json | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          conteudo_template?: string
          criado_em?: string | null
          criado_por?: string | null
          id?: string
          nome?: string
          variaveis_disponiveis?: Json | null
        }
        Relationships: []
      }
      "plataforma-pro-forco-crm_agendamentos": {
        Row: {
          ano_escolar: string | null
          criado_em: string | null
          data_hora: string
          email: string | null
          id: string
          idade: number | null
          link_id: string
          nome_aluno: string
          nome_responsavel: string
          observacoes: string | null
          status: string | null
          telefone: string | null
        }
        Insert: {
          ano_escolar?: string | null
          criado_em?: string | null
          data_hora: string
          email?: string | null
          id?: string
          idade?: number | null
          link_id: string
          nome_aluno: string
          nome_responsavel: string
          observacoes?: string | null
          status?: string | null
          telefone?: string | null
        }
        Update: {
          ano_escolar?: string | null
          criado_em?: string | null
          data_hora?: string
          email?: string | null
          id?: string
          idade?: number | null
          link_id?: string
          nome_aluno?: string
          nome_responsavel?: string
          observacoes?: string | null
          status?: string | null
          telefone?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-crm_agendamentos_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-crm_links_agenda"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-crm_aluno_kanban": {
        Row: {
          aluno_id: string
          atualizado_em: string | null
          atualizado_por: string | null
          coluna_id: string
          id: string
          ordem: number | null
        }
        Insert: {
          aluno_id: string
          atualizado_em?: string | null
          atualizado_por?: string | null
          coluna_id: string
          id?: string
          ordem?: number | null
        }
        Update: {
          aluno_id?: string
          atualizado_em?: string | null
          atualizado_por?: string | null
          coluna_id?: string
          id?: string
          ordem?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-crm_aluno_kanban_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: true
            referencedRelation: "plataforma-pro-forco-alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-crm_aluno_kanban_coluna_id_fkey"
            columns: ["coluna_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-crm_kanban_colunas"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-crm_disparos": {
        Row: {
          aluno_id: string
          conteudo_enviado: string | null
          criado_em: string | null
          disparado_por: string | null
          erro_mensagem: string | null
          id: string
          resposta_webhook: Json | null
          status: string | null
          template_id: string | null
          tipo: string
          webhook_id: string | null
        }
        Insert: {
          aluno_id: string
          conteudo_enviado?: string | null
          criado_em?: string | null
          disparado_por?: string | null
          erro_mensagem?: string | null
          id?: string
          resposta_webhook?: Json | null
          status?: string | null
          template_id?: string | null
          tipo: string
          webhook_id?: string | null
        }
        Update: {
          aluno_id?: string
          conteudo_enviado?: string | null
          criado_em?: string | null
          disparado_por?: string | null
          erro_mensagem?: string | null
          id?: string
          resposta_webhook?: Json | null
          status?: string | null
          template_id?: string | null
          tipo?: string
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-crm_disparos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-crm_disparos_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-crm_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-crm_disparos_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-crm_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-crm_disponibilidade": {
        Row: {
          criado_em: string | null
          dia_semana: number
          duracao_minutos: number
          hora_fim: string
          hora_inicio: string
          id: string
          link_id: string
        }
        Insert: {
          criado_em?: string | null
          dia_semana: number
          duracao_minutos?: number
          hora_fim: string
          hora_inicio: string
          id?: string
          link_id: string
        }
        Update: {
          criado_em?: string | null
          dia_semana?: number
          duracao_minutos?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          link_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-crm_disponibilidade_link_id_fkey"
            columns: ["link_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-crm_links_agenda"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-crm_kanban_colunas": {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          cor: string | null
          criado_em: string | null
          id: string
          nome: string
          ordem: number
          tipo: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          cor?: string | null
          criado_em?: string | null
          id?: string
          nome: string
          ordem?: number
          tipo: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          cor?: string | null
          criado_em?: string | null
          id?: string
          nome?: string
          ordem?: number
          tipo?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-crm_links_agenda": {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          campos_formulario: Json | null
          criado_em: string | null
          criado_por: string
          descricao: string | null
          exibir_formulario: boolean | null
          id: string
          titulo: string
          token: string
          webhook_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          campos_formulario?: Json | null
          criado_em?: string | null
          criado_por: string
          descricao?: string | null
          exibir_formulario?: boolean | null
          id?: string
          titulo?: string
          token?: string
          webhook_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          campos_formulario?: Json | null
          criado_em?: string | null
          criado_por?: string
          descricao?: string | null
          exibir_formulario?: boolean | null
          id?: string
          titulo?: string
          token?: string
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-crm_links_agenda_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-crm_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-crm_observacoes": {
        Row: {
          aluno_id: string
          atualizado_em: string | null
          conteudo: string
          criado_em: string | null
          criado_por: string
          criado_por_nome: string
          id: string
          rotulo: string | null
        }
        Insert: {
          aluno_id: string
          atualizado_em?: string | null
          conteudo: string
          criado_em?: string | null
          criado_por: string
          criado_por_nome: string
          id?: string
          rotulo?: string | null
        }
        Update: {
          aluno_id?: string
          atualizado_em?: string | null
          conteudo?: string
          criado_em?: string | null
          criado_por?: string
          criado_por_nome?: string
          id?: string
          rotulo?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-crm_observacoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-crm_relatorios_reuniao": {
        Row: {
          aluno_id: string
          atualizado_em: string
          conteudo: string
          criado_em: string
          criado_por: string | null
          criado_por_nome: string | null
          id: string
        }
        Insert: {
          aluno_id: string
          atualizado_em?: string
          conteudo: string
          criado_em?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          id?: string
        }
        Update: {
          aluno_id?: string
          atualizado_em?: string
          conteudo?: string
          criado_em?: string
          criado_por?: string | null
          criado_por_nome?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fk_aluno"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-crm_tarefas": {
        Row: {
          aluno_id: string | null
          atualizado_em: string | null
          conclusoes_ocorrencias: string[] | null
          criado_em: string | null
          criado_por: string | null
          data_hora: string
          descricao: string | null
          destinatario_id: string
          exclusoes_ocorrencias: string[] | null
          id: string
          notificacao_enviada: boolean | null
          notificar_aluno: boolean | null
          recorrencia_dias_semana: number[] | null
          recorrencia_tipo: string | null
          status: string | null
          tipo_agendamento: string | null
          titulo: string
          webhook_id: string | null
        }
        Insert: {
          aluno_id?: string | null
          atualizado_em?: string | null
          conclusoes_ocorrencias?: string[] | null
          criado_em?: string | null
          criado_por?: string | null
          data_hora: string
          descricao?: string | null
          destinatario_id: string
          exclusoes_ocorrencias?: string[] | null
          id?: string
          notificacao_enviada?: boolean | null
          notificar_aluno?: boolean | null
          recorrencia_dias_semana?: number[] | null
          recorrencia_tipo?: string | null
          status?: string | null
          tipo_agendamento?: string | null
          titulo: string
          webhook_id?: string | null
        }
        Update: {
          aluno_id?: string | null
          atualizado_em?: string | null
          conclusoes_ocorrencias?: string[] | null
          criado_em?: string | null
          criado_por?: string | null
          data_hora?: string
          descricao?: string | null
          destinatario_id?: string
          exclusoes_ocorrencias?: string[] | null
          id?: string
          notificacao_enviada?: boolean | null
          notificar_aluno?: boolean | null
          recorrencia_dias_semana?: number[] | null
          recorrencia_tipo?: string | null
          status?: string | null
          tipo_agendamento?: string | null
          titulo?: string
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-crm_tarefas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-crm_tarefas_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-crm_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-crm_tarefas_ocorrencias_notificadas": {
        Row: {
          criado_em: string | null
          data_hora_ocorrencia: string
          tarefa_id: string
        }
        Insert: {
          criado_em?: string | null
          data_hora_ocorrencia: string
          tarefa_id: string
        }
        Update: {
          criado_em?: string | null
          data_hora_ocorrencia?: string
          tarefa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-crm_tarefas_ocorrencias_not_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-crm_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-crm_templates": {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          conteudo: string
          criado_em: string | null
          id: string
          nome: string
          padrao: boolean | null
          tipo: string
          variaveis: string[] | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          conteudo: string
          criado_em?: string | null
          id?: string
          nome: string
          padrao?: boolean | null
          tipo: string
          variaveis?: string[] | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          conteudo?: string
          criado_em?: string | null
          id?: string
          nome?: string
          padrao?: boolean | null
          tipo?: string
          variaveis?: string[] | null
        }
        Relationships: []
      }
      "plataforma-pro-forco-crm_webhooks": {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          id: string
          nome: string
          padrao: boolean | null
          tipo: string
          url: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          nome: string
          padrao?: boolean | null
          tipo: string
          url: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          nome?: string
          padrao?: boolean | null
          tipo?: string
          url?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-fin_alunos": {
        Row: {
          aluno_id: string
          atualizado_em: string | null
          criado_em: string | null
          desconto_recorrente: number | null
          desmatricula_solicitada_fin_em: string | null
          desmatriculado_em: string | null
          dia_vencimento: number | null
          id: string
          motivo_desmatricula: string | null
          observacoes: string | null
          outras_taxas: number | null
          plano_id: string | null
          recorrencia: string | null
          rematricula_solicitada_em: string | null
          solicitado_desmatricula_em: string | null
          status: string
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          tipo_cobranca: string | null
        }
        Insert: {
          aluno_id: string
          atualizado_em?: string | null
          criado_em?: string | null
          desconto_recorrente?: number | null
          desmatricula_solicitada_fin_em?: string | null
          desmatriculado_em?: string | null
          dia_vencimento?: number | null
          id?: string
          motivo_desmatricula?: string | null
          observacoes?: string | null
          outras_taxas?: number | null
          plano_id?: string | null
          recorrencia?: string | null
          rematricula_solicitada_em?: string | null
          solicitado_desmatricula_em?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tipo_cobranca?: string | null
        }
        Update: {
          aluno_id?: string
          atualizado_em?: string | null
          criado_em?: string | null
          desconto_recorrente?: number | null
          desmatricula_solicitada_fin_em?: string | null
          desmatriculado_em?: string | null
          dia_vencimento?: number | null
          id?: string
          motivo_desmatricula?: string | null
          observacoes?: string | null
          outras_taxas?: number | null
          plano_id?: string | null
          recorrencia?: string | null
          rematricula_solicitada_em?: string | null
          solicitado_desmatricula_em?: string | null
          status?: string
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          tipo_cobranca?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-fin_alunos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: true
            referencedRelation: "plataforma-pro-forco-alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-fin_alunos_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-fin_planos"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-fin_cobranca_config": {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          dias_antecedencia: number | null
          dias_atraso: number | null
          enviar_recibo: boolean | null
          gerar_recibo_automatico: boolean | null
          horarios: string[] | null
          id: string
          mensagem_template: string | null
          quantidade_envios: number | null
          tipo: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          dias_antecedencia?: number | null
          dias_atraso?: number | null
          enviar_recibo?: boolean | null
          gerar_recibo_automatico?: boolean | null
          horarios?: string[] | null
          id?: string
          mensagem_template?: string | null
          quantidade_envios?: number | null
          tipo: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          dias_antecedencia?: number | null
          dias_atraso?: number | null
          enviar_recibo?: boolean | null
          gerar_recibo_automatico?: boolean | null
          horarios?: string[] | null
          id?: string
          mensagem_template?: string | null
          quantidade_envios?: number | null
          tipo?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-fin_cobranca_logs": {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          enviado_em: string | null
          erro: string | null
          fatura_id: string | null
          id: string
          is_teste: boolean | null
          mensagem_enviada: string | null
          payload: Json | null
          responsavel_nome: string | null
          resposta: string | null
          status: string | null
          telefone: string | null
          tipo: string
          webhook_url: string | null
        }
        Insert: {
          aluno_id?: string | null
          aluno_nome?: string | null
          enviado_em?: string | null
          erro?: string | null
          fatura_id?: string | null
          id?: string
          is_teste?: boolean | null
          mensagem_enviada?: string | null
          payload?: Json | null
          responsavel_nome?: string | null
          resposta?: string | null
          status?: string | null
          telefone?: string | null
          tipo: string
          webhook_url?: string | null
        }
        Update: {
          aluno_id?: string | null
          aluno_nome?: string | null
          enviado_em?: string | null
          erro?: string | null
          fatura_id?: string | null
          id?: string
          is_teste?: boolean | null
          mensagem_enviada?: string | null
          payload?: Json | null
          responsavel_nome?: string | null
          resposta?: string | null
          status?: string | null
          telefone?: string | null
          tipo?: string
          webhook_url?: string | null
        }
        Relationships: []
      }
      "plataforma-pro-forco-fin_cobranca_negativados": {
        Row: {
          criado_em: string
          criado_por: string | null
          fin_aluno_id: string
          id: string
          observacao: string | null
          tipo: string
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          fin_aluno_id: string
          id?: string
          observacao?: string | null
          tipo: string
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          fin_aluno_id?: string
          id?: string
          observacao?: string | null
          tipo?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-fin_cobranca_webhooks": {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          descricao: string | null
          id: string
          tipo: string
          url: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          tipo: string
          url: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          tipo?: string
          url?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-fin_despesas": {
        Row: {
          ano_referencia: number | null
          atualizado_em: string | null
          comprovante_url: string | null
          criado_em: string | null
          data_pagamento: string | null
          data_vencimento: string
          descricao: string
          forma_pagamento: string | null
          id: string
          mes_referencia: number | null
          observacoes: string | null
          professor_id: string | null
          recorrencia: string | null
          status: string
          tipo: string
          valor: number
          valor_pago: number | null
        }
        Insert: {
          ano_referencia?: number | null
          atualizado_em?: string | null
          comprovante_url?: string | null
          criado_em?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          descricao: string
          forma_pagamento?: string | null
          id?: string
          mes_referencia?: number | null
          observacoes?: string | null
          professor_id?: string | null
          recorrencia?: string | null
          status?: string
          tipo: string
          valor: number
          valor_pago?: number | null
        }
        Update: {
          ano_referencia?: number | null
          atualizado_em?: string | null
          comprovante_url?: string | null
          criado_em?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          descricao?: string
          forma_pagamento?: string | null
          id?: string
          mes_referencia?: number | null
          observacoes?: string | null
          professor_id?: string | null
          recorrencia?: string | null
          status?: string
          tipo?: string
          valor?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-fin_despesas_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-professores"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-fin_faturas": {
        Row: {
          acrescimo: number | null
          ano_referencia: number | null
          atualizado_em: string | null
          criado_em: string | null
          data_pagamento: string | null
          data_vencimento: string
          desconto: number | null
          fin_aluno_id: string
          forma_pagamento: string | null
          id: string
          mes_referencia: number | null
          observacoes: string | null
          origem: string | null
          plano_id: string | null
          quantidade_aulas: number | null
          recorrencia: string | null
          registrado_por_nome: string | null
          status: string
          stripe_invoice_id: string | null
          stripe_payment_intent_id: string | null
          valor: number
          valor_pago: number | null
        }
        Insert: {
          acrescimo?: number | null
          ano_referencia?: number | null
          atualizado_em?: string | null
          criado_em?: string | null
          data_pagamento?: string | null
          data_vencimento: string
          desconto?: number | null
          fin_aluno_id: string
          forma_pagamento?: string | null
          id?: string
          mes_referencia?: number | null
          observacoes?: string | null
          origem?: string | null
          plano_id?: string | null
          quantidade_aulas?: number | null
          recorrencia?: string | null
          registrado_por_nome?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          valor: number
          valor_pago?: number | null
        }
        Update: {
          acrescimo?: number | null
          ano_referencia?: number | null
          atualizado_em?: string | null
          criado_em?: string | null
          data_pagamento?: string | null
          data_vencimento?: string
          desconto?: number | null
          fin_aluno_id?: string
          forma_pagamento?: string | null
          id?: string
          mes_referencia?: number | null
          observacoes?: string | null
          origem?: string | null
          plano_id?: string | null
          quantidade_aulas?: number | null
          recorrencia?: string | null
          registrado_por_nome?: string | null
          status?: string
          stripe_invoice_id?: string | null
          stripe_payment_intent_id?: string | null
          valor?: number
          valor_pago?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-fin_faturas_fin_aluno_id_fkey"
            columns: ["fin_aluno_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-fin_alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-fin_faturas_plano_id_fkey"
            columns: ["plano_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-fin_planos"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-fin_novos_clientes_excluidos": {
        Row: {
          criado_em: string | null
          fin_aluno_id: string
          id: string
        }
        Insert: {
          criado_em?: string | null
          fin_aluno_id: string
          id?: string
        }
        Update: {
          criado_em?: string | null
          fin_aluno_id?: string
          id?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-fin_pagamentos": {
        Row: {
          comprovante_url: string | null
          criado_em: string | null
          data_pagamento: string
          fatura_id: string
          forma_pagamento: string
          id: string
          observacoes: string | null
          origem: string | null
          registrado_por: string | null
          registrado_por_nome: string | null
          valor: number
        }
        Insert: {
          comprovante_url?: string | null
          criado_em?: string | null
          data_pagamento?: string
          fatura_id: string
          forma_pagamento: string
          id?: string
          observacoes?: string | null
          origem?: string | null
          registrado_por?: string | null
          registrado_por_nome?: string | null
          valor: number
        }
        Update: {
          comprovante_url?: string | null
          criado_em?: string | null
          data_pagamento?: string
          fatura_id?: string
          forma_pagamento?: string
          id?: string
          observacoes?: string | null
          origem?: string | null
          registrado_por?: string | null
          registrado_por_nome?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-fin_pagamentos_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-fin_faturas"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-fin_pagamentos_despesas": {
        Row: {
          criado_em: string
          criado_por: string | null
          data_pagamento: string
          despesa_id: string
          forma_pagamento: string | null
          id: string
          observacoes: string | null
          valor: number
        }
        Insert: {
          criado_em?: string
          criado_por?: string | null
          data_pagamento?: string
          despesa_id: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          valor: number
        }
        Update: {
          criado_em?: string
          criado_por?: string | null
          data_pagamento?: string
          despesa_id?: string
          forma_pagamento?: string | null
          id?: string
          observacoes?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-fin_pagamentos_despesas_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-fin_despesas"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-fin_planos": {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          aulas_por_mes: number
          aulas_por_semana: number
          categoria: string
          criado_em: string | null
          duracao_minutos: number
          id: string
          nome: string
          personalizado: boolean | null
          stripe_price_id: string | null
          stripe_price_id_avulso: string | null
          stripe_product_id: string | null
          valor: number
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          aulas_por_mes: number
          aulas_por_semana: number
          categoria: string
          criado_em?: string | null
          duracao_minutos: number
          id?: string
          nome: string
          personalizado?: boolean | null
          stripe_price_id?: string | null
          stripe_price_id_avulso?: string | null
          stripe_product_id?: string | null
          valor: number
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          aulas_por_mes?: number
          aulas_por_semana?: number
          categoria?: string
          criado_em?: string | null
          duracao_minutos?: number
          id?: string
          nome?: string
          personalizado?: boolean | null
          stripe_price_id?: string | null
          stripe_price_id_avulso?: string | null
          stripe_product_id?: string | null
          valor?: number
        }
        Relationships: []
      }
      "plataforma-pro-forco-fin_recibos": {
        Row: {
          criado_em: string | null
          data_emissao: string
          fatura_id: string | null
          id: string
          numero_recibo: string
          pagamento_id: string | null
          pdf_url: string | null
          valor: number
        }
        Insert: {
          criado_em?: string | null
          data_emissao?: string
          fatura_id?: string | null
          id?: string
          numero_recibo: string
          pagamento_id?: string | null
          pdf_url?: string | null
          valor: number
        }
        Update: {
          criado_em?: string | null
          data_emissao?: string
          fatura_id?: string | null
          id?: string
          numero_recibo?: string
          pagamento_id?: string | null
          pdf_url?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-fin_recibos_fatura_id_fkey"
            columns: ["fatura_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-fin_faturas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-fin_recibos_pagamento_id_fkey"
            columns: ["pagamento_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-fin_pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-fin_recibos_despesas": {
        Row: {
          criado_em: string | null
          data_emissao: string
          despesa_id: string
          emitido_por: string | null
          id: string
          numero_recibo: string
          pdf_url: string | null
          valor: number
        }
        Insert: {
          criado_em?: string | null
          data_emissao?: string
          despesa_id: string
          emitido_por?: string | null
          id?: string
          numero_recibo: string
          pdf_url?: string | null
          valor: number
        }
        Update: {
          criado_em?: string | null
          data_emissao?: string
          despesa_id?: string
          emitido_por?: string | null
          id?: string
          numero_recibo?: string
          pdf_url?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-fin_recibos_despesas_despesa_id_fkey"
            columns: ["despesa_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-fin_despesas"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-fin_rematriculas": {
        Row: {
          aluno_id: string
          aluno_nome: string
          criado_em: string
          data_rematricula: string
          id: string
          nome_responsavel: string | null
          valor_matricula: number | null
        }
        Insert: {
          aluno_id: string
          aluno_nome: string
          criado_em?: string
          data_rematricula?: string
          id?: string
          nome_responsavel?: string | null
          valor_matricula?: number | null
        }
        Update: {
          aluno_id?: string
          aluno_nome?: string
          criado_em?: string
          data_rematricula?: string
          id?: string
          nome_responsavel?: string | null
          valor_matricula?: number | null
        }
        Relationships: []
      }
      "plataforma-pro-forco-fin_templates_copia": {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          conteudo: string
          criado_em: string | null
          id: string
          nome: string
          ordem: number | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          conteudo: string
          criado_em?: string | null
          id?: string
          nome: string
          ordem?: number | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          conteudo?: string
          criado_em?: string | null
          id?: string
          nome?: string
          ordem?: number | null
        }
        Relationships: []
      }
      "plataforma-pro-forco-google_solicitacoes": {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          criado_em: string
          email: string
          id: string
          observacoes: string | null
          role_aprovado: string | null
          status: string
          telefone: string | null
          user_id: string
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          criado_em?: string
          email: string
          id?: string
          observacoes?: string | null
          role_aprovado?: string | null
          status?: string
          telefone?: string | null
          user_id: string
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          criado_em?: string
          email?: string
          id?: string
          observacoes?: string | null
          role_aprovado?: string | null
          status?: string
          telefone?: string | null
          user_id?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-horas_presenciais": {
        Row: {
          alunos_ids: string[]
          criado_em: string | null
          criado_por: string | null
          data_aula: string
          duracao_minutos: number
          excluido: boolean
          excluido_em: string | null
          excluido_por: string | null
          hora_inicio: string
          id: string
          motivo_exclusao: string | null
          observacoes: string | null
          professor_id: string
          registros_aulas_ids: string[]
          status: string
          valor_hora: number
          valor_total: number
        }
        Insert: {
          alunos_ids?: string[]
          criado_em?: string | null
          criado_por?: string | null
          data_aula: string
          duracao_minutos: number
          excluido?: boolean
          excluido_em?: string | null
          excluido_por?: string | null
          hora_inicio: string
          id?: string
          motivo_exclusao?: string | null
          observacoes?: string | null
          professor_id: string
          registros_aulas_ids?: string[]
          status?: string
          valor_hora: number
          valor_total: number
        }
        Update: {
          alunos_ids?: string[]
          criado_em?: string | null
          criado_por?: string | null
          data_aula?: string
          duracao_minutos?: number
          excluido?: boolean
          excluido_em?: string | null
          excluido_por?: string | null
          hora_inicio?: string
          id?: string
          motivo_exclusao?: string | null
          observacoes?: string | null
          professor_id?: string
          registros_aulas_ids?: string[]
          status?: string
          valor_hora?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-horas_presenciais_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-professores"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-materias": {
        Row: {
          ativo: boolean | null
          cor: string
          criado_em: string | null
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean | null
          cor: string
          criado_em?: string | null
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean | null
          cor?: string
          criado_em?: string | null
          id?: string
          nome?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-mensagens_chat_reuniao": {
        Row: {
          arquivo_url: string | null
          conteudo: string
          criado_em: string | null
          id: string
          reuniao_id: string
          tipo: string | null
          usuario_id: string
        }
        Insert: {
          arquivo_url?: string | null
          conteudo: string
          criado_em?: string | null
          id?: string
          reuniao_id: string
          tipo?: string | null
          usuario_id: string
        }
        Update: {
          arquivo_url?: string | null
          conteudo?: string
          criado_em?: string | null
          id?: string
          reuniao_id?: string
          tipo?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-mensagens_chat_reuniao_reuniao_id_fkey"
            columns: ["reuniao_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-reunioes"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-notificacoes_horarios": {
        Row: {
          aluno_id: string | null
          aula_agendada_id: string | null
          criado_em: string | null
          dados_alteracao: Json
          id: string
          lida: boolean | null
          lida_em: string | null
          mensagem: string
          professor_id: string | null
          tipo: string
          titulo: string
          usuario_alterou_id: string | null
        }
        Insert: {
          aluno_id?: string | null
          aula_agendada_id?: string | null
          criado_em?: string | null
          dados_alteracao: Json
          id?: string
          lida?: boolean | null
          lida_em?: string | null
          mensagem: string
          professor_id?: string | null
          tipo: string
          titulo: string
          usuario_alterou_id?: string | null
        }
        Update: {
          aluno_id?: string | null
          aula_agendada_id?: string | null
          criado_em?: string | null
          dados_alteracao?: Json
          id?: string
          lida?: boolean | null
          lida_em?: string | null
          mensagem?: string
          professor_id?: string | null
          tipo?: string
          titulo?: string
          usuario_alterou_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-notificacoes_horar_usuario_alterou_id_fkey"
            columns: ["usuario_alterou_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-usuarios"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-notificacoes_horario_aula_agendada_id_fkey"
            columns: ["aula_agendada_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-aulas_agendadas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-notificacoes_horarios_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-notificacoes_horarios_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-professores"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-notificacoes_renovacao": {
        Row: {
          aluno_id: string
          data_renovacao: string
          id: string
          notificado_em: string | null
          respondido_em: string | null
          resposta_admin: string | null
          status: string
        }
        Insert: {
          aluno_id: string
          data_renovacao: string
          id?: string
          notificado_em?: string | null
          respondido_em?: string | null
          resposta_admin?: string | null
          status?: string
        }
        Update: {
          aluno_id?: string
          data_renovacao?: string
          id?: string
          notificado_em?: string | null
          respondido_em?: string | null
          resposta_admin?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-notificacoes_renovacao_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-notificacoes_reunioes": {
        Row: {
          criado_em: string
          expira_em: string
          id: string
          lida: boolean
          link_acesso: string
          reuniao_id: string
          status: string
          tipo: string
          titulo_reuniao: string
          usuario_destinatario_id: string
          usuario_remetente_id: string
        }
        Insert: {
          criado_em?: string
          expira_em?: string
          id?: string
          lida?: boolean
          link_acesso: string
          reuniao_id: string
          status?: string
          tipo?: string
          titulo_reuniao: string
          usuario_destinatario_id: string
          usuario_remetente_id: string
        }
        Update: {
          criado_em?: string
          expira_em?: string
          id?: string
          lida?: boolean
          link_acesso?: string
          reuniao_id?: string
          status?: string
          tipo?: string
          titulo_reuniao?: string
          usuario_destinatario_id?: string
          usuario_remetente_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-notificacoes_reunioes_reuniao_id_fkey"
            columns: ["reuniao_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-reunioes"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-notificacoes_tarefas": {
        Row: {
          aluno_id: string
          criado_em: string | null
          data_hora: string
          descricao: string | null
          id: string
          lida: boolean | null
          tarefa_id: string
          titulo: string
        }
        Insert: {
          aluno_id: string
          criado_em?: string | null
          data_hora: string
          descricao?: string | null
          id?: string
          lida?: boolean | null
          tarefa_id: string
          titulo: string
        }
        Update: {
          aluno_id?: string
          criado_em?: string | null
          data_hora?: string
          descricao?: string | null
          id?: string
          lida?: boolean | null
          tarefa_id?: string
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-notificacoes_tarefas_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-notificacoes_tarefas_tarefa_id_fkey"
            columns: ["tarefa_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-crm_tarefas"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-participantes_reunioes": {
        Row: {
          criado_em: string | null
          entrou_em: string | null
          id: string
          permissoes: Json | null
          reuniao_id: string
          role_na_reuniao: string | null
          saiu_em: string | null
          status_conexao: string | null
          usuario_id: string
        }
        Insert: {
          criado_em?: string | null
          entrou_em?: string | null
          id?: string
          permissoes?: Json | null
          reuniao_id: string
          role_na_reuniao?: string | null
          saiu_em?: string | null
          status_conexao?: string | null
          usuario_id: string
        }
        Update: {
          criado_em?: string | null
          entrou_em?: string | null
          id?: string
          permissoes?: Json | null
          reuniao_id?: string
          role_na_reuniao?: string | null
          saiu_em?: string | null
          status_conexao?: string | null
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-participantes_reunioes_reuniao_id_fkey"
            columns: ["reuniao_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-reunioes"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-permissoes": {
        Row: {
          atualizado_em: string | null
          criado_em: string | null
          id: string
          pode_editar: boolean | null
          pode_visualizar: boolean | null
          recurso: string
          role: Database["public"]["Enums"]["plataforma_pro_forco_role"]
        }
        Insert: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          pode_editar?: boolean | null
          pode_visualizar?: boolean | null
          recurso: string
          role: Database["public"]["Enums"]["plataforma_pro_forco_role"]
        }
        Update: {
          atualizado_em?: string | null
          criado_em?: string | null
          id?: string
          pode_editar?: boolean | null
          pode_visualizar?: boolean | null
          recurso?: string
          role?: Database["public"]["Enums"]["plataforma_pro_forco_role"]
        }
        Relationships: []
      }
      "plataforma-pro-forco-pix_config": {
        Row: {
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          chave_pix: string
          criado_em: string
          criado_por: string | null
          id: string
          nome_beneficiario: string | null
          tipo_chave: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          chave_pix: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome_beneficiario?: string | null
          tipo_chave?: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          chave_pix?: string
          criado_em?: string
          criado_por?: string | null
          id?: string
          nome_beneficiario?: string | null
          tipo_chave?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-professor_disponibilidade": {
        Row: {
          ativo: boolean | null
          criado_em: string | null
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id: string
          professor_id: string
        }
        Insert: {
          ativo?: boolean | null
          criado_em?: string | null
          dia_semana: number
          hora_fim: string
          hora_inicio: string
          id?: string
          professor_id: string
        }
        Update: {
          ativo?: boolean | null
          criado_em?: string | null
          dia_semana?: number
          hora_fim?: string
          hora_inicio?: string
          id?: string
          professor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-professor_disponibilidad_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-professores"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-professor_materias": {
        Row: {
          criado_em: string | null
          id: string
          materia_id: string
          professor_id: string
        }
        Insert: {
          criado_em?: string | null
          id?: string
          materia_id: string
          professor_id: string
        }
        Update: {
          criado_em?: string | null
          id?: string
          materia_id?: string
          professor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-professor_materias_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-materias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-professor_materias_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-professores"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-professores": {
        Row: {
          aguardando_voltar: boolean
          atualizado_em: string | null
          criado_em: string | null
          desmatriculado_em: string | null
          horas_minimas_mes: number | null
          id: string
          limite_alunos_presencial: number
          modalidade: string
          recebe_por_hora: boolean
          status: string
          user_id: string | null
          usuario_id: string
          valor_fixo_negociado: boolean
          valor_hora_aula: number
        }
        Insert: {
          aguardando_voltar?: boolean
          atualizado_em?: string | null
          criado_em?: string | null
          desmatriculado_em?: string | null
          horas_minimas_mes?: number | null
          id?: string
          limite_alunos_presencial?: number
          modalidade?: string
          recebe_por_hora?: boolean
          status?: string
          user_id?: string | null
          usuario_id: string
          valor_fixo_negociado?: boolean
          valor_hora_aula?: number
        }
        Update: {
          aguardando_voltar?: boolean
          atualizado_em?: string | null
          criado_em?: string | null
          desmatriculado_em?: string | null
          horas_minimas_mes?: number | null
          id?: string
          limite_alunos_presencial?: number
          modalidade?: string
          recebe_por_hora?: boolean
          status?: string
          user_id?: string | null
          usuario_id?: string
          valor_fixo_negociado?: boolean
          valor_hora_aula?: number
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-professores_usuario_id_fkey"
            columns: ["usuario_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-usuarios"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-quadro_branco_dados": {
        Row: {
          criado_em: string | null
          dados: Json
          id: string
          reuniao_id: string
          tipo_acao: string
          usuario_id: string
        }
        Insert: {
          criado_em?: string | null
          dados: Json
          id?: string
          reuniao_id: string
          tipo_acao: string
          usuario_id: string
        }
        Update: {
          criado_em?: string | null
          dados?: Json
          id?: string
          reuniao_id?: string
          tipo_acao?: string
          usuario_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-quadro_branco_dados_reuniao_id_fkey"
            columns: ["reuniao_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-reunioes"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-registro_desmatriculas": {
        Row: {
          aluno_id: string
          aluno_nome: string
          ano: number
          criado_em: string | null
          id: string
          mes: number
        }
        Insert: {
          aluno_id: string
          aluno_nome: string
          ano: number
          criado_em?: string | null
          id?: string
          mes: number
        }
        Update: {
          aluno_id?: string
          aluno_nome?: string
          ano?: number
          criado_em?: string | null
          id?: string
          mes?: number
        }
        Relationships: []
      }
      "plataforma-pro-forco-registros_aulas": {
        Row: {
          aula_agendada_id: string
          criado_em: string | null
          data_aula: string
          duracao_minutos: number
          hora_inicio: string
          id: string
          is_reposicao: boolean | null
          justificativa_falta: string | null
          marcado_em: string | null
          marcado_por: string | null
          observacoes: string | null
          status: string
        }
        Insert: {
          aula_agendada_id: string
          criado_em?: string | null
          data_aula: string
          duracao_minutos: number
          hora_inicio: string
          id?: string
          is_reposicao?: boolean | null
          justificativa_falta?: string | null
          marcado_em?: string | null
          marcado_por?: string | null
          observacoes?: string | null
          status?: string
        }
        Update: {
          aula_agendada_id?: string
          criado_em?: string | null
          data_aula?: string
          duracao_minutos?: number
          hora_inicio?: string
          id?: string
          is_reposicao?: boolean | null
          justificativa_falta?: string | null
          marcado_em?: string | null
          marcado_por?: string | null
          observacoes?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-registros_aulas_aula_agendada_id_fkey"
            columns: ["aula_agendada_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-aulas_agendadas"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-reposicoes": {
        Row: {
          aluno_id: string
          analise_falta: string | null
          atualizado_em: string | null
          contabilizar_para_professor: boolean | null
          criado_em: string | null
          data_original: string
          data_reposicao: string | null
          hora_reposicao: string | null
          id: string
          justificativa: string
          materia_id: string
          professor_id: string
          professor_reposicao_id: string | null
          realizada: boolean | null
          registro_aula_id: string
          registro_reposicao_id: string | null
          status_aprovacao: string
        }
        Insert: {
          aluno_id: string
          analise_falta?: string | null
          atualizado_em?: string | null
          contabilizar_para_professor?: boolean | null
          criado_em?: string | null
          data_original: string
          data_reposicao?: string | null
          hora_reposicao?: string | null
          id?: string
          justificativa: string
          materia_id: string
          professor_id: string
          professor_reposicao_id?: string | null
          realizada?: boolean | null
          registro_aula_id: string
          registro_reposicao_id?: string | null
          status_aprovacao?: string
        }
        Update: {
          aluno_id?: string
          analise_falta?: string | null
          atualizado_em?: string | null
          contabilizar_para_professor?: boolean | null
          criado_em?: string | null
          data_original?: string
          data_reposicao?: string | null
          hora_reposicao?: string | null
          id?: string
          justificativa?: string
          materia_id?: string
          professor_id?: string
          professor_reposicao_id?: string | null
          realizada?: boolean | null
          registro_aula_id?: string
          registro_reposicao_id?: string | null
          status_aprovacao?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-reposicoes_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-reposicoes_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-materias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-reposicoes_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-professores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-reposicoes_professor_reposicao_id_fkey"
            columns: ["professor_reposicao_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-professores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-reposicoes_registro_aula_id_fkey"
            columns: ["registro_aula_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-registros_aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-reposicoes_registro_reposicao_id_fkey"
            columns: ["registro_reposicao_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-registros_aulas"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-reunioes": {
        Row: {
          atualizado_em: string | null
          configuracoes: Json | null
          criado_em: string | null
          criado_por: string
          data_fim: string | null
          data_inicio: string
          descricao: string | null
          duracao_maxima_minutos: number | null
          id: string
          link_acesso: string
          provider: string | null
          status: string | null
          titulo: string
          token_sala: string
          zoom_join_url: string | null
          zoom_meeting_id: string | null
          zoom_meeting_password: string | null
        }
        Insert: {
          atualizado_em?: string | null
          configuracoes?: Json | null
          criado_em?: string | null
          criado_por: string
          data_fim?: string | null
          data_inicio: string
          descricao?: string | null
          duracao_maxima_minutos?: number | null
          id?: string
          link_acesso: string
          provider?: string | null
          status?: string | null
          titulo: string
          token_sala: string
          zoom_join_url?: string | null
          zoom_meeting_id?: string | null
          zoom_meeting_password?: string | null
        }
        Update: {
          atualizado_em?: string | null
          configuracoes?: Json | null
          criado_em?: string | null
          criado_por?: string
          data_fim?: string | null
          data_inicio?: string
          descricao?: string | null
          duracao_maxima_minutos?: number | null
          id?: string
          link_acesso?: string
          provider?: string | null
          status?: string | null
          titulo?: string
          token_sala?: string
          zoom_join_url?: string | null
          zoom_meeting_id?: string | null
          zoom_meeting_password?: string | null
        }
        Relationships: []
      }
      "plataforma-pro-forco-sessao_config": {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          horario_fim: string
          horario_inicio: string
          id: string
          role: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          horario_fim?: string
          horario_inicio?: string
          id?: string
          role: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          horario_fim?: string
          horario_inicio?: string
          id?: string
          role?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-solicitacoes_cadastro": {
        Row: {
          aprovado_em: string | null
          aprovado_por: string | null
          criado_em: string | null
          data_inicio: string
          dia_referencia: number
          email: string
          id: string
          nome: string
          nome_responsavel: string
          observacoes_admin: string | null
          observacoes_gerais: string | null
          status: string
          telefone: string | null
          user_id: string | null
        }
        Insert: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          criado_em?: string | null
          data_inicio: string
          dia_referencia: number
          email: string
          id?: string
          nome: string
          nome_responsavel: string
          observacoes_admin?: string | null
          observacoes_gerais?: string | null
          status?: string
          telefone?: string | null
          user_id?: string | null
        }
        Update: {
          aprovado_em?: string | null
          aprovado_por?: string | null
          criado_em?: string | null
          data_inicio?: string
          dia_referencia?: number
          email?: string
          id?: string
          nome?: string
          nome_responsavel?: string
          observacoes_admin?: string | null
          observacoes_gerais?: string | null
          status?: string
          telefone?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      "plataforma-pro-forco-solicitacoes_redefinicao_senha": {
        Row: {
          atendido_em: string | null
          atendido_por: string | null
          atualizado_em: string
          criado_em: string
          email: string
          id: string
          nome: string | null
          observacao: string | null
          status: string
          telefone: string | null
          user_id: string | null
          user_role: string | null
        }
        Insert: {
          atendido_em?: string | null
          atendido_por?: string | null
          atualizado_em?: string
          criado_em?: string
          email: string
          id?: string
          nome?: string | null
          observacao?: string | null
          status?: string
          telefone?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Update: {
          atendido_em?: string | null
          atendido_por?: string | null
          atualizado_em?: string
          criado_em?: string
          email?: string
          id?: string
          nome?: string | null
          observacao?: string | null
          status?: string
          telefone?: string | null
          user_id?: string | null
          user_role?: string | null
        }
        Relationships: []
      }
      "plataforma-pro-forco-somente_uma_aula_webhook": {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          criado_em: string | null
          descricao: string | null
          id: string
          webhook_url: string
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          webhook_url: string
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          criado_em?: string | null
          descricao?: string | null
          id?: string
          webhook_url?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-stripe_config": {
        Row: {
          ambiente: string
          ativo: boolean
          atualizado_em: string
          atualizado_por: string | null
          criado_em: string
          descricao: string | null
          id: string
        }
        Insert: {
          ambiente?: string
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          descricao?: string | null
          id?: string
        }
        Update: {
          ambiente?: string
          ativo?: boolean
          atualizado_em?: string
          atualizado_por?: string | null
          criado_em?: string
          descricao?: string | null
          id?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-stripe_logs": {
        Row: {
          criado_em: string
          erro: string | null
          id: string
          payload: Json | null
          status: string
          tipo_evento: string
        }
        Insert: {
          criado_em?: string
          erro?: string | null
          id?: string
          payload?: Json | null
          status?: string
          tipo_evento: string
        }
        Update: {
          criado_em?: string
          erro?: string | null
          id?: string
          payload?: Json | null
          status?: string
          tipo_evento?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-stripe_webhooks": {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          eventos: string[]
          id: string
          nome: string
          ultimo_disparo: string | null
          ultimo_status: string | null
          url: string
          webhook_secret: string | null
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          eventos?: string[]
          id?: string
          nome: string
          ultimo_disparo?: string | null
          ultimo_status?: string | null
          url: string
          webhook_secret?: string | null
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          eventos?: string[]
          id?: string
          nome?: string
          ultimo_disparo?: string | null
          ultimo_status?: string | null
          url?: string
          webhook_secret?: string | null
        }
        Relationships: []
      }
      "plataforma-pro-forco-transacoes_professores": {
        Row: {
          aluno_id: string
          criado_em: string
          criado_por: string | null
          data_aula: string
          duracao_minutos: number
          excluido: boolean
          excluido_em: string | null
          excluido_por: string | null
          id: string
          materia_id: string
          motivo_exclusao: string | null
          observacoes: string | null
          professor_id: string
          registro_aula_id: string | null
          tipo_transacao: string
          valor_hora_aula: number
          valor_total: number
        }
        Insert: {
          aluno_id: string
          criado_em?: string
          criado_por?: string | null
          data_aula: string
          duracao_minutos: number
          excluido?: boolean
          excluido_em?: string | null
          excluido_por?: string | null
          id?: string
          materia_id: string
          motivo_exclusao?: string | null
          observacoes?: string | null
          professor_id: string
          registro_aula_id?: string | null
          tipo_transacao?: string
          valor_hora_aula: number
          valor_total: number
        }
        Update: {
          aluno_id?: string
          criado_em?: string
          criado_por?: string | null
          data_aula?: string
          duracao_minutos?: number
          excluido?: boolean
          excluido_em?: string | null
          excluido_por?: string | null
          id?: string
          materia_id?: string
          motivo_exclusao?: string | null
          observacoes?: string | null
          professor_id?: string
          registro_aula_id?: string | null
          tipo_transacao?: string
          valor_hora_aula?: number
          valor_total?: number
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-transacoes_professor_registro_aula_id_fkey"
            columns: ["registro_aula_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-registros_aulas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-pro-forco-transacoes_professores_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-professores"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-pro-forco-user_roles": {
        Row: {
          criado_em: string | null
          id: string
          role: Database["public"]["Enums"]["plataforma_pro_forco_role"]
          user_id: string
        }
        Insert: {
          criado_em?: string | null
          id?: string
          role: Database["public"]["Enums"]["plataforma_pro_forco_role"]
          user_id: string
        }
        Update: {
          criado_em?: string | null
          id?: string
          role?: Database["public"]["Enums"]["plataforma_pro_forco_role"]
          user_id?: string
        }
        Relationships: []
      }
      "plataforma-pro-forco-usuarios": {
        Row: {
          ativo: boolean | null
          atualizado_em: string | null
          avatar_url: string | null
          chave_pix: string | null
          criado_em: string | null
          email: string | null
          endereco: string | null
          id: string
          nome: string
          telefone: string | null
          tipo_chave_pix: string | null
        }
        Insert: {
          ativo?: boolean | null
          atualizado_em?: string | null
          avatar_url?: string | null
          chave_pix?: string | null
          criado_em?: string | null
          email?: string | null
          endereco?: string | null
          id: string
          nome: string
          telefone?: string | null
          tipo_chave_pix?: string | null
        }
        Update: {
          ativo?: boolean | null
          atualizado_em?: string | null
          avatar_url?: string | null
          chave_pix?: string | null
          criado_em?: string | null
          email?: string | null
          endereco?: string | null
          id?: string
          nome?: string
          telefone?: string | null
          tipo_chave_pix?: string | null
        }
        Relationships: []
      }
      "plataforma-pro-forco-webrtc_sinais": {
        Row: {
          criado_em: string | null
          dados: Json
          destinatario_id: string
          id: string
          remetente_id: string
          reuniao_id: string
          tipo: string
        }
        Insert: {
          criado_em?: string | null
          dados: Json
          destinatario_id: string
          id?: string
          remetente_id: string
          reuniao_id: string
          tipo: string
        }
        Update: {
          criado_em?: string | null
          dados?: Json
          destinatario_id?: string
          id?: string
          remetente_id?: string
          reuniao_id?: string
          tipo?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-pro-forco-webrtc_sinais_reuniao_id_fkey"
            columns: ["reuniao_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-reunioes"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-proforco_atividade_arquivos": {
        Row: {
          atividade_id: string
          ativo: boolean
          criado_em: string
          id: string
          nome_arquivo: string
          ordem: number
          tamanho: number | null
          tipo: string
          url_arquivo: string
        }
        Insert: {
          atividade_id: string
          ativo?: boolean
          criado_em?: string
          id?: string
          nome_arquivo: string
          ordem?: number
          tamanho?: number | null
          tipo?: string
          url_arquivo: string
        }
        Update: {
          atividade_id?: string
          ativo?: boolean
          criado_em?: string
          id?: string
          nome_arquivo?: string
          ordem?: number
          tamanho?: number | null
          tipo?: string
          url_arquivo?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-proforco_atividade_arquivos_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "plataforma-proforco_biblioteca_atividades"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-proforco_atividade_observacoes": {
        Row: {
          criado_em: string
          id: string
          observacao: string
          professor_id: string
          progresso_id: string
        }
        Insert: {
          criado_em?: string
          id?: string
          observacao: string
          professor_id: string
          progresso_id: string
        }
        Update: {
          criado_em?: string
          id?: string
          observacao?: string
          professor_id?: string
          progresso_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-proforco_atividade_observacoes_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-professores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-proforco_atividade_observacoes_progresso_id_fkey"
            columns: ["progresso_id"]
            isOneToOne: false
            referencedRelation: "plataforma-proforco_progresso_alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-proforco_biblioteca_atividades": {
        Row: {
          arquivo_nome: string
          arquivo_tamanho: number | null
          arquivo_tipo: string
          arquivo_url: string | null
          ativo: boolean
          atualizado_em: string
          capa_url: string | null
          conteudo_texto: string | null
          criado_em: string
          criado_por_id: string | null
          descricao: string | null
          id: string
          materia_id: string
          tipo_estrutura: string
          titulo: string
          total_paginas: number | null
        }
        Insert: {
          arquivo_nome: string
          arquivo_tamanho?: number | null
          arquivo_tipo: string
          arquivo_url?: string | null
          ativo?: boolean
          atualizado_em?: string
          capa_url?: string | null
          conteudo_texto?: string | null
          criado_em?: string
          criado_por_id?: string | null
          descricao?: string | null
          id?: string
          materia_id: string
          tipo_estrutura?: string
          titulo: string
          total_paginas?: number | null
        }
        Update: {
          arquivo_nome?: string
          arquivo_tamanho?: number | null
          arquivo_tipo?: string
          arquivo_url?: string | null
          ativo?: boolean
          atualizado_em?: string
          capa_url?: string | null
          conteudo_texto?: string | null
          criado_em?: string
          criado_por_id?: string | null
          descricao?: string | null
          id?: string
          materia_id?: string
          tipo_estrutura?: string
          titulo?: string
          total_paginas?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-proforco_biblioteca_atividades_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-materias"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-proforco_observacoes_sessao": {
        Row: {
          aluno_id: string
          arquivo_id: string | null
          atividade_id: string | null
          criado_em: string
          data_aula: string
          id: string
          materia_id: string | null
          observacao: string
          professor_id: string
          progresso_id: string | null
          sincronizado_com_anotacao: boolean
        }
        Insert: {
          aluno_id: string
          arquivo_id?: string | null
          atividade_id?: string | null
          criado_em?: string
          data_aula?: string
          id?: string
          materia_id?: string | null
          observacao: string
          professor_id: string
          progresso_id?: string | null
          sincronizado_com_anotacao?: boolean
        }
        Update: {
          aluno_id?: string
          arquivo_id?: string | null
          atividade_id?: string | null
          criado_em?: string
          data_aula?: string
          id?: string
          materia_id?: string | null
          observacao?: string
          professor_id?: string
          progresso_id?: string | null
          sincronizado_com_anotacao?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-proforco_observacoes_sessao_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-proforco_observacoes_sessao_arquivo_id_fkey"
            columns: ["arquivo_id"]
            isOneToOne: false
            referencedRelation: "plataforma-proforco_atividade_arquivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-proforco_observacoes_sessao_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "plataforma-proforco_biblioteca_atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-proforco_observacoes_sessao_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-materias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-proforco_observacoes_sessao_professor_id_fkey"
            columns: ["professor_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-professores"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-proforco_observacoes_sessao_progresso_id_fkey"
            columns: ["progresso_id"]
            isOneToOne: false
            referencedRelation: "plataforma-proforco_progresso_alunos"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-proforco_progresso_alunos": {
        Row: {
          aluno_id: string
          atividade_id: string
          atualizado_em: string
          concluido_em: string | null
          id: string
          iniciado_em: string
          materia_id: string
          status: string
          total_paginas: number
          ultima_pagina_concluida: number
        }
        Insert: {
          aluno_id: string
          atividade_id: string
          atualizado_em?: string
          concluido_em?: string | null
          id?: string
          iniciado_em?: string
          materia_id: string
          status?: string
          total_paginas?: number
          ultima_pagina_concluida?: number
        }
        Update: {
          aluno_id?: string
          atividade_id?: string
          atualizado_em?: string
          concluido_em?: string | null
          id?: string
          iniciado_em?: string
          materia_id?: string
          status?: string
          total_paginas?: number
          ultima_pagina_concluida?: number
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-proforco_progresso_alunos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-proforco_progresso_alunos_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "plataforma-proforco_biblioteca_atividades"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-proforco_progresso_alunos_materia_id_fkey"
            columns: ["materia_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-materias"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-proforco_progresso_arquivos": {
        Row: {
          aluno_id: string
          arquivo_id: string
          atividade_id: string
          atualizado_em: string
          concluido: boolean
          criado_em: string
          data_conclusao: string | null
          id: string
          observacao: string | null
        }
        Insert: {
          aluno_id: string
          arquivo_id: string
          atividade_id: string
          atualizado_em?: string
          concluido?: boolean
          criado_em?: string
          data_conclusao?: string | null
          id?: string
          observacao?: string | null
        }
        Update: {
          aluno_id?: string
          arquivo_id?: string
          atividade_id?: string
          atualizado_em?: string
          concluido?: boolean
          criado_em?: string
          data_conclusao?: string | null
          id?: string
          observacao?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-proforco_progresso_arquivos_aluno_id_fkey"
            columns: ["aluno_id"]
            isOneToOne: false
            referencedRelation: "plataforma-pro-forco-alunos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-proforco_progresso_arquivos_arquivo_id_fkey"
            columns: ["arquivo_id"]
            isOneToOne: false
            referencedRelation: "plataforma-proforco_atividade_arquivos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plataforma-proforco_progresso_arquivos_atividade_id_fkey"
            columns: ["atividade_id"]
            isOneToOne: false
            referencedRelation: "plataforma-proforco_biblioteca_atividades"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-proforco_roles_secundarias": {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      "plataforma-proforco_treinamento_acesso": {
        Row: {
          atualizado_em: string
          id: string
          pode_deletar: boolean
          pode_editar: boolean
          pode_visualizar: boolean
          role: string
        }
        Insert: {
          atualizado_em?: string
          id?: string
          pode_deletar?: boolean
          pode_editar?: boolean
          pode_visualizar?: boolean
          role: string
        }
        Update: {
          atualizado_em?: string
          id?: string
          pode_deletar?: boolean
          pode_editar?: boolean
          pode_visualizar?: boolean
          role?: string
        }
        Relationships: []
      }
      "plataforma-proforco_treinamento_cursos": {
        Row: {
          ativo: boolean
          atualizado_em: string
          capa_url: string | null
          criado_em: string
          criado_por_id: string | null
          descricao: string | null
          id: string
          titulo: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          capa_url?: string | null
          criado_em?: string
          criado_por_id?: string | null
          descricao?: string | null
          id?: string
          titulo: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          capa_url?: string | null
          criado_em?: string
          criado_por_id?: string | null
          descricao?: string | null
          id?: string
          titulo?: string
        }
        Relationships: []
      }
      "plataforma-proforco_treinamento_modulos": {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          curso_id: string
          descricao: string | null
          id: string
          ordem: number
          titulo: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          curso_id: string
          descricao?: string | null
          id?: string
          ordem?: number
          titulo: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          curso_id?: string
          descricao?: string | null
          id?: string
          ordem?: number
          titulo?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-proforco_treinamento_modulos_curso_id_fkey"
            columns: ["curso_id"]
            isOneToOne: false
            referencedRelation: "plataforma-proforco_treinamento_cursos"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-proforco_treinamento_progresso": {
        Row: {
          atualizado_em: string
          data_visto: string | null
          id: string
          posicao_segundos: number
          usuario_id: string
          video_id: string
          visto: boolean
        }
        Insert: {
          atualizado_em?: string
          data_visto?: string | null
          id?: string
          posicao_segundos?: number
          usuario_id: string
          video_id: string
          visto?: boolean
        }
        Update: {
          atualizado_em?: string
          data_visto?: string | null
          id?: string
          posicao_segundos?: number
          usuario_id?: string
          video_id?: string
          visto?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-proforco_treinamento_progresso_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "plataforma-proforco_treinamento_videos"
            referencedColumns: ["id"]
          },
        ]
      }
      "plataforma-proforco_treinamento_videos": {
        Row: {
          ativo: boolean
          atualizado_em: string
          criado_em: string
          duracao_segundos: number | null
          id: string
          modulo_id: string
          ordem: number
          tags: string[] | null
          titulo: string
          video_url: string
        }
        Insert: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          duracao_segundos?: number | null
          id?: string
          modulo_id: string
          ordem?: number
          tags?: string[] | null
          titulo: string
          video_url: string
        }
        Update: {
          ativo?: boolean
          atualizado_em?: string
          criado_em?: string
          duracao_segundos?: number | null
          id?: string
          modulo_id?: string
          ordem?: number
          tags?: string[] | null
          titulo?: string
          video_url?: string
        }
        Relationships: [
          {
            foreignKeyName: "plataforma-proforco_treinamento_videos_modulo_id_fkey"
            columns: ["modulo_id"]
            isOneToOne: false
            referencedRelation: "plataforma-proforco_treinamento_modulos"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      tags: {
        Row: {
          color: string | null
          created_at: string
          id: number
          index: number
          nome: string | null
        }
        Insert: {
          color?: string | null
          created_at?: string
          id?: number
          index?: number
          nome?: string | null
        }
        Update: {
          color?: string | null
          created_at?: string
          id?: number
          index?: number
          nome?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          admin: boolean | null
          created_at: string
          email: string | null
          id: number
          nome: string | null
          user_auth: string | null
        }
        Insert: {
          admin?: boolean | null
          created_at?: string
          email?: string | null
          id?: number
          nome?: string | null
          user_auth?: string | null
        }
        Update: {
          admin?: boolean | null
          created_at?: string
          email?: string | null
          id?: number
          nome?: string | null
          user_auth?: string | null
        }
        Relationships: []
      }
      usuarios: {
        Row: {
          created_at: string
          followUp: string | null
          id: number
          mensagem: string | null
          nome: string | null
          status: string | null
          ultima_msg: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          followUp?: string | null
          id?: number
          mensagem?: string | null
          nome?: string | null
          status?: string | null
          ultima_msg?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          followUp?: string | null
          id?: number
          mensagem?: string | null
          nome?: string | null
          status?: string | null
          ultima_msg?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      "usuarios_Pro-Forco_Bahia": {
        Row: {
          created_at: string
          id: number
          nome: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          nome?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          nome?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      usuarios_proforcobetim: {
        Row: {
          created_at: string
          id: number
          nome: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          nome?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          nome?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      usuarios_SaoPaulo_Proforco: {
        Row: {
          created_at: string
          followUp: string | null
          id: number
          nome: string | null
          status: string | null
          ultima_msg: string | null
          whatsapp: string | null
        }
        Insert: {
          created_at?: string
          followUp?: string | null
          id?: number
          nome?: string | null
          status?: string | null
          ultima_msg?: string | null
          whatsapp?: string | null
        }
        Update: {
          created_at?: string
          followUp?: string | null
          id?: number
          nome?: string | null
          status?: string | null
          ultima_msg?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      "CRM-multi-empresas>alunos_desmatriculados<": {
        Row: {
          aluno_id: string | null
          aluno_nome: string | null
          ano: number | null
          ano_escolar: string | null
          criado_em: string | null
          email: string | null
          id: string | null
          idade: number | null
          mes: number | null
          modalidade: string | null
          nome_responsavel: string | null
          telefone: string | null
        }
        Relationships: []
      }
      "CRM-multi-empresas>lead_conversion_stats<": {
        Row: {
          marcaram_aula: number | null
          nao_entraram_aula: number | null
          percentual_marcaram: number | null
          percentual_nao_entraram: number | null
          percentual_realizaram: number | null
          percentual_vendas: number | null
          realizaram_aula: number | null
          total_leads: number | null
          vendas_perdidas: number | null
          vendas_realizadas: number | null
        }
        Relationships: []
      }
      "CRM-multi-empresas>lead_evolution_stats<": {
        Row: {
          data: string | null
          receita: number | null
          total_leads: number | null
          vendas: number | null
        }
        Relationships: []
      }
      "CRM-multi-empresas>lead_origin_stats<": {
        Row: {
          origem: string | null
          receita: number | null
          total_leads: number | null
          vendas: number | null
        }
        Relationships: []
      }
      "CRM-multi-empresas>vendor_performance_stats<": {
        Row: {
          avatar_url: string | null
          receita: number | null
          taxa_conversao: number | null
          ticket_medio: number | null
          total_leads: number | null
          vendas: number | null
          vendedor_id: string | null
          vendedor_nome: string | null
        }
        Relationships: []
      }
      vw_contatos: {
        Row: {
          atendente: string | null
          id: number | null
          instance_id: number | null
          mensagens_nao_lida: number | null
          mostrar: boolean | null
          nome: string | null
          nova_mensagem: boolean | null
          push_name: string | null
          tag_id: number | null
          timestamp: string | null
          ultima_mensagem: string | null
        }
        Insert: {
          atendente?: string | null
          id?: number | null
          instance_id?: number | null
          mensagens_nao_lida?: number | null
          mostrar?: boolean | null
          nome?: string | null
          nova_mensagem?: boolean | null
          push_name?: string | null
          tag_id?: number | null
          timestamp?: string | null
          ultima_mensagem?: string | null
        }
        Update: {
          atendente?: string | null
          id?: number | null
          instance_id?: number | null
          mensagens_nao_lida?: number | null
          mostrar?: boolean | null
          nome?: string | null
          nova_mensagem?: boolean | null
          push_name?: string | null
          tag_id?: number | null
          timestamp?: string | null
          ultima_mensagem?: string | null
        }
        Relationships: []
      }
      vw_deletar_mensagem: {
        Row: {
          audio_reply: string | null
          audio_url: string | null
          created_at: string | null
          deletado: boolean | null
          from_me: boolean | null
          id: number | null
          id_chat: string | null
          id_contato: number | null
          imagem_reply: string | null
          imagem_url: string | null
          mensagem: string | null
          mensagem_id: string | null
          pdf_reply: string | null
          pdf_url: string | null
          reply: string | null
          timestamp: string | null
          tipo_mensagem: string | null
          url_deletar: string | null
          url_reply_deletar: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chats_id_contato_fkey"
            columns: ["id_contato"]
            isOneToOne: false
            referencedRelation: "contatos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chats_id_contato_fkey"
            columns: ["id_contato"]
            isOneToOne: false
            referencedRelation: "vw_contatos"
            referencedColumns: ["id"]
          },
        ]
      }
      vw_instances: {
        Row: {
          id: number | null
          name: string | null
        }
        Insert: {
          id?: number | null
          name?: string | null
        }
        Update: {
          id?: number | null
          name?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      admin_delete_user_sessions: {
        Args: { p_user_id: string }
        Returns: undefined
      }
      approve_user: {
        Args: {
          _new_role: Database["public"]["Enums"]["selletos_crm_app_role"]
          _user_id: string
        }
        Returns: undefined
      }
      atualizar_cron_mensagem_diaria: {
        Args: { nova_expressao: string }
        Returns: undefined
      }
      atualizar_faturas_atrasadas: { Args: never; Returns: undefined }
      buscar_codigo: {
        Args: { termo_busca: string }
        Returns: {
          arquivo_nome: string
          arquivo_path: string
          categoria: string
          conteudo_linha: string
          id: string
          numero_linha: number
        }[]
      }
      can_access_chat_financeiro: {
        Args: { user_uuid: string }
        Returns: boolean
      }
      can_manage_lead: {
        Args: { _lead_id: number; _user_id: string }
        Returns: boolean
      }
      chat_list_contatos: {
        Args: never
        Returns: {
          avatar_url: string
          email: string
          id: string
          mensagens_nao_lidas: number
          nome: string
          role: string
        }[]
      }
      chat_start_conversation: { Args: { _target_id: string }; Returns: string }
      create_lead_notification: {
        Args: {
          _lead_id: number
          _notification_type: string
          _vendor_id: string
          _vendor_name: string
        }
        Returns: undefined
      }
      find_auth_user_id_by_email: { Args: { _email: string }; Returns: string }
      gerar_numero_recibo: { Args: never; Returns: string }
      gerar_numero_recibo_despesa: { Args: never; Returns: string }
      gerar_registros_aula_sync: {
        Args: { p_aula_id?: string; p_dias?: number }
        Returns: {
          aulas_processadas: number
          registros_criados: number
        }[]
      }
      get_active_sessions: {
        Args: never
        Returns: {
          created_at: string
          email: string
          ip: unknown
          nome: string
          not_after: string
          role: string
          session_id: string
          telefone: string
          updated_at: string
          user_agent: string
          user_id: string
        }[]
      }
      get_anotacoes_professor_aluno: {
        Args: { p_aluno_id: string }
        Returns: {
          anotacao: string
          criado_em: string
          data_aula: string
          id: string
          materia_cor: string
          materia_nome: string
          professor_nome: string
        }[]
      }
      get_arquivo_completo: {
        Args: { path_arquivo: string }
        Returns: {
          conteudo_linha: string
          eh_comentario: boolean
          eh_funcao: boolean
          eh_import: boolean
          numero_linha: number
        }[]
      }
      get_biblioteca_atividades_com_contagem: {
        Args: { p_materia_id?: string }
        Returns: {
          arquivo_nome: string
          arquivo_tamanho: number
          arquivo_tipo: string
          arquivo_url: string
          arquivos_count: number
          ativo: boolean
          atualizado_em: string
          capa_url: string
          conteudo_texto: string
          criado_em: string
          criado_por_id: string
          criador_nome: string
          descricao: string
          id: string
          materia_cor: string
          materia_id: string
          materia_nome: string
          tipo_estrutura: string
          titulo: string
          total_paginas: number
        }[]
      }
      get_conversion_stats_filtered: {
        Args: { _cutoff_date: string }
        Returns: {
          marcaram_aula: number
          nao_entraram_aula: number
          percentual_marcaram: number
          percentual_nao_entraram: number
          percentual_realizaram: number
          percentual_vendas: number
          realizaram_aula: number
          total_leads: number
          vendas_perdidas: number
          vendas_realizadas: number
        }[]
      }
      get_crm_multiempresas_marketing_ai_studio_status: {
        Args: Record<string, never>
        Returns: {
          id: string
          ativo: boolean
          model_pesquisa: string
          model_copy: string
          openai_configured: boolean
          openai_key_hint: string
          serp_configured: boolean
          serp_key_hint: string
          atualizado_em: string
        }[]
      }
      get_observacoes_crm_aluno: {
        Args: { p_aluno_id: string }
        Returns: {
          conteudo: string
          criado_em: string
          criado_por_nome: string
          id: string
          rotulo: string
        }[]
      }
      get_origin_stats_filtered: {
        Args: { _cutoff_date: string }
        Returns: {
          origem: string
          receita: number
          total_leads: number
          vendas: number
        }[]
      }
      get_pf_aluno_id: { Args: { _user_id: string }; Returns: string }
      get_pf_professor_id: { Args: { _user_id: string }; Returns: string }
      get_pf_user_role: { Args: { _user_id: string }; Returns: string }
      get_session_devices: { Args: never; Returns: Json }
      get_session_devices_filtered: {
        Args: { p_data_fim?: string; p_data_inicio?: string }
        Returns: Json
      }
      get_session_metrics: {
        Args: { p_data_fim: string; p_data_inicio: string }
        Returns: Json
      }
      get_sessions_by_period: {
        Args: { p_data_fim: string; p_data_inicio: string }
        Returns: {
          created_at: string
          email: string
          ip: unknown
          nome: string
          not_after: string
          role: string
          session_id: string
          telefone: string
          updated_at: string
          user_agent: string
          user_id: string
        }[]
      }
      get_stats_por_categoria: {
        Args: never
        Returns: {
          categoria: string
          total_arquivos: number
          total_comentarios: number
          total_funcoes: number
          total_imports: number
          total_linhas: number
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["selletos_crm_app_role"]
      }
      get_vendor_performance_filtered: {
        Args: { _cutoff_date: string }
        Returns: {
          avatar_url: string
          receita: number
          taxa_conversao: number
          ticket_medio: number
          total_leads: number
          vendas: number
          vendedor_id: string
          vendedor_nome: string
        }[]
      }
      has_permission: {
        Args: { _action: string; _resource: string; _user_id: string }
        Returns: boolean
      }
      has_pf_role: {
        Args: {
          _roles: Database["public"]["Enums"]["plataforma_pro_forco_role"][]
          _user_id: string
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _user_id: string }; Returns: boolean }
      is_chat_admin: { Args: { _user_id: string }; Returns: boolean }
      is_chat_participant: {
        Args: { _conversa_id: string; _user_id: string }
        Returns: boolean
      }
      is_chat_pedagogia: { Args: { _user_id: string }; Returns: boolean }
      is_ecommerce_seletos_admin: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_participant_of_meeting: {
        Args: { _reuniao_id: string; _user_id: string }
        Returns: boolean
      }
      is_pf_admin: { Args: { _user_id: string }; Returns: boolean }
      is_pf_aluno: { Args: { _user_id: string }; Returns: boolean }
      is_pf_auxiliar_financeiro: {
        Args: { _user_id: string }
        Returns: boolean
      }
      is_pf_professor: { Args: { _user_id: string }; Returns: boolean }
      is_pf_vendedor: { Args: { _user_id: string }; Returns: boolean }
      is_vendedor: { Args: { _user_id: string }; Returns: boolean }
      marcar_reposicao_transacional: {
        Args: {
          p_aluno_id: string
          p_data_selecionada: string
          p_dia_semana: number
          p_duracao_minutos: number
          p_hora_inicio: string
          p_materia_id: string
          p_professor_id: string
          p_registro_antigo_id?: string
          p_reposicao_id: string
        }
        Returns: {
          aula_agendada_id: string
          mensagem: string
          registro_aula_id: string
          sucesso: boolean
        }[]
      }
      match_documents: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      match_documents_flutterflow: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      match_documents_lovable: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      match_documents_n8n: {
        Args: { filter?: Json; match_count?: number; query_embedding: string }
        Returns: {
          content: string
          id: number
          metadata: Json
          similarity: number
        }[]
      }
      pode_ver_usuario_chat_safe: {
        Args: { _target: string; _viewer: string }
        Returns: boolean
      }
      professor_tem_aluno_na_grade: {
        Args: { _aluno_id: string; _professor_user_id: string }
        Returns: boolean
      }
      professor_tem_aulas_ativas: {
        Args: { professor_uuid: string }
        Returns: boolean
      }
      professor_tem_reposicao_com_aluno: {
        Args: { _aluno_id: string; _professor_user_id: string }
        Returns: boolean
      }
      reject_user: { Args: { _user_id: string }; Returns: undefined }
      tem_acesso_treinamento: {
        Args: { _permissao: string; _user_id: string }
        Returns: boolean
      }
      tem_permissao: {
        Args: { _recurso: string; _tipo: string; _user_id: string }
        Returns: boolean
      }
      tem_role_primaria: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      tem_role_secundaria: {
        Args: { _role: string; _user_id: string }
        Returns: boolean
      }
      vincular_google_login: {
        Args: { _email: string; _google_user_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "user"
      categoria:
        | "Supermercado"
        | "Academia"
        | "Farmácia"
        | "Delivery"
        | "Capacitação"
        | "Bar"
        | "Aluguel"
        | "Salário"
      "Dias da Semana": "Segunda" | "Terça" | "Quarta" | "Quinta" | "Sexta"
      plataforma_pro_forco_role:
        | "admin"
        | "professor"
        | "aluno"
        | "pedagogia"
        | "auxiliar_financeiro"
        | "vendedor"
      selletos_crm_app_role: "admin" | "vendedor" | "nenhum" | "marketing"
      tipo: "Entrada" | "Saída"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
      categoria: [
        "Supermercado",
        "Academia",
        "Farmácia",
        "Delivery",
        "Capacitação",
        "Bar",
        "Aluguel",
        "Salário",
      ],
      "Dias da Semana": ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"],
      plataforma_pro_forco_role: [
        "admin",
        "professor",
        "aluno",
        "pedagogia",
        "auxiliar_financeiro",
        "vendedor",
      ],
      selletos_crm_app_role: ["admin", "vendedor", "nenhum", "marketing"],
      tipo: ["Entrada", "Saída"],
    },
  },
} as const
