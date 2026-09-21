# Tech — GARBO Movelaria

Stack verificada por leitura direta de `package.json`, `vite.config.ts` e do código — não suposta.

## Stack

- **Frontend**: Vite + React 18 + TypeScript, SPA. Roteamento com `react-router-dom`.
- **Backend**: Supabase (Postgres + Auth + Edge Functions em Deno).
- **Deploy**: Netlify. Builda com `pnpm build`, publica `dist/` (`netlify.toml`). **Netlify não roda
  migration** — `pnpm migrate` precisa ser rodado localmente contra `DATABASE_URL` antes/depois do
  deploy de schema.
- **Gerenciador de pacotes**: pnpm `10.32.0` (`packageManager` fixado no `package.json`). Node ≥ 20.

## Scripts (reais, de `package.json`)

```bash
pnpm dev       # vite --port 3000 --strictPort
pnpm build     # tsc && vite build
pnpm preview   # vite preview --port 3000 --strictPort
pnpm migrate   # node --env-file=.env scripts/migrate.mjs — aplica supabase/migrations/*.sql pendentes
```

**Não há lint script nem test runner automatizado** (sem Jest/Vitest/Playwright plugado ao
`package.json`). Os arquivos `scripts/test-*.mjs` são scripts manuais ad-hoc, não uma suíte de CI.
`pnpm build` (que roda `tsc`) é o único guardrail de correção automatizado do projeto — qualquer
especificação deste módulo precisa assumir isso como teto de verificação automática; o resto é
verificação manual ponta a ponta na aplicação real.

## Bibliotecas relevantes para o módulo "Orçamento com IA"

| Biblioteca | Uso no contexto deste módulo |
|---|---|
| `pdfjs-dist` | Conversão de PDF do projeto em imagens por página, para envio à IA multimodal (`src/lib/pdf-to-image.ts`) |
| `xlsx` | Leitura de planilha de plano de corte (Cortecloud) fornecida pelo marceneiro/fornecedor |
| `jspdf` / `html2canvas` | Exportação de PDF/folha de orçamento (`markup-pdf-export.ts`, `markup-orcamento-simples-export.ts`) |
| `@tanstack/react-query` (+ persister) | Cache/estado de catálogo, config e orçamentos do markup |
| `zod` | Validação de schema (inclui a saída estruturada dos agentes de IA) |
| `@supabase/supabase-js` | Cliente único em `src/lib/supabase.ts` — sempre importar de `@/lib/supabase`, nunca `src/integrations/supabase/client.ts` (que só reexporta, mantido por paridade com código CRM) |
| Radix UI + Tailwind (`class-variance-authority`, `tailwind-merge`) | Componentes da calculadora e dos painéis de IA |

## Integração com IA

- Provedor: OpenAI, chamado diretamente da edge function `supabase/functions/compose-markup-ia/index.ts`
  (`callOpenAIChat`). Allowlist de modelos em `MARKUP_IA_ALLOWED_MODELS`
  (`supabase/functions/_shared/markup-ia-prompts.ts`).
- Prompts por agente são editáveis via `markup_config.markup_ia_agent_prompts` (UI:
  `MarkupIAAgentesPanel`), mas o prompt default hardcoded também precisa ser mantido em sincronia
  quando o schema de saída muda.
- Chave OpenAI vive na config de IA do pipeline de lead (`pipeline_lead_ai_config`), não é exclusiva
  do markup.

## Variáveis de ambiente (`.env`, ver `.env.example`)

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` (ou `VITE_SUPABASE_PROJECT_ID`) — frontend,
  também precisam estar no Netlify.
- `DATABASE_URL` — só para `pnpm migrate` e scripts locais; **nunca** exposta ao frontend/Netlify.
- `SUPABASE_SERVICE_ROLE_KEY` — só para scripts admin locais; **nunca** em código de frontend/Netlify.

## Timeouts e limites reais que a spec precisa respeitar

- Cliente Supabase (`src/lib/supabase.ts`) tem timeout tunado por operação: REST 20s, storage 120s,
  **edge functions 180s** — a composição por IA inteira (todas as fases do pipeline) precisa terminar
  dentro dos 180s ou o cliente aborta a chamada.
  `pdfAllPagesToJpegBlobs` tem cap de 50 páginas.
- Bundle do CRM já excede 5MB (comentário no Workbox de `vite.config.ts`) — qualquer página nova do
  CRM (incluindo telas deste módulo) deve continuar `lazy()`-loaded; páginas do núcleo são eager.
- Multi-tenant **schema-per-empresa** (ex. `emp_garbo`) — toda query/RPC nova precisa considerar isso,
  não um schema `public` único.
- Migrations são arquivos novos e numerados/timestamped em `supabase/migrations/`, aplicados em ordem
  de nome por `scripts/migrate.mjs` (tabela de controle `movelaria_schema_migrations`); **nunca editar
  migration passada**.
- Pares de arquivo duplicados **client + `_shared`** (ex. `markup-motor-calculo.ts`, `markup-match.ts`,
  `markup-cortecloud.ts`, `markup-ia-*.ts`) existem porque Deno (edge functions) não importa
  diretamente de `src/`. Mantê-los em sincronia é responsabilidade de quem edita — não há mecanismo
  automático de sync encontrado no repositório.

## Path alias

`@/` mapeia para `src/` (`vite.config.ts`). Usar para todo import interno a `src/`.
