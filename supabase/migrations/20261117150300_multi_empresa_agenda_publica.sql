-- M12 — Agendamento público (/agendar/:slug e /agendar/:empresaSlug/:slug) por RPC.
-- O slug da agenda é global; a RPC devolve só dados da empresa dona dele. Reuniões vêm SEM dados do
-- convidado (apenas horários), para calcular disponibilidade.
create or replace function public.agenda_publica_dados(p_agenda_slug text, p_empresa_slug text default null)
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_cfg crm.agenda_config%rowtype;
  v_emp record;
begin
  select c.* into v_cfg from crm.agenda_config c
   where c.slug = p_agenda_slug and c.ativo = true
     and (p_empresa_slug is null or exists (
       select 1 from "CRM-multi-empresas>empresas<" e where e.id = c.empresa_id and e.slug = p_empresa_slug));
  if v_cfg.id is null or not public.app_empresa_esta_ativa(v_cfg.empresa_id) then
    return null;
  end if;
  select e.slug, e.nome, e.logo_url into v_emp from "CRM-multi-empresas>empresas<" e where e.id = v_cfg.empresa_id;

  return jsonb_build_object(
    'config', to_jsonb(v_cfg),
    'empresa', jsonb_build_object('slug', v_emp.slug, 'nome', v_emp.nome, 'logo_url', v_emp.logo_url),
    'form_fields', coalesce((select jsonb_agg(to_jsonb(f) order by f.ordem)
                               from crm.agenda_form_fields f
                              where f.empresa_id = v_cfg.empresa_id and f.config_id = v_cfg.id), '[]'::jsonb),
    'reunioes', coalesce((select jsonb_agg(jsonb_build_object(
                              'data_hora_inicio', r.data_hora_inicio,
                              'data_hora_fim', r.data_hora_fim,
                              'status', r.status))
                            from crm.agenda_reunioes r
                           where r.empresa_id = v_cfg.empresa_id
                             and r.data_hora_inicio >= now()
                             and r.status in ('pendente', 'confirmado')), '[]'::jsonb),
    'bloqueios', coalesce((select jsonb_agg(jsonb_build_object(
                               'data_inicio', b.data_inicio,
                               'data_fim', b.data_fim,
                               'recorrente', b.recorrente,
                               'tipo_recorrencia', b.tipo_recorrencia))
                             from crm.agenda_bloqueios b
                            where b.empresa_id = v_cfg.empresa_id and b.data_fim >= now()), '[]'::jsonb)
  );
end $$;
grant execute on function public.agenda_publica_dados(text, text) to anon, authenticated;
