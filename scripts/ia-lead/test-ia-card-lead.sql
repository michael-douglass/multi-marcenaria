-- IA no card lead (docs/ia-lead): segredo, RPCs do master, cota e status. Sempre ROLLBACK.
-- Pré-requisito: migrations 20261120100000, 20261120110000 e 20261120130000 aplicadas.
--   node --env-file=.env scripts/multi-empresa/q.mjs --write -f scripts/ia-lead/test-ia-card-lead.sql
begin;
create temp table t_ia (k text primary key, v uuid) on commit drop;
grant all on t_ia to authenticated;

-- master cria plano e duas empresas (uma com plano, outra sem)
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='selvomichael@gmail.com'),'role','authenticated')::text, true);
set local role authenticated;

insert into plataforma_planos (nome, valor_mensal) values ('IA Teste', 99.90);
insert into t_ia values ('plano', (select id from plataforma_planos where nome = 'IA Teste'));
insert into t_ia values ('emp', public.master_criar_empresa('IA Teste Com Plano', 'ia_teste_a', 'admin.ia.a@teste.local', 'Admin IA A', 'senha123',
  null, null, null, (select v from t_ia where k = 'plano'), null, 5));
insert into t_ia values ('emp_sem', public.master_criar_empresa('IA Teste Sem Plano', 'ia_teste_b', 'admin.ia.b@teste.local', 'Admin IA B', 'senha123',
  null, null, null, null, null, 5));

-- IA1: a chave nunca volta inteira
select public.master_ia_motor_salvar_chave('sk-teste-0123456789abcdefWXYZ');
do $$ declare r jsonb := public.master_ia_motor_obter(); begin
  if not (r->>'chave_configurada')::boolean then raise exception 'FALHOU IA1: chave não configurada'; end if;
  if r->>'chave_final4' <> 'WXYZ' then raise exception 'FALHOU IA1: final4 %', r->>'chave_final4'; end if;
  if r::text like '%0123456789abcdef%' then raise exception 'FALHOU IA1: a chave vazou no obter'; end if;
  raise notice 'ok IA1: obter devolve só o final da chave';
end $$;

-- IA2: nem o master lê a tabela de segredos pelo REST (authenticated)
do $$ begin perform 1 from public.plataforma_ia_segredos;
  raise exception 'FALHOU IA2: authenticated leu plataforma_ia_segredos';
exception when insufficient_privilege then raise notice 'ok IA2: segredo ilegível por authenticated'; end $$;

-- IA3: modelo fora da lista é recusado
do $$ begin perform public.master_ia_motor_salvar('{"vision_model":"gpt-xyz"}'::jsonb);
  raise exception 'FALHOU IA3: aceitou modelo inválido';
exception when others then
  if sqlerrm like 'FALHOU%' then raise; end if;
  raise notice 'ok IA3: modelo inválido recusado'; end $$;
select public.master_ia_motor_salvar('{"vision_model":"gpt-4o-mini","image_model":"dall-e-2","tokens_por_imagem_fixa":7000}'::jsonb);

-- admin da empresa A (não é master)
reset role;
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='admin.ia.a@teste.local'),'role','authenticated')::text, true);
set local role authenticated;

-- IA4: empresa comum não acessa o motor nem o consumo
do $$ begin perform public.master_ia_motor_obter(); raise exception 'FALHOU IA4: admin da empresa leu o motor';
exception when insufficient_privilege then raise notice 'ok IA4: motor só do master'; end $$;
do $$ begin perform public.master_ia_motor_salvar_chave('sk-xxxxxxxxxxxxxxxxxxxxxxxx'); raise exception 'FALHOU IA4b: admin da empresa gravou a chave';
exception when insufficient_privilege then raise notice 'ok IA4b: chave só pelo master'; end $$;

-- IA5: empresa não registra uso nem consulta a cota
do $$ begin perform public.plataforma_ia_registrar_uso((select v from t_ia where k='emp'), null, 'render_projeto', 'imagem', 'gpt-image-1', null, null, 0, 0, 1, 1, false);
  raise exception 'FALHOU IA5: authenticated registrou uso';
exception when insufficient_privilege then raise notice 'ok IA5: registrar_uso só pelo service role'; end $$;
do $$ begin perform * from public.plataforma_ia_cota((select v from t_ia where k='emp')); raise exception 'FALHOU IA5b: authenticated chamou a cota';
exception when insufficient_privilege then raise notice 'ok IA5b: cota só pelo service role'; end $$;

-- IA6: status para o front não traz modelo, prompt, chave nem números (função nasce bloqueada: default do plano)
do $$ declare s record; begin
  select * into s from public.app_ia_card_lead_status();
  if s.liberada then raise exception 'FALHOU IA6: plano novo deveria nascer com a função bloqueada'; end if;
  if pg_get_function_result('public.app_ia_card_lead_status'::regproc)
       <> 'TABLE(liberada boolean, motor_pronto boolean, render_ativo boolean, render_ambiente_ativo boolean, cota_estourada boolean)'
    then raise exception 'FALHOU IA6: status com coluna extra'; end if;
  raise notice 'ok IA6: plano novo nasce com a função bloqueada; status enxuto';
end $$;

-- cota (service role = postgres)
reset role;
do $$ declare c record; emp uuid := (select v from t_ia where k='emp'); emp2 uuid := (select v from t_ia where k='emp_sem'); pl uuid := (select v from t_ia where k='plano'); begin
  select * into c from public.plataforma_ia_cota(emp);
  if c.liberada or c.motivo <> 'funcao_bloqueada' then raise exception 'FALHOU IA7: esperava funcao_bloqueada, veio %', c.motivo; end if;

  update plataforma_planos set paginas_bloqueadas = '{}' where id = pl;
  select * into c from public.plataforma_ia_cota(emp);
  if not c.liberada or c.limite is not null then raise exception 'FALHOU IA7b: sem limite deveria liberar (%)', c.motivo; end if;

  update plataforma_planos set ia_tokens_limite_mensal = 100 where id = pl;
  perform public.plataforma_ia_registrar_uso(emp, null, 'render_projeto', 'visao', 'gpt-4o', null, null, 40, 20, 60, 0, false);
  select * into c from public.plataforma_ia_cota(emp);
  if not c.liberada or c.restante <> 40 then raise exception 'FALHOU IA7c: restante % (%)', c.restante, c.motivo; end if;
  perform public.plataforma_ia_registrar_uso(emp, null, 'render_projeto', 'imagem', 'dall-e-2', null, null, 0, 0, 60, 1, true);
  select * into c from public.plataforma_ia_cota(emp);
  if c.liberada or c.motivo <> 'cota_estourada' then raise exception 'FALHOU IA7d: esperava cota_estourada, veio %', c.motivo; end if;

  insert into plataforma_empresa_ia (empresa_id, modo, tokens_limite_mensal) values (emp, 'personalizado', 1000);
  select * into c from public.plataforma_ia_cota(emp);
  if not c.liberada or c.limite <> 1000 then raise exception 'FALHOU IA7e: personalizado (%)', c.motivo; end if;
  update plataforma_empresa_ia set modo = 'sem_limite', tokens_limite_mensal = null where empresa_id = emp;
  select * into c from public.plataforma_ia_cota(emp);
  if not c.liberada or c.limite is not null then raise exception 'FALHOU IA7f: sem_limite (%)', c.motivo; end if;

  select * into c from public.plataforma_ia_cota(emp2);
  if c.liberada or c.motivo <> 'sem_plano' then raise exception 'FALHOU IA8: empresa sem plano deveria recusar, veio %', c.motivo; end if;
  insert into plataforma_empresa_paginas (empresa_id, pagina_id, habilitada) values (emp2, 'iaCardLead', true);
  select * into c from public.plataforma_ia_cota(emp2);
  if not c.liberada then raise exception 'FALHOU IA8b: liberação explícita deveria valer (%)', c.motivo; end if;
  raise notice 'ok IA7/IA8: cota (bloqueada, sem limite, limite, estouro, personalizado, sem_limite, sem plano, liberação explícita)';
end $$;

-- IA9: consumo do mês aparece para o master
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='selvomichael@gmail.com'),'role','authenticated')::text, true);
set local role authenticated;
do $$ declare r record; begin
  select * into r from public.master_ia_consumo_empresas() where empresa_id = (select v from t_ia where k='emp');
  if r.usado <> 120 or r.usos <> 2 then raise exception 'FALHOU IA9: usado % usos %', r.usado, r.usos; end if;
  if jsonb_array_length(public.master_ia_consumo_empresa((select v from t_ia where k='emp'), 3)->'meses') <> 3
    then raise exception 'FALHOU IA9b: série mensal'; end if;
  raise notice 'ok IA9: consumo por empresa e série mensal';
end $$;
reset role;
rollback;
