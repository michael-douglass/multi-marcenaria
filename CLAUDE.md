# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

GARBO Movelaria — a Vite + React + TypeScript SPA for a furniture company: financial management, construction/installation ("obras") tracking, timekeeping ("ponto"), plus an embedded CRM module ("Selletos") for leads/pipeline/contracts/marketing. Backend is Supabase (Postgres + Auth + Edge Functions).

## Commands

```bash
pnpm dev              # vite dev server on :3000 (strictPort)
pnpm build            # tsc && vite build
pnpm preview          # serve the production build on :3000
pnpm migrate          # node --env-file=.env scripts/migrate.mjs — applies pending SQL in supabase/migrations/
```

- Package manager is pnpm (`packageManager: pnpm@10.32.0`). Node >= 20.
- There is no lint script and no automated test runner (no Jest/Vitest/Playwright config wired to package.json) — `scripts/test-*.mjs` are ad-hoc manual scripts (e.g. `node scripts/test-caixa-restante.mjs`), not a suite run in CI. Treat `pnpm build` (which runs `tsc`) as the main correctness check.
- `scripts/apply-*.mjs` are one-off scripts that applied specific numbered migrations historically; new schema changes should go through `supabase/migrations/*.sql` + `pnpm migrate` instead of new apply-*.mjs scripts.
- Deploying: Netlify builds with `pnpm build` / publishes `dist` (see `netlify.toml`). Netlify does **not** run DB migrations — run `pnpm migrate` locally against `DATABASE_URL`. See `NETLIFY.md` for env vars and Supabase auth URL configuration.

## Environment

Required in `.env` (see `.env.example`):
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (or `VITE_SUPABASE_PROJECT_ID` alternative) — used by the frontend (`src/lib/supabase.ts`), must also be set in Netlify.
- `DATABASE_URL` — used only by `pnpm migrate` and local scripts, never exposed to the frontend/Netlify.
- `SUPABASE_SERVICE_ROLE_KEY` — used only by local/admin scripts, never in frontend code or Netlify env.

## Architecture

### Two apps sharing one shell

The codebase is the merge of two originally-separate apps, and this shows up as **parallel, similarly-named modules** — always check which one you're in before reusing a name:

- **Core "Movelaria" app** — financial/obras/ponto features. Context lives in `src/context/` (singular): `AppContext.tsx`, `CaixaContext.tsx`, `FinanceDataContext.tsx`, `ObrasContext.tsx`. Roles are `UserRole` (`Administrador`, `Financeiro`, `Marceneiro`, `MontadorAdmin`, `AdministradorObras`, `Montador`, `Visualizador`), defined in `src/types` and gated via `src/lib/role-access.ts` (`canAccessSection`, `getAllowedSections`).
- **CRM "Selletos" module** — leads/pipeline/contracts/markup/marketing/eventos. Context lives in `src/contexts/` (plural): `AppContext.tsx` (a *different* `useApp()`, CRM UI state only — comment in file: "Não confundir com `@/context/AppContext` da fábrica"), `AuthContext.tsx`, `EmpresaContext.tsx`. Roles are `CrmRole` (`admin`, `vendedor`, `marketing`, `projetista`, `projetista_admin`, `nenhum`), defined in `src/lib/crm-identity.ts` and gated via `canAccessCrmPath`.

Both role systems are independent and a user can hold roles in either/both (`src/App.tsx` composes both: `roles` from core auth and `crmProfile` from CRM auth, e.g. `isCrmAdmin(crmProfile) || roles.includes('Administrador')`). When adding an access-controlled feature, identify first whether it belongs to the core app or the CRM module — that decides which role type and gate function applies.

### Routing and access gating (`src/App.tsx`)

All authenticated routing funnels through `AuthenticatedRoutes()`. Route access is decided inline per-route via the two gate helpers above (`canAccessSection`/`canAccessFuncionarioPasta` for core, `crmPage(path, element)`/`canAccessCrmPath` for CRM), rather than a generic route-guard wrapper — follow the existing per-route pattern when adding a route. `readOnly` mode applies when a user's *only* role is `Marceneiro` (view-only across finance screens via `guardReadOnly`).

Public (unauthenticated) routes are declared directly in `App()`, outside `AuthenticatedRoutes` — e.g. `/orcamento/:schema/:id`, `/agendar/:slug`, `/cadastro/:tipo`. These are customer-facing pages (public quote viewing, public booking, public registration) and must not assume a Supabase session.

Most CRM pages are `lazy()`-loaded; core app pages are eagerly imported. Keep new CRM-module pages lazy to avoid bloating the main bundle (see the Workbox comment in `vite.config.ts` about the CRM bundle already exceeding 5MB).

### Supabase integration

- `src/lib/supabase.ts` is the actual client (custom storage adapter, timeouts tuned per-operation: REST 20s, storage 120s, edge functions 180s for AI/render calls). `src/integrations/supabase/client.ts` just re-exports it — always import from `@/lib/supabase` for anything new; the `integrations` path exists only for CRM code parity.
- `supabase/migrations/*.sql` — numbered (`NNN_description.sql`) or timestamped (`YYYYMMDDHHMMSS_description.sql`) migrations, applied in filename-sort order by `scripts/migrate.mjs`, tracked in a `movelaria_schema_migrations` table it creates itself. Write new migrations as new files here; don't edit past ones.
- `supabase/functions/*` — Deno edge functions (WhatsApp integration, lead AI analysis/render, contract/markup composition, marketing copy generation, user admin actions like create/delete/reset-password). `supabase/functions/_shared` holds code shared across functions.

### Path alias

`@/` maps to `src/` (configured in `vite.config.ts`). Use it for all intra-`src` imports.

### Repo hygiene note

The repo root accumulates one-off artifacts from past work: stray top-level files like `App.js`, `Button.tsx`, `deploy-*.json`, `deploy-*.ts`, `screenshot-*.png`, `test_*.png`, numbered scratch files (`0`), and `.md` planning docs under `docs/`. These are not part of the build (`src/App.tsx` is the real entry, not root `App.js`). Don't assume a root-level same-named file is live code — check `src/` first.
