-- Advisors (M50): as funções de cobrança aceitavam chamada sem usuário (pensado para o cron) e estavam
-- liberadas para anon via /rest/v1/rpc. O cron roda como postgres (dono); o master chama autenticado.
revoke execute on function public.plataforma_gerar_cobrancas(date) from public, anon;
revoke execute on function public.plataforma_atualizar_inadimplencia() from public, anon;
grant execute on function public.plataforma_gerar_cobrancas(date) to authenticated;
grant execute on function public.plataforma_atualizar_inadimplencia() to authenticated;
