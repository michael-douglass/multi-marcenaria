-- Identidade da marcenaria: dados cadastrais, CNPJ só com dígitos e RPCs com dados da empresa.
-- Ver docs/identidade-empresa/DESIGN.md §2.
--
-- * Colunas de endereço/contato na tabela de empresas (o nome fantasia continua sendo `nome`).
-- * CNPJ gravado só com os 14 dígitos (a máscara é aplicada na exibição); trigger normaliza
--   qualquer escritor (telas, console master, plataforma_criar_empresa/atualizar_empresa).
-- * app_minha_empresa() e orcamento_publico_obter() devolvem os dados da empresa.
-- * A tabela de empresas é da plataforma (sem tenant_isolamento), então o laço de
--   master_inspecao.sql §6 não criou tenant_master_leitura_* nela: o master em inspeção
--   somente leitura conseguia alterar a empresa inspecionada. A policy do §5 fecha isso.

-- 1. Colunas de endereço e contato ---------------------------------------------------------------
alter table public."CRM-multi-empresas>empresas<"
  add column if not exists cep text,
  add column if not exists logradouro text,
  add column if not exists numero text,
  add column if not exists complemento text,
  add column if not exists bairro text,
  add column if not exists cidade text,
  add column if not exists uf text,
  add column if not exists telefone text,
  add column if not exists email text;

-- 2. CNPJ só com dígitos -------------------------------------------------------------------------
update public."CRM-multi-empresas>empresas<"
   set cnpj = nullif(regexp_replace(cnpj, '\D', '', 'g'), '')
 where cnpj is not null
   and cnpj is distinct from nullif(regexp_replace(cnpj, '\D', '', 'g'), '');

create or replace function public.empresas_cnpj_normaliza()
returns trigger language plpgsql set search_path = public, pg_temp as $$
begin
  if new.cnpj is not null then
    new.cnpj := nullif(regexp_replace(new.cnpj, '\D', '', 'g'), '');
  end if;
  return new;
end $$;

drop trigger if exists empresas_cnpj_normaliza on public."CRM-multi-empresas>empresas<";
create trigger empresas_cnpj_normaliza
  before insert or update of cnpj on public."CRM-multi-empresas>empresas<"
  for each row execute function public.empresas_cnpj_normaliza();

-- 3. app_minha_empresa: + dados cadastrais (as 13 colunas atuais na mesma ordem; novas no fim) ----
drop function if exists public.app_minha_empresa();
create function public.app_minha_empresa()
returns table (id uuid, nome text, slug text, status text, ativo boolean, logo_url text,
               cor_primaria text, cnpj text, razao_social text, is_master boolean,
               paginas_bloqueadas text[], em_inspecao boolean, inspecao_somente_leitura boolean,
               cep text, logradouro text, numero text, complemento text, bairro text,
               cidade text, uf text, telefone text, email text)
language sql stable security definer set search_path = public, pg_temp as $$
  select e.id, e.nome, e.slug, e.status, e.ativo, e.logo_url, e.cor_primaria, e.cnpj, e.razao_social,
         public.app_is_master(),
         public.app_paginas_bloqueadas(e.id),
         c.user_id is not null,
         coalesce(c.somente_leitura, false),
         e.cep, e.logradouro, e.numero, e.complemento, e.bairro, e.cidade, e.uf, e.telefone, e.email
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
grant execute on function public.app_minha_empresa() to authenticated;

-- 4. orcamento_publico_obter: + chave 'empresa' (assinatura igual => owner e grants preservados) --
create or replace function public.orcamento_publico_obter(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_orc crm.orcamento_slides%rowtype;
  v_emp uuid;
  v_tpl crm.orcamento_slide_templates%rowtype;
  v_valor numeric := 0;
  v_empresa jsonb;
begin
  select * into v_orc from crm.orcamento_slides where id = p_id;
  if v_orc.id is null then return null; end if;
  v_emp := v_orc.empresa_id;
  if not public.app_empresa_esta_ativa(v_emp) then return null; end if;
  if coalesce((v_orc.dados #>> '{_meta,link_publico_oculto}')::boolean, false) then return null; end if;

  select * into v_tpl from crm.orcamento_slide_templates
   where empresa_id = v_emp and ativo = true order by criado_em asc limit 1;

  if v_orc.lead_id is not null then
    select coalesce(l.valor_orcamento, 0) into v_valor from crm.leads l
     where l.id = v_orc.lead_id and l.empresa_id = v_emp;
  end if;

  select jsonb_build_object('nome', e.nome, 'razao_social', e.razao_social, 'cnpj', e.cnpj,
                            'logo_url', e.logo_url, 'telefone', e.telefone, 'email', e.email,
                            'cidade', e.cidade, 'uf', e.uf)
    into v_empresa
    from "CRM-multi-empresas>empresas<" e
   where e.id = v_emp;

  return jsonb_build_object(
    'orcamento', to_jsonb(v_orc),
    'template', case when v_tpl.id is null then null else to_jsonb(v_tpl) end,
    'blocos', coalesce((select jsonb_agg(to_jsonb(b) order by b.ordem)
                          from crm.orcamento_slide_blocos b
                         where b.empresa_id = v_emp and b.template_id = v_tpl.id), '[]'::jsonb),
    'midias', coalesce((select jsonb_agg(to_jsonb(m) order by m.ordem)
                          from crm.orcamento_slide_midias m
                         where m.empresa_id = v_emp and m.orcamento_id = p_id), '[]'::jsonb),
    'perguntas', coalesce((select jsonb_agg(to_jsonb(p) || jsonb_build_object('opcoes',
                              coalesce((select jsonb_agg(to_jsonb(o) order by o.ordem)
                                          from crm.orcamento_slide_pergunta_opcoes o
                                         where o.empresa_id = v_emp and o.pergunta_id = p.id), '[]'::jsonb))
                            order by p.ordem)
                             from crm.orcamento_slide_perguntas p
                            where p.empresa_id = v_emp and p.ativo = true), '[]'::jsonb),
    'catalogo', coalesce((select jsonb_agg(to_jsonb(c) order by c.ordem)
                            from crm.orcamento_slide_catalogo c
                           where c.empresa_id = v_emp and c.ativo = true and c.categoria in ('ferragem', 'mdf')), '[]'::jsonb),
    'formas_pagamento', coalesce((select jsonb_agg(to_jsonb(f) order by f.ordem)
                                    from crm.orcamento_slide_formas_pagamento f
                                   where f.empresa_id = v_emp and f.ativo = true), '[]'::jsonb),
    'valor_orcamento_lead', v_valor,
    'empresa', v_empresa
  );
end $$;
grant execute on function public.orcamento_publico_obter(uuid) to anon, authenticated;

-- 5. Master em inspeção somente leitura não altera a empresa inspecionada ------------------------
-- Restrita à linha em inspeção para não travar telas de plataforma em outras empresas.
drop policy if exists tenant_master_leitura_upd on public."CRM-multi-empresas>empresas<";
create policy tenant_master_leitura_upd on public."CRM-multi-empresas>empresas<"
  as restrictive for update to public
  using (not (select public.app_master_somente_leitura())
         or id is distinct from (select public.app_empresa_atual()));
