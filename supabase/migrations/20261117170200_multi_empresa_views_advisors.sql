-- M31 (advisors de segurança) — views SECURITY DEFINER ignoram a RLS; sem filtro elas mostrariam dados de
-- todas as empresas. Mantêm o comportamento (mascaram chaves / expõem dados resumidos), mas passam a filtrar
-- pela empresa de quem consulta. Também: RLS nas duas tabelas apontadas e materialized views legadas fora da API.
do $$
declare
  r record;
  v_def text;
begin
  for r in
    select * from (values
      ('crm',    'pipeline_lead_ai_config_public',                       'empresa_id'),
      ('public', 'CRM-multi-empresas>pipeline_lead_ai_config_public<',   'empresa_id'),
      ('public', 'movelaria_funcionario_ponto_resumo',                   'f.empresa_id'),
      ('public', 'orcamentos_ia_ai_secrets_public',                      'company_id'),
      ('public', 'whatsapp_instancias_publico',                          'empresa_id'),
      ('public', 'whatsapp_v2_flags_publico',                            'empresa_id')
    ) as t(s, v, col)
  loop
    v_def := rtrim(btrim(pg_get_viewdef(format('%I.%I', r.s, r.v)::regclass, true)), ';');
    if v_def like '%app_empresa_atual%' then
      continue; -- já filtrada
    end if;
    -- O WHERE final (se houver) está no nível de topo nestas views; senão, acrescenta um.
    if v_def ~* '\mwhere\M[^()]*$' or r.v in ('movelaria_funcionario_ponto_resumo', 'whatsapp_v2_flags_publico') then
      v_def := v_def || format(' AND %s = (SELECT public.app_empresa_atual())', r.col);
    else
      v_def := v_def || format(' WHERE %s = (SELECT public.app_empresa_atual())', r.col);
    end if;
    execute format('create or replace view %I.%I as %s', r.s, r.v, v_def);
  end loop;
end $$;

alter table public.movelaria_schema_migrations enable row level security;
alter table public."Negativacao-proforco-numeros" enable row level security;

-- Materialized views do CRM legado (sem RLS possível): fora do alcance de anon/authenticated.
revoke all on public."CRM-Selletos>lead_conversion_stats<" from anon, authenticated;
revoke all on public."CRM-Selletos>lead_evolution_stats<" from anon, authenticated;
revoke all on public."CRM-Selletos>lead_origin_stats<" from anon, authenticated;
revoke all on public."CRM-Selletos>vendor_performance_stats<" from anon, authenticated;
