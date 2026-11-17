-- T08 — Publicação realtime e job agendado da Movelaria.
-- Gerado do catálogo de zzqgtclvuetemzhqzhbq por scripts/baseline/gen-platform.mjs. Idempotente.

DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "emp_garbo"."lead_projeto_chat_leituras"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "emp_garbo"."lead_projeto_notas"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "emp_garbo"."lead_projetos"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "emp_garbo"."lead_sinalizacoes"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "emp_garbo"."obra_producao"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "emp_garbo"."obra_producao_notas"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "public"."CRM-Selletos>lead_lembretes<"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "public"."CRM-Selletos>leads<"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "public"."CRM-multi-empresas>lead_projeto_chat_leituras<"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "public"."CRM-multi-empresas>lead_projeto_notas<"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "public"."CRM-multi-empresas>lead_projetos<"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "public"."CRM-multi-empresas>lead_sinalizacoes<"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "public"."marketing_content_cards"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "public"."movelaria_caixa_destinatarios"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "public"."movelaria_caixa_movimentacoes"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "public"."movelaria_caixa_saldo_acumulado"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "public"."movelaria_contas_pagar"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "public"."movelaria_contas_receber"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "public"."movelaria_obra_markup_custos_filtro"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "public"."movelaria_obra_responsaveis"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "public"."movelaria_obras"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "public"."movelaria_simulador_caixa"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE "public"."quote_analyses"; EXCEPTION WHEN duplicate_object THEN NULL; END $$;

SELECT cron.schedule('movelaria_ponto_faltas_diario', '59 2 * * *', 'SELECT movelaria_ponto_job_faltas()');
