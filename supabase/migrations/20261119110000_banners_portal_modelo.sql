-- Banners do portal do parceiro (desktop/mobile) definidos só nas empresas-modelo e entregues às
-- empresas junto com o pacote Pontua (docs/marca-neutra, ajustes de 2026-11-19).
-- Antes: o formulário gravava com UPDATE direto em empresas (recusado pela policy) e o front nunca lia.

-- Leitura: modelo? + banners da empresa ativa (inclui prestadores, que veem o portal).
create or replace function public.app_empresa_portal()
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
           'e_modelo', e.e_modelo,
           'banner_slides_desktop', coalesce(e.banner_slides_desktop, '[]'::jsonb),
           'banner_slides_mobile', coalesce(e.banner_slides_mobile, '[]'::jsonb))
    from "CRM-multi-empresas>empresas<" e
   where e.id = public.app_empresa_atual();
$$;
revoke all on function public.app_empresa_portal() from public, anon;
grant execute on function public.app_empresa_portal() to authenticated;

-- Escrita: só empresa-modelo, pelo admin dela ou pelo master em acesso total.
create or replace function public.empresa_atualizar_banners(p_desktop jsonb, p_mobile jsonb)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_emp uuid := public.app_empresa_atual(); v jsonb;
begin
  perform public.app_assert_escrita_permitida();
  if auth.uid() is null or v_emp is null then
    raise exception 'Sem empresa ativa' using errcode = '42501';
  end if;
  if not exists (select 1 from "CRM-multi-empresas>empresas<" where id = v_emp and e_modelo) then
    raise exception 'Os banners do portal são definidos nos modelos padrão' using errcode = '42501';
  end if;
  if not (
    exists (select 1 from crm.user_roles r where r.user_id = auth.uid() and r.empresa_id = v_emp and r.role = 'admin')
    or (public.app_is_master()
        and exists (select 1 from plataforma_master_contexto c
                     where c.user_id = auth.uid() and c.empresa_id = v_emp and not c.somente_leitura))
  ) then
    raise exception 'Apenas o administrador pode alterar os banners' using errcode = '42501';
  end if;
  foreach v in array array[coalesce(p_desktop, '[]'::jsonb), coalesce(p_mobile, '[]'::jsonb)] loop
    if jsonb_typeof(v) <> 'array' or jsonb_array_length(v) > 8
       or exists (select 1 from jsonb_array_elements(v) x where jsonb_typeof(x) <> 'string') then
      raise exception 'Lista de banners inválida (até 8 imagens por dispositivo)' using errcode = '22023';
    end if;
  end loop;
  update "CRM-multi-empresas>empresas<"
     set banner_slides_desktop = coalesce(p_desktop, '[]'::jsonb),
         banner_slides_mobile = coalesce(p_mobile, '[]'::jsonb),
         atualizado_em = now()
   where id = v_emp;
end $$;
revoke all on function public.empresa_atualizar_banners(jsonb, jsonb) from public, anon;
grant execute on function public.empresa_atualizar_banners(jsonb, jsonb) to authenticated;

-- Pacote Pontua: além do texto e do percentual, leva os banners do portal (só se o destino não tiver).
create or replace function public.plataforma_copiar_pontua(p_origem uuid, p_destino uuid)
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_pontua jsonb; v_n int := 0; v_pct numeric; v_campo uuid; v_pct_ok boolean := false; v_ban int := 0;
begin
  perform public.plataforma__validar_copia(p_origem, p_destino);
  perform public.app_set_empresa_ctx(p_destino);

  select pontua into v_pontua from crm.apresentacao_conteudo where empresa_id = p_origem;
  if coalesce(v_pontua, '{}'::jsonb) <> '{}'::jsonb then
    insert into crm.apresentacao_conteudo (empresa_id, pontua) values (p_destino, v_pontua)
    on conflict (empresa_id) do update set pontua = excluded.pontua, atualizado_em = now()
     where crm.apresentacao_conteudo.pontua = '{}'::jsonb;
    get diagnostics v_n = row_count;
  end if;

  select coalesce((config_pontua->>'percentual_padrao')::numeric, (config_pontua->>'percentual')::numeric)
    into v_pct
    from crm.lead_custom_field_definitions
   where empresa_id = p_origem and tipo = 'usuario_sistema' and config_pontua is not null
   order by ativo desc limit 1;
  if v_pct is not null then
    select id into v_campo from crm.lead_custom_field_definitions
     where empresa_id = p_destino and tipo = 'usuario_sistema' and config_pontua is not null
     order by ativo desc limit 1;
    if v_campo is null then
      insert into crm.lead_custom_field_definitions (empresa_id, nome, tipo, opcoes, ordem, ativo, config_pontua)
      values (p_destino, 'Pontua', 'usuario_sistema', null,
              coalesce((select max(ordem) + 1 from crm.lead_custom_field_definitions where empresa_id = p_destino), 0),
              true, jsonb_build_object('ativo', true, 'percentual_padrao', v_pct));
      v_pct_ok := true;
    end if;
  end if;

  -- Banners do portal do parceiro: arquivos ficam no storage do modelo (URLs públicas compartilhadas).
  update "CRM-multi-empresas>empresas<" d
     set banner_slides_desktop = case when coalesce(jsonb_array_length(d.banner_slides_desktop), 0) = 0
                                      then o.banner_slides_desktop else d.banner_slides_desktop end,
         banner_slides_mobile = case when coalesce(jsonb_array_length(d.banner_slides_mobile), 0) = 0
                                     then o.banner_slides_mobile else d.banner_slides_mobile end,
         atualizado_em = now()
    from "CRM-multi-empresas>empresas<" o
   where o.id = p_origem and d.id = p_destino
     and ((coalesce(jsonb_array_length(d.banner_slides_desktop), 0) = 0 and coalesce(jsonb_array_length(o.banner_slides_desktop), 0) > 0)
       or (coalesce(jsonb_array_length(d.banner_slides_mobile), 0) = 0 and coalesce(jsonb_array_length(o.banner_slides_mobile), 0) > 0));
  get diagnostics v_ban = row_count;

  return jsonb_build_object('copiado', v_n > 0, 'percentual_padrao', case when v_pct_ok then v_pct end,
                            'banners', v_ban > 0);
end $$;
revoke all on function public.plataforma_copiar_pontua(uuid, uuid) from public, anon, authenticated;
