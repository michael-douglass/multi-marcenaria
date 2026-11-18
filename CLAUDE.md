# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## O que é

**GARBO Movelaria** — sistema interno de uma marcenaria. SPA Vite + React 18 + TypeScript com backend Supabase (Postgres, Auth, Storage, Edge Functions em Deno), publicada na Netlify como PWA. A UI, os comentários e os docs são em pt-BR.

O `README.md` e os arquivos versionados no git (`.claude/`, `.claude-plugin/`, `.mcp.json`) são do *Claude Code Starter Pack* copiado para a raiz — **não descrevem o app**. O código do app (`src/`, `supabase/`, `scripts/`, `docs/`) ainda está fora do git. A documentação real fica em `docs/` — comece por `docs/product.md`, `docs/tech.md`, `docs/structure.md` e `docs/glossary.md`.

## Comandos

```bash
pnpm install
pnpm dev        # Vite em http://localhost:3000 (strictPort — falha se a porta estiver ocupada)
pnpm build      # tsc && vite build — único guardrail automático de correção
pnpm preview    # serve o build na porta 3000
pnpm migrate    # aplica supabase/migrations/*.sql pendentes (usa DATABASE_URL do .env local)
```

- Gerenciador: **pnpm 10** (fixado em `packageManager`), Node ≥ 20.
- **Não existe script de lint nem test runner.** `pnpm build` (typecheck) é o teto da verificação automática; o resto é verificação manual na aplicação.
- Os `scripts/test-*.mjs` e `scripts/smoke-*.mjs` são verificações ad-hoc, rodadas uma a uma. Os que só usam Node rodam com `node scripts/<arquivo>.mjs`; os que importam `.ts` de `src/` pedem `pnpm exec tsx scripts/<arquivo>.mjs` (o cabeçalho de cada arquivo diz o uso). `tsx` não está no `package.json`.
- Scripts que tocam o banco usam `node --env-file=.env scripts/<arquivo>.mjs`.
- ESLint e Prettier não estão instalados no projeto, mas o hook `.claude/hooks/post-edit-format.sh` chama `pnpm eslint --fix` após cada edição de JS/TS — um "eslint falhou" vindo do hook é ausência da ferramenta, não erro no código.

## Arquitetura

### Dois apps fundidos numa casca só

O código é a fusão de dois produtos que compartilham login e roteamento, mas têm estado, permissões e convenções de nome **independentes**. Antes de reaproveitar um nome, confirme em qual lado você está:

| | Núcleo "Movelaria" (financeiro, obras, ponto) | CRM "Selletos" (leads, pipeline, contratos, markup, orçamentos) |
|---|---|---|
| Contextos | `src/context/` (singular) | `src/contexts/` (plural) |
| `useApp()` | `@/context/AppContext` (sessão, papéis, perfil) | `@/contexts/AppContext` (UI do CRM — é outro hook) |
| Papéis | `UserRole` — gate `canAccessSection` em `src/lib/role-access.ts` | `CrmRole` — gate `canAccessCrmPath` em `src/lib/crm-identity.ts` |
| Carregamento | páginas eager | páginas `lazy()` (o bundle já passa de 5 MB) |
| Providers | `AppProvider` em `main.tsx`; `ObrasProvider`, `OptionalFinanceDataProvider` | `CrmSelletosProviders` (pilha Empresa → Auth → … ) |

Um mesmo usuário pode ter papéis nos dois lados.

### Roteamento (`src/App.tsx`)

- Rotas públicas (sem sessão) ficam direto em `App()`: `/orcamento/:schema/:id`, `/agendar/:slug`, `/cadastro/:tipo` etc.
- Todo o resto cai em `AppRoutes` → gate de identidade (`evaluateIdentityGate`: horário de acesso, portal de prestador) → `AuthenticatedRoutes`.
- O acesso é decidido **inline, por rota**, sem wrapper genérico: `canAccessSection(roles, …)` / helpers de `obra-permissions` no núcleo, `crmPage(path, element)` no CRM. Rota nova do CRM precisa entrar em `CRM_APP_PATHS` (`crm-identity.ts`) e ser `lazy()`.
- `RoleRedirect` reforça o gate a cada navegação e guarda a última rota para o PWA retomar (`/?src=pwa`).

### Dados e multi-tenant

- Cliente Supabase único em `src/lib/supabase.ts` — importe sempre de `@/lib/supabase` (`src/integrations/supabase/client.ts` só reexporta). Ele tem timeouts por tipo de chamada: REST 20s, storage 120s, **edge functions 180s**.
- **Multi-empresa (SaaS de marcenarias)** — isolamento por `empresa_id` + RLS, não por schema. Detalhes em `docs/multi-empresa/DESIGN.md` (§1.1) e ADR `docs/decisions/0003-multi-tenant-por-empresa-id.md`.
  - O CRM vive no schema compartilhado **`crm`** (o antigo `emp_garbo`); o núcleo em `public.movelaria_*`. Toda tabela de dados tem `empresa_id` (Corte Claude: `company_id`), trigger `aaa_tenant_fill` e policy RESTRICTIVE `tenant_isolamento` (`empresa_id = app_empresa_atual()`). **Não envie `empresa_id` do front**: o trigger preenche.
  - `public.app_empresa_atual()` decide a empresa: usuário → `usuario_empresa` (só se a empresa estiver `ativa`); master → `plataforma_master_contexto`; sistema (cron/service role/funções públicas) → GUC `app.empresa_ctx`.
  - Funções `SECURITY DEFINER` comuns pertencem ao role `app_tenant_definer` (sem BYPASSRLS) e já ficam isoladas. Função nova que precisa do `postgres` (toca `auth.*`/`storage`/DDL) precisa filtrar a empresa à mão.
  - Unicidades "de negócio" e `onConflict` incluem `empresa_id` (ex.: `onConflict: 'empresa_id,chave'`).
  - Ainda resolva tabelas do CRM com `useEmpresaSupabase` / `useEmpresaTable` / `src/lib/empresa-tables.ts` (`CRM_SCHEMA = 'crm'`). As tabelas `CRM-multi-empresas>X<`/`crm_multiempresas_*` são legado (só `empresas`, `usuario_empresa` e `super_admins` são da plataforma).
  - Empresa ativa no front: `useApp()` do núcleo expõe `empresa`, `isMaster` e `trocarEmpresa` (`src/hooks/useEmpresaAtiva.ts`); o `EmpresaContext` do CRM lê dali. O cache persistido é descartado ao trocar de empresa/sair.
  - Usuário master (`super_admins`): **console isolado** em `src/master/` (`/master`, `/master/empresas[/:id]`, `/master/financeiro`, `/master/planos`, `/master/acessos`), renderizado por `AppRoutes` fora do `AuthenticatedApp` (sem providers/layout da marcenaria; tema próprio via classe `master-shell` no `<html>`). Fora de inspeção o master **não tem empresa** (`app_empresa_atual()` = NULL) e é mandado para `/master`. Empresa com mensalidade vencida além da tolerância é bloqueada pelo job `plataforma_cobrancas_diario`. ADR 0004.
  - Inspeção: `master_definir_empresa_ativa(empresa, somente_leitura)` / `master_sair_empresa()`; registro em `plataforma_master_acessos`. Em somente leitura, policies RESTRICTIVE `tenant_master_leitura_*` recusam escrita em toda tabela de tenant e no storage. **Tabela de tenant nova precisa dessas policies**; função nova do `postgres` que grava dados de empresa chama `app_assert_escrita_permitida()`. Nas edge functions, `empresaDoChamador`/`requireCallerTenant` recusam o modo leitura.
  - Páginas por empresa: catálogo em `src/lib/paginas-catalogo.ts` (derivado do menu; rota fora do menu precisa entrar em `ROTAS_EXTRAS`); bloqueio = plano (`plataforma_planos.paginas_bloqueadas`) + ajustes (`plataforma_empresa_paginas`), entregue em `app_minha_empresa().paginas_bloqueadas`. Aplicado no menu, `RoleRedirect`, `crmPage`, tela inicial, atalhos flutuantes e (via `motivoRecusa`) nas edge functions de IA. Bloqueio só vale para empresa **ligada ao plano** (`plataforma_assinaturas`). Conferência: `npx tsx --tsconfig tsconfig.app.json scripts/multi-empresa/check-catalogo.mjs` e `.../check-paginas-visiveis.mjs` (menu/busca/URL/tela inicial).
  - CRM pré-configurado: `crm_seed_pipeline_padrao` (chamada por `plataforma_seed_empresa`) cria as 6 etapas do Pipeline e os kanbans `orcamentos`/`prospeccao`/`manutencao`; par no front em `src/lib/kanbans-padrao.ts`. Cada kanban padrão é página própria no catálogo (`pipelineKanban:<slug>`); kanban criado pelo admin faz parte de `pipeline`.
  - Testes: `node --env-file=.env scripts/multi-empresa/test-isolamento.mjs` (API real, cria e apaga 2 empresas) e `scripts/multi-empresa/test-plataforma.sql` (via `q.mjs --write -f`, sempre rollback).
- Estado de servidor do CRM via TanStack Query com persistência em `localStorage`; só as query keys listadas em `main.tsx` (`shouldDehydrateQuery`) são persistidas.
- Service worker desligado em dev e **não intercepta `supabase.co`** (quebra o login no celular) — não adicione runtime caching para o Supabase.

### Migrations

- Arquivos numerados em `supabase/migrations/`, aplicados em ordem do prefixo numérico por `scripts/migrate.mjs` (tabela de controle `movelaria_schema_migrations`), cada um em transação.
- **Nunca edite uma migration já aplicada** — crie um arquivo novo com o próximo número.
- O script ordena pelo número do prefixo: migration nova usa **timestamp de 14 dígitos** maior que o último (hoje `20261117170200_…`); um prefixo de 3 dígitos rodaria antes de todas as datadas.
- A Netlify não roda migrations; `pnpm migrate` é manual, da máquina local.

### Edge Functions (`supabase/functions/`)

- Deno não importa de `src/`. Lógica compartilhada existe em **pares duplicados** `src/lib/X.ts` ↔ `supabase/functions/_shared/X.ts` (`markup-motor-calculo`, `markup-match`, `markup-cortecloud`, `markup-ia-*`, `empresa-tables`…). Não há sync automático: ao mudar um lado, mude o outro.
- **Multi-empresa:** use `_shared/tenant.ts`. `serviceClient(await empresaDoChamador(req))` cria o cliente service role com o header `x-empresa-id` (o PostgREST, via `app_pre_request`, vira o contexto da empresa e os inserts recebem `empresa_id`). Service role ignora RLS nas leituras: filtre por `empresa_id`. Funções de usuário usam `requireCallerTenant` + `assertCallerIsEmpresaAdmin` + `assertUsuarioDaEmpresa`.
- Chaves de IA (OpenAI/Anthropic) **não** são secrets de Edge Function nem variáveis da Netlify: são cadastradas no app em `/configuracoes-ia` e lidas do banco pelas funções.

### Orçamento com IA — dois pipelines distintos

1. **Markup "Compor com IA"** — `supabase/functions/compose-markup-ia/index.ts` orquestra as fases (Fidelidade → Projetista → Inventariante → Auditores → Precificação); UI em `src/components/markup/`; resultado vira orçamento em `src/lib/markup-compose.ts`. Mapa completo em `docs/structure.md`; decisões em `docs/decisions/` e `specs/orcamento-com-ia/REQUIREMENTS.md`.
2. **Orçamentos IA / "Corte Claude"** (rota `/orcamentos-ia`) — `src/lib/orcamentos-ia/` (orquestração LangGraph em `pipeline.ts`, desmonte determinístico em `bom-engine/`), componentes em `src/components/orcamentos-ia/`, visão/extração na edge function `orcamentos-ia-pipeline`. Fonte da verdade: `docs/prd_v11_sistema_orcamento_corte_claude.md` + acertos em `docs/prd_v12_1_corte_claude_acertos_consolidados.md`; plano em `EXECUTION_PLAN.md`.

Regras do módulo Corte Claude (de `.cursorrules`; o arquivo `.cursorrule` no singular é a versão v8 antiga, ignore):

- **Proibido** precificar móvel por m² de fachada. Venda só por BOM com margem MPC % ou multiplicador ×N. m² existe apenas para consumo de chapa (área da peça ÷ 5,0875 + 15% de perda).
- Ferragens, conectores e parafusos são calculados **por unidade individual**, nunca por pacote/caixa.
- Preferências construtivas em `system_preferences`; BOM em `bom_items`.
- Fallback de preço: `inventory_items` → `market_reference_prices` com confirmação do usuário na UI (`using_market_price`).
- Correções feitas na auditoria com justificativa são vetorizadas (embeddings) e salvas em `ai_memories`.
- `company_id` aponta para a empresa do CRM já existente — não criar tabela `companies`.
- PDF renderizado a 200 DPI com overlay SVG de bounding boxes; accent `#0066FF`; tokens em `ui-tokens.ts`.
- UI só com Tailwind (sem CSS modules), ícones só `lucide-react`, reaproveitar primitivos de `src/components/ui` (shadcn/Radix).

## Armadilhas

- **A raiz tem lixo de trabalhos antigos** (`App.js`, `Button.tsx`, `deploy-*.json/ts`, `tmp-*`, `.md` de planejamento, `meu-primeiro-projeto/`). Nada disso roda — o entrypoint é `src/main.tsx` → `src/App.tsx`.
- `NETLIFY.md` cita a porta 3001; a porta real é **3000**. Há também um `vercel.json`, mas o deploy é Netlify (`netlify.toml`).
- Imports internos usam o alias `@/` → `src/`.
- `.env` existe só para uso local (`VITE_SUPABASE_*` para o front; `DATABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` apenas para scripts — nunca no front nem na Netlify). `settings.json` nega leitura/edição de `.env*`; use `.env.example` como referência dos nomes.

## Convenções

- **Commits:** Conventional Commits (`feat:`, `fix:`, `chore:`, `docs:`); **branches:** `feat/<desc>`, `fix/<desc>`, `chore/<desc>`.
- Decisões arquiteturais viram ADR em `docs/decisions/NNNN-titulo.md` (formato no README da pasta); ADR aceito não é editado, é substituído por outro.
- Não usar `any` em TypeScript sem comentário justificando.
- Não fazer `git push --force` em `main`.
- Revisão: skill `code-review-b2`. Auditoria de segurança: skill `security-check`.
