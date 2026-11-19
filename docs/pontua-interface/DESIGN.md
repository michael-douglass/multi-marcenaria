# Pontua — interface predefinida pelo master (desenho)

- **Armazenamento:** `crm.apresentacao_conteudo.pontua->>'interface'`. Sem coluna nova: o front mescla o jsonb salvo sobre `PONTUA_NEUTRO` (padrão `sem_marca`).
- **Master:** `master_definir_pontua_interface(empresa_modelo, interface)` (valida o valor e exige empresa-modelo). `master_listar_modelos` devolve `contagem.interface` (o master não lê `apresentacao_conteudo` direto por causa da RLS).
- **Entrega:** `plataforma_copiar_pontua` copia o conteúdo para destino vazio; para destino que já tem conteúdo sem `interface`, acrescenta só a chave. A chave `interface` sozinha não conta como "conteúdo".
- **Front:** `ApresentacaoPontua` liga a logo do globo só em `classica`; `resolverPontua` remove o `{empresa}` dos textos em `sem_marca`.
- **Prévia (master):** `PontuaInterfacePreview` reusa `ApresentacaoEmpresa` com conteúdo de exemplo, em escala (1280×720). Carregada com `lazy()`.
