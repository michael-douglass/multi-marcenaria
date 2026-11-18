-- GERADO por scripts/multi-empresa/gerar-tenant-migration.mjs (grupo: outras) — 235 tabelas.
-- Coluna de tenant + trigger aaa_tenant_fill + policy RESTRICTIVE tenant_isolamento + policy tenant_definer.
-- Tabelas que estavam SEM RLS ganham também tenant_acesso (permissiva, só dentro da empresa).

-- public.CRM-Selletos>agenda_bloqueios<
alter table "public"."CRM-Selletos>agenda_bloqueios<" add column empresa_id uuid;
update "public"."CRM-Selletos>agenda_bloqueios<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>agenda_bloqueios<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>agenda_bloqueios<" add constraint tnt_eb1d1679d3_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_eb1d1679d3_idx on "public"."CRM-Selletos>agenda_bloqueios<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>agenda_bloqueios<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>agenda_bloqueios<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>agenda_bloqueios<";
create policy tenant_isolamento on "public"."CRM-Selletos>agenda_bloqueios<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>agenda_bloqueios<";
create policy tenant_definer on "public"."CRM-Selletos>agenda_bloqueios<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>agenda_config<
alter table "public"."CRM-Selletos>agenda_config<" add column empresa_id uuid;
update "public"."CRM-Selletos>agenda_config<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>agenda_config<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>agenda_config<" add constraint tnt_8c034151c1_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_8c034151c1_idx on "public"."CRM-Selletos>agenda_config<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>agenda_config<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>agenda_config<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>agenda_config<";
create policy tenant_isolamento on "public"."CRM-Selletos>agenda_config<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>agenda_config<";
create policy tenant_definer on "public"."CRM-Selletos>agenda_config<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>agenda_form_fields<
alter table "public"."CRM-Selletos>agenda_form_fields<" add column empresa_id uuid;
update "public"."CRM-Selletos>agenda_form_fields<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>agenda_form_fields<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>agenda_form_fields<" add constraint tnt_7f41107b1c_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_7f41107b1c_idx on "public"."CRM-Selletos>agenda_form_fields<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>agenda_form_fields<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>agenda_form_fields<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>agenda_form_fields<";
create policy tenant_isolamento on "public"."CRM-Selletos>agenda_form_fields<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>agenda_form_fields<";
create policy tenant_definer on "public"."CRM-Selletos>agenda_form_fields<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>agenda_reunioes<
alter table "public"."CRM-Selletos>agenda_reunioes<" add column empresa_id uuid;
update "public"."CRM-Selletos>agenda_reunioes<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>agenda_reunioes<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>agenda_reunioes<" add constraint tnt_5e861a75c4_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_5e861a75c4_idx on "public"."CRM-Selletos>agenda_reunioes<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>agenda_reunioes<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>agenda_reunioes<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>agenda_reunioes<";
create policy tenant_isolamento on "public"."CRM-Selletos>agenda_reunioes<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>agenda_reunioes<";
create policy tenant_definer on "public"."CRM-Selletos>agenda_reunioes<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>cadastro_alunos<
alter table "public"."CRM-Selletos>cadastro_alunos<" add column empresa_id uuid;
update "public"."CRM-Selletos>cadastro_alunos<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>cadastro_alunos<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>cadastro_alunos<" add constraint tnt_822b5af9cc_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_822b5af9cc_idx on "public"."CRM-Selletos>cadastro_alunos<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>cadastro_alunos<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>cadastro_alunos<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>cadastro_alunos<";
create policy tenant_isolamento on "public"."CRM-Selletos>cadastro_alunos<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>cadastro_alunos<";
create policy tenant_definer on "public"."CRM-Selletos>cadastro_alunos<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>cadastro_config<
alter table "public"."CRM-Selletos>cadastro_config<" add column empresa_id uuid;
update "public"."CRM-Selletos>cadastro_config<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>cadastro_config<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>cadastro_config<" add constraint tnt_001ca9e85e_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_001ca9e85e_idx on "public"."CRM-Selletos>cadastro_config<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>cadastro_config<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>cadastro_config<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>cadastro_config<";
create policy tenant_isolamento on "public"."CRM-Selletos>cadastro_config<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>cadastro_config<";
create policy tenant_definer on "public"."CRM-Selletos>cadastro_config<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>desmatriculados_colunas<
alter table "public"."CRM-Selletos>desmatriculados_colunas<" add column empresa_id uuid;
update "public"."CRM-Selletos>desmatriculados_colunas<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>desmatriculados_colunas<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>desmatriculados_colunas<" add constraint tnt_d66cf9e4a6_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_d66cf9e4a6_idx on "public"."CRM-Selletos>desmatriculados_colunas<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>desmatriculados_colunas<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>desmatriculados_colunas<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>desmatriculados_colunas<";
create policy tenant_isolamento on "public"."CRM-Selletos>desmatriculados_colunas<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>desmatriculados_colunas<";
create policy tenant_definer on "public"."CRM-Selletos>desmatriculados_colunas<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>desmatriculados_kanban<
alter table "public"."CRM-Selletos>desmatriculados_kanban<" add column empresa_id uuid;
update "public"."CRM-Selletos>desmatriculados_kanban<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>desmatriculados_kanban<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>desmatriculados_kanban<" add constraint tnt_0ae796220a_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_0ae796220a_idx on "public"."CRM-Selletos>desmatriculados_kanban<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>desmatriculados_kanban<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>desmatriculados_kanban<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>desmatriculados_kanban<";
create policy tenant_isolamento on "public"."CRM-Selletos>desmatriculados_kanban<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>desmatriculados_kanban<";
create policy tenant_definer on "public"."CRM-Selletos>desmatriculados_kanban<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>desmatriculados_movimentos<
alter table "public"."CRM-Selletos>desmatriculados_movimentos<" add column empresa_id uuid;
update "public"."CRM-Selletos>desmatriculados_movimentos<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>desmatriculados_movimentos<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>desmatriculados_movimentos<" add constraint tnt_519d50d5cb_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_519d50d5cb_idx on "public"."CRM-Selletos>desmatriculados_movimentos<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>desmatriculados_movimentos<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>desmatriculados_movimentos<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>desmatriculados_movimentos<";
create policy tenant_isolamento on "public"."CRM-Selletos>desmatriculados_movimentos<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>desmatriculados_movimentos<";
create policy tenant_definer on "public"."CRM-Selletos>desmatriculados_movimentos<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>kanban_card_overrides<
alter table "public"."CRM-Selletos>kanban_card_overrides<" add column empresa_id uuid;
update "public"."CRM-Selletos>kanban_card_overrides<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>kanban_card_overrides<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>kanban_card_overrides<" add constraint tnt_0c4a5fe989_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_0c4a5fe989_idx on "public"."CRM-Selletos>kanban_card_overrides<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>kanban_card_overrides<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>kanban_card_overrides<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>kanban_card_overrides<";
create policy tenant_isolamento on "public"."CRM-Selletos>kanban_card_overrides<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>kanban_card_overrides<";
create policy tenant_definer on "public"."CRM-Selletos>kanban_card_overrides<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>kanban_column_sources<
alter table "public"."CRM-Selletos>kanban_column_sources<" add column empresa_id uuid;
update "public"."CRM-Selletos>kanban_column_sources<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>kanban_column_sources<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>kanban_column_sources<" add constraint tnt_84cffd675e_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_84cffd675e_idx on "public"."CRM-Selletos>kanban_column_sources<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>kanban_column_sources<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>kanban_column_sources<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>kanban_column_sources<";
create policy tenant_isolamento on "public"."CRM-Selletos>kanban_column_sources<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>kanban_column_sources<";
create policy tenant_definer on "public"."CRM-Selletos>kanban_column_sources<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>kanban_columns<
alter table "public"."CRM-Selletos>kanban_columns<" add column empresa_id uuid;
update "public"."CRM-Selletos>kanban_columns<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>kanban_columns<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>kanban_columns<" add constraint tnt_cfb3f16031_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_cfb3f16031_idx on "public"."CRM-Selletos>kanban_columns<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>kanban_columns<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>kanban_columns<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>kanban_columns<";
create policy tenant_isolamento on "public"."CRM-Selletos>kanban_columns<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>kanban_columns<";
create policy tenant_definer on "public"."CRM-Selletos>kanban_columns<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>kanban_pages<
alter table "public"."CRM-Selletos>kanban_pages<" add column empresa_id uuid;
update "public"."CRM-Selletos>kanban_pages<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>kanban_pages<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>kanban_pages<" add constraint tnt_2f9c16aa7c_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_2f9c16aa7c_idx on "public"."CRM-Selletos>kanban_pages<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>kanban_pages<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>kanban_pages<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>kanban_pages<";
create policy tenant_isolamento on "public"."CRM-Selletos>kanban_pages<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>kanban_pages<";
create policy tenant_definer on "public"."CRM-Selletos>kanban_pages<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>lead_lembretes<
alter table "public"."CRM-Selletos>lead_lembretes<" add column empresa_id uuid;
update "public"."CRM-Selletos>lead_lembretes<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>lead_lembretes<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>lead_lembretes<" add constraint tnt_1d3161087e_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_1d3161087e_idx on "public"."CRM-Selletos>lead_lembretes<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>lead_lembretes<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>lead_lembretes<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>lead_lembretes<";
create policy tenant_isolamento on "public"."CRM-Selletos>lead_lembretes<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>lead_lembretes<";
create policy tenant_definer on "public"."CRM-Selletos>lead_lembretes<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>lead_origins<
alter table "public"."CRM-Selletos>lead_origins<" add column empresa_id uuid;
update "public"."CRM-Selletos>lead_origins<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>lead_origins<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>lead_origins<" add constraint tnt_f7514cdf14_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_f7514cdf14_idx on "public"."CRM-Selletos>lead_origins<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>lead_origins<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>lead_origins<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>lead_origins<";
create policy tenant_isolamento on "public"."CRM-Selletos>lead_origins<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>lead_origins<";
create policy tenant_definer on "public"."CRM-Selletos>lead_origins<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>leads<
alter table "public"."CRM-Selletos>leads<" add column empresa_id uuid;
update "public"."CRM-Selletos>leads<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>leads<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>leads<" add constraint tnt_96ba477723_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_96ba477723_idx on "public"."CRM-Selletos>leads<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>leads<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>leads<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>leads<";
create policy tenant_isolamento on "public"."CRM-Selletos>leads<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>leads<";
create policy tenant_definer on "public"."CRM-Selletos>leads<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>marketing_p2p_campaign_history<
alter table "public"."CRM-Selletos>marketing_p2p_campaign_history<" add column empresa_id uuid;
update "public"."CRM-Selletos>marketing_p2p_campaign_history<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>marketing_p2p_campaign_history<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>marketing_p2p_campaign_history<" add constraint tnt_712fd79633_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_712fd79633_idx on "public"."CRM-Selletos>marketing_p2p_campaign_history<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>marketing_p2p_campaign_history<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>marketing_p2p_campaign_history<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_campaign_history<";
create policy tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_campaign_history<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>marketing_p2p_campaign_history<";
create policy tenant_definer on "public"."CRM-Selletos>marketing_p2p_campaign_history<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>marketing_p2p_columns<
alter table "public"."CRM-Selletos>marketing_p2p_columns<" add column empresa_id uuid;
update "public"."CRM-Selletos>marketing_p2p_columns<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>marketing_p2p_columns<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>marketing_p2p_columns<" add constraint tnt_5bfab8a133_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_5bfab8a133_idx on "public"."CRM-Selletos>marketing_p2p_columns<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>marketing_p2p_columns<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>marketing_p2p_columns<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_columns<";
create policy tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_columns<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>marketing_p2p_columns<";
create policy tenant_definer on "public"."CRM-Selletos>marketing_p2p_columns<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>marketing_p2p_commission_ledger<
alter table "public"."CRM-Selletos>marketing_p2p_commission_ledger<" add column empresa_id uuid;
update "public"."CRM-Selletos>marketing_p2p_commission_ledger<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>marketing_p2p_commission_ledger<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>marketing_p2p_commission_ledger<" add constraint tnt_fcbc4ec971_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_fcbc4ec971_idx on "public"."CRM-Selletos>marketing_p2p_commission_ledger<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>marketing_p2p_commission_ledger<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>marketing_p2p_commission_ledger<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_commission_ledger<";
create policy tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_commission_ledger<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>marketing_p2p_commission_ledger<";
create policy tenant_definer on "public"."CRM-Selletos>marketing_p2p_commission_ledger<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>marketing_p2p_commission_rules<
alter table "public"."CRM-Selletos>marketing_p2p_commission_rules<" add column empresa_id uuid;
update "public"."CRM-Selletos>marketing_p2p_commission_rules<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>marketing_p2p_commission_rules<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>marketing_p2p_commission_rules<" add constraint tnt_7ae967ae58_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_7ae967ae58_idx on "public"."CRM-Selletos>marketing_p2p_commission_rules<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>marketing_p2p_commission_rules<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>marketing_p2p_commission_rules<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_commission_rules<";
create policy tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_commission_rules<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>marketing_p2p_commission_rules<";
create policy tenant_definer on "public"."CRM-Selletos>marketing_p2p_commission_rules<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>marketing_p2p_contact_proof_files<
alter table "public"."CRM-Selletos>marketing_p2p_contact_proof_files<" add column empresa_id uuid;
update "public"."CRM-Selletos>marketing_p2p_contact_proof_files<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>marketing_p2p_contact_proof_files<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>marketing_p2p_contact_proof_files<" add constraint tnt_236ee243e0_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_236ee243e0_idx on "public"."CRM-Selletos>marketing_p2p_contact_proof_files<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>marketing_p2p_contact_proof_files<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>marketing_p2p_contact_proof_files<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_contact_proof_files<";
create policy tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_contact_proof_files<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>marketing_p2p_contact_proof_files<";
create policy tenant_definer on "public"."CRM-Selletos>marketing_p2p_contact_proof_files<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>marketing_p2p_contact_proofs<
alter table "public"."CRM-Selletos>marketing_p2p_contact_proofs<" add column empresa_id uuid;
update "public"."CRM-Selletos>marketing_p2p_contact_proofs<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>marketing_p2p_contact_proofs<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>marketing_p2p_contact_proofs<" add constraint tnt_0f2aa59790_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_0f2aa59790_idx on "public"."CRM-Selletos>marketing_p2p_contact_proofs<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>marketing_p2p_contact_proofs<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>marketing_p2p_contact_proofs<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_contact_proofs<";
create policy tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_contact_proofs<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>marketing_p2p_contact_proofs<";
create policy tenant_definer on "public"."CRM-Selletos>marketing_p2p_contact_proofs<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>marketing_p2p_daily_moves<
alter table "public"."CRM-Selletos>marketing_p2p_daily_moves<" add column empresa_id uuid;
update "public"."CRM-Selletos>marketing_p2p_daily_moves<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>marketing_p2p_daily_moves<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>marketing_p2p_daily_moves<" add constraint tnt_f159cad143_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_f159cad143_idx on "public"."CRM-Selletos>marketing_p2p_daily_moves<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>marketing_p2p_daily_moves<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>marketing_p2p_daily_moves<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_daily_moves<";
create policy tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_daily_moves<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>marketing_p2p_daily_moves<";
create policy tenant_definer on "public"."CRM-Selletos>marketing_p2p_daily_moves<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>marketing_p2p_daily_trigger_runs<
alter table "public"."CRM-Selletos>marketing_p2p_daily_trigger_runs<" add column empresa_id uuid;
update "public"."CRM-Selletos>marketing_p2p_daily_trigger_runs<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>marketing_p2p_daily_trigger_runs<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>marketing_p2p_daily_trigger_runs<" add constraint tnt_8539a6a384_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_8539a6a384_idx on "public"."CRM-Selletos>marketing_p2p_daily_trigger_runs<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>marketing_p2p_daily_trigger_runs<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>marketing_p2p_daily_trigger_runs<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_daily_trigger_runs<";
create policy tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_daily_trigger_runs<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>marketing_p2p_daily_trigger_runs<";
create policy tenant_definer on "public"."CRM-Selletos>marketing_p2p_daily_trigger_runs<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>marketing_p2p_daily_triggers<
alter table "public"."CRM-Selletos>marketing_p2p_daily_triggers<" add column empresa_id uuid;
update "public"."CRM-Selletos>marketing_p2p_daily_triggers<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>marketing_p2p_daily_triggers<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>marketing_p2p_daily_triggers<" add constraint tnt_8657bcb4bd_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_8657bcb4bd_idx on "public"."CRM-Selletos>marketing_p2p_daily_triggers<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>marketing_p2p_daily_triggers<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>marketing_p2p_daily_triggers<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_daily_triggers<";
create policy tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_daily_triggers<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>marketing_p2p_daily_triggers<";
create policy tenant_definer on "public"."CRM-Selletos>marketing_p2p_daily_triggers<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>marketing_p2p_placements<
alter table "public"."CRM-Selletos>marketing_p2p_placements<" add column empresa_id uuid;
update "public"."CRM-Selletos>marketing_p2p_placements<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>marketing_p2p_placements<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>marketing_p2p_placements<" add constraint tnt_f578e0794c_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_f578e0794c_idx on "public"."CRM-Selletos>marketing_p2p_placements<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>marketing_p2p_placements<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>marketing_p2p_placements<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_placements<";
create policy tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_placements<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>marketing_p2p_placements<";
create policy tenant_definer on "public"."CRM-Selletos>marketing_p2p_placements<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>marketing_p2p_proof_draft_files<
alter table "public"."CRM-Selletos>marketing_p2p_proof_draft_files<" add column empresa_id uuid;
update "public"."CRM-Selletos>marketing_p2p_proof_draft_files<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>marketing_p2p_proof_draft_files<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>marketing_p2p_proof_draft_files<" add constraint tnt_b865632d20_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_b865632d20_idx on "public"."CRM-Selletos>marketing_p2p_proof_draft_files<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>marketing_p2p_proof_draft_files<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>marketing_p2p_proof_draft_files<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_proof_draft_files<";
create policy tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_proof_draft_files<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>marketing_p2p_proof_draft_files<";
create policy tenant_definer on "public"."CRM-Selletos>marketing_p2p_proof_draft_files<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>marketing_p2p_proof_draft_items<
alter table "public"."CRM-Selletos>marketing_p2p_proof_draft_items<" add column empresa_id uuid;
update "public"."CRM-Selletos>marketing_p2p_proof_draft_items<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>marketing_p2p_proof_draft_items<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>marketing_p2p_proof_draft_items<" add constraint tnt_85b84765b7_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_85b84765b7_idx on "public"."CRM-Selletos>marketing_p2p_proof_draft_items<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>marketing_p2p_proof_draft_items<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>marketing_p2p_proof_draft_items<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_proof_draft_items<";
create policy tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_proof_draft_items<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>marketing_p2p_proof_draft_items<";
create policy tenant_definer on "public"."CRM-Selletos>marketing_p2p_proof_draft_items<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>marketing_p2p_proof_drafts<
alter table "public"."CRM-Selletos>marketing_p2p_proof_drafts<" add column empresa_id uuid;
update "public"."CRM-Selletos>marketing_p2p_proof_drafts<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>marketing_p2p_proof_drafts<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>marketing_p2p_proof_drafts<" add constraint tnt_80daff98a2_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_80daff98a2_idx on "public"."CRM-Selletos>marketing_p2p_proof_drafts<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>marketing_p2p_proof_drafts<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>marketing_p2p_proof_drafts<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_proof_drafts<";
create policy tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_proof_drafts<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>marketing_p2p_proof_drafts<";
create policy tenant_definer on "public"."CRM-Selletos>marketing_p2p_proof_drafts<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>marketing_p2p_proof_locks<
alter table "public"."CRM-Selletos>marketing_p2p_proof_locks<" add column empresa_id uuid;
update "public"."CRM-Selletos>marketing_p2p_proof_locks<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>marketing_p2p_proof_locks<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>marketing_p2p_proof_locks<" add constraint tnt_d673e75f86_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_d673e75f86_idx on "public"."CRM-Selletos>marketing_p2p_proof_locks<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>marketing_p2p_proof_locks<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>marketing_p2p_proof_locks<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_proof_locks<";
create policy tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_proof_locks<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>marketing_p2p_proof_locks<";
create policy tenant_definer on "public"."CRM-Selletos>marketing_p2p_proof_locks<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>marketing_p2p_routing_rules<
alter table "public"."CRM-Selletos>marketing_p2p_routing_rules<" add column empresa_id uuid;
update "public"."CRM-Selletos>marketing_p2p_routing_rules<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>marketing_p2p_routing_rules<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>marketing_p2p_routing_rules<" add constraint tnt_1634a79e21_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_1634a79e21_idx on "public"."CRM-Selletos>marketing_p2p_routing_rules<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>marketing_p2p_routing_rules<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>marketing_p2p_routing_rules<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_routing_rules<";
create policy tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_routing_rules<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>marketing_p2p_routing_rules<";
create policy tenant_definer on "public"."CRM-Selletos>marketing_p2p_routing_rules<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>marketing_p2p_routing_runs<
alter table "public"."CRM-Selletos>marketing_p2p_routing_runs<" add column empresa_id uuid;
update "public"."CRM-Selletos>marketing_p2p_routing_runs<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>marketing_p2p_routing_runs<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>marketing_p2p_routing_runs<" add constraint tnt_c782a08a2f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_c782a08a2f_idx on "public"."CRM-Selletos>marketing_p2p_routing_runs<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>marketing_p2p_routing_runs<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>marketing_p2p_routing_runs<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_routing_runs<";
create policy tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_routing_runs<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>marketing_p2p_routing_runs<";
create policy tenant_definer on "public"."CRM-Selletos>marketing_p2p_routing_runs<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>marketing_p2p_settings<
alter table "public"."CRM-Selletos>marketing_p2p_settings<" add column empresa_id uuid;
update "public"."CRM-Selletos>marketing_p2p_settings<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>marketing_p2p_settings<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>marketing_p2p_settings<" add constraint tnt_72e60d1671_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_72e60d1671_idx on "public"."CRM-Selletos>marketing_p2p_settings<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>marketing_p2p_settings<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>marketing_p2p_settings<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_settings<";
create policy tenant_isolamento on "public"."CRM-Selletos>marketing_p2p_settings<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>marketing_p2p_settings<";
create policy tenant_definer on "public"."CRM-Selletos>marketing_p2p_settings<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>notifications<
alter table "public"."CRM-Selletos>notifications<" add column empresa_id uuid;
update "public"."CRM-Selletos>notifications<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>notifications<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>notifications<" add constraint tnt_d04ba519d1_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_d04ba519d1_idx on "public"."CRM-Selletos>notifications<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>notifications<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>notifications<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>notifications<";
create policy tenant_isolamento on "public"."CRM-Selletos>notifications<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>notifications<";
create policy tenant_definer on "public"."CRM-Selletos>notifications<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>pipeline_custom_stages<
alter table "public"."CRM-Selletos>pipeline_custom_stages<" add column empresa_id uuid;
update "public"."CRM-Selletos>pipeline_custom_stages<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>pipeline_custom_stages<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>pipeline_custom_stages<" add constraint tnt_2a07626610_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_2a07626610_idx on "public"."CRM-Selletos>pipeline_custom_stages<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>pipeline_custom_stages<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>pipeline_custom_stages<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>pipeline_custom_stages<";
create policy tenant_isolamento on "public"."CRM-Selletos>pipeline_custom_stages<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>pipeline_custom_stages<";
create policy tenant_definer on "public"."CRM-Selletos>pipeline_custom_stages<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>pipeline_daily_metrics<
alter table "public"."CRM-Selletos>pipeline_daily_metrics<" add column empresa_id uuid;
update "public"."CRM-Selletos>pipeline_daily_metrics<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>pipeline_daily_metrics<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>pipeline_daily_metrics<" add constraint tnt_410076f8d1_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_410076f8d1_idx on "public"."CRM-Selletos>pipeline_daily_metrics<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>pipeline_daily_metrics<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>pipeline_daily_metrics<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>pipeline_daily_metrics<";
create policy tenant_isolamento on "public"."CRM-Selletos>pipeline_daily_metrics<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>pipeline_daily_metrics<";
create policy tenant_definer on "public"."CRM-Selletos>pipeline_daily_metrics<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>pipeline_time_config<
alter table "public"."CRM-Selletos>pipeline_time_config<" add column empresa_id uuid;
update "public"."CRM-Selletos>pipeline_time_config<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>pipeline_time_config<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>pipeline_time_config<" add constraint tnt_48d9e9760f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_48d9e9760f_idx on "public"."CRM-Selletos>pipeline_time_config<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>pipeline_time_config<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>pipeline_time_config<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>pipeline_time_config<";
create policy tenant_isolamento on "public"."CRM-Selletos>pipeline_time_config<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>pipeline_time_config<";
create policy tenant_definer on "public"."CRM-Selletos>pipeline_time_config<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>ponto_registros<
alter table "public"."CRM-Selletos>ponto_registros<" add column empresa_id uuid;
update "public"."CRM-Selletos>ponto_registros<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>ponto_registros<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>ponto_registros<" add constraint tnt_58c9ab1628_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_58c9ab1628_idx on "public"."CRM-Selletos>ponto_registros<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>ponto_registros<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>ponto_registros<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>ponto_registros<";
create policy tenant_isolamento on "public"."CRM-Selletos>ponto_registros<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>ponto_registros<";
create policy tenant_definer on "public"."CRM-Selletos>ponto_registros<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>presence_sessions<
alter table "public"."CRM-Selletos>presence_sessions<" add column empresa_id uuid;
update "public"."CRM-Selletos>presence_sessions<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>presence_sessions<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>presence_sessions<" add constraint tnt_8523cef1f4_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_8523cef1f4_idx on "public"."CRM-Selletos>presence_sessions<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>presence_sessions<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>presence_sessions<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>presence_sessions<";
create policy tenant_isolamento on "public"."CRM-Selletos>presence_sessions<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>presence_sessions<";
create policy tenant_definer on "public"."CRM-Selletos>presence_sessions<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>relatorios_reunioes<
alter table "public"."CRM-Selletos>relatorios_reunioes<" add column empresa_id uuid;
update "public"."CRM-Selletos>relatorios_reunioes<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>relatorios_reunioes<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>relatorios_reunioes<" add constraint tnt_6cdba6d4ee_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_6cdba6d4ee_idx on "public"."CRM-Selletos>relatorios_reunioes<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>relatorios_reunioes<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>relatorios_reunioes<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>relatorios_reunioes<";
create policy tenant_isolamento on "public"."CRM-Selletos>relatorios_reunioes<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>relatorios_reunioes<";
create policy tenant_definer on "public"."CRM-Selletos>relatorios_reunioes<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>tabela_origem_config<
alter table "public"."CRM-Selletos>tabela_origem_config<" add column empresa_id uuid;
update "public"."CRM-Selletos>tabela_origem_config<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>tabela_origem_config<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>tabela_origem_config<" add constraint tnt_a2b042866a_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_a2b042866a_idx on "public"."CRM-Selletos>tabela_origem_config<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>tabela_origem_config<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>tabela_origem_config<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>tabela_origem_config<";
create policy tenant_isolamento on "public"."CRM-Selletos>tabela_origem_config<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>tabela_origem_config<";
create policy tenant_definer on "public"."CRM-Selletos>tabela_origem_config<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>user_permissions<
alter table "public"."CRM-Selletos>user_permissions<" add column empresa_id uuid;
update "public"."CRM-Selletos>user_permissions<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>user_permissions<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>user_permissions<" add constraint tnt_33856bd5a1_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_33856bd5a1_idx on "public"."CRM-Selletos>user_permissions<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>user_permissions<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>user_permissions<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>user_permissions<";
create policy tenant_isolamento on "public"."CRM-Selletos>user_permissions<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>user_permissions<";
create policy tenant_definer on "public"."CRM-Selletos>user_permissions<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>user_roles<
alter table "public"."CRM-Selletos>user_roles<" add column empresa_id uuid;
update "public"."CRM-Selletos>user_roles<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>user_roles<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>user_roles<" add constraint tnt_8b1e25f2cc_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_8b1e25f2cc_idx on "public"."CRM-Selletos>user_roles<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>user_roles<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>user_roles<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>user_roles<";
create policy tenant_isolamento on "public"."CRM-Selletos>user_roles<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>user_roles<";
create policy tenant_definer on "public"."CRM-Selletos>user_roles<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>uso_config<
alter table "public"."CRM-Selletos>uso_config<" add column empresa_id uuid;
update "public"."CRM-Selletos>uso_config<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>uso_config<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>uso_config<" add constraint tnt_94bba3b4b8_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_94bba3b4b8_idx on "public"."CRM-Selletos>uso_config<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>uso_config<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>uso_config<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>uso_config<";
create policy tenant_isolamento on "public"."CRM-Selletos>uso_config<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>uso_config<";
create policy tenant_definer on "public"."CRM-Selletos>uso_config<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>usuarios<
alter table "public"."CRM-Selletos>usuarios<" add column empresa_id uuid;
update "public"."CRM-Selletos>usuarios<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>usuarios<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>usuarios<" add constraint tnt_db0340e175_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_db0340e175_idx on "public"."CRM-Selletos>usuarios<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>usuarios<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>usuarios<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>usuarios<";
create policy tenant_isolamento on "public"."CRM-Selletos>usuarios<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>usuarios<";
create policy tenant_definer on "public"."CRM-Selletos>usuarios<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-Selletos>webhooks_api<
alter table "public"."CRM-Selletos>webhooks_api<" add column empresa_id uuid;
update "public"."CRM-Selletos>webhooks_api<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-Selletos>webhooks_api<" alter column empresa_id set not null;
alter table "public"."CRM-Selletos>webhooks_api<" add constraint tnt_029da6b3d2_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_029da6b3d2_idx on "public"."CRM-Selletos>webhooks_api<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-Selletos>webhooks_api<";
create trigger aaa_tenant_fill before insert on "public"."CRM-Selletos>webhooks_api<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-Selletos>webhooks_api<";
create policy tenant_isolamento on "public"."CRM-Selletos>webhooks_api<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-Selletos>webhooks_api<";
create policy tenant_definer on "public"."CRM-Selletos>webhooks_api<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>agenda_bloqueios<
alter table "public"."CRM-multi-empresas>agenda_bloqueios<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>agenda_bloqueios<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>agenda_bloqueios<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>agenda_bloqueios<" add constraint tnt_63fb90856a_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_63fb90856a_idx on "public"."CRM-multi-empresas>agenda_bloqueios<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>agenda_bloqueios<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>agenda_bloqueios<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>agenda_bloqueios<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>agenda_bloqueios<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>agenda_bloqueios<";
create policy tenant_definer on "public"."CRM-multi-empresas>agenda_bloqueios<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>agenda_config<
alter table "public"."CRM-multi-empresas>agenda_config<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>agenda_config<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>agenda_config<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>agenda_config<" add constraint tnt_dafb54a78c_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_dafb54a78c_idx on "public"."CRM-multi-empresas>agenda_config<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>agenda_config<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>agenda_config<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>agenda_config<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>agenda_config<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>agenda_config<";
create policy tenant_definer on "public"."CRM-multi-empresas>agenda_config<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>agenda_form_fields<
alter table "public"."CRM-multi-empresas>agenda_form_fields<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>agenda_form_fields<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>agenda_form_fields<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>agenda_form_fields<" add constraint tnt_b8aab54ffd_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_b8aab54ffd_idx on "public"."CRM-multi-empresas>agenda_form_fields<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>agenda_form_fields<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>agenda_form_fields<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>agenda_form_fields<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>agenda_form_fields<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>agenda_form_fields<";
create policy tenant_definer on "public"."CRM-multi-empresas>agenda_form_fields<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>agenda_reunioes<
alter table "public"."CRM-multi-empresas>agenda_reunioes<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>agenda_reunioes<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>agenda_reunioes<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>agenda_reunioes<" add constraint tnt_bfd0055ec9_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_bfd0055ec9_idx on "public"."CRM-multi-empresas>agenda_reunioes<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>agenda_reunioes<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>agenda_reunioes<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>agenda_reunioes<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>agenda_reunioes<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>agenda_reunioes<";
create policy tenant_definer on "public"."CRM-multi-empresas>agenda_reunioes<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>cadastro_alunos<
alter table "public"."CRM-multi-empresas>cadastro_alunos<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>cadastro_alunos<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>cadastro_alunos<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>cadastro_alunos<" add constraint tnt_90db0dbcdc_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_90db0dbcdc_idx on "public"."CRM-multi-empresas>cadastro_alunos<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>cadastro_alunos<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>cadastro_alunos<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>cadastro_alunos<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>cadastro_alunos<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>cadastro_alunos<";
create policy tenant_definer on "public"."CRM-multi-empresas>cadastro_alunos<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>cadastro_config<
alter table "public"."CRM-multi-empresas>cadastro_config<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>cadastro_config<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>cadastro_config<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>cadastro_config<" add constraint tnt_1b4bbc1b39_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_1b4bbc1b39_idx on "public"."CRM-multi-empresas>cadastro_config<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>cadastro_config<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>cadastro_config<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>cadastro_config<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>cadastro_config<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>cadastro_config<";
create policy tenant_definer on "public"."CRM-multi-empresas>cadastro_config<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>contratos<
alter table "public"."CRM-multi-empresas>contratos<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>contratos<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>contratos<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>contratos<" add constraint tnt_6d5f298b7c_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_6d5f298b7c_idx on "public"."CRM-multi-empresas>contratos<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>contratos<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>contratos<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>contratos<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>contratos<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>contratos<";
create policy tenant_definer on "public"."CRM-multi-empresas>contratos<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>contratos_anexos<
alter table "public"."CRM-multi-empresas>contratos_anexos<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>contratos_anexos<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>contratos_anexos<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>contratos_anexos<" add constraint tnt_e50379827a_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_e50379827a_idx on "public"."CRM-multi-empresas>contratos_anexos<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>contratos_anexos<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>contratos_anexos<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>contratos_anexos<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>contratos_anexos<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>contratos_anexos<";
create policy tenant_definer on "public"."CRM-multi-empresas>contratos_anexos<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>contratos_modelos<
alter table "public"."CRM-multi-empresas>contratos_modelos<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>contratos_modelos<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>contratos_modelos<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>contratos_modelos<" add constraint tnt_2e5d1100b3_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_2e5d1100b3_idx on "public"."CRM-multi-empresas>contratos_modelos<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>contratos_modelos<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>contratos_modelos<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>contratos_modelos<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>contratos_modelos<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>contratos_modelos<";
create policy tenant_definer on "public"."CRM-multi-empresas>contratos_modelos<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>contratos_variaveis<
alter table "public"."CRM-multi-empresas>contratos_variaveis<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>contratos_variaveis<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>contratos_variaveis<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>contratos_variaveis<" add constraint tnt_25da6da5bf_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_25da6da5bf_idx on "public"."CRM-multi-empresas>contratos_variaveis<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>contratos_variaveis<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>contratos_variaveis<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>contratos_variaveis<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>contratos_variaveis<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>contratos_variaveis<";
create policy tenant_definer on "public"."CRM-multi-empresas>contratos_variaveis<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>desmatriculados_colunas<
alter table "public"."CRM-multi-empresas>desmatriculados_colunas<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>desmatriculados_colunas<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>desmatriculados_colunas<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>desmatriculados_colunas<" add constraint tnt_b79fc2ebbd_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_b79fc2ebbd_idx on "public"."CRM-multi-empresas>desmatriculados_colunas<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>desmatriculados_colunas<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>desmatriculados_colunas<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>desmatriculados_colunas<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>desmatriculados_colunas<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>desmatriculados_colunas<";
create policy tenant_definer on "public"."CRM-multi-empresas>desmatriculados_colunas<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>desmatriculados_kanban<
alter table "public"."CRM-multi-empresas>desmatriculados_kanban<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>desmatriculados_kanban<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>desmatriculados_kanban<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>desmatriculados_kanban<" add constraint tnt_c46fbf9818_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_c46fbf9818_idx on "public"."CRM-multi-empresas>desmatriculados_kanban<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>desmatriculados_kanban<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>desmatriculados_kanban<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>desmatriculados_kanban<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>desmatriculados_kanban<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>desmatriculados_kanban<";
create policy tenant_definer on "public"."CRM-multi-empresas>desmatriculados_kanban<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>desmatriculados_movimentos<
alter table "public"."CRM-multi-empresas>desmatriculados_movimentos<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>desmatriculados_movimentos<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>desmatriculados_movimentos<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>desmatriculados_movimentos<" add constraint tnt_b152c91039_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_b152c91039_idx on "public"."CRM-multi-empresas>desmatriculados_movimentos<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>desmatriculados_movimentos<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>desmatriculados_movimentos<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>desmatriculados_movimentos<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>desmatriculados_movimentos<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>desmatriculados_movimentos<";
create policy tenant_definer on "public"."CRM-multi-empresas>desmatriculados_movimentos<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>kanban_card_overrides<
alter table "public"."CRM-multi-empresas>kanban_card_overrides<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>kanban_card_overrides<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>kanban_card_overrides<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>kanban_card_overrides<" add constraint tnt_55f9a550c9_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_55f9a550c9_idx on "public"."CRM-multi-empresas>kanban_card_overrides<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>kanban_card_overrides<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>kanban_card_overrides<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>kanban_card_overrides<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>kanban_card_overrides<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>kanban_card_overrides<";
create policy tenant_definer on "public"."CRM-multi-empresas>kanban_card_overrides<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>kanban_column_sources<
alter table "public"."CRM-multi-empresas>kanban_column_sources<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>kanban_column_sources<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>kanban_column_sources<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>kanban_column_sources<" add constraint tnt_d5333235e1_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_d5333235e1_idx on "public"."CRM-multi-empresas>kanban_column_sources<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>kanban_column_sources<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>kanban_column_sources<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>kanban_column_sources<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>kanban_column_sources<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>kanban_column_sources<";
create policy tenant_definer on "public"."CRM-multi-empresas>kanban_column_sources<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>kanban_columns<
alter table "public"."CRM-multi-empresas>kanban_columns<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>kanban_columns<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>kanban_columns<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>kanban_columns<" add constraint tnt_2b61dec132_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_2b61dec132_idx on "public"."CRM-multi-empresas>kanban_columns<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>kanban_columns<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>kanban_columns<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>kanban_columns<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>kanban_columns<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>kanban_columns<";
create policy tenant_definer on "public"."CRM-multi-empresas>kanban_columns<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>kanban_pages<
alter table "public"."CRM-multi-empresas>kanban_pages<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>kanban_pages<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>kanban_pages<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>kanban_pages<" add constraint tnt_8397f30e33_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_8397f30e33_idx on "public"."CRM-multi-empresas>kanban_pages<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>kanban_pages<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>kanban_pages<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>kanban_pages<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>kanban_pages<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>kanban_pages<";
create policy tenant_definer on "public"."CRM-multi-empresas>kanban_pages<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>lead_ai_analises<
alter table "public"."CRM-multi-empresas>lead_ai_analises<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>lead_ai_analises<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>lead_ai_analises<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>lead_ai_analises<" add constraint tnt_81894f54ef_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_81894f54ef_idx on "public"."CRM-multi-empresas>lead_ai_analises<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>lead_ai_analises<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>lead_ai_analises<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>lead_ai_analises<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>lead_ai_analises<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>lead_ai_analises<";
create policy tenant_definer on "public"."CRM-multi-empresas>lead_ai_analises<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>lead_ai_chat_messages<
alter table "public"."CRM-multi-empresas>lead_ai_chat_messages<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>lead_ai_chat_messages<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>lead_ai_chat_messages<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>lead_ai_chat_messages<" add constraint tnt_9cfed07644_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_9cfed07644_idx on "public"."CRM-multi-empresas>lead_ai_chat_messages<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>lead_ai_chat_messages<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>lead_ai_chat_messages<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>lead_ai_chat_messages<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>lead_ai_chat_messages<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>lead_ai_chat_messages<";
create policy tenant_definer on "public"."CRM-multi-empresas>lead_ai_chat_messages<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>lead_ai_knowledge_chunks<
alter table "public"."CRM-multi-empresas>lead_ai_knowledge_chunks<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>lead_ai_knowledge_chunks<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>lead_ai_knowledge_chunks<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>lead_ai_knowledge_chunks<" add constraint tnt_d533f01976_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_d533f01976_idx on "public"."CRM-multi-empresas>lead_ai_knowledge_chunks<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>lead_ai_knowledge_chunks<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>lead_ai_knowledge_chunks<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>lead_ai_knowledge_chunks<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>lead_ai_knowledge_chunks<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>lead_ai_knowledge_chunks<";
create policy tenant_definer on "public"."CRM-multi-empresas>lead_ai_knowledge_chunks<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>lead_ai_knowledge_meta<
alter table "public"."CRM-multi-empresas>lead_ai_knowledge_meta<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>lead_ai_knowledge_meta<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>lead_ai_knowledge_meta<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>lead_ai_knowledge_meta<" add constraint tnt_dba517531b_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_dba517531b_idx on "public"."CRM-multi-empresas>lead_ai_knowledge_meta<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>lead_ai_knowledge_meta<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>lead_ai_knowledge_meta<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>lead_ai_knowledge_meta<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>lead_ai_knowledge_meta<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>lead_ai_knowledge_meta<";
create policy tenant_definer on "public"."CRM-multi-empresas>lead_ai_knowledge_meta<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>lead_ai_renders<
alter table "public"."CRM-multi-empresas>lead_ai_renders<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>lead_ai_renders<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>lead_ai_renders<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>lead_ai_renders<" add constraint tnt_99e05eaa01_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_99e05eaa01_idx on "public"."CRM-multi-empresas>lead_ai_renders<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>lead_ai_renders<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>lead_ai_renders<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>lead_ai_renders<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>lead_ai_renders<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>lead_ai_renders<";
create policy tenant_definer on "public"."CRM-multi-empresas>lead_ai_renders<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>lead_custom_field_definitions<
alter table "public"."CRM-multi-empresas>lead_custom_field_definitions<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>lead_custom_field_definitions<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>lead_custom_field_definitions<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>lead_custom_field_definitions<" add constraint tnt_e897b1bfa1_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_e897b1bfa1_idx on "public"."CRM-multi-empresas>lead_custom_field_definitions<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>lead_custom_field_definitions<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>lead_custom_field_definitions<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>lead_custom_field_definitions<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>lead_custom_field_definitions<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>lead_custom_field_definitions<";
create policy tenant_definer on "public"."CRM-multi-empresas>lead_custom_field_definitions<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>lead_custom_field_values<
alter table "public"."CRM-multi-empresas>lead_custom_field_values<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>lead_custom_field_values<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>lead_custom_field_values<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>lead_custom_field_values<" add constraint tnt_d074bdb133_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_d074bdb133_idx on "public"."CRM-multi-empresas>lead_custom_field_values<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>lead_custom_field_values<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>lead_custom_field_values<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>lead_custom_field_values<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>lead_custom_field_values<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>lead_custom_field_values<";
create policy tenant_definer on "public"."CRM-multi-empresas>lead_custom_field_values<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>lead_lembretes<
alter table "public"."CRM-multi-empresas>lead_lembretes<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>lead_lembretes<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>lead_lembretes<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>lead_lembretes<" add constraint tnt_f9bed30fe8_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_f9bed30fe8_idx on "public"."CRM-multi-empresas>lead_lembretes<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>lead_lembretes<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>lead_lembretes<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>lead_lembretes<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>lead_lembretes<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>lead_lembretes<";
create policy tenant_definer on "public"."CRM-multi-empresas>lead_lembretes<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>lead_negociacoes<
alter table "public"."CRM-multi-empresas>lead_negociacoes<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>lead_negociacoes<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>lead_negociacoes<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>lead_negociacoes<" add constraint tnt_226fd56bc2_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_226fd56bc2_idx on "public"."CRM-multi-empresas>lead_negociacoes<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>lead_negociacoes<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>lead_negociacoes<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>lead_negociacoes<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>lead_negociacoes<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>lead_negociacoes<";
create policy tenant_definer on "public"."CRM-multi-empresas>lead_negociacoes<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>lead_negociador_config<
alter table "public"."CRM-multi-empresas>lead_negociador_config<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>lead_negociador_config<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>lead_negociador_config<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>lead_negociador_config<" add constraint tnt_a3759457a7_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_a3759457a7_idx on "public"."CRM-multi-empresas>lead_negociador_config<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>lead_negociador_config<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>lead_negociador_config<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>lead_negociador_config<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>lead_negociador_config<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>lead_negociador_config<";
create policy tenant_definer on "public"."CRM-multi-empresas>lead_negociador_config<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>lead_origins<
alter table "public"."CRM-multi-empresas>lead_origins<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>lead_origins<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>lead_origins<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>lead_origins<" add constraint tnt_53edd770b8_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_53edd770b8_idx on "public"."CRM-multi-empresas>lead_origins<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>lead_origins<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>lead_origins<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>lead_origins<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>lead_origins<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>lead_origins<";
create policy tenant_definer on "public"."CRM-multi-empresas>lead_origins<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>lead_pipeline_movimentos<
alter table "public"."CRM-multi-empresas>lead_pipeline_movimentos<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>lead_pipeline_movimentos<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>lead_pipeline_movimentos<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>lead_pipeline_movimentos<" add constraint tnt_913c2a9640_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_913c2a9640_idx on "public"."CRM-multi-empresas>lead_pipeline_movimentos<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>lead_pipeline_movimentos<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>lead_pipeline_movimentos<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>lead_pipeline_movimentos<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>lead_pipeline_movimentos<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>lead_pipeline_movimentos<";
create policy tenant_definer on "public"."CRM-multi-empresas>lead_pipeline_movimentos<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>lead_prestador_permissoes<  (estava sem RLS)
alter table "public"."CRM-multi-empresas>lead_prestador_permissoes<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>lead_prestador_permissoes<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>lead_prestador_permissoes<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>lead_prestador_permissoes<" add constraint tnt_26cb5e814a_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_26cb5e814a_idx on "public"."CRM-multi-empresas>lead_prestador_permissoes<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>lead_prestador_permissoes<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>lead_prestador_permissoes<" for each row execute function public.app_tenant_fill();
alter table "public"."CRM-multi-empresas>lead_prestador_permissoes<" enable row level security;
drop policy if exists tenant_acesso on "public"."CRM-multi-empresas>lead_prestador_permissoes<";
create policy tenant_acesso on "public"."CRM-multi-empresas>lead_prestador_permissoes<" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>lead_prestador_permissoes<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>lead_prestador_permissoes<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>lead_prestador_permissoes<";
create policy tenant_definer on "public"."CRM-multi-empresas>lead_prestador_permissoes<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>lead_projeto_chat_leituras<
alter table "public"."CRM-multi-empresas>lead_projeto_chat_leituras<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>lead_projeto_chat_leituras<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>lead_projeto_chat_leituras<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>lead_projeto_chat_leituras<" add constraint tnt_5456cd99ad_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_5456cd99ad_idx on "public"."CRM-multi-empresas>lead_projeto_chat_leituras<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>lead_projeto_chat_leituras<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>lead_projeto_chat_leituras<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>lead_projeto_chat_leituras<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>lead_projeto_chat_leituras<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>lead_projeto_chat_leituras<";
create policy tenant_definer on "public"."CRM-multi-empresas>lead_projeto_chat_leituras<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>lead_projeto_notas<
alter table "public"."CRM-multi-empresas>lead_projeto_notas<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>lead_projeto_notas<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>lead_projeto_notas<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>lead_projeto_notas<" add constraint tnt_87776dbf2f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_87776dbf2f_idx on "public"."CRM-multi-empresas>lead_projeto_notas<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>lead_projeto_notas<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>lead_projeto_notas<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>lead_projeto_notas<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>lead_projeto_notas<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>lead_projeto_notas<";
create policy tenant_definer on "public"."CRM-multi-empresas>lead_projeto_notas<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>lead_projetos<
alter table "public"."CRM-multi-empresas>lead_projetos<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>lead_projetos<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>lead_projetos<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>lead_projetos<" add constraint tnt_b6e6adad8d_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_b6e6adad8d_idx on "public"."CRM-multi-empresas>lead_projetos<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>lead_projetos<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>lead_projetos<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>lead_projetos<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>lead_projetos<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>lead_projetos<";
create policy tenant_definer on "public"."CRM-multi-empresas>lead_projetos<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>lead_sinalizacoes<
alter table "public"."CRM-multi-empresas>lead_sinalizacoes<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>lead_sinalizacoes<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>lead_sinalizacoes<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>lead_sinalizacoes<" add constraint tnt_3b7043b629_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_3b7043b629_idx on "public"."CRM-multi-empresas>lead_sinalizacoes<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>lead_sinalizacoes<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>lead_sinalizacoes<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>lead_sinalizacoes<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>lead_sinalizacoes<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>lead_sinalizacoes<";
create policy tenant_definer on "public"."CRM-multi-empresas>lead_sinalizacoes<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>lead_whiteboard_text_config<
alter table "public"."CRM-multi-empresas>lead_whiteboard_text_config<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>lead_whiteboard_text_config<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>lead_whiteboard_text_config<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>lead_whiteboard_text_config<" add constraint tnt_851b5e8893_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_851b5e8893_idx on "public"."CRM-multi-empresas>lead_whiteboard_text_config<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>lead_whiteboard_text_config<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>lead_whiteboard_text_config<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>lead_whiteboard_text_config<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>lead_whiteboard_text_config<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>lead_whiteboard_text_config<";
create policy tenant_definer on "public"."CRM-multi-empresas>lead_whiteboard_text_config<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>leads<
alter table "public"."CRM-multi-empresas>leads<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>leads<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>leads<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>leads<" add constraint tnt_030701276a_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_030701276a_idx on "public"."CRM-multi-empresas>leads<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>leads<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>leads<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>leads<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>leads<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>leads<";
create policy tenant_definer on "public"."CRM-multi-empresas>leads<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>markup_categorias<  (estava sem RLS)
alter table "public"."CRM-multi-empresas>markup_categorias<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>markup_categorias<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>markup_categorias<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>markup_categorias<" add constraint tnt_d210bd5c58_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_d210bd5c58_idx on "public"."CRM-multi-empresas>markup_categorias<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>markup_categorias<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>markup_categorias<" for each row execute function public.app_tenant_fill();
alter table "public"."CRM-multi-empresas>markup_categorias<" enable row level security;
drop policy if exists tenant_acesso on "public"."CRM-multi-empresas>markup_categorias<";
create policy tenant_acesso on "public"."CRM-multi-empresas>markup_categorias<" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>markup_categorias<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>markup_categorias<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>markup_categorias<";
create policy tenant_definer on "public"."CRM-multi-empresas>markup_categorias<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>markup_config<  (estava sem RLS)
alter table "public"."CRM-multi-empresas>markup_config<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>markup_config<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>markup_config<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>markup_config<" add constraint tnt_30dae91a8f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_30dae91a8f_idx on "public"."CRM-multi-empresas>markup_config<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>markup_config<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>markup_config<" for each row execute function public.app_tenant_fill();
alter table "public"."CRM-multi-empresas>markup_config<" enable row level security;
drop policy if exists tenant_acesso on "public"."CRM-multi-empresas>markup_config<";
create policy tenant_acesso on "public"."CRM-multi-empresas>markup_config<" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>markup_config<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>markup_config<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>markup_config<";
create policy tenant_definer on "public"."CRM-multi-empresas>markup_config<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>markup_despesa_templates<  (estava sem RLS)
alter table "public"."CRM-multi-empresas>markup_despesa_templates<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>markup_despesa_templates<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>markup_despesa_templates<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>markup_despesa_templates<" add constraint tnt_b6b94f1312_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_b6b94f1312_idx on "public"."CRM-multi-empresas>markup_despesa_templates<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>markup_despesa_templates<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>markup_despesa_templates<" for each row execute function public.app_tenant_fill();
alter table "public"."CRM-multi-empresas>markup_despesa_templates<" enable row level security;
drop policy if exists tenant_acesso on "public"."CRM-multi-empresas>markup_despesa_templates<";
create policy tenant_acesso on "public"."CRM-multi-empresas>markup_despesa_templates<" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>markup_despesa_templates<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>markup_despesa_templates<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>markup_despesa_templates<";
create policy tenant_definer on "public"."CRM-multi-empresas>markup_despesa_templates<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>markup_orcamento_linhas<  (estava sem RLS)
alter table "public"."CRM-multi-empresas>markup_orcamento_linhas<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>markup_orcamento_linhas<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>markup_orcamento_linhas<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>markup_orcamento_linhas<" add constraint tnt_23d1f3fec9_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_23d1f3fec9_idx on "public"."CRM-multi-empresas>markup_orcamento_linhas<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>markup_orcamento_linhas<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>markup_orcamento_linhas<" for each row execute function public.app_tenant_fill();
alter table "public"."CRM-multi-empresas>markup_orcamento_linhas<" enable row level security;
drop policy if exists tenant_acesso on "public"."CRM-multi-empresas>markup_orcamento_linhas<";
create policy tenant_acesso on "public"."CRM-multi-empresas>markup_orcamento_linhas<" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>markup_orcamento_linhas<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>markup_orcamento_linhas<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>markup_orcamento_linhas<";
create policy tenant_definer on "public"."CRM-multi-empresas>markup_orcamento_linhas<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>markup_orcamentos<  (estava sem RLS)
alter table "public"."CRM-multi-empresas>markup_orcamentos<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>markup_orcamentos<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>markup_orcamentos<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>markup_orcamentos<" add constraint tnt_e3412dbc2b_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_e3412dbc2b_idx on "public"."CRM-multi-empresas>markup_orcamentos<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>markup_orcamentos<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>markup_orcamentos<" for each row execute function public.app_tenant_fill();
alter table "public"."CRM-multi-empresas>markup_orcamentos<" enable row level security;
drop policy if exists tenant_acesso on "public"."CRM-multi-empresas>markup_orcamentos<";
create policy tenant_acesso on "public"."CRM-multi-empresas>markup_orcamentos<" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>markup_orcamentos<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>markup_orcamentos<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>markup_orcamentos<";
create policy tenant_definer on "public"."CRM-multi-empresas>markup_orcamentos<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>markup_produtos<  (estava sem RLS)
alter table "public"."CRM-multi-empresas>markup_produtos<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>markup_produtos<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>markup_produtos<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>markup_produtos<" add constraint tnt_c355f9f624_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_c355f9f624_idx on "public"."CRM-multi-empresas>markup_produtos<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>markup_produtos<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>markup_produtos<" for each row execute function public.app_tenant_fill();
alter table "public"."CRM-multi-empresas>markup_produtos<" enable row level security;
drop policy if exists tenant_acesso on "public"."CRM-multi-empresas>markup_produtos<";
create policy tenant_acesso on "public"."CRM-multi-empresas>markup_produtos<" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>markup_produtos<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>markup_produtos<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>markup_produtos<";
create policy tenant_definer on "public"."CRM-multi-empresas>markup_produtos<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>markup_servico_templates<  (estava sem RLS)
alter table "public"."CRM-multi-empresas>markup_servico_templates<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>markup_servico_templates<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>markup_servico_templates<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>markup_servico_templates<" add constraint tnt_5b008a915a_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_5b008a915a_idx on "public"."CRM-multi-empresas>markup_servico_templates<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>markup_servico_templates<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>markup_servico_templates<" for each row execute function public.app_tenant_fill();
alter table "public"."CRM-multi-empresas>markup_servico_templates<" enable row level security;
drop policy if exists tenant_acesso on "public"."CRM-multi-empresas>markup_servico_templates<";
create policy tenant_acesso on "public"."CRM-multi-empresas>markup_servico_templates<" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>markup_servico_templates<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>markup_servico_templates<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>markup_servico_templates<";
create policy tenant_definer on "public"."CRM-multi-empresas>markup_servico_templates<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>negativacao_numeros<
alter table "public"."CRM-multi-empresas>negativacao_numeros<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>negativacao_numeros<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>negativacao_numeros<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>negativacao_numeros<" add constraint tnt_3c32b1f77d_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_3c32b1f77d_idx on "public"."CRM-multi-empresas>negativacao_numeros<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>negativacao_numeros<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>negativacao_numeros<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>negativacao_numeros<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>negativacao_numeros<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>negativacao_numeros<";
create policy tenant_definer on "public"."CRM-multi-empresas>negativacao_numeros<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>notifications<
alter table "public"."CRM-multi-empresas>notifications<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>notifications<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>notifications<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>notifications<" add constraint tnt_6ad9968d08_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_6ad9968d08_idx on "public"."CRM-multi-empresas>notifications<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>notifications<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>notifications<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>notifications<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>notifications<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>notifications<";
create policy tenant_definer on "public"."CRM-multi-empresas>notifications<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>orcamento_slide_blocos<
alter table "public"."CRM-multi-empresas>orcamento_slide_blocos<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>orcamento_slide_blocos<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>orcamento_slide_blocos<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>orcamento_slide_blocos<" add constraint tnt_190828bafe_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_190828bafe_idx on "public"."CRM-multi-empresas>orcamento_slide_blocos<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>orcamento_slide_blocos<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>orcamento_slide_blocos<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>orcamento_slide_blocos<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>orcamento_slide_blocos<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>orcamento_slide_blocos<";
create policy tenant_definer on "public"."CRM-multi-empresas>orcamento_slide_blocos<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>orcamento_slide_catalogo<  (estava sem RLS)
alter table "public"."CRM-multi-empresas>orcamento_slide_catalogo<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>orcamento_slide_catalogo<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>orcamento_slide_catalogo<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>orcamento_slide_catalogo<" add constraint tnt_1f0d36d390_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_1f0d36d390_idx on "public"."CRM-multi-empresas>orcamento_slide_catalogo<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>orcamento_slide_catalogo<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>orcamento_slide_catalogo<" for each row execute function public.app_tenant_fill();
alter table "public"."CRM-multi-empresas>orcamento_slide_catalogo<" enable row level security;
drop policy if exists tenant_acesso on "public"."CRM-multi-empresas>orcamento_slide_catalogo<";
create policy tenant_acesso on "public"."CRM-multi-empresas>orcamento_slide_catalogo<" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>orcamento_slide_catalogo<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>orcamento_slide_catalogo<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>orcamento_slide_catalogo<";
create policy tenant_definer on "public"."CRM-multi-empresas>orcamento_slide_catalogo<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>orcamento_slide_formas_pagamento<  (estava sem RLS)
alter table "public"."CRM-multi-empresas>orcamento_slide_formas_pagamento<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>orcamento_slide_formas_pagamento<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>orcamento_slide_formas_pagamento<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>orcamento_slide_formas_pagamento<" add constraint tnt_f9f074e639_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_f9f074e639_idx on "public"."CRM-multi-empresas>orcamento_slide_formas_pagamento<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>orcamento_slide_formas_pagamento<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>orcamento_slide_formas_pagamento<" for each row execute function public.app_tenant_fill();
alter table "public"."CRM-multi-empresas>orcamento_slide_formas_pagamento<" enable row level security;
drop policy if exists tenant_acesso on "public"."CRM-multi-empresas>orcamento_slide_formas_pagamento<";
create policy tenant_acesso on "public"."CRM-multi-empresas>orcamento_slide_formas_pagamento<" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>orcamento_slide_formas_pagamento<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>orcamento_slide_formas_pagamento<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>orcamento_slide_formas_pagamento<";
create policy tenant_definer on "public"."CRM-multi-empresas>orcamento_slide_formas_pagamento<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>orcamento_slide_midias<
alter table "public"."CRM-multi-empresas>orcamento_slide_midias<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>orcamento_slide_midias<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>orcamento_slide_midias<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>orcamento_slide_midias<" add constraint tnt_f0f126d05c_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_f0f126d05c_idx on "public"."CRM-multi-empresas>orcamento_slide_midias<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>orcamento_slide_midias<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>orcamento_slide_midias<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>orcamento_slide_midias<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>orcamento_slide_midias<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>orcamento_slide_midias<";
create policy tenant_definer on "public"."CRM-multi-empresas>orcamento_slide_midias<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>orcamento_slide_pergunta_opcoes<  (estava sem RLS)
alter table "public"."CRM-multi-empresas>orcamento_slide_pergunta_opcoes<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>orcamento_slide_pergunta_opcoes<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>orcamento_slide_pergunta_opcoes<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>orcamento_slide_pergunta_opcoes<" add constraint tnt_18fea38efa_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_18fea38efa_idx on "public"."CRM-multi-empresas>orcamento_slide_pergunta_opcoes<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>orcamento_slide_pergunta_opcoes<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>orcamento_slide_pergunta_opcoes<" for each row execute function public.app_tenant_fill();
alter table "public"."CRM-multi-empresas>orcamento_slide_pergunta_opcoes<" enable row level security;
drop policy if exists tenant_acesso on "public"."CRM-multi-empresas>orcamento_slide_pergunta_opcoes<";
create policy tenant_acesso on "public"."CRM-multi-empresas>orcamento_slide_pergunta_opcoes<" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>orcamento_slide_pergunta_opcoes<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>orcamento_slide_pergunta_opcoes<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>orcamento_slide_pergunta_opcoes<";
create policy tenant_definer on "public"."CRM-multi-empresas>orcamento_slide_pergunta_opcoes<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>orcamento_slide_perguntas<  (estava sem RLS)
alter table "public"."CRM-multi-empresas>orcamento_slide_perguntas<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>orcamento_slide_perguntas<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>orcamento_slide_perguntas<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>orcamento_slide_perguntas<" add constraint tnt_b9aa257ad8_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_b9aa257ad8_idx on "public"."CRM-multi-empresas>orcamento_slide_perguntas<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>orcamento_slide_perguntas<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>orcamento_slide_perguntas<" for each row execute function public.app_tenant_fill();
alter table "public"."CRM-multi-empresas>orcamento_slide_perguntas<" enable row level security;
drop policy if exists tenant_acesso on "public"."CRM-multi-empresas>orcamento_slide_perguntas<";
create policy tenant_acesso on "public"."CRM-multi-empresas>orcamento_slide_perguntas<" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>orcamento_slide_perguntas<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>orcamento_slide_perguntas<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>orcamento_slide_perguntas<";
create policy tenant_definer on "public"."CRM-multi-empresas>orcamento_slide_perguntas<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>orcamento_slide_scripts<  (estava sem RLS)
alter table "public"."CRM-multi-empresas>orcamento_slide_scripts<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>orcamento_slide_scripts<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>orcamento_slide_scripts<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>orcamento_slide_scripts<" add constraint tnt_c3962b0e48_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_c3962b0e48_idx on "public"."CRM-multi-empresas>orcamento_slide_scripts<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>orcamento_slide_scripts<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>orcamento_slide_scripts<" for each row execute function public.app_tenant_fill();
alter table "public"."CRM-multi-empresas>orcamento_slide_scripts<" enable row level security;
drop policy if exists tenant_acesso on "public"."CRM-multi-empresas>orcamento_slide_scripts<";
create policy tenant_acesso on "public"."CRM-multi-empresas>orcamento_slide_scripts<" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>orcamento_slide_scripts<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>orcamento_slide_scripts<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>orcamento_slide_scripts<";
create policy tenant_definer on "public"."CRM-multi-empresas>orcamento_slide_scripts<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>orcamento_slide_templates<
alter table "public"."CRM-multi-empresas>orcamento_slide_templates<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>orcamento_slide_templates<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>orcamento_slide_templates<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>orcamento_slide_templates<" add constraint tnt_1e8aa2a370_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_1e8aa2a370_idx on "public"."CRM-multi-empresas>orcamento_slide_templates<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>orcamento_slide_templates<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>orcamento_slide_templates<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>orcamento_slide_templates<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>orcamento_slide_templates<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>orcamento_slide_templates<";
create policy tenant_definer on "public"."CRM-multi-empresas>orcamento_slide_templates<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>orcamento_slides<
alter table "public"."CRM-multi-empresas>orcamento_slides<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>orcamento_slides<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>orcamento_slides<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>orcamento_slides<" add constraint tnt_80b39c71ca_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_80b39c71ca_idx on "public"."CRM-multi-empresas>orcamento_slides<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>orcamento_slides<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>orcamento_slides<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>orcamento_slides<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>orcamento_slides<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>orcamento_slides<";
create policy tenant_definer on "public"."CRM-multi-empresas>orcamento_slides<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>pipeline_custom_stages<
alter table "public"."CRM-multi-empresas>pipeline_custom_stages<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>pipeline_custom_stages<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>pipeline_custom_stages<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>pipeline_custom_stages<" add constraint tnt_964272b0b6_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_964272b0b6_idx on "public"."CRM-multi-empresas>pipeline_custom_stages<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>pipeline_custom_stages<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>pipeline_custom_stages<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>pipeline_custom_stages<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>pipeline_custom_stages<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>pipeline_custom_stages<";
create policy tenant_definer on "public"."CRM-multi-empresas>pipeline_custom_stages<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>pipeline_daily_metrics<
alter table "public"."CRM-multi-empresas>pipeline_daily_metrics<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>pipeline_daily_metrics<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>pipeline_daily_metrics<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>pipeline_daily_metrics<" add constraint tnt_9db888b7fa_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_9db888b7fa_idx on "public"."CRM-multi-empresas>pipeline_daily_metrics<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>pipeline_daily_metrics<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>pipeline_daily_metrics<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>pipeline_daily_metrics<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>pipeline_daily_metrics<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>pipeline_daily_metrics<";
create policy tenant_definer on "public"."CRM-multi-empresas>pipeline_daily_metrics<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>pipeline_lead_ai_config<
alter table "public"."CRM-multi-empresas>pipeline_lead_ai_config<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>pipeline_lead_ai_config<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>pipeline_lead_ai_config<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>pipeline_lead_ai_config<" add constraint tnt_cf7d2a6783_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_cf7d2a6783_idx on "public"."CRM-multi-empresas>pipeline_lead_ai_config<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>pipeline_lead_ai_config<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>pipeline_lead_ai_config<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>pipeline_lead_ai_config<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>pipeline_lead_ai_config<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>pipeline_lead_ai_config<";
create policy tenant_definer on "public"."CRM-multi-empresas>pipeline_lead_ai_config<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>pipeline_metricas_coluna_config<
alter table "public"."CRM-multi-empresas>pipeline_metricas_coluna_config<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>pipeline_metricas_coluna_config<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>pipeline_metricas_coluna_config<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>pipeline_metricas_coluna_config<" add constraint tnt_19684d22d4_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_19684d22d4_idx on "public"."CRM-multi-empresas>pipeline_metricas_coluna_config<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>pipeline_metricas_coluna_config<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>pipeline_metricas_coluna_config<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>pipeline_metricas_coluna_config<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>pipeline_metricas_coluna_config<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>pipeline_metricas_coluna_config<";
create policy tenant_definer on "public"."CRM-multi-empresas>pipeline_metricas_coluna_config<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>pipeline_novo_lead_tarefa_config<
alter table "public"."CRM-multi-empresas>pipeline_novo_lead_tarefa_config<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>pipeline_novo_lead_tarefa_config<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>pipeline_novo_lead_tarefa_config<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>pipeline_novo_lead_tarefa_config<" add constraint tnt_c73a54dc72_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_c73a54dc72_idx on "public"."CRM-multi-empresas>pipeline_novo_lead_tarefa_config<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>pipeline_novo_lead_tarefa_config<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>pipeline_novo_lead_tarefa_config<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>pipeline_novo_lead_tarefa_config<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>pipeline_novo_lead_tarefa_config<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>pipeline_novo_lead_tarefa_config<";
create policy tenant_definer on "public"."CRM-multi-empresas>pipeline_novo_lead_tarefa_config<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>pipeline_orcamento_metricas<
alter table "public"."CRM-multi-empresas>pipeline_orcamento_metricas<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>pipeline_orcamento_metricas<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>pipeline_orcamento_metricas<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>pipeline_orcamento_metricas<" add constraint tnt_5ecf569faa_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_5ecf569faa_idx on "public"."CRM-multi-empresas>pipeline_orcamento_metricas<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>pipeline_orcamento_metricas<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>pipeline_orcamento_metricas<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>pipeline_orcamento_metricas<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>pipeline_orcamento_metricas<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>pipeline_orcamento_metricas<";
create policy tenant_definer on "public"."CRM-multi-empresas>pipeline_orcamento_metricas<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>pipeline_time_config<
alter table "public"."CRM-multi-empresas>pipeline_time_config<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>pipeline_time_config<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>pipeline_time_config<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>pipeline_time_config<" add constraint tnt_9d51dc7717_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_9d51dc7717_idx on "public"."CRM-multi-empresas>pipeline_time_config<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>pipeline_time_config<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>pipeline_time_config<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>pipeline_time_config<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>pipeline_time_config<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>pipeline_time_config<";
create policy tenant_definer on "public"."CRM-multi-empresas>pipeline_time_config<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>pipeline_vendas_ganhos_config<
alter table "public"."CRM-multi-empresas>pipeline_vendas_ganhos_config<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>pipeline_vendas_ganhos_config<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>pipeline_vendas_ganhos_config<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>pipeline_vendas_ganhos_config<" add constraint tnt_798eb4170b_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_798eb4170b_idx on "public"."CRM-multi-empresas>pipeline_vendas_ganhos_config<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>pipeline_vendas_ganhos_config<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>pipeline_vendas_ganhos_config<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>pipeline_vendas_ganhos_config<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>pipeline_vendas_ganhos_config<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>pipeline_vendas_ganhos_config<";
create policy tenant_definer on "public"."CRM-multi-empresas>pipeline_vendas_ganhos_config<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>pipeline_vendas_metricas<
alter table "public"."CRM-multi-empresas>pipeline_vendas_metricas<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>pipeline_vendas_metricas<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>pipeline_vendas_metricas<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>pipeline_vendas_metricas<" add constraint tnt_69c8617ae3_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_69c8617ae3_idx on "public"."CRM-multi-empresas>pipeline_vendas_metricas<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>pipeline_vendas_metricas<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>pipeline_vendas_metricas<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>pipeline_vendas_metricas<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>pipeline_vendas_metricas<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>pipeline_vendas_metricas<";
create policy tenant_definer on "public"."CRM-multi-empresas>pipeline_vendas_metricas<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>ponto_registros<
alter table "public"."CRM-multi-empresas>ponto_registros<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>ponto_registros<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>ponto_registros<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>ponto_registros<" add constraint tnt_329c2e09c9_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_329c2e09c9_idx on "public"."CRM-multi-empresas>ponto_registros<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>ponto_registros<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>ponto_registros<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>ponto_registros<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>ponto_registros<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>ponto_registros<";
create policy tenant_definer on "public"."CRM-multi-empresas>ponto_registros<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>pontua_garbo_comissao_liberacoes<  (estava sem RLS)
alter table "public"."CRM-multi-empresas>pontua_garbo_comissao_liberacoes<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>pontua_garbo_comissao_liberacoes<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>pontua_garbo_comissao_liberacoes<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>pontua_garbo_comissao_liberacoes<" add constraint tnt_d6eaf68c63_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_d6eaf68c63_idx on "public"."CRM-multi-empresas>pontua_garbo_comissao_liberacoes<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>pontua_garbo_comissao_liberacoes<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>pontua_garbo_comissao_liberacoes<" for each row execute function public.app_tenant_fill();
alter table "public"."CRM-multi-empresas>pontua_garbo_comissao_liberacoes<" enable row level security;
drop policy if exists tenant_acesso on "public"."CRM-multi-empresas>pontua_garbo_comissao_liberacoes<";
create policy tenant_acesso on "public"."CRM-multi-empresas>pontua_garbo_comissao_liberacoes<" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>pontua_garbo_comissao_liberacoes<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>pontua_garbo_comissao_liberacoes<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>pontua_garbo_comissao_liberacoes<";
create policy tenant_definer on "public"."CRM-multi-empresas>pontua_garbo_comissao_liberacoes<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>pontua_garbo_lancamentos<  (estava sem RLS)
alter table "public"."CRM-multi-empresas>pontua_garbo_lancamentos<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>pontua_garbo_lancamentos<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>pontua_garbo_lancamentos<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>pontua_garbo_lancamentos<" add constraint tnt_3a2fdde1bb_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_3a2fdde1bb_idx on "public"."CRM-multi-empresas>pontua_garbo_lancamentos<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>pontua_garbo_lancamentos<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>pontua_garbo_lancamentos<" for each row execute function public.app_tenant_fill();
alter table "public"."CRM-multi-empresas>pontua_garbo_lancamentos<" enable row level security;
drop policy if exists tenant_acesso on "public"."CRM-multi-empresas>pontua_garbo_lancamentos<";
create policy tenant_acesso on "public"."CRM-multi-empresas>pontua_garbo_lancamentos<" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>pontua_garbo_lancamentos<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>pontua_garbo_lancamentos<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>pontua_garbo_lancamentos<";
create policy tenant_definer on "public"."CRM-multi-empresas>pontua_garbo_lancamentos<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>presence_sessions<
alter table "public"."CRM-multi-empresas>presence_sessions<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>presence_sessions<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>presence_sessions<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>presence_sessions<" add constraint tnt_48d42c7676_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_48d42c7676_idx on "public"."CRM-multi-empresas>presence_sessions<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>presence_sessions<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>presence_sessions<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>presence_sessions<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>presence_sessions<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>presence_sessions<";
create policy tenant_definer on "public"."CRM-multi-empresas>presence_sessions<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>prestador_saque_pedidos<  (estava sem RLS)
alter table "public"."CRM-multi-empresas>prestador_saque_pedidos<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>prestador_saque_pedidos<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>prestador_saque_pedidos<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>prestador_saque_pedidos<" add constraint tnt_400148e879_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_400148e879_idx on "public"."CRM-multi-empresas>prestador_saque_pedidos<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>prestador_saque_pedidos<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>prestador_saque_pedidos<" for each row execute function public.app_tenant_fill();
alter table "public"."CRM-multi-empresas>prestador_saque_pedidos<" enable row level security;
drop policy if exists tenant_acesso on "public"."CRM-multi-empresas>prestador_saque_pedidos<";
create policy tenant_acesso on "public"."CRM-multi-empresas>prestador_saque_pedidos<" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>prestador_saque_pedidos<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>prestador_saque_pedidos<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>prestador_saque_pedidos<";
create policy tenant_definer on "public"."CRM-multi-empresas>prestador_saque_pedidos<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>prestador_titulos<
alter table "public"."CRM-multi-empresas>prestador_titulos<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>prestador_titulos<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>prestador_titulos<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>prestador_titulos<" add constraint tnt_487c497e87_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_487c497e87_idx on "public"."CRM-multi-empresas>prestador_titulos<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>prestador_titulos<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>prestador_titulos<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>prestador_titulos<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>prestador_titulos<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>prestador_titulos<";
create policy tenant_definer on "public"."CRM-multi-empresas>prestador_titulos<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>projeto_stages<
alter table "public"."CRM-multi-empresas>projeto_stages<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>projeto_stages<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>projeto_stages<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>projeto_stages<" add constraint tnt_f4cb37822a_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_f4cb37822a_idx on "public"."CRM-multi-empresas>projeto_stages<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>projeto_stages<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>projeto_stages<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>projeto_stages<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>projeto_stages<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>projeto_stages<";
create policy tenant_definer on "public"."CRM-multi-empresas>projeto_stages<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>relatorios_reunioes<
alter table "public"."CRM-multi-empresas>relatorios_reunioes<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>relatorios_reunioes<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>relatorios_reunioes<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>relatorios_reunioes<" add constraint tnt_cdc754137b_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_cdc754137b_idx on "public"."CRM-multi-empresas>relatorios_reunioes<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>relatorios_reunioes<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>relatorios_reunioes<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>relatorios_reunioes<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>relatorios_reunioes<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>relatorios_reunioes<";
create policy tenant_definer on "public"."CRM-multi-empresas>relatorios_reunioes<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>tabela_origem_config<
alter table "public"."CRM-multi-empresas>tabela_origem_config<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>tabela_origem_config<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>tabela_origem_config<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>tabela_origem_config<" add constraint tnt_42c87cbb86_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_42c87cbb86_idx on "public"."CRM-multi-empresas>tabela_origem_config<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>tabela_origem_config<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>tabela_origem_config<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>tabela_origem_config<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>tabela_origem_config<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>tabela_origem_config<";
create policy tenant_definer on "public"."CRM-multi-empresas>tabela_origem_config<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>user_permissions<
alter table "public"."CRM-multi-empresas>user_permissions<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>user_permissions<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>user_permissions<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>user_permissions<" add constraint tnt_172217972f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_172217972f_idx on "public"."CRM-multi-empresas>user_permissions<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>user_permissions<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>user_permissions<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>user_permissions<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>user_permissions<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>user_permissions<";
create policy tenant_definer on "public"."CRM-multi-empresas>user_permissions<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>user_roles<
alter table "public"."CRM-multi-empresas>user_roles<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>user_roles<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>user_roles<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>user_roles<" add constraint tnt_8da2091b2b_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_8da2091b2b_idx on "public"."CRM-multi-empresas>user_roles<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>user_roles<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>user_roles<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>user_roles<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>user_roles<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>user_roles<";
create policy tenant_definer on "public"."CRM-multi-empresas>user_roles<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>uso_config<
alter table "public"."CRM-multi-empresas>uso_config<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>uso_config<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>uso_config<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>uso_config<" add constraint tnt_22478e4730_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_22478e4730_idx on "public"."CRM-multi-empresas>uso_config<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>uso_config<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>uso_config<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>uso_config<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>uso_config<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>uso_config<";
create policy tenant_definer on "public"."CRM-multi-empresas>uso_config<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>usuarios<
alter table "public"."CRM-multi-empresas>usuarios<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>usuarios<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>usuarios<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>usuarios<" add constraint tnt_60ef32cecd_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_60ef32cecd_idx on "public"."CRM-multi-empresas>usuarios<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>usuarios<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>usuarios<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>usuarios<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>usuarios<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>usuarios<";
create policy tenant_definer on "public"."CRM-multi-empresas>usuarios<" for all to app_tenant_definer using (true) with check (true);

-- public.CRM-multi-empresas>webhooks_api<
alter table "public"."CRM-multi-empresas>webhooks_api<" add column empresa_id uuid;
update "public"."CRM-multi-empresas>webhooks_api<" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."CRM-multi-empresas>webhooks_api<" alter column empresa_id set not null;
alter table "public"."CRM-multi-empresas>webhooks_api<" add constraint tnt_77a022f7a7_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_77a022f7a7_idx on "public"."CRM-multi-empresas>webhooks_api<" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."CRM-multi-empresas>webhooks_api<";
create trigger aaa_tenant_fill before insert on "public"."CRM-multi-empresas>webhooks_api<" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."CRM-multi-empresas>webhooks_api<";
create policy tenant_isolamento on "public"."CRM-multi-empresas>webhooks_api<" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."CRM-multi-empresas>webhooks_api<";
create policy tenant_definer on "public"."CRM-multi-empresas>webhooks_api<" for all to app_tenant_definer using (true) with check (true);

-- public.agenda_pessoal_admin_titular_filter
alter table "public"."agenda_pessoal_admin_titular_filter" add column empresa_id uuid;
update "public"."agenda_pessoal_admin_titular_filter" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."agenda_pessoal_admin_titular_filter" alter column empresa_id set not null;
alter table "public"."agenda_pessoal_admin_titular_filter" add constraint tnt_b930d62639_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_b930d62639_idx on "public"."agenda_pessoal_admin_titular_filter" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."agenda_pessoal_admin_titular_filter";
create trigger aaa_tenant_fill before insert on "public"."agenda_pessoal_admin_titular_filter" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."agenda_pessoal_admin_titular_filter";
create policy tenant_isolamento on "public"."agenda_pessoal_admin_titular_filter" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."agenda_pessoal_admin_titular_filter";
create policy tenant_definer on "public"."agenda_pessoal_admin_titular_filter" for all to app_tenant_definer using (true) with check (true);

-- public.agenda_pessoal_tarefas
alter table "public"."agenda_pessoal_tarefas" add column empresa_id uuid;
update "public"."agenda_pessoal_tarefas" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."agenda_pessoal_tarefas" alter column empresa_id set not null;
alter table "public"."agenda_pessoal_tarefas" add constraint tnt_897b9eb79d_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_897b9eb79d_idx on "public"."agenda_pessoal_tarefas" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."agenda_pessoal_tarefas";
create trigger aaa_tenant_fill before insert on "public"."agenda_pessoal_tarefas" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."agenda_pessoal_tarefas";
create policy tenant_isolamento on "public"."agenda_pessoal_tarefas" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."agenda_pessoal_tarefas";
create policy tenant_definer on "public"."agenda_pessoal_tarefas" for all to app_tenant_definer using (true) with check (true);

-- public.agenda_tarefa_anexos
alter table "public"."agenda_tarefa_anexos" add column empresa_id uuid;
update "public"."agenda_tarefa_anexos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."agenda_tarefa_anexos" alter column empresa_id set not null;
alter table "public"."agenda_tarefa_anexos" add constraint tnt_a994c5d90f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_a994c5d90f_idx on "public"."agenda_tarefa_anexos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."agenda_tarefa_anexos";
create trigger aaa_tenant_fill before insert on "public"."agenda_tarefa_anexos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."agenda_tarefa_anexos";
create policy tenant_isolamento on "public"."agenda_tarefa_anexos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."agenda_tarefa_anexos";
create policy tenant_definer on "public"."agenda_tarefa_anexos" for all to app_tenant_definer using (true) with check (true);

-- public.agenda_tarefa_whiteboard_drawings
alter table "public"."agenda_tarefa_whiteboard_drawings" add column empresa_id uuid;
update "public"."agenda_tarefa_whiteboard_drawings" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."agenda_tarefa_whiteboard_drawings" alter column empresa_id set not null;
alter table "public"."agenda_tarefa_whiteboard_drawings" add constraint tnt_7deb5914e6_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_7deb5914e6_idx on "public"."agenda_tarefa_whiteboard_drawings" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."agenda_tarefa_whiteboard_drawings";
create trigger aaa_tenant_fill before insert on "public"."agenda_tarefa_whiteboard_drawings" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."agenda_tarefa_whiteboard_drawings";
create policy tenant_isolamento on "public"."agenda_tarefa_whiteboard_drawings" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."agenda_tarefa_whiteboard_drawings";
create policy tenant_definer on "public"."agenda_tarefa_whiteboard_drawings" for all to app_tenant_definer using (true) with check (true);

-- public.agenda_tarefa_whiteboard_images
alter table "public"."agenda_tarefa_whiteboard_images" add column empresa_id uuid;
update "public"."agenda_tarefa_whiteboard_images" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."agenda_tarefa_whiteboard_images" alter column empresa_id set not null;
alter table "public"."agenda_tarefa_whiteboard_images" add constraint tnt_6f20a378d8_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_6f20a378d8_idx on "public"."agenda_tarefa_whiteboard_images" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."agenda_tarefa_whiteboard_images";
create trigger aaa_tenant_fill before insert on "public"."agenda_tarefa_whiteboard_images" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."agenda_tarefa_whiteboard_images";
create policy tenant_isolamento on "public"."agenda_tarefa_whiteboard_images" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."agenda_tarefa_whiteboard_images";
create policy tenant_definer on "public"."agenda_tarefa_whiteboard_images" for all to app_tenant_definer using (true) with check (true);

-- public.ai_memories
update "public"."ai_memories" set company_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where company_id is null;
alter table "public"."ai_memories" alter column company_id set not null;
alter table "public"."ai_memories" add constraint tnt_706f56604e_fk foreign key (company_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_706f56604e_idx on "public"."ai_memories" (company_id);
drop trigger if exists aaa_tenant_fill on "public"."ai_memories";
create trigger aaa_tenant_fill before insert on "public"."ai_memories" for each row execute function public.app_tenant_fill_company();
drop policy if exists tenant_isolamento on "public"."ai_memories";
create policy tenant_isolamento on "public"."ai_memories" as restrictive for all to public using (company_id = (select public.app_empresa_atual())) with check (company_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."ai_memories";
create policy tenant_definer on "public"."ai_memories" for all to app_tenant_definer using (true) with check (true);

-- public.ai_prompt_overrides
update "public"."ai_prompt_overrides" set company_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where company_id is null;
alter table "public"."ai_prompt_overrides" alter column company_id set not null;
alter table "public"."ai_prompt_overrides" add constraint tnt_53440ecb50_fk foreign key (company_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_53440ecb50_idx on "public"."ai_prompt_overrides" (company_id);
drop trigger if exists aaa_tenant_fill on "public"."ai_prompt_overrides";
create trigger aaa_tenant_fill before insert on "public"."ai_prompt_overrides" for each row execute function public.app_tenant_fill_company();
drop policy if exists tenant_isolamento on "public"."ai_prompt_overrides";
create policy tenant_isolamento on "public"."ai_prompt_overrides" as restrictive for all to public using (company_id = (select public.app_empresa_atual())) with check (company_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."ai_prompt_overrides";
create policy tenant_definer on "public"."ai_prompt_overrides" for all to app_tenant_definer using (true) with check (true);

-- public.atalhos
alter table "public"."atalhos" add column empresa_id uuid;
update "public"."atalhos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."atalhos" alter column empresa_id set not null;
alter table "public"."atalhos" add constraint tnt_ed4c6d747b_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_ed4c6d747b_idx on "public"."atalhos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."atalhos";
create trigger aaa_tenant_fill before insert on "public"."atalhos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."atalhos";
create policy tenant_isolamento on "public"."atalhos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."atalhos";
create policy tenant_definer on "public"."atalhos" for all to app_tenant_definer using (true) with check (true);

-- public.bom_items
alter table "public"."bom_items" add column empresa_id uuid;
update "public"."bom_items" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."bom_items" alter column empresa_id set not null;
alter table "public"."bom_items" add constraint tnt_060d1f6c33_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_060d1f6c33_idx on "public"."bom_items" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."bom_items";
create trigger aaa_tenant_fill before insert on "public"."bom_items" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."bom_items";
create policy tenant_isolamento on "public"."bom_items" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."bom_items";
create policy tenant_definer on "public"."bom_items" for all to app_tenant_definer using (true) with check (true);

-- public.company_standards
update "public"."company_standards" set company_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where company_id is null;
alter table "public"."company_standards" alter column company_id set not null;
alter table "public"."company_standards" add constraint tnt_382a63824c_fk foreign key (company_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_382a63824c_idx on "public"."company_standards" (company_id);
drop trigger if exists aaa_tenant_fill on "public"."company_standards";
create trigger aaa_tenant_fill before insert on "public"."company_standards" for each row execute function public.app_tenant_fill_company();
drop policy if exists tenant_isolamento on "public"."company_standards";
create policy tenant_isolamento on "public"."company_standards" as restrictive for all to public using (company_id = (select public.app_empresa_atual())) with check (company_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."company_standards";
create policy tenant_definer on "public"."company_standards" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_agenda_geral_admin_titular_filter
alter table "public"."crm_multiempresas_agenda_geral_admin_titular_filter" add column empresa_id uuid;
update "public"."crm_multiempresas_agenda_geral_admin_titular_filter" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_agenda_geral_admin_titular_filter" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_agenda_geral_admin_titular_filter" add constraint tnt_cbed62c4de_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_cbed62c4de_idx on "public"."crm_multiempresas_agenda_geral_admin_titular_filter" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_agenda_geral_admin_titular_filter";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_agenda_geral_admin_titular_filter" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_agenda_geral_admin_titular_filter";
create policy tenant_isolamento on "public"."crm_multiempresas_agenda_geral_admin_titular_filter" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_agenda_geral_admin_titular_filter";
create policy tenant_definer on "public"."crm_multiempresas_agenda_geral_admin_titular_filter" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_agenda_pessoal_admin_titular_filter
alter table "public"."crm_multiempresas_agenda_pessoal_admin_titular_filter" add column empresa_id uuid;
update "public"."crm_multiempresas_agenda_pessoal_admin_titular_filter" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_agenda_pessoal_admin_titular_filter" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_agenda_pessoal_admin_titular_filter" add constraint tnt_1eb3706e0a_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_1eb3706e0a_idx on "public"."crm_multiempresas_agenda_pessoal_admin_titular_filter" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_agenda_pessoal_admin_titular_filter";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_agenda_pessoal_admin_titular_filter" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_agenda_pessoal_admin_titular_filter";
create policy tenant_isolamento on "public"."crm_multiempresas_agenda_pessoal_admin_titular_filter" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_agenda_pessoal_admin_titular_filter";
create policy tenant_definer on "public"."crm_multiempresas_agenda_pessoal_admin_titular_filter" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_agenda_pessoal_tarefas
alter table "public"."crm_multiempresas_agenda_pessoal_tarefas" add column empresa_id uuid;
update "public"."crm_multiempresas_agenda_pessoal_tarefas" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_agenda_pessoal_tarefas" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_agenda_pessoal_tarefas" add constraint tnt_509228b766_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_509228b766_idx on "public"."crm_multiempresas_agenda_pessoal_tarefas" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_agenda_pessoal_tarefas";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_agenda_pessoal_tarefas" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_agenda_pessoal_tarefas";
create policy tenant_isolamento on "public"."crm_multiempresas_agenda_pessoal_tarefas" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_agenda_pessoal_tarefas";
create policy tenant_definer on "public"."crm_multiempresas_agenda_pessoal_tarefas" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_atalhos
alter table "public"."crm_multiempresas_atalhos" add column empresa_id uuid;
update "public"."crm_multiempresas_atalhos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_atalhos" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_atalhos" add constraint tnt_998f478d71_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_998f478d71_idx on "public"."crm_multiempresas_atalhos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_atalhos";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_atalhos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_atalhos";
create policy tenant_isolamento on "public"."crm_multiempresas_atalhos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_atalhos";
create policy tenant_definer on "public"."crm_multiempresas_atalhos" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_chat_contatos
alter table "public"."crm_multiempresas_chat_contatos" add column empresa_id uuid;
update "public"."crm_multiempresas_chat_contatos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_chat_contatos" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_chat_contatos" add constraint tnt_75d6608d90_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_75d6608d90_idx on "public"."crm_multiempresas_chat_contatos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_chat_contatos";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_chat_contatos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_chat_contatos";
create policy tenant_isolamento on "public"."crm_multiempresas_chat_contatos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_chat_contatos";
create policy tenant_definer on "public"."crm_multiempresas_chat_contatos" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_chat_logs
alter table "public"."crm_multiempresas_chat_logs" add column empresa_id uuid;
update "public"."crm_multiempresas_chat_logs" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_chat_logs" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_chat_logs" add constraint tnt_bcf5249f58_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_bcf5249f58_idx on "public"."crm_multiempresas_chat_logs" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_chat_logs";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_chat_logs" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_chat_logs";
create policy tenant_isolamento on "public"."crm_multiempresas_chat_logs" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_chat_logs";
create policy tenant_definer on "public"."crm_multiempresas_chat_logs" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_chat_mensagens
alter table "public"."crm_multiempresas_chat_mensagens" add column empresa_id uuid;
update "public"."crm_multiempresas_chat_mensagens" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_chat_mensagens" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_chat_mensagens" add constraint tnt_08431b499c_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_08431b499c_idx on "public"."crm_multiempresas_chat_mensagens" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_chat_mensagens";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_chat_mensagens" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_chat_mensagens";
create policy tenant_isolamento on "public"."crm_multiempresas_chat_mensagens" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_chat_mensagens";
create policy tenant_definer on "public"."crm_multiempresas_chat_mensagens" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_evento_cadernos
alter table "public"."crm_multiempresas_evento_cadernos" add column empresa_id uuid;
update "public"."crm_multiempresas_evento_cadernos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_evento_cadernos" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_evento_cadernos" add constraint tnt_9004d40730_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_9004d40730_idx on "public"."crm_multiempresas_evento_cadernos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_evento_cadernos";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_evento_cadernos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_evento_cadernos";
create policy tenant_isolamento on "public"."crm_multiempresas_evento_cadernos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_evento_cadernos";
create policy tenant_definer on "public"."crm_multiempresas_evento_cadernos" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_evento_catalogo_itens
alter table "public"."crm_multiempresas_evento_catalogo_itens" add column empresa_id uuid;
update "public"."crm_multiempresas_evento_catalogo_itens" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_evento_catalogo_itens" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_evento_catalogo_itens" add constraint tnt_f9fa60d419_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_f9fa60d419_idx on "public"."crm_multiempresas_evento_catalogo_itens" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_evento_catalogo_itens";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_evento_catalogo_itens" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_evento_catalogo_itens";
create policy tenant_isolamento on "public"."crm_multiempresas_evento_catalogo_itens" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_evento_catalogo_itens";
create policy tenant_definer on "public"."crm_multiempresas_evento_catalogo_itens" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_evento_item_midias
alter table "public"."crm_multiempresas_evento_item_midias" add column empresa_id uuid;
update "public"."crm_multiempresas_evento_item_midias" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_evento_item_midias" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_evento_item_midias" add constraint tnt_59c7e778e3_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_59c7e778e3_idx on "public"."crm_multiempresas_evento_item_midias" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_evento_item_midias";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_evento_item_midias" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_evento_item_midias";
create policy tenant_isolamento on "public"."crm_multiempresas_evento_item_midias" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_evento_item_midias";
create policy tenant_definer on "public"."crm_multiempresas_evento_item_midias" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_evento_itens
alter table "public"."crm_multiempresas_evento_itens" add column empresa_id uuid;
update "public"."crm_multiempresas_evento_itens" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_evento_itens" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_evento_itens" add constraint tnt_09652c5e9d_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_09652c5e9d_idx on "public"."crm_multiempresas_evento_itens" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_evento_itens";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_evento_itens" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_evento_itens";
create policy tenant_isolamento on "public"."crm_multiempresas_evento_itens" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_evento_itens";
create policy tenant_definer on "public"."crm_multiempresas_evento_itens" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_evento_midias
alter table "public"."crm_multiempresas_evento_midias" add column empresa_id uuid;
update "public"."crm_multiempresas_evento_midias" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_evento_midias" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_evento_midias" add constraint tnt_16ac11a285_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_16ac11a285_idx on "public"."crm_multiempresas_evento_midias" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_evento_midias";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_evento_midias" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_evento_midias";
create policy tenant_isolamento on "public"."crm_multiempresas_evento_midias" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_evento_midias";
create policy tenant_definer on "public"."crm_multiempresas_evento_midias" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_evento_paginas
alter table "public"."crm_multiempresas_evento_paginas" add column empresa_id uuid;
update "public"."crm_multiempresas_evento_paginas" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_evento_paginas" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_evento_paginas" add constraint tnt_9d86233bae_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_9d86233bae_idx on "public"."crm_multiempresas_evento_paginas" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_evento_paginas";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_evento_paginas" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_evento_paginas";
create policy tenant_isolamento on "public"."crm_multiempresas_evento_paginas" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_evento_paginas";
create policy tenant_definer on "public"."crm_multiempresas_evento_paginas" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_evento_participante_midias
alter table "public"."crm_multiempresas_evento_participante_midias" add column empresa_id uuid;
update "public"."crm_multiempresas_evento_participante_midias" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_evento_participante_midias" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_evento_participante_midias" add constraint tnt_43aaab505c_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_43aaab505c_idx on "public"."crm_multiempresas_evento_participante_midias" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_evento_participante_midias";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_evento_participante_midias" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_evento_participante_midias";
create policy tenant_isolamento on "public"."crm_multiempresas_evento_participante_midias" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_evento_participante_midias";
create policy tenant_definer on "public"."crm_multiempresas_evento_participante_midias" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_evento_participantes
alter table "public"."crm_multiempresas_evento_participantes" add column empresa_id uuid;
update "public"."crm_multiempresas_evento_participantes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_evento_participantes" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_evento_participantes" add constraint tnt_40d1d75fc7_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_40d1d75fc7_idx on "public"."crm_multiempresas_evento_participantes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_evento_participantes";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_evento_participantes" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_evento_participantes";
create policy tenant_isolamento on "public"."crm_multiempresas_evento_participantes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_evento_participantes";
create policy tenant_definer on "public"."crm_multiempresas_evento_participantes" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_evento_tarefas
alter table "public"."crm_multiempresas_evento_tarefas" add column empresa_id uuid;
update "public"."crm_multiempresas_evento_tarefas" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_evento_tarefas" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_evento_tarefas" add constraint tnt_8238fc4643_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_8238fc4643_idx on "public"."crm_multiempresas_evento_tarefas" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_evento_tarefas";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_evento_tarefas" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_evento_tarefas";
create policy tenant_isolamento on "public"."crm_multiempresas_evento_tarefas" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_evento_tarefas";
create policy tenant_definer on "public"."crm_multiempresas_evento_tarefas" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_eventos
alter table "public"."crm_multiempresas_eventos" add column empresa_id uuid;
update "public"."crm_multiempresas_eventos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_eventos" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_eventos" add constraint tnt_1c9a1ce0b8_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_1c9a1ce0b8_idx on "public"."crm_multiempresas_eventos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_eventos";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_eventos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_eventos";
create policy tenant_isolamento on "public"."crm_multiempresas_eventos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_eventos";
create policy tenant_definer on "public"."crm_multiempresas_eventos" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_lead_photo_checklists
alter table "public"."crm_multiempresas_lead_photo_checklists" add column empresa_id uuid;
update "public"."crm_multiempresas_lead_photo_checklists" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_lead_photo_checklists" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_lead_photo_checklists" add constraint tnt_86e8aca972_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_86e8aca972_idx on "public"."crm_multiempresas_lead_photo_checklists" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_lead_photo_checklists";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_lead_photo_checklists" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_lead_photo_checklists";
create policy tenant_isolamento on "public"."crm_multiempresas_lead_photo_checklists" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_lead_photo_checklists";
create policy tenant_definer on "public"."crm_multiempresas_lead_photo_checklists" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_lead_whiteboard_drawings
alter table "public"."crm_multiempresas_lead_whiteboard_drawings" add column empresa_id uuid;
update "public"."crm_multiempresas_lead_whiteboard_drawings" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_lead_whiteboard_drawings" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_lead_whiteboard_drawings" add constraint tnt_d6677534ad_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_d6677534ad_idx on "public"."crm_multiempresas_lead_whiteboard_drawings" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_lead_whiteboard_drawings";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_lead_whiteboard_drawings" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_lead_whiteboard_drawings";
create policy tenant_isolamento on "public"."crm_multiempresas_lead_whiteboard_drawings" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_lead_whiteboard_drawings";
create policy tenant_definer on "public"."crm_multiempresas_lead_whiteboard_drawings" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_lead_whiteboard_images
alter table "public"."crm_multiempresas_lead_whiteboard_images" add column empresa_id uuid;
update "public"."crm_multiempresas_lead_whiteboard_images" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_lead_whiteboard_images" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_lead_whiteboard_images" add constraint tnt_6af0cb945c_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_6af0cb945c_idx on "public"."crm_multiempresas_lead_whiteboard_images" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_lead_whiteboard_images";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_lead_whiteboard_images" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_lead_whiteboard_images";
create policy tenant_isolamento on "public"."crm_multiempresas_lead_whiteboard_images" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_lead_whiteboard_images";
create policy tenant_definer on "public"."crm_multiempresas_lead_whiteboard_images" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_ai_agents
alter table "public"."crm_multiempresas_marketing_ai_agents" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_ai_agents" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_ai_agents" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_ai_agents" add constraint tnt_c900a55542_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_c900a55542_idx on "public"."crm_multiempresas_marketing_ai_agents" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_ai_agents";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_ai_agents" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_ai_agents";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_ai_agents" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_ai_agents";
create policy tenant_definer on "public"."crm_multiempresas_marketing_ai_agents" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_ai_personalities
alter table "public"."crm_multiempresas_marketing_ai_personalities" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_ai_personalities" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_ai_personalities" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_ai_personalities" add constraint tnt_d7a0698e9c_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_d7a0698e9c_idx on "public"."crm_multiempresas_marketing_ai_personalities" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_ai_personalities";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_ai_personalities" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_ai_personalities";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_ai_personalities" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_ai_personalities";
create policy tenant_definer on "public"."crm_multiempresas_marketing_ai_personalities" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_ai_studio_config
alter table "public"."crm_multiempresas_marketing_ai_studio_config" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_ai_studio_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_ai_studio_config" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_ai_studio_config" add constraint tnt_2c80e1f552_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_2c80e1f552_idx on "public"."crm_multiempresas_marketing_ai_studio_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_ai_studio_config";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_ai_studio_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_ai_studio_config";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_ai_studio_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_ai_studio_config";
create policy tenant_definer on "public"."crm_multiempresas_marketing_ai_studio_config" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_ai_studio_secrets
alter table "public"."crm_multiempresas_marketing_ai_studio_secrets" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_ai_studio_secrets" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_ai_studio_secrets" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_ai_studio_secrets" add constraint tnt_8542fc302f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_8542fc302f_idx on "public"."crm_multiempresas_marketing_ai_studio_secrets" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_ai_studio_secrets";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_ai_studio_secrets" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_ai_studio_secrets";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_ai_studio_secrets" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_ai_studio_secrets";
create policy tenant_definer on "public"."crm_multiempresas_marketing_ai_studio_secrets" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_ai_webhook_config
alter table "public"."crm_multiempresas_marketing_ai_webhook_config" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_ai_webhook_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_ai_webhook_config" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_ai_webhook_config" add constraint tnt_74f97dbb13_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_74f97dbb13_idx on "public"."crm_multiempresas_marketing_ai_webhook_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_ai_webhook_config";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_ai_webhook_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_ai_webhook_config";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_ai_webhook_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_ai_webhook_config";
create policy tenant_definer on "public"."crm_multiempresas_marketing_ai_webhook_config" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_approval_notifications
alter table "public"."crm_multiempresas_marketing_approval_notifications" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_approval_notifications" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_approval_notifications" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_approval_notifications" add constraint tnt_7036ca06cc_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_7036ca06cc_idx on "public"."crm_multiempresas_marketing_approval_notifications" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_approval_notifications";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_approval_notifications" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_approval_notifications";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_approval_notifications" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_approval_notifications";
create policy tenant_definer on "public"."crm_multiempresas_marketing_approval_notifications" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_board_templates
alter table "public"."crm_multiempresas_marketing_board_templates" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_board_templates" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_board_templates" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_board_templates" add constraint tnt_6863e002a7_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_6863e002a7_idx on "public"."crm_multiempresas_marketing_board_templates" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_board_templates";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_board_templates" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_board_templates";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_board_templates" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_board_templates";
create policy tenant_definer on "public"."crm_multiempresas_marketing_board_templates" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_central_planning
alter table "public"."crm_multiempresas_marketing_central_planning" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_central_planning" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_central_planning" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_central_planning" add constraint tnt_97015e8ccc_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_97015e8ccc_idx on "public"."crm_multiempresas_marketing_central_planning" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_central_planning";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_central_planning" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_central_planning";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_central_planning" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_central_planning";
create policy tenant_definer on "public"."crm_multiempresas_marketing_central_planning" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_columns
alter table "public"."crm_multiempresas_marketing_columns" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_columns" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_columns" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_columns" add constraint tnt_fedbe9039d_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_fedbe9039d_idx on "public"."crm_multiempresas_marketing_columns" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_columns";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_columns" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_columns";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_columns" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_columns";
create policy tenant_definer on "public"."crm_multiempresas_marketing_columns" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_content_cards
alter table "public"."crm_multiempresas_marketing_content_cards" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_content_cards" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_content_cards" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_content_cards" add constraint tnt_3a2bb69ef0_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_3a2bb69ef0_idx on "public"."crm_multiempresas_marketing_content_cards" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_content_cards";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_content_cards" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_content_cards";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_content_cards" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_content_cards";
create policy tenant_definer on "public"."crm_multiempresas_marketing_content_cards" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_funnel_stages
alter table "public"."crm_multiempresas_marketing_funnel_stages" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_funnel_stages" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_funnel_stages" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_funnel_stages" add constraint tnt_dbdacfcbc0_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_dbdacfcbc0_idx on "public"."crm_multiempresas_marketing_funnel_stages" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_funnel_stages";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_funnel_stages" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_funnel_stages";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_funnel_stages" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_funnel_stages";
create policy tenant_definer on "public"."crm_multiempresas_marketing_funnel_stages" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_media_folders
alter table "public"."crm_multiempresas_marketing_media_folders" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_media_folders" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_media_folders" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_media_folders" add constraint tnt_4deef1d1a3_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_4deef1d1a3_idx on "public"."crm_multiempresas_marketing_media_folders" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_media_folders";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_media_folders" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_media_folders";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_media_folders" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_media_folders";
create policy tenant_definer on "public"."crm_multiempresas_marketing_media_folders" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_medias
alter table "public"."crm_multiempresas_marketing_medias" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_medias" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_medias" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_medias" add constraint tnt_70f401ab17_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_70f401ab17_idx on "public"."crm_multiempresas_marketing_medias" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_medias";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_medias" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_medias";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_medias" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_medias";
create policy tenant_definer on "public"."crm_multiempresas_marketing_medias" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_planning_drawings
alter table "public"."crm_multiempresas_marketing_planning_drawings" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_planning_drawings" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_planning_drawings" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_planning_drawings" add constraint tnt_307e186cc6_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_307e186cc6_idx on "public"."crm_multiempresas_marketing_planning_drawings" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_planning_drawings";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_planning_drawings" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_planning_drawings";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_planning_drawings" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_planning_drawings";
create policy tenant_definer on "public"."crm_multiempresas_marketing_planning_drawings" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_planning_edges
alter table "public"."crm_multiempresas_marketing_planning_edges" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_planning_edges" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_planning_edges" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_planning_edges" add constraint tnt_ab7e03ae1a_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_ab7e03ae1a_idx on "public"."crm_multiempresas_marketing_planning_edges" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_planning_edges";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_planning_edges" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_planning_edges";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_planning_edges" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_planning_edges";
create policy tenant_definer on "public"."crm_multiempresas_marketing_planning_edges" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_planning_files
alter table "public"."crm_multiempresas_marketing_planning_files" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_planning_files" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_planning_files" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_planning_files" add constraint tnt_3c72c0faef_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_3c72c0faef_idx on "public"."crm_multiempresas_marketing_planning_files" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_planning_files";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_planning_files" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_planning_files";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_planning_files" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_planning_files";
create policy tenant_definer on "public"."crm_multiempresas_marketing_planning_files" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_planning_nodes
alter table "public"."crm_multiempresas_marketing_planning_nodes" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_planning_nodes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_planning_nodes" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_planning_nodes" add constraint tnt_29022a0527_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_29022a0527_idx on "public"."crm_multiempresas_marketing_planning_nodes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_planning_nodes";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_planning_nodes" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_planning_nodes";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_planning_nodes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_planning_nodes";
create policy tenant_definer on "public"."crm_multiempresas_marketing_planning_nodes" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_planning_shapes
alter table "public"."crm_multiempresas_marketing_planning_shapes" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_planning_shapes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_planning_shapes" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_planning_shapes" add constraint tnt_eb2be27c34_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_eb2be27c34_idx on "public"."crm_multiempresas_marketing_planning_shapes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_planning_shapes";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_planning_shapes" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_planning_shapes";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_planning_shapes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_planning_shapes";
create policy tenant_definer on "public"."crm_multiempresas_marketing_planning_shapes" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_products
alter table "public"."crm_multiempresas_marketing_products" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_products" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_products" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_products" add constraint tnt_f393686836_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_f393686836_idx on "public"."crm_multiempresas_marketing_products" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_products";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_products" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_products";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_products" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_products";
create policy tenant_definer on "public"."crm_multiempresas_marketing_products" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_tasks
alter table "public"."crm_multiempresas_marketing_tasks" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_tasks" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_tasks" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_tasks" add constraint tnt_f3f2d1eac8_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_f3f2d1eac8_idx on "public"."crm_multiempresas_marketing_tasks" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_tasks";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_tasks" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_tasks";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_tasks" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_tasks";
create policy tenant_definer on "public"."crm_multiempresas_marketing_tasks" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_traffic_sources
alter table "public"."crm_multiempresas_marketing_traffic_sources" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_traffic_sources" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_traffic_sources" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_traffic_sources" add constraint tnt_fa15fbc71b_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_fa15fbc71b_idx on "public"."crm_multiempresas_marketing_traffic_sources" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_traffic_sources";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_traffic_sources" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_traffic_sources";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_traffic_sources" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_traffic_sources";
create policy tenant_definer on "public"."crm_multiempresas_marketing_traffic_sources" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_marketing_ugc_webhook_config
alter table "public"."crm_multiempresas_marketing_ugc_webhook_config" add column empresa_id uuid;
update "public"."crm_multiempresas_marketing_ugc_webhook_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_marketing_ugc_webhook_config" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_marketing_ugc_webhook_config" add constraint tnt_e9b7966252_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_e9b7966252_idx on "public"."crm_multiempresas_marketing_ugc_webhook_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_marketing_ugc_webhook_config";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_marketing_ugc_webhook_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_marketing_ugc_webhook_config";
create policy tenant_isolamento on "public"."crm_multiempresas_marketing_ugc_webhook_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_marketing_ugc_webhook_config";
create policy tenant_definer on "public"."crm_multiempresas_marketing_ugc_webhook_config" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_mkt_config_colunas
alter table "public"."crm_multiempresas_mkt_config_colunas" add column empresa_id uuid;
update "public"."crm_multiempresas_mkt_config_colunas" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_mkt_config_colunas" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_mkt_config_colunas" add constraint tnt_3e41c97db2_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_3e41c97db2_idx on "public"."crm_multiempresas_mkt_config_colunas" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_mkt_config_colunas";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_mkt_config_colunas" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_mkt_config_colunas";
create policy tenant_isolamento on "public"."crm_multiempresas_mkt_config_colunas" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_mkt_config_colunas";
create policy tenant_definer on "public"."crm_multiempresas_mkt_config_colunas" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_mkt_fontes
alter table "public"."crm_multiempresas_mkt_fontes" add column empresa_id uuid;
update "public"."crm_multiempresas_mkt_fontes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_mkt_fontes" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_mkt_fontes" add constraint tnt_ad52f9db4c_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_ad52f9db4c_idx on "public"."crm_multiempresas_mkt_fontes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_mkt_fontes";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_mkt_fontes" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_mkt_fontes";
create policy tenant_isolamento on "public"."crm_multiempresas_mkt_fontes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_mkt_fontes";
create policy tenant_definer on "public"."crm_multiempresas_mkt_fontes" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_mkt_gastos_config
alter table "public"."crm_multiempresas_mkt_gastos_config" add column empresa_id uuid;
update "public"."crm_multiempresas_mkt_gastos_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_mkt_gastos_config" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_mkt_gastos_config" add constraint tnt_9a54c0736e_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_9a54c0736e_idx on "public"."crm_multiempresas_mkt_gastos_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_mkt_gastos_config";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_mkt_gastos_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_mkt_gastos_config";
create policy tenant_isolamento on "public"."crm_multiempresas_mkt_gastos_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_mkt_gastos_config";
create policy tenant_definer on "public"."crm_multiempresas_mkt_gastos_config" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_mkt_lancamentos
alter table "public"."crm_multiempresas_mkt_lancamentos" add column empresa_id uuid;
update "public"."crm_multiempresas_mkt_lancamentos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_mkt_lancamentos" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_mkt_lancamentos" add constraint tnt_3ecdcf0266_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_3ecdcf0266_idx on "public"."crm_multiempresas_mkt_lancamentos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_mkt_lancamentos";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_mkt_lancamentos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_mkt_lancamentos";
create policy tenant_isolamento on "public"."crm_multiempresas_mkt_lancamentos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_mkt_lancamentos";
create policy tenant_definer on "public"."crm_multiempresas_mkt_lancamentos" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_mkt_sub_fontes
alter table "public"."crm_multiempresas_mkt_sub_fontes" add column empresa_id uuid;
update "public"."crm_multiempresas_mkt_sub_fontes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_mkt_sub_fontes" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_mkt_sub_fontes" add constraint tnt_843f629e4f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_843f629e4f_idx on "public"."crm_multiempresas_mkt_sub_fontes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_mkt_sub_fontes";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_mkt_sub_fontes" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_mkt_sub_fontes";
create policy tenant_isolamento on "public"."crm_multiempresas_mkt_sub_fontes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_mkt_sub_fontes";
create policy tenant_definer on "public"."crm_multiempresas_mkt_sub_fontes" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_n8n_chat_histories
alter table "public"."crm_multiempresas_n8n_chat_histories" add column empresa_id uuid;
update "public"."crm_multiempresas_n8n_chat_histories" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_n8n_chat_histories" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_n8n_chat_histories" add constraint tnt_dfe0e687a6_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_dfe0e687a6_idx on "public"."crm_multiempresas_n8n_chat_histories" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_n8n_chat_histories";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_n8n_chat_histories" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_n8n_chat_histories";
create policy tenant_isolamento on "public"."crm_multiempresas_n8n_chat_histories" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_n8n_chat_histories";
create policy tenant_definer on "public"."crm_multiempresas_n8n_chat_histories" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_negativacao_webhook_config
alter table "public"."crm_multiempresas_negativacao_webhook_config" add column empresa_id uuid;
update "public"."crm_multiempresas_negativacao_webhook_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_negativacao_webhook_config" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_negativacao_webhook_config" add constraint tnt_99dc015276_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_99dc015276_idx on "public"."crm_multiempresas_negativacao_webhook_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_negativacao_webhook_config";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_negativacao_webhook_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_negativacao_webhook_config";
create policy tenant_isolamento on "public"."crm_multiempresas_negativacao_webhook_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_negativacao_webhook_config";
create policy tenant_definer on "public"."crm_multiempresas_negativacao_webhook_config" for all to app_tenant_definer using (true) with check (true);

-- public.crm_multiempresas_ui_preferences
alter table "public"."crm_multiempresas_ui_preferences" add column empresa_id uuid;
update "public"."crm_multiempresas_ui_preferences" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_multiempresas_ui_preferences" alter column empresa_id set not null;
alter table "public"."crm_multiempresas_ui_preferences" add constraint tnt_0206db6678_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_0206db6678_idx on "public"."crm_multiempresas_ui_preferences" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_multiempresas_ui_preferences";
create trigger aaa_tenant_fill before insert on "public"."crm_multiempresas_ui_preferences" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_multiempresas_ui_preferences";
create policy tenant_isolamento on "public"."crm_multiempresas_ui_preferences" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_multiempresas_ui_preferences";
create policy tenant_definer on "public"."crm_multiempresas_ui_preferences" for all to app_tenant_definer using (true) with check (true);

-- public.crm_selletos_chat_contatos
alter table "public"."crm_selletos_chat_contatos" add column empresa_id uuid;
update "public"."crm_selletos_chat_contatos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_selletos_chat_contatos" alter column empresa_id set not null;
alter table "public"."crm_selletos_chat_contatos" add constraint tnt_07ef788d74_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_07ef788d74_idx on "public"."crm_selletos_chat_contatos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_selletos_chat_contatos";
create trigger aaa_tenant_fill before insert on "public"."crm_selletos_chat_contatos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_selletos_chat_contatos";
create policy tenant_isolamento on "public"."crm_selletos_chat_contatos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_selletos_chat_contatos";
create policy tenant_definer on "public"."crm_selletos_chat_contatos" for all to app_tenant_definer using (true) with check (true);

-- public.crm_selletos_chat_logs
alter table "public"."crm_selletos_chat_logs" add column empresa_id uuid;
update "public"."crm_selletos_chat_logs" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_selletos_chat_logs" alter column empresa_id set not null;
alter table "public"."crm_selletos_chat_logs" add constraint tnt_7a2266603f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_7a2266603f_idx on "public"."crm_selletos_chat_logs" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_selletos_chat_logs";
create trigger aaa_tenant_fill before insert on "public"."crm_selletos_chat_logs" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_selletos_chat_logs";
create policy tenant_isolamento on "public"."crm_selletos_chat_logs" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_selletos_chat_logs";
create policy tenant_definer on "public"."crm_selletos_chat_logs" for all to app_tenant_definer using (true) with check (true);

-- public.crm_selletos_chat_mensagens
alter table "public"."crm_selletos_chat_mensagens" add column empresa_id uuid;
update "public"."crm_selletos_chat_mensagens" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_selletos_chat_mensagens" alter column empresa_id set not null;
alter table "public"."crm_selletos_chat_mensagens" add constraint tnt_2a47e52025_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_2a47e52025_idx on "public"."crm_selletos_chat_mensagens" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_selletos_chat_mensagens";
create trigger aaa_tenant_fill before insert on "public"."crm_selletos_chat_mensagens" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_selletos_chat_mensagens";
create policy tenant_isolamento on "public"."crm_selletos_chat_mensagens" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_selletos_chat_mensagens";
create policy tenant_definer on "public"."crm_selletos_chat_mensagens" for all to app_tenant_definer using (true) with check (true);

-- public.crm_selletos_ui_preferences
alter table "public"."crm_selletos_ui_preferences" add column empresa_id uuid;
update "public"."crm_selletos_ui_preferences" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."crm_selletos_ui_preferences" alter column empresa_id set not null;
alter table "public"."crm_selletos_ui_preferences" add constraint tnt_0a08d36acb_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_0a08d36acb_idx on "public"."crm_selletos_ui_preferences" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."crm_selletos_ui_preferences";
create trigger aaa_tenant_fill before insert on "public"."crm_selletos_ui_preferences" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."crm_selletos_ui_preferences";
create policy tenant_isolamento on "public"."crm_selletos_ui_preferences" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."crm_selletos_ui_preferences";
create policy tenant_definer on "public"."crm_selletos_ui_preferences" for all to app_tenant_definer using (true) with check (true);

-- public.inventory_aliases
update "public"."inventory_aliases" set company_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where company_id is null;
alter table "public"."inventory_aliases" alter column company_id set not null;
alter table "public"."inventory_aliases" add constraint tnt_0f970f51e4_fk foreign key (company_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_0f970f51e4_idx on "public"."inventory_aliases" (company_id);
drop trigger if exists aaa_tenant_fill on "public"."inventory_aliases";
create trigger aaa_tenant_fill before insert on "public"."inventory_aliases" for each row execute function public.app_tenant_fill_company();
drop policy if exists tenant_isolamento on "public"."inventory_aliases";
create policy tenant_isolamento on "public"."inventory_aliases" as restrictive for all to public using (company_id = (select public.app_empresa_atual())) with check (company_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."inventory_aliases";
create policy tenant_definer on "public"."inventory_aliases" for all to app_tenant_definer using (true) with check (true);

-- public.inventory_items
update "public"."inventory_items" set company_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where company_id is null;
alter table "public"."inventory_items" alter column company_id set not null;
alter table "public"."inventory_items" add constraint tnt_e69ce708e8_fk foreign key (company_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_e69ce708e8_idx on "public"."inventory_items" (company_id);
drop trigger if exists aaa_tenant_fill on "public"."inventory_items";
create trigger aaa_tenant_fill before insert on "public"."inventory_items" for each row execute function public.app_tenant_fill_company();
drop policy if exists tenant_isolamento on "public"."inventory_items";
create policy tenant_isolamento on "public"."inventory_items" as restrictive for all to public using (company_id = (select public.app_empresa_atual())) with check (company_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."inventory_items";
create policy tenant_definer on "public"."inventory_items" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_ai_agents
alter table "public"."marketing_ai_agents" add column empresa_id uuid;
update "public"."marketing_ai_agents" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_ai_agents" alter column empresa_id set not null;
alter table "public"."marketing_ai_agents" add constraint tnt_25ab1ddf6a_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_25ab1ddf6a_idx on "public"."marketing_ai_agents" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_ai_agents";
create trigger aaa_tenant_fill before insert on "public"."marketing_ai_agents" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_ai_agents";
create policy tenant_isolamento on "public"."marketing_ai_agents" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_ai_agents";
create policy tenant_definer on "public"."marketing_ai_agents" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_ai_personalities
alter table "public"."marketing_ai_personalities" add column empresa_id uuid;
update "public"."marketing_ai_personalities" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_ai_personalities" alter column empresa_id set not null;
alter table "public"."marketing_ai_personalities" add constraint tnt_5ba4e1abfd_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_5ba4e1abfd_idx on "public"."marketing_ai_personalities" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_ai_personalities";
create trigger aaa_tenant_fill before insert on "public"."marketing_ai_personalities" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_ai_personalities";
create policy tenant_isolamento on "public"."marketing_ai_personalities" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_ai_personalities";
create policy tenant_definer on "public"."marketing_ai_personalities" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_ai_studio_config
alter table "public"."marketing_ai_studio_config" add column empresa_id uuid;
update "public"."marketing_ai_studio_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_ai_studio_config" alter column empresa_id set not null;
alter table "public"."marketing_ai_studio_config" add constraint tnt_6a0e92bad3_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_6a0e92bad3_idx on "public"."marketing_ai_studio_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_ai_studio_config";
create trigger aaa_tenant_fill before insert on "public"."marketing_ai_studio_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_ai_studio_config";
create policy tenant_isolamento on "public"."marketing_ai_studio_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_ai_studio_config";
create policy tenant_definer on "public"."marketing_ai_studio_config" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_ai_studio_secrets
alter table "public"."marketing_ai_studio_secrets" add column empresa_id uuid;
update "public"."marketing_ai_studio_secrets" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_ai_studio_secrets" alter column empresa_id set not null;
alter table "public"."marketing_ai_studio_secrets" add constraint tnt_c956b71a43_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_c956b71a43_idx on "public"."marketing_ai_studio_secrets" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_ai_studio_secrets";
create trigger aaa_tenant_fill before insert on "public"."marketing_ai_studio_secrets" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_ai_studio_secrets";
create policy tenant_isolamento on "public"."marketing_ai_studio_secrets" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_ai_studio_secrets";
create policy tenant_definer on "public"."marketing_ai_studio_secrets" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_ai_webhook_config
alter table "public"."marketing_ai_webhook_config" add column empresa_id uuid;
update "public"."marketing_ai_webhook_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_ai_webhook_config" alter column empresa_id set not null;
alter table "public"."marketing_ai_webhook_config" add constraint tnt_4c502a315f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_4c502a315f_idx on "public"."marketing_ai_webhook_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_ai_webhook_config";
create trigger aaa_tenant_fill before insert on "public"."marketing_ai_webhook_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_ai_webhook_config";
create policy tenant_isolamento on "public"."marketing_ai_webhook_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_ai_webhook_config";
create policy tenant_definer on "public"."marketing_ai_webhook_config" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_approval_notifications
alter table "public"."marketing_approval_notifications" add column empresa_id uuid;
update "public"."marketing_approval_notifications" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_approval_notifications" alter column empresa_id set not null;
alter table "public"."marketing_approval_notifications" add constraint tnt_64af048502_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_64af048502_idx on "public"."marketing_approval_notifications" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_approval_notifications";
create trigger aaa_tenant_fill before insert on "public"."marketing_approval_notifications" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_approval_notifications";
create policy tenant_isolamento on "public"."marketing_approval_notifications" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_approval_notifications";
create policy tenant_definer on "public"."marketing_approval_notifications" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_board_templates
alter table "public"."marketing_board_templates" add column empresa_id uuid;
update "public"."marketing_board_templates" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_board_templates" alter column empresa_id set not null;
alter table "public"."marketing_board_templates" add constraint tnt_db1dbf81dd_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_db1dbf81dd_idx on "public"."marketing_board_templates" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_board_templates";
create trigger aaa_tenant_fill before insert on "public"."marketing_board_templates" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_board_templates";
create policy tenant_isolamento on "public"."marketing_board_templates" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_board_templates";
create policy tenant_definer on "public"."marketing_board_templates" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_boards
alter table "public"."marketing_boards" add column empresa_id uuid;
update "public"."marketing_boards" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_boards" alter column empresa_id set not null;
alter table "public"."marketing_boards" add constraint tnt_b90a132bce_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_b90a132bce_idx on "public"."marketing_boards" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_boards";
create trigger aaa_tenant_fill before insert on "public"."marketing_boards" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_boards";
create policy tenant_isolamento on "public"."marketing_boards" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_boards";
create policy tenant_definer on "public"."marketing_boards" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_central_planning
alter table "public"."marketing_central_planning" add column empresa_id uuid;
update "public"."marketing_central_planning" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_central_planning" alter column empresa_id set not null;
alter table "public"."marketing_central_planning" add constraint tnt_133731412d_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_133731412d_idx on "public"."marketing_central_planning" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_central_planning";
create trigger aaa_tenant_fill before insert on "public"."marketing_central_planning" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_central_planning";
create policy tenant_isolamento on "public"."marketing_central_planning" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_central_planning";
create policy tenant_definer on "public"."marketing_central_planning" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_columns
alter table "public"."marketing_columns" add column empresa_id uuid;
update "public"."marketing_columns" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_columns" alter column empresa_id set not null;
alter table "public"."marketing_columns" add constraint tnt_7327955751_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_7327955751_idx on "public"."marketing_columns" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_columns";
create trigger aaa_tenant_fill before insert on "public"."marketing_columns" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_columns";
create policy tenant_isolamento on "public"."marketing_columns" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_columns";
create policy tenant_definer on "public"."marketing_columns" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_content_cards
alter table "public"."marketing_content_cards" add column empresa_id uuid;
update "public"."marketing_content_cards" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_content_cards" alter column empresa_id set not null;
alter table "public"."marketing_content_cards" add constraint tnt_7861616356_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_7861616356_idx on "public"."marketing_content_cards" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_content_cards";
create trigger aaa_tenant_fill before insert on "public"."marketing_content_cards" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_content_cards";
create policy tenant_isolamento on "public"."marketing_content_cards" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_content_cards";
create policy tenant_definer on "public"."marketing_content_cards" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_funnel_stages
alter table "public"."marketing_funnel_stages" add column empresa_id uuid;
update "public"."marketing_funnel_stages" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_funnel_stages" alter column empresa_id set not null;
alter table "public"."marketing_funnel_stages" add constraint tnt_f6cb49a927_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_f6cb49a927_idx on "public"."marketing_funnel_stages" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_funnel_stages";
create trigger aaa_tenant_fill before insert on "public"."marketing_funnel_stages" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_funnel_stages";
create policy tenant_isolamento on "public"."marketing_funnel_stages" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_funnel_stages";
create policy tenant_definer on "public"."marketing_funnel_stages" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_media_folders
alter table "public"."marketing_media_folders" add column empresa_id uuid;
update "public"."marketing_media_folders" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_media_folders" alter column empresa_id set not null;
alter table "public"."marketing_media_folders" add constraint tnt_5ce5141fe1_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_5ce5141fe1_idx on "public"."marketing_media_folders" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_media_folders";
create trigger aaa_tenant_fill before insert on "public"."marketing_media_folders" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_media_folders";
create policy tenant_isolamento on "public"."marketing_media_folders" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_media_folders";
create policy tenant_definer on "public"."marketing_media_folders" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_medias
alter table "public"."marketing_medias" add column empresa_id uuid;
update "public"."marketing_medias" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_medias" alter column empresa_id set not null;
alter table "public"."marketing_medias" add constraint tnt_cd196d9600_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_cd196d9600_idx on "public"."marketing_medias" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_medias";
create trigger aaa_tenant_fill before insert on "public"."marketing_medias" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_medias";
create policy tenant_isolamento on "public"."marketing_medias" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_medias";
create policy tenant_definer on "public"."marketing_medias" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_planning_drawings
alter table "public"."marketing_planning_drawings" add column empresa_id uuid;
update "public"."marketing_planning_drawings" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_planning_drawings" alter column empresa_id set not null;
alter table "public"."marketing_planning_drawings" add constraint tnt_1c099cf949_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_1c099cf949_idx on "public"."marketing_planning_drawings" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_planning_drawings";
create trigger aaa_tenant_fill before insert on "public"."marketing_planning_drawings" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_planning_drawings";
create policy tenant_isolamento on "public"."marketing_planning_drawings" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_planning_drawings";
create policy tenant_definer on "public"."marketing_planning_drawings" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_planning_edges
alter table "public"."marketing_planning_edges" add column empresa_id uuid;
update "public"."marketing_planning_edges" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_planning_edges" alter column empresa_id set not null;
alter table "public"."marketing_planning_edges" add constraint tnt_6d48160d2f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_6d48160d2f_idx on "public"."marketing_planning_edges" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_planning_edges";
create trigger aaa_tenant_fill before insert on "public"."marketing_planning_edges" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_planning_edges";
create policy tenant_isolamento on "public"."marketing_planning_edges" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_planning_edges";
create policy tenant_definer on "public"."marketing_planning_edges" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_planning_files
alter table "public"."marketing_planning_files" add column empresa_id uuid;
update "public"."marketing_planning_files" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_planning_files" alter column empresa_id set not null;
alter table "public"."marketing_planning_files" add constraint tnt_9cf5208df9_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_9cf5208df9_idx on "public"."marketing_planning_files" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_planning_files";
create trigger aaa_tenant_fill before insert on "public"."marketing_planning_files" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_planning_files";
create policy tenant_isolamento on "public"."marketing_planning_files" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_planning_files";
create policy tenant_definer on "public"."marketing_planning_files" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_planning_nodes
alter table "public"."marketing_planning_nodes" add column empresa_id uuid;
update "public"."marketing_planning_nodes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_planning_nodes" alter column empresa_id set not null;
alter table "public"."marketing_planning_nodes" add constraint tnt_4b54f35d6d_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_4b54f35d6d_idx on "public"."marketing_planning_nodes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_planning_nodes";
create trigger aaa_tenant_fill before insert on "public"."marketing_planning_nodes" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_planning_nodes";
create policy tenant_isolamento on "public"."marketing_planning_nodes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_planning_nodes";
create policy tenant_definer on "public"."marketing_planning_nodes" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_planning_shapes
alter table "public"."marketing_planning_shapes" add column empresa_id uuid;
update "public"."marketing_planning_shapes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_planning_shapes" alter column empresa_id set not null;
alter table "public"."marketing_planning_shapes" add constraint tnt_6b7d59a54f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_6b7d59a54f_idx on "public"."marketing_planning_shapes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_planning_shapes";
create trigger aaa_tenant_fill before insert on "public"."marketing_planning_shapes" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_planning_shapes";
create policy tenant_isolamento on "public"."marketing_planning_shapes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_planning_shapes";
create policy tenant_definer on "public"."marketing_planning_shapes" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_products
alter table "public"."marketing_products" add column empresa_id uuid;
update "public"."marketing_products" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_products" alter column empresa_id set not null;
alter table "public"."marketing_products" add constraint tnt_1be9558255_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_1be9558255_idx on "public"."marketing_products" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_products";
create trigger aaa_tenant_fill before insert on "public"."marketing_products" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_products";
create policy tenant_isolamento on "public"."marketing_products" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_products";
create policy tenant_definer on "public"."marketing_products" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_tasks
alter table "public"."marketing_tasks" add column empresa_id uuid;
update "public"."marketing_tasks" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_tasks" alter column empresa_id set not null;
alter table "public"."marketing_tasks" add constraint tnt_93825f3311_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_93825f3311_idx on "public"."marketing_tasks" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_tasks";
create trigger aaa_tenant_fill before insert on "public"."marketing_tasks" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_tasks";
create policy tenant_isolamento on "public"."marketing_tasks" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_tasks";
create policy tenant_definer on "public"."marketing_tasks" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_topics_board_drawings
alter table "public"."marketing_topics_board_drawings" add column empresa_id uuid;
update "public"."marketing_topics_board_drawings" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_topics_board_drawings" alter column empresa_id set not null;
alter table "public"."marketing_topics_board_drawings" add constraint tnt_31710ba5b1_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_31710ba5b1_idx on "public"."marketing_topics_board_drawings" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_topics_board_drawings";
create trigger aaa_tenant_fill before insert on "public"."marketing_topics_board_drawings" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_topics_board_drawings";
create policy tenant_isolamento on "public"."marketing_topics_board_drawings" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_topics_board_drawings";
create policy tenant_definer on "public"."marketing_topics_board_drawings" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_topics_board_viewport
alter table "public"."marketing_topics_board_viewport" add column empresa_id uuid;
update "public"."marketing_topics_board_viewport" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_topics_board_viewport" alter column empresa_id set not null;
alter table "public"."marketing_topics_board_viewport" add constraint tnt_48e735a2be_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_48e735a2be_idx on "public"."marketing_topics_board_viewport" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_topics_board_viewport";
create trigger aaa_tenant_fill before insert on "public"."marketing_topics_board_viewport" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_topics_board_viewport";
create policy tenant_isolamento on "public"."marketing_topics_board_viewport" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_topics_board_viewport";
create policy tenant_definer on "public"."marketing_topics_board_viewport" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_traffic_sources
alter table "public"."marketing_traffic_sources" add column empresa_id uuid;
update "public"."marketing_traffic_sources" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_traffic_sources" alter column empresa_id set not null;
alter table "public"."marketing_traffic_sources" add constraint tnt_0a951f7d35_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_0a951f7d35_idx on "public"."marketing_traffic_sources" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_traffic_sources";
create trigger aaa_tenant_fill before insert on "public"."marketing_traffic_sources" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_traffic_sources";
create policy tenant_isolamento on "public"."marketing_traffic_sources" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_traffic_sources";
create policy tenant_definer on "public"."marketing_traffic_sources" for all to app_tenant_definer using (true) with check (true);

-- public.marketing_ugc_webhook_config
alter table "public"."marketing_ugc_webhook_config" add column empresa_id uuid;
update "public"."marketing_ugc_webhook_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."marketing_ugc_webhook_config" alter column empresa_id set not null;
alter table "public"."marketing_ugc_webhook_config" add constraint tnt_2523cac3c7_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_2523cac3c7_idx on "public"."marketing_ugc_webhook_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."marketing_ugc_webhook_config";
create trigger aaa_tenant_fill before insert on "public"."marketing_ugc_webhook_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."marketing_ugc_webhook_config";
create policy tenant_isolamento on "public"."marketing_ugc_webhook_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."marketing_ugc_webhook_config";
create policy tenant_definer on "public"."marketing_ugc_webhook_config" for all to app_tenant_definer using (true) with check (true);

-- public.mkt_config_colunas
alter table "public"."mkt_config_colunas" add column empresa_id uuid;
update "public"."mkt_config_colunas" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."mkt_config_colunas" alter column empresa_id set not null;
alter table "public"."mkt_config_colunas" add constraint tnt_5109bed16c_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_5109bed16c_idx on "public"."mkt_config_colunas" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."mkt_config_colunas";
create trigger aaa_tenant_fill before insert on "public"."mkt_config_colunas" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."mkt_config_colunas";
create policy tenant_isolamento on "public"."mkt_config_colunas" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."mkt_config_colunas";
create policy tenant_definer on "public"."mkt_config_colunas" for all to app_tenant_definer using (true) with check (true);

-- public.mkt_fontes
alter table "public"."mkt_fontes" add column empresa_id uuid;
update "public"."mkt_fontes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."mkt_fontes" alter column empresa_id set not null;
alter table "public"."mkt_fontes" add constraint tnt_0d3a1ea360_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_0d3a1ea360_idx on "public"."mkt_fontes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."mkt_fontes";
create trigger aaa_tenant_fill before insert on "public"."mkt_fontes" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."mkt_fontes";
create policy tenant_isolamento on "public"."mkt_fontes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."mkt_fontes";
create policy tenant_definer on "public"."mkt_fontes" for all to app_tenant_definer using (true) with check (true);

-- public.mkt_gastos_config
alter table "public"."mkt_gastos_config" add column empresa_id uuid;
update "public"."mkt_gastos_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."mkt_gastos_config" alter column empresa_id set not null;
alter table "public"."mkt_gastos_config" add constraint tnt_08d51b10ca_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_08d51b10ca_idx on "public"."mkt_gastos_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."mkt_gastos_config";
create trigger aaa_tenant_fill before insert on "public"."mkt_gastos_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."mkt_gastos_config";
create policy tenant_isolamento on "public"."mkt_gastos_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."mkt_gastos_config";
create policy tenant_definer on "public"."mkt_gastos_config" for all to app_tenant_definer using (true) with check (true);

-- public.mkt_lancamentos
alter table "public"."mkt_lancamentos" add column empresa_id uuid;
update "public"."mkt_lancamentos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."mkt_lancamentos" alter column empresa_id set not null;
alter table "public"."mkt_lancamentos" add constraint tnt_19d07424d2_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_19d07424d2_idx on "public"."mkt_lancamentos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."mkt_lancamentos";
create trigger aaa_tenant_fill before insert on "public"."mkt_lancamentos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."mkt_lancamentos";
create policy tenant_isolamento on "public"."mkt_lancamentos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."mkt_lancamentos";
create policy tenant_definer on "public"."mkt_lancamentos" for all to app_tenant_definer using (true) with check (true);

-- public.mkt_sub_fontes
alter table "public"."mkt_sub_fontes" add column empresa_id uuid;
update "public"."mkt_sub_fontes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."mkt_sub_fontes" alter column empresa_id set not null;
alter table "public"."mkt_sub_fontes" add constraint tnt_20db01d72c_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_20db01d72c_idx on "public"."mkt_sub_fontes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."mkt_sub_fontes";
create trigger aaa_tenant_fill before insert on "public"."mkt_sub_fontes" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."mkt_sub_fontes";
create policy tenant_isolamento on "public"."mkt_sub_fontes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."mkt_sub_fontes";
create policy tenant_definer on "public"."mkt_sub_fontes" for all to app_tenant_definer using (true) with check (true);

-- public.negativacao_ia
alter table "public"."negativacao_ia" add column empresa_id uuid;
update "public"."negativacao_ia" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."negativacao_ia" alter column empresa_id set not null;
alter table "public"."negativacao_ia" add constraint tnt_38f16e7eed_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_38f16e7eed_idx on "public"."negativacao_ia" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."negativacao_ia";
create trigger aaa_tenant_fill before insert on "public"."negativacao_ia" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."negativacao_ia";
create policy tenant_isolamento on "public"."negativacao_ia" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."negativacao_ia";
create policy tenant_definer on "public"."negativacao_ia" for all to app_tenant_definer using (true) with check (true);

-- public.negativacao_webhook_config
alter table "public"."negativacao_webhook_config" add column empresa_id uuid;
update "public"."negativacao_webhook_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."negativacao_webhook_config" alter column empresa_id set not null;
alter table "public"."negativacao_webhook_config" add constraint tnt_a452dbd316_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_a452dbd316_idx on "public"."negativacao_webhook_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."negativacao_webhook_config";
create trigger aaa_tenant_fill before insert on "public"."negativacao_webhook_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."negativacao_webhook_config";
create policy tenant_isolamento on "public"."negativacao_webhook_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."negativacao_webhook_config";
create policy tenant_definer on "public"."negativacao_webhook_config" for all to app_tenant_definer using (true) with check (true);

-- public.orcamento_slide_exports
alter table "public"."orcamento_slide_exports" add column empresa_id uuid;
update "public"."orcamento_slide_exports" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."orcamento_slide_exports" alter column empresa_id set not null;
alter table "public"."orcamento_slide_exports" add constraint tnt_400d68a4c0_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_400d68a4c0_idx on "public"."orcamento_slide_exports" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."orcamento_slide_exports";
create trigger aaa_tenant_fill before insert on "public"."orcamento_slide_exports" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."orcamento_slide_exports";
create policy tenant_isolamento on "public"."orcamento_slide_exports" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."orcamento_slide_exports";
create policy tenant_definer on "public"."orcamento_slide_exports" for all to app_tenant_definer using (true) with check (true);

-- public.orcamentos_ia_ai_secrets
update "public"."orcamentos_ia_ai_secrets" set company_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where company_id is null;
alter table "public"."orcamentos_ia_ai_secrets" alter column company_id set not null;
alter table "public"."orcamentos_ia_ai_secrets" add constraint tnt_ae65ae6ff9_fk foreign key (company_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_ae65ae6ff9_idx on "public"."orcamentos_ia_ai_secrets" (company_id);
drop trigger if exists aaa_tenant_fill on "public"."orcamentos_ia_ai_secrets";
create trigger aaa_tenant_fill before insert on "public"."orcamentos_ia_ai_secrets" for each row execute function public.app_tenant_fill_company();
drop policy if exists tenant_isolamento on "public"."orcamentos_ia_ai_secrets";
create policy tenant_isolamento on "public"."orcamentos_ia_ai_secrets" as restrictive for all to public using (company_id = (select public.app_empresa_atual())) with check (company_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."orcamentos_ia_ai_secrets";
create policy tenant_definer on "public"."orcamentos_ia_ai_secrets" for all to app_tenant_definer using (true) with check (true);

-- public.quote_analyses
update "public"."quote_analyses" set company_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where company_id is null;
alter table "public"."quote_analyses" alter column company_id set not null;
alter table "public"."quote_analyses" add constraint tnt_14a839fb25_fk foreign key (company_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_14a839fb25_idx on "public"."quote_analyses" (company_id);
drop trigger if exists aaa_tenant_fill on "public"."quote_analyses";
create trigger aaa_tenant_fill before insert on "public"."quote_analyses" for each row execute function public.app_tenant_fill_company();
drop policy if exists tenant_isolamento on "public"."quote_analyses";
create policy tenant_isolamento on "public"."quote_analyses" as restrictive for all to public using (company_id = (select public.app_empresa_atual())) with check (company_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."quote_analyses";
create policy tenant_definer on "public"."quote_analyses" for all to app_tenant_definer using (true) with check (true);

-- public.quote_environments
alter table "public"."quote_environments" add column empresa_id uuid;
update "public"."quote_environments" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."quote_environments" alter column empresa_id set not null;
alter table "public"."quote_environments" add constraint tnt_43ed36a478_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_43ed36a478_idx on "public"."quote_environments" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."quote_environments";
create trigger aaa_tenant_fill before insert on "public"."quote_environments" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."quote_environments";
create policy tenant_isolamento on "public"."quote_environments" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."quote_environments";
create policy tenant_definer on "public"."quote_environments" for all to app_tenant_definer using (true) with check (true);

-- public.quote_materials
alter table "public"."quote_materials" add column empresa_id uuid;
update "public"."quote_materials" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."quote_materials" alter column empresa_id set not null;
alter table "public"."quote_materials" add constraint tnt_dba3d4a542_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_dba3d4a542_idx on "public"."quote_materials" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."quote_materials";
create trigger aaa_tenant_fill before insert on "public"."quote_materials" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."quote_materials";
create policy tenant_isolamento on "public"."quote_materials" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."quote_materials";
create policy tenant_definer on "public"."quote_materials" for all to app_tenant_definer using (true) with check (true);

-- public.quote_modules
alter table "public"."quote_modules" add column empresa_id uuid;
update "public"."quote_modules" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."quote_modules" alter column empresa_id set not null;
alter table "public"."quote_modules" add constraint tnt_8cecbea760_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_8cecbea760_idx on "public"."quote_modules" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."quote_modules";
create trigger aaa_tenant_fill before insert on "public"."quote_modules" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."quote_modules";
create policy tenant_isolamento on "public"."quote_modules" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."quote_modules";
create policy tenant_definer on "public"."quote_modules" for all to app_tenant_definer using (true) with check (true);

-- public.quote_projects
update "public"."quote_projects" set company_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where company_id is null;
alter table "public"."quote_projects" alter column company_id set not null;
alter table "public"."quote_projects" add constraint tnt_3a9bcbc877_fk foreign key (company_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_3a9bcbc877_idx on "public"."quote_projects" (company_id);
drop trigger if exists aaa_tenant_fill on "public"."quote_projects";
create trigger aaa_tenant_fill before insert on "public"."quote_projects" for each row execute function public.app_tenant_fill_company();
drop policy if exists tenant_isolamento on "public"."quote_projects";
create policy tenant_isolamento on "public"."quote_projects" as restrictive for all to public using (company_id = (select public.app_empresa_atual())) with check (company_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."quote_projects";
create policy tenant_definer on "public"."quote_projects" for all to app_tenant_definer using (true) with check (true);

-- public.system_preferences
update "public"."system_preferences" set company_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where company_id is null;
alter table "public"."system_preferences" alter column company_id set not null;
alter table "public"."system_preferences" add constraint tnt_243c864bc5_fk foreign key (company_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_243c864bc5_idx on "public"."system_preferences" (company_id);
drop trigger if exists aaa_tenant_fill on "public"."system_preferences";
create trigger aaa_tenant_fill before insert on "public"."system_preferences" for each row execute function public.app_tenant_fill_company();
drop policy if exists tenant_isolamento on "public"."system_preferences";
create policy tenant_isolamento on "public"."system_preferences" as restrictive for all to public using (company_id = (select public.app_empresa_atual())) with check (company_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."system_preferences";
create policy tenant_definer on "public"."system_preferences" for all to app_tenant_definer using (true) with check (true);

-- public.usuarios
alter table "public"."usuarios" add column empresa_id uuid;
update "public"."usuarios" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."usuarios" alter column empresa_id set not null;
alter table "public"."usuarios" add constraint tnt_d4e2f6b4fc_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_d4e2f6b4fc_idx on "public"."usuarios" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."usuarios";
create trigger aaa_tenant_fill before insert on "public"."usuarios" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."usuarios";
create policy tenant_isolamento on "public"."usuarios" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."usuarios";
create policy tenant_definer on "public"."usuarios" for all to app_tenant_definer using (true) with check (true);

-- public.whatsapp_ia_configuracoes
alter table "public"."whatsapp_ia_configuracoes" add column empresa_id uuid;
update "public"."whatsapp_ia_configuracoes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."whatsapp_ia_configuracoes" alter column empresa_id set not null;
alter table "public"."whatsapp_ia_configuracoes" add constraint tnt_84e2fa8d74_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_84e2fa8d74_idx on "public"."whatsapp_ia_configuracoes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."whatsapp_ia_configuracoes";
create trigger aaa_tenant_fill before insert on "public"."whatsapp_ia_configuracoes" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."whatsapp_ia_configuracoes";
create policy tenant_isolamento on "public"."whatsapp_ia_configuracoes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."whatsapp_ia_configuracoes";
create policy tenant_definer on "public"."whatsapp_ia_configuracoes" for all to app_tenant_definer using (true) with check (true);

-- public.whatsapp_ia_configuracoes_historico
alter table "public"."whatsapp_ia_configuracoes_historico" add column empresa_id uuid;
update "public"."whatsapp_ia_configuracoes_historico" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."whatsapp_ia_configuracoes_historico" alter column empresa_id set not null;
alter table "public"."whatsapp_ia_configuracoes_historico" add constraint tnt_01a0d0f94a_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_01a0d0f94a_idx on "public"."whatsapp_ia_configuracoes_historico" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."whatsapp_ia_configuracoes_historico";
create trigger aaa_tenant_fill before insert on "public"."whatsapp_ia_configuracoes_historico" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."whatsapp_ia_configuracoes_historico";
create policy tenant_isolamento on "public"."whatsapp_ia_configuracoes_historico" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."whatsapp_ia_configuracoes_historico";
create policy tenant_definer on "public"."whatsapp_ia_configuracoes_historico" for all to app_tenant_definer using (true) with check (true);

-- public.whatsapp_ia_status
alter table "public"."whatsapp_ia_status" add column empresa_id uuid;
update "public"."whatsapp_ia_status" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."whatsapp_ia_status" alter column empresa_id set not null;
alter table "public"."whatsapp_ia_status" add constraint tnt_14443d3cd3_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_14443d3cd3_idx on "public"."whatsapp_ia_status" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."whatsapp_ia_status";
create trigger aaa_tenant_fill before insert on "public"."whatsapp_ia_status" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."whatsapp_ia_status";
create policy tenant_isolamento on "public"."whatsapp_ia_status" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."whatsapp_ia_status";
create policy tenant_definer on "public"."whatsapp_ia_status" for all to app_tenant_definer using (true) with check (true);

-- public.whatsapp_instancias
alter table "public"."whatsapp_instancias" add column empresa_id uuid;
update "public"."whatsapp_instancias" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."whatsapp_instancias" alter column empresa_id set not null;
alter table "public"."whatsapp_instancias" add constraint tnt_4615106f5b_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_4615106f5b_idx on "public"."whatsapp_instancias" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."whatsapp_instancias";
create trigger aaa_tenant_fill before insert on "public"."whatsapp_instancias" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."whatsapp_instancias";
create policy tenant_isolamento on "public"."whatsapp_instancias" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."whatsapp_instancias";
create policy tenant_definer on "public"."whatsapp_instancias" for all to app_tenant_definer using (true) with check (true);

-- public.whatsapp_v2_config
alter table "public"."whatsapp_v2_config" add column empresa_id uuid;
update "public"."whatsapp_v2_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."whatsapp_v2_config" alter column empresa_id set not null;
alter table "public"."whatsapp_v2_config" add constraint tnt_7b8e89608d_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_7b8e89608d_idx on "public"."whatsapp_v2_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."whatsapp_v2_config";
create trigger aaa_tenant_fill before insert on "public"."whatsapp_v2_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."whatsapp_v2_config";
create policy tenant_isolamento on "public"."whatsapp_v2_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."whatsapp_v2_config";
create policy tenant_definer on "public"."whatsapp_v2_config" for all to app_tenant_definer using (true) with check (true);

