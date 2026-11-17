-- GERADO por scripts/multi-empresa/gerar-tenant-migration.mjs (grupo: crm) — 129 tabelas.
-- Coluna de tenant + trigger aaa_tenant_fill + policy RESTRICTIVE tenant_isolamento + policy tenant_definer.
-- Tabelas que estavam SEM RLS ganham também tenant_acesso (permissiva, só dentro da empresa).

-- crm.agenda_bloqueios
alter table "crm"."agenda_bloqueios" add column empresa_id uuid;
update "crm"."agenda_bloqueios" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."agenda_bloqueios" alter column empresa_id set not null;
alter table "crm"."agenda_bloqueios" add constraint tnt_abdda2511c_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_abdda2511c_idx on "crm"."agenda_bloqueios" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."agenda_bloqueios";
create trigger aaa_tenant_fill before insert on "crm"."agenda_bloqueios" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."agenda_bloqueios";
create policy tenant_isolamento on "crm"."agenda_bloqueios" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."agenda_bloqueios";
create policy tenant_definer on "crm"."agenda_bloqueios" for all to app_tenant_definer using (true) with check (true);

-- crm.agenda_config
alter table "crm"."agenda_config" add column empresa_id uuid;
update "crm"."agenda_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."agenda_config" alter column empresa_id set not null;
alter table "crm"."agenda_config" add constraint tnt_5be30d016b_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_5be30d016b_idx on "crm"."agenda_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."agenda_config";
create trigger aaa_tenant_fill before insert on "crm"."agenda_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."agenda_config";
create policy tenant_isolamento on "crm"."agenda_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."agenda_config";
create policy tenant_definer on "crm"."agenda_config" for all to app_tenant_definer using (true) with check (true);

-- crm.agenda_form_fields
alter table "crm"."agenda_form_fields" add column empresa_id uuid;
update "crm"."agenda_form_fields" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."agenda_form_fields" alter column empresa_id set not null;
alter table "crm"."agenda_form_fields" add constraint tnt_28bc17177b_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_28bc17177b_idx on "crm"."agenda_form_fields" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."agenda_form_fields";
create trigger aaa_tenant_fill before insert on "crm"."agenda_form_fields" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."agenda_form_fields";
create policy tenant_isolamento on "crm"."agenda_form_fields" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."agenda_form_fields";
create policy tenant_definer on "crm"."agenda_form_fields" for all to app_tenant_definer using (true) with check (true);

-- crm.agenda_pessoal_admin_titular_filter  (estava sem RLS)
alter table "crm"."agenda_pessoal_admin_titular_filter" add column empresa_id uuid;
update "crm"."agenda_pessoal_admin_titular_filter" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."agenda_pessoal_admin_titular_filter" alter column empresa_id set not null;
alter table "crm"."agenda_pessoal_admin_titular_filter" add constraint tnt_fd38463b1e_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_fd38463b1e_idx on "crm"."agenda_pessoal_admin_titular_filter" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."agenda_pessoal_admin_titular_filter";
create trigger aaa_tenant_fill before insert on "crm"."agenda_pessoal_admin_titular_filter" for each row execute function public.app_tenant_fill();
alter table "crm"."agenda_pessoal_admin_titular_filter" enable row level security;
drop policy if exists tenant_acesso on "crm"."agenda_pessoal_admin_titular_filter";
create policy tenant_acesso on "crm"."agenda_pessoal_admin_titular_filter" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."agenda_pessoal_admin_titular_filter";
create policy tenant_isolamento on "crm"."agenda_pessoal_admin_titular_filter" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."agenda_pessoal_admin_titular_filter";
create policy tenant_definer on "crm"."agenda_pessoal_admin_titular_filter" for all to app_tenant_definer using (true) with check (true);

-- crm.agenda_pessoal_tarefas
alter table "crm"."agenda_pessoal_tarefas" add column empresa_id uuid;
update "crm"."agenda_pessoal_tarefas" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."agenda_pessoal_tarefas" alter column empresa_id set not null;
alter table "crm"."agenda_pessoal_tarefas" add constraint tnt_a6a969b699_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_a6a969b699_idx on "crm"."agenda_pessoal_tarefas" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."agenda_pessoal_tarefas";
create trigger aaa_tenant_fill before insert on "crm"."agenda_pessoal_tarefas" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."agenda_pessoal_tarefas";
create policy tenant_isolamento on "crm"."agenda_pessoal_tarefas" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."agenda_pessoal_tarefas";
create policy tenant_definer on "crm"."agenda_pessoal_tarefas" for all to app_tenant_definer using (true) with check (true);

-- crm.agenda_reunioes
alter table "crm"."agenda_reunioes" add column empresa_id uuid;
update "crm"."agenda_reunioes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."agenda_reunioes" alter column empresa_id set not null;
alter table "crm"."agenda_reunioes" add constraint tnt_53d49c8bf1_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_53d49c8bf1_idx on "crm"."agenda_reunioes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."agenda_reunioes";
create trigger aaa_tenant_fill before insert on "crm"."agenda_reunioes" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."agenda_reunioes";
create policy tenant_isolamento on "crm"."agenda_reunioes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."agenda_reunioes";
create policy tenant_definer on "crm"."agenda_reunioes" for all to app_tenant_definer using (true) with check (true);

-- crm.atalhos  (estava sem RLS)
alter table "crm"."atalhos" add column empresa_id uuid;
update "crm"."atalhos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."atalhos" alter column empresa_id set not null;
alter table "crm"."atalhos" add constraint tnt_4725206a86_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_4725206a86_idx on "crm"."atalhos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."atalhos";
create trigger aaa_tenant_fill before insert on "crm"."atalhos" for each row execute function public.app_tenant_fill();
alter table "crm"."atalhos" enable row level security;
drop policy if exists tenant_acesso on "crm"."atalhos";
create policy tenant_acesso on "crm"."atalhos" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."atalhos";
create policy tenant_isolamento on "crm"."atalhos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."atalhos";
create policy tenant_definer on "crm"."atalhos" for all to app_tenant_definer using (true) with check (true);

-- crm.cadastro_alunos  (estava sem RLS)
alter table "crm"."cadastro_alunos" add column empresa_id uuid;
update "crm"."cadastro_alunos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."cadastro_alunos" alter column empresa_id set not null;
alter table "crm"."cadastro_alunos" add constraint tnt_8f365fd742_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_8f365fd742_idx on "crm"."cadastro_alunos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."cadastro_alunos";
create trigger aaa_tenant_fill before insert on "crm"."cadastro_alunos" for each row execute function public.app_tenant_fill();
alter table "crm"."cadastro_alunos" enable row level security;
drop policy if exists tenant_acesso on "crm"."cadastro_alunos";
create policy tenant_acesso on "crm"."cadastro_alunos" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."cadastro_alunos";
create policy tenant_isolamento on "crm"."cadastro_alunos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."cadastro_alunos";
create policy tenant_definer on "crm"."cadastro_alunos" for all to app_tenant_definer using (true) with check (true);

-- crm.cadastro_config  (estava sem RLS)
alter table "crm"."cadastro_config" add column empresa_id uuid;
update "crm"."cadastro_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."cadastro_config" alter column empresa_id set not null;
alter table "crm"."cadastro_config" add constraint tnt_c45e9dfd93_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_c45e9dfd93_idx on "crm"."cadastro_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."cadastro_config";
create trigger aaa_tenant_fill before insert on "crm"."cadastro_config" for each row execute function public.app_tenant_fill();
alter table "crm"."cadastro_config" enable row level security;
drop policy if exists tenant_acesso on "crm"."cadastro_config";
create policy tenant_acesso on "crm"."cadastro_config" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."cadastro_config";
create policy tenant_isolamento on "crm"."cadastro_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."cadastro_config";
create policy tenant_definer on "crm"."cadastro_config" for all to app_tenant_definer using (true) with check (true);

-- crm.chat_contatos  (estava sem RLS)
alter table "crm"."chat_contatos" add column empresa_id uuid;
update "crm"."chat_contatos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."chat_contatos" alter column empresa_id set not null;
alter table "crm"."chat_contatos" add constraint tnt_9751b91728_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_9751b91728_idx on "crm"."chat_contatos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."chat_contatos";
create trigger aaa_tenant_fill before insert on "crm"."chat_contatos" for each row execute function public.app_tenant_fill();
alter table "crm"."chat_contatos" enable row level security;
drop policy if exists tenant_acesso on "crm"."chat_contatos";
create policy tenant_acesso on "crm"."chat_contatos" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."chat_contatos";
create policy tenant_isolamento on "crm"."chat_contatos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."chat_contatos";
create policy tenant_definer on "crm"."chat_contatos" for all to app_tenant_definer using (true) with check (true);

-- crm.chat_logs  (estava sem RLS)
alter table "crm"."chat_logs" add column empresa_id uuid;
update "crm"."chat_logs" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."chat_logs" alter column empresa_id set not null;
alter table "crm"."chat_logs" add constraint tnt_05fc45e602_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_05fc45e602_idx on "crm"."chat_logs" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."chat_logs";
create trigger aaa_tenant_fill before insert on "crm"."chat_logs" for each row execute function public.app_tenant_fill();
alter table "crm"."chat_logs" enable row level security;
drop policy if exists tenant_acesso on "crm"."chat_logs";
create policy tenant_acesso on "crm"."chat_logs" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."chat_logs";
create policy tenant_isolamento on "crm"."chat_logs" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."chat_logs";
create policy tenant_definer on "crm"."chat_logs" for all to app_tenant_definer using (true) with check (true);

-- crm.chat_mensagens  (estava sem RLS)
alter table "crm"."chat_mensagens" add column empresa_id uuid;
update "crm"."chat_mensagens" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."chat_mensagens" alter column empresa_id set not null;
alter table "crm"."chat_mensagens" add constraint tnt_de049da0a9_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_de049da0a9_idx on "crm"."chat_mensagens" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."chat_mensagens";
create trigger aaa_tenant_fill before insert on "crm"."chat_mensagens" for each row execute function public.app_tenant_fill();
alter table "crm"."chat_mensagens" enable row level security;
drop policy if exists tenant_acesso on "crm"."chat_mensagens";
create policy tenant_acesso on "crm"."chat_mensagens" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."chat_mensagens";
create policy tenant_isolamento on "crm"."chat_mensagens" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."chat_mensagens";
create policy tenant_definer on "crm"."chat_mensagens" for all to app_tenant_definer using (true) with check (true);

-- crm.contratos
alter table "crm"."contratos" add column empresa_id uuid;
update "crm"."contratos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."contratos" alter column empresa_id set not null;
alter table "crm"."contratos" add constraint tnt_824bf3ea72_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_824bf3ea72_idx on "crm"."contratos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."contratos";
create trigger aaa_tenant_fill before insert on "crm"."contratos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."contratos";
create policy tenant_isolamento on "crm"."contratos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."contratos";
create policy tenant_definer on "crm"."contratos" for all to app_tenant_definer using (true) with check (true);

-- crm.contratos_anexos
alter table "crm"."contratos_anexos" add column empresa_id uuid;
update "crm"."contratos_anexos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."contratos_anexos" alter column empresa_id set not null;
alter table "crm"."contratos_anexos" add constraint tnt_0beb8ba359_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_0beb8ba359_idx on "crm"."contratos_anexos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."contratos_anexos";
create trigger aaa_tenant_fill before insert on "crm"."contratos_anexos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."contratos_anexos";
create policy tenant_isolamento on "crm"."contratos_anexos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."contratos_anexos";
create policy tenant_definer on "crm"."contratos_anexos" for all to app_tenant_definer using (true) with check (true);

-- crm.contratos_modelos
alter table "crm"."contratos_modelos" add column empresa_id uuid;
update "crm"."contratos_modelos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."contratos_modelos" alter column empresa_id set not null;
alter table "crm"."contratos_modelos" add constraint tnt_1e86c62005_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_1e86c62005_idx on "crm"."contratos_modelos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."contratos_modelos";
create trigger aaa_tenant_fill before insert on "crm"."contratos_modelos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."contratos_modelos";
create policy tenant_isolamento on "crm"."contratos_modelos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."contratos_modelos";
create policy tenant_definer on "crm"."contratos_modelos" for all to app_tenant_definer using (true) with check (true);

-- crm.contratos_variaveis
alter table "crm"."contratos_variaveis" add column empresa_id uuid;
update "crm"."contratos_variaveis" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."contratos_variaveis" alter column empresa_id set not null;
alter table "crm"."contratos_variaveis" add constraint tnt_513e2b0015_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_513e2b0015_idx on "crm"."contratos_variaveis" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."contratos_variaveis";
create trigger aaa_tenant_fill before insert on "crm"."contratos_variaveis" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."contratos_variaveis";
create policy tenant_isolamento on "crm"."contratos_variaveis" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."contratos_variaveis";
create policy tenant_definer on "crm"."contratos_variaveis" for all to app_tenant_definer using (true) with check (true);

-- crm.desmatriculados_colunas  (estava sem RLS)
alter table "crm"."desmatriculados_colunas" add column empresa_id uuid;
update "crm"."desmatriculados_colunas" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."desmatriculados_colunas" alter column empresa_id set not null;
alter table "crm"."desmatriculados_colunas" add constraint tnt_e136c39622_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_e136c39622_idx on "crm"."desmatriculados_colunas" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."desmatriculados_colunas";
create trigger aaa_tenant_fill before insert on "crm"."desmatriculados_colunas" for each row execute function public.app_tenant_fill();
alter table "crm"."desmatriculados_colunas" enable row level security;
drop policy if exists tenant_acesso on "crm"."desmatriculados_colunas";
create policy tenant_acesso on "crm"."desmatriculados_colunas" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."desmatriculados_colunas";
create policy tenant_isolamento on "crm"."desmatriculados_colunas" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."desmatriculados_colunas";
create policy tenant_definer on "crm"."desmatriculados_colunas" for all to app_tenant_definer using (true) with check (true);

-- crm.desmatriculados_kanban  (estava sem RLS)
alter table "crm"."desmatriculados_kanban" add column empresa_id uuid;
update "crm"."desmatriculados_kanban" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."desmatriculados_kanban" alter column empresa_id set not null;
alter table "crm"."desmatriculados_kanban" add constraint tnt_380119de09_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_380119de09_idx on "crm"."desmatriculados_kanban" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."desmatriculados_kanban";
create trigger aaa_tenant_fill before insert on "crm"."desmatriculados_kanban" for each row execute function public.app_tenant_fill();
alter table "crm"."desmatriculados_kanban" enable row level security;
drop policy if exists tenant_acesso on "crm"."desmatriculados_kanban";
create policy tenant_acesso on "crm"."desmatriculados_kanban" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."desmatriculados_kanban";
create policy tenant_isolamento on "crm"."desmatriculados_kanban" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."desmatriculados_kanban";
create policy tenant_definer on "crm"."desmatriculados_kanban" for all to app_tenant_definer using (true) with check (true);

-- crm.desmatriculados_movimentos  (estava sem RLS)
alter table "crm"."desmatriculados_movimentos" add column empresa_id uuid;
update "crm"."desmatriculados_movimentos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."desmatriculados_movimentos" alter column empresa_id set not null;
alter table "crm"."desmatriculados_movimentos" add constraint tnt_37aa4ef300_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_37aa4ef300_idx on "crm"."desmatriculados_movimentos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."desmatriculados_movimentos";
create trigger aaa_tenant_fill before insert on "crm"."desmatriculados_movimentos" for each row execute function public.app_tenant_fill();
alter table "crm"."desmatriculados_movimentos" enable row level security;
drop policy if exists tenant_acesso on "crm"."desmatriculados_movimentos";
create policy tenant_acesso on "crm"."desmatriculados_movimentos" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."desmatriculados_movimentos";
create policy tenant_isolamento on "crm"."desmatriculados_movimentos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."desmatriculados_movimentos";
create policy tenant_definer on "crm"."desmatriculados_movimentos" for all to app_tenant_definer using (true) with check (true);

-- crm.evento_cadernos
alter table "crm"."evento_cadernos" add column empresa_id uuid;
update "crm"."evento_cadernos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."evento_cadernos" alter column empresa_id set not null;
alter table "crm"."evento_cadernos" add constraint tnt_68c6c9bedb_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_68c6c9bedb_idx on "crm"."evento_cadernos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."evento_cadernos";
create trigger aaa_tenant_fill before insert on "crm"."evento_cadernos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."evento_cadernos";
create policy tenant_isolamento on "crm"."evento_cadernos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."evento_cadernos";
create policy tenant_definer on "crm"."evento_cadernos" for all to app_tenant_definer using (true) with check (true);

-- crm.evento_catalogo_itens
alter table "crm"."evento_catalogo_itens" add column empresa_id uuid;
update "crm"."evento_catalogo_itens" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."evento_catalogo_itens" alter column empresa_id set not null;
alter table "crm"."evento_catalogo_itens" add constraint tnt_467adab5ac_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_467adab5ac_idx on "crm"."evento_catalogo_itens" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."evento_catalogo_itens";
create trigger aaa_tenant_fill before insert on "crm"."evento_catalogo_itens" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."evento_catalogo_itens";
create policy tenant_isolamento on "crm"."evento_catalogo_itens" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."evento_catalogo_itens";
create policy tenant_definer on "crm"."evento_catalogo_itens" for all to app_tenant_definer using (true) with check (true);

-- crm.evento_item_midias
alter table "crm"."evento_item_midias" add column empresa_id uuid;
update "crm"."evento_item_midias" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."evento_item_midias" alter column empresa_id set not null;
alter table "crm"."evento_item_midias" add constraint tnt_62074e42c4_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_62074e42c4_idx on "crm"."evento_item_midias" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."evento_item_midias";
create trigger aaa_tenant_fill before insert on "crm"."evento_item_midias" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."evento_item_midias";
create policy tenant_isolamento on "crm"."evento_item_midias" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."evento_item_midias";
create policy tenant_definer on "crm"."evento_item_midias" for all to app_tenant_definer using (true) with check (true);

-- crm.evento_itens
alter table "crm"."evento_itens" add column empresa_id uuid;
update "crm"."evento_itens" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."evento_itens" alter column empresa_id set not null;
alter table "crm"."evento_itens" add constraint tnt_f9a479759b_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_f9a479759b_idx on "crm"."evento_itens" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."evento_itens";
create trigger aaa_tenant_fill before insert on "crm"."evento_itens" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."evento_itens";
create policy tenant_isolamento on "crm"."evento_itens" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."evento_itens";
create policy tenant_definer on "crm"."evento_itens" for all to app_tenant_definer using (true) with check (true);

-- crm.evento_midias
alter table "crm"."evento_midias" add column empresa_id uuid;
update "crm"."evento_midias" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."evento_midias" alter column empresa_id set not null;
alter table "crm"."evento_midias" add constraint tnt_41b5691c75_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_41b5691c75_idx on "crm"."evento_midias" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."evento_midias";
create trigger aaa_tenant_fill before insert on "crm"."evento_midias" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."evento_midias";
create policy tenant_isolamento on "crm"."evento_midias" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."evento_midias";
create policy tenant_definer on "crm"."evento_midias" for all to app_tenant_definer using (true) with check (true);

-- crm.evento_paginas
alter table "crm"."evento_paginas" add column empresa_id uuid;
update "crm"."evento_paginas" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."evento_paginas" alter column empresa_id set not null;
alter table "crm"."evento_paginas" add constraint tnt_56828d72e1_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_56828d72e1_idx on "crm"."evento_paginas" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."evento_paginas";
create trigger aaa_tenant_fill before insert on "crm"."evento_paginas" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."evento_paginas";
create policy tenant_isolamento on "crm"."evento_paginas" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."evento_paginas";
create policy tenant_definer on "crm"."evento_paginas" for all to app_tenant_definer using (true) with check (true);

-- crm.evento_participante_midias
alter table "crm"."evento_participante_midias" add column empresa_id uuid;
update "crm"."evento_participante_midias" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."evento_participante_midias" alter column empresa_id set not null;
alter table "crm"."evento_participante_midias" add constraint tnt_d97bbbfe11_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_d97bbbfe11_idx on "crm"."evento_participante_midias" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."evento_participante_midias";
create trigger aaa_tenant_fill before insert on "crm"."evento_participante_midias" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."evento_participante_midias";
create policy tenant_isolamento on "crm"."evento_participante_midias" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."evento_participante_midias";
create policy tenant_definer on "crm"."evento_participante_midias" for all to app_tenant_definer using (true) with check (true);

-- crm.evento_participantes
alter table "crm"."evento_participantes" add column empresa_id uuid;
update "crm"."evento_participantes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."evento_participantes" alter column empresa_id set not null;
alter table "crm"."evento_participantes" add constraint tnt_9e86752789_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_9e86752789_idx on "crm"."evento_participantes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."evento_participantes";
create trigger aaa_tenant_fill before insert on "crm"."evento_participantes" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."evento_participantes";
create policy tenant_isolamento on "crm"."evento_participantes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."evento_participantes";
create policy tenant_definer on "crm"."evento_participantes" for all to app_tenant_definer using (true) with check (true);

-- crm.evento_tarefas
alter table "crm"."evento_tarefas" add column empresa_id uuid;
update "crm"."evento_tarefas" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."evento_tarefas" alter column empresa_id set not null;
alter table "crm"."evento_tarefas" add constraint tnt_aa7278955d_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_aa7278955d_idx on "crm"."evento_tarefas" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."evento_tarefas";
create trigger aaa_tenant_fill before insert on "crm"."evento_tarefas" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."evento_tarefas";
create policy tenant_isolamento on "crm"."evento_tarefas" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."evento_tarefas";
create policy tenant_definer on "crm"."evento_tarefas" for all to app_tenant_definer using (true) with check (true);

-- crm.eventos
alter table "crm"."eventos" add column empresa_id uuid;
update "crm"."eventos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."eventos" alter column empresa_id set not null;
alter table "crm"."eventos" add constraint tnt_d92dfc0869_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_d92dfc0869_idx on "crm"."eventos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."eventos";
create trigger aaa_tenant_fill before insert on "crm"."eventos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."eventos";
create policy tenant_isolamento on "crm"."eventos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."eventos";
create policy tenant_definer on "crm"."eventos" for all to app_tenant_definer using (true) with check (true);

-- crm.kanban_card_overrides  (estava sem RLS)
alter table "crm"."kanban_card_overrides" add column empresa_id uuid;
update "crm"."kanban_card_overrides" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."kanban_card_overrides" alter column empresa_id set not null;
alter table "crm"."kanban_card_overrides" add constraint tnt_4190481d09_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_4190481d09_idx on "crm"."kanban_card_overrides" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."kanban_card_overrides";
create trigger aaa_tenant_fill before insert on "crm"."kanban_card_overrides" for each row execute function public.app_tenant_fill();
alter table "crm"."kanban_card_overrides" enable row level security;
drop policy if exists tenant_acesso on "crm"."kanban_card_overrides";
create policy tenant_acesso on "crm"."kanban_card_overrides" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."kanban_card_overrides";
create policy tenant_isolamento on "crm"."kanban_card_overrides" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."kanban_card_overrides";
create policy tenant_definer on "crm"."kanban_card_overrides" for all to app_tenant_definer using (true) with check (true);

-- crm.kanban_column_sources  (estava sem RLS)
alter table "crm"."kanban_column_sources" add column empresa_id uuid;
update "crm"."kanban_column_sources" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."kanban_column_sources" alter column empresa_id set not null;
alter table "crm"."kanban_column_sources" add constraint tnt_78017d5d31_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_78017d5d31_idx on "crm"."kanban_column_sources" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."kanban_column_sources";
create trigger aaa_tenant_fill before insert on "crm"."kanban_column_sources" for each row execute function public.app_tenant_fill();
alter table "crm"."kanban_column_sources" enable row level security;
drop policy if exists tenant_acesso on "crm"."kanban_column_sources";
create policy tenant_acesso on "crm"."kanban_column_sources" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."kanban_column_sources";
create policy tenant_isolamento on "crm"."kanban_column_sources" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."kanban_column_sources";
create policy tenant_definer on "crm"."kanban_column_sources" for all to app_tenant_definer using (true) with check (true);

-- crm.kanban_columns  (estava sem RLS)
alter table "crm"."kanban_columns" add column empresa_id uuid;
update "crm"."kanban_columns" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."kanban_columns" alter column empresa_id set not null;
alter table "crm"."kanban_columns" add constraint tnt_2391c9d26d_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_2391c9d26d_idx on "crm"."kanban_columns" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."kanban_columns";
create trigger aaa_tenant_fill before insert on "crm"."kanban_columns" for each row execute function public.app_tenant_fill();
alter table "crm"."kanban_columns" enable row level security;
drop policy if exists tenant_acesso on "crm"."kanban_columns";
create policy tenant_acesso on "crm"."kanban_columns" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."kanban_columns";
create policy tenant_isolamento on "crm"."kanban_columns" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."kanban_columns";
create policy tenant_definer on "crm"."kanban_columns" for all to app_tenant_definer using (true) with check (true);

-- crm.kanban_pages  (estava sem RLS)
alter table "crm"."kanban_pages" add column empresa_id uuid;
update "crm"."kanban_pages" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."kanban_pages" alter column empresa_id set not null;
alter table "crm"."kanban_pages" add constraint tnt_ec74ee23d2_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_ec74ee23d2_idx on "crm"."kanban_pages" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."kanban_pages";
create trigger aaa_tenant_fill before insert on "crm"."kanban_pages" for each row execute function public.app_tenant_fill();
alter table "crm"."kanban_pages" enable row level security;
drop policy if exists tenant_acesso on "crm"."kanban_pages";
create policy tenant_acesso on "crm"."kanban_pages" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."kanban_pages";
create policy tenant_isolamento on "crm"."kanban_pages" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."kanban_pages";
create policy tenant_definer on "crm"."kanban_pages" for all to app_tenant_definer using (true) with check (true);

-- crm.lead_ai_analises
alter table "crm"."lead_ai_analises" add column empresa_id uuid;
update "crm"."lead_ai_analises" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."lead_ai_analises" alter column empresa_id set not null;
alter table "crm"."lead_ai_analises" add constraint tnt_d59cbfa76e_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_d59cbfa76e_idx on "crm"."lead_ai_analises" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."lead_ai_analises";
create trigger aaa_tenant_fill before insert on "crm"."lead_ai_analises" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."lead_ai_analises";
create policy tenant_isolamento on "crm"."lead_ai_analises" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."lead_ai_analises";
create policy tenant_definer on "crm"."lead_ai_analises" for all to app_tenant_definer using (true) with check (true);

-- crm.lead_ai_chat_messages
alter table "crm"."lead_ai_chat_messages" add column empresa_id uuid;
update "crm"."lead_ai_chat_messages" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."lead_ai_chat_messages" alter column empresa_id set not null;
alter table "crm"."lead_ai_chat_messages" add constraint tnt_93db82d70a_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_93db82d70a_idx on "crm"."lead_ai_chat_messages" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."lead_ai_chat_messages";
create trigger aaa_tenant_fill before insert on "crm"."lead_ai_chat_messages" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."lead_ai_chat_messages";
create policy tenant_isolamento on "crm"."lead_ai_chat_messages" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."lead_ai_chat_messages";
create policy tenant_definer on "crm"."lead_ai_chat_messages" for all to app_tenant_definer using (true) with check (true);

-- crm.lead_ai_knowledge_chunks
alter table "crm"."lead_ai_knowledge_chunks" add column empresa_id uuid;
update "crm"."lead_ai_knowledge_chunks" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."lead_ai_knowledge_chunks" alter column empresa_id set not null;
alter table "crm"."lead_ai_knowledge_chunks" add constraint tnt_529f3794f3_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_529f3794f3_idx on "crm"."lead_ai_knowledge_chunks" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."lead_ai_knowledge_chunks";
create trigger aaa_tenant_fill before insert on "crm"."lead_ai_knowledge_chunks" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."lead_ai_knowledge_chunks";
create policy tenant_isolamento on "crm"."lead_ai_knowledge_chunks" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."lead_ai_knowledge_chunks";
create policy tenant_definer on "crm"."lead_ai_knowledge_chunks" for all to app_tenant_definer using (true) with check (true);

-- crm.lead_ai_knowledge_meta
alter table "crm"."lead_ai_knowledge_meta" add column empresa_id uuid;
update "crm"."lead_ai_knowledge_meta" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."lead_ai_knowledge_meta" alter column empresa_id set not null;
alter table "crm"."lead_ai_knowledge_meta" add constraint tnt_f66a13c9b3_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_f66a13c9b3_idx on "crm"."lead_ai_knowledge_meta" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."lead_ai_knowledge_meta";
create trigger aaa_tenant_fill before insert on "crm"."lead_ai_knowledge_meta" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."lead_ai_knowledge_meta";
create policy tenant_isolamento on "crm"."lead_ai_knowledge_meta" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."lead_ai_knowledge_meta";
create policy tenant_definer on "crm"."lead_ai_knowledge_meta" for all to app_tenant_definer using (true) with check (true);

-- crm.lead_ai_renders
alter table "crm"."lead_ai_renders" add column empresa_id uuid;
update "crm"."lead_ai_renders" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."lead_ai_renders" alter column empresa_id set not null;
alter table "crm"."lead_ai_renders" add constraint tnt_494c69e1e7_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_494c69e1e7_idx on "crm"."lead_ai_renders" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."lead_ai_renders";
create trigger aaa_tenant_fill before insert on "crm"."lead_ai_renders" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."lead_ai_renders";
create policy tenant_isolamento on "crm"."lead_ai_renders" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."lead_ai_renders";
create policy tenant_definer on "crm"."lead_ai_renders" for all to app_tenant_definer using (true) with check (true);

-- crm.lead_custom_field_definitions
alter table "crm"."lead_custom_field_definitions" add column empresa_id uuid;
update "crm"."lead_custom_field_definitions" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."lead_custom_field_definitions" alter column empresa_id set not null;
alter table "crm"."lead_custom_field_definitions" add constraint tnt_b130db6e54_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_b130db6e54_idx on "crm"."lead_custom_field_definitions" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."lead_custom_field_definitions";
create trigger aaa_tenant_fill before insert on "crm"."lead_custom_field_definitions" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."lead_custom_field_definitions";
create policy tenant_isolamento on "crm"."lead_custom_field_definitions" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."lead_custom_field_definitions";
create policy tenant_definer on "crm"."lead_custom_field_definitions" for all to app_tenant_definer using (true) with check (true);

-- crm.lead_custom_field_values
alter table "crm"."lead_custom_field_values" add column empresa_id uuid;
update "crm"."lead_custom_field_values" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."lead_custom_field_values" alter column empresa_id set not null;
alter table "crm"."lead_custom_field_values" add constraint tnt_373eaeb33e_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_373eaeb33e_idx on "crm"."lead_custom_field_values" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."lead_custom_field_values";
create trigger aaa_tenant_fill before insert on "crm"."lead_custom_field_values" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."lead_custom_field_values";
create policy tenant_isolamento on "crm"."lead_custom_field_values" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."lead_custom_field_values";
create policy tenant_definer on "crm"."lead_custom_field_values" for all to app_tenant_definer using (true) with check (true);

-- crm.lead_lembretes
alter table "crm"."lead_lembretes" add column empresa_id uuid;
update "crm"."lead_lembretes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."lead_lembretes" alter column empresa_id set not null;
alter table "crm"."lead_lembretes" add constraint tnt_896f291601_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_896f291601_idx on "crm"."lead_lembretes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."lead_lembretes";
create trigger aaa_tenant_fill before insert on "crm"."lead_lembretes" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."lead_lembretes";
create policy tenant_isolamento on "crm"."lead_lembretes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."lead_lembretes";
create policy tenant_definer on "crm"."lead_lembretes" for all to app_tenant_definer using (true) with check (true);

-- crm.lead_negociacoes
alter table "crm"."lead_negociacoes" add column empresa_id uuid;
update "crm"."lead_negociacoes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."lead_negociacoes" alter column empresa_id set not null;
alter table "crm"."lead_negociacoes" add constraint tnt_09f30f23c2_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_09f30f23c2_idx on "crm"."lead_negociacoes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."lead_negociacoes";
create trigger aaa_tenant_fill before insert on "crm"."lead_negociacoes" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."lead_negociacoes";
create policy tenant_isolamento on "crm"."lead_negociacoes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."lead_negociacoes";
create policy tenant_definer on "crm"."lead_negociacoes" for all to app_tenant_definer using (true) with check (true);

-- crm.lead_negociador_config
alter table "crm"."lead_negociador_config" add column empresa_id uuid;
update "crm"."lead_negociador_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."lead_negociador_config" alter column empresa_id set not null;
alter table "crm"."lead_negociador_config" add constraint tnt_367a510bbe_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_367a510bbe_idx on "crm"."lead_negociador_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."lead_negociador_config";
create trigger aaa_tenant_fill before insert on "crm"."lead_negociador_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."lead_negociador_config";
create policy tenant_isolamento on "crm"."lead_negociador_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."lead_negociador_config";
create policy tenant_definer on "crm"."lead_negociador_config" for all to app_tenant_definer using (true) with check (true);

-- crm.lead_origins  (estava sem RLS)
alter table "crm"."lead_origins" add column empresa_id uuid;
update "crm"."lead_origins" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."lead_origins" alter column empresa_id set not null;
alter table "crm"."lead_origins" add constraint tnt_53cbef7dca_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_53cbef7dca_idx on "crm"."lead_origins" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."lead_origins";
create trigger aaa_tenant_fill before insert on "crm"."lead_origins" for each row execute function public.app_tenant_fill();
alter table "crm"."lead_origins" enable row level security;
drop policy if exists tenant_acesso on "crm"."lead_origins";
create policy tenant_acesso on "crm"."lead_origins" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."lead_origins";
create policy tenant_isolamento on "crm"."lead_origins" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."lead_origins";
create policy tenant_definer on "crm"."lead_origins" for all to app_tenant_definer using (true) with check (true);

-- crm.lead_photo_checklists
alter table "crm"."lead_photo_checklists" add column empresa_id uuid;
update "crm"."lead_photo_checklists" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."lead_photo_checklists" alter column empresa_id set not null;
alter table "crm"."lead_photo_checklists" add constraint tnt_58b3c43303_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_58b3c43303_idx on "crm"."lead_photo_checklists" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."lead_photo_checklists";
create trigger aaa_tenant_fill before insert on "crm"."lead_photo_checklists" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."lead_photo_checklists";
create policy tenant_isolamento on "crm"."lead_photo_checklists" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."lead_photo_checklists";
create policy tenant_definer on "crm"."lead_photo_checklists" for all to app_tenant_definer using (true) with check (true);

-- crm.lead_pipeline_movimentos
alter table "crm"."lead_pipeline_movimentos" add column empresa_id uuid;
update "crm"."lead_pipeline_movimentos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."lead_pipeline_movimentos" alter column empresa_id set not null;
alter table "crm"."lead_pipeline_movimentos" add constraint tnt_3d8f449b64_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_3d8f449b64_idx on "crm"."lead_pipeline_movimentos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."lead_pipeline_movimentos";
create trigger aaa_tenant_fill before insert on "crm"."lead_pipeline_movimentos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."lead_pipeline_movimentos";
create policy tenant_isolamento on "crm"."lead_pipeline_movimentos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."lead_pipeline_movimentos";
create policy tenant_definer on "crm"."lead_pipeline_movimentos" for all to app_tenant_definer using (true) with check (true);

-- crm.lead_prestador_permissoes  (estava sem RLS)
alter table "crm"."lead_prestador_permissoes" add column empresa_id uuid;
update "crm"."lead_prestador_permissoes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."lead_prestador_permissoes" alter column empresa_id set not null;
alter table "crm"."lead_prestador_permissoes" add constraint tnt_1cdc856a59_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_1cdc856a59_idx on "crm"."lead_prestador_permissoes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."lead_prestador_permissoes";
create trigger aaa_tenant_fill before insert on "crm"."lead_prestador_permissoes" for each row execute function public.app_tenant_fill();
alter table "crm"."lead_prestador_permissoes" enable row level security;
drop policy if exists tenant_acesso on "crm"."lead_prestador_permissoes";
create policy tenant_acesso on "crm"."lead_prestador_permissoes" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."lead_prestador_permissoes";
create policy tenant_isolamento on "crm"."lead_prestador_permissoes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."lead_prestador_permissoes";
create policy tenant_definer on "crm"."lead_prestador_permissoes" for all to app_tenant_definer using (true) with check (true);

-- crm.lead_projeto_chat_leituras
alter table "crm"."lead_projeto_chat_leituras" add column empresa_id uuid;
update "crm"."lead_projeto_chat_leituras" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."lead_projeto_chat_leituras" alter column empresa_id set not null;
alter table "crm"."lead_projeto_chat_leituras" add constraint tnt_2bde03ba09_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_2bde03ba09_idx on "crm"."lead_projeto_chat_leituras" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."lead_projeto_chat_leituras";
create trigger aaa_tenant_fill before insert on "crm"."lead_projeto_chat_leituras" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."lead_projeto_chat_leituras";
create policy tenant_isolamento on "crm"."lead_projeto_chat_leituras" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."lead_projeto_chat_leituras";
create policy tenant_definer on "crm"."lead_projeto_chat_leituras" for all to app_tenant_definer using (true) with check (true);

-- crm.lead_projeto_notas
alter table "crm"."lead_projeto_notas" add column empresa_id uuid;
update "crm"."lead_projeto_notas" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."lead_projeto_notas" alter column empresa_id set not null;
alter table "crm"."lead_projeto_notas" add constraint tnt_6deeaf7ca9_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_6deeaf7ca9_idx on "crm"."lead_projeto_notas" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."lead_projeto_notas";
create trigger aaa_tenant_fill before insert on "crm"."lead_projeto_notas" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."lead_projeto_notas";
create policy tenant_isolamento on "crm"."lead_projeto_notas" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."lead_projeto_notas";
create policy tenant_definer on "crm"."lead_projeto_notas" for all to app_tenant_definer using (true) with check (true);

-- crm.lead_projetos
alter table "crm"."lead_projetos" add column empresa_id uuid;
update "crm"."lead_projetos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."lead_projetos" alter column empresa_id set not null;
alter table "crm"."lead_projetos" add constraint tnt_6bf6a01bb3_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_6bf6a01bb3_idx on "crm"."lead_projetos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."lead_projetos";
create trigger aaa_tenant_fill before insert on "crm"."lead_projetos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."lead_projetos";
create policy tenant_isolamento on "crm"."lead_projetos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."lead_projetos";
create policy tenant_definer on "crm"."lead_projetos" for all to app_tenant_definer using (true) with check (true);

-- crm.lead_sinalizacoes
alter table "crm"."lead_sinalizacoes" add column empresa_id uuid;
update "crm"."lead_sinalizacoes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."lead_sinalizacoes" alter column empresa_id set not null;
alter table "crm"."lead_sinalizacoes" add constraint tnt_3e8c391090_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_3e8c391090_idx on "crm"."lead_sinalizacoes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."lead_sinalizacoes";
create trigger aaa_tenant_fill before insert on "crm"."lead_sinalizacoes" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."lead_sinalizacoes";
create policy tenant_isolamento on "crm"."lead_sinalizacoes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."lead_sinalizacoes";
create policy tenant_definer on "crm"."lead_sinalizacoes" for all to app_tenant_definer using (true) with check (true);

-- crm.lead_whiteboard_drawings
alter table "crm"."lead_whiteboard_drawings" add column empresa_id uuid;
update "crm"."lead_whiteboard_drawings" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."lead_whiteboard_drawings" alter column empresa_id set not null;
alter table "crm"."lead_whiteboard_drawings" add constraint tnt_114e9ad3e3_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_114e9ad3e3_idx on "crm"."lead_whiteboard_drawings" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."lead_whiteboard_drawings";
create trigger aaa_tenant_fill before insert on "crm"."lead_whiteboard_drawings" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."lead_whiteboard_drawings";
create policy tenant_isolamento on "crm"."lead_whiteboard_drawings" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."lead_whiteboard_drawings";
create policy tenant_definer on "crm"."lead_whiteboard_drawings" for all to app_tenant_definer using (true) with check (true);

-- crm.lead_whiteboard_images
alter table "crm"."lead_whiteboard_images" add column empresa_id uuid;
update "crm"."lead_whiteboard_images" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."lead_whiteboard_images" alter column empresa_id set not null;
alter table "crm"."lead_whiteboard_images" add constraint tnt_e393a73076_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_e393a73076_idx on "crm"."lead_whiteboard_images" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."lead_whiteboard_images";
create trigger aaa_tenant_fill before insert on "crm"."lead_whiteboard_images" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."lead_whiteboard_images";
create policy tenant_isolamento on "crm"."lead_whiteboard_images" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."lead_whiteboard_images";
create policy tenant_definer on "crm"."lead_whiteboard_images" for all to app_tenant_definer using (true) with check (true);

-- crm.lead_whiteboard_text_config
alter table "crm"."lead_whiteboard_text_config" add column empresa_id uuid;
update "crm"."lead_whiteboard_text_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."lead_whiteboard_text_config" alter column empresa_id set not null;
alter table "crm"."lead_whiteboard_text_config" add constraint tnt_2aa3908bb9_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_2aa3908bb9_idx on "crm"."lead_whiteboard_text_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."lead_whiteboard_text_config";
create trigger aaa_tenant_fill before insert on "crm"."lead_whiteboard_text_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."lead_whiteboard_text_config";
create policy tenant_isolamento on "crm"."lead_whiteboard_text_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."lead_whiteboard_text_config";
create policy tenant_definer on "crm"."lead_whiteboard_text_config" for all to app_tenant_definer using (true) with check (true);

-- crm.leads
alter table "crm"."leads" add column empresa_id uuid;
update "crm"."leads" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."leads" alter column empresa_id set not null;
alter table "crm"."leads" add constraint tnt_035bd3cf32_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_035bd3cf32_idx on "crm"."leads" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."leads";
create trigger aaa_tenant_fill before insert on "crm"."leads" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."leads";
create policy tenant_isolamento on "crm"."leads" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."leads";
create policy tenant_definer on "crm"."leads" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_ai_agents
alter table "crm"."marketing_ai_agents" add column empresa_id uuid;
update "crm"."marketing_ai_agents" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_ai_agents" alter column empresa_id set not null;
alter table "crm"."marketing_ai_agents" add constraint tnt_9701dab234_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_9701dab234_idx on "crm"."marketing_ai_agents" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_ai_agents";
create trigger aaa_tenant_fill before insert on "crm"."marketing_ai_agents" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."marketing_ai_agents";
create policy tenant_isolamento on "crm"."marketing_ai_agents" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_ai_agents";
create policy tenant_definer on "crm"."marketing_ai_agents" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_ai_personalities
alter table "crm"."marketing_ai_personalities" add column empresa_id uuid;
update "crm"."marketing_ai_personalities" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_ai_personalities" alter column empresa_id set not null;
alter table "crm"."marketing_ai_personalities" add constraint tnt_f36b22a9f6_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_f36b22a9f6_idx on "crm"."marketing_ai_personalities" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_ai_personalities";
create trigger aaa_tenant_fill before insert on "crm"."marketing_ai_personalities" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."marketing_ai_personalities";
create policy tenant_isolamento on "crm"."marketing_ai_personalities" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_ai_personalities";
create policy tenant_definer on "crm"."marketing_ai_personalities" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_ai_studio_config
alter table "crm"."marketing_ai_studio_config" add column empresa_id uuid;
update "crm"."marketing_ai_studio_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_ai_studio_config" alter column empresa_id set not null;
alter table "crm"."marketing_ai_studio_config" add constraint tnt_ef242bb6aa_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_ef242bb6aa_idx on "crm"."marketing_ai_studio_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_ai_studio_config";
create trigger aaa_tenant_fill before insert on "crm"."marketing_ai_studio_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."marketing_ai_studio_config";
create policy tenant_isolamento on "crm"."marketing_ai_studio_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_ai_studio_config";
create policy tenant_definer on "crm"."marketing_ai_studio_config" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_ai_studio_secrets
alter table "crm"."marketing_ai_studio_secrets" add column empresa_id uuid;
update "crm"."marketing_ai_studio_secrets" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_ai_studio_secrets" alter column empresa_id set not null;
alter table "crm"."marketing_ai_studio_secrets" add constraint tnt_c1825c0b46_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_c1825c0b46_idx on "crm"."marketing_ai_studio_secrets" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_ai_studio_secrets";
create trigger aaa_tenant_fill before insert on "crm"."marketing_ai_studio_secrets" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."marketing_ai_studio_secrets";
create policy tenant_isolamento on "crm"."marketing_ai_studio_secrets" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_ai_studio_secrets";
create policy tenant_definer on "crm"."marketing_ai_studio_secrets" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_ai_webhook_config  (estava sem RLS)
alter table "crm"."marketing_ai_webhook_config" add column empresa_id uuid;
update "crm"."marketing_ai_webhook_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_ai_webhook_config" alter column empresa_id set not null;
alter table "crm"."marketing_ai_webhook_config" add constraint tnt_6250fda8c2_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_6250fda8c2_idx on "crm"."marketing_ai_webhook_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_ai_webhook_config";
create trigger aaa_tenant_fill before insert on "crm"."marketing_ai_webhook_config" for each row execute function public.app_tenant_fill();
alter table "crm"."marketing_ai_webhook_config" enable row level security;
drop policy if exists tenant_acesso on "crm"."marketing_ai_webhook_config";
create policy tenant_acesso on "crm"."marketing_ai_webhook_config" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."marketing_ai_webhook_config";
create policy tenant_isolamento on "crm"."marketing_ai_webhook_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_ai_webhook_config";
create policy tenant_definer on "crm"."marketing_ai_webhook_config" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_approval_notifications  (estava sem RLS)
alter table "crm"."marketing_approval_notifications" add column empresa_id uuid;
update "crm"."marketing_approval_notifications" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_approval_notifications" alter column empresa_id set not null;
alter table "crm"."marketing_approval_notifications" add constraint tnt_153b1743af_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_153b1743af_idx on "crm"."marketing_approval_notifications" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_approval_notifications";
create trigger aaa_tenant_fill before insert on "crm"."marketing_approval_notifications" for each row execute function public.app_tenant_fill();
alter table "crm"."marketing_approval_notifications" enable row level security;
drop policy if exists tenant_acesso on "crm"."marketing_approval_notifications";
create policy tenant_acesso on "crm"."marketing_approval_notifications" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."marketing_approval_notifications";
create policy tenant_isolamento on "crm"."marketing_approval_notifications" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_approval_notifications";
create policy tenant_definer on "crm"."marketing_approval_notifications" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_board_templates  (estava sem RLS)
alter table "crm"."marketing_board_templates" add column empresa_id uuid;
update "crm"."marketing_board_templates" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_board_templates" alter column empresa_id set not null;
alter table "crm"."marketing_board_templates" add constraint tnt_fd0b58fe00_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_fd0b58fe00_idx on "crm"."marketing_board_templates" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_board_templates";
create trigger aaa_tenant_fill before insert on "crm"."marketing_board_templates" for each row execute function public.app_tenant_fill();
alter table "crm"."marketing_board_templates" enable row level security;
drop policy if exists tenant_acesso on "crm"."marketing_board_templates";
create policy tenant_acesso on "crm"."marketing_board_templates" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."marketing_board_templates";
create policy tenant_isolamento on "crm"."marketing_board_templates" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_board_templates";
create policy tenant_definer on "crm"."marketing_board_templates" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_central_planning  (estava sem RLS)
alter table "crm"."marketing_central_planning" add column empresa_id uuid;
update "crm"."marketing_central_planning" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_central_planning" alter column empresa_id set not null;
alter table "crm"."marketing_central_planning" add constraint tnt_f4c17d150b_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_f4c17d150b_idx on "crm"."marketing_central_planning" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_central_planning";
create trigger aaa_tenant_fill before insert on "crm"."marketing_central_planning" for each row execute function public.app_tenant_fill();
alter table "crm"."marketing_central_planning" enable row level security;
drop policy if exists tenant_acesso on "crm"."marketing_central_planning";
create policy tenant_acesso on "crm"."marketing_central_planning" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."marketing_central_planning";
create policy tenant_isolamento on "crm"."marketing_central_planning" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_central_planning";
create policy tenant_definer on "crm"."marketing_central_planning" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_columns  (estava sem RLS)
alter table "crm"."marketing_columns" add column empresa_id uuid;
update "crm"."marketing_columns" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_columns" alter column empresa_id set not null;
alter table "crm"."marketing_columns" add constraint tnt_8f688e63de_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_8f688e63de_idx on "crm"."marketing_columns" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_columns";
create trigger aaa_tenant_fill before insert on "crm"."marketing_columns" for each row execute function public.app_tenant_fill();
alter table "crm"."marketing_columns" enable row level security;
drop policy if exists tenant_acesso on "crm"."marketing_columns";
create policy tenant_acesso on "crm"."marketing_columns" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."marketing_columns";
create policy tenant_isolamento on "crm"."marketing_columns" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_columns";
create policy tenant_definer on "crm"."marketing_columns" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_content_cards  (estava sem RLS)
alter table "crm"."marketing_content_cards" add column empresa_id uuid;
update "crm"."marketing_content_cards" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_content_cards" alter column empresa_id set not null;
alter table "crm"."marketing_content_cards" add constraint tnt_b64b3a0538_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_b64b3a0538_idx on "crm"."marketing_content_cards" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_content_cards";
create trigger aaa_tenant_fill before insert on "crm"."marketing_content_cards" for each row execute function public.app_tenant_fill();
alter table "crm"."marketing_content_cards" enable row level security;
drop policy if exists tenant_acesso on "crm"."marketing_content_cards";
create policy tenant_acesso on "crm"."marketing_content_cards" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."marketing_content_cards";
create policy tenant_isolamento on "crm"."marketing_content_cards" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_content_cards";
create policy tenant_definer on "crm"."marketing_content_cards" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_funnel_stages  (estava sem RLS)
alter table "crm"."marketing_funnel_stages" add column empresa_id uuid;
update "crm"."marketing_funnel_stages" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_funnel_stages" alter column empresa_id set not null;
alter table "crm"."marketing_funnel_stages" add constraint tnt_7e303b4aaa_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_7e303b4aaa_idx on "crm"."marketing_funnel_stages" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_funnel_stages";
create trigger aaa_tenant_fill before insert on "crm"."marketing_funnel_stages" for each row execute function public.app_tenant_fill();
alter table "crm"."marketing_funnel_stages" enable row level security;
drop policy if exists tenant_acesso on "crm"."marketing_funnel_stages";
create policy tenant_acesso on "crm"."marketing_funnel_stages" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."marketing_funnel_stages";
create policy tenant_isolamento on "crm"."marketing_funnel_stages" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_funnel_stages";
create policy tenant_definer on "crm"."marketing_funnel_stages" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_media_folders  (estava sem RLS)
alter table "crm"."marketing_media_folders" add column empresa_id uuid;
update "crm"."marketing_media_folders" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_media_folders" alter column empresa_id set not null;
alter table "crm"."marketing_media_folders" add constraint tnt_a4c780bf33_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_a4c780bf33_idx on "crm"."marketing_media_folders" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_media_folders";
create trigger aaa_tenant_fill before insert on "crm"."marketing_media_folders" for each row execute function public.app_tenant_fill();
alter table "crm"."marketing_media_folders" enable row level security;
drop policy if exists tenant_acesso on "crm"."marketing_media_folders";
create policy tenant_acesso on "crm"."marketing_media_folders" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."marketing_media_folders";
create policy tenant_isolamento on "crm"."marketing_media_folders" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_media_folders";
create policy tenant_definer on "crm"."marketing_media_folders" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_medias  (estava sem RLS)
alter table "crm"."marketing_medias" add column empresa_id uuid;
update "crm"."marketing_medias" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_medias" alter column empresa_id set not null;
alter table "crm"."marketing_medias" add constraint tnt_c832bc86fe_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_c832bc86fe_idx on "crm"."marketing_medias" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_medias";
create trigger aaa_tenant_fill before insert on "crm"."marketing_medias" for each row execute function public.app_tenant_fill();
alter table "crm"."marketing_medias" enable row level security;
drop policy if exists tenant_acesso on "crm"."marketing_medias";
create policy tenant_acesso on "crm"."marketing_medias" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."marketing_medias";
create policy tenant_isolamento on "crm"."marketing_medias" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_medias";
create policy tenant_definer on "crm"."marketing_medias" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_planning_drawings  (estava sem RLS)
alter table "crm"."marketing_planning_drawings" add column empresa_id uuid;
update "crm"."marketing_planning_drawings" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_planning_drawings" alter column empresa_id set not null;
alter table "crm"."marketing_planning_drawings" add constraint tnt_7d5c4ae940_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_7d5c4ae940_idx on "crm"."marketing_planning_drawings" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_planning_drawings";
create trigger aaa_tenant_fill before insert on "crm"."marketing_planning_drawings" for each row execute function public.app_tenant_fill();
alter table "crm"."marketing_planning_drawings" enable row level security;
drop policy if exists tenant_acesso on "crm"."marketing_planning_drawings";
create policy tenant_acesso on "crm"."marketing_planning_drawings" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."marketing_planning_drawings";
create policy tenant_isolamento on "crm"."marketing_planning_drawings" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_planning_drawings";
create policy tenant_definer on "crm"."marketing_planning_drawings" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_planning_edges  (estava sem RLS)
alter table "crm"."marketing_planning_edges" add column empresa_id uuid;
update "crm"."marketing_planning_edges" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_planning_edges" alter column empresa_id set not null;
alter table "crm"."marketing_planning_edges" add constraint tnt_bf4d305eb6_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_bf4d305eb6_idx on "crm"."marketing_planning_edges" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_planning_edges";
create trigger aaa_tenant_fill before insert on "crm"."marketing_planning_edges" for each row execute function public.app_tenant_fill();
alter table "crm"."marketing_planning_edges" enable row level security;
drop policy if exists tenant_acesso on "crm"."marketing_planning_edges";
create policy tenant_acesso on "crm"."marketing_planning_edges" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."marketing_planning_edges";
create policy tenant_isolamento on "crm"."marketing_planning_edges" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_planning_edges";
create policy tenant_definer on "crm"."marketing_planning_edges" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_planning_files  (estava sem RLS)
alter table "crm"."marketing_planning_files" add column empresa_id uuid;
update "crm"."marketing_planning_files" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_planning_files" alter column empresa_id set not null;
alter table "crm"."marketing_planning_files" add constraint tnt_c9f10d803b_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_c9f10d803b_idx on "crm"."marketing_planning_files" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_planning_files";
create trigger aaa_tenant_fill before insert on "crm"."marketing_planning_files" for each row execute function public.app_tenant_fill();
alter table "crm"."marketing_planning_files" enable row level security;
drop policy if exists tenant_acesso on "crm"."marketing_planning_files";
create policy tenant_acesso on "crm"."marketing_planning_files" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."marketing_planning_files";
create policy tenant_isolamento on "crm"."marketing_planning_files" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_planning_files";
create policy tenant_definer on "crm"."marketing_planning_files" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_planning_nodes  (estava sem RLS)
alter table "crm"."marketing_planning_nodes" add column empresa_id uuid;
update "crm"."marketing_planning_nodes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_planning_nodes" alter column empresa_id set not null;
alter table "crm"."marketing_planning_nodes" add constraint tnt_e986a1a4d5_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_e986a1a4d5_idx on "crm"."marketing_planning_nodes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_planning_nodes";
create trigger aaa_tenant_fill before insert on "crm"."marketing_planning_nodes" for each row execute function public.app_tenant_fill();
alter table "crm"."marketing_planning_nodes" enable row level security;
drop policy if exists tenant_acesso on "crm"."marketing_planning_nodes";
create policy tenant_acesso on "crm"."marketing_planning_nodes" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."marketing_planning_nodes";
create policy tenant_isolamento on "crm"."marketing_planning_nodes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_planning_nodes";
create policy tenant_definer on "crm"."marketing_planning_nodes" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_planning_shapes  (estava sem RLS)
alter table "crm"."marketing_planning_shapes" add column empresa_id uuid;
update "crm"."marketing_planning_shapes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_planning_shapes" alter column empresa_id set not null;
alter table "crm"."marketing_planning_shapes" add constraint tnt_7d541becb4_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_7d541becb4_idx on "crm"."marketing_planning_shapes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_planning_shapes";
create trigger aaa_tenant_fill before insert on "crm"."marketing_planning_shapes" for each row execute function public.app_tenant_fill();
alter table "crm"."marketing_planning_shapes" enable row level security;
drop policy if exists tenant_acesso on "crm"."marketing_planning_shapes";
create policy tenant_acesso on "crm"."marketing_planning_shapes" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."marketing_planning_shapes";
create policy tenant_isolamento on "crm"."marketing_planning_shapes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_planning_shapes";
create policy tenant_definer on "crm"."marketing_planning_shapes" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_products  (estava sem RLS)
alter table "crm"."marketing_products" add column empresa_id uuid;
update "crm"."marketing_products" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_products" alter column empresa_id set not null;
alter table "crm"."marketing_products" add constraint tnt_c16235673f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_c16235673f_idx on "crm"."marketing_products" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_products";
create trigger aaa_tenant_fill before insert on "crm"."marketing_products" for each row execute function public.app_tenant_fill();
alter table "crm"."marketing_products" enable row level security;
drop policy if exists tenant_acesso on "crm"."marketing_products";
create policy tenant_acesso on "crm"."marketing_products" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."marketing_products";
create policy tenant_isolamento on "crm"."marketing_products" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_products";
create policy tenant_definer on "crm"."marketing_products" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_tasks  (estava sem RLS)
alter table "crm"."marketing_tasks" add column empresa_id uuid;
update "crm"."marketing_tasks" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_tasks" alter column empresa_id set not null;
alter table "crm"."marketing_tasks" add constraint tnt_b13a02c287_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_b13a02c287_idx on "crm"."marketing_tasks" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_tasks";
create trigger aaa_tenant_fill before insert on "crm"."marketing_tasks" for each row execute function public.app_tenant_fill();
alter table "crm"."marketing_tasks" enable row level security;
drop policy if exists tenant_acesso on "crm"."marketing_tasks";
create policy tenant_acesso on "crm"."marketing_tasks" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."marketing_tasks";
create policy tenant_isolamento on "crm"."marketing_tasks" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_tasks";
create policy tenant_definer on "crm"."marketing_tasks" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_traffic_sources  (estava sem RLS)
alter table "crm"."marketing_traffic_sources" add column empresa_id uuid;
update "crm"."marketing_traffic_sources" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_traffic_sources" alter column empresa_id set not null;
alter table "crm"."marketing_traffic_sources" add constraint tnt_09746660db_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_09746660db_idx on "crm"."marketing_traffic_sources" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_traffic_sources";
create trigger aaa_tenant_fill before insert on "crm"."marketing_traffic_sources" for each row execute function public.app_tenant_fill();
alter table "crm"."marketing_traffic_sources" enable row level security;
drop policy if exists tenant_acesso on "crm"."marketing_traffic_sources";
create policy tenant_acesso on "crm"."marketing_traffic_sources" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."marketing_traffic_sources";
create policy tenant_isolamento on "crm"."marketing_traffic_sources" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_traffic_sources";
create policy tenant_definer on "crm"."marketing_traffic_sources" for all to app_tenant_definer using (true) with check (true);

-- crm.marketing_ugc_webhook_config  (estava sem RLS)
alter table "crm"."marketing_ugc_webhook_config" add column empresa_id uuid;
update "crm"."marketing_ugc_webhook_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."marketing_ugc_webhook_config" alter column empresa_id set not null;
alter table "crm"."marketing_ugc_webhook_config" add constraint tnt_eb4dbc78b4_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_eb4dbc78b4_idx on "crm"."marketing_ugc_webhook_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."marketing_ugc_webhook_config";
create trigger aaa_tenant_fill before insert on "crm"."marketing_ugc_webhook_config" for each row execute function public.app_tenant_fill();
alter table "crm"."marketing_ugc_webhook_config" enable row level security;
drop policy if exists tenant_acesso on "crm"."marketing_ugc_webhook_config";
create policy tenant_acesso on "crm"."marketing_ugc_webhook_config" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."marketing_ugc_webhook_config";
create policy tenant_isolamento on "crm"."marketing_ugc_webhook_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."marketing_ugc_webhook_config";
create policy tenant_definer on "crm"."marketing_ugc_webhook_config" for all to app_tenant_definer using (true) with check (true);

-- crm.markup_categorias
alter table "crm"."markup_categorias" add column empresa_id uuid;
update "crm"."markup_categorias" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."markup_categorias" alter column empresa_id set not null;
alter table "crm"."markup_categorias" add constraint tnt_5a5e945335_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_5a5e945335_idx on "crm"."markup_categorias" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."markup_categorias";
create trigger aaa_tenant_fill before insert on "crm"."markup_categorias" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."markup_categorias";
create policy tenant_isolamento on "crm"."markup_categorias" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."markup_categorias";
create policy tenant_definer on "crm"."markup_categorias" for all to app_tenant_definer using (true) with check (true);

-- crm.markup_config
alter table "crm"."markup_config" add column empresa_id uuid;
update "crm"."markup_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."markup_config" alter column empresa_id set not null;
alter table "crm"."markup_config" add constraint tnt_4e28137b93_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_4e28137b93_idx on "crm"."markup_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."markup_config";
create trigger aaa_tenant_fill before insert on "crm"."markup_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."markup_config";
create policy tenant_isolamento on "crm"."markup_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."markup_config";
create policy tenant_definer on "crm"."markup_config" for all to app_tenant_definer using (true) with check (true);

-- crm.markup_despesa_templates
alter table "crm"."markup_despesa_templates" add column empresa_id uuid;
update "crm"."markup_despesa_templates" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."markup_despesa_templates" alter column empresa_id set not null;
alter table "crm"."markup_despesa_templates" add constraint tnt_83d4226eed_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_83d4226eed_idx on "crm"."markup_despesa_templates" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."markup_despesa_templates";
create trigger aaa_tenant_fill before insert on "crm"."markup_despesa_templates" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."markup_despesa_templates";
create policy tenant_isolamento on "crm"."markup_despesa_templates" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."markup_despesa_templates";
create policy tenant_definer on "crm"."markup_despesa_templates" for all to app_tenant_definer using (true) with check (true);

-- crm.markup_orcamento_linhas
alter table "crm"."markup_orcamento_linhas" add column empresa_id uuid;
update "crm"."markup_orcamento_linhas" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."markup_orcamento_linhas" alter column empresa_id set not null;
alter table "crm"."markup_orcamento_linhas" add constraint tnt_5efb93a0d5_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_5efb93a0d5_idx on "crm"."markup_orcamento_linhas" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."markup_orcamento_linhas";
create trigger aaa_tenant_fill before insert on "crm"."markup_orcamento_linhas" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."markup_orcamento_linhas";
create policy tenant_isolamento on "crm"."markup_orcamento_linhas" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."markup_orcamento_linhas";
create policy tenant_definer on "crm"."markup_orcamento_linhas" for all to app_tenant_definer using (true) with check (true);

-- crm.markup_orcamentos
alter table "crm"."markup_orcamentos" add column empresa_id uuid;
update "crm"."markup_orcamentos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."markup_orcamentos" alter column empresa_id set not null;
alter table "crm"."markup_orcamentos" add constraint tnt_06dbd9159e_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_06dbd9159e_idx on "crm"."markup_orcamentos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."markup_orcamentos";
create trigger aaa_tenant_fill before insert on "crm"."markup_orcamentos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."markup_orcamentos";
create policy tenant_isolamento on "crm"."markup_orcamentos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."markup_orcamentos";
create policy tenant_definer on "crm"."markup_orcamentos" for all to app_tenant_definer using (true) with check (true);

-- crm.markup_produtos
alter table "crm"."markup_produtos" add column empresa_id uuid;
update "crm"."markup_produtos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."markup_produtos" alter column empresa_id set not null;
alter table "crm"."markup_produtos" add constraint tnt_13ed90e51e_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_13ed90e51e_idx on "crm"."markup_produtos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."markup_produtos";
create trigger aaa_tenant_fill before insert on "crm"."markup_produtos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."markup_produtos";
create policy tenant_isolamento on "crm"."markup_produtos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."markup_produtos";
create policy tenant_definer on "crm"."markup_produtos" for all to app_tenant_definer using (true) with check (true);

-- crm.markup_regras_construtivas
alter table "crm"."markup_regras_construtivas" add column empresa_id uuid;
update "crm"."markup_regras_construtivas" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."markup_regras_construtivas" alter column empresa_id set not null;
alter table "crm"."markup_regras_construtivas" add constraint tnt_e6741841df_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_e6741841df_idx on "crm"."markup_regras_construtivas" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."markup_regras_construtivas";
create trigger aaa_tenant_fill before insert on "crm"."markup_regras_construtivas" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."markup_regras_construtivas";
create policy tenant_isolamento on "crm"."markup_regras_construtivas" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."markup_regras_construtivas";
create policy tenant_definer on "crm"."markup_regras_construtivas" for all to app_tenant_definer using (true) with check (true);

-- crm.markup_servico_templates
alter table "crm"."markup_servico_templates" add column empresa_id uuid;
update "crm"."markup_servico_templates" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."markup_servico_templates" alter column empresa_id set not null;
alter table "crm"."markup_servico_templates" add constraint tnt_3f4df8eabe_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_3f4df8eabe_idx on "crm"."markup_servico_templates" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."markup_servico_templates";
create trigger aaa_tenant_fill before insert on "crm"."markup_servico_templates" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."markup_servico_templates";
create policy tenant_isolamento on "crm"."markup_servico_templates" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."markup_servico_templates";
create policy tenant_definer on "crm"."markup_servico_templates" for all to app_tenant_definer using (true) with check (true);

-- crm.mkt_config_colunas  (estava sem RLS)
alter table "crm"."mkt_config_colunas" add column empresa_id uuid;
update "crm"."mkt_config_colunas" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."mkt_config_colunas" alter column empresa_id set not null;
alter table "crm"."mkt_config_colunas" add constraint tnt_26603cc82e_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_26603cc82e_idx on "crm"."mkt_config_colunas" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."mkt_config_colunas";
create trigger aaa_tenant_fill before insert on "crm"."mkt_config_colunas" for each row execute function public.app_tenant_fill();
alter table "crm"."mkt_config_colunas" enable row level security;
drop policy if exists tenant_acesso on "crm"."mkt_config_colunas";
create policy tenant_acesso on "crm"."mkt_config_colunas" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."mkt_config_colunas";
create policy tenant_isolamento on "crm"."mkt_config_colunas" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."mkt_config_colunas";
create policy tenant_definer on "crm"."mkt_config_colunas" for all to app_tenant_definer using (true) with check (true);

-- crm.mkt_fontes  (estava sem RLS)
alter table "crm"."mkt_fontes" add column empresa_id uuid;
update "crm"."mkt_fontes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."mkt_fontes" alter column empresa_id set not null;
alter table "crm"."mkt_fontes" add constraint tnt_048eddc498_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_048eddc498_idx on "crm"."mkt_fontes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."mkt_fontes";
create trigger aaa_tenant_fill before insert on "crm"."mkt_fontes" for each row execute function public.app_tenant_fill();
alter table "crm"."mkt_fontes" enable row level security;
drop policy if exists tenant_acesso on "crm"."mkt_fontes";
create policy tenant_acesso on "crm"."mkt_fontes" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."mkt_fontes";
create policy tenant_isolamento on "crm"."mkt_fontes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."mkt_fontes";
create policy tenant_definer on "crm"."mkt_fontes" for all to app_tenant_definer using (true) with check (true);

-- crm.mkt_gastos_config  (estava sem RLS)
alter table "crm"."mkt_gastos_config" add column empresa_id uuid;
update "crm"."mkt_gastos_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."mkt_gastos_config" alter column empresa_id set not null;
alter table "crm"."mkt_gastos_config" add constraint tnt_4c3047dba2_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_4c3047dba2_idx on "crm"."mkt_gastos_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."mkt_gastos_config";
create trigger aaa_tenant_fill before insert on "crm"."mkt_gastos_config" for each row execute function public.app_tenant_fill();
alter table "crm"."mkt_gastos_config" enable row level security;
drop policy if exists tenant_acesso on "crm"."mkt_gastos_config";
create policy tenant_acesso on "crm"."mkt_gastos_config" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."mkt_gastos_config";
create policy tenant_isolamento on "crm"."mkt_gastos_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."mkt_gastos_config";
create policy tenant_definer on "crm"."mkt_gastos_config" for all to app_tenant_definer using (true) with check (true);

-- crm.mkt_lancamentos  (estava sem RLS)
alter table "crm"."mkt_lancamentos" add column empresa_id uuid;
update "crm"."mkt_lancamentos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."mkt_lancamentos" alter column empresa_id set not null;
alter table "crm"."mkt_lancamentos" add constraint tnt_2ac6b5b92f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_2ac6b5b92f_idx on "crm"."mkt_lancamentos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."mkt_lancamentos";
create trigger aaa_tenant_fill before insert on "crm"."mkt_lancamentos" for each row execute function public.app_tenant_fill();
alter table "crm"."mkt_lancamentos" enable row level security;
drop policy if exists tenant_acesso on "crm"."mkt_lancamentos";
create policy tenant_acesso on "crm"."mkt_lancamentos" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."mkt_lancamentos";
create policy tenant_isolamento on "crm"."mkt_lancamentos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."mkt_lancamentos";
create policy tenant_definer on "crm"."mkt_lancamentos" for all to app_tenant_definer using (true) with check (true);

-- crm.mkt_sub_fontes  (estava sem RLS)
alter table "crm"."mkt_sub_fontes" add column empresa_id uuid;
update "crm"."mkt_sub_fontes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."mkt_sub_fontes" alter column empresa_id set not null;
alter table "crm"."mkt_sub_fontes" add constraint tnt_d132834b83_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_d132834b83_idx on "crm"."mkt_sub_fontes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."mkt_sub_fontes";
create trigger aaa_tenant_fill before insert on "crm"."mkt_sub_fontes" for each row execute function public.app_tenant_fill();
alter table "crm"."mkt_sub_fontes" enable row level security;
drop policy if exists tenant_acesso on "crm"."mkt_sub_fontes";
create policy tenant_acesso on "crm"."mkt_sub_fontes" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."mkt_sub_fontes";
create policy tenant_isolamento on "crm"."mkt_sub_fontes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."mkt_sub_fontes";
create policy tenant_definer on "crm"."mkt_sub_fontes" for all to app_tenant_definer using (true) with check (true);

-- crm.negativacao_numeros  (estava sem RLS)
alter table "crm"."negativacao_numeros" add column empresa_id uuid;
update "crm"."negativacao_numeros" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."negativacao_numeros" alter column empresa_id set not null;
alter table "crm"."negativacao_numeros" add constraint tnt_ec1621bbb2_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_ec1621bbb2_idx on "crm"."negativacao_numeros" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."negativacao_numeros";
create trigger aaa_tenant_fill before insert on "crm"."negativacao_numeros" for each row execute function public.app_tenant_fill();
alter table "crm"."negativacao_numeros" enable row level security;
drop policy if exists tenant_acesso on "crm"."negativacao_numeros";
create policy tenant_acesso on "crm"."negativacao_numeros" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."negativacao_numeros";
create policy tenant_isolamento on "crm"."negativacao_numeros" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."negativacao_numeros";
create policy tenant_definer on "crm"."negativacao_numeros" for all to app_tenant_definer using (true) with check (true);

-- crm.negativacao_webhook_config  (estava sem RLS)
alter table "crm"."negativacao_webhook_config" add column empresa_id uuid;
update "crm"."negativacao_webhook_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."negativacao_webhook_config" alter column empresa_id set not null;
alter table "crm"."negativacao_webhook_config" add constraint tnt_583f26b1d7_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_583f26b1d7_idx on "crm"."negativacao_webhook_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."negativacao_webhook_config";
create trigger aaa_tenant_fill before insert on "crm"."negativacao_webhook_config" for each row execute function public.app_tenant_fill();
alter table "crm"."negativacao_webhook_config" enable row level security;
drop policy if exists tenant_acesso on "crm"."negativacao_webhook_config";
create policy tenant_acesso on "crm"."negativacao_webhook_config" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."negativacao_webhook_config";
create policy tenant_isolamento on "crm"."negativacao_webhook_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."negativacao_webhook_config";
create policy tenant_definer on "crm"."negativacao_webhook_config" for all to app_tenant_definer using (true) with check (true);

-- crm.notifications  (estava sem RLS)
alter table "crm"."notifications" add column empresa_id uuid;
update "crm"."notifications" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."notifications" alter column empresa_id set not null;
alter table "crm"."notifications" add constraint tnt_08a8fbd648_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_08a8fbd648_idx on "crm"."notifications" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."notifications";
create trigger aaa_tenant_fill before insert on "crm"."notifications" for each row execute function public.app_tenant_fill();
alter table "crm"."notifications" enable row level security;
drop policy if exists tenant_acesso on "crm"."notifications";
create policy tenant_acesso on "crm"."notifications" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."notifications";
create policy tenant_isolamento on "crm"."notifications" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."notifications";
create policy tenant_definer on "crm"."notifications" for all to app_tenant_definer using (true) with check (true);

-- crm.obra_producao
alter table "crm"."obra_producao" add column empresa_id uuid;
update "crm"."obra_producao" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."obra_producao" alter column empresa_id set not null;
alter table "crm"."obra_producao" add constraint tnt_31aa8be79e_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_31aa8be79e_idx on "crm"."obra_producao" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."obra_producao";
create trigger aaa_tenant_fill before insert on "crm"."obra_producao" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."obra_producao";
create policy tenant_isolamento on "crm"."obra_producao" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."obra_producao";
create policy tenant_definer on "crm"."obra_producao" for all to app_tenant_definer using (true) with check (true);

-- crm.obra_producao_notas
alter table "crm"."obra_producao_notas" add column empresa_id uuid;
update "crm"."obra_producao_notas" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."obra_producao_notas" alter column empresa_id set not null;
alter table "crm"."obra_producao_notas" add constraint tnt_a821c50493_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_a821c50493_idx on "crm"."obra_producao_notas" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."obra_producao_notas";
create trigger aaa_tenant_fill before insert on "crm"."obra_producao_notas" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."obra_producao_notas";
create policy tenant_isolamento on "crm"."obra_producao_notas" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."obra_producao_notas";
create policy tenant_definer on "crm"."obra_producao_notas" for all to app_tenant_definer using (true) with check (true);

-- crm.orcamento_slide_blocos
alter table "crm"."orcamento_slide_blocos" add column empresa_id uuid;
update "crm"."orcamento_slide_blocos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."orcamento_slide_blocos" alter column empresa_id set not null;
alter table "crm"."orcamento_slide_blocos" add constraint tnt_294c754002_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_294c754002_idx on "crm"."orcamento_slide_blocos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."orcamento_slide_blocos";
create trigger aaa_tenant_fill before insert on "crm"."orcamento_slide_blocos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."orcamento_slide_blocos";
create policy tenant_isolamento on "crm"."orcamento_slide_blocos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."orcamento_slide_blocos";
create policy tenant_definer on "crm"."orcamento_slide_blocos" for all to app_tenant_definer using (true) with check (true);

-- crm.orcamento_slide_catalogo
alter table "crm"."orcamento_slide_catalogo" add column empresa_id uuid;
update "crm"."orcamento_slide_catalogo" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."orcamento_slide_catalogo" alter column empresa_id set not null;
alter table "crm"."orcamento_slide_catalogo" add constraint tnt_633c776af9_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_633c776af9_idx on "crm"."orcamento_slide_catalogo" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."orcamento_slide_catalogo";
create trigger aaa_tenant_fill before insert on "crm"."orcamento_slide_catalogo" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."orcamento_slide_catalogo";
create policy tenant_isolamento on "crm"."orcamento_slide_catalogo" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."orcamento_slide_catalogo";
create policy tenant_definer on "crm"."orcamento_slide_catalogo" for all to app_tenant_definer using (true) with check (true);

-- crm.orcamento_slide_formas_pagamento
alter table "crm"."orcamento_slide_formas_pagamento" add column empresa_id uuid;
update "crm"."orcamento_slide_formas_pagamento" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."orcamento_slide_formas_pagamento" alter column empresa_id set not null;
alter table "crm"."orcamento_slide_formas_pagamento" add constraint tnt_08ead3960e_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_08ead3960e_idx on "crm"."orcamento_slide_formas_pagamento" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."orcamento_slide_formas_pagamento";
create trigger aaa_tenant_fill before insert on "crm"."orcamento_slide_formas_pagamento" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."orcamento_slide_formas_pagamento";
create policy tenant_isolamento on "crm"."orcamento_slide_formas_pagamento" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."orcamento_slide_formas_pagamento";
create policy tenant_definer on "crm"."orcamento_slide_formas_pagamento" for all to app_tenant_definer using (true) with check (true);

-- crm.orcamento_slide_midias
alter table "crm"."orcamento_slide_midias" add column empresa_id uuid;
update "crm"."orcamento_slide_midias" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."orcamento_slide_midias" alter column empresa_id set not null;
alter table "crm"."orcamento_slide_midias" add constraint tnt_f48ca938c8_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_f48ca938c8_idx on "crm"."orcamento_slide_midias" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."orcamento_slide_midias";
create trigger aaa_tenant_fill before insert on "crm"."orcamento_slide_midias" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."orcamento_slide_midias";
create policy tenant_isolamento on "crm"."orcamento_slide_midias" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."orcamento_slide_midias";
create policy tenant_definer on "crm"."orcamento_slide_midias" for all to app_tenant_definer using (true) with check (true);

-- crm.orcamento_slide_pergunta_opcoes
alter table "crm"."orcamento_slide_pergunta_opcoes" add column empresa_id uuid;
update "crm"."orcamento_slide_pergunta_opcoes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."orcamento_slide_pergunta_opcoes" alter column empresa_id set not null;
alter table "crm"."orcamento_slide_pergunta_opcoes" add constraint tnt_3956d69c53_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_3956d69c53_idx on "crm"."orcamento_slide_pergunta_opcoes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."orcamento_slide_pergunta_opcoes";
create trigger aaa_tenant_fill before insert on "crm"."orcamento_slide_pergunta_opcoes" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."orcamento_slide_pergunta_opcoes";
create policy tenant_isolamento on "crm"."orcamento_slide_pergunta_opcoes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."orcamento_slide_pergunta_opcoes";
create policy tenant_definer on "crm"."orcamento_slide_pergunta_opcoes" for all to app_tenant_definer using (true) with check (true);

-- crm.orcamento_slide_perguntas
alter table "crm"."orcamento_slide_perguntas" add column empresa_id uuid;
update "crm"."orcamento_slide_perguntas" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."orcamento_slide_perguntas" alter column empresa_id set not null;
alter table "crm"."orcamento_slide_perguntas" add constraint tnt_4d6f35334f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_4d6f35334f_idx on "crm"."orcamento_slide_perguntas" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."orcamento_slide_perguntas";
create trigger aaa_tenant_fill before insert on "crm"."orcamento_slide_perguntas" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."orcamento_slide_perguntas";
create policy tenant_isolamento on "crm"."orcamento_slide_perguntas" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."orcamento_slide_perguntas";
create policy tenant_definer on "crm"."orcamento_slide_perguntas" for all to app_tenant_definer using (true) with check (true);

-- crm.orcamento_slide_scripts
alter table "crm"."orcamento_slide_scripts" add column empresa_id uuid;
update "crm"."orcamento_slide_scripts" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."orcamento_slide_scripts" alter column empresa_id set not null;
alter table "crm"."orcamento_slide_scripts" add constraint tnt_ce4b252119_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_ce4b252119_idx on "crm"."orcamento_slide_scripts" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."orcamento_slide_scripts";
create trigger aaa_tenant_fill before insert on "crm"."orcamento_slide_scripts" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."orcamento_slide_scripts";
create policy tenant_isolamento on "crm"."orcamento_slide_scripts" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."orcamento_slide_scripts";
create policy tenant_definer on "crm"."orcamento_slide_scripts" for all to app_tenant_definer using (true) with check (true);

-- crm.orcamento_slide_templates
alter table "crm"."orcamento_slide_templates" add column empresa_id uuid;
update "crm"."orcamento_slide_templates" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."orcamento_slide_templates" alter column empresa_id set not null;
alter table "crm"."orcamento_slide_templates" add constraint tnt_51a792ac17_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_51a792ac17_idx on "crm"."orcamento_slide_templates" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."orcamento_slide_templates";
create trigger aaa_tenant_fill before insert on "crm"."orcamento_slide_templates" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."orcamento_slide_templates";
create policy tenant_isolamento on "crm"."orcamento_slide_templates" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."orcamento_slide_templates";
create policy tenant_definer on "crm"."orcamento_slide_templates" for all to app_tenant_definer using (true) with check (true);

-- crm.orcamento_slides
alter table "crm"."orcamento_slides" add column empresa_id uuid;
update "crm"."orcamento_slides" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."orcamento_slides" alter column empresa_id set not null;
alter table "crm"."orcamento_slides" add constraint tnt_c4cf6a3d91_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_c4cf6a3d91_idx on "crm"."orcamento_slides" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."orcamento_slides";
create trigger aaa_tenant_fill before insert on "crm"."orcamento_slides" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."orcamento_slides";
create policy tenant_isolamento on "crm"."orcamento_slides" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."orcamento_slides";
create policy tenant_definer on "crm"."orcamento_slides" for all to app_tenant_definer using (true) with check (true);

-- crm.pipeline_custom_stages  (estava sem RLS)
alter table "crm"."pipeline_custom_stages" add column empresa_id uuid;
update "crm"."pipeline_custom_stages" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."pipeline_custom_stages" alter column empresa_id set not null;
alter table "crm"."pipeline_custom_stages" add constraint tnt_e30d65daf0_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_e30d65daf0_idx on "crm"."pipeline_custom_stages" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."pipeline_custom_stages";
create trigger aaa_tenant_fill before insert on "crm"."pipeline_custom_stages" for each row execute function public.app_tenant_fill();
alter table "crm"."pipeline_custom_stages" enable row level security;
drop policy if exists tenant_acesso on "crm"."pipeline_custom_stages";
create policy tenant_acesso on "crm"."pipeline_custom_stages" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."pipeline_custom_stages";
create policy tenant_isolamento on "crm"."pipeline_custom_stages" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."pipeline_custom_stages";
create policy tenant_definer on "crm"."pipeline_custom_stages" for all to app_tenant_definer using (true) with check (true);

-- crm.pipeline_daily_metrics  (estava sem RLS)
alter table "crm"."pipeline_daily_metrics" add column empresa_id uuid;
update "crm"."pipeline_daily_metrics" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."pipeline_daily_metrics" alter column empresa_id set not null;
alter table "crm"."pipeline_daily_metrics" add constraint tnt_1fd13d5274_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_1fd13d5274_idx on "crm"."pipeline_daily_metrics" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."pipeline_daily_metrics";
create trigger aaa_tenant_fill before insert on "crm"."pipeline_daily_metrics" for each row execute function public.app_tenant_fill();
alter table "crm"."pipeline_daily_metrics" enable row level security;
drop policy if exists tenant_acesso on "crm"."pipeline_daily_metrics";
create policy tenant_acesso on "crm"."pipeline_daily_metrics" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."pipeline_daily_metrics";
create policy tenant_isolamento on "crm"."pipeline_daily_metrics" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."pipeline_daily_metrics";
create policy tenant_definer on "crm"."pipeline_daily_metrics" for all to app_tenant_definer using (true) with check (true);

-- crm.pipeline_lead_ai_config
alter table "crm"."pipeline_lead_ai_config" add column empresa_id uuid;
update "crm"."pipeline_lead_ai_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."pipeline_lead_ai_config" alter column empresa_id set not null;
alter table "crm"."pipeline_lead_ai_config" add constraint tnt_31f7e1e49f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_31f7e1e49f_idx on "crm"."pipeline_lead_ai_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."pipeline_lead_ai_config";
create trigger aaa_tenant_fill before insert on "crm"."pipeline_lead_ai_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."pipeline_lead_ai_config";
create policy tenant_isolamento on "crm"."pipeline_lead_ai_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."pipeline_lead_ai_config";
create policy tenant_definer on "crm"."pipeline_lead_ai_config" for all to app_tenant_definer using (true) with check (true);

-- crm.pipeline_metricas_coluna_config
alter table "crm"."pipeline_metricas_coluna_config" add column empresa_id uuid;
update "crm"."pipeline_metricas_coluna_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."pipeline_metricas_coluna_config" alter column empresa_id set not null;
alter table "crm"."pipeline_metricas_coluna_config" add constraint tnt_324561d4b9_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_324561d4b9_idx on "crm"."pipeline_metricas_coluna_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."pipeline_metricas_coluna_config";
create trigger aaa_tenant_fill before insert on "crm"."pipeline_metricas_coluna_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."pipeline_metricas_coluna_config";
create policy tenant_isolamento on "crm"."pipeline_metricas_coluna_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."pipeline_metricas_coluna_config";
create policy tenant_definer on "crm"."pipeline_metricas_coluna_config" for all to app_tenant_definer using (true) with check (true);

-- crm.pipeline_novo_lead_tarefa_config
alter table "crm"."pipeline_novo_lead_tarefa_config" add column empresa_id uuid;
update "crm"."pipeline_novo_lead_tarefa_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."pipeline_novo_lead_tarefa_config" alter column empresa_id set not null;
alter table "crm"."pipeline_novo_lead_tarefa_config" add constraint tnt_2e91d7f96b_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_2e91d7f96b_idx on "crm"."pipeline_novo_lead_tarefa_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."pipeline_novo_lead_tarefa_config";
create trigger aaa_tenant_fill before insert on "crm"."pipeline_novo_lead_tarefa_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."pipeline_novo_lead_tarefa_config";
create policy tenant_isolamento on "crm"."pipeline_novo_lead_tarefa_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."pipeline_novo_lead_tarefa_config";
create policy tenant_definer on "crm"."pipeline_novo_lead_tarefa_config" for all to app_tenant_definer using (true) with check (true);

-- crm.pipeline_orcamento_metricas  (estava sem RLS)
alter table "crm"."pipeline_orcamento_metricas" add column empresa_id uuid;
update "crm"."pipeline_orcamento_metricas" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."pipeline_orcamento_metricas" alter column empresa_id set not null;
alter table "crm"."pipeline_orcamento_metricas" add constraint tnt_0b7c37bb00_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_0b7c37bb00_idx on "crm"."pipeline_orcamento_metricas" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."pipeline_orcamento_metricas";
create trigger aaa_tenant_fill before insert on "crm"."pipeline_orcamento_metricas" for each row execute function public.app_tenant_fill();
alter table "crm"."pipeline_orcamento_metricas" enable row level security;
drop policy if exists tenant_acesso on "crm"."pipeline_orcamento_metricas";
create policy tenant_acesso on "crm"."pipeline_orcamento_metricas" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."pipeline_orcamento_metricas";
create policy tenant_isolamento on "crm"."pipeline_orcamento_metricas" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."pipeline_orcamento_metricas";
create policy tenant_definer on "crm"."pipeline_orcamento_metricas" for all to app_tenant_definer using (true) with check (true);

-- crm.pipeline_time_config  (estava sem RLS)
alter table "crm"."pipeline_time_config" add column empresa_id uuid;
update "crm"."pipeline_time_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."pipeline_time_config" alter column empresa_id set not null;
alter table "crm"."pipeline_time_config" add constraint tnt_6d93c66f5c_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_6d93c66f5c_idx on "crm"."pipeline_time_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."pipeline_time_config";
create trigger aaa_tenant_fill before insert on "crm"."pipeline_time_config" for each row execute function public.app_tenant_fill();
alter table "crm"."pipeline_time_config" enable row level security;
drop policy if exists tenant_acesso on "crm"."pipeline_time_config";
create policy tenant_acesso on "crm"."pipeline_time_config" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."pipeline_time_config";
create policy tenant_isolamento on "crm"."pipeline_time_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."pipeline_time_config";
create policy tenant_definer on "crm"."pipeline_time_config" for all to app_tenant_definer using (true) with check (true);

-- crm.pipeline_vendas_ganhos_config  (estava sem RLS)
alter table "crm"."pipeline_vendas_ganhos_config" add column empresa_id uuid;
update "crm"."pipeline_vendas_ganhos_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."pipeline_vendas_ganhos_config" alter column empresa_id set not null;
alter table "crm"."pipeline_vendas_ganhos_config" add constraint tnt_82dc98277d_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_82dc98277d_idx on "crm"."pipeline_vendas_ganhos_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."pipeline_vendas_ganhos_config";
create trigger aaa_tenant_fill before insert on "crm"."pipeline_vendas_ganhos_config" for each row execute function public.app_tenant_fill();
alter table "crm"."pipeline_vendas_ganhos_config" enable row level security;
drop policy if exists tenant_acesso on "crm"."pipeline_vendas_ganhos_config";
create policy tenant_acesso on "crm"."pipeline_vendas_ganhos_config" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."pipeline_vendas_ganhos_config";
create policy tenant_isolamento on "crm"."pipeline_vendas_ganhos_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."pipeline_vendas_ganhos_config";
create policy tenant_definer on "crm"."pipeline_vendas_ganhos_config" for all to app_tenant_definer using (true) with check (true);

-- crm.pipeline_vendas_metricas  (estava sem RLS)
alter table "crm"."pipeline_vendas_metricas" add column empresa_id uuid;
update "crm"."pipeline_vendas_metricas" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."pipeline_vendas_metricas" alter column empresa_id set not null;
alter table "crm"."pipeline_vendas_metricas" add constraint tnt_aefce53ffe_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_aefce53ffe_idx on "crm"."pipeline_vendas_metricas" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."pipeline_vendas_metricas";
create trigger aaa_tenant_fill before insert on "crm"."pipeline_vendas_metricas" for each row execute function public.app_tenant_fill();
alter table "crm"."pipeline_vendas_metricas" enable row level security;
drop policy if exists tenant_acesso on "crm"."pipeline_vendas_metricas";
create policy tenant_acesso on "crm"."pipeline_vendas_metricas" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."pipeline_vendas_metricas";
create policy tenant_isolamento on "crm"."pipeline_vendas_metricas" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."pipeline_vendas_metricas";
create policy tenant_definer on "crm"."pipeline_vendas_metricas" for all to app_tenant_definer using (true) with check (true);

-- crm.ponto_registros  (estava sem RLS)
alter table "crm"."ponto_registros" add column empresa_id uuid;
update "crm"."ponto_registros" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."ponto_registros" alter column empresa_id set not null;
alter table "crm"."ponto_registros" add constraint tnt_9c39911221_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_9c39911221_idx on "crm"."ponto_registros" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."ponto_registros";
create trigger aaa_tenant_fill before insert on "crm"."ponto_registros" for each row execute function public.app_tenant_fill();
alter table "crm"."ponto_registros" enable row level security;
drop policy if exists tenant_acesso on "crm"."ponto_registros";
create policy tenant_acesso on "crm"."ponto_registros" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."ponto_registros";
create policy tenant_isolamento on "crm"."ponto_registros" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."ponto_registros";
create policy tenant_definer on "crm"."ponto_registros" for all to app_tenant_definer using (true) with check (true);

-- crm.pontua_garbo_comissao_liberacoes  (estava sem RLS)
alter table "crm"."pontua_garbo_comissao_liberacoes" add column empresa_id uuid;
update "crm"."pontua_garbo_comissao_liberacoes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."pontua_garbo_comissao_liberacoes" alter column empresa_id set not null;
alter table "crm"."pontua_garbo_comissao_liberacoes" add constraint tnt_1c6216ae97_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_1c6216ae97_idx on "crm"."pontua_garbo_comissao_liberacoes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."pontua_garbo_comissao_liberacoes";
create trigger aaa_tenant_fill before insert on "crm"."pontua_garbo_comissao_liberacoes" for each row execute function public.app_tenant_fill();
alter table "crm"."pontua_garbo_comissao_liberacoes" enable row level security;
drop policy if exists tenant_acesso on "crm"."pontua_garbo_comissao_liberacoes";
create policy tenant_acesso on "crm"."pontua_garbo_comissao_liberacoes" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."pontua_garbo_comissao_liberacoes";
create policy tenant_isolamento on "crm"."pontua_garbo_comissao_liberacoes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."pontua_garbo_comissao_liberacoes";
create policy tenant_definer on "crm"."pontua_garbo_comissao_liberacoes" for all to app_tenant_definer using (true) with check (true);

-- crm.pontua_garbo_lancamentos  (estava sem RLS)
alter table "crm"."pontua_garbo_lancamentos" add column empresa_id uuid;
update "crm"."pontua_garbo_lancamentos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."pontua_garbo_lancamentos" alter column empresa_id set not null;
alter table "crm"."pontua_garbo_lancamentos" add constraint tnt_34a71f8f87_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_34a71f8f87_idx on "crm"."pontua_garbo_lancamentos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."pontua_garbo_lancamentos";
create trigger aaa_tenant_fill before insert on "crm"."pontua_garbo_lancamentos" for each row execute function public.app_tenant_fill();
alter table "crm"."pontua_garbo_lancamentos" enable row level security;
drop policy if exists tenant_acesso on "crm"."pontua_garbo_lancamentos";
create policy tenant_acesso on "crm"."pontua_garbo_lancamentos" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."pontua_garbo_lancamentos";
create policy tenant_isolamento on "crm"."pontua_garbo_lancamentos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."pontua_garbo_lancamentos";
create policy tenant_definer on "crm"."pontua_garbo_lancamentos" for all to app_tenant_definer using (true) with check (true);

-- crm.presence_sessions  (estava sem RLS)
alter table "crm"."presence_sessions" add column empresa_id uuid;
update "crm"."presence_sessions" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."presence_sessions" alter column empresa_id set not null;
alter table "crm"."presence_sessions" add constraint tnt_ce7c1dc3ee_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_ce7c1dc3ee_idx on "crm"."presence_sessions" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."presence_sessions";
create trigger aaa_tenant_fill before insert on "crm"."presence_sessions" for each row execute function public.app_tenant_fill();
alter table "crm"."presence_sessions" enable row level security;
drop policy if exists tenant_acesso on "crm"."presence_sessions";
create policy tenant_acesso on "crm"."presence_sessions" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."presence_sessions";
create policy tenant_isolamento on "crm"."presence_sessions" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."presence_sessions";
create policy tenant_definer on "crm"."presence_sessions" for all to app_tenant_definer using (true) with check (true);

-- crm.prestador_saque_pedidos  (estava sem RLS)
alter table "crm"."prestador_saque_pedidos" add column empresa_id uuid;
update "crm"."prestador_saque_pedidos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."prestador_saque_pedidos" alter column empresa_id set not null;
alter table "crm"."prestador_saque_pedidos" add constraint tnt_7ffb5bdab2_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_7ffb5bdab2_idx on "crm"."prestador_saque_pedidos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."prestador_saque_pedidos";
create trigger aaa_tenant_fill before insert on "crm"."prestador_saque_pedidos" for each row execute function public.app_tenant_fill();
alter table "crm"."prestador_saque_pedidos" enable row level security;
drop policy if exists tenant_acesso on "crm"."prestador_saque_pedidos";
create policy tenant_acesso on "crm"."prestador_saque_pedidos" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."prestador_saque_pedidos";
create policy tenant_isolamento on "crm"."prestador_saque_pedidos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."prestador_saque_pedidos";
create policy tenant_definer on "crm"."prestador_saque_pedidos" for all to app_tenant_definer using (true) with check (true);

-- crm.prestador_titulos  (estava sem RLS)
alter table "crm"."prestador_titulos" add column empresa_id uuid;
update "crm"."prestador_titulos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."prestador_titulos" alter column empresa_id set not null;
alter table "crm"."prestador_titulos" add constraint tnt_4c7edce3b6_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_4c7edce3b6_idx on "crm"."prestador_titulos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."prestador_titulos";
create trigger aaa_tenant_fill before insert on "crm"."prestador_titulos" for each row execute function public.app_tenant_fill();
alter table "crm"."prestador_titulos" enable row level security;
drop policy if exists tenant_acesso on "crm"."prestador_titulos";
create policy tenant_acesso on "crm"."prestador_titulos" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."prestador_titulos";
create policy tenant_isolamento on "crm"."prestador_titulos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."prestador_titulos";
create policy tenant_definer on "crm"."prestador_titulos" for all to app_tenant_definer using (true) with check (true);

-- crm.producao_stages
alter table "crm"."producao_stages" add column empresa_id uuid;
update "crm"."producao_stages" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."producao_stages" alter column empresa_id set not null;
alter table "crm"."producao_stages" add constraint tnt_5108a00163_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_5108a00163_idx on "crm"."producao_stages" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."producao_stages";
create trigger aaa_tenant_fill before insert on "crm"."producao_stages" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."producao_stages";
create policy tenant_isolamento on "crm"."producao_stages" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."producao_stages";
create policy tenant_definer on "crm"."producao_stages" for all to app_tenant_definer using (true) with check (true);

-- crm.projeto_stages
alter table "crm"."projeto_stages" add column empresa_id uuid;
update "crm"."projeto_stages" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."projeto_stages" alter column empresa_id set not null;
alter table "crm"."projeto_stages" add constraint tnt_1851c32e1f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_1851c32e1f_idx on "crm"."projeto_stages" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."projeto_stages";
create trigger aaa_tenant_fill before insert on "crm"."projeto_stages" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "crm"."projeto_stages";
create policy tenant_isolamento on "crm"."projeto_stages" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."projeto_stages";
create policy tenant_definer on "crm"."projeto_stages" for all to app_tenant_definer using (true) with check (true);

-- crm.relatorios_reunioes  (estava sem RLS)
alter table "crm"."relatorios_reunioes" add column empresa_id uuid;
update "crm"."relatorios_reunioes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."relatorios_reunioes" alter column empresa_id set not null;
alter table "crm"."relatorios_reunioes" add constraint tnt_21c7ba35af_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_21c7ba35af_idx on "crm"."relatorios_reunioes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."relatorios_reunioes";
create trigger aaa_tenant_fill before insert on "crm"."relatorios_reunioes" for each row execute function public.app_tenant_fill();
alter table "crm"."relatorios_reunioes" enable row level security;
drop policy if exists tenant_acesso on "crm"."relatorios_reunioes";
create policy tenant_acesso on "crm"."relatorios_reunioes" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."relatorios_reunioes";
create policy tenant_isolamento on "crm"."relatorios_reunioes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."relatorios_reunioes";
create policy tenant_definer on "crm"."relatorios_reunioes" for all to app_tenant_definer using (true) with check (true);

-- crm.tabela_origem_config  (estava sem RLS)
alter table "crm"."tabela_origem_config" add column empresa_id uuid;
update "crm"."tabela_origem_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."tabela_origem_config" alter column empresa_id set not null;
alter table "crm"."tabela_origem_config" add constraint tnt_7382346b34_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_7382346b34_idx on "crm"."tabela_origem_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."tabela_origem_config";
create trigger aaa_tenant_fill before insert on "crm"."tabela_origem_config" for each row execute function public.app_tenant_fill();
alter table "crm"."tabela_origem_config" enable row level security;
drop policy if exists tenant_acesso on "crm"."tabela_origem_config";
create policy tenant_acesso on "crm"."tabela_origem_config" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."tabela_origem_config";
create policy tenant_isolamento on "crm"."tabela_origem_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."tabela_origem_config";
create policy tenant_definer on "crm"."tabela_origem_config" for all to app_tenant_definer using (true) with check (true);

-- crm.ui_preferences  (estava sem RLS)
alter table "crm"."ui_preferences" add column empresa_id uuid;
update "crm"."ui_preferences" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."ui_preferences" alter column empresa_id set not null;
alter table "crm"."ui_preferences" add constraint tnt_9033d0a311_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_9033d0a311_idx on "crm"."ui_preferences" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."ui_preferences";
create trigger aaa_tenant_fill before insert on "crm"."ui_preferences" for each row execute function public.app_tenant_fill();
alter table "crm"."ui_preferences" enable row level security;
drop policy if exists tenant_acesso on "crm"."ui_preferences";
create policy tenant_acesso on "crm"."ui_preferences" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."ui_preferences";
create policy tenant_isolamento on "crm"."ui_preferences" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."ui_preferences";
create policy tenant_definer on "crm"."ui_preferences" for all to app_tenant_definer using (true) with check (true);

-- crm.user_permissions  (estava sem RLS)
alter table "crm"."user_permissions" add column empresa_id uuid;
update "crm"."user_permissions" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."user_permissions" alter column empresa_id set not null;
alter table "crm"."user_permissions" add constraint tnt_8a289dd5a3_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_8a289dd5a3_idx on "crm"."user_permissions" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."user_permissions";
create trigger aaa_tenant_fill before insert on "crm"."user_permissions" for each row execute function public.app_tenant_fill();
alter table "crm"."user_permissions" enable row level security;
drop policy if exists tenant_acesso on "crm"."user_permissions";
create policy tenant_acesso on "crm"."user_permissions" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."user_permissions";
create policy tenant_isolamento on "crm"."user_permissions" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."user_permissions";
create policy tenant_definer on "crm"."user_permissions" for all to app_tenant_definer using (true) with check (true);

-- crm.user_roles  (estava sem RLS)
alter table "crm"."user_roles" add column empresa_id uuid;
update "crm"."user_roles" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."user_roles" alter column empresa_id set not null;
alter table "crm"."user_roles" add constraint tnt_facf55186c_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_facf55186c_idx on "crm"."user_roles" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."user_roles";
create trigger aaa_tenant_fill before insert on "crm"."user_roles" for each row execute function public.app_tenant_fill();
alter table "crm"."user_roles" enable row level security;
drop policy if exists tenant_acesso on "crm"."user_roles";
create policy tenant_acesso on "crm"."user_roles" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."user_roles";
create policy tenant_isolamento on "crm"."user_roles" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."user_roles";
create policy tenant_definer on "crm"."user_roles" for all to app_tenant_definer using (true) with check (true);

-- crm.uso_config  (estava sem RLS)
alter table "crm"."uso_config" add column empresa_id uuid;
update "crm"."uso_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."uso_config" alter column empresa_id set not null;
alter table "crm"."uso_config" add constraint tnt_3ce06526a5_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_3ce06526a5_idx on "crm"."uso_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."uso_config";
create trigger aaa_tenant_fill before insert on "crm"."uso_config" for each row execute function public.app_tenant_fill();
alter table "crm"."uso_config" enable row level security;
drop policy if exists tenant_acesso on "crm"."uso_config";
create policy tenant_acesso on "crm"."uso_config" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."uso_config";
create policy tenant_isolamento on "crm"."uso_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."uso_config";
create policy tenant_definer on "crm"."uso_config" for all to app_tenant_definer using (true) with check (true);

-- crm.usuarios  (estava sem RLS)
alter table "crm"."usuarios" add column empresa_id uuid;
update "crm"."usuarios" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."usuarios" alter column empresa_id set not null;
alter table "crm"."usuarios" add constraint tnt_11539a16ff_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_11539a16ff_idx on "crm"."usuarios" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."usuarios";
create trigger aaa_tenant_fill before insert on "crm"."usuarios" for each row execute function public.app_tenant_fill();
alter table "crm"."usuarios" enable row level security;
drop policy if exists tenant_acesso on "crm"."usuarios";
create policy tenant_acesso on "crm"."usuarios" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."usuarios";
create policy tenant_isolamento on "crm"."usuarios" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."usuarios";
create policy tenant_definer on "crm"."usuarios" for all to app_tenant_definer using (true) with check (true);

-- crm.webhooks_api  (estava sem RLS)
alter table "crm"."webhooks_api" add column empresa_id uuid;
update "crm"."webhooks_api" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "crm"."webhooks_api" alter column empresa_id set not null;
alter table "crm"."webhooks_api" add constraint tnt_2c0e511999_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_2c0e511999_idx on "crm"."webhooks_api" (empresa_id);
drop trigger if exists aaa_tenant_fill on "crm"."webhooks_api";
create trigger aaa_tenant_fill before insert on "crm"."webhooks_api" for each row execute function public.app_tenant_fill();
alter table "crm"."webhooks_api" enable row level security;
drop policy if exists tenant_acesso on "crm"."webhooks_api";
create policy tenant_acesso on "crm"."webhooks_api" for all to authenticated using (true) with check (true);
drop policy if exists tenant_isolamento on "crm"."webhooks_api";
create policy tenant_isolamento on "crm"."webhooks_api" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "crm"."webhooks_api";
create policy tenant_definer on "crm"."webhooks_api" for all to app_tenant_definer using (true) with check (true);

