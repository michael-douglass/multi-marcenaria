# TASKS — Migração do schema da Movelaria para o novo banco Supabase

Plano completo: `C:\Users\PC\.claude\plans\ultrathink-estou-a-continuar-parallel-beacon.md`

- Banco antigo (somente leitura): `zzqgtclvuetemzhqzhbq`
- Banco novo (destino): `vejugdspjfgfajdpfiht`
- Escopo: só estrutura, só Movelaria + CRM Garbo.
- Ritmo: uma tarefa por vez — diagnóstico → OK → execução → validação → relatório → OK.

## Regras fixas

- Banco antigo sempre com `default_transaction_read_only=on`. Nenhuma escrita nele.
- Todo comando de escrita confere antes que o host de destino contém `vejugdspjfgfajdpfiht`.
- Valores do `.env` nunca são impressos.
- Sem commit/push sem pedido explícito.

## Fase A — Preparação (nada toca o banco novo)

- [x] **T01 — Higiene do `.env` e do git**
  - `.env` no `.gitignore`; nomes: `OLD_DATABASE_URL`, `OLD_SUPABASE_URL`, `DATABASE_URL` (novo, Session pooler), `SUPABASE_SERVICE_ROLE_KEY`.
  - Aceite: `git check-ignore .env` casa; listagem de nomes/hosts mostra antigo e novo nas variáveis certas.
- [x] **T02 — Ferramentas e conectividade**
  - `pnpm install`; `psql` via Docker nos dois bancos; confirmar que o novo está vazio.
  - Aceite: `select version()` responde nos dois; novo com 0 tabelas em `public` e sem `emp_garbo`.
- [x] **T03 — Manifesto de escopo**
  - Classificar objetos do antigo em INCLUIR / EXCLUIR / DUVIDOSO (prefixo + uso no código + dependências do catálogo).
  - Aceite: `supabase/baseline/manifest.md` revisado; duvidosos decididos; nenhum incluído depende de excluído.

## Fase B — Baseline no banco novo

- [x] **T04 — Gerar o baseline** (`pg_dump -Fc --schema-only` → `pg_restore -l/-L` → `supabase/baseline/000_baseline_schema.sql`)
  - Aceite: arquivo gerado, sem segredos e sem o ref antigo; resumo de contagem por tipo de objeto revisado. Nada aplicado.
- [x] **T05 — Pré-requisitos no novo** (extensões `vector` em `public`, `pg_cron`, `pg_net` se usado)
  - Aceite: extensões nas mesmas posições do antigo.
- [x] **T06 — Aplicar o baseline** (`psql --single-transaction -v ON_ERROR_STOP=1`)
  - Aceite: um único `COMMIT`, sem erro.
- [x] **T07 — Storage** (buckets + policies de `storage.objects` geradas do catálogo)
  - Aceite: buckets do escopo com mesmo `public`/limite/MIME; policies idênticas.
- [x] **T08 — Realtime, cron e API** (publicação, job `movelaria_ponto_faltas_diario`, expor `emp_garbo`)
  - Aceite: tabelas do escopo na publicação; job agendado; `emp_garbo` acessível pela API.
- [x] **T09 — Registrar migrations** (`pnpm migrate`)
  - Aceite: 247 linhas em `movelaria_schema_migrations`, nenhum SQL executado.
- [x] **T10 — Verificação de paridade antigo × novo** (`scripts/baseline/compare-schemas.mjs`)
  - Aceite: zero diferenças não explicadas; toda `.rpc()`/`.from()` literal do código existe no novo.

## Fase C — App no banco novo

- [ ] **T11 — Dados mínimos** (empresa Garbo com o mesmo UUID, primeiro admin, tabelas de configuração escolhidas)
  - [x] Linha da empresa Garbo copiada (`scripts/baseline/copy-rows.mjs`).
  - [ ] Primeiro usuário admin — aguardando e-mail/senha.
  - [ ] Tabelas de configuração a copiar — aguardando decisão.
- [x] **T12 — Apontar o app** (`VITE_*` → novo; remover ref antigo hardcoded em 5 arquivos de `src/` e `supabase/config.toml`)
  - Aceite: `pnpm build` passa; busca por `zzqgtclvuetemzhqzhbq` em `src/` vazia.
- [ ] **T13 — Edge functions** (deploy das 36 com `verify_jwt` igual ao antigo; secrets; funções fora do repo)
  - [x] `verify_jwt` das 36 gravado em `supabase/config.toml` (19 true, 17 false).
  - [ ] Deploy — a CLI exige confirmação explícita do usuário antes de publicar.
- [ ] **T14 — Auth e smoke test** (Site URL/Redirect URLs; roteiro manual; advisors)

## Tarefas propostas durante a execução

- **Trocar a senha do banco novo.** Um trecho dela apareceu na saída de um comando durante a T01.
- **Escopo ampliado:** `CRM-Selletos>*<` e `crm_selletos_*` entraram no baseline (só estrutura), porque 13 edge functions, 21 funções SQL e 3 FKs dependem delas.
- **3 FKs omitidas** (apontam para tabelas da escola ProForço): ver `skippedFks` em `supabase/baseline/manifest.json`.
- **Chaves novas (`sb_publishable_`):** funções com `verify_jwt = true` chamadas com a chave pública (`register-public`) precisam ser testadas no projeto novo.
