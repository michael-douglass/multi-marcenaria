-- Galeria de anexos (imagem/PDF→imagem) por pasta de evento — não ligada a pessoa/item.

create table if not exists public.crm_multiempresas_evento_midias (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references public.crm_multiempresas_eventos(id) on delete cascade,
  file_url text not null,
  storage_path text,
  file_name text,
  anotacoes jsonb not null default '[]'::jsonb,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

create index if not exists crm_multiempresas_evento_midias_evento_idx
  on public.crm_multiempresas_evento_midias (evento_id, ordem, criado_em);

alter table public.crm_multiempresas_evento_midias enable row level security;

drop policy if exists me_evento_midias_all on public.crm_multiempresas_evento_midias;
create policy me_evento_midias_all
  on public.crm_multiempresas_evento_midias
  for all
  using (true)
  with check (true);

create table if not exists emp_garbo.evento_midias (
  id uuid primary key default gen_random_uuid(),
  evento_id uuid not null references emp_garbo.eventos(id) on delete cascade,
  file_url text not null,
  storage_path text,
  file_name text,
  anotacoes jsonb not null default '[]'::jsonb,
  ordem integer not null default 0,
  criado_em timestamptz not null default now()
);

create index if not exists evento_midias_evento_idx
  on emp_garbo.evento_midias (evento_id, ordem, criado_em);

alter table emp_garbo.evento_midias enable row level security;

drop policy if exists me_evento_midias_all on emp_garbo.evento_midias;
create policy me_evento_midias_all
  on emp_garbo.evento_midias
  for all
  using (true)
  with check (true);

grant select, insert, update, delete on public.crm_multiempresas_evento_midias to authenticated, anon, service_role;
grant select, insert, update, delete on emp_garbo.evento_midias to authenticated, anon, service_role;
