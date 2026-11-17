# Baseline do schema (Movelaria + CRM)

As migrations em `supabase/migrations/` não recriam o banco do zero: a base do CRM (`emp_garbo`,
tabelas `CRM-multi-empresas>…<`, funções `me_*`) nunca foi versionada. Este diretório guarda essa base,
extraída do projeto de origem com `pg_dump --schema-only` e filtrada pelo `manifest.json`.

## Recriar em um projeto Supabase vazio

Com `DATABASE_URL` apontando para o projeto de destino (os scripts abortam se o host não for o esperado;
ajuste `NEW_REF` em `scripts/baseline/*.mjs` para outro projeto):

```bash
node --env-file=.env scripts/baseline/apply-sql.mjs supabase/baseline/001_extensions.sql
node --env-file=.env scripts/baseline/apply-sql.mjs supabase/baseline/000_baseline_schema.sql --dry-run   # ensaio
node --env-file=.env scripts/baseline/apply-sql.mjs supabase/baseline/000_baseline_schema.sql
node --env-file=.env scripts/baseline/apply-sql.mjs supabase/baseline/002_storage.sql
node --env-file=.env scripts/baseline/apply-sql.mjs supabase/baseline/003_realtime_cron.sql
node --env-file=.env scripts/baseline/apply-sql.mjs supabase/baseline/004_function_grants.sql
node --env-file=.env scripts/baseline/expose-schemas.mjs    # expõe emp_garbo na API
pnpm migrate                                                # só registra as migrations já contidas no baseline
```

Cada arquivo roda em uma única transação: se falhar, nada fica aplicado.

## Arquivos

| Arquivo | Conteúdo |
|---|---|
| `000_baseline_schema.sql` | Tabelas, tipos, funções, views, índices, triggers, policies e grants |
| `001_extensions.sql` | `vector` (em `public`) e `pg_cron` |
| `002_storage.sql` | 22 buckets e 85 policies de `storage.objects` |
| `003_realtime_cron.sql` | 23 tabelas na publicação `supabase_realtime` e o job `movelaria_ponto_faltas_diario` |
| `004_function_grants.sql` | Remove o `EXECUTE` que projetos novos concedem por padrão e a origem não tinha |
| `manifest.md` / `manifest.json` | O que entrou e o que ficou de fora, e por quê |

## Regerar a partir do banco de origem (somente leitura)

```bash
node --env-file=.env scripts/baseline/build-manifest.mjs
node --env-file=.env scripts/baseline/run-pg.mjs old pg_dump -Fc --schema-only -n public -n emp_garbo -f /work/old.dump
node --env-file=.env scripts/baseline/run-pg.mjs none pg_restore -l /work/old.dump -f /work/toc.list
node scripts/baseline/filter-toc.mjs
node --env-file=.env scripts/baseline/run-pg.mjs none pg_restore -L /work/toc.filtered.list --no-owner -f /base/000_baseline_schema.sql /work/old.dump
node --env-file=.env scripts/baseline/gen-platform.mjs
node --env-file=.env scripts/baseline/compare-schemas.mjs   # paridade origem × destino
```

`run-pg.mjs` usa o container `postgres:17` (Docker precisa estar rodando).
