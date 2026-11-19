-- IA no card lead (docs/ia-lead, T03): a função `iaCardLead` nasce DESLIGADA nos planos existentes e em
-- plano novo. A lista de páginas é de bloqueio (id novo nasce liberado), por isso a migration.

update public.plataforma_planos
   set paginas_bloqueadas = (
     select array_agg(distinct x order by x) from unnest(paginas_bloqueadas || 'iaCardLead'::text) x
   )
 where not ('iaCardLead' = any(paginas_bloqueadas));

alter table public.plataforma_planos alter column paginas_bloqueadas set default '{iaCardLead}';
