-- Página Pontua (docs/marca-neutra, T02): o id de página "pontuaGarbo" passa a ser "pontua" e o
-- título do capítulo passa a vir do conteúdo (padrão "Programa de pontuação para parceiros").

update public.plataforma_planos
   set paginas_bloqueadas = array_replace(paginas_bloqueadas, 'pontuaGarbo', 'pontua')
 where 'pontuaGarbo' = any(paginas_bloqueadas);

-- Se a empresa já tiver ajuste para "pontua", o antigo é descartado; senão é renomeado.
delete from public.plataforma_empresa_paginas a
 where a.pagina_id = 'pontuaGarbo'
   and exists (select 1 from public.plataforma_empresa_paginas b where b.empresa_id = a.empresa_id and b.pagina_id = 'pontua');
update public.plataforma_empresa_paginas set pagina_id = 'pontua' where pagina_id = 'pontuaGarbo';

-- O título salvo nunca apareceu na tela (o h2 usava o nome do programa): volta ao padrão.
update crm.apresentacao_conteudo set pontua = pontua - 'title' where pontua ? 'title';
