# Diagnóstico 047b5998 — TypeError: Failed to fetch

- **ID:** `047b5998-f3dd-4d70-8819-e5360f89ee68`
- **PDF:** Caderno Executivo Pav Inferior - Casa Mesa_260828_175240.pdf (49 páginas)
- **Modelo:** claude-sonnet / mode max
- **Falhou em:** 2026-10-14 13:49:51 UTC (~19 min após criar; ~12 min na extração)
- **Ponto:** página 23/49 (0-based `current_page=23`), status `FAILED`
- **Erro:** `TypeError: Failed to fetch`
- **Progresso salvo:** `modules_found_count=5`, `partial_extraction` presente, `page_paths=49` (conversão OK)
- **Cadeia:** `async_chain_status` ficou `running` (inconsistente com FAILED)

## Interpretação

Não é erro de schema Zod (como o `sliding_doors` anterior). Foi **falso FAILED no navegador**:

1. Cliente (poll REST) sofreu `TypeError: Failed to fetch` e gravou `status=FAILED`.
2. A cadeia Edge (`chain_tick`) **seguiu viva** e em ~40s já estava em página 25/49 com `EXTRACTING_MODULES` de novo (sobrescreveu o status).

Sintomas no monitor:
- Páginas 17, 21 e 22 “presas” vários ticks (~1–1,5 min) — LLM lento, normal.
- `async_chain_status` permaneceu `running` mesmo após o FAILED do cliente.

## Mitigação no código (2026-10-14)

- `waitForAsyncChainReady`: retry em falha de rede (até 8 polls) e só trata FAILED se a cadeia não estiver `running`.
- Catch de `invokeAgents`: rede não grava FAILED terminal.

## Segunda falha (real) — 13:57 UTC

- `async_chain_status=failed`
- `pipeline_detail`: **Cadeia interrompida (HTTP 500). Clique em Retomar.**
- Parou em `current_page=29` / 49, **7 módulos**, 4 ambientes
- Totals ~72 KB — não é payload gigante

Interpretação: o `chain_tick` seguinte (página ~30) respondeu HTTP 500 (worker/LLM/crash). O tick anterior marcou a cadeia como failed.

## Mitigação Edge

- `enqueueChain`: até **3 tentativas** com backoff em HTTP 5xx / rede antes de FAILED.

## Ação no job atual

Na UI: **Retomar** (não reenviar o PDF). Checkpoint em página 29 com partial válido.
