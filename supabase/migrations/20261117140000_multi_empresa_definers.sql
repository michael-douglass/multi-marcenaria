-- M09 — Funções SECURITY DEFINER "comuns" passam a ser do app_tenant_definer (sem BYPASSRLS):
-- continuam ignorando as policies de papel, mas respeitam a RESTRICTIVE de tenant. Ver DESIGN §1.1.

drop policy if exists tenant_definer on public.n8n_chat_histories;
create policy tenant_definer on public.n8n_chat_histories for all to app_tenant_definer using (true) with check (true);
drop policy if exists tenant_definer on public.n8n_chat_histories_proforco_saopaulo;
create policy tenant_definer on public.n8n_chat_histories_proforco_saopaulo for all to app_tenant_definer using (true) with check (true);
drop policy if exists tenant_definer on public."usuarios_SaoPaulo_Proforco";
create policy tenant_definer on public."usuarios_SaoPaulo_Proforco" for all to app_tenant_definer using (true) with check (true);
grant usage on schema crm to app_tenant_definer;
grant all on all tables in schema crm to app_tenant_definer;
grant all on all sequences in schema crm to app_tenant_definer;
grant execute on all functions in schema crm to app_tenant_definer;
grant create on schema crm to app_tenant_definer;
alter default privileges in schema crm grant all on tables to app_tenant_definer;
alter default privileges in schema crm grant all on sequences to app_tenant_definer;

-- GERADO: funções SECURITY DEFINER passam a ser do app_tenant_definer (sem BYPASSRLS).

alter function "public"."approve_user"(_user_id uuid, _new_role selletos_crm_app_role) owner to app_tenant_definer;
alter function "public"."can_manage_lead"(_user_id uuid, _lead_id bigint) owner to app_tenant_definer;
alter function "public"."create_lead_notification"(_lead_id bigint, _notification_type text, _vendor_id uuid, _vendor_name text) owner to app_tenant_definer;
alter function "public"."get_conversion_stats_filtered"(_cutoff_date date) owner to app_tenant_definer;
alter function "public"."get_crm_multiempresas_marketing_ai_studio_status"() owner to app_tenant_definer;
alter function "public"."get_marketing_ai_studio_status"() owner to app_tenant_definer;
alter function "public"."get_marketing_ai_webhook_status"() owner to app_tenant_definer;
alter function "public"."get_origin_stats_filtered"(_cutoff_date date) owner to app_tenant_definer;
alter function "public"."get_user_role"(_user_id uuid) owner to app_tenant_definer;
alter function "public"."get_vendor_performance_filtered"(_cutoff_date date) owner to app_tenant_definer;
alter function "public"."handle_lead_status_change"() owner to app_tenant_definer;
alter function "public"."has_crm_role"(_user_id uuid, _role selletos_crm_app_role) owner to app_tenant_definer;
alter function "public"."has_role"(_user_id uuid, _role app_role) owner to app_tenant_definer;
alter function "public"."is_chat_admin"(_user_id uuid) owner to app_tenant_definer;
alter function "public"."is_ecommerce_seletos_admin"(_user_id uuid) owner to app_tenant_definer;
alter function "public"."is_pf_admin"(_user_id uuid) owner to app_tenant_definer;
alter function "public"."marketing_p2p_grant_commission"(_seller_id uuid, _event_key text, _entity_type text, _entity_id text, _source_proof_id uuid) owner to app_tenant_definer;
alter function "public"."marketing_p2p_record_daily_move"(_seller_id uuid, _entity_type text, _entity_id text, _event_kind text) owner to app_tenant_definer;
alter function "public"."match_ai_memories"(query_embedding vector, filter_company_id uuid, match_threshold double precision, match_count integer) owner to app_tenant_definer;
alter function "crm"."match_lead_knowledge"(p_lead_id bigint, query_embedding vector, match_count integer, match_threshold double precision) owner to app_tenant_definer;
alter function "public"."match_lead_knowledge_me"(p_lead_id bigint, query_embedding vector, match_count integer, match_threshold double precision) owner to app_tenant_definer;
alter function "public"."me_get_empresa_do_usuario"(_user_id uuid) owner to app_tenant_definer;
alter function "public"."me_get_schema_empresa"(_user_id uuid) owner to app_tenant_definer;
alter function "public"."me_get_user_role"(_user_id uuid) owner to app_tenant_definer;
alter function "public"."me_get_user_roles"(_user_id uuid) owner to app_tenant_definer;
alter function "public"."me_has_permission"(_user_id uuid, _resource text, _action text) owner to app_tenant_definer;
alter function "public"."me_user_has_role"(_user_id uuid, _role selletos_crm_app_role) owner to app_tenant_definer;
alter function "public"."movelaria_admissao_publica_obter"(p_token uuid) owner to app_tenant_definer;
alter function "public"."movelaria_admissao_publica_registrar_doc"(p_token uuid, p_tipo_documento text, p_nome_arquivo text, p_tipo_mime text, p_storage_path text, p_kind text) owner to app_tenant_definer;
alter function "public"."movelaria_admissao_publica_salvar"(p_token uuid, p_dados jsonb, p_finalizar boolean) owner to app_tenant_definer;
alter function "public"."movelaria_ao_criar_usuario"() owner to app_tenant_definer;
alter function "public"."movelaria_aplicar_comissao_obra"(p_obra_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_aplicar_comissao_obra_interno"(p_obra_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_atualizar_contrato"(p_id uuid, p_cliente_nome text, p_identificador text, p_campos_valores jsonb, p_status text) owner to app_tenant_definer;
alter function "public"."movelaria_atualizar_fixo_funcionario"(p_funcionario_id uuid, p_valor numeric, p_primeiro_vencimento date) owner to app_tenant_definer;
alter function "public"."movelaria_atualizar_fixo_montador"(p_montador_id uuid, p_valor numeric, p_primeiro_vencimento date) owner to app_tenant_definer;
alter function "public"."movelaria_atualizar_perfil_usuario"(p_id uuid, p_perfil text, p_ativo boolean) owner to app_tenant_definer;
alter function "public"."movelaria_atualizar_perfil_usuario"(p_id uuid, p_perfil text, p_nome text, p_ativo boolean, p_perfis_extras text[]) owner to app_tenant_definer;
alter function "public"."movelaria_buscar_contrato"(p_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_concluir_obra"(p_obra_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_criar_conta_pagar_pontua_garbo"(p_liberacao_id uuid, p_prestador_id uuid, p_lead_id integer, p_valor_comissao numeric) owner to app_tenant_definer;
alter function "public"."movelaria_criar_markup_orcamento_lead"(p_lead_id text, p_titulo text, p_linhas jsonb) owner to app_tenant_definer;
alter function "public"."movelaria_criar_obra_de_orcamento"(p_orcamento_id uuid, p_cliente_id uuid, p_cliente_nome text, p_lead_id text, p_lousa text) owner to app_tenant_definer;
alter function "public"."movelaria_criar_obra_producao"(p_obra_id uuid, p_lead_id bigint) owner to app_tenant_definer;
alter function "public"."movelaria_crm_agenda_boot"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_agenda_criar"(p_titulo text, p_inicio timestamp with time zone, p_fim timestamp with time zone, p_convidado text, p_whatsapp text, p_lead_id bigint) owner to app_tenant_definer;
alter function "public"."movelaria_crm_agenda_publica"(p_slug text) owner to app_tenant_definer;
alter function "public"."movelaria_crm_agenda_publica_criar"(p_slug text, p_nome text, p_whatsapp text, p_inicio timestamp with time zone) owner to app_tenant_definer;
alter function "public"."movelaria_crm_agenda_salvar"(p_id uuid, p_titulo text, p_inicio timestamp with time zone, p_fim timestamp with time zone, p_convidado text, p_whatsapp text, p_status text, p_lead_id bigint, p_observacoes text) owner to app_tenant_definer;
alter function "public"."movelaria_crm_automacoes_boot"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_automacoes_salvar_atalho"(p_id bigint, p_titulo text, p_mensagem text) owner to app_tenant_definer;
alter function "public"."movelaria_crm_automacoes_salvar_negativado"(p_telefone bigint) owner to app_tenant_definer;
alter function "public"."movelaria_crm_chat_boot"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_colaborador_roles"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_contrato_criar"(p_identificador text, p_cliente_nome text, p_lead_id bigint, p_campos jsonb, p_conteudo text) owner to app_tenant_definer;
alter function "public"."movelaria_crm_contrato_salvar"(p_id uuid, p_identificador text, p_cliente_nome text, p_status text, p_lead_id bigint, p_campos jsonb, p_conteudo text) owner to app_tenant_definer;
alter function "public"."movelaria_crm_contratos_boot"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_criar_lead"(p_nome text, p_telefone text, p_origem text) owner to app_tenant_definer;
alter function "public"."movelaria_crm_eventos_boot"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_gastos_boot"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_gastos_salvar_fonte"(p_id uuid, p_nome text, p_cor text) owner to app_tenant_definer;
alter function "public"."movelaria_crm_gastos_salvar_lancamento"(p_id uuid, p_coluna_id uuid, p_data date, p_valor numeric, p_observacao text) owner to app_tenant_definer;
alter function "public"."movelaria_crm_gastos_salvar_subfonte"(p_id uuid, p_fonte_id uuid, p_nome text) owner to app_tenant_definer;
alter function "public"."movelaria_crm_lead_ia_boot"(p_lead_id bigint) owner to app_tenant_definer;
alter function "public"."movelaria_crm_lousa_boot"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_lousa_obter"(p_lead_id bigint) owner to app_tenant_definer;
alter function "public"."movelaria_crm_marketing_boot"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_marketing_excluir_card"(p_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_crm_marketing_medias"(p_folder_id uuid, p_busca text, p_limit integer, p_offset integer, p_sem_pasta boolean) owner to app_tenant_definer;
alter function "public"."movelaria_crm_marketing_mover_card"(p_id uuid, p_column_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_crm_marketing_salvar_card"(p_id uuid, p_titulo text, p_script_copy text, p_column_id uuid, p_urgente boolean) owner to app_tenant_definer;
alter function "public"."movelaria_crm_marketing_salvar_coluna"(p_id uuid, p_nome text) owner to app_tenant_definer;
alter function "public"."movelaria_crm_marketing_salvar_node"(p_id uuid, p_titulo text, p_conteudo text) owner to app_tenant_definer;
alter function "public"."movelaria_crm_marketing_salvar_tarefa"(p_id uuid, p_titulo text, p_data date, p_status text) owner to app_tenant_definer;
alter function "public"."movelaria_crm_markup_boot"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_markup_criar"(p_lead_id bigint, p_titulo text) owner to app_tenant_definer;
alter function "public"."movelaria_crm_markup_obter"(p_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_crm_markup_resumos"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_markup_salvar"(p_id uuid, p_titulo text, p_status text, p_modulos jsonb, p_observacoes text, p_lead_id bigint) owner to app_tenant_definer;
alter function "public"."movelaria_crm_markup_salvar_categoria"(p_id uuid, p_nome text, p_ordem integer, p_ativo boolean) owner to app_tenant_definer;
alter function "public"."movelaria_crm_markup_salvar_config"(p_valor_hora numeric, p_fator_sobras numeric, p_margem_lucro numeric, p_percentual_imposto numeric, p_taxas_financeiras numeric, p_custo_frete numeric, p_rodape text) owner to app_tenant_definer;
alter function "public"."movelaria_crm_markup_salvar_despesa"(p_id uuid, p_nome text, p_valor_padrao numeric, p_ordem integer, p_ativo boolean) owner to app_tenant_definer;
alter function "public"."movelaria_crm_markup_salvar_produto"(p_id uuid, p_categoria_id uuid, p_nome text, p_variacao text, p_preco_unitario numeric, p_unidade text, p_quantidade_padrao numeric, p_ativo boolean, p_ordem integer) owner to app_tenant_definer;
alter function "public"."movelaria_crm_markup_salvar_servico"(p_id uuid, p_nome text, p_valor_hora numeric, p_ordem integer, p_ativo boolean) owner to app_tenant_definer;
alter function "public"."movelaria_crm_mover_lead"(p_lead_id bigint, p_status text) owner to app_tenant_definer;
alter function "public"."movelaria_crm_notificacao_ler"(p_id uuid, p_todas boolean) owner to app_tenant_definer;
alter function "public"."movelaria_crm_notificacoes"(p_limit integer, p_offset integer) owner to app_tenant_definer;
alter function "public"."movelaria_crm_pipeline_boot"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_pode_automacao_mkt"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_pode_comunicacao"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_pode_gastos"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_pode_marketing"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_pode_markup"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_pode_pipeline"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_pode_pontua_fin"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_pode_prestador"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_pode_slides"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_pode_venda"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_pontua_admin_boot"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_pontua_aprovar_saque"(p_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_crm_pontua_liberar_comissao"(p_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_crm_pontua_rejeitar_saque"(p_id uuid, p_obs text) owner to app_tenant_definer;
alter function "public"."movelaria_crm_portal_boot"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_portal_lead"(p_lead_id bigint) owner to app_tenant_definer;
alter function "public"."movelaria_crm_portal_saldo_sacar"(p_uid uuid) owner to app_tenant_definer;
alter function "public"."movelaria_crm_portal_salvar_perfil"(p_telefone text, p_chave_pix text, p_tipo_chave_pix text) owner to app_tenant_definer;
alter function "public"."movelaria_crm_portal_solicitar_saque"(p_valor numeric, p_chave_pix text, p_tipo_chave_pix text) owner to app_tenant_definer;
alter function "public"."movelaria_crm_salvar_lead"(p_lead_id bigint, p_nome text, p_telefone text, p_email text, p_origem text, p_observacoes text, p_valor_negocio numeric, p_status text) owner to app_tenant_definer;
alter function "public"."movelaria_crm_slide_criar"(p_cliente_nome text, p_lead_id bigint) owner to app_tenant_definer;
alter function "public"."movelaria_crm_slide_salvar"(p_id uuid, p_cliente_nome text, p_identificador text, p_lead_id bigint, p_status text, p_dados jsonb) owner to app_tenant_definer;
alter function "public"."movelaria_crm_slides_boot"() owner to app_tenant_definer;
alter function "public"."movelaria_crm_whatsapp_historico"(p_telefone text) owner to app_tenant_definer;
alter function "public"."movelaria_crm_whatsapp_registrar"(p_telefone text, p_conteudo text) owner to app_tenant_definer;
alter function "public"."movelaria_excluir_lead_ganho"(p_lead_id text) owner to app_tenant_definer;
alter function "public"."movelaria_excluir_linha_caixa"(p_destinatario_id text, p_destinatario_nome text, p_mes integer, p_ano integer) owner to app_tenant_definer;
alter function "public"."movelaria_excluir_movimentacao_caixa"(p_movimentacao_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_expandir_fixo_funcionario"(p_funcionario_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_expandir_fixo_montador"(p_montador_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_expandir_todos_fixo_montadores"() owner to app_tenant_definer;
alter function "public"."movelaria_finalizar_obra"(p_obra_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_funcionario_cancelar_fixo_proximo_mes"(p_funcionario_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_funcionario_dispensar"(p_funcionario_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_funcionario_garantir_jornada"(p_funcionario_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_funcionario_meu_atualizar_foto"(p_foto_path text) owner to app_tenant_definer;
alter function "public"."movelaria_funcionario_meu_obter"() owner to app_tenant_definer;
alter function "public"."movelaria_funcionario_meu_salvar"(p_dados jsonb, p_finalizar boolean) owner to app_tenant_definer;
alter function "public"."movelaria_funcionario_por_usuario"(p_usuario_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_funcionario_recibo_ao_pagar_cp"() owner to app_tenant_definer;
alter function "public"."movelaria_funcionario_recibo_assinar"(p_recibo_id uuid, p_assinatura_path text) owner to app_tenant_definer;
alter function "public"."movelaria_funcionario_recibo_enviar_assinatura"(p_recibo_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_gerar_texto_recibo_prestador"(p_prestador_id uuid, p_valor numeric, p_data_pagamento date, p_descricao text) owner to app_tenant_definer;
alter function "public"."movelaria_get_leads_ganhos"() owner to app_tenant_definer;
alter function "public"."movelaria_importar_contas_pagar_lote"(p_itens jsonb) owner to app_tenant_definer;
alter function "public"."movelaria_iniciar_obra"(p_obra_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_lead_midias_por_leads"(p_lead_ids text[]) owner to app_tenant_definer;
alter function "public"."movelaria_listar_contratos"() owner to app_tenant_definer;
alter function "public"."movelaria_listar_fixo_montadores"(p_mes integer, p_ano integer) owner to app_tenant_definer;
alter function "public"."movelaria_listar_identidades"() owner to app_tenant_definer;
alter function "public"."movelaria_listar_montadores"() owner to app_tenant_definer;
alter function "public"."movelaria_listar_obras"() owner to app_tenant_definer;
alter function "public"."movelaria_listar_recibos_prestador"() owner to app_tenant_definer;
alter function "public"."movelaria_listar_titulares_agenda"() owner to app_tenant_definer;
alter function "public"."movelaria_listar_usuarios"() owner to app_tenant_definer;
alter function "public"."movelaria_markup_catalogo_categorias"() owner to app_tenant_definer;
alter function "public"."movelaria_markup_catalogo_listar"() owner to app_tenant_definer;
alter function "public"."movelaria_markup_catalogo_salvar_categoria"(p_id uuid, p_nome text, p_ordem integer, p_ativo boolean) owner to app_tenant_definer;
alter function "public"."movelaria_markup_catalogo_salvar_produto"(p_id uuid, p_categoria_id uuid, p_nome text, p_variacao text, p_preco_unitario numeric, p_unidade text, p_quantidade_padrao numeric, p_ativo boolean, p_ordem integer) owner to app_tenant_definer;
alter function "public"."movelaria_markup_custos_por_leads"(p_lead_ids text[]) owner to app_tenant_definer;
alter function "public"."movelaria_markup_itens_por_leads"(p_lead_ids text[]) owner to app_tenant_definer;
alter function "public"."movelaria_metricas_comissao_obras_montador"(p_mes integer, p_ano integer, p_montador_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_metricas_obras"(p_mes integer, p_ano integer) owner to app_tenant_definer;
alter function "public"."movelaria_metricas_obras_por_montador"(p_mes integer, p_ano integer) owner to app_tenant_definer;
alter function "public"."movelaria_metricas_obras_por_obra"(p_mes integer, p_ano integer) owner to app_tenant_definer;
alter function "public"."movelaria_metricas_obras_resumo"(p_mes integer, p_ano integer) owner to app_tenant_definer;
alter function "public"."movelaria_nome_destinatario_prestador"(p_prestador_id uuid, p_is_comissao boolean) owner to app_tenant_definer;
alter function "public"."movelaria_obra_datas_after_update_historico"() owner to app_tenant_definer;
alter function "public"."movelaria_obra_datas_before_write"() owner to app_tenant_definer;
alter function "public"."movelaria_obra_todos_montadores_concluiram"(p_obra_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_obter_meu_usuario"() owner to app_tenant_definer;
alter function "public"."movelaria_obter_minha_identidade"() owner to app_tenant_definer;
alter function "public"."movelaria_painel_evolucao"(p_inicio timestamp with time zone, p_fim timestamp with time zone) owner to app_tenant_definer;
alter function "public"."movelaria_ponto_ajustar_marcacao"(p_marcacao_id uuid, p_hora time without time zone, p_motivo text) owner to app_tenant_definer;
alter function "public"."movelaria_ponto_assert_edicao_registros"(p_funcionario_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_ponto_atualizar_comprovante"(p_marcacao_id uuid, p_comprovante_path text) owner to app_tenant_definer;
alter function "public"."movelaria_ponto_bater"(p_marcacao_id uuid, p_foto_path text, p_assinatura_path text, p_latitude double precision, p_longitude double precision, p_precisao_metros double precision, p_hash_sha256 text) owner to app_tenant_definer;
alter function "public"."movelaria_ponto_controle_diario"(p_data date) owner to app_tenant_definer;
alter function "public"."movelaria_ponto_desconsiderar_falta"(p_funcionario_id uuid, p_data date, p_motivo text) owner to app_tenant_definer;
alter function "public"."movelaria_ponto_detectar_faltas"(p_data date) owner to app_tenant_definer;
alter function "public"."movelaria_ponto_job_faltas"() owner to app_tenant_definer;
alter function "public"."movelaria_ponto_pagar_hora_extra"(p_funcionario_id uuid, p_minutos integer, p_valor_hora numeric, p_data_vencimento date, p_observacao text) owner to app_tenant_definer;
alter function "public"."movelaria_ponto_proximo_tipo"(p_funcionario_id uuid, p_data date) owner to app_tenant_definer;
alter function "public"."movelaria_ponto_registrar_manual"(p_funcionario_id uuid, p_data date, p_tipo text, p_hora time without time zone, p_motivo text) owner to app_tenant_definer;
alter function "public"."movelaria_ponto_remover_ocorrencia"(p_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_ponto_resumo_periodo"(p_periodo text) owner to app_tenant_definer;
alter function "public"."movelaria_ponto_resumo_periodo"(p_periodo text, p_referencia text) owner to app_tenant_definer;
alter function "public"."movelaria_ponto_saldo_acumulado"(p_funcionario_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_ponto_salvar_jornada"(p_funcionario_id uuid, p_hora_entrada time without time zone, p_hora_saida_intervalo time without time zone, p_hora_retorno_intervalo time without time zone, p_hora_saida time without time zone, p_tolerancia_minutos integer, p_dias_uteis integer[], p_ativo boolean, p_grade jsonb) owner to app_tenant_definer;
alter function "public"."movelaria_ponto_salvar_ocorrencia"(p_funcionario_id uuid, p_data date, p_tipo text, p_observacao text, p_abater_banco_horas boolean) owner to app_tenant_definer;
alter function "public"."movelaria_ponto_sincronizar_faltas_periodo"(p_inicio date, p_fim date) owner to app_tenant_definer;
alter function "public"."movelaria_ponto_status_dia"(p_funcionario_id uuid, p_data date) owner to app_tenant_definer;
alter function "public"."movelaria_prestador_financeiro"(p_mes integer, p_ano integer) owner to app_tenant_definer;
alter function "public"."movelaria_puxar_lead_producao"(p_lead_id bigint) owner to app_tenant_definer;
alter function "public"."movelaria_reabrir_obra"(p_obra_id uuid, p_status_destino text) owner to app_tenant_definer;
alter function "public"."movelaria_registrar_historico_transacao"() owner to app_tenant_definer;
alter function "public"."movelaria_rep_obter_config"() owner to app_tenant_definer;
alter function "public"."movelaria_rep_salvar_config"(p_razao_social text, p_cnpj text, p_inpi_registro text, p_versao_software text, p_certificado_valido_ate date) owner to app_tenant_definer;
alter function "public"."movelaria_rep_salvar_config"(p_razao_social text, p_cnpj text, p_inpi_registro text, p_versao_software text, p_certificado_valido_ate date, p_certificado_path text, p_certificado_senha text, p_atualizar_senha boolean) owner to app_tenant_definer;
alter function "public"."movelaria_resolver_caixa_destinatario_prestador"(p_nome text, p_prestador_id uuid) owner to app_tenant_definer;
alter function "public"."movelaria_salvar_markup_itens"(p_orcamento_id uuid, p_linhas jsonb) owner to app_tenant_definer;
alter function "public"."movelaria_salvar_obra_markup_custos_filtro"(p_obra_id uuid, p_materiais boolean, p_servicos boolean, p_despesas boolean) owner to app_tenant_definer;
alter function "public"."movelaria_sincronizar_obra_comissao"(p_obra_id uuid, p_habilitada boolean, p_prestador_ids uuid[], p_valores numeric[], p_ocultos boolean[]) owner to app_tenant_definer;
alter function "public"."movelaria_sincronizar_obra_montadores"(p_obra_id uuid, p_montador_ids uuid[]) owner to app_tenant_definer;
alter function "public"."movelaria_sync_admissao_salario_fixo"(p_funcionario_id uuid, p_valor numeric) owner to app_tenant_definer;
alter function "public"."movelaria_sync_caixa_pagamento_para_conta"() owner to app_tenant_definer;
alter function "public"."movelaria_sync_cliente_lead_trigger"() owner to app_tenant_definer;
alter function "public"."movelaria_sync_clientes_from_leads"() owner to app_tenant_definer;
alter function "public"."movelaria_sync_comissao_gerada_para_caixa"() owner to app_tenant_definer;
alter function "public"."movelaria_sync_funcionario_de_usuario"() owner to app_tenant_definer;
alter function "public"."movelaria_sync_jornada_from_admissao_trigger"() owner to app_tenant_definer;
alter function "public"."movelaria_sync_pagamento_para_caixa"() owner to app_tenant_definer;
alter function "public"."movelaria_sync_usuario_de_funcionario_montador"() owner to app_tenant_definer;
alter function "public"."movelaria_toggle_comissao_oculta_prestador"(p_obra_id uuid, p_prestador_id uuid, p_oculto boolean) owner to app_tenant_definer;
alter function "public"."movelaria_trg_funcionario_garantir_ponto"() owner to app_tenant_definer;
alter function "public"."movelaria_upsert_cliente_from_lead"(p_nome text, p_telefone text, p_email text, p_origem text, p_data_cadastro date) owner to app_tenant_definer;
alter function "public"."movelaria_usuario_eh_montador"(p_usuario_id uuid) owner to app_tenant_definer;
alter function "public"."refresh_lead_conversion_stats"() owner to app_tenant_definer;
alter function "public"."reject_user"(_user_id uuid) owner to app_tenant_definer;
alter function "public"."search_numeros_negativados"(search_digits text, result_limit integer) owner to app_tenant_definer;
alter function "public"."site_proforco_is_staff"() owner to app_tenant_definer;
alter function "public"."sync_lead_status_to_legacy_tables"() owner to app_tenant_definer;
alter function "public"."tem_role_primaria"(_user_id uuid, _role text) owner to app_tenant_definer;
alter function "crm"."trg_pontua_comissao_cria_conta_pagar"() owner to app_tenant_definer;
alter function "public"."update_contato_on_new_message"() owner to app_tenant_definer;
alter function "public"."update_updated_at_column"() owner to app_tenant_definer;
alter function "public"."whatsapp_mesclar_lid_para_telefone"(p_telefone_real text, p_lid text) owner to app_tenant_definer;

-- 69 mantidas no postgres:
--   mantém postgres: public.agenda_public_attach_uploads_to_lead(p_schema text, p_lead_id bigint, p_resposta_formulario text)  [ddl/sql dinâmico]
--   mantém postgres: public.agenda_public_create_booking(p_schema text, p_config_id uuid, p_agenda_slug text, p_dados jsonb)  [ddl/sql dinâmico]
--   mantém postgres: public.app__empresa_do_usuario(p_uid uuid)  [plataforma]
--   mantém postgres: public.app__minha_empresa_id()  [plataforma]
--   mantém postgres: public.app_is_master()  [plataforma]
--   mantém postgres: public.app_minha_empresa()  [plataforma]
--   mantém postgres: public.app_usuario_da_empresa_atual(p_user text)  [usada em policy]
--   mantém postgres: public.crm_selletos_vendor_owned_contato_ids()  [usada em policy]
--   mantém postgres: public.crm_selletos_vendor_owned_lead_ids()  [usada em policy]
--   mantém postgres: public.get_session_metrics(p_data_inicio timestamp with time zone, p_data_fim timestamp with time zone)  [auth.*]
--   mantém postgres: public.has_permission(_user_id uuid, _resource text, _action text)  [usada em policy]
--   mantém postgres: public.is_admin(_user_id uuid)  [usada em policy]
--   mantém postgres: public.is_marketing_p2p_operator(_user_id uuid)  [usada em policy]
--   mantém postgres: public.is_vendedor(_user_id uuid)  [usada em policy]
--   mantém postgres: public.is_vendedor_p2p(_user_id uuid)  [usada em policy]
--   mantém postgres: public.ler_form_inicio_orcamento(p_schema text, p_token text)  [ddl/sql dinâmico]
--   mantém postgres: public.log_lead_pipeline_movimento()  [ddl/sql dinâmico]
--   mantém postgres: public.master_definir_empresa_ativa(p_empresa_id uuid)  [plataforma]
--   mantém postgres: crm.me_can_access_producao(p_uid uuid)  [usada em policy]
--   mantém postgres: crm.me_can_config_producao(p_uid uuid)  [usada em policy]
--   mantém postgres: public.me_criar_empresa(p_nome text, p_slug text, p_cor_primaria text)  [ddl/sql dinâmico]
--   mantém postgres: public.me_empresa_has_any_role(_schema text, _roles text[], _user_id uuid)  [usada em policy]
--   mantém postgres: public.me_enable_lead_projetos_realtime(p_schema text)  [ddl/sql dinâmico]
--   mantém postgres: public.me_ensure_evento_caderno(p_schema text)  [ddl/sql dinâmico]
--   mantém postgres: public.me_ensure_funil_projetos(p_schema text)  [ddl/sql dinâmico]
--   mantém postgres: public.me_ensure_lead_projeto_notas(p_schema text)  [ddl/sql dinâmico]
--   mantém postgres: public.me_ensure_projetista_leads_acesso(p_schema text)  [ddl/sql dinâmico]
--   mantém postgres: public.me_ensure_projeto_visita_column(p_schema text)  [ddl/sql dinâmico]
--   mantém postgres: public.me_ensure_super_admin_in_empresa(_schema_nome text, _user_id uuid)  [auth.*]
--   mantém postgres: public.me_get_empresa_role(_schema text, _user_id uuid)  [usada em policy]
--   mantém postgres: public.me_grant_empresa_schema(p_schema text)  [ddl/sql dinâmico]
--   mantém postgres: public.me_is_admin(_user_id uuid)  [usada em policy]
--   mantém postgres: public.me_is_crm_projetista(_user_id uuid)  [usada em policy]
--   mantém postgres: public.me_is_crm_projetista_admin(_user_id uuid)  [usada em policy]
--   mantém postgres: public.me_is_crm_titular_admin(_user_id uuid)  [usada em policy]
--   mantém postgres: public.me_is_crm_vendedor(_user_id uuid)  [usada em policy]
--   mantém postgres: public.me_is_super_admin(_user_id uuid)  [usada em policy]
--   mantém postgres: public.me_is_vendedor(_user_id uuid)  [chamada por helper de policy]
--   mantém postgres: public.me_lead_linked_to_prestador(_schema text, _lead_id bigint, _user_id uuid)  [usada em policy]
--   mantém postgres: public.me_limpar_vinculos_auth_user(_user_id uuid)  [auth.*]
--   mantém postgres: public.me_pipeline_novo_lead_criar_tarefa()  [ddl/sql dinâmico]
--   mantém postgres: public.me_projetos_buscar_leads(p_schema text, p_termo text, p_limit integer)  [ddl/sql dinâmico]
--   mantém postgres: public.me_role_has_permission(_role text, _resource text, _action text)  [usada em policy]
--   mantém postgres: public.me_vincular_usuario_empresa(p_email text, p_empresa_slug text, p_role text, p_nome text)  [auth.*]
--   mantém postgres: public.movelaria_atualizar_ficha_crm(p_id uuid, p_tipo_usuario text, p_roles text[], p_horario_inicio text, p_horario_fim text, p_status_convite text, p_titulo text)  [auth.*]
--   mantém postgres: public.movelaria_criar_usuario(p_email text, p_senha text, p_nome text, p_perfil text)  [auth.*]
--   mantém postgres: public.movelaria_excluir_usuario(p_id uuid)  [auth.*]
--   mantém postgres: public.movelaria_meu_perfil()  [usada em policy]
--   mantém postgres: public.movelaria_montador_acessa_obra(p_obra_id uuid, p_uid uuid)  [usada em policy]
--   mantém postgres: public.movelaria_montador_admin_acessa_obra(p_obra_id uuid, p_uid uuid)  [usada em policy]
--   mantém postgres: public.movelaria_pode_configurar_visualizacao()  [usada em policy]
--   mantém postgres: public.movelaria_pode_usar_simulador_caixa()  [usada em policy]
--   mantém postgres: public.movelaria_redefinir_senha(p_id uuid, p_senha text)  [auth.*]
--   mantém postgres: public.movelaria_registrar_usuario_existente(p_email text, p_nome text, p_perfil text)  [auth.*]
--   mantém postgres: public.movelaria_registrar_usuario_existente(p_email text, p_nome text, p_perfil text, p_senha text)  [auth.*]
--   mantém postgres: public.movelaria_usuario_acessa_obra(p_obra_id uuid)  [usada em policy]
--   mantém postgres: public.movelaria_usuario_config_briefing_modelos()  [usada em policy]
--   mantém postgres: public.movelaria_usuario_edita_briefing_obra()  [usada em policy]
--   mantém postgres: public.movelaria_usuario_edita_lousa_obra()  [usada em policy]
--   mantém postgres: public.movelaria_usuario_exclui_briefing_modelos()  [usada em policy]
--   mantém postgres: public.movelaria_usuario_tem_algum_perfil(p_perfis text[])  [usada em policy]
--   mantém postgres: public.movelaria_usuario_tem_perfil(p_perfil text)  [usada em policy]
--   mantém postgres: public.movelaria_usuario_tem_qualquer_perfil(p_perfis text[])  [usada em policy]
--   mantém postgres: public.orcamentos_ia_can_access_company(p_company_id uuid)  [usada em policy]
--   mantém postgres: public.promote_lead_status_visita_obra_feita(p_schema text, p_lead_id bigint, p_is_master boolean)  [ddl/sql dinâmico]
--   mantém postgres: public.resolve_visita_em_obra_feita_status(p_schema text, p_is_master boolean)  [ddl/sql dinâmico]
--   mantém postgres: public.submeter_form_inicio_orcamento(p_schema text, p_token text, p_valores jsonb)  [ddl/sql dinâmico]
--   mantém postgres: public.sync_lead_status_from_projeto_stage()  [ddl/sql dinâmico]
--   mantém postgres: public.sync_projeto_stage_from_lead_status()  [ddl/sql dinâmico]
