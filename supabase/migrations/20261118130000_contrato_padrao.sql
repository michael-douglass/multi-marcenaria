-- C02 (Fase K) — Modelo de contrato pré-cadastrado em toda marcenaria.
-- Ver docs/contrato-padrao/DESIGN.md. Par no front: src/lib/contrato-padrao.ts (mesmo texto e mesmos
-- campos; ao mudar um, mude o outro — scripts/test-contrato-padrao.mjs compara os dois).
--
-- 1. Representante legal na empresa (+ app_minha_empresa, + empresa_atualizar_dados).
-- 2. crm.contratos_variaveis: valor_padrao, tipos numero/sim_nao, unique (empresa_id, nome).
-- 3. crm_seed_contrato_padrao(empresa): modelo "Contrato padrão — móveis planejados" + 17 campos,
--    só para empresa sem nenhum modelo. Chamado por plataforma_seed_empresa e pelo backfill.

-- 1. Representante legal ---------------------------------------------------------------------------
alter table public."CRM-multi-empresas>empresas<"
  add column if not exists representante_nome text,
  add column if not exists representante_cpf text,
  add column if not exists representante_qualificacao text;

-- CPF: 11 dígitos com dígitos verificadores válidos (rejeita sequências repetidas).
create or replace function public.app_cpf_valido(p_cpf text)
returns boolean language plpgsql immutable set search_path = public, pg_temp as $$
declare
  d text := regexp_replace(coalesce(p_cpf, ''), '\D', '', 'g');
  s int;
  dv1 int;
  dv2 int;
begin
  if length(d) <> 11 or d ~ '^(\d)\1{10}$' then return false; end if;
  s := 0;
  for i in 1..9 loop s := s + substr(d, i, 1)::int * (11 - i); end loop;
  dv1 := (s * 10) % 11; if dv1 = 10 then dv1 := 0; end if;
  s := 0;
  for i in 1..10 loop s := s + substr(d, i, 1)::int * (12 - i); end loop;
  dv2 := (s * 10) % 11; if dv2 = 10 then dv2 := 0; end if;
  return dv1 = substr(d, 10, 1)::int and dv2 = substr(d, 11, 1)::int;
end $$;

-- app_minha_empresa: as 22 colunas atuais na mesma ordem + representante no fim (tipo de retorno muda).
drop function if exists public.app_minha_empresa();
create function public.app_minha_empresa()
returns table (id uuid, nome text, slug text, status text, ativo boolean, logo_url text,
               cor_primaria text, cnpj text, razao_social text, is_master boolean,
               paginas_bloqueadas text[], em_inspecao boolean, inspecao_somente_leitura boolean,
               cep text, logradouro text, numero text, complemento text, bairro text,
               cidade text, uf text, telefone text, email text,
               representante_nome text, representante_cpf text, representante_qualificacao text)
language sql stable security definer set search_path = public, pg_temp as $$
  select e.id, e.nome, e.slug, e.status, e.ativo, e.logo_url, e.cor_primaria, e.cnpj, e.razao_social,
         public.app_is_master(),
         public.app_paginas_bloqueadas(e.id),
         c.user_id is not null,
         coalesce(c.somente_leitura, false),
         e.cep, e.logradouro, e.numero, e.complemento, e.bairro, e.cidade, e.uf, e.telefone, e.email,
         e.representante_nome, e.representante_cpf, e.representante_qualificacao
    from "CRM-multi-empresas>empresas<" e
    left join plataforma_master_contexto c on c.user_id = auth.uid() and c.empresa_id = e.id
   where e.id = coalesce(
     public.app__empresa_do_usuario(auth.uid()),
     -- usuário de empresa bloqueada: ainda devolve a empresa (para a tela de acesso suspenso);
     -- o master sem inspeção não cai aqui (não tem vínculo usado como fallback)
     (select ue.empresa_id from "CRM-multi-empresas>usuario_empresa<" ue
       where ue.user_id = auth.uid() and not public.app_is_master())
   );
$$;
revoke all on function public.app_minha_empresa() from public, anon;
grant execute on function public.app_minha_empresa() to authenticated, service_role;

-- empresa_atualizar_dados: igual a 20261118120100 + as 3 colunas do representante.
create or replace function public.empresa_atualizar_dados(p_dados jsonb)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_emp uuid := public.app_empresa_atual();
  v_cnpj text;
  v_uf text;
  v_rep_cpf text;
  v_chave text;
  c_permitidas constant text[] := array['nome', 'razao_social', 'cnpj', 'cep', 'logradouro', 'numero',
    'complemento', 'bairro', 'cidade', 'uf', 'telefone', 'email', 'logo_url', 'cor_primaria',
    'representante_nome', 'representante_cpf', 'representante_qualificacao'];
begin
  perform public.app_assert_escrita_permitida();

  if auth.uid() is null or v_emp is null then
    raise exception 'Sem empresa ativa' using errcode = '42501';
  end if;

  if not (
    exists (select 1 from crm.user_roles r
             where r.user_id = auth.uid() and r.empresa_id = v_emp and r.role = 'admin')
    or (public.app_is_master()
        and exists (select 1 from plataforma_master_contexto c
                     where c.user_id = auth.uid() and c.empresa_id = v_emp and not c.somente_leitura))
  ) then
    raise exception 'Apenas o administrador da empresa pode alterar os dados da empresa' using errcode = '42501';
  end if;

  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then
    raise exception 'Dados inválidos' using errcode = '22023';
  end if;

  for v_chave in select jsonb_object_keys(p_dados) loop
    if not v_chave = any (c_permitidas) then
      raise exception 'Campo não permitido: %', v_chave using errcode = '22023';
    end if;
  end loop;

  if p_dados ? 'cnpj' then
    v_cnpj := nullif(regexp_replace(coalesce(p_dados ->> 'cnpj', ''), '\D', '', 'g'), '');
    if v_cnpj is not null and length(v_cnpj) <> 14 then
      raise exception 'CNPJ deve ter 14 dígitos' using errcode = '22023';
    end if;
  end if;

  if p_dados ? 'uf' then
    v_uf := nullif(upper(trim(coalesce(p_dados ->> 'uf', ''))), '');
    if v_uf is not null and v_uf !~ '^[A-Z]{2}$' then
      raise exception 'UF inválida' using errcode = '22023';
    end if;
  end if;

  if p_dados ? 'representante_cpf' then
    v_rep_cpf := nullif(regexp_replace(coalesce(p_dados ->> 'representante_cpf', ''), '\D', '', 'g'), '');
    if v_rep_cpf is not null and not public.app_cpf_valido(v_rep_cpf) then
      raise exception 'CPF do representante inválido' using errcode = '22023';
    end if;
  end if;

  update "CRM-multi-empresas>empresas<" e set
    nome         = case when p_dados ? 'nome' then coalesce(nullif(trim(p_dados ->> 'nome'), ''), e.nome) else e.nome end,
    razao_social = case when p_dados ? 'razao_social' then nullif(trim(p_dados ->> 'razao_social'), '') else e.razao_social end,
    cnpj         = case when p_dados ? 'cnpj' then v_cnpj else e.cnpj end,
    cep          = case when p_dados ? 'cep' then nullif(regexp_replace(coalesce(p_dados ->> 'cep', ''), '\D', '', 'g'), '') else e.cep end,
    logradouro   = case when p_dados ? 'logradouro' then nullif(trim(p_dados ->> 'logradouro'), '') else e.logradouro end,
    numero       = case when p_dados ? 'numero' then nullif(trim(p_dados ->> 'numero'), '') else e.numero end,
    complemento  = case when p_dados ? 'complemento' then nullif(trim(p_dados ->> 'complemento'), '') else e.complemento end,
    bairro       = case when p_dados ? 'bairro' then nullif(trim(p_dados ->> 'bairro'), '') else e.bairro end,
    cidade       = case when p_dados ? 'cidade' then nullif(trim(p_dados ->> 'cidade'), '') else e.cidade end,
    uf           = case when p_dados ? 'uf' then v_uf else e.uf end,
    telefone     = case when p_dados ? 'telefone' then nullif(trim(p_dados ->> 'telefone'), '') else e.telefone end,
    email        = case when p_dados ? 'email' then nullif(lower(trim(p_dados ->> 'email')), '') else e.email end,
    logo_url     = case when p_dados ? 'logo_url' then nullif(trim(p_dados ->> 'logo_url'), '') else e.logo_url end,
    cor_primaria = case when p_dados ? 'cor_primaria' then nullif(trim(p_dados ->> 'cor_primaria'), '') else e.cor_primaria end,
    representante_nome = case when p_dados ? 'representante_nome'
                              then nullif(trim(p_dados ->> 'representante_nome'), '') else e.representante_nome end,
    representante_cpf  = case when p_dados ? 'representante_cpf' then v_rep_cpf else e.representante_cpf end,
    representante_qualificacao = case when p_dados ? 'representante_qualificacao'
                              then nullif(trim(p_dados ->> 'representante_qualificacao'), '') else e.representante_qualificacao end,
    atualizado_em = now()
  where e.id = v_emp;
end $$;

revoke all on function public.empresa_atualizar_dados(jsonb) from public, anon;
grant execute on function public.empresa_atualizar_dados(jsonb) to authenticated;

-- 2. Campos do contrato ----------------------------------------------------------------------------
alter table crm.contratos_variaveis add column if not exists valor_padrao text;

alter table crm.contratos_variaveis drop constraint if exists contratos_variaveis_tipo_check;
alter table crm.contratos_variaveis add constraint contratos_variaveis_tipo_check
  check (tipo = any (array['texto', 'data', 'valor', 'cpf', 'numero', 'sim_nao']));

-- Duplicatas (o auto-insert do {{cpf}} no front podia repetir a linha): mantém a mais antiga.
delete from crm.contratos_variaveis v
 using crm.contratos_variaveis o
 where v.empresa_id = o.empresa_id and v.nome = o.nome
   and (o.created_at, o.id) < (v.created_at, v.id);

alter table crm.contratos_variaveis drop constraint if exists contratos_variaveis_empresa_nome_key;
alter table crm.contratos_variaveis add constraint contratos_variaveis_empresa_nome_key unique (empresa_id, nome);

-- 3. Seed do contrato padrão -----------------------------------------------------------------------
create or replace function public.crm_seed_contrato_padrao(p_empresa uuid)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  if p_empresa is null then raise exception 'Empresa obrigatória'; end if;
  perform public.app_set_empresa_ctx(p_empresa);
  -- Empresa que já tem qualquer modelo não é tocada.
  if exists (select 1 from crm.contratos_modelos where empresa_id = p_empresa) then return; end if;

  insert into crm.contratos_variaveis
    (empresa_id, nome, label, tipo, valor_padrao, obrigatorio, mostrar_no_link_publico, ordem) values
    (p_empresa, 'cpf', 'CPF do Contratante', 'cpf', null, true, false, -1),
    (p_empresa, 'nome_do_cliente', 'Nome do cliente', 'texto', null, true, true, 1),
    (p_empresa, 'endereco', 'Endereço do cliente', 'texto', null, true, false, 2),
    (p_empresa, 'telefone', 'Telefone do cliente', 'texto', null, true, true, 3),
    (p_empresa, 'email', 'E-mail do cliente', 'texto', null, false, true, 4),
    (p_empresa, 'valor_total', 'Valor total', 'valor', null, true, false, 10),
    (p_empresa, 'ambientes_contemplados', 'Ambientes contemplados', 'texto', null, true, false, 11),
    (p_empresa, 'prazo_entrega_dias', 'Prazo de entrega (dias corridos)', 'numero', null, true, false, 12),
    (p_empresa, 'data_inicio_obra', 'Início da contagem do prazo', 'data', null, true, false, 13),
    (p_empresa, 'data_assinatura', 'Data da assinatura', 'data', null, true, false, 14),
    (p_empresa, 'percentual_entrada', 'Entrada (%)', 'numero', '60', true, false, 20),
    (p_empresa, 'garantia_anos', 'Garantia (anos)', 'numero', '2', true, false, 21),
    (p_empresa, 'tolerancia_dias', 'Tolerância (dias)', 'numero', '10', true, false, 22),
    (p_empresa, 'prazo_ajustes_dias', 'Prazo para pedir ajustes (dias)', 'numero', '30', true, false, 23),
    (p_empresa, 'foro_cidade', 'Foro (cidade/UF)', 'texto', '{{empresa_cidade_uf}}', true, false, 24),
    (p_empresa, 'chave_pix', 'Chave PIX', 'texto', '{{empresa_cnpj}}', true, false, 25),
    (p_empresa, 'incluir_clausula_imagem', 'Incluir cláusula de uso de imagem', 'sim_nao', 'sim', false, false, 26)
  on conflict (empresa_id, nome) do nothing;

  insert into crm.contratos_modelos (empresa_id, nome, conteudo, ativo, updated_at)
  values (p_empresa, 'Contrato padrão — móveis planejados', $modelo$CONTRATO DE PRESTAÇÃO DE SERVIÇO DE CONSTRUÇÃO, INSTALAÇÃO E MONTAGEM DE MÓVEIS PLANEJADOS

Por este instrumento particular de prestação de serviço, de um lado:
CONTRATANTE: {{nome_do_cliente}}, brasileiro(a), inscrito no CPF sob o nº {{cpf}}, residente e domiciliado {{endereco}}, Telefone: {{telefone}}.

CONTRATADO: {{empresa_razao_social}}, inscrita no CNPJ sob o nº {{empresa_cnpj}}, Telefone: {{empresa_telefone}}, neste ato representada por {{empresa_representante_nome}}, {{empresa_representante_qualificacao}}, inscrito no CPF sob o nº {{empresa_representante_cpf}}, com endereço profissional na {{empresa_endereco}}.

Têm entre si, justo e contratado, a PRESTAÇÃO DE SERVIÇOS DE MARCENARIA, mediante os termos e condições abaixo discriminados.

1. DO OBJETO DA CONTRATAÇÃO
1.1 Por se tratar de produção de móveis personalizados e pré-aprovados pela CONTRATANTE, não serão permitidas trocas de nenhuma natureza nos materiais descritos na especificação técnica, exceto aquelas eventualmente necessárias e detectadas no momento da medição técnica, bem como aquelas que não prejudiquem o orçamento aprovado, sob pena de variação no preço do objeto contratado.
1.2 A CONTRATADA não será responsável pelos serviços de elétrica e hidráulica, bem como adaptações e/ou adequações de alvenaria, elétrica ou estrutura de rebocos e paredes no local onde serão instalados os móveis.
1.3 Para a instalação dos móveis com fita LED e outros componentes elétricos, deverá a CONTRATADA, após análise das partes e se necessário, prover a contratação de profissional eletricista para acompanhar a montagem, de forma que a instalação não fique prejudicada.
2. DO PREÇO E CONDIÇÕES DE PAGAMENTO
2.1 O preço total acordado para o conjunto dos móveis planejados, incluindo todo o material, ferragens especiais, visitas técnicas de medição, instalação e acabamento, é de R$ {{valor_total}} ({{valor_total_extenso}}), o qual será quitado pelo CONTRATANTE da seguinte forma:
a) Entrada ({{percentual_entrada}}%): O valor de R$ {{valor_entrada}} ({{valor_entrada_extenso}}), a ser pago obrigatoriamente por meio de transferência eletrônica instantânea via PIX (Chave PIX: {{chave_pix}} - {{empresa_nome}}) no ato de assinatura deste instrumento. Este contrato passará a ser plenamente efetivo e o início dos prazos de fabricação e entrega previstos na Cláusula 4.1 passará a contar somente após a efetiva compensação e recebimento do referido pagamento via PIX;
b) Entrega ({{percentual_saldo}}%): O valor restante de R$ {{valor_saldo}} ({{valor_saldo_extenso}}), a ser pago imediatamente após a efetiva entrega, montagem e finalização de todos os móveis objeto deste contrato.
2.2 Caso o projeto aprovado seja modificado, por pedido ou mediante autorização da CONTRATANTE, durante a visita técnica de medição e posterior execução, poderá o CONTRATADO reajustar o valor do ORÇAMENTO.
3. DAS OBRIGAÇÕES DAS PARTES
3.1 Sendo obrigações do CONTRATANTE:
a) Disponibilizar o local da montagem livre de obras de construção ou reforma. Se por qualquer motivo a instalação for sobrestada em razão de tais obras, o pagamento referente à montagem deverá ser creditado até a data estipulada da entrega total, para que esta seja remarcada de comum acordo, não sendo os CONTRATADOS responsabilizados por atrasos a que não deram causa;
b) Apresentar ao profissional responsável pela montagem e instalação dos bens a planta hidráulica, elétrica, de aquecimento, refrigeração ou de gás do local. A inobservância desta cláusula desobriga o CONTRATADO de qualquer responsabilidade por eventuais danos de instalação;
c) Apresentar-se ou designar responsável no local da montagem, nos dias e horários combinados com o CONTRATADO, para viabilizar a realização dos serviços;
d) O CONTRATADO exime-se de qualquer responsabilidade referente a: existência de rebocos e tijolos frágeis ou de má qualidade que impeçam a sustentação robusta dos móveis; desníveis de paredes que impossibilitem a instalação segura; e ocorrência de focos de umidade, exposição solar excessiva ou infestações de insetos que possam danificar os bens.
3.2 Sendo obrigações dos CONTRATADOS:
a) Empregar as melhores técnicas e utilizar os melhores materiais para a execução do projeto ora contratado;
b) Cumprir todos os prazos aqui estipulados e cientificar o CONTRATANTE sobre as etapas de cumprimento dos serviços;
c) Produzir, instalar e adaptar o móvel na estrutura do ambiente, de acordo com o projeto de interiores referenciado;
d) Garantir o funcionamento de toda a estrutura, fornecendo garantia de {{garantia_anos}} ({{garantia_anos_extenso}}) anos, desde que o ambiente esteja livre de vazamentos e outros vícios que possam comprometer a integridade da madeira e/ou dos revestimentos.
4. DOS PRAZOS E OUTRAS AVENÇAS
4.1 É obrigação do CONTRATADO entregar, instalar e montar os produtos no prazo de {{prazo_entrega_dias}} ({{prazo_entrega_dias_extenso}}) dias corridos a contar do dia {{data_inicio_obra}}, observado o condicionante de efetivação do contrato descrito na Cláusula 2.1 (a). Considera-se também um prazo de {{tolerancia_dias}} ({{tolerancia_dias_extenso}}) dias de tolerância em caso de imprevistos devidamente justificados, observando-se o seguinte:
a) O CONTRATADO informará acerca do desenvolvimento da produção e realizará as instalações em etapas, de modo que no prazo indicado, todos os móveis estejam devidamente instalados;
b) Caso ocorram avarias nos móveis já instalados em razão da movimentação de outros prestadores de serviço no decorrer da finalização da obra, não haverá cobertura pela garantia do CONTRATADO;
c) Eventuais ajustes, regulagens e acabamentos adicionais podem ser realizados após a entrega, desde que solicitados pelo CONTRATANTE, não sendo computados no prazo limite do item 4.1.
4.2 Instalados e montados os produtos, a CONTRATANTE terá o prazo de {{prazo_ajustes_dias}} ({{prazo_ajustes_dias_extenso}}) dias para sinalizar a necessidade de ajustes técnicos adicionais.
4.3 A vigência do presente contrato inicia-se na data de sua assinatura e encerra-se com a efetiva entrega dos serviços.
{{#se incluir_clausula_imagem}}
4.4 A CONTRATANTE autoriza a captação de imagens do processo de construção e finalização dos móveis planejados contratados para veiculação nas redes sociais do CONTRATADO, comprometendo-se este a preservar dados pessoais, endereço e valores, limitando-se à exibição do ambiente trabalhado (registro de "antes" e "depois").
{{/se}}

5. DESCRITIVO E ESPECIFICAÇÕES TÉCNICAS DO PROJETO
5.1 Ambientes Contemplados
{{ambientes_contemplados}}

5.2 Especificações de Materiais e Acabamentos
Corrediça telescópica oferece suavidade, enquanto a invisível proporciona estética e qualidade. Dobradiças com amortecimento garantem durabilidade e conforto. Já a dobradiça 3D se destaca pela regulagem precisa, acabamento sofisticado e melhor alinhamento das portas, proporcionando mais estabilidade, praticidade e um padrão superior.

6. DO FORO
As partes elegem o Foro da Comarca de {{foro_cidade}} para dirimir quaisquer dúvidas ou controvérsias oriundas deste instrumento, renunciando expressamente a qualquer outro, por mais privilegiado que seja.
E, por estarem justas e contratadas, assinam o presente instrumento em duas vias de igual teor e forma na presença das testemunhas abaixo designadas.

{{empresa_cidade_uf}}, {{data_assinatura}}.$modelo$, true, now());
end $$;
revoke all on function public.crm_seed_contrato_padrao(uuid) from public, anon, authenticated;

-- Seed de empresa nova: igual ao anterior (20261118110000) + o contrato padrão.
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

  perform public.crm_seed_pipeline_padrao(p_empresa_id);
  perform public.crm_seed_contrato_padrao(p_empresa_id);
end $$;
revoke all on function public.plataforma_seed_empresa(uuid) from public, anon, authenticated;

-- Backfill: empresas sem nenhum modelo recebem o contrato padrão (quem já tem modelo não muda).
do $$
declare e record;
begin
  for e in select id from "CRM-multi-empresas>empresas<" loop
    perform public.crm_seed_contrato_padrao(e.id);
  end loop;
  perform set_config('app.empresa_ctx', '', true);
end $$;
