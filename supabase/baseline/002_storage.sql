-- T07 — Buckets e policies de storage do escopo Movelaria + CRM.
-- Gerado do catálogo de zzqgtclvuetemzhqzhbq por scripts/baseline/gen-platform.mjs. Idempotente.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('agenda-form-uploads', 'agenda-form-uploads', true, 52428800, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'video/mp4', 'video/webm', 'video/quicktime', 'application/pdf']::text[])
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('agenda-item-anexos', 'agenda-item-anexos', true, 26214400, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']::text[])
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('contratos-anexos', 'contratos-anexos', true, 52428800, NULL)
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('empresa-branding', 'empresa-branding', true, 20971520, ARRAY['image/png', 'image/jpeg', 'image/webp', 'image/svg+xml', 'image/gif']::text[])
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('lead-ai-renders', 'lead-ai-renders', true, 10485760, ARRAY['image/png', 'image/jpeg', 'image/webp']::text[])
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('marketing-medias', 'marketing-medias', true, 262144000, NULL)
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('marketing-planning-files', 'marketing-planning-files', true, 20971520, ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']::text[])
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('marketing-templates', 'marketing-templates', true, NULL, NULL)
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('markup-timbrado', 'markup-timbrado', true, 10485760, NULL)
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('movelaria-contas-pagar-anexos', 'movelaria-contas-pagar-anexos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']::text[])
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('movelaria-contas-receber-anexos', 'movelaria-contas-receber-anexos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'application/vnd.openxmlformats-officedocument.wordprocessingml.template', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document']::text[])
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('movelaria-escritorio-arquivos', 'movelaria-escritorio-arquivos', false, 104857600, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']::text[])
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('movelaria-funcionario-documentos', 'movelaria-funcionario-documentos', false, 104857600, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'text/plain', 'application/pkcs7-signature', 'application/x-pkcs12', 'application/octet-stream']::text[])
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('movelaria-obra-arquivos', 'movelaria-obra-arquivos', false, 524288000, ARRAY['application/pdf', 'image/gif', 'image/jpeg', 'image/png', 'image/webp', 'video/3gpp', 'video/3gpp2', 'video/mp4', 'video/mpeg', 'video/ogg', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/x-msvideo']::text[])
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('movelaria-obra-briefing', 'movelaria-obra-briefing', false, 524288000, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf', 'video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/ogg', 'video/mpeg']::text[])
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('movelaria-obra-evolucao', 'movelaria-obra-evolucao', false, 524288000, ARRAY['application/pdf', 'image/gif', 'image/jpeg', 'image/png', 'image/webp', 'video/3gpp', 'video/3gpp2', 'video/mp4', 'video/mpeg', 'video/ogg', 'video/quicktime', 'video/webm', 'video/x-m4v', 'video/x-msvideo']::text[])
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('movelaria-obra-lousa', 'movelaria-obra-lousa', false, 104857600, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif', 'application/pdf']::text[])
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('movelaria-pedidos-anexos', 'movelaria-pedidos-anexos', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf']::text[])
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('movelaria-rep-config', 'movelaria-rep-config', false, 5242880, ARRAY['application/x-pkcs12', 'application/octet-stream', 'application/pkcs7-signature']::text[])
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('orcamentos-ia', 'orcamentos-ia', false, 104857600, ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']::text[])
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('orcamento-slide-exports', 'orcamento-slide-exports', false, 104857600, ARRAY['application/pdf', 'image/jpeg']::text[])
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types) VALUES ('orcamento-slides', 'orcamento-slides', true, 262144000, NULL)
  ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public, file_size_limit = EXCLUDED.file_size_limit, allowed_mime_types = EXCLUDED.allowed_mime_types;

DROP POLICY IF EXISTS "Allow all updates to marketing-medias" ON storage.objects;
CREATE POLICY "Allow all updates to marketing-medias" ON storage.objects AS PERMISSIVE FOR UPDATE TO PUBLIC
  USING ((bucket_id = 'marketing-medias'::text));
DROP POLICY IF EXISTS "Allow public read access to marketing-medias" ON storage.objects;
CREATE POLICY "Allow public read access to marketing-medias" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC
  USING ((bucket_id = 'marketing-medias'::text));
DROP POLICY IF EXISTS "Anyone can delete planning files" ON storage.objects;
CREATE POLICY "Anyone can delete planning files" ON storage.objects AS PERMISSIVE FOR DELETE TO PUBLIC
  USING ((bucket_id = 'marketing-planning-files'::text));
DROP POLICY IF EXISTS "Anyone can upload planning files" ON storage.objects;
CREATE POLICY "Anyone can upload planning files" ON storage.objects AS PERMISSIVE FOR INSERT TO PUBLIC
  WITH CHECK ((bucket_id = 'marketing-planning-files'::text));
DROP POLICY IF EXISTS "Anyone can view planning files" ON storage.objects;
CREATE POLICY "Anyone can view planning files" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC
  USING ((bucket_id = 'marketing-planning-files'::text));
DROP POLICY IF EXISTS "Autenticados podem deletar seus próprios arquivos de marketing" ON storage.objects;
CREATE POLICY "Autenticados podem deletar seus próprios arquivos de marketing" ON storage.objects AS PERMISSIVE FOR DELETE TO PUBLIC
  USING (((bucket_id = 'marketing-templates'::text) AND (auth.role() = 'authenticated'::text)));
DROP POLICY IF EXISTS "Autenticados podem fazer upload de arquivos de marketing" ON storage.objects;
CREATE POLICY "Autenticados podem fazer upload de arquivos de marketing" ON storage.objects AS PERMISSIVE FOR INSERT TO PUBLIC
  WITH CHECK (((bucket_id = 'marketing-templates'::text) AND (auth.role() = 'authenticated'::text)));
DROP POLICY IF EXISTS "Autenticados podem ver arquivos de marketing" ON storage.objects;
CREATE POLICY "Autenticados podem ver arquivos de marketing" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC
  USING (((bucket_id = 'marketing-templates'::text) AND (auth.role() = 'authenticated'::text)));
DROP POLICY IF EXISTS "agenda_form_uploads_anon_insert" ON storage.objects;
CREATE POLICY "agenda_form_uploads_anon_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "anon", "authenticated"
  WITH CHECK ((bucket_id = 'agenda-form-uploads'::text));
DROP POLICY IF EXISTS "agenda_form_uploads_auth_update" ON storage.objects;
CREATE POLICY "agenda_form_uploads_auth_update" ON storage.objects AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING ((bucket_id = 'agenda-form-uploads'::text));
DROP POLICY IF EXISTS "agenda_form_uploads_public_read" ON storage.objects;
CREATE POLICY "agenda_form_uploads_public_read" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC
  USING ((bucket_id = 'agenda-form-uploads'::text));
DROP POLICY IF EXISTS "agenda_item_anexos_authenticated_delete" ON storage.objects;
CREATE POLICY "agenda_item_anexos_authenticated_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated"
  USING ((bucket_id = 'agenda-item-anexos'::text));
DROP POLICY IF EXISTS "agenda_item_anexos_authenticated_insert" ON storage.objects;
CREATE POLICY "agenda_item_anexos_authenticated_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK ((bucket_id = 'agenda-item-anexos'::text));
DROP POLICY IF EXISTS "agenda_item_anexos_authenticated_update" ON storage.objects;
CREATE POLICY "agenda_item_anexos_authenticated_update" ON storage.objects AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING ((bucket_id = 'agenda-item-anexos'::text))
  WITH CHECK ((bucket_id = 'agenda-item-anexos'::text));
DROP POLICY IF EXISTS "agenda_item_anexos_public_read" ON storage.objects;
CREATE POLICY "agenda_item_anexos_public_read" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC
  USING ((bucket_id = 'agenda-item-anexos'::text));
DROP POLICY IF EXISTS "anon_insert_agenda_form_uploads" ON storage.objects;
CREATE POLICY "anon_insert_agenda_form_uploads" ON storage.objects AS PERMISSIVE FOR INSERT TO "anon", "authenticated"
  WITH CHECK ((bucket_id = 'agenda-form-uploads'::text));
DROP POLICY IF EXISTS "anon_select_agenda_form_uploads" ON storage.objects;
CREATE POLICY "anon_select_agenda_form_uploads" ON storage.objects AS PERMISSIVE FOR SELECT TO "anon", "authenticated"
  USING ((bucket_id = 'agenda-form-uploads'::text));
DROP POLICY IF EXISTS "contratos_anexos_authenticated_delete" ON storage.objects;
CREATE POLICY "contratos_anexos_authenticated_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated"
  USING ((bucket_id = 'contratos-anexos'::text));
DROP POLICY IF EXISTS "contratos_anexos_authenticated_insert" ON storage.objects;
CREATE POLICY "contratos_anexos_authenticated_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK ((bucket_id = 'contratos-anexos'::text));
DROP POLICY IF EXISTS "contratos_anexos_public_read" ON storage.objects;
CREATE POLICY "contratos_anexos_public_read" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC
  USING ((bucket_id = 'contratos-anexos'::text));
DROP POLICY IF EXISTS "empresa_branding_delete" ON storage.objects;
CREATE POLICY "empresa_branding_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated"
  USING ((bucket_id = 'empresa-branding'::text));
DROP POLICY IF EXISTS "empresa_branding_insert" ON storage.objects;
CREATE POLICY "empresa_branding_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK ((bucket_id = 'empresa-branding'::text));
DROP POLICY IF EXISTS "empresa_branding_select" ON storage.objects;
CREATE POLICY "empresa_branding_select" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC
  USING ((bucket_id = 'empresa-branding'::text));
DROP POLICY IF EXISTS "empresa_branding_update" ON storage.objects;
CREATE POLICY "empresa_branding_update" ON storage.objects AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING ((bucket_id = 'empresa-branding'::text));
DROP POLICY IF EXISTS "evolucao_delete" ON storage.objects;
CREATE POLICY "evolucao_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated"
  USING (((bucket_id = 'movelaria-obra-evolucao'::text) AND (movelaria_meu_perfil() = ANY (ARRAY['administrador'::text, 'montador_admin'::text, 'administrador_obras'::text]))));
DROP POLICY IF EXISTS "evolucao_insert" ON storage.objects;
CREATE POLICY "evolucao_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK (((bucket_id = 'movelaria-obra-evolucao'::text) AND (movelaria_meu_perfil() = ANY (ARRAY['administrador'::text, 'montador_admin'::text, 'montador'::text, 'administrador_obras'::text]))));
DROP POLICY IF EXISTS "evolucao_select" ON storage.objects;
CREATE POLICY "evolucao_select" ON storage.objects AS PERMISSIVE FOR SELECT TO "authenticated"
  USING (((bucket_id = 'movelaria-obra-evolucao'::text) AND (movelaria_meu_perfil() IS NOT NULL)));
DROP POLICY IF EXISTS "lead_ai_renders_delete" ON storage.objects;
CREATE POLICY "lead_ai_renders_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated"
  USING ((bucket_id = 'lead-ai-renders'::text));
DROP POLICY IF EXISTS "lead_ai_renders_insert_service" ON storage.objects;
CREATE POLICY "lead_ai_renders_insert_service" ON storage.objects AS PERMISSIVE FOR INSERT TO "service_role"
  WITH CHECK ((bucket_id = 'lead-ai-renders'::text));
DROP POLICY IF EXISTS "lead_ai_renders_select" ON storage.objects;
CREATE POLICY "lead_ai_renders_select" ON storage.objects AS PERMISSIVE FOR SELECT TO "authenticated"
  USING ((bucket_id = 'lead-ai-renders'::text));
DROP POLICY IF EXISTS "marketing_medias_authenticated_delete" ON storage.objects;
CREATE POLICY "marketing_medias_authenticated_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated"
  USING ((bucket_id = 'marketing-medias'::text));
DROP POLICY IF EXISTS "marketing_medias_authenticated_insert" ON storage.objects;
CREATE POLICY "marketing_medias_authenticated_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK ((bucket_id = 'marketing-medias'::text));
DROP POLICY IF EXISTS "markup_timbrado_auth_delete" ON storage.objects;
CREATE POLICY "markup_timbrado_auth_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated"
  USING ((bucket_id = 'markup-timbrado'::text));
DROP POLICY IF EXISTS "markup_timbrado_auth_insert" ON storage.objects;
CREATE POLICY "markup_timbrado_auth_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK ((bucket_id = 'markup-timbrado'::text));
DROP POLICY IF EXISTS "markup_timbrado_public_read" ON storage.objects;
CREATE POLICY "markup_timbrado_public_read" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC
  USING ((bucket_id = 'markup-timbrado'::text));
DROP POLICY IF EXISTS "obra_arq_delete" ON storage.objects;
CREATE POLICY "obra_arq_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated"
  USING (((bucket_id = 'movelaria-obra-arquivos'::text) AND (movelaria_meu_perfil() = ANY (ARRAY['administrador'::text, 'montador_admin'::text, 'administrador_obras'::text]))));
DROP POLICY IF EXISTS "obra_arq_insert" ON storage.objects;
CREATE POLICY "obra_arq_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK (((bucket_id = 'movelaria-obra-arquivos'::text) AND (movelaria_meu_perfil() = ANY (ARRAY['administrador'::text, 'montador_admin'::text, 'administrador_obras'::text]))));
DROP POLICY IF EXISTS "obra_arq_select" ON storage.objects;
CREATE POLICY "obra_arq_select" ON storage.objects AS PERMISSIVE FOR SELECT TO "authenticated"
  USING (((bucket_id = 'movelaria-obra-arquivos'::text) AND (movelaria_meu_perfil() IS NOT NULL)));
DROP POLICY IF EXISTS "obra_briefing_delete" ON storage.objects;
CREATE POLICY "obra_briefing_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated"
  USING (((bucket_id = 'movelaria-obra-briefing'::text) AND movelaria_usuario_edita_briefing_obra()));
DROP POLICY IF EXISTS "obra_briefing_insert" ON storage.objects;
CREATE POLICY "obra_briefing_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK (((bucket_id = 'movelaria-obra-briefing'::text) AND movelaria_usuario_edita_briefing_obra()));
DROP POLICY IF EXISTS "obra_briefing_select" ON storage.objects;
CREATE POLICY "obra_briefing_select" ON storage.objects AS PERMISSIVE FOR SELECT TO "authenticated"
  USING (((bucket_id = 'movelaria-obra-briefing'::text) AND (movelaria_meu_perfil() IS NOT NULL)));
DROP POLICY IF EXISTS "obra_lousa_delete" ON storage.objects;
CREATE POLICY "obra_lousa_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated"
  USING (((bucket_id = 'movelaria-obra-lousa'::text) AND movelaria_usuario_edita_lousa_obra()));
DROP POLICY IF EXISTS "obra_lousa_insert" ON storage.objects;
CREATE POLICY "obra_lousa_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK (((bucket_id = 'movelaria-obra-lousa'::text) AND movelaria_usuario_edita_lousa_obra()));
DROP POLICY IF EXISTS "obra_lousa_select" ON storage.objects;
CREATE POLICY "obra_lousa_select" ON storage.objects AS PERMISSIVE FOR SELECT TO "authenticated"
  USING (((bucket_id = 'movelaria-obra-lousa'::text) AND (movelaria_meu_perfil() IS NOT NULL)));
DROP POLICY IF EXISTS "obra_lousa_update" ON storage.objects;
CREATE POLICY "obra_lousa_update" ON storage.objects AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING (((bucket_id = 'movelaria-obra-lousa'::text) AND movelaria_usuario_edita_lousa_obra()))
  WITH CHECK (((bucket_id = 'movelaria-obra-lousa'::text) AND movelaria_usuario_edita_lousa_obra()));
DROP POLICY IF EXISTS "orcamento_slide_exports_storage_delete" ON storage.objects;
CREATE POLICY "orcamento_slide_exports_storage_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated"
  USING ((bucket_id = 'orcamento-slide-exports'::text));
DROP POLICY IF EXISTS "orcamento_slide_exports_storage_insert" ON storage.objects;
CREATE POLICY "orcamento_slide_exports_storage_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK ((bucket_id = 'orcamento-slide-exports'::text));
DROP POLICY IF EXISTS "orcamento_slide_exports_storage_select" ON storage.objects;
CREATE POLICY "orcamento_slide_exports_storage_select" ON storage.objects AS PERMISSIVE FOR SELECT TO "authenticated"
  USING ((bucket_id = 'orcamento-slide-exports'::text));
DROP POLICY IF EXISTS "orcamento_slide_exports_storage_update" ON storage.objects;
CREATE POLICY "orcamento_slide_exports_storage_update" ON storage.objects AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING ((bucket_id = 'orcamento-slide-exports'::text))
  WITH CHECK ((bucket_id = 'orcamento-slide-exports'::text));
DROP POLICY IF EXISTS "orcamento_slides_auth_delete" ON storage.objects;
CREATE POLICY "orcamento_slides_auth_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated"
  USING ((bucket_id = 'orcamento-slides'::text));
DROP POLICY IF EXISTS "orcamento_slides_auth_insert" ON storage.objects;
CREATE POLICY "orcamento_slides_auth_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK ((bucket_id = 'orcamento-slides'::text));
DROP POLICY IF EXISTS "orcamento_slides_public_read" ON storage.objects;
CREATE POLICY "orcamento_slides_public_read" ON storage.objects AS PERMISSIVE FOR SELECT TO PUBLIC
  USING ((bucket_id = 'orcamento-slides'::text));
DROP POLICY IF EXISTS "orcamentos_ia_storage_delete" ON storage.objects;
CREATE POLICY "orcamentos_ia_storage_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated"
  USING ((bucket_id = 'orcamentos-ia'::text));
DROP POLICY IF EXISTS "orcamentos_ia_storage_insert" ON storage.objects;
CREATE POLICY "orcamentos_ia_storage_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK ((bucket_id = 'orcamentos-ia'::text));
DROP POLICY IF EXISTS "orcamentos_ia_storage_select" ON storage.objects;
CREATE POLICY "orcamentos_ia_storage_select" ON storage.objects AS PERMISSIVE FOR SELECT TO "authenticated"
  USING ((bucket_id = 'orcamentos-ia'::text));
DROP POLICY IF EXISTS "orcamentos_ia_storage_update" ON storage.objects;
CREATE POLICY "orcamentos_ia_storage_update" ON storage.objects AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING ((bucket_id = 'orcamentos-ia'::text))
  WITH CHECK ((bucket_id = 'orcamentos-ia'::text));
DROP POLICY IF EXISTS "storage_anexos_cp_delete" ON storage.objects;
CREATE POLICY "storage_anexos_cp_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated"
  USING (((bucket_id = 'movelaria-contas-pagar-anexos'::text) AND (movelaria_meu_perfil() = ANY (ARRAY['administrador'::text, 'financeiro'::text]))));
DROP POLICY IF EXISTS "storage_anexos_cp_insert" ON storage.objects;
CREATE POLICY "storage_anexos_cp_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK (((bucket_id = 'movelaria-contas-pagar-anexos'::text) AND (movelaria_meu_perfil() = ANY (ARRAY['administrador'::text, 'financeiro'::text]))));
DROP POLICY IF EXISTS "storage_anexos_cp_select" ON storage.objects;
CREATE POLICY "storage_anexos_cp_select" ON storage.objects AS PERMISSIVE FOR SELECT TO "authenticated"
  USING (((bucket_id = 'movelaria-contas-pagar-anexos'::text) AND (movelaria_meu_perfil() IS NOT NULL)));
DROP POLICY IF EXISTS "storage_anexos_cp_update" ON storage.objects;
CREATE POLICY "storage_anexos_cp_update" ON storage.objects AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING (((bucket_id = 'movelaria-contas-pagar-anexos'::text) AND (movelaria_meu_perfil() = ANY (ARRAY['administrador'::text, 'financeiro'::text]))));
DROP POLICY IF EXISTS "storage_anexos_cr_delete" ON storage.objects;
CREATE POLICY "storage_anexos_cr_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated"
  USING (((bucket_id = 'movelaria-contas-receber-anexos'::text) AND (movelaria_meu_perfil() = ANY (ARRAY['administrador'::text, 'financeiro'::text]))));
DROP POLICY IF EXISTS "storage_anexos_cr_insert" ON storage.objects;
CREATE POLICY "storage_anexos_cr_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK (((bucket_id = 'movelaria-contas-receber-anexos'::text) AND (movelaria_meu_perfil() = ANY (ARRAY['administrador'::text, 'financeiro'::text]))));
DROP POLICY IF EXISTS "storage_anexos_cr_select" ON storage.objects;
CREATE POLICY "storage_anexos_cr_select" ON storage.objects AS PERMISSIVE FOR SELECT TO "authenticated"
  USING (((bucket_id = 'movelaria-contas-receber-anexos'::text) AND (movelaria_meu_perfil() IS NOT NULL)));
DROP POLICY IF EXISTS "storage_anexos_cr_update" ON storage.objects;
CREATE POLICY "storage_anexos_cr_update" ON storage.objects AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING (((bucket_id = 'movelaria-contas-receber-anexos'::text) AND (movelaria_meu_perfil() = ANY (ARRAY['administrador'::text, 'financeiro'::text]))));
DROP POLICY IF EXISTS "storage_anexos_pedido_delete" ON storage.objects;
CREATE POLICY "storage_anexos_pedido_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated"
  USING (((bucket_id = 'movelaria-pedidos-anexos'::text) AND movelaria_usuario_tem_qualquer_perfil(ARRAY['administrador'::text, 'financeiro'::text, 'administrador_obras'::text, 'montador_admin'::text])));
DROP POLICY IF EXISTS "storage_anexos_pedido_insert" ON storage.objects;
CREATE POLICY "storage_anexos_pedido_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK (((bucket_id = 'movelaria-pedidos-anexos'::text) AND movelaria_usuario_tem_qualquer_perfil(ARRAY['administrador'::text, 'financeiro'::text, 'administrador_obras'::text, 'montador_admin'::text])));
DROP POLICY IF EXISTS "storage_anexos_pedido_select" ON storage.objects;
CREATE POLICY "storage_anexos_pedido_select" ON storage.objects AS PERMISSIVE FOR SELECT TO "authenticated"
  USING (((bucket_id = 'movelaria-pedidos-anexos'::text) AND movelaria_usuario_tem_qualquer_perfil(ARRAY['administrador'::text, 'financeiro'::text, 'administrador_obras'::text, 'montador_admin'::text])));
DROP POLICY IF EXISTS "storage_anexos_pedido_update" ON storage.objects;
CREATE POLICY "storage_anexos_pedido_update" ON storage.objects AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING (((bucket_id = 'movelaria-pedidos-anexos'::text) AND movelaria_usuario_tem_qualquer_perfil(ARRAY['administrador'::text, 'financeiro'::text, 'administrador_obras'::text, 'montador_admin'::text])));
DROP POLICY IF EXISTS "storage_escritorio_delete" ON storage.objects;
CREATE POLICY "storage_escritorio_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated"
  USING (((bucket_id = 'movelaria-escritorio-arquivos'::text) AND (movelaria_meu_perfil() = ANY (ARRAY['administrador'::text, 'financeiro'::text]))));
DROP POLICY IF EXISTS "storage_escritorio_insert" ON storage.objects;
CREATE POLICY "storage_escritorio_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK (((bucket_id = 'movelaria-escritorio-arquivos'::text) AND (movelaria_meu_perfil() = ANY (ARRAY['administrador'::text, 'financeiro'::text]))));
DROP POLICY IF EXISTS "storage_escritorio_select" ON storage.objects;
CREATE POLICY "storage_escritorio_select" ON storage.objects AS PERMISSIVE FOR SELECT TO "authenticated"
  USING (((bucket_id = 'movelaria-escritorio-arquivos'::text) AND (movelaria_meu_perfil() = ANY (ARRAY['administrador'::text, 'financeiro'::text]))));
DROP POLICY IF EXISTS "storage_escritorio_update" ON storage.objects;
CREATE POLICY "storage_escritorio_update" ON storage.objects AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING (((bucket_id = 'movelaria-escritorio-arquivos'::text) AND (movelaria_meu_perfil() = ANY (ARRAY['administrador'::text, 'financeiro'::text]))));
DROP POLICY IF EXISTS "storage_func_doc_anon_insert" ON storage.objects;
CREATE POLICY "storage_func_doc_anon_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "anon"
  WITH CHECK (((bucket_id = 'movelaria-funcionario-documentos'::text) AND (EXISTS ( SELECT 1
   FROM movelaria_funcionarios f
  WHERE (((f.id)::text = split_part(objects.name, '/'::text, 1)) AND (f.admissao_status = ANY (ARRAY['pendente'::text, 'preenchido_funcionario'::text])))))));
DROP POLICY IF EXISTS "storage_func_doc_anon_select" ON storage.objects;
CREATE POLICY "storage_func_doc_anon_select" ON storage.objects AS PERMISSIVE FOR SELECT TO "anon"
  USING (((bucket_id = 'movelaria-funcionario-documentos'::text) AND (EXISTS ( SELECT 1
   FROM movelaria_funcionarios f
  WHERE (((f.id)::text = split_part(objects.name, '/'::text, 1)) AND (f.admissao_status = ANY (ARRAY['pendente'::text, 'preenchido_funcionario'::text, 'completo'::text])))))));
DROP POLICY IF EXISTS "storage_func_doc_delete" ON storage.objects;
CREATE POLICY "storage_func_doc_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated"
  USING (((bucket_id = 'movelaria-funcionario-documentos'::text) AND (movelaria_meu_perfil() = 'administrador'::text)));
DROP POLICY IF EXISTS "storage_func_doc_insert" ON storage.objects;
CREATE POLICY "storage_func_doc_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK (((bucket_id = 'movelaria-funcionario-documentos'::text) AND (movelaria_meu_perfil() IS NOT NULL)));
DROP POLICY IF EXISTS "storage_func_doc_ponto_insert" ON storage.objects;
CREATE POLICY "storage_func_doc_ponto_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK (((bucket_id = 'movelaria-funcionario-documentos'::text) AND ((movelaria_meu_perfil() = ANY (ARRAY['administrador'::text, 'financeiro'::text])) OR (EXISTS ( SELECT 1
   FROM movelaria_funcionarios f
  WHERE (((f.id)::text = split_part(objects.name, '/'::text, 1)) AND (f.usuario_id = auth.uid())))))));
DROP POLICY IF EXISTS "storage_func_doc_prestador_insert" ON storage.objects;
CREATE POLICY "storage_func_doc_prestador_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK (((bucket_id = 'movelaria-funcionario-documentos'::text) AND (EXISTS ( SELECT 1
   FROM movelaria_funcionarios f
  WHERE (((f.id)::text = split_part(objects.name, '/'::text, 1)) AND (f.usuario_id = auth.uid()))))));
DROP POLICY IF EXISTS "storage_func_doc_prestador_update" ON storage.objects;
CREATE POLICY "storage_func_doc_prestador_update" ON storage.objects AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING (((bucket_id = 'movelaria-funcionario-documentos'::text) AND (EXISTS ( SELECT 1
   FROM movelaria_funcionarios f
  WHERE (((f.id)::text = split_part(objects.name, '/'::text, 1)) AND (f.usuario_id = auth.uid()))))));
DROP POLICY IF EXISTS "storage_func_doc_select" ON storage.objects;
CREATE POLICY "storage_func_doc_select" ON storage.objects AS PERMISSIVE FOR SELECT TO "authenticated"
  USING (((bucket_id = 'movelaria-funcionario-documentos'::text) AND (movelaria_meu_perfil() IS NOT NULL)));
DROP POLICY IF EXISTS "storage_func_doc_update" ON storage.objects;
CREATE POLICY "storage_func_doc_update" ON storage.objects AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING (((bucket_id = 'movelaria-funcionario-documentos'::text) AND (movelaria_meu_perfil() IS NOT NULL)));
DROP POLICY IF EXISTS "storage_rep_config_delete" ON storage.objects;
CREATE POLICY "storage_rep_config_delete" ON storage.objects AS PERMISSIVE FOR DELETE TO "authenticated"
  USING (((bucket_id = 'movelaria-rep-config'::text) AND (movelaria_meu_perfil() = 'administrador'::text)));
DROP POLICY IF EXISTS "storage_rep_config_insert" ON storage.objects;
CREATE POLICY "storage_rep_config_insert" ON storage.objects AS PERMISSIVE FOR INSERT TO "authenticated"
  WITH CHECK (((bucket_id = 'movelaria-rep-config'::text) AND (movelaria_meu_perfil() = 'administrador'::text)));
DROP POLICY IF EXISTS "storage_rep_config_select" ON storage.objects;
CREATE POLICY "storage_rep_config_select" ON storage.objects AS PERMISSIVE FOR SELECT TO "authenticated"
  USING (((bucket_id = 'movelaria-rep-config'::text) AND (movelaria_meu_perfil() = 'administrador'::text)));
DROP POLICY IF EXISTS "storage_rep_config_update" ON storage.objects;
CREATE POLICY "storage_rep_config_update" ON storage.objects AS PERMISSIVE FOR UPDATE TO "authenticated"
  USING (((bucket_id = 'movelaria-rep-config'::text) AND (movelaria_meu_perfil() = 'administrador'::text)));
