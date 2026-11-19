-- Modelos padrão (T13) — apresentação para arquitetos e Pontua como conteúdo por empresa.
-- Ver docs/modelos-padrao/DESIGN.md §4. O front mescla o salvo sobre o padrão
-- (src/components/marketing/apresentacao-empresa/apresentacao-conteudo.ts).

create table if not exists crm.apresentacao_conteudo (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public."CRM-multi-empresas>empresas<"(id) on delete cascade,
  conteudo jsonb not null default '{}'::jsonb,
  pontua jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid,
  constraint apresentacao_conteudo_empresa_key unique (empresa_id)
);

-- Tenant: trigger, isolamento, leitura do master, definer -----------------------------------------
drop trigger if exists aaa_tenant_fill on crm.apresentacao_conteudo;
create trigger aaa_tenant_fill before insert on crm.apresentacao_conteudo for each row execute function public.app_tenant_fill();

alter table crm.apresentacao_conteudo enable row level security;
drop policy if exists tenant_isolamento on crm.apresentacao_conteudo;
create policy tenant_isolamento on crm.apresentacao_conteudo as restrictive for all to public
  using (empresa_id = (select public.app_empresa_atual())) with check (empresa_id = (select public.app_empresa_atual()));
drop policy if exists tenant_definer on crm.apresentacao_conteudo;
create policy tenant_definer on crm.apresentacao_conteudo for all to app_tenant_definer using (true) with check (true);
drop policy if exists tenant_master_leitura_ins on crm.apresentacao_conteudo;
drop policy if exists tenant_master_leitura_upd on crm.apresentacao_conteudo;
drop policy if exists tenant_master_leitura_del on crm.apresentacao_conteudo;
create policy tenant_master_leitura_ins on crm.apresentacao_conteudo as restrictive for insert to public
  with check (not (select public.app_master_somente_leitura()));
create policy tenant_master_leitura_upd on crm.apresentacao_conteudo as restrictive for update to public
  using (not (select public.app_master_somente_leitura()));
create policy tenant_master_leitura_del on crm.apresentacao_conteudo as restrictive for delete to public
  using (not (select public.app_master_somente_leitura()));

-- Papéis: qualquer usuário do CRM lê; admin e marketing editam (o master em acesso total também).
drop policy if exists apresentacao_conteudo_sel on crm.apresentacao_conteudo;
create policy apresentacao_conteudo_sel on crm.apresentacao_conteudo for select to authenticated
  using (public.me_get_empresa_role('crm', auth.uid()) is not null or public.app_is_master());
drop policy if exists apresentacao_conteudo_edit on crm.apresentacao_conteudo;
create policy apresentacao_conteudo_edit on crm.apresentacao_conteudo for all to authenticated
  using (public.me_get_empresa_role('crm', auth.uid()) in ('admin', 'super_admin', 'marketing') or public.app_is_master())
  with check (public.me_get_empresa_role('crm', auth.uid()) in ('admin', 'super_admin', 'marketing') or public.app_is_master());

grant select, insert, update, delete on crm.apresentacao_conteudo to authenticated, service_role, app_tenant_definer;
revoke all on crm.apresentacao_conteudo from anon;

-- Link público (sem login): /apresentacao/:slug -----------------------------------------------------
create or replace function public.apresentacao_publica(p_slug text)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare e record; c record;
begin
  select id, nome, slug, logo_url, status, ativo, e_modelo into e
    from "CRM-multi-empresas>empresas<" where slug = lower(trim(p_slug));
  if not found or not e.ativo or e.status <> 'ativa' or e.e_modelo then return null; end if;
  select conteudo, pontua into c from crm.apresentacao_conteudo where empresa_id = e.id;
  return jsonb_build_object(
    'empresa_id', e.id, 'nome', e.nome, 'slug', e.slug, 'logo_url', e.logo_url,
    'conteudo', coalesce(c.conteudo, '{}'::jsonb), 'pontua', coalesce(c.pontua, '{}'::jsonb));
end $$;
revoke all on function public.apresentacao_publica(text) from public;
grant execute on function public.apresentacao_publica(text) to anon, authenticated;

-- Garbo: o texto original da v1 (gerado de apresentacao-conteudo.ts por
-- scripts/modelos-padrao/gerar-seed-apresentacao.mjs) --------------------------------------------
insert into crm.apresentacao_conteudo (empresa_id, conteudo, pontua)
values ('2c196e67-dd26-4e1c-839d-4d234f3a3dfd', $json${"marca":{"sobrescrito":"Garbo Movelaria","titulo":"Garbo","subtitulo":"Movelaria","slogan":"Precisão cirúrgica para arquitetos que levam o próprio nome a sério."},"imagens":{"hero":"/imagens/apresentacao-garbo/hero-painel-logo.jpg","origem":"/imagens/apresentacao-garbo/projetos/painel-madeira-continuidade.png","proposta":"/imagens/apresentacao-garbo/proposta-banco.jpg","fechamento":"/imagens/apresentacao-garbo/fechamento-painel-logo.jpg"},"secoes":[{"id":"origem","eyebrow":"A ORIGEM","title":"Fábio Faria e o motivo da Garbo existir","paragraphs":["Fábio Faria cresceu dentro de uma oficina. Desde cedo, aprendeu que madeira não mente — ela revela tudo: o capricho de quem a trabalhou, a atenção ao detalhe, o respeito pelo projeto.","O que ele viu no mercado ao longo dos anos foi diferente. Marcenarias que prometem muito e entregam pouco. Profissionais que tratam o projeto do arquiteto como sugestão, não como lei. Clientes insatisfeitos. Reputações arranhadas.","Foi por recusa — recusa em fazer parte disso — que a Garbo nasceu."],"highlight":"Não como mais uma marcenaria. Como uma resposta."},{"id":"proposta","eyebrow":"A PROPOSTA","title":"O que a Garbo resolve","paragraphs":["A Garbo foi construída com um princípio único: o projeto do arquiteto é sagrado.","Cada medida, cada detalhe, cada escolha de ferragem — executados com precisão cirúrgica. Com materiais de primeira, com processos que eliminam surpresas, com comunicação que você consegue acompanhar do começo ao fim."],"highlight":"Aqui, você não precisa ser o intermediário entre o seu cliente e o executor. Você é o autor. Nós somos o instrumento."},{"id":"prova-social","eyebrow":"PROVA SOCIAL","title":"O que nossos parceiros dizem","paragraphs":["Arquitetos que trabalham conosco uma vez raramente buscam outro fornecedor. Não porque a gente prende ninguém — mas porque eles não querem mais correr o risco de trabalhar sem uma parceria assim."],"highlight":"A reputação do seu escritório é construída em cada entrega. A nossa também."}],"fechamento":{"eyebrow":"FECHAMENTO","title":"Uma parceria, não um orçamento","paragraphs":["A Garbo não escala no volume. Escala na qualidade.","Trabalhamos com um número limitado de projetos por vez — porque é a única forma de garantir que cada um receba a atenção que merece.","Se você chegou até aqui, já entendeu que o que oferecemos não é um orçamento. É uma parceria."],"closing":"A pergunta não é se você pode trabalhar com a Garbo. É se você pode continuar entregando seus projetos sem ela.","ctaLabel":"Iniciar parceria","ctaHint":"A Garbo irá entrar em contato com você."},"projetos":{"eyebrow":"PROJETOS & OBRAS","title":"A Garbo em cada detalhe","subtitle":"Ambientes executados com precisão — madeira, luz e acabamento no formato da obra real.","hint":"Deslize o carrossel","items":[{"id":"suite-painel-ripado","type":"image","src":"/imagens/apresentacao-garbo/projetos/suite-painel-ripado.png","title":"Suíte com painel e espelho","caption":"TV embutida, espelho orgânico retroiluminado e console flutuante em madeira."},{"id":"cozinha-cristaleira","type":"image","src":"/imagens/apresentacao-garbo/projetos/cozinha-cristaleira.png","title":"Cristaleira iluminada","caption":"Vitrine floor-to-ceiling com LED integrado e organização impecável."},{"id":"sala-cozinha-integrada","type":"image","src":"/imagens/apresentacao-garbo/projetos/sala-cozinha-integrada.png","title":"Sala e cozinha integradas","caption":"Ambiente aberto com sofá, marcenaria sob medida e ilha iluminada."},{"id":"suite-nichos-led","type":"image","src":"/imagens/apresentacao-garbo/projetos/cubo-suite-trofeus.png","title":"Suíte com nichos iluminados","caption":"Ripado, LED em V e prateleiras que valorizam cada detalhe."},{"id":"painel-madeira-continuidade","type":"image","src":"/imagens/apresentacao-garbo/projetos/painel-madeira-continuidade.png","title":"Painel em continuidade","caption":"Madeira do piso à parede — volume único, luz quente e acabamento preciso."}]},"cubo":[{"id":"cubo-cristaleira","src":"/imagens/apresentacao-garbo/projetos/cubo-cristaleira.png","title":"Cristaleira iluminada","caption":"Vitrine floor-to-ceiling com LED e organização impecável."},{"id":"cubo-sala-integrada","src":"/imagens/apresentacao-garbo/projetos/cubo-sala-integrada.png","title":"Sala e cozinha integradas","caption":"Ambiente aberto com marcenaria sob medida e iluminação quente."},{"id":"cubo-painel-madeira","src":"/imagens/apresentacao-garbo/projetos/cubo-painel-madeira.png","title":"Painel em continuidade","caption":"Madeira do piso à parede — volume único e acabamento preciso."},{"id":"cubo-suite-trofeus","src":"/imagens/apresentacao-garbo/projetos/cubo-suite-trofeus.png","title":"Suíte com nichos iluminados","caption":"Ripado, LED em V e prateleiras que valorizam cada detalhe."},{"id":"cubo-suite-tv","src":"/imagens/apresentacao-garbo/projetos/cubo-suite-tv.png","title":"Suíte com painel e espelho","caption":"TV embutida, espelho orgânico retroiluminado e console flutuante."}],"instagram":{"eyebrow":"INSTAGRAM","title":"Entre no feed da oficina","subtitle":"Obras, detalhes e o dia a dia da Garbo — o feed oficial, completo e ao vivo.","handle":"@garbomovelaria","profileUrl":"https://www.instagram.com/garbomovelaria/","embedUrl":"https://www.instagram.com/garbomovelaria/embed/","profileCta":"Abrir Instagram","phoneDisplay":"(35) 99140-1611","phoneTel":"+5535991401611","phoneWhatsApp":"https://wa.me/5535991401611","phoneLabel":"Falar agora"},"contato":{"aviso":"A Garbo irá entrar em contato com você.","formTexto":"Cadastre-se para iniciar a parceria. A Garbo irá entrar em contato com você —","formSucesso":"Recebemos seus dados. A Garbo irá entrar em contato com você em breve.","formRodape":"Cadastro de prestador · vinculado à Garbo Movelaria","rodapeInstagram":"Garbo Movelaria"}}$json$::jsonb, $json${"eyebrow":"PROGRAMA DE PONTUAÇÃO","title":"Programa de Pontuação Garbo para Parceiros","subtitle":"Veja, na prática, como o arquiteto acompanha comissões, saldos e saques — com números de exemplo para facilitar o entendimento.","badge":"Demonstração com dados fictícios","parceiro":{"nome":"Ana Paula Mendes","escritorio":"Mendes Arquitetura","cidade":"Pouso Alegre · MG","percentual":10},"metricas":{"aGanar":8450,"paraSacar":12380,"retirado":24500,"aguardandoLiberacao":2100,"totalComissaoGanha":36880,"ganhoMesAtual":4200,"mediaMensalGanhos":6146.67},"ganhosPorMes":[{"key":"2025-10","label":"Out/25","valor":3800},{"key":"2025-11","label":"Nov/25","valor":5200},{"key":"2025-12","label":"Dez/25","valor":6100},{"key":"2026-01","label":"Jan/26","valor":4900},{"key":"2026-02","label":"Fev/26","valor":8680},{"key":"2026-03","label":"Mar/26","valor":4200}],"passos":[{"step":"01","title":"Indique e acompanhe","text":"Cada projeto indicado pelo parceiro entra no CRM da Garbo. A comissão fica vinculada à venda."},{"step":"02","title":"Venda realizada","text":"Quando a obra é fechada, a comissão (ex.: 10%) é calculada automaticamente sobre o valor da venda."},{"step":"03","title":"Saldo e saque","text":"O arquiteto vê o que está a ganhar, o que já pode sacar e solicita o PIX direto pelo painel."}],"comissoes":[{"id":"c1","projeto":"Residência Serra Verde","cliente":"Família Oliveira","valorVenda":86000,"comissao":8600,"status":"pago","data":"12/02/2026"},{"id":"c2","projeto":"Apartamento Centro","cliente":"Carla Nogueira","valorVenda":42000,"comissao":4200,"status":"liberado","data":"03/03/2026"},{"id":"c3","projeto":"Closet + suíte master","cliente":"Roberto Lima","valorVenda":28500,"comissao":2850,"status":"em_andamento","data":"Em andamento"},{"id":"c4","projeto":"Cozinha integrada","cliente":"Studio Horizonte","valorVenda":21000,"comissao":2100,"status":"aguardando","data":"Aguardando liberação"}],"saques":[{"id":"s1","valor":8500,"status":"aprovado","data":"28/01/2026"},{"id":"s2","valor":6200,"status":"aprovado","data":"18/02/2026"},{"id":"s3","valor":4800,"status":"pendente","data":"08/03/2026"}]}$json$::jsonb)
on conflict (empresa_id) do nothing;
