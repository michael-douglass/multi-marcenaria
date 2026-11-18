-- M42 — Páginas liberadas por plano e por empresa (lista de BLOQUEIO: página nova nasce liberada).
-- Os ids de página são os ids do menu (src/lib/paginas-catalogo.ts).

alter table public.plataforma_planos
  add column if not exists paginas_bloqueadas text[] not null default '{}';

create table if not exists public.plataforma_empresa_paginas (
  empresa_id uuid not null references public."CRM-multi-empresas>empresas<"(id) on delete cascade,
  pagina_id text not null check (pagina_id ~ '^[A-Za-z0-9_çÇ:-]+$'),
  habilitada boolean not null,
  atualizado_em timestamptz not null default now(),
  primary key (empresa_id, pagina_id)
);
alter table public.plataforma_empresa_paginas enable row level security;
drop policy if exists plataforma_master on public.plataforma_empresa_paginas;
create policy plataforma_master on public.plataforma_empresa_paginas
  for all to authenticated using (public.app_is_master()) with check (public.app_is_master());
revoke all on public.plataforma_empresa_paginas from anon;

-- (bloqueios do plano ∪ ajustes "bloquear") − ajustes "liberar"
create or replace function public.app_paginas_bloqueadas(p_empresa uuid)
returns text[] language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(array_agg(distinct x order by x), '{}')
    from (
      select unnest(pl.paginas_bloqueadas) as x
        from plataforma_assinaturas a
        join plataforma_planos pl on pl.id = a.plano_id
       where a.empresa_id = p_empresa
      union
      select ep.pagina_id from plataforma_empresa_paginas ep
       where ep.empresa_id = p_empresa and not ep.habilitada
    ) b
   where x not in (select ep.pagina_id from plataforma_empresa_paginas ep
                    where ep.empresa_id = p_empresa and ep.habilitada);
$$;
revoke all on function public.app_paginas_bloqueadas(uuid) from public, anon, authenticated;

-- Páginas do plano (master).
create or replace function public.master_salvar_paginas_plano(p_plano uuid, p_bloqueadas text[])
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  if not public.app_is_master() then
    raise exception 'Apenas o usuário master' using errcode = '42501';
  end if;
  update plataforma_planos
     set paginas_bloqueadas = coalesce((select array_agg(distinct x order by x) from unnest(p_bloqueadas) x where x <> ''), '{}')
   where id = p_plano;
  if not found then raise exception 'Plano não encontrado' using errcode = 'P0002'; end if;
end $$;
revoke all on function public.master_salvar_paginas_plano(uuid, text[]) from public, anon;
grant execute on function public.master_salvar_paginas_plano(uuid, text[]) to authenticated;

-- Ajustes da empresa (master). p_ajustes = {"pagina_id": true|false, ...}; substitui todos os ajustes.
create or replace function public.master_salvar_paginas_empresa(p_empresa uuid, p_ajustes jsonb)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  if not public.app_is_master() then
    raise exception 'Apenas o usuário master' using errcode = '42501';
  end if;
  if not exists (select 1 from "CRM-multi-empresas>empresas<" where id = p_empresa) then
    raise exception 'Empresa não encontrada' using errcode = 'P0002';
  end if;
  delete from plataforma_empresa_paginas where empresa_id = p_empresa;
  insert into plataforma_empresa_paginas (empresa_id, pagina_id, habilitada)
  select p_empresa, k, (v)::boolean
    from jsonb_each_text(coalesce(p_ajustes, '{}'::jsonb)) as j(k, v)
   where k <> '';
end $$;
revoke all on function public.master_salvar_paginas_empresa(uuid, jsonb) from public, anon;
grant execute on function public.master_salvar_paginas_empresa(uuid, jsonb) to authenticated;

-- Situação de páginas de uma empresa para o editor do master: plano + ajustes + resultado.
create or replace function public.master_paginas_empresa(p_empresa uuid)
returns table (plano_id uuid, plano_nome text, plano_bloqueadas text[], ajustes jsonb, bloqueadas text[])
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.app_is_master() then
    raise exception 'Apenas o usuário master' using errcode = '42501';
  end if;
  return query
  select pl.id, pl.nome, coalesce(pl.paginas_bloqueadas, '{}'),
         coalesce((select jsonb_object_agg(ep.pagina_id, ep.habilitada) from plataforma_empresa_paginas ep where ep.empresa_id = p_empresa), '{}'::jsonb),
         public.app_paginas_bloqueadas(p_empresa)
    from (select p_empresa as eid) e
    left join plataforma_assinaturas a on a.empresa_id = e.eid
    left join plataforma_planos pl on pl.id = a.plano_id;
end $$;
revoke all on function public.master_paginas_empresa(uuid) from public, anon;
grant execute on function public.master_paginas_empresa(uuid) to authenticated;
