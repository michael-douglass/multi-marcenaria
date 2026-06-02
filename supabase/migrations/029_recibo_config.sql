-- Migration 029: Recibo Configuration
create table if not exists public.movelaria_recibo_config (
  id uuid primary key default gen_random_uuid(),
  cnpj text not null default '',
  template_texto text not null default 'RECIBO DE PAGAMENTO\n\nRecebemos de {{nome_cliente}} a importância de {{valor_fatura}} referente a {{descricao_cobranca}}.\n\nData: {{data_hoje}}\n\nEmitente: {{nome_empresa}}\nCNPJ: {{cnpj}}',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Habilitar RLS
alter table public.movelaria_recibo_config enable row level security;

-- Políticas de acesso
create policy "Qualquer usuário autenticado pode ver a configuração do recibo"
  on public.movelaria_recibo_config for select
  to authenticated
  using (true);

create policy "Apenas administradores podem inserir configuração de recibo"
  on public.movelaria_recibo_config for insert
  to authenticated
  with check (
    exists (
      select 1 from public.movelaria_usuarios
      where id = auth.uid() and perfil = 'administrador'
    )
  );

create policy "Apenas administradores podem atualizar configuração de recibo"
  on public.movelaria_recibo_config for update
  to authenticated
  using (
    exists (
      select 1 from public.movelaria_usuarios
      where id = auth.uid() and perfil = 'administrador'
    )
  )
  with check (
    exists (
      select 1 from public.movelaria_usuarios
      where id = auth.uid() and perfil = 'administrador'
    )
  );
