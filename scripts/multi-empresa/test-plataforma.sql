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
select 'T2 master sem inspeção não tem empresa' t, public.app_empresa_atual() is null ok;
select 'T3 resumo B' t, nome, jsonb_array_length(admins) admins, total_usuarios, plano, valor_mensal, situacao_mensalidade
  from public.master_resumo_empresas() where slug = 'teste_b';
select 'T4 master fora de empresa não vê dados' t, count(*) = 0 ok from movelaria_formas_pagamento_pagar;

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
select public.master_definir_empresa_ativa('2c196e67-dd26-4e1c-839d-4d234f3a3dfd', true);
select 'T11 Garbo não vê Forn B' t, count(*) = 0 ok from movelaria_fornecedores where nome = 'Forn B';
select public.master_sair_empresa();

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

-- ===== Fase I: páginas por plano/empresa e inspeção do master =====
reset role;
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='selvomichael@gmail.com'),'role','authenticated')::text, true);
set local role authenticated;
select public.master_salvar_paginas_plano((select v from t_ids where k='plano'), array['orcamentosIa','contratosCrm']);
select public.master_salvar_paginas_empresa((select v from t_ids where k='emp'), '{"orcamentosIa": true, "leads": false}'::jsonb);
select 'T18 páginas bloqueadas de B' t, bloqueadas = array['contratosCrm','leads'] ok, bloqueadas
  from public.master_paginas_empresa((select v from t_ids where k='emp'));

-- inspeção somente leitura
select public.master_definir_empresa_ativa((select v from t_ids where k='emp'), true);
select 'T19 em inspeção leitura' t, em_inspecao, inspecao_somente_leitura, paginas_bloqueadas from public.app_minha_empresa();
select 'T20 lê dados de B' t, count(*) from movelaria_fornecedores;
do $$ begin insert into movelaria_fornecedores (nome) values ('master leitura'); raise exception 'FALHOU: insert no núcleo em modo leitura';
exception when insufficient_privilege then raise notice 'ok T21: insert núcleo bloqueado'; end $$;
do $$ begin update movelaria_fornecedores set nome = 'x' where nome = 'Forn B';
  if found then raise exception 'FALHOU: update em modo leitura'; end if; raise notice 'ok T22: update afetou 0 linhas';
end $$;
do $$ begin delete from movelaria_fornecedores where nome = 'Forn B';
  if found then raise exception 'FALHOU: delete em modo leitura'; end if; raise notice 'ok T23: delete afetou 0 linhas';
end $$;
do $$ begin insert into crm.leads (nome, telefone, status) values ('Lead master', '31900000000', 'Novo Lead'); raise exception 'FALHOU: insert crm em modo leitura';
exception when insufficient_privilege then raise notice 'ok T24: insert crm bloqueado'; end $$;
do $$ begin perform public.movelaria_criar_usuario('x.leitura@teste.local', 'senha123', 'X', 'visualizador'); raise exception 'FALHOU: função postgres em modo leitura';
exception when insufficient_privilege then raise notice 'ok T25: função postgres bloqueada';
  when undefined_function then raise notice 'T25: assinatura de movelaria_criar_usuario diferente (ver manualmente)'; end $$;

-- acesso total
select public.master_definir_empresa_ativa((select v from t_ids where k='emp'), false);
insert into movelaria_fornecedores (nome) values ('master total');
select 'T26 acesso total grava' t, count(*) from movelaria_fornecedores where nome = 'master total';
select public.master_sair_empresa();
select 'T27 saiu: sem empresa' t, public.app_empresa_atual() is null ok, (select count(*) from public.app_minha_empresa()) = 0 linhas_ok;
select 'T28 acessos registrados (fechados)' t, count(*) n, count(*) filter (where fim is null) abertos
  from public.master_listar_acessos((select v from t_ids where k='emp'));

-- admin de B: vê as páginas bloqueadas e não usa as RPCs do master
reset role;
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='admin.b@teste.local'),'role','authenticated')::text, true);
set local role authenticated;
select 'T29 admin B: páginas bloqueadas' t, paginas_bloqueadas, em_inspecao from public.app_minha_empresa();
do $$ begin perform public.master_salvar_paginas_empresa((select id from public.app_minha_empresa()), '{}'::jsonb); raise exception 'FALHOU: admin B salvou páginas';
exception when insufficient_privilege then raise notice 'ok T30: admin B não salva páginas'; end $$;

-- Fase J: CRM pré-configurado (admin de B lê o próprio CRM)
select 'T31 etapas do Pipeline' t, count(*) = 6 ok, string_agg(nome, ' > ' order by ordem) etapas from crm.pipeline_custom_stages;
select 'T32 kanbans padrão' t, string_agg(slug, ',' order by ordem) = 'orcamentos,prospeccao,manutencao' ok from crm.kanban_pages;
select 'T33 colunas e regras' t, (select count(*) from crm.kanban_columns) = 15 colunas_ok,
       (select count(*) from crm.kanban_column_sources where tipo_fonte = 'status') = 13 fontes_ok;

-- seed de novo não duplica; bloqueio do plano ligado à empresa vale
reset role;
select public.crm_seed_pipeline_padrao((select v from t_ids where k='emp'));
select 'T34 seed idempotente' t,
       (select count(*) from crm.pipeline_custom_stages where empresa_id = (select v from t_ids where k='emp')) = 6
   and (select count(*) from crm.kanban_columns where empresa_id = (select v from t_ids where k='emp')) = 15 ok;
update plataforma_planos set paginas_bloqueadas = array['controleGastos','pipelineKanban:prospeccao']
 where id = (select v from t_ids where k='plano');
select 'T35 plano ligado bloqueia' t,
       public.app_paginas_bloqueadas((select v from t_ids where k='emp')) @> array['controleGastos','pipelineKanban:prospeccao'] ok;
select 'T36 Garbo não é afetada' t,
       not (public.app_paginas_bloqueadas((select id from "CRM-multi-empresas>empresas<" where slug='garbo')) && array['orcamentosIa']) ok;
rollback;
