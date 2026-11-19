# PROGRESSO — Multi-empresa

Execução contínua autorizada pelo usuário em 2026-11-17 ("pode executar todas"). Um relatório curto
por tarefa. Banco alvo: `vejugdspjfgfajdpfiht` (o host é conferido antes de cada escrita).

Scripts de apoio em `scripts/multi-empresa/`:
- `db.mjs`: conexão que aborta fora do banco novo.
- `q.mjs`: consulta ad hoc (read-only por padrão).
- `as-user.mjs`: roda SQL como um usuário do app (JWT simulado) ou como anon, sempre com rollback.

## M00 — Documentação ✅
REQUIREMENTS, DESIGN, TASKS e ADR 0003 criados; nota no `docs/TASKS.md`.

## M01 — Usuário master ✅
- O usuário já existia no Auth. Novo `scripts/multi-empresa/vincular-master.mjs` (idempotente; funciona
  antes e depois da M08) grava `super_admins`, `usuario_empresa` (Garbo), `movelaria_usuarios`
  (administrador) e `usuarios`/`user_roles` do CRM (admin).
- Validação: rodado 2×; `me_is_super_admin = true`, 1 vínculo, perfil `administrador`, 1 role admin.
- `scripts/set-admin.mjs` ficou obsoleto (não confere o host); mantido sem uso.

## M02 — Fundação de tenant ✅
- Migrations `20261117100000_multi_empresa_fundacao.sql` + `20261117100100_multi_empresa_resolvedor_fix.sql`.
- `empresas.status` (`ativa|bloqueada|inativa`), `usuario_empresa unique(user_id)`,
  `plataforma_master_contexto`, `app_is_master`, `app_empresa_atual` (INVOKER), `app__minha_empresa_id`,
  `app_set_empresa_ctx` (só roles de sistema), `app_minha_empresa`, `master_definir_empresa_ativa`,
  role `app_tenant_definer` (NOLOGIN, sem BYPASSRLS).
- Descoberta: `postgres` tem BYPASSRLS e é dono de 274 funções definer. Mecanismo detalhado em
  DESIGN §1.1.
- Validação: master → Garbo; troca de empresa ok; anon → null; postgres sem ctx → null; com ctx → Garbo.

## M03 — Gerador ✅
- `scripts/multi-empresa/tenant-config.mjs` (lista global `TENANT_GLOBAL`, coluna de tenant, grupos) e
  `gerar-tenant-migration.mjs` com os modos `tabelas <nucleo|crm|outras>`, `definers` e `unicos [grupo]`.
  Saídas de revisão em `supabase/multi-empresa-gen/`.

## M04 + M05 — Núcleo por empresa ✅
- `20261117110000_multi_empresa_tenant_base.sql`: triggers `app_tenant_fill` / `app_tenant_fill_company`
  (INVOKER; propagam `app.empresa_ctx`), policy `tenant_definer` nas tabelas globais, grants.
- `20261117110100_multi_empresa_tenant_nucleo.sql` (gerado): 60 tabelas `movelaria_*` com `empresa_id`
  NOT NULL + FK + índice + trigger + RESTRICTIVE `tenant_isolamento` + `tenant_definer`. As policies de
  papel continuam; anon e as `true` ficam limitadas à empresa (anon = nada).
- Validação: com o master, fornecedor criado na Garbo some na empresa B e volta ao trocar; o postgres vê
  os dois (bypass).

## M06 — Singletons e unicidades do núcleo ✅
- `20261117110200_multi_empresa_nucleo_ajustes.sql`: PKs/uniques `(empresa_id, …)` em
  `visualizacao_config`, `obra_lousa_text_config`, `simulador_caixa`, `formas_pagamento_pagar(nome)`,
  `kanban_colunas_obra(status_key)`, `ponto_marcacoes(nsr)`.
- `movelaria_ponto_detectar_faltas` filtra pela empresa do contexto; `movelaria_ponto_job_faltas` itera
  as empresas ativas com `app_set_empresa_ctx`.
- Front: `onConflict` → `empresa_id,ano` (`useSimuladorCaixaShared.ts`) e `empresa_id,chave`
  (`useVisualizacaoConfig.ts`). Os triggers BEFORE preenchem `empresa_id` antes da arbitragem do
  ON CONFLICT.
- Singletons com PK `id` (pix_config, recibo_config, rep_config, fin_templates_copia) já ficam
  "um por empresa" pelo RLS.

## M07 — Storage ✅
`20261117120000_multi_empresa_storage.sql`: RESTRICTIVE `tenant_isolamento_storage` (authenticated) pelo dono do
objeto. Teste real: A envia, B não baixa, A baixa.

## M08 — CRM no schema `crm` ✅
- `20261117130000_multi_empresa_crm_rename.sql` (gerado por `gerar-crm-rename.mjs`): rename + 96 funções e 37
  policies reescritas; `scripts/multi-empresa/expose-crm.mjs` trocou `emp_garbo`→`crm` na API.
- `…130100_tenant_crm.sql` (129 tabelas; 62 estavam SEM RLS), `…130200_crm_unicos.sql`,
  `…130300_tenant_outras.sql` (235 tabelas do public), `…130400_outras_unicos.sql`, `…140200_schema_nome.sql`.
- Front: `onConflict` com `empresa_id` em PermissionsTable, useEventoBoard, useMetricasColunaConfig,
  usePipelineLeadAIConfig, useWhiteboardTextConfig.

## M09 — Funções definer isoladas ✅
`…140000_definers.sql`: 215 funções → `app_tenant_definer`; 69 ficaram no `postgres` (helpers de policy,
plataforma, auth/DDL). `…140100`: `app_tenant_definer` membro de `authenticated` (o postgres não tem GRANT
OPTION em `auth`). Smoke: 29 RPCs de leitura OK; na empresa B o master vê 0 identidades.

## M10 — Sem `emp_garbo` ✅
Zero funções do banco com `emp_garbo`; único UUID fixo era `orcamentos_ia_tenant_company_id` (M13).

## M11 — Front do CRM ✅
`empresa-tables.ts` (os dois lados) com `CRM_SCHEMA='crm'`; hardcodes removidos; `EmpresaContext` real.

## M12 — Fluxos públicos ✅
`…150100_funcoes_publicas.sql` (agendamento, formulário de orçamento, busca de leads, anexos — estáticos em
`crm`, empresa gravada explicitamente), `…150200_orcamento_publico.sql` (RPC + página reescrita, polling 30s),
`…150300_agenda_publica.sql` (RPC + `agenda-public-scope.ts`/`useAgenda`/`useAgendaFormFields`).

## M13 — Corte Claude ✅
`…140300`: `orcamentos_ia_tenant_company_id()` → `app_empresa_atual()`.

## M14 — Funções de usuário ✅
SQL (`…150000_funcoes_usuarios.sql`): `app_assert_usuario_gerenciavel`, vínculo automático do usuário novo,
`get_session_metrics` por empresa, legado `me_criar_empresa`/`me_vincular_usuario_empresa` revogados.
Edge: `_shared/tenant.ts`; `create-user-admin` (checa papel!), `delete-user`, `reset-user-password`,
`fix-user-access` (só master), `register-public` (UUID de empresa ativa).

## M15 — Demais edge functions ✅ (com pendências)
`…170000_pre_request.sql` (`x-empresa-id` só para service role — testado via REST). Codemod em 25 funções:
`serviceClient(await empresaDoChamador(req))`. `crm-selletos-receber-webhook` resolve a empresa pelo `webhook_id`.
`deno check`: sem erros novos (restam só os pré-existentes em create-user-admin/delete-user/render-*/compose-markup-ia).

## M16–M18 — Front multi-empresa ✅
`useEmpresaAtiva` + `AppContext` (empresa, isMaster, trocarEmpresa, cache por empresa e limpo no logout),
tela `EmpresaIndisponivel` (sem empresa/bloqueada/inativa), `MasterEmpresaBar` no `MainLayout`.

## M19–M24 — Painel Master ✅
`…160000_plataforma.sql`: `plataforma_seed_empresa` (também aplicado na Garbo), `master_criar_empresa`,
`master_definir_admin_empresa`, `master_atualizar_empresa`, `master_definir_status_empresa`,
`master_resumo_empresas` (faturamento = contas a receber recebidas no período), `master_faturamento_mensal`,
`master_usuarios_empresa`, `master_listar_empresas`. Páginas `/master`, `/master/empresas/:id` com gate inline
e `RoleRedirect`.

## M25–M28 — Financeiro Master ✅
Tabelas `plataforma_formas_pagamento` (seed Pix, Boleto, Cartão, Dinheiro, Cheque, Transferência),
`plataforma_planos`, `plataforma_assinaturas`, `plataforma_cobrancas` (RLS só master); `plataforma_gerar_cobrancas`,
`plataforma_atualizar_inadimplencia` (bloqueia/desbloqueia), `master_dar_baixa_cobranca`; cron
`plataforma_cobrancas_diario` 09:15 UTC. Página `/master/financeiro` (Cobranças, Assinaturas, Planos, Formas).
`scripts/multi-empresa/test-plataforma.sql`: 17/17.

## M29 — Configurações da Garbo ⏳ (aguarda decisão)
Seed padrão aplicado (formas de pagamento, colunas do kanban de obras, painéis, pastas, colunas de marketing,
etapas de produção/projetos). Copiar mais configurações do banco antigo depende de você escolher quais.

## M30 — Deploy das edge functions ✅
Confirmado pelo usuário em 2026-11-17. `node --env-file=.env scripts/multi-empresa/deploy-functions.mjs` publicou as
36 funções no projeto `vejugdspjfgfajdpfiht`. Smoke em produção: `register-public` recusa empresa inválida,
`create-user-admin` recusa chamada sem usuário, `crm-selletos-receber-webhook` recusa sem `webhook_id`.

## M31 — Smoke e isolamento ✅
`scripts/multi-empresa/test-isolamento.mjs` (API real): 19/19. Achou e corrigiu o histórico de transações em
cascade (`…170100`). Advisors: `…170200` (views definer filtradas, RLS em 2 tabelas, matviews legadas fora da API).

## M32 — Documentação ✅
CLAUDE.md, docs/structure.md, docs/tech.md, DESIGN §1.1 e §9.

## Fase I — Console master isolado e páginas por marcenaria ✅ (M40–M50)
- M41: `src/lib/paginas-catalogo.ts` (45 páginas, derivadas do menu) + `paginas-bloqueio.ts`; `check-catalogo.mjs`: toda rota autenticada cai numa página.
- M42/M43: migrations `20261118100000` (páginas), `…100100` (inspeção, 1275 policies `tenant_master_leitura_*`, guarda em 8 funções do postgres, master sem inspeção = sem empresa), `…100200` (`master_definir_admin_empresa` entra em modo escrita sem registrar acesso), `…100300` (cobranças sem anon — achado dos advisors).
- M44: menu, busca, `RoleRedirect`, `crmPage`, telas cheias, tela inicial (`homeLiberada`) e atalhos flutuantes respeitam as páginas.
- M45: `motivoRecusa` em `orcamentos-ia-pipeline`, `compose-markup-ia`, `compose-contrato-ia` (publicadas). `empresaDoChamador`/`requireCallerTenant` recusam inspeção somente leitura — **só valem nas funções republicadas** (as outras 33 ainda têm o `_shared/tenant.ts` anterior).
- M46–M49: console em `src/master/` (Visão geral, Marcenarias, detalhe com abas, Mensalidades, Planos e páginas, Entradas), `PaginasEditor`, `EntrarEmpresaDialog`, faixa de inspeção âmbar/tijolo, aviso de somente leitura via `supabase.ts`.
- M50: `test-plataforma.sql` 30 casos (T18–T30 novos) e `test-isolamento.mjs` 23/23 (seção 5 nova); `pnpm build` ok.

- M57: funções por plano — `orcamentosIa` e `whatsappCrm` (novo, grupo "Funções do CRM") escondem seção/índice/busca/botões no lead; recusa nas edge functions `orcamentos-ia-chat|memory` e `send-whatsapp-message|get-lead-whatsapp-history` (**falta deploy**).

- M58: IA no card lead (função `iaCardLead`, motor global, cota de tokens, fim da Análise visual) — código pronto; **falta `pnpm migrate` (3 migrations 20261120…) e deploy das edges**; T22–T24 e `/reparo-visual` pendentes. Ver `docs/ia-lead/TASKS.md`.

## Pendências (propostas)
- Republicar as demais edge functions para a recusa de inspeção somente leitura valer nelas.
- Teste manual do console no navegador (login do master).
- Edge functions sem ajuste por não serem usadas pelo front: `agenda-public-booking`, `agenda-public-upload`,
  `receber-whatsapp`, `migrate-leads-regiao`; ProForço: `cadastro-alunos`. Insert sem empresa falha (não vaza).
- Funções de admissão pública (`movelaria_admissao_publica_*`) e página `AgendamentoPublicoGarbo` não são usadas;
  se forem reativadas, precisam de contexto de empresa pelo token.
- Numeração por sequence (contratos, orçamentos) é global, não por empresa.
- Advisors WARN pré-existentes: 88 funções sem `search_path` fixo, execução de definer por anon.
- Teste manual no navegador: login, troca de empresa pelo master, criar empresa, tela de bloqueio.
- Tabelas legado ProForço/`CRM-Selletos` podem ser removidas numa limpeza futura.
