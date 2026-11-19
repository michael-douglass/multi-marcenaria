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
create temp table t_ref_bloq on commit drop as
  select public.app_paginas_bloqueadas((select id from "CRM-multi-empresas>empresas<" where slug='garbo')) b;
update plataforma_planos set paginas_bloqueadas = array['controleGastos','pipelineKanban:prospeccao']
 where id = (select v from t_ids where k='plano');
select 'T35 plano ligado bloqueia' t,
       public.app_paginas_bloqueadas((select v from t_ids where k='emp')) @> array['controleGastos','pipelineKanban:prospeccao'] ok;
-- (a Garbo pode ter plano próprio: compara antes/depois de mudar o plano de B)
select 'T36 Garbo não é afetada' t,
       public.app_paginas_bloqueadas((select id from "CRM-multi-empresas>empresas<" where slug='garbo'))
         is not distinct from (select b from t_ref_bloq) ok;

-- Fase K: contrato padrão (admin de B lê o próprio modelo e grava o representante)
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='admin.b@teste.local'),'role','authenticated')::text, true);
set local role authenticated;
select 'T37 modelo padrão' t, count(*) = 1 ok, bool_and(ativo) ativo,
       bool_and(conteudo like '%{{empresa_razao_social}}%' and conteudo not ilike '%garbo%') texto_ok
  from crm.contratos_modelos;
select 'T38 campos do contrato' t, count(*) = 17 ok,
       count(*) filter (where valor_padrao is not null) = 7 padroes_ok from crm.contratos_variaveis;
select public.empresa_atualizar_dados('{"representante_nome":"Rep Teste","representante_cpf":"529.982.247-25","representante_qualificacao":"brasileiro, casado, marceneiro"}'::jsonb);
select 'T39 representante gravado' t,
       representante_cpf = '52998224725' and representante_nome = 'Rep Teste' ok from public.app_minha_empresa();
do $$ begin perform public.empresa_atualizar_dados('{"representante_cpf":"123.456.789-00"}'::jsonb);
raise exception 'FALHOU: CPF inválido aceito';
exception when invalid_parameter_value then raise notice 'ok T40: CPF inválido recusado'; end $$;
reset role;
create temp table t_ref_contratos on commit drop as
  select count(*) n from crm.contratos_modelos where empresa_id = (select id from "CRM-multi-empresas>empresas<" where slug='garbo');
select public.crm_seed_contrato_padrao((select v from t_ids where k='emp'));
select public.crm_seed_contrato_padrao((select id from "CRM-multi-empresas>empresas<" where slug='garbo'));
select 'T41 seed do contrato idempotente' t,
       (select count(*) from crm.contratos_modelos where empresa_id = (select v from t_ids where k='emp')) = 1
   and (select count(*) from crm.contratos_variaveis where empresa_id = (select v from t_ids where k='emp')) = 17
   and (select count(*) from crm.contratos_modelos where empresa_id = (select id from "CRM-multi-empresas>empresas<" where slug='garbo')) = (select n from t_ref_contratos) ok;

-- ===== Modelos padrão (docs/modelos-padrao/TASKS.md T04–T08, T17) =====

-- T42: admin de B não usa o catálogo nem as RPCs de modelos
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='admin.b@teste.local'),'role','authenticated')::text, true);
set local role authenticated;
do $$ begin
  if (select count(*) from plataforma_modelos) <> 0 then raise exception 'FALHOU T42: admin B leu plataforma_modelos'; end if;
  begin perform public.master_listar_modelos(); raise exception 'FALHOU T42: admin B listou modelos';
  exception when insufficient_privilege then null; end;
  begin perform public.master_criar_empresa_modelo('x', 'x_modelo', null, null); raise exception 'FALHOU T42: admin B criou empresa-modelo';
  exception when insufficient_privilege then null; end;
  begin perform public.plataforma_copiar_markup('2c196e67-dd26-4e1c-839d-4d234f3a3dfd', public.app_empresa_atual()); raise exception 'FALHOU T42: admin B chamou cópia interna';
  exception when insufficient_privilege then null; end;
  raise notice 'ok T42: catálogo e RPCs de modelos só do master';
end $$;

-- T43: master cria empresa-modelo importando da Garbo
reset role;
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='selvomichael@gmail.com'),'role','authenticated')::text, true);
set local role authenticated;
insert into t_ids values ('modelo', public.master_criar_empresa_modelo('Modelo Teste', 'modelo_teste', 'marcenaria', '2c196e67-dd26-4e1c-839d-4d234f3a3dfd'));
reset role;
do $$ declare m uuid := (select v from t_ids where k='modelo'); g uuid := '2c196e67-dd26-4e1c-839d-4d234f3a3dfd'; begin
  if (select count(*) from crm.markup_produtos where empresa_id = m) <> (select count(*) from crm.markup_produtos where empresa_id = g)
     or (select count(*) from crm.markup_produtos where empresa_id = m) = 0 then raise exception 'FALHOU T43: produtos'; end if;
  if (select count(*) from crm.markup_categorias where empresa_id = m) <> (select count(*) from crm.markup_categorias where empresa_id = g) then raise exception 'FALHOU T43: categorias'; end if;
  if exists (select 1 from crm.markup_produtos p join crm.markup_categorias c on c.id = p.categoria_id where p.empresa_id = m and c.empresa_id <> m)
    then raise exception 'FALHOU T43: produto ligado a categoria de outra empresa'; end if;
  if (select count(*) from crm.markup_config where empresa_id = m) <> 1 or exists (select 1 from crm.markup_config where empresa_id = m and timbrado_url is not null)
    then raise exception 'FALHOU T43: parâmetros/timbrado'; end if;
  if (select count(*) from crm.orcamento_slide_blocos where empresa_id = m) <> (select count(*) from crm.orcamento_slide_blocos where empresa_id = g) then raise exception 'FALHOU T43: blocos'; end if;
  if exists (select 1 from crm.orcamento_slide_blocos b join crm.orcamento_slide_templates t on t.id = b.template_id where b.empresa_id = m and t.empresa_id <> m)
    then raise exception 'FALHOU T43: bloco ligado a template de outra empresa'; end if;
  if exists (select 1 from crm.orcamento_slide_templates where empresa_id = m and (logo_url is not null or fundo_url is not null)) then raise exception 'FALHOU T43: marca no template'; end if;
  if exists (select 1 from crm.orcamento_slide_pergunta_opcoes o join crm.orcamento_slide_perguntas p on p.id = o.pergunta_id where o.empresa_id = m and p.empresa_id <> m)
    then raise exception 'FALHOU T43: opção ligada a pergunta de outra empresa'; end if;
  if (select count(*) from crm.orcamento_slide_pergunta_opcoes where empresa_id = m) <> (select count(*) from crm.orcamento_slide_pergunta_opcoes where empresa_id = g) then raise exception 'FALHOU T43: opções'; end if;
  if (select count(*) from crm.contratos_modelos where empresa_id = m) <> (select count(*) from crm.contratos_modelos where empresa_id = g)
     or (select count(*) from crm.contratos_modelos where empresa_id = m and ativo) <> 1 then raise exception 'FALHOU T43: contratos'; end if;
  if (select nome from crm.contratos_modelos where empresa_id = m and ativo) <> (select nome from crm.contratos_modelos where empresa_id = g and ativo)
    then raise exception 'FALHOU T43: ativo diferente da origem'; end if;
  raise notice 'ok T43: empresa-modelo com markup, slides e contratos da Garbo (ids remapeados, sem marca)';
end $$;
create temp table t_cont (k text primary key, n int) on commit drop;
grant all on t_cont to authenticated;
insert into t_cont values ('contratos_modelo', (select count(*) from crm.contratos_modelos where empresa_id = (select v from t_ids where k='modelo')));

-- T44/T45: listas do master
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='selvomichael@gmail.com'),'role','authenticated')::text, true);
set local role authenticated;
do $$ declare m uuid := (select v from t_ids where k='modelo'); begin
  if exists (select 1 from public.master_resumo_empresas() where empresa_id = m) then raise exception 'FALHOU T44: modelo no resumo'; end if;
  if exists (select 1 from public.master_faturamento_mensal() where empresa_id = m) then raise exception 'FALHOU T44: modelo no faturamento'; end if;
  if exists (select 1 from public.master_listar_empresas() where id = m) then raise exception 'FALHOU T44: modelo na lista de marcenarias'; end if;
  if not exists (select 1 from public.master_listar_empresas_modelo() where id = m and segmento = 'marcenaria') then raise exception 'FALHOU T44: lista de modelos'; end if;
  raise notice 'ok T44: empresa-modelo fora do resumo/faturamento/lista, presente na lista de modelos';
  if (select count(*) from public.master_listar_modelos(m) where tipo in ('markup','slides')) <> 2
     or (select count(*) from public.master_listar_modelos(m) where tipo = 'contrato') <> (select n from t_cont where k = 'contratos_modelo')
     or exists (select 1 from public.master_listar_modelos(m) where publicado) then raise exception 'FALHOU T45: catálogo'; end if;
  if ((select contagem->>'produtos' from public.master_listar_modelos(m) where tipo = 'markup'))::int = 0 then raise exception 'FALHOU T45: contagem'; end if;
  raise notice 'ok T45: catálogo sincronizado, nada publicado';
end $$;

-- T46: publicar + plano + nova empresa C recebe os modelos (sem duplicar o contrato padrão)
select public.master_publicar_modelo(id, true) from public.master_listar_modelos((select v from t_ids where k='modelo'))
 where tipo in ('markup','slides') or (tipo = 'contrato' and (contagem->>'ativo_no_modelo')::boolean);
select public.master_salvar_modelos_plano((select v from t_ids where k='plano'),
  (select array_agg(id) from public.master_listar_modelos((select v from t_ids where k='modelo')) where publicado and tipo in ('markup','slides','contrato')));
do $$ declare v_ok boolean := false; begin
  begin
    perform public.master_enviar_modelo((select id from public.master_listar_modelos((select v from t_ids where k='modelo')) where not publicado limit 1),
                                        array[(select v from t_ids where k='emp')]);
  exception when others then v_ok := sqlerrm like 'Publique%';
  end;
  if not v_ok then raise exception 'FALHOU T46: enviou modelo não publicado'; end if;
end $$;
insert into t_ids values ('emp_c', public.master_criar_empresa('Marcenaria Teste C', 'teste_c', 'admin.c@teste.local', 'Admin C', 'senha123',
  null, null, null, (select v from t_ids where k='plano'), null, 5));
reset role;
do $$ declare m uuid := (select v from t_ids where k='modelo'); c uuid := (select v from t_ids where k='emp_c'); begin
  if (select count(*) from crm.markup_produtos where empresa_id = c) <> (select count(*) from crm.markup_produtos where empresa_id = m) then raise exception 'FALHOU T46: produtos em C'; end if;
  if (select count(*) from crm.orcamento_slide_formas_pagamento where empresa_id = c) <> (select count(*) from crm.orcamento_slide_formas_pagamento where empresa_id = m) then raise exception 'FALHOU T46: formas em C'; end if;
  if (select count(*) from crm.contratos_modelos where empresa_id = c) <> 1
     or (select nome from crm.contratos_modelos where empresa_id = c) <> (select nome from crm.contratos_modelos where empresa_id = m and ativo)
     or not (select ativo from crm.contratos_modelos where empresa_id = c) then raise exception 'FALHOU T46: contrato em C'; end if;
  if (select count(*) from plataforma_modelo_entregas where empresa_id = c) <> 3 then raise exception 'FALHOU T46: entregas (%)', (select count(*) from plataforma_modelo_entregas where empresa_id = c); end if;
  raise notice 'ok T46: empresa criada com o plano recebeu markup, slides e o contrato (sem o padrão duplicado)';
end $$;

-- T47: reenvio só acrescenta
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='selvomichael@gmail.com'),'role','authenticated')::text, true);
set local role authenticated;
create temp table t_envio on commit drop as
  select m.tipo, public.master_enviar_modelo(m.id, array[(select v from t_ids where k='emp_c')]) r
    from public.master_listar_modelos((select v from t_ids where k='modelo')) m where m.publicado and m.tipo in ('markup','slides','contrato');
reset role;
do $$ declare c uuid := (select v from t_ids where k='emp_c'); m uuid := (select v from t_ids where k='modelo'); begin
  if exists (select 1 from t_envio where not (r->0->>'ok')::boolean) then raise exception 'FALHOU T47: envio com erro %', (select r from t_envio where not (r->0->>'ok')::boolean limit 1); end if;
  if (select (r->0->'resumo'->>'produtos')::int from t_envio where tipo = 'markup') <> 0
     or (select count(*) from crm.markup_produtos where empresa_id = c) <> (select count(*) from crm.markup_produtos where empresa_id = m) then raise exception 'FALHOU T47: markup duplicou'; end if;
  if (select (r->0->'resumo'->>'blocos')::int + (r->0->'resumo'->>'opcoes')::int from t_envio where tipo = 'slides') <> 0 then raise exception 'FALHOU T47: slides duplicou'; end if;
  if (select count(*) from crm.contratos_modelos where empresa_id = c) <> 2
     or (select count(*) from crm.contratos_modelos where empresa_id = c and ativo) <> 1
     or not exists (select 1 from crm.contratos_modelos where empresa_id = c and nome like '% (v2)' and not ativo) then raise exception 'FALHOU T47: contrato v2'; end if;
  raise notice 'ok T47: reenvio não duplica markup/slides; contrato chega como (v2) inativo';
end $$;

-- T48: admin C edita a cópia; modelo e Garbo não mudam
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='admin.c@teste.local'),'role','authenticated')::text, true);
set local role authenticated;
update crm.markup_produtos set preco_unitario = 98765.43;
update crm.contratos_modelos set conteudo = 'EDITADO PELA C' where ativo;
reset role;
do $$ declare c uuid := (select v from t_ids where k='emp_c'); begin
  if exists (select 1 from crm.markup_produtos where preco_unitario = 98765.43 and empresa_id <> c) then raise exception 'FALHOU T48: preço vazou'; end if;
  if (select count(*) from crm.markup_produtos where preco_unitario = 98765.43 and empresa_id = c) = 0 then raise exception 'FALHOU T48: C não editou'; end if;
  if exists (select 1 from crm.contratos_modelos where conteudo = 'EDITADO PELA C' and empresa_id <> c) then raise exception 'FALHOU T48: contrato vazou'; end if;
  raise notice 'ok T48: edição da cópia fica só na empresa C';
end $$;

-- T49: envio para empresa-modelo é recusado
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='selvomichael@gmail.com'),'role','authenticated')::text, true);
set local role authenticated;
do $$ declare r jsonb; m uuid := (select v from t_ids where k='modelo'); begin
  r := public.master_enviar_modelo((select id from public.master_listar_modelos(m) where tipo = 'markup'), array[m]);
  if (r->0->>'ok')::boolean then raise exception 'FALHOU T49: enviou para a empresa-modelo'; end if;
  raise notice 'ok T49: destino empresa-modelo recusado (%)', r->0->>'erro';
end $$;

-- T50: contrato apagado no modelo some do catálogo; histórico disponível
reset role;
delete from crm.contratos_modelos
 where id = (select ref_id from plataforma_modelos
              where empresa_modelo_id = (select v from t_ids where k='modelo') and tipo = 'contrato' and not publicado limit 1);
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='selvomichael@gmail.com'),'role','authenticated')::text, true);
set local role authenticated;
do $$ declare m uuid := (select v from t_ids where k='modelo'); begin
  if (select count(*) from public.master_listar_modelos(m) where tipo = 'contrato') <> (select n from t_cont where k = 'contratos_modelo') - 1
    then raise exception 'FALHOU T50: catálogo não acompanhou a exclusão'; end if;
  if (select count(*) from public.master_listar_entregas(null) where empresa_id = (select v from t_ids where k='emp_c')) < 6 then raise exception 'FALHOU T50: histórico'; end if;
  raise notice 'ok T50: catálogo sincroniza exclusões; histórico de entregas disponível';
end $$;
reset role;
-- T51: empresa-modelo importou apresentação e Pontua da Garbo; catálogo tem os 5 tipos
do $$ declare m uuid := (select v from t_ids where k='modelo'); g uuid := '2c196e67-dd26-4e1c-839d-4d234f3a3dfd'; begin
  if (select conteudo from crm.apresentacao_conteudo where empresa_id = m) is distinct from (select conteudo from crm.apresentacao_conteudo where empresa_id = g)
    then raise exception 'FALHOU T51: apresentação não importada'; end if;
  if (select pontua from crm.apresentacao_conteudo where empresa_id = m) is distinct from (select pontua from crm.apresentacao_conteudo where empresa_id = g)
    then raise exception 'FALHOU T51: Pontua não importado'; end if;
  if (select count(*) from plataforma_modelos where empresa_modelo_id = m and tipo in ('apresentacao','pontua')) <> 2 then raise exception 'FALHOU T51: catálogo sem apresentação/Pontua'; end if;
  raise notice 'ok T51: apresentação e Pontua importados para a empresa-modelo e no catálogo';
end $$;

-- T52: publicar e enviar apresentação + Pontua para C (modelo com comissão padrão de 12%)
insert into crm.lead_custom_field_definitions (empresa_id, nome, tipo, ordem, ativo, config_pontua)
values ((select v from t_ids where k='modelo'), 'Pontua', 'usuario_sistema', 0, true, '{"ativo": true, "percentual_padrao": 12}');
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='selvomichael@gmail.com'),'role','authenticated')::text, true);
set local role authenticated;
do $$ declare m uuid := (select v from t_ids where k='modelo'); c uuid := (select v from t_ids where k='emp_c'); r jsonb; mid uuid; begin
  for mid in select id from public.master_listar_modelos(m) where tipo in ('apresentacao','pontua') loop
    if not (select (contagem->>'configurado')::boolean from public.master_listar_modelos(m) where id = mid) then raise exception 'FALHOU T52: contagem configurado'; end if;
    perform public.master_publicar_modelo(mid, true);
    r := public.master_enviar_modelo(mid, array[c]);
    if not (r->0->>'ok')::boolean or not (r->0->'resumo'->>'copiado')::boolean then raise exception 'FALHOU T52: envio %', r; end if;
  end loop;
  raise notice 'ok T52: apresentação e Pontua enviados para C';
end $$;
reset role;
do $$ declare m uuid := (select v from t_ids where k='modelo'); c uuid := (select v from t_ids where k='emp_c'); begin
  if (select conteudo from crm.apresentacao_conteudo where empresa_id = c) is distinct from (select conteudo from crm.apresentacao_conteudo where empresa_id = m)
    then raise exception 'FALHOU T52: conteúdo em C'; end if;
  if (select (config_pontua->>'percentual_padrao')::numeric from crm.lead_custom_field_definitions
       where empresa_id = c and tipo = 'usuario_sistema' and config_pontua is not null) is distinct from 12
    then raise exception 'FALHOU T52: comissão padrão do Pontua em C'; end if;
  if not exists (select 1 from crm.lead_custom_field_definitions where empresa_id = c and tipo = 'usuario_sistema' and nome = 'Pontua')
    then raise exception 'FALHOU T57: campo copiado não se chama Pontua'; end if;
end $$;

-- T53: admin C edita a própria apresentação; modelo e Garbo intactos; reenvio não sobrescreve
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='admin.c@teste.local'),'role','authenticated')::text, true);
set local role authenticated;
update crm.apresentacao_conteudo set conteudo = jsonb_set(conteudo, '{marca,titulo}', '"Marcenaria C"');
do $$ begin
  if (select count(*) from crm.apresentacao_conteudo) <> 1 then raise exception 'FALHOU T53: admin C vê apresentação de outra empresa'; end if;
end $$;
reset role;
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='selvomichael@gmail.com'),'role','authenticated')::text, true);
set local role authenticated;
do $$ declare r jsonb; begin
  r := public.master_enviar_modelo((select id from public.master_listar_modelos((select v from t_ids where k='modelo')) where tipo = 'apresentacao'),
                                   array[(select v from t_ids where k='emp_c')]);
  if (r->0->'resumo'->>'copiado')::boolean then raise exception 'FALHOU T53: reenvio sobrescreveu'; end if;
end $$;
reset role;
do $$ declare c uuid := (select v from t_ids where k='emp_c'); begin
  if (select conteudo->'marca'->>'titulo' from crm.apresentacao_conteudo where empresa_id = c) <> 'Marcenaria C' then raise exception 'FALHOU T53: edição de C perdida'; end if;
  if exists (select 1 from crm.apresentacao_conteudo where empresa_id <> c and conteudo->'marca'->>'titulo' = 'Marcenaria C') then raise exception 'FALHOU T53: edição vazou'; end if;
  raise notice 'ok T53: edição da apresentação fica em C; reenvio não sobrescreve';
end $$;

-- T54: master em somente leitura não altera; link público por slug
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='selvomichael@gmail.com'),'role','authenticated')::text, true);
set local role authenticated;
select public.master_definir_empresa_ativa((select v from t_ids where k='emp_c'), true);
update crm.apresentacao_conteudo set conteudo = '{}'::jsonb;
select public.master_sair_empresa();
reset role;
do $$ declare c uuid := (select v from t_ids where k='emp_c'); begin
  if (select conteudo from crm.apresentacao_conteudo where empresa_id = c) = '{}'::jsonb then raise exception 'FALHOU T54: master em leitura alterou'; end if;
end $$;
set local role anon;
do $$ declare r jsonb; begin
  r := public.apresentacao_publica('teste_c');
  if r is null or r->'conteudo'->'marca'->>'titulo' <> 'Marcenaria C' or r->>'nome' <> 'Marcenaria Teste C' then raise exception 'FALHOU T54: link público %', r; end if;
  if public.apresentacao_publica('modelo_teste') is not null then raise exception 'FALHOU T54: empresa-modelo com link público'; end if;
  raise notice 'ok T54: leitura do master bloqueada; link público por slug (sem empresa-modelo)';
end $$;
reset role;

-- T55: admin B não lê apresentação de ninguém além da própria (nenhuma)
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='admin.b@teste.local'),'role','authenticated')::text, true);
set local role authenticated;
do $$ begin
  if (select count(*) from crm.apresentacao_conteudo) <> 0 then raise exception 'FALHOU T55: admin B leu apresentação alheia'; end if;
  raise notice 'ok T55: apresentação isolada por empresa';
end $$;
reset role;

-- T56 (marca neutra): empresas-modelo reais sem marca de cliente; id de página "pontua"
do $$ declare n int; begin
  select count(*) into n from crm.apresentacao_conteudo a join "CRM-multi-empresas>empresas<" e on e.id = a.empresa_id
   where e.e_modelo and e.slug <> 'modelo_teste' and (a.conteudo::text ~* 'garbo' or a.pontua::text ~* 'garbo');
  if n > 0 then raise exception 'FALHOU T56: apresentação de empresa-modelo cita marca de cliente'; end if;
  select count(*) into n from crm.contratos_modelos c join "CRM-multi-empresas>empresas<" e on e.id = c.empresa_id
   where e.e_modelo and e.slug <> 'modelo_teste' and c.conteudo ~ '58\.838\.942|127\.279\.396';
  if n > 0 then raise exception 'FALHOU T56: contrato de empresa-modelo com CNPJ/CPF de cliente'; end if;
  if exists (select 1 from plataforma_planos where 'pontuaGarbo' = any(paginas_bloqueadas))
     or exists (select 1 from plataforma_empresa_paginas where pagina_id = 'pontuaGarbo')
    then raise exception 'FALHOU T56: id de página antigo'; end if;
  if exists (select 1 from crm.apresentacao_conteudo where pontua ? 'title' and pontua->>'title' ~* 'garbo')
    then raise exception 'FALHOU T56: título do Pontua com marca'; end if;
  raise notice 'ok T56: empresa-modelo sem marca de cliente; página pontua';
end $$;

-- T57 (marca neutra): esquema e funções sem nome de empresa cliente; recibo usa o nome da empresa
do $$ declare t text := 'gar' || 'bo'; begin
  if exists (select 1 from pg_class where relname ilike '%'||t||'%') then raise exception 'FALHOU T57: tabela/índice com nome de cliente'; end if;
  if exists (select 1 from information_schema.columns where column_name ilike '%'||t||'%') then raise exception 'FALHOU T57: coluna'; end if;
  if exists (select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
              where n.nspname not in ('pg_catalog','information_schema') and (p.proname ilike '%'||t||'%' or p.prosrc ilike '%'||t||'%'))
    then raise exception 'FALHOU T57: função'; end if;
  if exists (select 1 from pg_trigger where tgname ilike '%'||t||'%') then raise exception 'FALHOU T57: trigger'; end if;
  if exists (select 1 from information_schema.columns where column_default ilike '%'||t||'%') then raise exception 'FALHOU T57: default'; end if;
  if (select prosrc from pg_proc where proname = 'movelaria_gerar_texto_recibo_prestador') not like '%app_empresa_atual()%'
    then raise exception 'FALHOU T57: recibo sem o nome da empresa'; end if;
  raise notice 'ok T57: esquema sem nome de cliente; campo do programa = Pontua; recibo com nome da empresa';
end $$;

-- T58: banners do portal só na empresa-modelo; entregues pelo pacote Pontua sem sobrescrever
update "CRM-multi-empresas>empresas<" set banner_slides_desktop = '["https://exemplo/d1.jpg"]', banner_slides_mobile = '["https://exemplo/m1.jpg"]'
 where id = (select v from t_ids where k='modelo');
update "CRM-multi-empresas>empresas<" set banner_slides_desktop = '[]', banner_slides_mobile = '[]' where id = (select v from t_ids where k='emp_c');
do $$ declare r jsonb; c uuid := (select v from t_ids where k='emp_c'); begin
  r := public.plataforma_copiar_pontua((select v from t_ids where k='modelo'), c);
  if not (r->>'banners')::boolean then raise exception 'FALHOU T58: banners não copiados %', r; end if;
  if (select banner_slides_desktop->>0 from "CRM-multi-empresas>empresas<" where id = c) <> 'https://exemplo/d1.jpg' then raise exception 'FALHOU T58: banner em C'; end if;
  r := public.plataforma_copiar_pontua((select v from t_ids where k='modelo'), c);
  if (r->>'banners')::boolean then raise exception 'FALHOU T58: reenvio sobrescreveu banners'; end if;
end $$;
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='admin.c@teste.local'),'role','authenticated')::text, true);
set local role authenticated;
do $$ declare ok boolean := false; begin
  if (public.app_empresa_portal()->>'e_modelo')::boolean then raise exception 'FALHOU T58: C marcada como modelo'; end if;
  if jsonb_array_length(public.app_empresa_portal()->'banner_slides_desktop') <> 1 then raise exception 'FALHOU T58: C não lê os banners'; end if;
  begin
    perform public.empresa_atualizar_banners('[]', '[]');
  exception when others then ok := true;
  end;
  if not ok then raise exception 'FALHOU T58: empresa comum alterou banners'; end if;
  raise notice 'ok T58: banners só no modelo; chegam pelo Pontua sem sobrescrever; empresa comum não altera';
end $$;
reset role;

-- T59: interface da página Pontua definida pelo master na empresa-modelo e entregue pelo pacote
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='selvomichael@gmail.com'),'role','authenticated')::text, true);
set local role authenticated;
do $$ declare m uuid := (select v from t_ids where k='modelo'); c uuid := (select v from t_ids where k='emp_c'); r jsonb; ok boolean := false; begin
  r := public.master_definir_pontua_interface(m, 'classica');
  if r->>'interface' <> 'classica' then raise exception 'FALHOU T59: retorno %', r; end if;
  if (select contagem->>'interface' from public.master_listar_modelos(m) where tipo = 'pontua') <> 'classica'
    then raise exception 'FALHOU T59: catálogo não mostra a interface'; end if;
  begin perform public.master_definir_pontua_interface(m, 'inexistente'); exception when others then ok := true; end;
  if not ok then raise exception 'FALHOU T59: aceitou interface inválida'; end if;
  ok := false;
  begin perform public.master_definir_pontua_interface(c, 'classica'); exception when others then ok := true; end;
  if not ok then raise exception 'FALHOU T59: definiu interface em empresa que não é modelo'; end if;
end $$;
reset role;
do $$ declare m uuid := (select v from t_ids where k='modelo'); c uuid := (select v from t_ids where k='emp_c'); r jsonb; texto_antes jsonb; begin
  if (select pontua - 'interface' from crm.apresentacao_conteudo where empresa_id = m) = '{}'::jsonb
    then raise exception 'FALHOU T59: definir a interface apagou o texto do modelo'; end if;
  -- C já tem conteúdo próprio sem `interface`: o envio só acrescenta a chave, sem tocar no texto.
  update crm.apresentacao_conteudo set pontua = pontua - 'interface' where empresa_id = c;
  texto_antes := (select pontua from crm.apresentacao_conteudo where empresa_id = c);
  r := public.plataforma_copiar_pontua(m, c);
  if not (r->>'interface')::boolean then raise exception 'FALHOU T59: interface não entregue %', r; end if;
  if (select pontua->>'interface' from crm.apresentacao_conteudo where empresa_id = c) <> 'classica'
    then raise exception 'FALHOU T59: C sem a interface do modelo'; end if;
  if (select pontua - 'interface' from crm.apresentacao_conteudo where empresa_id = c) is distinct from (texto_antes - 'interface')
    then raise exception 'FALHOU T59: entrega da interface alterou o texto de C'; end if;
  -- Escolha própria de C não é sobrescrita pelo reenvio.
  update crm.apresentacao_conteudo set pontua = jsonb_set(pontua, '{interface}', '"sem_marca"') where empresa_id = c;
  r := public.plataforma_copiar_pontua(m, c);
  if (r->>'interface')::boolean or (select pontua->>'interface' from crm.apresentacao_conteudo where empresa_id = c) <> 'sem_marca'
    then raise exception 'FALHOU T59: reenvio sobrescreveu a interface de C'; end if;
  raise notice 'ok T59: interface definida só no modelo (validada), entregue sem tocar no texto e sem sobrescrever';
end $$;
select set_config('request.jwt.claims', json_build_object('sub',(select id from auth.users where email='admin.c@teste.local'),'role','authenticated')::text, true);
set local role authenticated;
do $$ declare ok boolean := false; begin
  begin perform public.master_definir_pontua_interface((select v from t_ids where k='modelo'), 'classica'); exception when others then ok := true; end;
  if not ok then raise exception 'FALHOU T59: admin de empresa definiu interface'; end if;
end $$;
reset role;
rollback;
