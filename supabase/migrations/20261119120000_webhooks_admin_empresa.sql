-- Fontes de mensagem (webhooks): a policy de escrita só aceitava me_is_admin(), que lê a tabela de
-- papéis legada (vazia no multi-empresa). Resultado: só o master conseguia cadastrar.
-- Agora o admin da empresa ativa (crm.user_roles) também grava. O isolamento por empresa
-- (tenant_isolamento) e o bloqueio do modo somente leitura continuam valendo (são RESTRICTIVE).
drop policy if exists tenant_admin_webhooks on public."CRM-multi-empresas>webhooks_api<";
create policy tenant_admin_webhooks on public."CRM-multi-empresas>webhooks_api<"
  for all to authenticated
  using (exists (select 1 from crm.user_roles r
                  where r.user_id = (select auth.uid()) and r.empresa_id = (select public.app_empresa_atual())
                    and r.role = 'admin'))
  with check (exists (select 1 from crm.user_roles r
                       where r.user_id = (select auth.uid()) and r.empresa_id = (select public.app_empresa_atual())
                         and r.role = 'admin'));
