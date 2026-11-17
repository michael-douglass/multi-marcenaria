-- M19 + M20 + M25 + M26 — Plataforma: seed de empresa, criação de empresa com admin, painel master,
-- financeiro master (planos, assinaturas, cobranças) e bloqueio por inadimplência.
-- Tudo exclusivo do master (app_is_master()). Criação de empresa em SQL (mesmo padrão de
-- movelaria_criar_usuario), sem depender de edge function.

-- 0. Identidade: lida só com as linhas do próprio auth.uid() — volta para o postgres para que o master
--    continue administrador em qualquer empresa que estiver vendo.
alter function public.movelaria_obter_minha_identidade() owner to postgres;
alter function public.movelaria_obter_meu_usuario() owner to postgres;

create or replace function public.app_assert_master()
returns void language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if not public.app_is_master() then
    raise exception 'Acesso negado: apenas o usuário master' using errcode = '42501';
  end if;
end $$;
revoke all on function public.app_assert_master() from public, anon;
grant execute on function public.app_assert_master() to authenticated;

-- 1. Seed de uma empresa nova --------------------------------------------------------------------
create or replace function public.plataforma_seed_empresa(p_empresa_id uuid)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  perform public.app_set_empresa_ctx(p_empresa_id);

  insert into movelaria_formas_pagamento_pagar (empresa_id, nome, ordem)
  values (p_empresa_id, 'Pix', 1), (p_empresa_id, 'Boleto', 2), (p_empresa_id, 'Cheque', 3), (p_empresa_id, 'Cheque de cliente', 4)
  on conflict (empresa_id, nome) do nothing;

  insert into movelaria_visualizacao_config (empresa_id, chave, paineis_visiveis)
  values (p_empresa_id, 'default', array['chegada_materiais','calendario_obras','acompanhamento_obras',
          'obras_do_dia','obras_atrasadas','cobrancas_atrasadas']::text[])
  on conflict (empresa_id, chave) do nothing;

  insert into movelaria_obra_lousa_text_config (empresa_id, singleton_key) values (p_empresa_id, 'default')
  on conflict (empresa_id, singleton_key) do nothing;

  insert into movelaria_kanban_colunas_obra (empresa_id, titulo, status_key, cor, ordem) values
    (p_empresa_id, 'Datas em Aberto', 'datas_em_aberto', '#6b7280', 1),
    (p_empresa_id, 'Datas em Atraso', 'datas_em_atraso', '#ef4444', 2),
    (p_empresa_id, 'Datas Definidas', 'datas_definidas', '#3b82f6', 3),
    (p_empresa_id, 'Em Andamento',    'em_andamento',    '#f59e0b', 4),
    (p_empresa_id, 'Concluída',       'concluida',       '#10b981', 5),
    (p_empresa_id, 'Cancelada',       'cancelada',       '#9ca3af', 6)
  on conflict (empresa_id, status_key) do nothing;

  if not exists (select 1 from movelaria_escritorio_pastas where empresa_id = p_empresa_id) then
    insert into movelaria_escritorio_pastas (empresa_id, nome, descricao, ordem) values
      (p_empresa_id, 'Contabilidade', 'Notas, balancetes, impostos e comprovantes contábeis', 10),
      (p_empresa_id, 'Escritório', 'Documentos administrativos e do dia a dia do escritório', 20);
  end if;

  if not exists (select 1 from crm.marketing_columns where empresa_id = p_empresa_id) then
    insert into crm.marketing_columns (empresa_id, nome, ordem) values
      (p_empresa_id, 'Ideias', 1), (p_empresa_id, 'Enviados para aprovação', 2), (p_empresa_id, 'Aprovados', 3),
      (p_empresa_id, 'Postados Meta- Ads', 4), (p_empresa_id, 'Postado- Instagram organico', 5),
      (p_empresa_id, 'Postado Tik Tok', 6);
  end if;

  if not exists (select 1 from crm.producao_stages where empresa_id = p_empresa_id) then
    insert into crm.producao_stages (empresa_id, nome, cor, ordem, ativo, is_default) values
      (p_empresa_id, 'Projetos de produção pendentes', 'warning', 0, true, true),
      (p_empresa_id, 'Projeto iniciado', 'primary', 1, true, false),
      (p_empresa_id, 'Projetos concluídos', 'success', 2, true, false);
  end if;

  if not exists (select 1 from crm.projeto_stages where empresa_id = p_empresa_id) then
    insert into crm.projeto_stages (empresa_id, nome, cor, ordem, ativo, is_default) values
      (p_empresa_id, 'Projetos aguardando serem feitos', 'warning', 0, true, true),
      (p_empresa_id, 'Visita agendada', 'primary', 1, true, true),
      (p_empresa_id, 'Projetos feitos', 'success', 2, true, true);
  end if;
end $$;
revoke all on function public.plataforma_seed_empresa(uuid) from public, anon, authenticated;

-- 2. Usuário no Auth (mesmo padrão de movelaria_criar_usuario) ------------------------------------
create or replace function public.app__criar_auth_user(p_email text, p_senha text)
returns uuid language plpgsql volatile security definer set search_path to 'extensions', 'auth', 'public' as $$
declare v_id uuid := gen_random_uuid(); v_email text := lower(trim(p_email));
begin
  if p_senha is null or length(p_senha) < 6 then
    raise exception 'Senha inválida: mínimo de 6 caracteres';
  end if;
  insert into auth.users (
    id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, is_sso_user, is_anonymous, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change_token, reauthentication_token
  ) values (
    v_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
    v_email, extensions.crypt(p_senha, extensions.gen_salt('bf', 10)), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, false, false, now(), now(),
    '', '', '', '', '', '', ''
  );
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_email,
          jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
          'email', now(), now(), now());
  return v_id;
end $$;
revoke all on function public.app__criar_auth_user(text, text) from public, anon, authenticated;

-- Define (cria ou promove) o administrador de uma empresa. Só master.
create or replace function public.master_definir_admin_empresa(
  p_empresa_id uuid, p_admin_email text, p_admin_nome text, p_admin_senha text default null)
returns uuid language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid;
  v_email text := lower(trim(p_admin_email));
  v_nome text := coalesce(nullif(trim(p_admin_nome), ''), split_part(lower(trim(p_admin_email)), '@', 1));
  v_ctx_antigo uuid;
  v_emp_atual uuid;
begin
  perform public.app_assert_master();
  if v_email is null or v_email = '' then raise exception 'E-mail do administrador é obrigatório'; end if;
  if not exists (select 1 from "CRM-multi-empresas>empresas<" where id = p_empresa_id) then
    raise exception 'Empresa não encontrada';
  end if;

  select id into v_uid from auth.users where lower(email) = v_email;
  if v_uid is not null then
    v_emp_atual := public.app_empresa_do_usuario(v_uid);
    if public.me_is_super_admin(v_uid) then
      raise exception 'O usuário master não pode ser administrador de uma empresa';
    end if;
    if v_emp_atual is not null and v_emp_atual <> p_empresa_id then
      raise exception 'Este e-mail já pertence a outra empresa';
    end if;
    if p_admin_senha is not null and p_admin_senha <> '' then
      update auth.users set encrypted_password = extensions.crypt(p_admin_senha, extensions.gen_salt('bf', 10)), updated_at = now()
       where id = v_uid;
    end if;
  else
    if p_admin_senha is null or p_admin_senha = '' then
      raise exception 'Informe uma senha para o novo administrador';
    end if;
    v_uid := public.app__criar_auth_user(v_email, p_admin_senha);
  end if;

  -- O master passa a "estar" na empresa durante a transação: triggers em cascata (ex.: ficha de
  -- funcionário criada ao inserir o usuário) herdam a empresa certa.
  select empresa_id into v_ctx_antigo from plataforma_master_contexto where user_id = auth.uid();
  perform public.master_definir_empresa_ativa(p_empresa_id);

  insert into "CRM-multi-empresas>usuario_empresa<" (user_id, empresa_id) values (v_uid, p_empresa_id)
  on conflict (user_id) do nothing;

  insert into movelaria_usuarios (id, email, nome, perfil, ativo, empresa_id)
  values (v_uid, v_email, v_nome, 'administrador', true, p_empresa_id)
  on conflict (id) do update set perfil = 'administrador', ativo = true, nome = coalesce(excluded.nome, movelaria_usuarios.nome), atualizado_em = now();

  insert into crm.usuarios (id, nome, email, tipo_usuario, status_convite, empresa_id)
  values (v_uid, v_nome, v_email, 'colaborador', 'ATIVO', p_empresa_id)
  on conflict (id) do update set status_convite = 'ATIVO', atualizado_em = now();

  insert into crm.user_roles (user_id, role, empresa_id) values (v_uid, 'admin', p_empresa_id)
  on conflict do nothing;

  if v_ctx_antigo is not null then
    perform public.master_definir_empresa_ativa(v_ctx_antigo);
  else
    delete from plataforma_master_contexto where user_id = auth.uid();
  end if;
  return v_uid;
end $$;
revoke all on function public.master_definir_admin_empresa(uuid, text, text, text) from public, anon;
grant execute on function public.master_definir_admin_empresa(uuid, text, text, text) to authenticated;

-- 3. Financeiro master: tabelas -------------------------------------------------------------------
create table if not exists public.plataforma_formas_pagamento (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ordem integer not null default 0,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
insert into public.plataforma_formas_pagamento (nome, ordem) values
  ('Pix', 1), ('Boleto', 2), ('Cartão', 3), ('Dinheiro', 4), ('Cheque', 5), ('Transferência', 6)
on conflict (nome) do nothing;

create table if not exists public.plataforma_planos (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  valor_mensal numeric(12,2) not null check (valor_mensal >= 0),
  descricao text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists public.plataforma_assinaturas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null unique references public."CRM-multi-empresas>empresas<"(id) on delete cascade,
  plano_id uuid references public.plataforma_planos(id) on delete set null,
  valor numeric(12,2) not null check (valor >= 0),
  dia_vencimento integer not null default 10 check (dia_vencimento between 1 and 28),
  dias_tolerancia integer not null default 10 check (dias_tolerancia >= 0),
  inicio date not null default current_date,
  status text not null default 'ativa' check (status in ('ativa', 'suspensa', 'cancelada')),
  liberado_ate date,
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.plataforma_cobrancas (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public."CRM-multi-empresas>empresas<"(id) on delete cascade,
  competencia date not null,
  valor numeric(12,2) not null check (valor >= 0),
  vencimento date not null,
  status text not null default 'pendente' check (status in ('pendente', 'paga', 'vencida', 'cancelada')),
  pago_em date,
  valor_pago numeric(12,2),
  forma_pagamento_id uuid references public.plataforma_formas_pagamento(id) on delete set null,
  observacao text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (empresa_id, competencia)
);
create index if not exists plataforma_cobrancas_status_idx on public.plataforma_cobrancas (status, vencimento);

do $$
declare t text;
begin
  foreach t in array array['plataforma_formas_pagamento','plataforma_planos','plataforma_assinaturas','plataforma_cobrancas'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists plataforma_master on public.%I', t);
    execute format('create policy plataforma_master on public.%I for all to authenticated using (public.app_is_master()) with check (public.app_is_master())', t);
  end loop;
end $$;

-- 4. Cobranças e inadimplência --------------------------------------------------------------------
-- Gera a cobrança da competência (mês) de cada assinatura ativa. Idempotente.
create or replace function public.plataforma_gerar_cobrancas(p_competencia date default date_trunc('month', current_date)::date)
returns integer language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_comp date := date_trunc('month', p_competencia)::date; v_n integer;
begin
  if auth.uid() is not null then perform public.app_assert_master(); end if;
  insert into plataforma_cobrancas (empresa_id, competencia, valor, vencimento)
  select a.empresa_id, v_comp, a.valor, (v_comp + (a.dia_vencimento - 1))
    from plataforma_assinaturas a
   where a.status = 'ativa' and a.inicio <= (v_comp + interval '1 month - 1 day')::date
  on conflict (empresa_id, competencia) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end $$;

-- Marca vencidas e bloqueia empresas com atraso acima da tolerância (exceto liberadas pelo master).
-- Desbloqueia quem não tem mais cobrança em atraso (só bloqueios automáticos por inadimplência).
create or replace function public.plataforma_atualizar_inadimplencia()
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_vencidas integer; v_bloq integer; v_desbloq integer;
begin
  if auth.uid() is not null then perform public.app_assert_master(); end if;

  update plataforma_cobrancas set status = 'vencida', atualizado_em = now()
   where status = 'pendente' and vencimento < current_date;
  get diagnostics v_vencidas = row_count;

  update "CRM-multi-empresas>empresas<" e set status = 'bloqueada', atualizado_em = now()
   where e.status = 'ativa'
     and exists (
       select 1 from plataforma_cobrancas c
         join plataforma_assinaturas a on a.empresa_id = c.empresa_id
        where c.empresa_id = e.id and c.status = 'vencida'
          and c.vencimento + a.dias_tolerancia < current_date
          and (a.liberado_ate is null or a.liberado_ate < current_date));
  get diagnostics v_bloq = row_count;

  update "CRM-multi-empresas>empresas<" e set status = 'ativa', atualizado_em = now()
   where e.status = 'bloqueada'
     and not exists (
       select 1 from plataforma_cobrancas c
         join plataforma_assinaturas a on a.empresa_id = c.empresa_id
        where c.empresa_id = e.id and c.status = 'vencida'
          and c.vencimento + a.dias_tolerancia < current_date
          and (a.liberado_ate is null or a.liberado_ate < current_date))
     and exists (select 1 from plataforma_assinaturas a where a.empresa_id = e.id and a.status = 'ativa');
  get diagnostics v_desbloq = row_count;

  return jsonb_build_object('vencidas', v_vencidas, 'bloqueadas', v_bloq, 'desbloqueadas', v_desbloq);
end $$;

create or replace function public.master_dar_baixa_cobranca(
  p_cobranca_id uuid, p_forma_pagamento_id uuid, p_pago_em date default current_date,
  p_valor_pago numeric default null, p_observacao text default null)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  perform public.app_assert_master();
  update plataforma_cobrancas
     set status = 'paga', pago_em = coalesce(p_pago_em, current_date),
         valor_pago = coalesce(p_valor_pago, valor), forma_pagamento_id = p_forma_pagamento_id,
         observacao = coalesce(p_observacao, observacao), atualizado_em = now()
   where id = p_cobranca_id and status <> 'cancelada';
  if not found then raise exception 'Cobrança não encontrada ou cancelada'; end if;
  perform public.plataforma_atualizar_inadimplencia();
end $$;
revoke all on function public.master_dar_baixa_cobranca(uuid, uuid, date, numeric, text) from public, anon;
grant execute on function public.master_dar_baixa_cobranca(uuid, uuid, date, numeric, text) to authenticated;

-- Bloquear / liberar / inativar manualmente.
create or replace function public.master_definir_status_empresa(p_empresa_id uuid, p_status text, p_liberado_ate date default null)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  perform public.app_assert_master();
  if p_status not in ('ativa', 'bloqueada', 'inativa') then raise exception 'Status inválido'; end if;
  update "CRM-multi-empresas>empresas<" set status = p_status, ativo = (p_status <> 'inativa'), atualizado_em = now()
   where id = p_empresa_id;
  if not found then raise exception 'Empresa não encontrada'; end if;
  if p_status = 'ativa' and p_liberado_ate is not null then
    update plataforma_assinaturas set liberado_ate = p_liberado_ate, atualizado_em = now() where empresa_id = p_empresa_id;
  end if;
end $$;
revoke all on function public.master_definir_status_empresa(uuid, text, date) from public, anon;
grant execute on function public.master_definir_status_empresa(uuid, text, date) to authenticated;

-- 5. Criar empresa (empresa + seed + admin + assinatura) ------------------------------------------
create or replace function public.master_criar_empresa(
  p_nome text, p_slug text, p_admin_email text, p_admin_nome text, p_admin_senha text,
  p_cnpj text default null, p_razao_social text default null, p_cor_primaria text default null,
  p_plano_id uuid default null, p_valor_mensal numeric default null, p_dia_vencimento integer default 10)
returns uuid language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_slug text := lower(trim(p_slug)); v_valor numeric;
begin
  perform public.app_assert_master();
  if coalesce(trim(p_nome), '') = '' then raise exception 'Nome da empresa é obrigatório'; end if;
  if v_slug !~ '^[a-z0-9_]+$' then raise exception 'Slug inválido: use letras minúsculas, números e _'; end if;
  if exists (select 1 from "CRM-multi-empresas>empresas<" where slug = v_slug) then
    raise exception 'Já existe uma empresa com o slug "%"', v_slug;
  end if;

  insert into "CRM-multi-empresas>empresas<" (nome, slug, schema_nome, cnpj, razao_social, cor_primaria, ativo, status)
  values (trim(p_nome), v_slug, 'crm', nullif(trim(p_cnpj), ''), nullif(trim(p_razao_social), ''),
          coalesce(nullif(trim(p_cor_primaria), ''), '#6366f1'), true, 'ativa')
  returning id into v_id;

  perform public.plataforma_seed_empresa(v_id);
  perform public.master_definir_admin_empresa(v_id, p_admin_email, p_admin_nome, p_admin_senha);

  v_valor := coalesce(p_valor_mensal, (select valor_mensal from plataforma_planos where id = p_plano_id));
  if v_valor is not null then
    insert into plataforma_assinaturas (empresa_id, plano_id, valor, dia_vencimento)
    values (v_id, p_plano_id, v_valor, coalesce(p_dia_vencimento, 10));
  end if;
  return v_id;
end $$;
revoke all on function public.master_criar_empresa(text, text, text, text, text, text, text, text, uuid, numeric, integer) from public, anon;
grant execute on function public.master_criar_empresa(text, text, text, text, text, text, text, text, uuid, numeric, integer) to authenticated;

create or replace function public.master_atualizar_empresa(
  p_empresa_id uuid, p_nome text, p_cnpj text default null, p_razao_social text default null, p_cor_primaria text default null)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  perform public.app_assert_master();
  update "CRM-multi-empresas>empresas<"
     set nome = coalesce(nullif(trim(p_nome), ''), nome), cnpj = nullif(trim(p_cnpj), ''),
         razao_social = nullif(trim(p_razao_social), ''), cor_primaria = coalesce(nullif(trim(p_cor_primaria), ''), cor_primaria),
         atualizado_em = now()
   where id = p_empresa_id;
  if not found then raise exception 'Empresa não encontrada'; end if;
end $$;
revoke all on function public.master_atualizar_empresa(uuid, text, text, text, text) from public, anon;
grant execute on function public.master_atualizar_empresa(uuid, text, text, text, text) to authenticated;

-- 6. Painel master: resumo, faturamento mensal e usuários -----------------------------------------
create or replace function public.master_resumo_empresas(p_inicio date default date_trunc('month', current_date)::date,
                                                         p_fim date default current_date)
returns table (
  empresa_id uuid, nome text, slug text, status text, ativo boolean, cnpj text, criado_em timestamptz,
  admins jsonb, total_usuarios integer, faturamento numeric,
  plano text, valor_mensal numeric, situacao_mensalidade text, cobrancas_vencidas integer, valor_vencido numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.app_assert_master();
  return query
  select e.id, e.nome, e.slug, e.status, e.ativo, e.cnpj, e.criado_em,
    coalesce((select jsonb_agg(jsonb_build_object('id', u.id, 'nome', u.nome, 'email', u.email) order by u.nome)
                from movelaria_usuarios u
               where u.empresa_id = e.id and u.perfil = 'administrador' and u.ativo
                 and not public.me_is_super_admin(u.id)), '[]'::jsonb),
    (select count(*)::int from "CRM-multi-empresas>usuario_empresa<" ue
      where ue.empresa_id = e.id and not public.me_is_super_admin(ue.user_id)),
    coalesce((select sum(cr.valor_parcela) from movelaria_contas_receber cr
               where cr.empresa_id = e.id and cr.status = 'recebido'
                 and cr.data_recebimento between p_inicio and p_fim), 0)::numeric,
    pl.nome, a.valor,
    case
      when a.id is null then 'sem_assinatura'
      when e.status = 'bloqueada' then 'bloqueada'
      when exists (select 1 from plataforma_cobrancas c where c.empresa_id = e.id and c.status = 'vencida') then 'vencida'
      else 'em_dia'
    end,
    (select count(*)::int from plataforma_cobrancas c where c.empresa_id = e.id and c.status = 'vencida'),
    coalesce((select sum(c.valor) from plataforma_cobrancas c where c.empresa_id = e.id and c.status = 'vencida'), 0)::numeric
  from "CRM-multi-empresas>empresas<" e
  left join plataforma_assinaturas a on a.empresa_id = e.id
  left join plataforma_planos pl on pl.id = a.plano_id
  order by e.nome;
end $$;
revoke all on function public.master_resumo_empresas(date, date) from public, anon;
grant execute on function public.master_resumo_empresas(date, date) to authenticated;

create or replace function public.master_faturamento_mensal(p_meses integer default 12)
returns table (empresa_id uuid, empresa_nome text, mes date, faturamento numeric)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.app_assert_master();
  return query
  select e.id, e.nome, m.mes::date,
         coalesce((select sum(cr.valor_parcela) from movelaria_contas_receber cr
                    where cr.empresa_id = e.id and cr.status = 'recebido'
                      and date_trunc('month', cr.data_recebimento) = m.mes), 0)::numeric
    from "CRM-multi-empresas>empresas<" e
   cross join generate_series(date_trunc('month', current_date) - make_interval(months => greatest(p_meses, 1) - 1),
                              date_trunc('month', current_date), interval '1 month') as m(mes)
   order by e.nome, m.mes;
end $$;
revoke all on function public.master_faturamento_mensal(integer) from public, anon;
grant execute on function public.master_faturamento_mensal(integer) to authenticated;

create or replace function public.master_usuarios_empresa(p_empresa_id uuid)
returns table (user_id uuid, nome text, email text, perfil text, ativo boolean, crm_roles text[], ultimo_acesso timestamptz)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.app_assert_master();
  return query
  select ue.user_id, coalesce(mu.nome, cu.nome), coalesce(mu.email, cu.email, au.email::text), mu.perfil, coalesce(mu.ativo, false),
         coalesce((select array_agg(r.role::text order by r.role::text) from crm.user_roles r where r.user_id = ue.user_id), '{}'::text[]),
         au.last_sign_in_at
    from "CRM-multi-empresas>usuario_empresa<" ue
    left join movelaria_usuarios mu on mu.id = ue.user_id
    left join crm.usuarios cu on cu.id = ue.user_id
    left join auth.users au on au.id = ue.user_id
   where ue.empresa_id = p_empresa_id and not public.me_is_super_admin(ue.user_id)
   order by 2;
end $$;
revoke all on function public.master_usuarios_empresa(uuid) from public, anon;
grant execute on function public.master_usuarios_empresa(uuid) to authenticated;

create or replace function public.master_listar_empresas()
returns table (id uuid, nome text, slug text, status text, logo_url text)
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  perform public.app_assert_master();
  return query select e.id, e.nome, e.slug, e.status, e.logo_url from "CRM-multi-empresas>empresas<" e order by e.nome;
end $$;
revoke all on function public.master_listar_empresas() from public, anon;
grant execute on function public.master_listar_empresas() to authenticated;

-- 7. Jobs diários ---------------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from cron.job where jobname = 'plataforma_cobrancas_diario') then
    perform cron.unschedule('plataforma_cobrancas_diario');
  end if;
  perform cron.schedule('plataforma_cobrancas_diario', '15 9 * * *',
    'select public.plataforma_gerar_cobrancas(); select public.plataforma_atualizar_inadimplencia();');
end $$;

-- 8. Seed da Garbo (o banco novo começou vazio) ---------------------------------------------------
select public.plataforma_seed_empresa('2c196e67-dd26-4e1c-839d-4d234f3a3dfd');
select public.app_set_empresa_ctx(null);
