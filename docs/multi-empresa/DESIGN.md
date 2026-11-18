# DESIGN — GARBO Movelaria multi-empresas

> O como. O porquê está em [`REQUIREMENTS.md`](./REQUIREMENTS.md); a ordem de execução, em [`TASKS.md`](./TASKS.md).
> ADR: [`docs/decisions/0003-multi-tenant-por-empresa-id.md`](../decisions/0003-multi-tenant-por-empresa-id.md).

## Visão geral

Isolamento por linha: toda tabela de tenant ganha `empresa_id`, e toda policy de RLS filtra por
`empresa_id = app_empresa_atual()`. O schema `emp_garbo` deixa de ser "o schema da Garbo" e vira o
schema compartilhado `crm`. As tabelas de plataforma (`empresas`, `usuario_empresa`, `super_admins`,
`plataforma_*`) ficam em `public`, e só o master as administra.

```
auth.uid() ──► usuario_empresa ──► empresa_id ─┐
                                               ├─► app_empresa_atual() ──► RLS (empresa_id = …)
master ──► plataforma_master_contexto ─────────┘        (NULL se empresa bloqueada/inativa)
```

## 1. Resolvedor de empresa (peça central)

- **`public.app_empresa_atual() returns uuid`** (SQL, `STABLE`, `SECURITY DEFINER`, `search_path` fixo):
  - usuário comum: `empresa_id` vindo de `usuario_empresa`;
  - master: a empresa escolhida em `public.plataforma_master_contexto(user_id pk, empresa_id)`,
    gravada pela RPC `master_definir_empresa_ativa(p_empresa_id)`;
  - **devolve `NULL` se a empresa estiver bloqueada ou inativa** (bloqueio de verdade, aplicado pelo
    RLS). O master nunca é bloqueado.
- **`public.app_is_master() returns boolean`**: wrapper de `me_is_super_admin(auth.uid())`.
- **`public.app_minha_empresa()`**: devolve id, nome, slug, status e logo da empresa ativa (usada pelo `EmpresaContext`).
- `empresas` ganha a coluna `status` (`ativa | bloqueada | inativa`); `usuario_empresa` passa a ter
  `unique(user_id)` (uma empresa por usuário).
- Toda policy de tenant segue o padrão `empresa_id = app_empresa_atual()`, somado à regra de papel que já existe.
- Toda tabela de tenant recebe
  `empresa_id uuid not null default app_empresa_atual() references empresas(id)` e um índice em
  `empresa_id`. O front não precisa enviar `empresa_id` nos inserts.

### 1.1 Mecanismo de isolamento (detalhado na execução, M02–M05)

Descobertas que mudaram o "como" (o "o quê" continua o mesmo):

- O role `postgres` tem **BYPASSRLS**, e existem **274 funções `SECURITY DEFINER`** donas dele. Só
  colocar `empresa_id` nas policies não isolaria nada que passe por essas funções.
- Além de `movelaria_*` e `emp_garbo`, o app grava direto em tabelas master do `public`
  (`crm_multiempresas_agenda_pessoal_tarefas`, `_chat_mensagens`, `_atalhos`, `marketing_*`, `mkt_*`...).

Por isso o isolamento é feito em quatro peças, aplicadas de forma mecânica a **todas as tabelas de
`public` e `crm`**, exceto uma lista global explícita (`TENANT_GLOBAL` em
`scripts/multi-empresa/tenant-config.mjs`: `empresas`, `usuario_empresa`, `super_admins`, `plataforma_*`,
`movelaria_schema_migrations`, `market_reference_prices`, `public.user_roles` e as tabelas do produto
ProForço):

1. **Coluna de tenant**: `empresa_id uuid not null references empresas(id) on delete cascade` + índice.
   As tabelas do Corte Claude que já têm `company_id` usam `company_id` como coluna de tenant.
2. **Trigger `aaa_tenant_fill`** (BEFORE INSERT; o nome com `aaa` faz rodar antes dos outros):
   preenche a coluna com `app_empresa_atual()` quando vier nula; se continuar nula, aborta. Depois grava
   a empresa no GUC transacional `app.empresa_ctx`, para que inserts em cascata feitos por triggers
   herdem a mesma empresa.
3. **Policy RESTRICTIVE `tenant_isolamento`** (`for all to public`):
   `empresa_id = (select app_empresa_atual())`. É combinada em AND com as policies de papel que já
   existem. Com isso as policies abertas a `anon` e as `USING (true)` deixam de vazar entre empresas.
4. **Role `app_tenant_definer`** (NOLOGIN, **sem** BYPASSRLS): passa a ser dona das funções
   `SECURITY DEFINER` "comuns". Elas continuam ignorando as policies de papel (há uma policy permissiva
   `to app_tenant_definer using (true)`), mas **respeitam a restritiva de tenant**. Assim as ~240
   funções ficam isoladas sem reescrever a lógica de cada uma. Ficam com o `postgres`:
   - os helpers usados dentro de policies (`movelaria_meu_perfil`, `me_is_*`, `has_role`...), porque
     são indexados por `auth.uid()` e evitam recursão de RLS;
   - as funções que tocam `auth.*`, `storage.*`, `cron`/`net` ou fazem DDL/SQL dinâmico. Essas foram
     revisadas uma a uma e ganharam checagem explícita de empresa.

`app_empresa_atual()`, em ordem:
1. usuário autenticado comum → empresa de `usuario_empresa`, só se estiver `ativa`;
2. master → empresa de `plataforma_master_contexto` (ou a própria, se não escolheu);
3. sem `auth.uid()` **e** `current_user` fora de `anon`/`authenticated` (cron, service role, funções
   definer chamadas por páginas públicas) → `current_setting('app.empresa_ctx')`.

`anon` e `authenticated` nunca conseguem forçar o GUC.

## 2. CRM: `emp_garbo` vira um schema compartilhado `crm`

- `ALTER SCHEMA emp_garbo RENAME TO crm`, expor `crm` na API uma vez
  (`scripts/baseline/expose-schemas.mjs`) e adicionar `empresa_id` às 129 tabelas.
- Por que assim: o front do CRM já passa por `useEmpresaSupabase()` → `supabase.schema(schemaEmpresa)`
  (`src/hooks/useEmpresaSupabase.ts:14`). Basta `schemaEmpresa` passar a valer `'crm'` para que todo
  o CRM funcione sem renomear tabelas uma a uma.
- Unicidades e PKs "por instalação" viram compostas com `empresa_id`. Exemplos: config de agenda,
  funil, numeração de contratos e orçamentos.
- Policies `USING (true)` passam a filtrar por empresa. As que usam `me_get_empresa_role('emp_garbo', …)`
  passam a ler `crm.user_roles` filtrado por `empresa_id`.
- As ~90 funções com `'emp_garbo'` são reescritas para `crm.*` mais filtro de empresa. O SQL dinâmico por schema sai.
- Tabelas master legadas `"CRM-multi-empresas>X<"` / `crm_multiempresas_*` e o fallback dos resolvers
  saem do caminho. Só ficam como tabelas de plataforma: `empresas`, `usuario_empresa`, `super_admins`.
- Links públicos `/orcamento/:schema/:id` passam a aceitar o **slug da empresa**, com a rota antiga
  preservada por compatibilidade. Afeta `src/lib/agenda-public-scope.ts` e `OrcamentoPublicoPage.tsx`.

## 3. Núcleo `movelaria_*`

- Migration gerada por script a partir do catálogo, para as 61 tabelas, menos `movelaria_schema_migrations`:
  - adicionar `empresa_id`;
  - recriar cada policy com `AND empresa_id = app_empresa_atual()`;
  - remover o acesso `anon` e os `true/true`.
- `movelaria_usuarios` ganha `empresa_id`. `movelaria_meu_perfil()` e demais helpers continuam
  iguais, porque o filtro vem pela policy.
- Singletons ganham PK `(empresa_id, chave)`: `visualizacao_config`, `obra_lousa_text_config`,
  `simulador_caixa` (`ano`), `pix_config`, `recibo_config`, `recibo_prestador_config`, `rep_config`,
  `fin_templates_copia`.
- Storage:
  - paths prefixados com `${empresaId}/…` nos helpers de `src/lib/*-anexos.ts`, `obra-arquivos.ts`,
    `briefing-storage.ts`, `escritorio-arquivos.ts`, `funcionario-documentos.ts`;
  - policies com `(storage.foldername(name))[1]::uuid = app_empresa_atual()`.
- Corte Claude: `orcamentos_ia_tenant_company_id()` passa a chamar `app_empresa_atual()`. As tabelas
  com `company_id` ganham policy por empresa.

## 4. Edge functions

- **`_shared/tenant.ts`** (novo): a partir do JWT de quem chama, devolve
  `{ userId, empresaId, isMaster, papel }`. Remove `empresaId`/`schemaNome` vindos do body.
- **`create-user-admin`:** passa a exigir admin da empresa ou master e grava na empresa de quem chama,
  ou na empresa indicada quando o chamador é o master.
- **`register-public`:** resolve a empresa pelo slug.
- **`delete-user`, `reset-user-password`, `fix-user-access`:** conferem que o alvo é da mesma empresa.
- Pares `src/lib/empresa-tables.ts` ↔ `supabase/functions/_shared/empresa-tables.ts`: os dois lados
  são atualizados juntos.
- Nova função **`master-criar-empresa`** (só o master): cria a empresa, cria o usuário admin (e-mail e
  senha), vincula em `usuario_empresa`, define o papel Administrador no núcleo e admin no CRM, e roda
  o seed da empresa: funil, agenda, formas de pagamento a pagar, configs singleton. Esse seed fica numa
  RPC SQL `plataforma_seed_empresa(p_empresa_id)`, que substitui o `me_criar_empresa`, hoje desatualizado.

## 5. Front

- **`EmpresaContext` real:**
  - carrega a empresa do usuário via RPC `app_minha_empresa()`;
  - para o master, `trocarEmpresa` chama `master_definir_empresa_ativa` e invalida o TanStack Query
    (inclusive o cache persistido; as query keys de `main.tsx` passam a incluir `empresaId`);
  - `isSuperAdmin` vem de `app_is_master()`, com novo nome **`isMaster`**, para não confundir com
    `AuthContext.isSuperAdmin` (`src/contexts/AuthContext.tsx:55`, que quer dizer "admin da empresa").
- **Identidade:** `movelaria_obter_minha_identidade` lê `crm.*` filtrado pela empresa e devolve também
  `empresa_id`, `empresa_nome`, `is_master` e `empresa_status`.
- **Gate:** `evaluateIdentityGate` ganha o estado "empresa bloqueada", com uma tela de acesso suspenso
  e contato. O master passa direto.
- **Seletor de empresa** no header, visível só para o master, com um banner "Você está vendo: <Empresa>".
- Rotas novas `lazy()`, com gate `isMaster` inline em `src/App.tsx`:
  - `/master` (dashboard);
  - `/master/empresas` e `/master/empresas/:id`;
  - `/master/financeiro`.
- Item de menu com a flag `masterOnly` em `NavVisibilityContext` (`src/lib/app-navigation.ts:132-169`),
  mais os mapas de path e o `RoleRedirect`.
- Reaproveitar: `GerenciamentoEmpresas.tsx` (base da lista e criação), `DashboardCardShell`/
  `DashboardKpiCard`, os primitivos de `src/components/ui` (table, tabs, dialog, badge, `Modal`,
  `FilterBar`, `PeriodFilterBar`, `EmptyState`) e os gráficos de `src/components/ui/chart`.
- Remover os hardcodes de `emp_garbo`/Garbo:
  - `useCrmComunicacao.ts`, `useMarkupCustosPorLeads.ts`, `crm-orcamento-slides.ts`,
    `funcionario-usuario-busca.ts`, `OrcamentoPublicoPage.tsx`, `types/index.ts`;
  - a apresentação da Garbo vira conteúdo por empresa, ou fica atrás de `empresa.slug === 'garbo'`.
- UI segue as convenções do projeto: Tailwind, ícones `lucide-react`, primitivos shadcn/Radix de `src/components/ui`.

## 6. Painel Master

- **RPC `master_resumo_empresas(p_inicio date, p_fim date)`**: `SECURITY DEFINER`, aborta se não for
  master. Devolve por empresa:
  - nome, status e plano;
  - admin(s) (nome e e-mail);
  - nº de usuários (`usuario_empresa`);
  - **faturamento**: soma de `movelaria_contas_receber.valor_parcela` com `status='recebido'` por
    `data_recebimento` no período. É o mesmo critério de `useGraficoReceitasMensal` em
    `src/hooks/useFinanceiroDashboard.ts:252`;
  - situação da mensalidade (em dia, vencida, bloqueada).
- **Dashboard:**
  - KPIs: empresas ativas e bloqueadas, total de usuários, faturamento somado, MRR (soma das
    mensalidades ativas) e inadimplência;
  - tabela de empresas com busca;
  - gráfico de faturamento mensal por empresa.
- **Detalhe da empresa:** dados cadastrais (CNPJ, razão social, logo, cor), admin (trocar e resetar
  senha), usuários, histórico de cobranças, ações (ativar, bloquear, liberar, "entrar na empresa").

## 7. Financeiro Master (tabelas `plataforma_*` em `public`, acesso só master)

- `plataforma_formas_pagamento` (id, nome, ordem, ativo): seed Pix, Boleto, Cheque, Dinheiro, Cartão,
  cadastrável no padrão de `movelaria_formas_pagamento_pagar`
  (`supabase/migrations/005_formas_pagamento_pagar.sql`, UI `ContasPagarConfigModal.tsx`).
- `plataforma_planos` (nome, valor_mensal, ativo).
- `plataforma_assinaturas` (empresa_id unique, plano_id, valor, dia_vencimento, dias_tolerancia
  default 10, status `ativa|suspensa|cancelada`, liberado_ate).
- `plataforma_cobrancas` (empresa_id, competencia `date`, valor, vencimento, status
  `pendente|paga|vencida|cancelada`, pago_em, forma_pagamento_id, valor_pago, observacao;
  unique `(empresa_id, competencia)`).
- `pg_cron`, rodando diariamente (o projeto já usa cron: `movelaria_ponto_faltas_diario`):
  - `plataforma_gerar_cobrancas()`: cria a cobrança da competência atual;
  - `plataforma_atualizar_inadimplencia()`: marca as vencidas e põe `empresas.status='bloqueada'`
    quando o atraso passa de `dias_tolerancia` e `liberado_ate` já passou. Ao dar baixa, a empresa é
    desbloqueada na hora.
- **UI `/master/financeiro`:**
  - abas Cobranças (filtros por período, status e empresa; botão "Dar baixa" com forma de pagamento,
    data e valor), Assinaturas, Planos e Formas de pagamento;
  - KPIs: a receber no mês, recebido, vencido, MRR.

## 8. Regras de execução

- **Banco alvo:** o novo, `vejugdspjfgfajdpfiht`. Antes de qualquer escrita (`pnpm migrate`, `psql`,
  scripts com `DATABASE_URL` ou service role), conferir que o host contém `vejugdspjfgfajdpfiht`.
  O banco antigo (`zzqgtclvuetemzhqzhbq`) é só leitura e não é tocado por este plano.
- **Migrations:** arquivos novos em `supabase/migrations/` com prefixo numérico de **14 dígitos maior
  que `20261022140000`** (ex.: `20261117120000_multi_empresa_resolvedor.sql`), porque
  `scripts/migrate.mjs` ordena pelo número. Migration aplicada nunca é editada: correção vira arquivo novo.
- **Validação automática:** `pnpm build` (typecheck + build) é o único guardrail; roda a cada tarefa
  que toca código.
- **Validação de SQL:** `pnpm migrate` contra o banco novo + consultas de verificação via `psql` ou
  MCP Supabase; `get_advisors` (security) sem erros novos.
- **Validação de UI:** roteiro manual no app (`pnpm dev`, porta 3000).
- **Pares duplicados:** Deno não importa de `src/`. Ao mudar `src/lib/X.ts`, mudar também
  `supabase/functions/_shared/X.ts` (em especial `empresa-tables.ts`), e vice-versa.
- **Edge functions:** deploy só com confirmação explícita do usuário (M30).
- **Git:** sem commit ou push sem pedido. Branch sugerida: `feat/multi-empresa`, a partir de
  `feat/baseline-novo-banco`.
- **Segredos:** valores do `.env` nunca são impressos; senhas vêm só de variável de ambiente.

## 9. Desvios do plano decididos na execução

| Plano | O que foi feito | Por quê |
|---|---|---|
| Prefixar caminhos do Storage com `${empresaId}/` | RESTRICTIVE em `storage.objects` pelo **dono do objeto** (`owner_id` → `usuario_empresa`); objetos do master valem em qualquer empresa | Eram ~30 pontos de upload e edge functions gravando caminhos; mudar todos era frágil |
| Edge function `master-criar-empresa` | RPC SQL `master_criar_empresa` (+ `master_definir_admin_empresa`) | Mesmo padrão de `movelaria_criar_usuario`; não depende de deploy |
| Reescrever ~90 funções com filtro de empresa | Troca de texto `emp_garbo`→`crm` + funções definer passam ao role `app_tenant_definer` | O isolamento vem da RLS; só as funções que ficaram no `postgres` ganharam filtro explícito |
| Item `masterOnly` no menu lateral | Faixa fixa do master (`MasterEmpresaBar`) com seletor e link "Painel Master" em todas as telas | O menu depende do sistema de seções por papel da empresa; a faixa cobre o acesso |
| `empresa_id` nos inserts das edge functions | Header `x-empresa-id` + `app_pre_request` (só service role) + trigger | Uma linha por função em vez de mexer em cada insert |
| Página pública do orçamento e agenda pública lendo tabelas como anon | RPCs `orcamento_publico_obter` e `agenda_publica_dados` | anon não tem empresa; a RPC resolve pela própria entidade |
| Views SECURITY DEFINER | Mantidas (mascaram chaves), mas com filtro `= app_empresa_atual()` | Advisors de segurança; preserva o comportamento |

## 10. Fase I: Console Master isolado e páginas por marcenaria

Requisitos em `REQUIREMENTS.md` §6. ADR: [`0004`](../decisions/0004-console-master-e-paginas-por-empresa.md).

### 10.1 Catálogo de páginas (`src/lib/paginas-catalogo.ts`)
- É derivado de `NAV_MAIN_ITEMS` (`src/lib/app-navigation.ts`). Cada folha do menu vira
  `{ id, titulo, url, grupo, bloqueavel }`, com os ids que o menu já usa (`leads`, `pipeline`,
  `contratosCrm`, `orcamentosIa`, `caixa`, `agendaObras`…). Página nova no menu entra no catálogo sozinha.
- `paginaIdFromPath(pathname)` liga as sub-rotas ao id da página-mãe (`/contratos/:id` → `contratosCrm`).
- `paginaLiberada(pathOrId, bloqueadas)` é o único teste usado no menu, na busca, no `RoleRedirect`,
  no `crmPage`, na tela inicial e nos atalhos flutuantes.
- Não bloqueáveis: Meu Perfil, `/profile` e Configurações. Assim nenhuma empresa fica sem tela inicial.

### 10.2 Dados
- **Lista do que fica bloqueado:** página nova nasce liberada.
  - `plataforma_planos.paginas_bloqueadas text[]`;
  - `plataforma_empresa_paginas (empresa_id, pagina_id, habilitada)` guarda os ajustes da empresa
    nos dois sentidos.
- `app_paginas_bloqueadas(empresa)` = (plano ∪ ajustes `false`) − ajustes `true`.
- `app_minha_empresa()` passa a devolver `paginas_bloqueadas`, `em_inspecao` e `inspecao_somente_leitura`.

### 10.3 Inspeção
- `plataforma_master_contexto.somente_leitura` é gravado por
  `master_definir_empresa_ativa(empresa, somente_leitura)`. `master_sair_empresa()` limpa o contexto.
- Policy RESTRICTIVE `tenant_master_leitura` em insert/update/delete de toda tabela de tenant:
  `not app_master_somente_leitura()`.
  - Funções `app_tenant_definer` ficam cobertas pela RLS.
  - Funções do `postgres` que gravam ganham guarda explícita.
  - O Storage ganha a mesma condição.
- `plataforma_master_acessos (empresa_id, modo, inicio, fim)` registra cada entrada.

### 10.4 Console (`src/master/`)
- `AppRoutes` renderiza `<MasterApp/>` (lazy) **antes** do `AuthenticatedApp` quando o master está
  em `/master*`. O master sem inspeção ativa é mandado para `/master`.
- `MasterLayout` tem menu próprio: Visão geral, Empresas, Financeiro, Planos e páginas, Acessos.
- Rotas: `/master`, `/master/empresas`, `/master/empresas/:id` (abas Visão geral, Páginas, Usuários,
  Cobranças, Acessos), `/master/financeiro`, `/master/planos`.
- `PaginasEditor` é usado no plano e na empresa: árvore por grupo, switches, busca e contador.
  Na empresa, mostra a origem de cada página (do plano ou ajuste).
- **Faixa de inspeção** (substitui o seletor da `MasterEmpresaBar`): âmbar em leitura, vermelho em
  acesso total. Em modo leitura, um erro de RLS vira toast "Modo somente leitura".

### 10.5 Visual
- O console é **outro ambiente**: base grafite fria com um acento latão, números tabulares/mono e
  tabelas densas. Status por texto e forma, não só por cor.
- Tokens isolados em `src/master/master-tokens.ts`. Só Tailwind, `lucide-react` e `src/components/ui`.

## 11. Fase J: CRM pré-configurado

### 11.1 Seed do CRM
- `public.crm_seed_pipeline_padrao(p_empresa)` (migration `20261118110000_crm_pipeline_padrao.sql`),
  idempotente: etapas em `crm.pipeline_custom_stages` só se a empresa não tiver nenhuma; cada kanban
  em `crm.kanban_pages` com `on conflict (empresa_id, slug) do nothing`, e colunas/fontes só quando a
  página acabou de ser criada. Slugs estáveis: `orcamentos`, `prospeccao`, `manutencao`.
- Chamada por `plataforma_seed_empresa` (empresa nova) e por um backfill na própria migration.
- Os nomes das etapas são exatos: o front (`PIPELINE_STATUS_ENVIOU_ORCAMENTO`) e a migration 203
  dependem do texto.

### 11.2 Kanbans no catálogo
- `src/lib/kanbans-padrao.ts` é o par da migration (mesmos slugs e nomes).
- `paginas-catalogo.ts` inclui `pipelineKanban:<slug>` (url `/pipeline/<slug>`, subgrupo Pipeline).
  Kanban criado pelo admin continua sendo parte da página `pipeline`.
- `attachPipelineKanbanPages` filtra cada kanban pelo próprio id; bloquear `pipeline` esconde só o
  Kanban principal (e os kanbans do admin, que não têm id próprio).

### 11.3 Console
- `Planos` mostra quantas marcenarias usam cada plano e avisa quando nenhuma usa.
- Aba Páginas da empresa avisa quando ela não tem plano.
