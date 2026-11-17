# TASKS — GARBO Movelaria multi-empresas (SaaS para marcenarias)

> Modo Pair-to-Peer: uma tarefa por vez. Cada tarefa só é marcada `[x]` depois de validada, e só se
> avança depois da aprovação do par humano.
> Legenda: `- [ ]` pendente · `- [x]` concluída · `- [~]` em andamento · `- [!]` bloqueada (motivo ao lado)

- Plano completo: `C:\Users\PC\.claude\plans\planejar-a-transforma-o-do-splendid-snowglobe.md`
- O quê e por quê: [`REQUIREMENTS.md`](./REQUIREMENTS.md) · O como: [`DESIGN.md`](./DESIGN.md)
- ADR: [`docs/decisions/0003-multi-tenant-por-empresa-id.md`](../decisions/0003-multi-tenant-por-empresa-id.md)
- Banco alvo: `vejugdspjfgfajdpfiht` (novo). Banco antigo `zzqgtclvuetemzhqzhbq`: não é tocado.
- Continua a migração de [`docs/TASKS.md`](../TASKS.md): T11 → M01 e M29; T13 → M30; T14 → M31.

## Regras fixas

- **Ritmo:** uma tarefa por vez, no ciclo diagnóstico → OK → implementa → valida → `[x]` → relatório → OK.
- **Valores do `.env` nunca são impressos** (nem trechos, nem em logs de erro). Senhas vêm só de
  variável de ambiente digitada pelo usuário.
- **Sem commit nem push sem pedido explícito.** Branch sugerida: `feat/multi-empresa`, a partir de
  `feat/baseline-novo-banco`.
- **Conferir o host do banco antes de qualquer escrita:** todo `pnpm migrate`, `psql` ou script com
  `DATABASE_URL`/service role confere antes que o host contém `vejugdspjfgfajdpfiht`.
- **Migrations novas** com prefixo de 14 dígitos maior que `20261022140000`. Migration aplicada nunca é editada.
- **Validação:** `pnpm build` a cada tarefa que toca código; para SQL, `pnpm migrate` + consultas de
  verificação + `get_advisors` (security) sem erros novos; para UI, roteiro manual no app.
- **Pares duplicados** `src/lib/X.ts` ↔ `supabase/functions/_shared/X.ts`: mudar os dois lados juntos.
- **Deploy de edge functions** só com confirmação explícita do usuário.

---

## Fase 0 — Especificação

### M00 — Documentação do plano multi-empresa
- [x] **Status**
- **Objetivo:** registrar o plano aprovado em docs versionáveis e ligar a migração pendente a ele.
- **Arquivos:** `docs/multi-empresa/REQUIREMENTS.md`, `docs/multi-empresa/DESIGN.md`,
  `docs/multi-empresa/TASKS.md`, `docs/decisions/0003-multi-tenant-por-empresa-id.md`, `docs/TASKS.md` (nota no topo).
- **Critérios de aceite:**
  - REQUIREMENTS cobre contexto, decisões do usuário e critérios de sucesso;
  - DESIGN cobre as seções 1 a 7 da arquitetura e as regras de execução;
  - TASKS lista M00–M32 com objetivo, arquivos, aceite e validação;
  - ADR 0003 no formato de `docs/decisions/README.md`, com alternativas rejeitadas;
  - `docs/TASKS.md` preservado, só com a nota de continuação.
- **Validação:** releitura dos arquivos. Sem código, sem banco.
- **Depende de:** —

## Fase A — Fundação de tenant e master

### M01 — Usuário master e vínculo com a Garbo (fecha o "primeiro admin" da T11)
- [x] **Status**
- **Objetivo:** criar `selvomichael@gmail.com` no Auth do banco novo, inserir em `super_admins`,
  vincular à Garbo em `usuario_empresa` e dar o perfil Administrador no núcleo e admin no CRM.
- **Arquivos:** `scripts/create-admin-user.mjs`, `scripts/set-admin.mjs` (ou um script novo
  `scripts/multi-empresa/vincular-master.mjs`, idempotente).
- **Critérios de aceite:**
  - usuário existe em `auth.users` com e-mail confirmado;
  - 1 linha em `"CRM-multi-empresas>super_admins<"` e 1 em `"CRM-multi-empresas>usuario_empresa<"` (Garbo);
  - `movelaria_usuarios.perfil = 'administrador'`; `emp_garbo.usuarios` + `emp_garbo.user_roles` com `admin`;
  - login no app funciona e cai no painel com acesso total;
  - a senha nunca aparece em arquivo nem em saída de comando.
- **Validação:** consultas de verificação (contagens, sem valores sensíveis); login manual no app.
- **Depende de:** M00. Exige a senha do usuário via variável de ambiente.

### M02 — Resolvedor de empresa e tabelas de plataforma
- [x] **Status**
- **Objetivo:** criar `app_is_master()`, `plataforma_master_contexto`, `master_definir_empresa_ativa()`,
  `app_empresa_atual()`, `app_minha_empresa()`, a coluna `empresas.status` e `unique(user_id)` em `usuario_empresa`.
- **Arquivos:** `supabase/migrations/2026111…_multi_empresa_resolvedor.sql` (novo).
- **Critérios de aceite:**
  - funções `STABLE`, `SECURITY DEFINER`, `search_path` fixo;
  - `app_empresa_atual()` devolve a Garbo para o master sem contexto definido e `NULL` para empresa bloqueada/inativa (exceto master);
  - `master_definir_empresa_ativa` aborta se o chamador não for master;
  - RLS ligado em `plataforma_master_contexto`.
- **Validação:** `pnpm migrate` (host conferido); testes SQL simulando `auth.uid()` via `set_config('request.jwt.claims', …)`; `get_advisors`.
- **Depende de:** M01.

### M03 — Gerador da migration de tenant
- [x] **Status**
- **Objetivo:** script que lê o catálogo (tabelas, policies, constraints únicas) e gera o SQL de
  `empresa_id` + índices + policies recriadas, para revisão antes de aplicar.
- **Arquivos:** `scripts/multi-empresa/gerar-tenant-migration.mjs` (novo).
- **Critérios de aceite:**
  - só leitura no banco; gera arquivo `.sql` sem aplicá-lo;
  - cobre as 61 tabelas `movelaria_*` (menos `movelaria_schema_migrations`) e as 129 de `emp_garbo`/`crm`;
  - lista à parte as unicidades/PKs que precisam virar compostas.
- **Validação:** rodar o script; revisar o SQL gerado com o usuário.
- **Depende de:** M02.

## Fase B — Núcleo `movelaria_*`

### M04 — `empresa_id` nas tabelas do núcleo
- [x] **Status**
- **Objetivo:** `empresa_id not null default app_empresa_atual() references empresas(id)` + índice nas
  61 tabelas `movelaria_*`, incluindo `movelaria_usuarios`.
- **Arquivos:** `supabase/migrations/2026111…_multi_empresa_nucleo_coluna.sql` (gerado pela M03).
- **Critérios de aceite:** todas as tabelas do escopo com a coluna, FK e índice; linhas existentes preenchidas com a Garbo.
- **Validação:** `pnpm migrate`; consulta ao `information_schema` contando colunas; `pnpm build`.
- **Depende de:** M03.

### M05 — Policies do núcleo por empresa
- [x] **Status**
- **Objetivo:** recriar as 175 policies com `AND empresa_id = app_empresa_atual()` e fechar `anon`/`true`
  (7 financeiras + caixa + `pix_config`…).
- **Arquivos:** `supabase/migrations/2026111…_multi_empresa_nucleo_policies.sql`.
- **Critérios de aceite:** nenhuma policy de `movelaria_*` sem filtro de empresa; `anon` sem acesso; `get_advisors` sem erros novos.
- **Validação:** `pnpm migrate`; consulta em `pg_policies`; `get_advisors`.
- **Depende de:** M04.

### M06 — Singletons por empresa
- [x] **Status**
- **Objetivo:** PK `(empresa_id, chave)` em `visualizacao_config`, `obra_lousa_text_config`,
  `simulador_caixa` (`ano`), `pix_config`, `recibo_config`, `recibo_prestador_config`, `rep_config`,
  `fin_templates_copia`; ajustar as funções `movelaria_*` que leem esses singletons.
- **Arquivos:** migration nova; hooks do front que fazem `upsert` nesses singletons (se usarem `onConflict`).
- **Critérios de aceite:** duas empresas podem ter a mesma `chave`; upserts do front continuam funcionando.
- **Validação:** `pnpm migrate`; `pnpm build`; editar uma config no app.
- **Depende de:** M05.

### M07 — Storage por empresa
- [x] **Status**
- **Objetivo:** prefixo `${empresaId}/` nos paths e policies de `storage.objects` por pasta.
- **Arquivos:** `src/lib/*-anexos.ts`, `src/lib/obra-arquivos.ts`, `src/lib/briefing-storage.ts`,
  `src/lib/escritorio-arquivos.ts`, `src/lib/funcionario-documentos.ts`; migration de policies de storage.
- **Critérios de aceite:** upload grava em `<empresa_id>/…`; policies usam `(storage.foldername(name))[1]::uuid = app_empresa_atual()`.
- **Validação:** `pnpm build`; `pnpm migrate`; upload e download manual no app.
- **Depende de:** M06 (e M16 para o `empresaId` no front; pode usar a RPC direto até lá).

## Fase C — CRM

### M08 — `emp_garbo` vira `crm`
- [x] **Status**
- **Objetivo:** `ALTER SCHEMA emp_garbo RENAME TO crm`, expor `crm` na API, `empresa_id` nas 129
  tabelas e unicidades compostas.
- **Arquivos:** migration nova; `scripts/baseline/expose-schemas.mjs`.
- **Critérios de aceite:** schema `crm` acessível pela API; todas as tabelas com `empresa_id` + índice; unicidades "por instalação" compostas.
- **Validação:** `pnpm migrate`; chamada REST ao schema `crm`; `get_advisors`.
- **Depende de:** M03. Exige token da Management API para expor o schema.

### M09 — Policies do CRM por empresa
- [x] **Status**
- **Objetivo:** filtrar por empresa as policies do schema `crm`, incluindo as 64 `USING (true)`;
  helpers `me_*` sem parâmetro de schema.
- **Arquivos:** migration nova.
- **Critérios de aceite:** nenhuma policy `true` em tabela de tenant do `crm`; `me_get_empresa_role` substituído por leitura de `crm.user_roles` com `empresa_id`.
- **Validação:** `pnpm migrate`; `pg_policies`; `get_advisors`.
- **Depende de:** M08.

### M10 — Funções SQL sem `'emp_garbo'` (lotes M10a…M10d)
- [x] **Status**
- **Objetivo:** reescrever `movelaria_crm_*`, `movelaria_criar_obra_*`, contratos, markup e
  `movelaria_obter_minha_identidade`/`listar_identidades` para `crm.*` + filtro de empresa.
- **Arquivos:** uma migration por lote.
- **Critérios de aceite:** a cada lote, `select count(*) from pg_proc where prosrc like '%emp_garbo%'` diminui; ao fim, zero.
- **Validação:** `pnpm migrate`; contagem em `pg_proc`; chamadas de teste das RPCs alteradas.
- **Depende de:** M09.

### M11 — Front do CRM no schema `crm`
- [x] **Status**
- **Objetivo:** `EmpresaContext` com schema `'crm'`; `empresa-tables.ts` (os dois lados); remover o
  fallback master e os hardcodes de `emp_garbo` em hooks e libs.
- **Arquivos:** `src/contexts/EmpresaContext.tsx`, `src/lib/empresa-tables.ts`,
  `supabase/functions/_shared/empresa-tables.ts`, `src/hooks/useCrmComunicacao.ts`,
  `src/hooks/useMarkupCustosPorLeads.ts`, `src/lib/crm-orcamento-slides.ts`,
  `src/lib/funcionario-usuario-busca.ts`, `src/types/index.ts`.
- **Critérios de aceite:** `grep -r emp_garbo src/` vazio (exceto `OrcamentoPublicoPage.tsx`, tratado na M12); CRM abre e lista leads.
- **Validação:** `pnpm build`; roteiro manual no CRM.
- **Depende de:** M10.

### M12 — Links públicos por slug
- [x] **Status**
- **Objetivo:** orçamento, agenda e cadastro públicos resolvem a empresa pelo slug, com a rota antiga compatível.
- **Arquivos:** `src/App.tsx`, `src/pages/…/OrcamentoPublicoPage.tsx`, `src/lib/agenda-public-scope.ts`, RPCs públicas.
- **Critérios de aceite:** `/orcamento/garbo/:id` e `/orcamento/emp_garbo/:id` abrem o mesmo orçamento; `anon` não lê nada além do item pedido.
- **Validação:** `pnpm build`; abrir os links em janela anônima.
- **Depende de:** M11.

## Fase D — Corte Claude e edge functions

### M13 — Corte Claude por empresa
- [x] **Status**
- **Objetivo:** `orcamentos_ia_tenant_company_id()` → `app_empresa_atual()` + policies nas tabelas com `company_id`.
- **Arquivos:** migration nova.
- **Critérios de aceite:** tabelas com `company_id` filtradas por empresa; nenhuma constante de empresa na função.
- **Validação:** `pnpm migrate`; `pg_policies`; abrir `/orcamentos-ia`.
- **Depende de:** M02.

### M14 — `_shared/tenant.ts` e funções de usuário
- [x] **Status**
- **Objetivo:** helper de tenant a partir do JWT; checagem de papel em `create-user-admin`; mesma
  empresa em `delete-user`, `reset-user-password`, `fix-user-access`; `register-public` por slug.
- **Arquivos:** `supabase/functions/_shared/tenant.ts` (novo) e as 5 funções citadas.
- **Critérios de aceite:** nenhuma dessas funções aceita `empresaId`/`schemaNome` do body (exceto master); chamador sem papel recebe 403.
- **Validação:** `deno check` se disponível; revisão do diff; teste real após a M30.
- **Depende de:** M10.

### M15 — Varredura das demais edge functions
- [x] **Status**
- **Objetivo:** remover `emp_garbo` e schema vindo do body das outras funções.
- **Arquivos:** `supabase/functions/**`.
- **Critérios de aceite:** `grep -r emp_garbo supabase/functions/` vazio.
- **Validação:** grep; revisão do diff.
- **Depende de:** M14.

## Fase E — Front multi-empresa

### M16 — `EmpresaContext` real
- [x] **Status**
- **Objetivo:** `app_minha_empresa`, `isMaster`, `trocarEmpresa`; query keys com `empresaId`; limpar cache ao trocar de empresa ou sair.
- **Arquivos:** `src/contexts/EmpresaContext.tsx`, `src/main.tsx` (`shouldDehydrateQuery` e keys), hooks consumidores.
- **Critérios de aceite:** trocar de empresa não mostra dado da anterior, nem após recarregar a página.
- **Validação:** `pnpm build`; roteiro manual com duas empresas.
- **Depende de:** M11, M02.

### M17 — Identidade e gate de empresa bloqueada
- [x] **Status**
- **Objetivo:** `useAuth` com `empresa_*`, `is_master` e status; estado "empresa bloqueada" em `evaluateIdentityGate` com tela de acesso suspenso.
- **Arquivos:** `src/hooks/useAuth.ts`, função do gate de identidade, nova tela de acesso suspenso.
- **Critérios de aceite:** usuário de empresa bloqueada vê a tela; master passa direto.
- **Validação:** `pnpm build`; bloquear a empresa de teste e logar.
- **Depende de:** M10, M16.

### M18 — Seletor de empresa e banner do master
- [x] **Status**
- **Objetivo:** seletor no header e banner "Você está vendo: <Empresa>", só para o master.
- **Arquivos:** componente de header do app, novo `EmpresaSwitcher`.
- **Critérios de aceite:** invisível para usuário comum; trocar atualiza os dados.
- **Validação:** `pnpm build`; roteiro manual.
- **Depende de:** M16.

## Fase F — Painel Master

### M19 — Seed e criação de empresa
- [x] **Status**
- **Objetivo:** RPC `plataforma_seed_empresa(p_empresa_id)` + edge function `master-criar-empresa`.
- **Arquivos:** migration nova; `supabase/functions/master-criar-empresa/index.ts` (novo); `supabase/config.toml`.
- **Critérios de aceite:** empresa nova nasce com funil, agenda, formas de pagamento a pagar e singletons; admin consegue logar.
- **Validação:** `pnpm migrate`; chamar a RPC numa empresa de teste; teste da função após a M30.
- **Depende de:** M14, M06, M09.

### M20 — RPC `master_resumo_empresas`
- [x] **Status**
- **Objetivo:** resumo por empresa (status, plano, admins, nº de usuários, faturamento no período, mensalidade).
- **Arquivos:** migration nova.
- **Critérios de aceite:** aborta para não master; faturamento bate com `useGraficoReceitasMensal`.
- **Validação:** `pnpm migrate`; consulta comparativa.
- **Depende de:** M02, M04 (mensalidade completa depois da M25).

### M21 — Rotas `/master*` e menu
- [x] **Status**
- **Objetivo:** rotas `lazy()` com gate `isMaster` inline; item de menu `masterOnly`; mapas de path e `RoleRedirect`.
- **Arquivos:** `src/App.tsx`, `src/lib/app-navigation.ts`, `NavVisibilityContext`.
- **Critérios de aceite:** usuário comum é redirecionado; master vê o item de menu.
- **Validação:** `pnpm build`; roteiro manual.
- **Depende de:** M16.

### M22 — Dashboard master
- [x] **Status**
- **Objetivo:** KPIs, tabela de empresas com busca e gráfico de faturamento mensal.
- **Arquivos:** `src/pages/master/MasterDashboard.tsx` (novo), hook de dados.
- **Critérios de aceite:** números batem com a RPC; estados de carregando, vazio e erro.
- **Validação:** `pnpm build`; roteiro manual.
- **Depende de:** M20, M21.

### M23 — Lista e criação de empresas
- [x] **Status**
- **Objetivo:** lista e formulário empresa + admin, a partir de `GerenciamentoEmpresas.tsx`.
- **Arquivos:** `src/pages/master/MasterEmpresas.tsx` (novo), `src/pages/admin/GerenciamentoEmpresas.tsx`.
- **Critérios de aceite:** criar empresa pelo app chama `master-criar-empresa` e a empresa aparece na lista.
- **Validação:** `pnpm build`; criar empresa de teste.
- **Depende de:** M19, M21.

### M24 — Detalhe da empresa
- [x] **Status**
- **Objetivo:** dados cadastrais, admin (trocar, resetar senha), usuários, cobranças e ações (ativar, bloquear, liberar, entrar).
- **Arquivos:** `src/pages/master/MasterEmpresaDetalhe.tsx` (novo).
- **Critérios de aceite:** "entrar na empresa" troca o contexto; bloquear/liberar reflete no gate.
- **Validação:** `pnpm build`; roteiro manual.
- **Depende de:** M23, M17.

## Fase G — Financeiro Master

### M25 — Tabelas `plataforma_*`
- [x] **Status**
- **Objetivo:** `plataforma_formas_pagamento`, `plataforma_planos`, `plataforma_assinaturas`,
  `plataforma_cobrancas` + seed das formas de pagamento + RLS só master.
- **Arquivos:** migration nova.
- **Critérios de aceite:** usuário comum não lê nada; seed Pix, Boleto, Cheque, Dinheiro, Cartão.
- **Validação:** `pnpm migrate`; `get_advisors`.
- **Depende de:** M02.

### M26 — Jobs de cobrança e inadimplência
- [x] **Status**
- **Objetivo:** `plataforma_gerar_cobrancas()` e `plataforma_atualizar_inadimplencia()` via `pg_cron`
  diário; desbloqueio na baixa.
- **Arquivos:** migration nova.
- **Critérios de aceite:** cobrança vencida além da tolerância bloqueia; baixa desbloqueia na hora; `liberado_ate` respeitado.
- **Validação:** `pnpm migrate`; rodar as funções manualmente com dados de teste; `cron.job` listado.
- **Depende de:** M25.

### M27 — UI de Planos, Formas de pagamento e Assinaturas
- [x] **Status**
- **Objetivo:** abas de cadastro em `/master/financeiro`.
- **Arquivos:** `src/pages/master/MasterFinanceiro.tsx` (novo) e componentes em `src/components/master/`.
- **Critérios de aceite:** CRUD funcional no padrão de `ContasPagarConfigModal.tsx`.
- **Validação:** `pnpm build`; roteiro manual.
- **Depende de:** M25, M21.

### M28 — UI de Cobranças
- [x] **Status**
- **Objetivo:** filtros por período, status e empresa; "Dar baixa"; KPIs (a receber, recebido, vencido, MRR).
- **Arquivos:** `src/pages/master/MasterFinanceiro.tsx`, componentes em `src/components/master/`.
- **Critérios de aceite:** baixa atualiza a cobrança e desbloqueia a empresa.
- **Validação:** `pnpm build`; roteiro manual.
- **Depende de:** M26, M27.

## Fase H — Fechamento (inclui o restante da migração)

### M29 — Configurações da Garbo (resto da T11)
- [ ] **Status**
- **Objetivo:** decidir com o usuário e copiar as tabelas de configuração da Garbo do banco antigo, já com `empresa_id`.
- **Arquivos:** `scripts/baseline/copy-rows.mjs` (ou variante).
- **Critérios de aceite:** lista de tabelas aprovada pelo usuário; linhas copiadas com a `empresa_id` da Garbo; banco antigo só lido.
- **Validação:** contagens antigo × novo.
- **Depende de:** M10, M06.

### M30 — Deploy das edge functions (antiga T13)
- [x] **Status**
- **Objetivo:** publicar as funções no projeto novo com `verify_jwt` de `supabase/config.toml`.
- **Arquivos:** `supabase/functions/**`, `supabase/config.toml`.
- **Critérios de aceite:** project ref conferido (`vejugdspjfgfajdpfiht`); todas publicadas; confirmação explícita do usuário antes do deploy.
- **Validação:** `list_edge_functions`; chamada de teste de uma função.
- **Depende de:** M15, M19.

### M31 — Smoke test e teste de isolamento (antiga T14)
- [x] **Status**
- **Objetivo:** Site URL/Redirect URLs do Auth, roteiro manual e `scripts/multi-empresa/test-isolamento.mjs`.
- **Arquivos:** `scripts/multi-empresa/test-isolamento.mjs` (novo).
- **Critérios de aceite:** todos os critérios de sucesso de `REQUIREMENTS.md` §5 passam.
- **Validação:** `node --env-file=.env scripts/multi-empresa/test-isolamento.mjs`; `get_advisors`; roteiro manual.
- **Depende de:** M30.

### M32 — Atualizar a documentação do projeto
- [x] **Status**
- **Objetivo:** `CLAUDE.md`, `docs/structure.md` e `docs/tech.md` sem schema por empresa; documentar `app_empresa_atual` e as rotas master.
- **Arquivos:** `CLAUDE.md`, `docs/structure.md`, `docs/tech.md`.
- **Critérios de aceite:** nenhuma menção a `emp_<slug>` como modelo vigente.
- **Validação:** releitura.
- **Depende de:** M31.

---

## Tarefas propostas durante a execução

_(vazio)_
