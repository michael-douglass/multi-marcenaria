-- Modelos padrão (T07) — cópia de UM modelo de contrato (com os campos que ele cita). Só acrescenta.
-- Ver docs/modelos-padrao/DESIGN.md §3.2. Par no front: nomesUsadosNoModelo (src/lib/contrato-variaveis.ts).

create or replace function public.plataforma_copiar_contrato(p_modelo uuid, p_destino uuid)
returns jsonb language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  m crm.contratos_modelos%rowtype;
  v_nome text;
  v_v int := 1;
  v_vars int := 0;
  v_id uuid;
  v_ativo boolean;
begin
  select * into m from crm.contratos_modelos where id = p_modelo;
  if not found then raise exception 'Modelo de contrato não encontrado'; end if;
  perform public.plataforma__validar_copia(m.empresa_id, p_destino);
  perform public.app_set_empresa_ctx(p_destino);

  -- Campos citados ({{x}} e {{#se x}}) + o cpf do sistema; os que o destino já tem ficam como estão.
  insert into crm.contratos_variaveis (empresa_id, nome, label, tipo, valor_padrao, obrigatorio, ordem, mostrar_no_link_publico)
  select p_destino, v.nome, v.label, v.tipo, v.valor_padrao, v.obrigatorio, v.ordem, v.mostrar_no_link_publico
    from crm.contratos_variaveis v
   where v.empresa_id = m.empresa_id
     and (v.nome = 'cpf'
          or v.nome in (select (regexp_matches(coalesce(m.conteudo, ''), '\{\{(?:#se )?(\w+)\}\}', 'g'))[1]))
  on conflict (empresa_id, nome) do nothing;
  get diagnostics v_vars = row_count;

  -- Nome livre no destino: "X", senão "X (v2)", "X (v3)"...
  v_nome := m.nome;
  while exists (select 1 from crm.contratos_modelos where empresa_id = p_destino and nome = v_nome) loop
    v_v := v_v + 1;
    v_nome := m.nome || ' (v' || v_v || ')';
  end loop;

  -- Nunca dois ativos: só ativa se o destino não tiver nenhum modelo ativo.
  v_ativo := not exists (select 1 from crm.contratos_modelos where empresa_id = p_destino and ativo);

  insert into crm.contratos_modelos (empresa_id, nome, conteudo, ativo, updated_at)
  values (p_destino, v_nome, m.conteudo, v_ativo, now())
  returning id into v_id;

  return jsonb_build_object('modelo_id', v_id, 'nome', v_nome, 'ativo', v_ativo, 'campos', v_vars);
end $$;
revoke all on function public.plataforma_copiar_contrato(uuid, uuid) from public, anon, authenticated;
