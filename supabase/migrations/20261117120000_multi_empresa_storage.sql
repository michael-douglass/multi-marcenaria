-- M07 — Storage por empresa.
-- Em vez de prefixar ~30 caminhos de upload, o isolamento usa o DONO do objeto (owner_id, gravado pelo
-- Storage a partir do JWT): só se enxerga/altera objeto enviado por alguém da mesma empresa.
-- Objetos sem dono (gravados por edge functions com service role) continuam valendo só pelas policies
-- de papel; os caminhos deles contêm UUIDs. Ver docs/multi-empresa/DESIGN.md §3.

create or replace function public.app_usuario_da_empresa_atual(p_user text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select p_user is null
      -- arquivos enviados pelo master ficam visíveis na empresa em que ele estava trabalhando
      or exists (select 1 from "CRM-multi-empresas>super_admins<" sa where sa.user_id::text = p_user)
      or exists (
        select 1 from "CRM-multi-empresas>usuario_empresa<" ue
         where ue.user_id::text = p_user
           and ue.empresa_id = public.app_empresa_atual()
      );
$$;
grant execute on function public.app_usuario_da_empresa_atual(text) to anon, authenticated, app_tenant_definer;

drop policy if exists tenant_isolamento_storage on storage.objects;
create policy tenant_isolamento_storage on storage.objects
  as restrictive for all to authenticated
  using (public.app_usuario_da_empresa_atual(coalesce(owner_id, owner::text)))
  with check (public.app_usuario_da_empresa_atual(coalesce(owner_id, owner::text)));
