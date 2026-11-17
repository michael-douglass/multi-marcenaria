-- Teste ponta a ponta da plataforma (sempre ROLLBACK). Rodar:
--   node --env-file=.env scripts/multi-empresa/q.mjs --write -f scripts/multi-empresa/test-plataforma.sql
begin;
create temp table t_ids (k text primary key, v uuid) on commit drop;
grant all on t_ids to authenticated;

-- master
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='selvomichael@gmail.com'),'role','authenticated')::text, true);
set local role authenticated;

insert into plataforma_planos (nome, valor_mensal) values ('Teste Pro', 299.90);
insert into t_ids values ('plano', (select id from plataforma_planos where nome='Teste Pro'));
insert into t_ids values ('emp', public.master_criar_empresa('Marcenaria Teste B', 'teste_b', 'admin.b@teste.local', 'Admin B', 'senha123',
  null, null, null, (select v from t_ids where k='plano'), null, 5));
select 'T1 empresa criada' t, (select count(*) from public.master_listar_empresas()) empresas;
select 'T2 contexto do master volta p/ Garbo' t, public.app_empresa_atual() = '2c196e67-dd26-4e1c-839d-4d234f3a3dfd' ok;
select 'T3 resumo B' t, nome, jsonb_array_length(admins) admins, total_usuarios, plano, valor_mensal, situacao_mensalidade
  from public.master_resumo_empresas() where slug = 'teste_b';
select 'T4 seed B (formas pagar)' t, count(*) from movelaria_formas_pagamento_pagar; -- master está na Garbo: vê só as da Garbo

-- admin da empresa B
reset role;
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='admin.b@teste.local'),'role','authenticated')::text, true);
set local role authenticated;
select 'T5 admin B empresa' t, (public.app_empresa_atual() = (select v from t_ids where k='emp')) ok, public.app_is_master() master;
select 'T6 identidade admin B' t, (public.movelaria_obter_minha_identidade()->'movelaria'->>'perfil') perfil,
       (public.movelaria_obter_minha_identidade()->'crm'->'roles') crm_roles;
select 'T7 admin B vê seed próprio' t, count(*) from movelaria_formas_pagamento_pagar;
insert into movelaria_fornecedores (nome) values ('Forn B');
select 'T8 admin B: fornecedores' t, count(*) from movelaria_fornecedores;
select 'T9 admin B não acessa master' t;
do $$ begin perform public.master_resumo_empresas(); raise exception 'FALHOU: admin B acessou o painel master';
exception when insufficient_privilege then raise notice 'ok: bloqueado'; end $$;
select 'T10 admin B não lê plataforma_cobrancas' t, count(*) from plataforma_cobrancas;
do $$ begin perform public.movelaria_redefinir_senha((select id from auth.users where email='selvomichael@gmail.com'), 'xxxxxx');
raise exception 'FALHOU: admin B mexeu no master';
exception when insufficient_privilege then raise notice 'ok: master protegido'; end $$;

-- master volta: Garbo não vê dado de B
reset role;
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='selvomichael@gmail.com'),'role','authenticated')::text, true);
set local role authenticated;
select 'T11 Garbo não vê Forn B' t, count(*) from movelaria_fornecedores where nome = 'Forn B';

-- inadimplência: cobrança de 2 meses atrás vencida há mais que a tolerância
insert into plataforma_cobrancas (empresa_id, competencia, valor, vencimento)
values ((select v from t_ids where k='emp'), date_trunc('month', current_date - interval '2 months')::date, 299.90, current_date - 40);
select 'T12 inadimplência' t, public.plataforma_atualizar_inadimplencia() r;
select 'T13 B bloqueada' t, status from public.master_listar_empresas() where slug = 'teste_b';

reset role;
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='admin.b@teste.local'),'role','authenticated')::text, true);
set local role authenticated;
select 'T14 admin B bloqueado: empresa atual' t, public.app_empresa_atual() emp, count(*) fornecedores from movelaria_fornecedores;
select 'T15 admin B ainda vê a empresa (tela suspensa)' t, nome, status from public.app_minha_empresa();

reset role;
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='selvomichael@gmail.com'),'role','authenticated')::text, true);
set local role authenticated;
select public.master_dar_baixa_cobranca(c.id, (select id from plataforma_formas_pagamento where nome='Pix'))
  from plataforma_cobrancas c where c.empresa_id = (select v from t_ids where k='emp') and c.status = 'vencida';
select 'T16 baixa desbloqueia' t, status from public.master_listar_empresas() where slug = 'teste_b';
select 'T17 gerar cobranças do mês' t, public.plataforma_gerar_cobrancas() geradas;
rollback;
