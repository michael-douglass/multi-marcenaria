-- GERADO por scripts/multi-empresa/gerar-tenant-migration.mjs (grupo: nucleo) — 60 tabelas.
-- Coluna de tenant + trigger aaa_tenant_fill + policy RESTRICTIVE tenant_isolamento + policy tenant_definer.
-- Tabelas que estavam SEM RLS ganham também tenant_acesso (permissiva, só dentro da empresa).

-- public.movelaria_briefing_modelos
alter table "public"."movelaria_briefing_modelos" add column empresa_id uuid;
update "public"."movelaria_briefing_modelos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_briefing_modelos" alter column empresa_id set not null;
alter table "public"."movelaria_briefing_modelos" add constraint tnt_ff29bfd68b_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_ff29bfd68b_idx on "public"."movelaria_briefing_modelos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_briefing_modelos";
create trigger aaa_tenant_fill before insert on "public"."movelaria_briefing_modelos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_briefing_modelos";
create policy tenant_isolamento on "public"."movelaria_briefing_modelos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_briefing_modelos";
create policy tenant_definer on "public"."movelaria_briefing_modelos" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_briefing_perguntas
alter table "public"."movelaria_briefing_perguntas" add column empresa_id uuid;
update "public"."movelaria_briefing_perguntas" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_briefing_perguntas" alter column empresa_id set not null;
alter table "public"."movelaria_briefing_perguntas" add constraint tnt_2d9928c11f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_2d9928c11f_idx on "public"."movelaria_briefing_perguntas" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_briefing_perguntas";
create trigger aaa_tenant_fill before insert on "public"."movelaria_briefing_perguntas" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_briefing_perguntas";
create policy tenant_isolamento on "public"."movelaria_briefing_perguntas" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_briefing_perguntas";
create policy tenant_definer on "public"."movelaria_briefing_perguntas" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_caixa_destinatarios
alter table "public"."movelaria_caixa_destinatarios" add column empresa_id uuid;
update "public"."movelaria_caixa_destinatarios" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_caixa_destinatarios" alter column empresa_id set not null;
alter table "public"."movelaria_caixa_destinatarios" add constraint tnt_52f02a0f25_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_52f02a0f25_idx on "public"."movelaria_caixa_destinatarios" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_caixa_destinatarios";
create trigger aaa_tenant_fill before insert on "public"."movelaria_caixa_destinatarios" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_caixa_destinatarios";
create policy tenant_isolamento on "public"."movelaria_caixa_destinatarios" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_caixa_destinatarios";
create policy tenant_definer on "public"."movelaria_caixa_destinatarios" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_caixa_fornecedor
alter table "public"."movelaria_caixa_fornecedor" add column empresa_id uuid;
update "public"."movelaria_caixa_fornecedor" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_caixa_fornecedor" alter column empresa_id set not null;
alter table "public"."movelaria_caixa_fornecedor" add constraint tnt_f54a60def3_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_f54a60def3_idx on "public"."movelaria_caixa_fornecedor" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_caixa_fornecedor";
create trigger aaa_tenant_fill before insert on "public"."movelaria_caixa_fornecedor" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_caixa_fornecedor";
create policy tenant_isolamento on "public"."movelaria_caixa_fornecedor" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_caixa_fornecedor";
create policy tenant_definer on "public"."movelaria_caixa_fornecedor" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_caixa_movimentacoes
alter table "public"."movelaria_caixa_movimentacoes" add column empresa_id uuid;
update "public"."movelaria_caixa_movimentacoes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_caixa_movimentacoes" alter column empresa_id set not null;
alter table "public"."movelaria_caixa_movimentacoes" add constraint tnt_b45f8547b0_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_b45f8547b0_idx on "public"."movelaria_caixa_movimentacoes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_caixa_movimentacoes";
create trigger aaa_tenant_fill before insert on "public"."movelaria_caixa_movimentacoes" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_caixa_movimentacoes";
create policy tenant_isolamento on "public"."movelaria_caixa_movimentacoes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_caixa_movimentacoes";
create policy tenant_definer on "public"."movelaria_caixa_movimentacoes" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_caixa_saldo_acumulado
alter table "public"."movelaria_caixa_saldo_acumulado" add column empresa_id uuid;
update "public"."movelaria_caixa_saldo_acumulado" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_caixa_saldo_acumulado" alter column empresa_id set not null;
alter table "public"."movelaria_caixa_saldo_acumulado" add constraint tnt_86230cdf70_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_86230cdf70_idx on "public"."movelaria_caixa_saldo_acumulado" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_caixa_saldo_acumulado";
create trigger aaa_tenant_fill before insert on "public"."movelaria_caixa_saldo_acumulado" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_caixa_saldo_acumulado";
create policy tenant_isolamento on "public"."movelaria_caixa_saldo_acumulado" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_caixa_saldo_acumulado";
create policy tenant_definer on "public"."movelaria_caixa_saldo_acumulado" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_caixa_saldo_alocacoes
alter table "public"."movelaria_caixa_saldo_alocacoes" add column empresa_id uuid;
update "public"."movelaria_caixa_saldo_alocacoes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_caixa_saldo_alocacoes" alter column empresa_id set not null;
alter table "public"."movelaria_caixa_saldo_alocacoes" add constraint tnt_751b866f26_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_751b866f26_idx on "public"."movelaria_caixa_saldo_alocacoes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_caixa_saldo_alocacoes";
create trigger aaa_tenant_fill before insert on "public"."movelaria_caixa_saldo_alocacoes" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_caixa_saldo_alocacoes";
create policy tenant_isolamento on "public"."movelaria_caixa_saldo_alocacoes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_caixa_saldo_alocacoes";
create policy tenant_definer on "public"."movelaria_caixa_saldo_alocacoes" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_clientes
alter table "public"."movelaria_clientes" add column empresa_id uuid;
update "public"."movelaria_clientes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_clientes" alter column empresa_id set not null;
alter table "public"."movelaria_clientes" add constraint tnt_cf1389a28f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_cf1389a28f_idx on "public"."movelaria_clientes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_clientes";
create trigger aaa_tenant_fill before insert on "public"."movelaria_clientes" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_clientes";
create policy tenant_isolamento on "public"."movelaria_clientes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_clientes";
create policy tenant_definer on "public"."movelaria_clientes" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_contas_pagar
alter table "public"."movelaria_contas_pagar" add column empresa_id uuid;
update "public"."movelaria_contas_pagar" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_contas_pagar" alter column empresa_id set not null;
alter table "public"."movelaria_contas_pagar" add constraint tnt_31d83166f4_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_31d83166f4_idx on "public"."movelaria_contas_pagar" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_contas_pagar";
create trigger aaa_tenant_fill before insert on "public"."movelaria_contas_pagar" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_contas_pagar";
create policy tenant_isolamento on "public"."movelaria_contas_pagar" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_contas_pagar";
create policy tenant_definer on "public"."movelaria_contas_pagar" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_contas_pagar_anexos
alter table "public"."movelaria_contas_pagar_anexos" add column empresa_id uuid;
update "public"."movelaria_contas_pagar_anexos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_contas_pagar_anexos" alter column empresa_id set not null;
alter table "public"."movelaria_contas_pagar_anexos" add constraint tnt_2c9a4889c2_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_2c9a4889c2_idx on "public"."movelaria_contas_pagar_anexos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_contas_pagar_anexos";
create trigger aaa_tenant_fill before insert on "public"."movelaria_contas_pagar_anexos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_contas_pagar_anexos";
create policy tenant_isolamento on "public"."movelaria_contas_pagar_anexos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_contas_pagar_anexos";
create policy tenant_definer on "public"."movelaria_contas_pagar_anexos" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_contas_pagar_notif_dismiss
alter table "public"."movelaria_contas_pagar_notif_dismiss" add column empresa_id uuid;
update "public"."movelaria_contas_pagar_notif_dismiss" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_contas_pagar_notif_dismiss" alter column empresa_id set not null;
alter table "public"."movelaria_contas_pagar_notif_dismiss" add constraint tnt_964eda8fc0_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_964eda8fc0_idx on "public"."movelaria_contas_pagar_notif_dismiss" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_contas_pagar_notif_dismiss";
create trigger aaa_tenant_fill before insert on "public"."movelaria_contas_pagar_notif_dismiss" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_contas_pagar_notif_dismiss";
create policy tenant_isolamento on "public"."movelaria_contas_pagar_notif_dismiss" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_contas_pagar_notif_dismiss";
create policy tenant_definer on "public"."movelaria_contas_pagar_notif_dismiss" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_contas_receber
alter table "public"."movelaria_contas_receber" add column empresa_id uuid;
update "public"."movelaria_contas_receber" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_contas_receber" alter column empresa_id set not null;
alter table "public"."movelaria_contas_receber" add constraint tnt_a0a821f337_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_a0a821f337_idx on "public"."movelaria_contas_receber" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_contas_receber";
create trigger aaa_tenant_fill before insert on "public"."movelaria_contas_receber" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_contas_receber";
create policy tenant_isolamento on "public"."movelaria_contas_receber" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_contas_receber";
create policy tenant_definer on "public"."movelaria_contas_receber" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_contas_receber_anexos
alter table "public"."movelaria_contas_receber_anexos" add column empresa_id uuid;
update "public"."movelaria_contas_receber_anexos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_contas_receber_anexos" alter column empresa_id set not null;
alter table "public"."movelaria_contas_receber_anexos" add constraint tnt_126070e89f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_126070e89f_idx on "public"."movelaria_contas_receber_anexos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_contas_receber_anexos";
create trigger aaa_tenant_fill before insert on "public"."movelaria_contas_receber_anexos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_contas_receber_anexos";
create policy tenant_isolamento on "public"."movelaria_contas_receber_anexos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_contas_receber_anexos";
create policy tenant_definer on "public"."movelaria_contas_receber_anexos" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_escritorio_arquivos
alter table "public"."movelaria_escritorio_arquivos" add column empresa_id uuid;
update "public"."movelaria_escritorio_arquivos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_escritorio_arquivos" alter column empresa_id set not null;
alter table "public"."movelaria_escritorio_arquivos" add constraint tnt_bfcb52e56d_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_bfcb52e56d_idx on "public"."movelaria_escritorio_arquivos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_escritorio_arquivos";
create trigger aaa_tenant_fill before insert on "public"."movelaria_escritorio_arquivos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_escritorio_arquivos";
create policy tenant_isolamento on "public"."movelaria_escritorio_arquivos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_escritorio_arquivos";
create policy tenant_definer on "public"."movelaria_escritorio_arquivos" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_escritorio_pastas
alter table "public"."movelaria_escritorio_pastas" add column empresa_id uuid;
update "public"."movelaria_escritorio_pastas" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_escritorio_pastas" alter column empresa_id set not null;
alter table "public"."movelaria_escritorio_pastas" add constraint tnt_864ac3d71d_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_864ac3d71d_idx on "public"."movelaria_escritorio_pastas" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_escritorio_pastas";
create trigger aaa_tenant_fill before insert on "public"."movelaria_escritorio_pastas" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_escritorio_pastas";
create policy tenant_isolamento on "public"."movelaria_escritorio_pastas" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_escritorio_pastas";
create policy tenant_definer on "public"."movelaria_escritorio_pastas" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_fin_templates_copia
alter table "public"."movelaria_fin_templates_copia" add column empresa_id uuid;
update "public"."movelaria_fin_templates_copia" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_fin_templates_copia" alter column empresa_id set not null;
alter table "public"."movelaria_fin_templates_copia" add constraint tnt_cb6105d91b_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_cb6105d91b_idx on "public"."movelaria_fin_templates_copia" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_fin_templates_copia";
create trigger aaa_tenant_fill before insert on "public"."movelaria_fin_templates_copia" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_fin_templates_copia";
create policy tenant_isolamento on "public"."movelaria_fin_templates_copia" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_fin_templates_copia";
create policy tenant_definer on "public"."movelaria_fin_templates_copia" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_formas_pagamento_pagar
alter table "public"."movelaria_formas_pagamento_pagar" add column empresa_id uuid;
update "public"."movelaria_formas_pagamento_pagar" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_formas_pagamento_pagar" alter column empresa_id set not null;
alter table "public"."movelaria_formas_pagamento_pagar" add constraint tnt_e2f30ba66a_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_e2f30ba66a_idx on "public"."movelaria_formas_pagamento_pagar" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_formas_pagamento_pagar";
create trigger aaa_tenant_fill before insert on "public"."movelaria_formas_pagamento_pagar" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_formas_pagamento_pagar";
create policy tenant_isolamento on "public"."movelaria_formas_pagamento_pagar" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_formas_pagamento_pagar";
create policy tenant_definer on "public"."movelaria_formas_pagamento_pagar" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_fornecedores
alter table "public"."movelaria_fornecedores" add column empresa_id uuid;
update "public"."movelaria_fornecedores" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_fornecedores" alter column empresa_id set not null;
alter table "public"."movelaria_fornecedores" add constraint tnt_22fa5e3f7e_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_22fa5e3f7e_idx on "public"."movelaria_fornecedores" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_fornecedores";
create trigger aaa_tenant_fill before insert on "public"."movelaria_fornecedores" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_fornecedores";
create policy tenant_isolamento on "public"."movelaria_fornecedores" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_fornecedores";
create policy tenant_definer on "public"."movelaria_fornecedores" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_funcionario_documentos
alter table "public"."movelaria_funcionario_documentos" add column empresa_id uuid;
update "public"."movelaria_funcionario_documentos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_funcionario_documentos" alter column empresa_id set not null;
alter table "public"."movelaria_funcionario_documentos" add constraint tnt_9e07a27c58_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_9e07a27c58_idx on "public"."movelaria_funcionario_documentos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_funcionario_documentos";
create trigger aaa_tenant_fill before insert on "public"."movelaria_funcionario_documentos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_funcionario_documentos";
create policy tenant_isolamento on "public"."movelaria_funcionario_documentos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_funcionario_documentos";
create policy tenant_definer on "public"."movelaria_funcionario_documentos" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_funcionario_jornada
alter table "public"."movelaria_funcionario_jornada" add column empresa_id uuid;
update "public"."movelaria_funcionario_jornada" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_funcionario_jornada" alter column empresa_id set not null;
alter table "public"."movelaria_funcionario_jornada" add constraint tnt_32e2dbe58d_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_32e2dbe58d_idx on "public"."movelaria_funcionario_jornada" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_funcionario_jornada";
create trigger aaa_tenant_fill before insert on "public"."movelaria_funcionario_jornada" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_funcionario_jornada";
create policy tenant_isolamento on "public"."movelaria_funcionario_jornada" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_funcionario_jornada";
create policy tenant_definer on "public"."movelaria_funcionario_jornada" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_funcionario_ponto_atestados
alter table "public"."movelaria_funcionario_ponto_atestados" add column empresa_id uuid;
update "public"."movelaria_funcionario_ponto_atestados" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_funcionario_ponto_atestados" alter column empresa_id set not null;
alter table "public"."movelaria_funcionario_ponto_atestados" add constraint tnt_d7fbc9ad09_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_d7fbc9ad09_idx on "public"."movelaria_funcionario_ponto_atestados" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_funcionario_ponto_atestados";
create trigger aaa_tenant_fill before insert on "public"."movelaria_funcionario_ponto_atestados" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_funcionario_ponto_atestados";
create policy tenant_isolamento on "public"."movelaria_funcionario_ponto_atestados" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_funcionario_ponto_atestados";
create policy tenant_definer on "public"."movelaria_funcionario_ponto_atestados" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_funcionario_ponto_marcacoes
alter table "public"."movelaria_funcionario_ponto_marcacoes" add column empresa_id uuid;
update "public"."movelaria_funcionario_ponto_marcacoes" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_funcionario_ponto_marcacoes" alter column empresa_id set not null;
alter table "public"."movelaria_funcionario_ponto_marcacoes" add constraint tnt_88440cf699_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_88440cf699_idx on "public"."movelaria_funcionario_ponto_marcacoes" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_funcionario_ponto_marcacoes";
create trigger aaa_tenant_fill before insert on "public"."movelaria_funcionario_ponto_marcacoes" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_funcionario_ponto_marcacoes";
create policy tenant_isolamento on "public"."movelaria_funcionario_ponto_marcacoes" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_funcionario_ponto_marcacoes";
create policy tenant_definer on "public"."movelaria_funcionario_ponto_marcacoes" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_funcionario_ponto_ocorrencias
alter table "public"."movelaria_funcionario_ponto_ocorrencias" add column empresa_id uuid;
update "public"."movelaria_funcionario_ponto_ocorrencias" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_funcionario_ponto_ocorrencias" alter column empresa_id set not null;
alter table "public"."movelaria_funcionario_ponto_ocorrencias" add constraint tnt_402b548e6f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_402b548e6f_idx on "public"."movelaria_funcionario_ponto_ocorrencias" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_funcionario_ponto_ocorrencias";
create trigger aaa_tenant_fill before insert on "public"."movelaria_funcionario_ponto_ocorrencias" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_funcionario_ponto_ocorrencias";
create policy tenant_isolamento on "public"."movelaria_funcionario_ponto_ocorrencias" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_funcionario_ponto_ocorrencias";
create policy tenant_definer on "public"."movelaria_funcionario_ponto_ocorrencias" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_funcionario_recibos
alter table "public"."movelaria_funcionario_recibos" add column empresa_id uuid;
update "public"."movelaria_funcionario_recibos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_funcionario_recibos" alter column empresa_id set not null;
alter table "public"."movelaria_funcionario_recibos" add constraint tnt_9f679fc04e_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_9f679fc04e_idx on "public"."movelaria_funcionario_recibos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_funcionario_recibos";
create trigger aaa_tenant_fill before insert on "public"."movelaria_funcionario_recibos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_funcionario_recibos";
create policy tenant_isolamento on "public"."movelaria_funcionario_recibos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_funcionario_recibos";
create policy tenant_definer on "public"."movelaria_funcionario_recibos" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_funcionarios
alter table "public"."movelaria_funcionarios" add column empresa_id uuid;
update "public"."movelaria_funcionarios" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_funcionarios" alter column empresa_id set not null;
alter table "public"."movelaria_funcionarios" add constraint tnt_09e821db15_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_09e821db15_idx on "public"."movelaria_funcionarios" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_funcionarios";
create trigger aaa_tenant_fill before insert on "public"."movelaria_funcionarios" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_funcionarios";
create policy tenant_isolamento on "public"."movelaria_funcionarios" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_funcionarios";
create policy tenant_definer on "public"."movelaria_funcionarios" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_grupos_obra
alter table "public"."movelaria_grupos_obra" add column empresa_id uuid;
update "public"."movelaria_grupos_obra" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_grupos_obra" alter column empresa_id set not null;
alter table "public"."movelaria_grupos_obra" add constraint tnt_7b6d3067fc_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_7b6d3067fc_idx on "public"."movelaria_grupos_obra" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_grupos_obra";
create trigger aaa_tenant_fill before insert on "public"."movelaria_grupos_obra" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_grupos_obra";
create policy tenant_isolamento on "public"."movelaria_grupos_obra" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_grupos_obra";
create policy tenant_definer on "public"."movelaria_grupos_obra" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_kanban_colunas_obra
alter table "public"."movelaria_kanban_colunas_obra" add column empresa_id uuid;
update "public"."movelaria_kanban_colunas_obra" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_kanban_colunas_obra" alter column empresa_id set not null;
alter table "public"."movelaria_kanban_colunas_obra" add constraint tnt_22325ba278_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_22325ba278_idx on "public"."movelaria_kanban_colunas_obra" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_kanban_colunas_obra";
create trigger aaa_tenant_fill before insert on "public"."movelaria_kanban_colunas_obra" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_kanban_colunas_obra";
create policy tenant_isolamento on "public"."movelaria_kanban_colunas_obra" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_kanban_colunas_obra";
create policy tenant_definer on "public"."movelaria_kanban_colunas_obra" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_leads_ganhos_excluidos
alter table "public"."movelaria_leads_ganhos_excluidos" add column empresa_id uuid;
update "public"."movelaria_leads_ganhos_excluidos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_leads_ganhos_excluidos" alter column empresa_id set not null;
alter table "public"."movelaria_leads_ganhos_excluidos" add constraint tnt_fe871fd245_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_fe871fd245_idx on "public"."movelaria_leads_ganhos_excluidos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_leads_ganhos_excluidos";
create trigger aaa_tenant_fill before insert on "public"."movelaria_leads_ganhos_excluidos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_leads_ganhos_excluidos";
create policy tenant_isolamento on "public"."movelaria_leads_ganhos_excluidos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_leads_ganhos_excluidos";
create policy tenant_definer on "public"."movelaria_leads_ganhos_excluidos" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_obra_arquivos
alter table "public"."movelaria_obra_arquivos" add column empresa_id uuid;
update "public"."movelaria_obra_arquivos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_obra_arquivos" alter column empresa_id set not null;
alter table "public"."movelaria_obra_arquivos" add constraint tnt_1be9646116_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_1be9646116_idx on "public"."movelaria_obra_arquivos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_obra_arquivos";
create trigger aaa_tenant_fill before insert on "public"."movelaria_obra_arquivos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_obra_arquivos";
create policy tenant_isolamento on "public"."movelaria_obra_arquivos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_obra_arquivos";
create policy tenant_definer on "public"."movelaria_obra_arquivos" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_obra_briefing_anexos
alter table "public"."movelaria_obra_briefing_anexos" add column empresa_id uuid;
update "public"."movelaria_obra_briefing_anexos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_obra_briefing_anexos" alter column empresa_id set not null;
alter table "public"."movelaria_obra_briefing_anexos" add constraint tnt_801097f126_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_801097f126_idx on "public"."movelaria_obra_briefing_anexos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_obra_briefing_anexos";
create trigger aaa_tenant_fill before insert on "public"."movelaria_obra_briefing_anexos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_obra_briefing_anexos";
create policy tenant_isolamento on "public"."movelaria_obra_briefing_anexos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_obra_briefing_anexos";
create policy tenant_definer on "public"."movelaria_obra_briefing_anexos" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_obra_briefing_respostas
alter table "public"."movelaria_obra_briefing_respostas" add column empresa_id uuid;
update "public"."movelaria_obra_briefing_respostas" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_obra_briefing_respostas" alter column empresa_id set not null;
alter table "public"."movelaria_obra_briefing_respostas" add constraint tnt_4703d9e6c3_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_4703d9e6c3_idx on "public"."movelaria_obra_briefing_respostas" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_obra_briefing_respostas";
create trigger aaa_tenant_fill before insert on "public"."movelaria_obra_briefing_respostas" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_obra_briefing_respostas";
create policy tenant_isolamento on "public"."movelaria_obra_briefing_respostas" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_obra_briefing_respostas";
create policy tenant_definer on "public"."movelaria_obra_briefing_respostas" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_obra_briefings
alter table "public"."movelaria_obra_briefings" add column empresa_id uuid;
update "public"."movelaria_obra_briefings" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_obra_briefings" alter column empresa_id set not null;
alter table "public"."movelaria_obra_briefings" add constraint tnt_d157cb2d3b_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_d157cb2d3b_idx on "public"."movelaria_obra_briefings" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_obra_briefings";
create trigger aaa_tenant_fill before insert on "public"."movelaria_obra_briefings" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_obra_briefings";
create policy tenant_isolamento on "public"."movelaria_obra_briefings" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_obra_briefings";
create policy tenant_definer on "public"."movelaria_obra_briefings" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_obra_comissao_itens
alter table "public"."movelaria_obra_comissao_itens" add column empresa_id uuid;
update "public"."movelaria_obra_comissao_itens" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_obra_comissao_itens" alter column empresa_id set not null;
alter table "public"."movelaria_obra_comissao_itens" add constraint tnt_787c47da36_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_787c47da36_idx on "public"."movelaria_obra_comissao_itens" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_obra_comissao_itens";
create trigger aaa_tenant_fill before insert on "public"."movelaria_obra_comissao_itens" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_obra_comissao_itens";
create policy tenant_isolamento on "public"."movelaria_obra_comissao_itens" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_obra_comissao_itens";
create policy tenant_definer on "public"."movelaria_obra_comissao_itens" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_obra_evolucao
alter table "public"."movelaria_obra_evolucao" add column empresa_id uuid;
update "public"."movelaria_obra_evolucao" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_obra_evolucao" alter column empresa_id set not null;
alter table "public"."movelaria_obra_evolucao" add constraint tnt_d4a636a523_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_d4a636a523_idx on "public"."movelaria_obra_evolucao" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_obra_evolucao";
create trigger aaa_tenant_fill before insert on "public"."movelaria_obra_evolucao" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_obra_evolucao";
create policy tenant_isolamento on "public"."movelaria_obra_evolucao" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_obra_evolucao";
create policy tenant_definer on "public"."movelaria_obra_evolucao" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_obra_lousa_drawings
alter table "public"."movelaria_obra_lousa_drawings" add column empresa_id uuid;
update "public"."movelaria_obra_lousa_drawings" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_obra_lousa_drawings" alter column empresa_id set not null;
alter table "public"."movelaria_obra_lousa_drawings" add constraint tnt_a7e35f3bf3_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_a7e35f3bf3_idx on "public"."movelaria_obra_lousa_drawings" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_obra_lousa_drawings";
create trigger aaa_tenant_fill before insert on "public"."movelaria_obra_lousa_drawings" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_obra_lousa_drawings";
create policy tenant_isolamento on "public"."movelaria_obra_lousa_drawings" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_obra_lousa_drawings";
create policy tenant_definer on "public"."movelaria_obra_lousa_drawings" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_obra_lousa_images
alter table "public"."movelaria_obra_lousa_images" add column empresa_id uuid;
update "public"."movelaria_obra_lousa_images" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_obra_lousa_images" alter column empresa_id set not null;
alter table "public"."movelaria_obra_lousa_images" add constraint tnt_833464aab3_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_833464aab3_idx on "public"."movelaria_obra_lousa_images" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_obra_lousa_images";
create trigger aaa_tenant_fill before insert on "public"."movelaria_obra_lousa_images" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_obra_lousa_images";
create policy tenant_isolamento on "public"."movelaria_obra_lousa_images" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_obra_lousa_images";
create policy tenant_definer on "public"."movelaria_obra_lousa_images" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_obra_lousa_text_config
alter table "public"."movelaria_obra_lousa_text_config" add column empresa_id uuid;
update "public"."movelaria_obra_lousa_text_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_obra_lousa_text_config" alter column empresa_id set not null;
alter table "public"."movelaria_obra_lousa_text_config" add constraint tnt_07034eb602_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_07034eb602_idx on "public"."movelaria_obra_lousa_text_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_obra_lousa_text_config";
create trigger aaa_tenant_fill before insert on "public"."movelaria_obra_lousa_text_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_obra_lousa_text_config";
create policy tenant_isolamento on "public"."movelaria_obra_lousa_text_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_obra_lousa_text_config";
create policy tenant_definer on "public"."movelaria_obra_lousa_text_config" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_obra_markup_custos_filtro
alter table "public"."movelaria_obra_markup_custos_filtro" add column empresa_id uuid;
update "public"."movelaria_obra_markup_custos_filtro" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_obra_markup_custos_filtro" alter column empresa_id set not null;
alter table "public"."movelaria_obra_markup_custos_filtro" add constraint tnt_7bb9341b57_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_7bb9341b57_idx on "public"."movelaria_obra_markup_custos_filtro" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_obra_markup_custos_filtro";
create trigger aaa_tenant_fill before insert on "public"."movelaria_obra_markup_custos_filtro" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_obra_markup_custos_filtro";
create policy tenant_isolamento on "public"."movelaria_obra_markup_custos_filtro" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_obra_markup_custos_filtro";
create policy tenant_definer on "public"."movelaria_obra_markup_custos_filtro" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_obra_responsaveis
alter table "public"."movelaria_obra_responsaveis" add column empresa_id uuid;
update "public"."movelaria_obra_responsaveis" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_obra_responsaveis" alter column empresa_id set not null;
alter table "public"."movelaria_obra_responsaveis" add constraint tnt_450e90d261_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_450e90d261_idx on "public"."movelaria_obra_responsaveis" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_obra_responsaveis";
create trigger aaa_tenant_fill before insert on "public"."movelaria_obra_responsaveis" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_obra_responsaveis";
create policy tenant_isolamento on "public"."movelaria_obra_responsaveis" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_obra_responsaveis";
create policy tenant_definer on "public"."movelaria_obra_responsaveis" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_obras
alter table "public"."movelaria_obras" add column empresa_id uuid;
update "public"."movelaria_obras" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_obras" alter column empresa_id set not null;
alter table "public"."movelaria_obras" add constraint tnt_41e000393d_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_41e000393d_idx on "public"."movelaria_obras" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_obras";
create trigger aaa_tenant_fill before insert on "public"."movelaria_obras" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_obras";
create policy tenant_isolamento on "public"."movelaria_obras" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_obras";
create policy tenant_definer on "public"."movelaria_obras" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_obras_datas_historico
alter table "public"."movelaria_obras_datas_historico" add column empresa_id uuid;
update "public"."movelaria_obras_datas_historico" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_obras_datas_historico" alter column empresa_id set not null;
alter table "public"."movelaria_obras_datas_historico" add constraint tnt_bf235f5c6d_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_bf235f5c6d_idx on "public"."movelaria_obras_datas_historico" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_obras_datas_historico";
create trigger aaa_tenant_fill before insert on "public"."movelaria_obras_datas_historico" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_obras_datas_historico";
create policy tenant_isolamento on "public"."movelaria_obras_datas_historico" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_obras_datas_historico";
create policy tenant_definer on "public"."movelaria_obras_datas_historico" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_orcamentos_fechados
alter table "public"."movelaria_orcamentos_fechados" add column empresa_id uuid;
update "public"."movelaria_orcamentos_fechados" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_orcamentos_fechados" alter column empresa_id set not null;
alter table "public"."movelaria_orcamentos_fechados" add constraint tnt_659a233841_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_659a233841_idx on "public"."movelaria_orcamentos_fechados" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_orcamentos_fechados";
create trigger aaa_tenant_fill before insert on "public"."movelaria_orcamentos_fechados" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_orcamentos_fechados";
create policy tenant_isolamento on "public"."movelaria_orcamentos_fechados" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_orcamentos_fechados";
create policy tenant_definer on "public"."movelaria_orcamentos_fechados" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_page_zoom
alter table "public"."movelaria_page_zoom" add column empresa_id uuid;
update "public"."movelaria_page_zoom" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_page_zoom" alter column empresa_id set not null;
alter table "public"."movelaria_page_zoom" add constraint tnt_a823fd682c_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_a823fd682c_idx on "public"."movelaria_page_zoom" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_page_zoom";
create trigger aaa_tenant_fill before insert on "public"."movelaria_page_zoom" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_page_zoom";
create policy tenant_isolamento on "public"."movelaria_page_zoom" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_page_zoom";
create policy tenant_definer on "public"."movelaria_page_zoom" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_pedidos
alter table "public"."movelaria_pedidos" add column empresa_id uuid;
update "public"."movelaria_pedidos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_pedidos" alter column empresa_id set not null;
alter table "public"."movelaria_pedidos" add constraint tnt_cad60dabb7_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_cad60dabb7_idx on "public"."movelaria_pedidos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_pedidos";
create trigger aaa_tenant_fill before insert on "public"."movelaria_pedidos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_pedidos";
create policy tenant_isolamento on "public"."movelaria_pedidos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_pedidos";
create policy tenant_definer on "public"."movelaria_pedidos" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_pedidos_anexos
alter table "public"."movelaria_pedidos_anexos" add column empresa_id uuid;
update "public"."movelaria_pedidos_anexos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_pedidos_anexos" alter column empresa_id set not null;
alter table "public"."movelaria_pedidos_anexos" add constraint tnt_4db3ae2564_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_4db3ae2564_idx on "public"."movelaria_pedidos_anexos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_pedidos_anexos";
create trigger aaa_tenant_fill before insert on "public"."movelaria_pedidos_anexos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_pedidos_anexos";
create policy tenant_isolamento on "public"."movelaria_pedidos_anexos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_pedidos_anexos";
create policy tenant_definer on "public"."movelaria_pedidos_anexos" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_pedidos_itens
alter table "public"."movelaria_pedidos_itens" add column empresa_id uuid;
update "public"."movelaria_pedidos_itens" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_pedidos_itens" alter column empresa_id set not null;
alter table "public"."movelaria_pedidos_itens" add constraint tnt_f9d970b453_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_f9d970b453_idx on "public"."movelaria_pedidos_itens" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_pedidos_itens";
create trigger aaa_tenant_fill before insert on "public"."movelaria_pedidos_itens" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_pedidos_itens";
create policy tenant_isolamento on "public"."movelaria_pedidos_itens" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_pedidos_itens";
create policy tenant_definer on "public"."movelaria_pedidos_itens" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_pix_config
alter table "public"."movelaria_pix_config" add column empresa_id uuid;
update "public"."movelaria_pix_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_pix_config" alter column empresa_id set not null;
alter table "public"."movelaria_pix_config" add constraint tnt_3721dd58ac_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_3721dd58ac_idx on "public"."movelaria_pix_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_pix_config";
create trigger aaa_tenant_fill before insert on "public"."movelaria_pix_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_pix_config";
create policy tenant_isolamento on "public"."movelaria_pix_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_pix_config";
create policy tenant_definer on "public"."movelaria_pix_config" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_ponto_banco_movimentos
alter table "public"."movelaria_ponto_banco_movimentos" add column empresa_id uuid;
update "public"."movelaria_ponto_banco_movimentos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_ponto_banco_movimentos" alter column empresa_id set not null;
alter table "public"."movelaria_ponto_banco_movimentos" add constraint tnt_a2b7880392_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_a2b7880392_idx on "public"."movelaria_ponto_banco_movimentos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_ponto_banco_movimentos";
create trigger aaa_tenant_fill before insert on "public"."movelaria_ponto_banco_movimentos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_ponto_banco_movimentos";
create policy tenant_isolamento on "public"."movelaria_ponto_banco_movimentos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_ponto_banco_movimentos";
create policy tenant_definer on "public"."movelaria_ponto_banco_movimentos" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_produtos
alter table "public"."movelaria_produtos" add column empresa_id uuid;
update "public"."movelaria_produtos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_produtos" alter column empresa_id set not null;
alter table "public"."movelaria_produtos" add constraint tnt_52048883b4_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_52048883b4_idx on "public"."movelaria_produtos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_produtos";
create trigger aaa_tenant_fill before insert on "public"."movelaria_produtos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_produtos";
create policy tenant_isolamento on "public"."movelaria_produtos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_produtos";
create policy tenant_definer on "public"."movelaria_produtos" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_recibo_config
alter table "public"."movelaria_recibo_config" add column empresa_id uuid;
update "public"."movelaria_recibo_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_recibo_config" alter column empresa_id set not null;
alter table "public"."movelaria_recibo_config" add constraint tnt_e23bffc11d_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_e23bffc11d_idx on "public"."movelaria_recibo_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_recibo_config";
create trigger aaa_tenant_fill before insert on "public"."movelaria_recibo_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_recibo_config";
create policy tenant_isolamento on "public"."movelaria_recibo_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_recibo_config";
create policy tenant_definer on "public"."movelaria_recibo_config" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_recibo_prestador_config
alter table "public"."movelaria_recibo_prestador_config" add column empresa_id uuid;
update "public"."movelaria_recibo_prestador_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_recibo_prestador_config" alter column empresa_id set not null;
alter table "public"."movelaria_recibo_prestador_config" add constraint tnt_079b84dd0f_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_079b84dd0f_idx on "public"."movelaria_recibo_prestador_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_recibo_prestador_config";
create trigger aaa_tenant_fill before insert on "public"."movelaria_recibo_prestador_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_recibo_prestador_config";
create policy tenant_isolamento on "public"."movelaria_recibo_prestador_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_recibo_prestador_config";
create policy tenant_definer on "public"."movelaria_recibo_prestador_config" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_rep_arquivos
alter table "public"."movelaria_rep_arquivos" add column empresa_id uuid;
update "public"."movelaria_rep_arquivos" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_rep_arquivos" alter column empresa_id set not null;
alter table "public"."movelaria_rep_arquivos" add constraint tnt_2033f3981e_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_2033f3981e_idx on "public"."movelaria_rep_arquivos" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_rep_arquivos";
create trigger aaa_tenant_fill before insert on "public"."movelaria_rep_arquivos" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_rep_arquivos";
create policy tenant_isolamento on "public"."movelaria_rep_arquivos" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_rep_arquivos";
create policy tenant_definer on "public"."movelaria_rep_arquivos" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_rep_config
alter table "public"."movelaria_rep_config" add column empresa_id uuid;
update "public"."movelaria_rep_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_rep_config" alter column empresa_id set not null;
alter table "public"."movelaria_rep_config" add constraint tnt_ee21c976d3_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_ee21c976d3_idx on "public"."movelaria_rep_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_rep_config";
create trigger aaa_tenant_fill before insert on "public"."movelaria_rep_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_rep_config";
create policy tenant_isolamento on "public"."movelaria_rep_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_rep_config";
create policy tenant_definer on "public"."movelaria_rep_config" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_simulador_caixa
alter table "public"."movelaria_simulador_caixa" add column empresa_id uuid;
update "public"."movelaria_simulador_caixa" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_simulador_caixa" alter column empresa_id set not null;
alter table "public"."movelaria_simulador_caixa" add constraint tnt_fabbf81162_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_fabbf81162_idx on "public"."movelaria_simulador_caixa" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_simulador_caixa";
create trigger aaa_tenant_fill before insert on "public"."movelaria_simulador_caixa" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_simulador_caixa";
create policy tenant_isolamento on "public"."movelaria_simulador_caixa" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_simulador_caixa";
create policy tenant_definer on "public"."movelaria_simulador_caixa" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_tipos_obra
alter table "public"."movelaria_tipos_obra" add column empresa_id uuid;
update "public"."movelaria_tipos_obra" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_tipos_obra" alter column empresa_id set not null;
alter table "public"."movelaria_tipos_obra" add constraint tnt_bf76600028_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_bf76600028_idx on "public"."movelaria_tipos_obra" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_tipos_obra";
create trigger aaa_tenant_fill before insert on "public"."movelaria_tipos_obra" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_tipos_obra";
create policy tenant_isolamento on "public"."movelaria_tipos_obra" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_tipos_obra";
create policy tenant_definer on "public"."movelaria_tipos_obra" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_transacoes_caixa_fornecedor
alter table "public"."movelaria_transacoes_caixa_fornecedor" add column empresa_id uuid;
update "public"."movelaria_transacoes_caixa_fornecedor" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_transacoes_caixa_fornecedor" alter column empresa_id set not null;
alter table "public"."movelaria_transacoes_caixa_fornecedor" add constraint tnt_a80ae61003_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_a80ae61003_idx on "public"."movelaria_transacoes_caixa_fornecedor" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_transacoes_caixa_fornecedor";
create trigger aaa_tenant_fill before insert on "public"."movelaria_transacoes_caixa_fornecedor" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_transacoes_caixa_fornecedor";
create policy tenant_isolamento on "public"."movelaria_transacoes_caixa_fornecedor" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_transacoes_caixa_fornecedor";
create policy tenant_definer on "public"."movelaria_transacoes_caixa_fornecedor" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_transacoes_historico
alter table "public"."movelaria_transacoes_historico" add column empresa_id uuid;
update "public"."movelaria_transacoes_historico" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_transacoes_historico" alter column empresa_id set not null;
alter table "public"."movelaria_transacoes_historico" add constraint tnt_4cac226bd1_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_4cac226bd1_idx on "public"."movelaria_transacoes_historico" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_transacoes_historico";
create trigger aaa_tenant_fill before insert on "public"."movelaria_transacoes_historico" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_transacoes_historico";
create policy tenant_isolamento on "public"."movelaria_transacoes_historico" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_transacoes_historico";
create policy tenant_definer on "public"."movelaria_transacoes_historico" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_ui_settings
alter table "public"."movelaria_ui_settings" add column empresa_id uuid;
update "public"."movelaria_ui_settings" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_ui_settings" alter column empresa_id set not null;
alter table "public"."movelaria_ui_settings" add constraint tnt_752ddc1cce_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_752ddc1cce_idx on "public"."movelaria_ui_settings" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_ui_settings";
create trigger aaa_tenant_fill before insert on "public"."movelaria_ui_settings" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_ui_settings";
create policy tenant_isolamento on "public"."movelaria_ui_settings" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_ui_settings";
create policy tenant_definer on "public"."movelaria_ui_settings" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_usuarios
alter table "public"."movelaria_usuarios" add column empresa_id uuid;
update "public"."movelaria_usuarios" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_usuarios" alter column empresa_id set not null;
alter table "public"."movelaria_usuarios" add constraint tnt_1c977132bc_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_1c977132bc_idx on "public"."movelaria_usuarios" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_usuarios";
create trigger aaa_tenant_fill before insert on "public"."movelaria_usuarios" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_usuarios";
create policy tenant_isolamento on "public"."movelaria_usuarios" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_usuarios";
create policy tenant_definer on "public"."movelaria_usuarios" for all to app_tenant_definer using (true) with check (true);

-- public.movelaria_visualizacao_config
alter table "public"."movelaria_visualizacao_config" add column empresa_id uuid;
update "public"."movelaria_visualizacao_config" set empresa_id = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' where empresa_id is null;
alter table "public"."movelaria_visualizacao_config" alter column empresa_id set not null;
alter table "public"."movelaria_visualizacao_config" add constraint tnt_bdc5cb2ebc_fk foreign key (empresa_id) references public."CRM-multi-empresas>empresas<"(id) on delete cascade;
create index if not exists tnt_bdc5cb2ebc_idx on "public"."movelaria_visualizacao_config" (empresa_id);
drop trigger if exists aaa_tenant_fill on "public"."movelaria_visualizacao_config";
create trigger aaa_tenant_fill before insert on "public"."movelaria_visualizacao_config" for each row execute function public.app_tenant_fill();
drop policy if exists tenant_isolamento on "public"."movelaria_visualizacao_config";
create policy tenant_isolamento on "public"."movelaria_visualizacao_config" as restrictive for all to public using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on "public"."movelaria_visualizacao_config";
create policy tenant_definer on "public"."movelaria_visualizacao_config" for all to app_tenant_definer using (true) with check (true);

