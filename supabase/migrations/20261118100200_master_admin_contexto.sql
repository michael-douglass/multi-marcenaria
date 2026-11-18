-- M43 (ajuste) — master_definir_admin_empresa entra na empresa só durante a transação, em modo
-- ESCRITA e sem registrar acesso de inspeção (antes chamava master_definir_empresa_ativa, que agora
-- usa somente leitura por padrão e grava em plataforma_master_acessos). Restaura o contexto anterior.

create or replace function public.master_definir_admin_empresa(
  p_empresa_id uuid, p_admin_email text, p_admin_nome text, p_admin_senha text default null)
returns uuid language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare
  v_uid uuid;
  v_email text := lower(trim(p_admin_email));
  v_nome text := coalesce(nullif(trim(p_admin_nome), ''), split_part(lower(trim(p_admin_email)), '@', 1));
  v_ctx_antigo uuid;
  v_leitura_antiga boolean;
  v_emp_atual uuid;
begin
  perform public.app_assert_master();
  if v_email is null or v_email = '' then raise exception 'E-mail do administrador é obrigatório'; end if;
  if not exists (select 1 from "CRM-multi-empresas>empresas<" where id = p_empresa_id) then
    raise exception 'Empresa não encontrada';
  end if;

  select id into v_uid from auth.users where lower(email) = v_email;
  if v_uid is not null then
    v_emp_atual := public.app_empresa_do_usuario(v_uid);
    if public.me_is_super_admin(v_uid) then
      raise exception 'O usuário master não pode ser administrador de uma empresa';
    end if;
    if v_emp_atual is not null and v_emp_atual <> p_empresa_id then
      raise exception 'Este e-mail já pertence a outra empresa';
    end if;
    if p_admin_senha is not null and p_admin_senha <> '' then
      update auth.users set encrypted_password = extensions.crypt(p_admin_senha, extensions.gen_salt('bf', 10)), updated_at = now()
       where id = v_uid;
    end if;
  else
    if p_admin_senha is null or p_admin_senha = '' then
      raise exception 'Informe uma senha para o novo administrador';
    end if;
    v_uid := public.app__criar_auth_user(v_email, p_admin_senha);
  end if;

  -- O master passa a "estar" na empresa durante a transação: triggers em cascata (ex.: ficha de
  -- funcionário criada ao inserir o usuário) herdam a empresa certa.
  select empresa_id, somente_leitura into v_ctx_antigo, v_leitura_antiga
    from plataforma_master_contexto where user_id = auth.uid();
  insert into plataforma_master_contexto (user_id, empresa_id, somente_leitura)
  values (auth.uid(), p_empresa_id, false)
  on conflict (user_id) do update set empresa_id = excluded.empresa_id, somente_leitura = false, atualizado_em = now();

  insert into "CRM-multi-empresas>usuario_empresa<" (user_id, empresa_id) values (v_uid, p_empresa_id)
  on conflict (user_id) do nothing;

  insert into movelaria_usuarios (id, email, nome, perfil, ativo, empresa_id)
  values (v_uid, v_email, v_nome, 'administrador', true, p_empresa_id)
  on conflict (id) do update set perfil = 'administrador', ativo = true, nome = coalesce(excluded.nome, movelaria_usuarios.nome), atualizado_em = now();

  insert into crm.usuarios (id, nome, email, tipo_usuario, status_convite, empresa_id)
  values (v_uid, v_nome, v_email, 'colaborador', 'ATIVO', p_empresa_id)
  on conflict (id) do update set status_convite = 'ATIVO', atualizado_em = now();

  insert into crm.user_roles (user_id, role, empresa_id) values (v_uid, 'admin', p_empresa_id)
  on conflict do nothing;

  if v_ctx_antigo is not null then
    update plataforma_master_contexto
       set empresa_id = v_ctx_antigo, somente_leitura = v_leitura_antiga, atualizado_em = now()
     where user_id = auth.uid();
  else
    delete from plataforma_master_contexto where user_id = auth.uid();
  end if;
  return v_uid;
end $$;
revoke all on function public.master_definir_admin_empresa(uuid, text, text, text) from public, anon;
grant execute on function public.master_definir_admin_empresa(uuid, text, text, text) to authenticated;
