-- M12 — Página pública do orçamento (/orcamento/:schema/:id) por RPC.
-- Antes a página lia ~10 tabelas do CRM direto como anon; com o isolamento por empresa isso fica
-- bloqueado. A RPC devolve tudo filtrado pela empresa do próprio orçamento.
create or replace function public.orcamento_publico_obter(p_id uuid)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_orc crm.orcamento_slides%rowtype;
  v_emp uuid;
  v_tpl crm.orcamento_slide_templates%rowtype;
  v_valor numeric := 0;
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
    'valor_orcamento_lead', v_valor
  );
end $$;
grant execute on function public.orcamento_publico_obter(uuid) to anon, authenticated;
