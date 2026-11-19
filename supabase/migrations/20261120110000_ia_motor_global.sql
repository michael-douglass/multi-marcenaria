-- IA no card lead (docs/ia-lead, T08 — ADR 0007): motor global da plataforma (modelos, prompts e chave
-- da OpenAI), configurado só pelo master em /master/modelos. A empresa não vê nem edita nada disso.
-- Tabelas plataforma_*: sem aaa_tenant_fill/tenant_isolamento (não são dados de empresa).

create table if not exists public.plataforma_ia_motor (
  id boolean primary key default true check (id),
  ativo boolean not null default true,
  render_ativo boolean not null default true,
  render_ambiente_ativo boolean not null default true,
  vision_model text not null default 'gpt-4o',
  image_model text not null default 'gpt-image-1.5',
  render_analysis_prompt text,
  render_prompt text,
  render_ambiente_analysis_prompt text,
  render_ambiente_prompt text,
  -- dall-e-2 não informa tokens: cada imagem conta este valor.
  tokens_por_imagem_fixa integer not null default 5000 check (tokens_por_imagem_fixa >= 0),
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
insert into public.plataforma_ia_motor default values on conflict do nothing;

alter table public.plataforma_ia_motor enable row level security;
drop policy if exists plataforma_master on public.plataforma_ia_motor;
create policy plataforma_master on public.plataforma_ia_motor
  for all to authenticated using (public.app_is_master()) with check (public.app_is_master());
revoke all on public.plataforma_ia_motor from anon;

-- Segredo: RLS ligada e NENHUMA policy; nenhum role de usuário tem grant. Só o service role (edge
-- functions) lê; só as RPCs abaixo (security definer) gravam. O master vê apenas o final da chave.
create table if not exists public.plataforma_ia_segredos (
  nome text primary key check (nome in ('openai_card_lead')),
  valor text not null,
  final4 text not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por uuid
);
alter table public.plataforma_ia_segredos enable row level security;
revoke all on public.plataforma_ia_segredos from public, anon, authenticated;

-- Estado do motor para o master (nunca devolve a chave).
create or replace function public.master_ia_motor_obter()
returns jsonb language plpgsql stable security definer set search_path = public, pg_temp as $$
declare m jsonb; s record;
begin
  perform public.app_assert_master();
  select to_jsonb(x) into m from public.plataforma_ia_motor x limit 1;
  select final4, atualizado_em into s from public.plataforma_ia_segredos where nome = 'openai_card_lead';
  return coalesce(m, '{}'::jsonb) || jsonb_build_object(
    'chave_configurada', s.final4 is not null,
    'chave_final4', s.final4,
    'chave_atualizada_em', s.atualizado_em);
end $$;
revoke all on function public.master_ia_motor_obter() from public, anon;
grant execute on function public.master_ia_motor_obter() to authenticated;

-- Salva modelos, prompts e flags. Modelos validados contra a lista do código
-- (par: supabase/functions/_shared/ia-card-lead-modelos.ts e src/lib/ia-card-lead-modelos.ts).
create or replace function public.master_ia_motor_salvar(p jsonb)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v_vis text; v_img text;
begin
  perform public.app_assert_master();
  v_vis := coalesce(p->>'vision_model', 'gpt-4o');
  v_img := coalesce(p->>'image_model', 'gpt-image-1.5');
  if v_vis not in ('gpt-4o-mini', 'gpt-4o', 'gpt-4.1') then
    raise exception 'Modelo de visão inválido: %', v_vis;
  end if;
  if v_img not in ('gpt-image-1.5', 'gpt-image-1', 'dall-e-2') then
    raise exception 'Modelo de imagem inválido: %', v_img;
  end if;
  update public.plataforma_ia_motor set
    ativo = coalesce((p->>'ativo')::boolean, ativo),
    render_ativo = coalesce((p->>'render_ativo')::boolean, render_ativo),
    render_ambiente_ativo = coalesce((p->>'render_ambiente_ativo')::boolean, render_ambiente_ativo),
    vision_model = v_vis,
    image_model = v_img,
    render_analysis_prompt = nullif(btrim(p->>'render_analysis_prompt'), ''),
    render_prompt = nullif(btrim(p->>'render_prompt'), ''),
    render_ambiente_analysis_prompt = nullif(btrim(p->>'render_ambiente_analysis_prompt'), ''),
    render_ambiente_prompt = nullif(btrim(p->>'render_ambiente_prompt'), ''),
    tokens_por_imagem_fixa = coalesce((p->>'tokens_por_imagem_fixa')::integer, tokens_por_imagem_fixa),
    atualizado_em = now(),
    atualizado_por = auth.uid()
  where id;
end $$;
revoke all on function public.master_ia_motor_salvar(jsonb) from public, anon;
grant execute on function public.master_ia_motor_salvar(jsonb) to authenticated;

create or replace function public.master_ia_motor_salvar_chave(p_chave text)
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
declare v text := btrim(coalesce(p_chave, ''));
begin
  perform public.app_assert_master();
  if length(v) < 20 then raise exception 'Chave inválida'; end if;
  insert into public.plataforma_ia_segredos (nome, valor, final4, atualizado_em, atualizado_por)
  values ('openai_card_lead', v, right(v, 4), now(), auth.uid())
  on conflict (nome) do update
    set valor = excluded.valor, final4 = excluded.final4, atualizado_em = now(), atualizado_por = auth.uid();
end $$;
revoke all on function public.master_ia_motor_salvar_chave(text) from public, anon;
grant execute on function public.master_ia_motor_salvar_chave(text) to authenticated;

create or replace function public.master_ia_motor_limpar_chave()
returns void language plpgsql volatile security definer set search_path = public, pg_temp as $$
begin
  perform public.app_assert_master();
  delete from public.plataforma_ia_segredos where nome = 'openai_card_lead';
end $$;
revoke all on function public.master_ia_motor_limpar_chave() from public, anon;
grant execute on function public.master_ia_motor_limpar_chave() to authenticated;
