-- IA no card lead (docs/ia-lead, T14 + T11 + T17 — ADR 0007): consumo de tokens por empresa, limite mensal
-- no plano (com sobreposição por empresa), checagem de cota para as edge functions e estado para o front.
-- Tabelas plataforma_*: sem aaa_tenant_fill/tenant_isolamento. Bloqueio duro ao estourar o mês.

-- ── limites ────────────────────────────────────────────────────────────────────────────────────
alter table public.plataforma_planos
  add column if not exists ia_tokens_limite_mensal bigint check (ia_tokens_limite_mensal > 0);  -- null = sem limite

create table if not exists public.plataforma_empresa_ia (
  empresa_id uuid primary key references public."CRM-multi-empresas>empresas<"(id) on delete cascade,
  modo text not null default 'plano' check (modo in ('plano', 'personalizado', 'sem_limite')),
  tokens_limite_mensal bigint check (tokens_limite_mensal > 0),
  atualizado_em timestamptz not null default now(),
  check ((modo = 'personalizado') = (tokens_limite_mensal is not null))
);
alter table public.plataforma_empresa_ia enable row level security;
drop policy if exists plataforma_master on public.plataforma_empresa_ia;
create policy plataforma_master on public.plataforma_empresa_ia
  for all to authenticated using (public.app_is_master()) with check (public.app_is_master());
revoke all on public.plataforma_empresa_ia from anon;

-- ── preços (só para estimar custo; não afeta o limite) ─────────────────────────────────────────────
create table if not exists public.plataforma_ia_precos (
  modelo text primary key,
  usd_por_milhao_entrada numeric(12, 4) not null default 0,
  usd_por_milhao_saida numeric(12, 4) not null default 0,
  usd_por_imagem numeric(12, 6) not null default 0,
  atualizado_em timestamptz not null default now()
);
insert into public.plataforma_ia_precos (modelo) values
  ('gpt-4o-mini'), ('gpt-4o'), ('gpt-4.1'), ('gpt-image-1.5'), ('gpt-image-1'), ('dall-e-2')
on conflict do nothing;
alter table public.plataforma_ia_precos enable row level security;
drop policy if exists plataforma_master on public.plataforma_ia_precos;
create policy plataforma_master on public.plataforma_ia_precos
  for all to authenticated using (public.app_is_master()) with check (public.app_is_master());
revoke all on public.plataforma_ia_precos from anon;

-- ── uso ────────────────────────────────────────────────────────────────────────────────────────
create table if not exists public.plataforma_ia_uso (
  id bigint generated always as identity primary key,
  empresa_id uuid not null references public."CRM-multi-empresas>empresas<"(id) on delete cascade,
  user_id uuid,
  funcao text not null check (funcao in ('render_projeto', 'render_ambiente_analise', 'render_ambiente', 'render_edicao')),
  etapa text not null check (etapa in ('visao', 'imagem')),
  modelo text not null,
  lead_id bigint,
  ref_id uuid,
  tokens_entrada integer not null default 0,
  tokens_saida integer not null default 0,
  tokens_total integer not null,
  imagens integer not null default 0,
  estimado boolean not null default false,
  custo_usd numeric(12, 6) not null default 0,
  criado_em timestamptz not null default now()
);
create index if not exists plataforma_ia_uso_empresa_data_idx on public.plataforma_ia_uso (empresa_id, criado_em desc);
create index if not exists plataforma_ia_uso_data_idx on public.plataforma_ia_uso (criado_em);
alter table public.plataforma_ia_uso enable row level security;
drop policy if exists plataforma_master_leitura on public.plataforma_ia_uso;
create policy plataforma_master_leitura on public.plataforma_ia_uso
  for select to authenticated using (public.app_is_master());
revoke all on public.plataforma_ia_uso from anon;
revoke insert, update, delete on public.plataforma_ia_uso from authenticated;

-- Início do mês (America/Sao_Paulo) que contém p_mes (ou hoje).
create or replace function public.plataforma_ia_inicio_mes(p_mes date default null)
returns timestamptz language sql stable set search_path = public, pg_temp as $$
  select date_trunc('month', coalesce(p_mes, (now() at time zone 'America/Sao_Paulo')::date)::timestamp)
         at time zone 'America/Sao_Paulo'
$$;
revoke all on function public.plataforma_ia_inicio_mes(date) from public, anon;
grant execute on function public.plataforma_ia_inicio_mes(date) to authenticated, service_role;

-- Registro de uso: só o service role (edge functions). A empresa vem explícita do chamador (JWT).
create or replace function public.plataforma_ia_registrar_uso(
  p_empresa uuid, p_user uuid, p_funcao text, p_etapa text, p_modelo text, p_lead bigint, p_ref uuid,
  p_tokens_entrada integer, p_tokens_saida integer, p_tokens_total integer, p_imagens integer, p_estimado boolean
) returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare pr record; v_custo numeric := 0;
begin
  select * into pr from public.plataforma_ia_precos where modelo = p_modelo;
  if found then
    v_custo := (coalesce(p_tokens_entrada, 0) * pr.usd_por_milhao_entrada
              + coalesce(p_tokens_saida, 0) * pr.usd_por_milhao_saida) / 1000000.0
              + coalesce(p_imagens, 0) * pr.usd_por_imagem;
  end if;
  insert into public.plataforma_ia_uso (empresa_id, user_id, funcao, etapa, modelo, lead_id, ref_id,
    tokens_entrada, tokens_saida, tokens_total, imagens, estimado, custo_usd)
  values (p_empresa, p_user, p_funcao, p_etapa, p_modelo, p_lead, p_ref,
    greatest(coalesce(p_tokens_entrada, 0), 0), greatest(coalesce(p_tokens_saida, 0), 0),
    greatest(coalesce(p_tokens_total, 0), 0), greatest(coalesce(p_imagens, 0), 0), coalesce(p_estimado, false), v_custo);
end $$;
revoke all on function public.plataforma_ia_registrar_uso(uuid, uuid, text, text, text, bigint, uuid, integer, integer, integer, integer, boolean) from public, anon, authenticated;
grant execute on function public.plataforma_ia_registrar_uso(uuid, uuid, text, text, text, bigint, uuid, integer, integer, integer, integer, boolean) to service_role;

-- Cota da empresa no mês. Motivos, em ordem: funcao_bloqueada, sem_plano, cota_estourada.
-- "Sem plano" = sem assinatura com plano e sem liberação explícita de `iaCardLead` em Páginas.
create or replace function public.plataforma_ia_cota(p_empresa uuid)
returns table (liberada boolean, motivo text, limite bigint, usado bigint, restante bigint, periodo_inicio date)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_ini timestamptz := public.plataforma_ia_inicio_mes(null);
  v_dia date := (v_ini at time zone 'America/Sao_Paulo')::date;
  v_plano uuid; v_lim_plano bigint; v_modo text; v_lim_emp bigint; v_lim bigint; v_usado bigint; v_ajuste boolean;
begin
  select a.plano_id into v_plano from public.plataforma_assinaturas a where a.empresa_id = p_empresa;
  select ep.habilitada into v_ajuste from public.plataforma_empresa_paginas ep
   where ep.empresa_id = p_empresa and ep.pagina_id = 'iaCardLead';

  select coalesce(sum(u.tokens_total), 0) into v_usado
    from public.plataforma_ia_uso u where u.empresa_id = p_empresa and u.criado_em >= v_ini;

  if 'iaCardLead' = any(public.app_paginas_bloqueadas(p_empresa)) then
    return query select false, 'funcao_bloqueada'::text, null::bigint, v_usado, null::bigint, v_dia; return;
  end if;
  if v_plano is null and v_ajuste is not true then
    return query select false, 'sem_plano'::text, null::bigint, v_usado, null::bigint, v_dia; return;
  end if;

  select pl.ia_tokens_limite_mensal into v_lim_plano from public.plataforma_planos pl where pl.id = v_plano;
  select e.modo, e.tokens_limite_mensal into v_modo, v_lim_emp from public.plataforma_empresa_ia e where e.empresa_id = p_empresa;
  v_lim := case coalesce(v_modo, 'plano')
             when 'sem_limite' then null
             when 'personalizado' then v_lim_emp
             else v_lim_plano end;

  if v_lim is not null and v_usado >= v_lim then
    return query select false, 'cota_estourada'::text, v_lim, v_usado, 0::bigint, v_dia; return;
  end if;
  return query select true, null::text, v_lim, v_usado,
                      case when v_lim is null then null::bigint else v_lim - v_usado end, v_dia;
end $$;
revoke all on function public.plataforma_ia_cota(uuid) from public, anon, authenticated;
grant execute on function public.plataforma_ia_cota(uuid) to service_role;

-- Estado para o front da empresa: sem modelo, prompt, chave nem números de consumo (D6).
create or replace function public.app_ia_card_lead_status()
returns table (liberada boolean, motor_pronto boolean, render_ativo boolean, render_ambiente_ativo boolean, cota_estourada boolean)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_emp uuid := public.app_empresa_atual(); m record; c record; v_chave boolean;
begin
  if v_emp is null then
    return query select false, false, false, false, false; return;
  end if;
  select * into m from public.plataforma_ia_motor limit 1;
  select exists (select 1 from public.plataforma_ia_segredos where nome = 'openai_card_lead') into v_chave;
  select * into c from public.plataforma_ia_cota(v_emp);
  return query select
    coalesce(c.motivo, '') not in ('funcao_bloqueada', 'sem_plano'),
    coalesce(m.ativo, false) and v_chave,
    coalesce(m.render_ativo, false),
    coalesce(m.render_ambiente_ativo, false),
    coalesce(c.motivo, '') = 'cota_estourada';
end $$;
revoke all on function public.app_ia_card_lead_status() from public, anon;
grant execute on function public.app_ia_card_lead_status() to authenticated;

-- ── RPCs do master ─────────────────────────────────────────────────────────────────────────────────
create or replace function public.master_ia_salvar_limite_plano(p_plano uuid, p_limite bigint)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  perform public.app_assert_master();
  update public.plataforma_planos set ia_tokens_limite_mensal = nullif(p_limite, 0) where id = p_plano;
  if not found then raise exception 'Plano não encontrado'; end if;
end $$;
revoke all on function public.master_ia_salvar_limite_plano(uuid, bigint) from public, anon;
grant execute on function public.master_ia_salvar_limite_plano(uuid, bigint) to authenticated;

create or replace function public.master_ia_salvar_limite_empresa(p_empresa uuid, p_modo text, p_limite bigint default null)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  perform public.app_assert_master();
  if p_modo not in ('plano', 'personalizado', 'sem_limite') then raise exception 'Modo inválido'; end if;
  if p_modo = 'personalizado' and coalesce(p_limite, 0) <= 0 then raise exception 'Informe o limite de tokens'; end if;
  if not exists (select 1 from "CRM-multi-empresas>empresas<" where id = p_empresa) then
    raise exception 'Empresa não encontrada';
  end if;
  insert into public.plataforma_empresa_ia (empresa_id, modo, tokens_limite_mensal, atualizado_em)
  values (p_empresa, p_modo, case when p_modo = 'personalizado' then p_limite end, now())
  on conflict (empresa_id) do update
    set modo = excluded.modo, tokens_limite_mensal = excluded.tokens_limite_mensal, atualizado_em = now();
end $$;
revoke all on function public.master_ia_salvar_limite_empresa(uuid, text, bigint) from public, anon;
grant execute on function public.master_ia_salvar_limite_empresa(uuid, text, bigint) to authenticated;

create or replace function public.master_ia_precos_salvar(p jsonb)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare x jsonb;
begin
  perform public.app_assert_master();
  for x in select * from jsonb_array_elements(coalesce(p, '[]'::jsonb)) loop
    update public.plataforma_ia_precos set
      usd_por_milhao_entrada = greatest(coalesce((x->>'usd_por_milhao_entrada')::numeric, 0), 0),
      usd_por_milhao_saida = greatest(coalesce((x->>'usd_por_milhao_saida')::numeric, 0), 0),
      usd_por_imagem = greatest(coalesce((x->>'usd_por_imagem')::numeric, 0), 0),
      atualizado_em = now()
    where modelo = x->>'modelo';
  end loop;
end $$;
revoke all on function public.master_ia_precos_salvar(jsonb) from public, anon;
grant execute on function public.master_ia_precos_salvar(jsonb) to authenticated;

-- Consumo do mês por empresa (p_mes = qualquer dia do mês; null = mês atual).
create or replace function public.master_ia_consumo_empresas(p_mes date default null)
returns table (empresa_id uuid, nome text, plano_nome text, funcao_liberada boolean, modo text,
               limite bigint, usado bigint, custo_usd numeric, usos bigint)
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_ini timestamptz := public.plataforma_ia_inicio_mes(p_mes);
        v_fim timestamptz := (((v_ini at time zone 'America/Sao_Paulo') + interval '1 month') at time zone 'America/Sao_Paulo');
begin
  perform public.app_assert_master();
  return query
  select e.id, e.nome::text, pl.nome::text,
         not ('iaCardLead' = any(public.app_paginas_bloqueadas(e.id))),
         coalesce(ei.modo, 'plano')::text,
         case coalesce(ei.modo, 'plano') when 'sem_limite' then null when 'personalizado' then ei.tokens_limite_mensal
              else pl.ia_tokens_limite_mensal end,
         coalesce(u.tokens, 0)::bigint, coalesce(u.custo, 0)::numeric, coalesce(u.n, 0)::bigint
    from "CRM-multi-empresas>empresas<" e
    left join public.plataforma_assinaturas a on a.empresa_id = e.id
    left join public.plataforma_planos pl on pl.id = a.plano_id
    left join public.plataforma_empresa_ia ei on ei.empresa_id = e.id
    left join (select x.empresa_id, sum(x.tokens_total) tokens, sum(x.custo_usd) custo, count(*) n
                 from public.plataforma_ia_uso x where x.criado_em >= v_ini and x.criado_em < v_fim
                group by x.empresa_id) u on u.empresa_id = e.id
   where not coalesce(e.e_modelo, false)
   order by coalesce(u.tokens, 0) desc, e.nome;
end $$;
revoke all on function public.master_ia_consumo_empresas(date) from public, anon;
grant execute on function public.master_ia_consumo_empresas(date) to authenticated;

-- Detalhe de uma empresa: série mensal e quebras do mês atual.
create or replace function public.master_ia_consumo_empresa(p_empresa uuid, p_meses integer default 6)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare v_ini timestamptz := public.plataforma_ia_inicio_mes(null); r jsonb;
begin
  perform public.app_assert_master();
  select jsonb_build_object(
    'meses', coalesce((
      select jsonb_agg(jsonb_build_object('mes', to_char(m.mes at time zone 'America/Sao_Paulo', 'YYYY-MM'),
                                           'tokens', coalesce(s.tokens, 0), 'custo_usd', coalesce(s.custo, 0)) order by m.mes)
        from (select (v_ini at time zone 'America/Sao_Paulo' - make_interval(months => g)) at time zone 'America/Sao_Paulo' as mes
                from generate_series(0, greatest(p_meses, 1) - 1) g) m
        left join lateral (select sum(u.tokens_total) tokens, sum(u.custo_usd) custo
                             from public.plataforma_ia_uso u
                            where u.empresa_id = p_empresa and u.criado_em >= m.mes
                              and u.criado_em < ((m.mes at time zone 'America/Sao_Paulo') + interval '1 month') at time zone 'America/Sao_Paulo') s on true
    ), '[]'::jsonb),
    'por_funcao', coalesce((select jsonb_agg(jsonb_build_object('funcao', x.funcao, 'tokens', x.t, 'custo_usd', x.c))
                              from (select funcao, sum(tokens_total) t, sum(custo_usd) c from public.plataforma_ia_uso
                                     where empresa_id = p_empresa and criado_em >= v_ini group by funcao) x), '[]'::jsonb),
    'por_modelo', coalesce((select jsonb_agg(jsonb_build_object('modelo', x.modelo, 'tokens', x.t, 'custo_usd', x.c))
                              from (select modelo, sum(tokens_total) t, sum(custo_usd) c from public.plataforma_ia_uso
                                     where empresa_id = p_empresa and criado_em >= v_ini group by modelo) x), '[]'::jsonb)
  ) into r;
  return r;
end $$;
revoke all on function public.master_ia_consumo_empresa(uuid, integer) from public, anon;
grant execute on function public.master_ia_consumo_empresa(uuid, integer) to authenticated;

create or replace function public.master_ia_uso_recente(p_empresa uuid, p_limite integer default 100)
returns setof public.plataforma_ia_uso language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.app_assert_master();
  return query select * from public.plataforma_ia_uso u where u.empresa_id = p_empresa
                order by u.criado_em desc limit least(greatest(p_limite, 1), 500);
end $$;
revoke all on function public.master_ia_uso_recente(uuid, integer) from public, anon;
grant execute on function public.master_ia_uso_recente(uuid, integer) to authenticated;
