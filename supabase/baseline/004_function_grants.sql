-- T10 — EXECUTE das funções igual ao banco antigo (gerado por scripts/baseline/gen-function-grants.mjs).

REVOKE EXECUTE ON FUNCTION public.is_marketing_p2p_operator(_user_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.marketing_p2p_grant_commission(_seller_id uuid, _event_key text, _entity_type text, _entity_id text, _source_proof_id uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.marketing_p2p_record_daily_move(_seller_id uuid, _entity_type text, _entity_id text, _event_kind text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.me_enable_lead_projetos_realtime(p_schema text) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.me_ensure_funil_projetos(p_schema text) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.me_ensure_projetista_leads_acesso(p_schema text) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.me_ensure_projeto_visita_column(p_schema text) FROM authenticated, anon;
REVOKE EXECUTE ON FUNCTION public.me_projetos_buscar_leads(p_schema text, p_termo text, p_limit integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.movelaria_admissao_publica_obter(p_token uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.movelaria_admissao_publica_registrar_doc(p_token uuid, p_tipo_documento text, p_nome_arquivo text, p_tipo_mime text, p_storage_path text, p_kind text) FROM anon;
REVOKE EXECUTE ON FUNCTION public.movelaria_admissao_publica_salvar(p_token uuid, p_dados jsonb, p_finalizar boolean) FROM anon;
