# Identidade da marcenaria — Tarefas

> Modo pair-to-peer: **uma tarefa por vez**, com diagnóstico aprovado antes de alterar e revisão humana ao concluir.
> Requisitos: [`REQUIREMENTS.md`](./REQUIREMENTS.md) · Design: [`DESIGN.md`](./DESIGN.md).
> Verificação base de toda tarefa: `pnpm build` sem erros. Não confundir com `docs/TASKS.md` (outro trabalho).

---

## T01 — Migration: dados cadastrais, CNPJ normalizado e RPCs

- [x] **T01** — concluída em 2026-11-18.
  - **Resumo:** migration criada e aplicada (dry-run com rollback antes; `pnpm migrate` aplicou só ela). 9 colunas criadas; CNPJ da GARBO `58.838.942.00/0123` → `58838942000123`; `app_minha_empresa` (owner postgres, definer, `search_path`, sem execute para anon) e `orcamento_publico_obter` (anon mantém execute) recriadas; policy RESTRICTIVE `tenant_master_leitura_upd` criada.
  - **Validações:** `test-isolamento.mjs` 27 ok / 0 falha. Teste SQL com rollback (`q.mjs --write`): master somente leitura → 0 linhas; acesso total → 1 linha; trigger grava `58.838.942/0001-23` como `58838942000123`. Não há `crm.orcamento_slides` no banco, então a chave `empresa` do RPC público não foi exercitada com dado real.
  - **Achado (bloqueia T04):** qualquer `UPDATE` de usuário `authenticated` na tabela de empresas falha com `infinite recursion detected in policy`. A causa é a policy `me_empresas_contratos_timbrado_update`, que faz join com a própria tabela. O erro já existia antes da T01: aparece também sem a policy nova. Além disso, `me_empresas_admin_update_branding` depende de `"CRM-multi-empresas>user_roles<"`, que está vazia (0 linhas). Resultado: hoje só o master consegue atualizar a empresa.
- **Objetivo:** colunas de endereço/contato na empresa, CNPJ só com dígitos, `app_minha_empresa()` e `orcamento_publico_obter()` com os dados da empresa, e bloqueio de escrita do master em somente leitura.
- **Arquivos:** `supabase/migrations/20261118120000_empresa_dados_cadastrais.sql` (novo).
- **Critérios de aceite:**
  - Colunas `cep, logradouro, numero, complemento, bairro, cidade, uf, telefone, email` (`text` nullable) existem.
  - Nenhum `cnpj` com caractere não numérico; trigger normaliza escritas novas.
  - `app_minha_empresa()` devolve as 13 colunas atuais na mesma ordem + as novas; `security definer`, `search_path = public, pg_temp`, execute só para `authenticated`.
  - `orcamento_publico_obter()` devolve a chave `empresa` com `{nome, razao_social, cnpj, logo_url, telefone, email, cidade, uf}`; demais chaves inalteradas.
  - Master em inspeção somente leitura não consegue `update` na empresa inspecionada.
- **Validação:** `pnpm migrate` (**só com autorização explícita**); `node --env-file=.env scripts/multi-empresa/q.mjs` para conferir colunas, CNPJs e definições; `node --env-file=.env scripts/multi-empresa/test-isolamento.mjs`.

## T02 — Tipos + `empresa-identidade.ts` + `useEmpresaIdentidade`

- [x] **T02** — concluída.
  - **Resumo:** 9 campos novos em `EmpresaAtiva`/`mapEmpresa` e em `Empresa` (CRM). `useAppOptional()` novo em `src/context/AppContext.tsx`.
  - `src/lib/empresa-identidade.ts` tem `somenteDigitos`, `formatCnpj`, `cnpjValido`, `formatCep`, `formatTelefone`, `formatEnderecoEmpresa`, `nomePrograma`, `PONTUA_VALOR_GRAVADO` e `rotuloPontua`.
  - `src/hooks/useEmpresaIdentidade.ts` tem `useEmpresaIdentidade()` e a versão pura `montarEmpresaIdentidade()`.
  - **Desvios do plano:**
    - O hook lê `useApp().empresa`, do núcleo, e não `useEmpresaOptional()`. Motivo: telas do núcleo (financeiro, ponto, RH) ficam fora do `EmpresaProvider` do CRM.
    - `nomePrograma('')` devolve só "Pontua", para não mostrar GARBO a outra empresa enquanto a empresa carrega.
  - **Validações:** `pnpm build` ok. Checagem ad-hoc com tsx:
    - `cnpjValido` aceita o CNPJ do BB e o da GARBO, e rejeita um inválido e uma sequência repetida;
    - `formatCnpj`, `formatEnderecoEmpresa` e `rotuloPontua` deram as saídas esperadas.
- **Objetivo:** expor os campos novos no front e criar os helpers/hook que serão a fonte única da identidade.
- **Arquivos:** `src/hooks/useEmpresaAtiva.ts`, `src/contexts/EmpresaContext.tsx`, `src/lib/empresa-identidade.ts` (novo), `src/hooks/useEmpresaIdentidade.ts` (novo).
- **Critérios de aceite:** `EmpresaAtiva`/`Empresa` com os campos novos mapeados em `mapEmpresa`; `somenteDigitos`, `formatCnpj`, `cnpjValido`, `formatEnderecoEmpresa`, `nomePrograma` exportados; hook devolve `{ nomeFantasia, razaoSocial, cnpjFormatado, cnpjDigitos, logoUrl, endereco, telefone, email, nomePrograma }` com fallbacks e funciona fora do `EmpresaProvider`.
- **Validação:** `pnpm build`; checagem ad-hoc de `cnpjValido('00000000000191') === true` e de um CNPJ inválido.

## T03 — Consulta à Receita (`cnpj-receita.ts`)

- [x] **T03** — concluída.
  - **Resumo:** `src/lib/cnpj-receita.ts` tem `consultarCnpjReceita`, `mapBrasilApi`, `mapCnpjWs` e a classe `CnpjReceitaIndisponivel`.
    - Timeout de 8 s por fonte.
    - Devolve `null` para CNPJ inválido ou inexistente, e lança erro quando as duas fontes falham.
  - **Validações:** `pnpm build` ok. `npx tsx --tsconfig tsconfig.app.json scripts/test-cnpj-receita.mjs` passou em tudo:
    - 3 checagens sem rede e 2 com o CNPJ do BB;
    - nesta máquina a BrasilAPI respondeu 429 ao Node, então quem atendeu foi o fallback `publica.cnpj.ws`. Por `curl`, a BrasilAPI responde 200 com CORS `*`.
  - **Uso:** o script usa `npx tsx`, não `pnpm exec tsx` (o tsx não está no `package.json`).
- **Objetivo:** consultar CNPJ na BrasilAPI com timeout e fallback `publica.cnpj.ws`.
- **Arquivos:** `src/lib/cnpj-receita.ts` (novo), `scripts/test-cnpj-receita.mjs` (novo).
- **Critérios de aceite:** `consultarCnpjReceita` devolve `DadosReceita` normalizado (logradouro com tipo, telefone com DDD, situação cadastral) ou `null`; CNPJ inválido não faz rede; timeout aborta e cai no fallback.
- **Validação:** `pnpm build`; `pnpm exec tsx scripts/test-cnpj-receita.mjs` com 00.000.000/0001-91 (Banco do Brasil).

## T04 — `useEmpresaBranding`: bug do `trocarEmpresa` + `salvarDadosEmpresa`

- [x] **T04** — concluída. Desbloqueada com a opção A, escolhida pelo usuário.
  - **Banco:** migration `20261118120100_empresa_atualizar_dados.sql` com a RPC `empresa_atualizar_dados` (DESIGN §2.1), aplicada com `pnpm migrate`.
  - **Front:** em `useEmpresaBranding.ts`:
    - B1 corrigido (`trocarEmpresa` saiu; agora é `recarregarEmpresa()` do núcleo);
    - `uploadLogo` exportado; novos `atualizarDadosEmpresa()` e `salvarDadosEmpresa`;
    - `salvarBranding` e `removerLogo` passam pela RPC.
  - `useContratosEmpresaConfig.salvar` e o CNPJ de `ConfiguracaoMarca.tsx` também passam pela RPC. As policies antigas não foram alteradas.
  - **Validações:**
    - teste SQL com rollback, com a migration dentro da transação: admin grava (CNPJ mascarado vira só dígitos, UF fica maiúscula); vendedor é recusado; admin da empresa B grava só na B, sem alterar a GARBO; master em somente leitura é recusado; master com acesso total grava; coluna `status` é recusada;
    - função com owner postgres, `security definer` e `search_path`, sem execute para anon;
    - chamada REST com a chave anon devolve 401/42501;
    - `pnpm build` ok.
  - **Não validado:** clique na tela com um usuário logado (fica para o roteiro manual).
- **Objetivo:** corrigir B1 e criar a mutation que grava os dados cadastrais.
- **Arquivos:** `src/hooks/useEmpresaBranding.ts`.
- **Critérios de aceite:** `onSuccess` chama `recarregarEmpresa()` (não `trocarEmpresa`); `uploadLogo` exportado; `salvarDadosEmpresa` grava CNPJ em dígitos, razão social, nome, endereço, telefone e e-mail e recarrega a empresa; erro do banco (ex.: somente leitura) vira toast.
- **Validação:** `pnpm build`; salvar a logo como admin não-master sem erro no console.

## T05 — `EmpresaDadosForm` com busca automática na Receita

- [x] **T05** — concluída (typecheck).
  - **Resumo:** `src/components/admin/EmpresaDadosForm.tsx`, com prop `tom: 'padrao' | 'perfil'`.
    - Blocos: Logo (upload ao salvar, remover, cor), CNPJ e Dados cadastrais.
    - CNPJ: máscara; consulta automática com debounce de 600 ms quando o CNPJ é editado e fica válido; spinner; botão "Buscar na Receita"; aviso se a situação for diferente de ATIVA; toast em erro ou CNPJ inexistente.
    - O formulário recarrega quando a empresa chega ou muda.
    - Alvos de toque com 44 px (`h-11`).
    - Grava com `salvarDadosEmpresa`, pela RPC.
  - **Validações:** `pnpm build` ok. Não abri o componente no navegador; o teste visual fica no roteiro manual.
- **Objetivo:** componente único de edição (logo, CNPJ, dados cadastrais).
- **Arquivos:** `src/components/admin/EmpresaDadosForm.tsx` (novo).
- **Critérios de aceite:** máscara de CNPJ; consulta automática com debounce ao chegar a 14 dígitos válidos + botão "Buscar na Receita"; spinner; preenche sem gravar; nome fantasia cai na razão social se vazio; aviso se situação ≠ ATIVA; erro → toast; botão "Salvar dados da empresa"; alvos de toque ≥ 44px; Tailwind + `lucide-react` + `src/components/ui`.
- **Validação:** `pnpm build`; teste manual isolado do componente.

## T06 — /profile (admin) + `/admin/marca` + `ContratosConfigPage`

- [x] **T06** — concluída (typecheck).
  - **Resumo:**
    - `Profile.tsx`: seção "Dados da empresa" (`id="dados-empresa"`, `tom="perfil"`), visível só com `hasRole('admin')` do CRM, que é o mesmo papel exigido pela RPC. Rola até a seção quando a URL tem `#dados-empresa`.
    - `ConfiguracaoMarca.tsx`: reescrita com `EmpresaDadosForm` + banner do prestador e gate `hasRole('admin')`. B2 resolvido, porque o formulário reage à empresa.
    - `ContratosConfigPage.tsx`: "Dados da contratada" virou prévia somente leitura (`useEmpresaIdentidade`), com o botão "Editar em Perfil".
  - `EmpresaBrandingForm` continua em `Admin.tsx` e em `GerenciamentoEmpresas.tsx`, gravando pela RPC (só a empresa ativa).
  - **Validações:** `pnpm build` ok. Admin e vendedor ficam para o roteiro manual.
- **Objetivo:** encaixar o formulário nas telas e deixar um único lugar de edição.
- **Arquivos:** `src/pages/Profile.tsx`, `src/pages/admin/ConfiguracaoMarca.tsx`, `ContratosConfigPage.tsx`.
- **Critérios de aceite:** seção "Dados da empresa" só para admin, no visual do /profile; `/admin/marca` usa `EmpresaDadosForm` com gate `hasRole('admin')` e mantém o banner do prestador (corrige B2); "Dados da contratada" em leitura com link "Editar em Perfil".
- **Validação:** `pnpm build`; manual como admin e como vendedor (critérios globais 1 e 2).

## T07 — `Logo.tsx` dinâmico

- [x] **T07** — concluída (typecheck).
  - **Resumo:** `src/components/Logo.tsx` usa `useAppOptional()?.empresa?.logoUrl` → `resolveBrandLogo`. O `alt` é o nome fantasia; `onError` cai na logo padrão e tenta de novo quando a URL muda.
  - Enquanto a empresa carrega (com sessão), a imagem fica `visibility: hidden`, sem piscar a GARBO para outra empresa.
  - Depois de salvar, `recarregarEmpresa()` atualiza o contexto e o menu troca a logo sem recarregar a página.
  - **Validações:** `pnpm build` ok. A troca no menu fica para o roteiro manual.
- **Objetivo:** logo da empresa no menu/header com fallback GARBO.
- **Arquivos:** `src/components/Logo.tsx`.
- **Critérios de aceite:** usa `useApp().empresa?.logoUrl` + `resolveBrandLogo`; `alt` = nome fantasia; `onError` volta à logo padrão; afeta `AppSidebar` (72px e recolhida), `NavigationHeader`, `ForaDoHorario`, `CrmModuloPlaceholder`; login/boot/PWA intactos.
- **Validação:** `pnpm build`; trocar a logo e ver o menu mudar sem recarregar.

## T08 — Slides: `EmpresaDadosLegais`, página pública, fingerprint

- [x] **T08** — concluída.
  - **Resumo:**
    - `EmpresaDadosLegais.tsx` tem a prop `empresa` e o `EmpresaPublicaProvider`. A ordem de prioridade é: prop → empresa do orçamento público → empresa da sessão (núcleo). O CNPJ sai com `formatCnpj`.
    - `OrcamentoPublicoPage` lê `r.empresa` e envolve a página (inclusive o render offscreen da exportação) com o provider.
    - `buildExportFingerprint` tem o parâmetro `empresa` (CNPJ, razão social, logo da empresa), passado por `useOrcamentoSlideExport` e `OrcamentoSlideExportJobRunner` com o mesmo valor.
  - **Validações:**
    - `pnpm build` ok;
    - SQL com rollback: orçamento de teste chamado como `anon` → `empresa` = `{nome: "Garbo Movelaria", razao_social: "Garbo Movelaria Moveis Sob Medida", cnpj: "58838942000123", logo_url…}`.
  - **Efeito colateral:** os PDFs que já estavam em cache vão ser gerados de novo uma vez, porque o fingerprint mudou.
- **Objetivo:** razão social e CNPJ nos slides, inclusive públicos, e PDF refeito quando mudam (B3, B4).
- **Arquivos:** `EmpresaDadosLegais.tsx`, `OrcamentoPublicoPage`, `src/lib/orcamento-slide-export-cache.ts`.
- **Critérios de aceite:** prop `empresa` opcional com prioridade sobre o contexto; `formatCnpj`; página pública passa `data.empresa`; fingerprint inclui CNPJ, razão social e logo.
- **Validação:** `pnpm build`; critério global 3.

## T09 — Contratos: variáveis `{{empresa_*}}`, `formatCnpj`, IA

- [x] **T09** — concluída.
  - **Resumo:**
    - `contratos-print.ts` tem `VARIAVEIS_EMPRESA`, `NOMES_VARIAVEIS_EMPRESA` e `valoresVariaveisEmpresa()`. `substituirVariaveis` aceita os valores da empresa, e os valores digitados pelo usuário têm prioridade. Cabeçalho e assinatura saem com `formatCnpj`.
    - `buildConteudoContrato` aceita os valores da empresa nos dois sistemas de contrato: `contrato-rascunho.ts` (núcleo, `/contratos`) e `crm-contratos.ts` (CRM).
    - Os valores são passados em `NovoContratoPage` (3 pontos), `ContratoVisualizarDialog` (2) e `crm/ContratosPage` (1).
    - `getContratosEmpresaFromContext` devolve o CNPJ formatado.
    - Editor (`ContratosConfigPage`): grupo "Da empresa (automáticas)" na lista de variáveis; as variáveis automáticas não aparecem no alerta "não cadastradas"; criar variável com nome reservado é bloqueado. Elas não são pedidas no contrato novo porque o formulário só lista `contratos_variaveis`.
    - `compose-contrato-ia/index.ts`: os 3 prompts usam `{{EMPRESA}}`, trocado pelo `nome` da empresa (lido com `serviceClient(empresaId)` filtrando por `id`; padrão "marcenaria"). `empresaDoChamador` agora é chamado uma vez só.
  - **Validações:**
    - `pnpm build` ok;
    - `npx deno check supabase/functions/compose-contrato-ia/index.ts` ok;
    - checagem com tsx: todas as variáveis `{{empresa_*}}` foram trocadas (CNPJ mascarado, endereço em uma linha); valor digitado pelo usuário prevaleceu; variável sem valor ficou como está.
  - **Pendente:** deploy de `compose-contrato-ia`, que não fiz.
- **Objetivo:** dados da empresa automáticos nos contratos e nos prompts da IA.
- **Arquivos:** `contratos-print.ts`, `ContratosConfigPage.tsx`, `NovoContratoPage`, `supabase/functions/compose-contrato-ia/index.ts`.
- **Critérios de aceite:** `substituirVariaveis` resolve as 6 variáveis; listadas no editor; não pedidas no contrato novo; cabeçalho/assinatura com `formatCnpj`; prompts sem "GARBO Movelaria" fixo, nome lido com `serviceClient(await empresaDoChamador(req))` filtrando por `id`.
- **Validação:** `pnpm build`; critério global 4; deploy da edge function só com autorização.

## T10 — PDFs e recibos com a empresa por parâmetro

- [x] **T10** — concluída.
  - **Desvio do DESIGN (deliberado):** em vez de mudar a assinatura de cada gerador e de todos os chamadores, os geradores leem a empresa ativa de um valor guardado em módulo.
    - O valor fica em `src/lib/empresa-identidade.ts`: `definirEmpresaDocumento` grava, e `useEmpresaAtiva` chama sempre que a empresa carrega ou muda. É o mesmo padrão de `definirInspecaoSomenteLeitura`.
    - Leitura por `empresaDocumento()`, `nomeEmpresaDocumento()`, `logoDocumentoUrl()` e `logoPadraoDocumentoUrl()`.
    - `montarEmpresaIdentidade` foi para a lib, e o hook só reexporta.
    - Os parâmetros que já existiam (CNPJ do REP/RH/recibo, `empresaNome`) continuam com prioridade.
  - **Arquivos:**
    - `recibo-print.ts`, `caixa-comprovante-print.ts`, `cobranca-resumo-pdf.ts`, `funcionario-checklist-docs-export.ts`, `funcionario-docs-export.ts`, `funcionario-ponto-comprovante.ts`, `funcionario-recibo-print.ts`, `ponto-registros-export.ts`, `resumo-ponto-pdf.ts` e `advertencia-disciplinar-pdf.ts`: nome, logo e CNPJ de fallback vêm da empresa.
    - `pixBrcode.ts` e `processarTemplate.ts`: recebedor do PIX e nova variável `{{nome_empresa}}`.
    - `useTemplatesCobranca.ts`: o template padrão assina com `{{nome_empresa}}`.
    - `TemplatesConfigModal.tsx`: variável na lista e placeholder.
    - `RepConfigPanel.tsx`: razão social e CNPJ padrão vêm da empresa.
    - Componentes `ReciboPrintPreview`, `CaixaComprovantePrintModal`, `OrcamentosFechados`, `ExportReportDialog`, `AdvertenciaDisciplinarPanel`, `PortalBrand` e `PrestadorGarboBrand`.
    - Fallbacks `|| 'Garbo Movelaria'` em 7 arquivos (leads, markup, auditoria, `lead-ai-render-export`, `negociador-pdf-export`).
    - Exportações em canvas: `crossOrigin = 'anonymous'` para a logo do Storage; se ela falhar, cai na logo padrão.
  - **Validações:**
    - `pnpm build` ok;
    - `grep "'GARBO MOVELARIA'" src` sem ocorrências;
    - checagem com tsx: sem empresa → "GARBO MOVELARIA"; com empresa → nome em caixa alta, CNPJ formatado e só dígitos; PIX com o recebedor normalizado (`MARCENARIA SAO JOSE`); `{{nome_empresa}}` trocado.
  - **Não validado:** a geração real dos PDFs e o JPG em canvas com logo do Storage (precisa do navegador; está no roteiro manual).
  - **Fora:** os textos regex de `normalizeReciboCorpo` (servem para limpar recibos antigos), login/boot/PWA, a apresentação de marketing (T11/T12) e `GARBO_MOVELARIA_LABEL` (mantido como deprecated).
- **Objetivo:** remover "GARBO MOVELARIA"/"Garbo Movelaria" fixos dos PDFs.
- **Arquivos:** `recibo-print.ts`, `caixa-comprovante-print.ts`, `cobranca-resumo-pdf.ts`, `funcionario-*.ts`, `ponto-registros-export.ts`, `resumo-ponto-pdf.ts`, `advertencia-disciplinar-pdf.ts`, `ReciboPrintPreview.tsx`, `pixBrcode.ts`, `processarTemplate.ts`, `useTemplatesCobranca.ts`, `RepConfigPanel.tsx` e os componentes chamadores.
- **Critérios de aceite:** funções recebem `empresa`; prioridade config própria → empresa → genérico; REP/AFD com `somenteDigitos`; padrão de `razao_social` do REP vem da empresa.
- **Validação:** `pnpm build`; critério global 5; `grep -rn "GARBO MOVELARIA" src` sem ocorrências em PDFs.

## T11 — "Pontua {nome}": helper + menu + página/apresentação

- [x] **T11** — concluída.
  - **Resumo:**
    - `app-navigation.ts`: o item `pontuaGarbo` passou a ter o rótulo genérico "Pontua" e ganhou o helper `aplicarNomePrograma()`.
    - `AppSidebar` aplica `nomePrograma(empresa.nome)` no menu e na busca.
    - `paginas-catalogo.ts`: `TITULO_NO_CATALOGO`, para o master ver "Pontua (programa de pontos)".
    - `PontuaGarboPage` (título), `GarboApresentacaoEmpresa` (loader e rótulo do capítulo, que sai de `useMemo` sem mudar o id da seção), `GarboApresentacaoPontuaGarbo` (título e aria-label) e `ApresentacaoEmpresaPublicaPage` (`document.title` com o nome da empresa da sessão).
    - Ids, rotas e arquivos não mudaram.
  - **Validações:**
    - `pnpm build` ok;
    - `check-catalogo.mjs` ok;
    - `check-paginas-visiveis.mjs`: 1085 checagens, 0 falha;
    - checagem com tsx: menu "Pontua Marcenaria X"; busca por "pontua" acha o item; catálogo "Pontua (programa de pontos)".
  - **Não mexi** no texto institucional da apresentação ("A Garbo em cada detalhe", história do fundador, Instagram). É material de marketing da própria GARBO, e não dá para generalizar sem conteúdo de cada empresa (pendência de produto).
- **Objetivo:** nome dinâmico do programa nos pontos de entrada.
- **Arquivos:** `src/lib/app-navigation.ts`, `AppSidebar.tsx`, busca do menu, página do Pontua, `GarboApresentacaoPontuaGarbo.tsx`, `garbo-apresentacao-content.ts`.
- **Critérios de aceite:** menu/busca mostram "Pontua {nome fantasia}"; catálogo do master continua "Pontua (programa de pontos)"; `document.title` da apresentação usa o nome da empresa; ids/rotas inalterados.
- **Validação:** `pnpm build`; `check-catalogo.mjs` e `check-paginas-visiveis.mjs`; critério global 6 (parte menu/página).

## T12 — "Pontua {nome}": demais textos visíveis

- [x] **T12** — concluída.
  - **Resumo:** "Pontua Garbo" visível virou `nomePrograma`. Componentes usam o hook; hooks e libs usam `empresaDocumento().nomePrograma`, calculado na hora.
    - Financeiro: `ArquitetoContatoDialog`, `ArquitetosPontuaDialog`, `ArquitetosPontuaGarboMural`, `PontuaSolicitantesSaque`, `SaldoReceberArteDialog`, `ComissoesLiberacaoAdminPanel` e `PrestadorFinanceiroRow`.
    - Leads: `KanbanCard`, `LeadCustomFieldsSection` (3 componentes), `LeadModal`, `LeadModalNav` (inclui o item estático de `lead-modal-nav.ts`), `LeadPontuaGarboPartnerBadge`, `LeadPontuaGarboContactPanel`, `SaleValueDialog`, `LeadQuickPeekDialog`, `LeadLembreteDialog` e `PipelineLeadCard`.
    - Prestador e portal: `PrestadorPortalHero`, `PrestadorLeadDetailDialog`, `PrestadorPortalLeadCard` e `PortalLeadCard`.
    - Páginas: `GarboParceriaFormOverlay`, `Admin`, `FinanceiroPontuaPage`, `Financeiro`, `Leads` e `PontuaGarboPage`.
    - Hooks: `useLeadCustomFields` (a mensagem virou função), `usePontuaGarboComissaoLiberacao`, `usePontuaGarboPartnerLeads` (toasts e nota automática) e `useSaquePedidos`.
    - Libs: `pontua-garbo-access`, `financeiro-pontua-pdf-export` e `recibo-saque-print`.
    - Origem do lead e nome do campo personalizado: exibidos com `rotuloPontua(valor, nomePrograma)`; a cor continua indexada pelo valor gravado.
    - Edge: `_shared/pontua-garbo-lead.ts` monta a nota automática "Pontua {nome}" (busca o nome pelo `empresaId`, novo parâmetro opcional). `register-public` e `create-user-admin` passam o `empresaId`.
  - **Mantido de propósito** (é dado gravado ou chave usada em busca):
    - `PONTUA_GARBO_CAMPO_NOME`, `PONTUA_GARBO_LEAD_ORIGEM` e `.ilike("nome","Pontua Garbo")`;
    - as chaves de cor `'Pontua Garbo'` e o fallback `fieldNome` do `crm-portal`;
    - o nome de fallback do parceiro (`'Parceiro Pontua Garbo'`);
    - a descrição da conta a pagar "Nome — Pontua Garbo" (gravada também pela função do banco) e os textos que a citam (toast em `LeadCustomFieldsSection` e `PontuaGarboAposGanhoDialog`);
    - os `console.*`.
  - **Validações:**
    - `pnpm build` ok;
    - `deno check` ok em `register-public` e `_shared/pontua-garbo-lead`;
    - `create-user-admin` tem 4 erros de tipo que já existiam (o `HEAD` original dá os mesmos 4, nas linhas 139/232/242/243) e nenhum novo;
    - grep confirma que os literais acima continuam no código.
  - **Pendente:** deploy de `register-public` e `create-user-admin`, que não fiz.
- **Objetivo:** trocar os textos visíveis restantes sem tocar valores gravados.
- **Arquivos:** modal do lead, badges, Admin, toasts, `financeiro-pontua-pdf-export.ts`, `recibo-saque-print.ts`, `crm-marketing.ts`, `usePontuaGarboPartnerLeads.ts`, `supabase/functions/_shared/pontua-garbo-lead.ts` (lista completa na exploração do plano).
- **Critérios de aceite:** textos visíveis com `nomePrograma`; `PONTUA_GARBO_CAMPO_NOME`, `PONTUA_GARBO_LEAD_ORIGEM`, `.ilike("nome","Pontua Garbo")`, query keys, ids, rotas e arquivos intactos; exibição mapeada por `valor === 'Pontua Garbo' ? nomePrograma : valor`; leads antigos reconhecidos.
- **Validação:** `pnpm build`; critério global 6 completo; `grep` dos literais preservados.

## T13 — Documentação e scripts de verificação

- [x] **T13** — concluída.
  - **Resumo:**
    - `docs/structure.md` ganhou a seção "Identidade da marcenaria".
    - `docs/glossary.md` ganhou "Nome fantasia", "Razão social / CNPJ", "Pontua {nome}" e "Variáveis `{{empresa_*}}`".
    - Os scripts não precisaram de ajuste: as regex de logo só olham as texturas Aura, que não mudaram.
  - **Validações (rodada final):**
    - `pnpm build` ok;
    - `test-isolamento.mjs` 27 ok / 0 falha;
    - `check-paginas-visiveis.mjs` 1085 / 0;
    - `test-cnpj-receita.mjs` tudo ok;
    - `node scripts/test-sidebar-search.mjs` 10 ok / 0 falha;
    - `node scripts/test-crm-pipeline.mjs`: 5 ok / **1 falha que já existia**. A asserção `/max-width: 767px/` em `PipelineBoardAura.tsx`, arquivo que não toquei (sem mudança desde o commit `054ccae`);
    - critério 7 (master somente leitura recusado) validado no banco na T01 (policy) e na T04 (RPC).
- **Objetivo:** registrar o módulo e manter os scripts ad-hoc funcionando.
- **Arquivos:** `docs/structure.md`, `docs/glossary.md`, `scripts/test-sidebar-search.mjs`, `scripts/test-crm-pipeline.mjs` (se a regex da logo quebrar).
- **Critérios de aceite:** docs citam `empresa-identidade.ts`, `useEmpresaIdentidade`, `cnpj-receita.ts`, `EmpresaDadosForm` e as variáveis `{{empresa_*}}`; glossário com "nome fantasia" e "Pontua {nome}"; scripts passam.
- **Validação:** rodar os scripts ajustados; `pnpm build`; critério global 7 (master somente leitura).

---

## Proposta (fora do escopo — tarefa de segurança separada)

### TS01 — Restringir a edição dos dados da empresa ao admin (PROPOSTA)

- [ ] **TS01** *(proposta, não aprovada)*
- **Recursão (achada na T01, continua aberta):** a `me_empresas_contratos_timbrado_update` faz join com a própria tabela, e por isso **todo UPDATE direto** de `authenticated` na tabela de empresas falha com `infinite recursion detected in policy`. A identidade grava pela RPC `empresa_atualizar_dados`; os banners do prestador (`usePrestadorBanner*`) e `GerenciamentoEmpresas` continuam quebrados até a TS01.
- **Problema:** a policy `me_empresas_contratos_timbrado_update` (`supabase/baseline/000_baseline_schema.sql:40674`) permite que **vendedor** atualize **qualquer coluna** da empresa (inclusive `status`, `ativo`, `slug`). Além disso, `anon_select_empresas_public_slug` deixa `anon`/qualquer autenticado ler todas as colunas de empresas ativas (agora incluindo telefone/e-mail/endereço).
- **Sugestão:** RPC `empresa_atualizar_dados(...)` `security definer`, só para admin da empresa atual, com `app_assert_escrita_permitida()`; remover/estreitar a policy do vendedor; avaliar uma view/RPC pública só com as colunas necessárias.
- **Validação:** `test-isolamento.mjs` + teste com vendedor tentando `update` direto.
