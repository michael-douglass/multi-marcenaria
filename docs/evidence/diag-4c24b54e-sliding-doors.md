# Diagnóstico — `4c24b54e` (Quarto Suíte CO)

**Data:** 2026-10-14  
**PDF:** `A4_ARQ_DET_QUARTO SUI_TE_CO_REV01.pdf` (13 páginas)  
**Modelo:** `claude-sonnet` → `claude-sonnet-4-5`

## O que deu certo (checklist de liberação)

| Etapa | Resultado |
|-------|-----------|
| Upload + conversão PDF→JPEG (1560px) | OK |
| Seletor `extraction_model=claude-sonnet` na Edge | OK (log `extraction=claude-sonnet`) |
| Fix `effort` só no Opus (v57) | OK — sem 400 Anthropic |
| Cadeia async 13/13 páginas | OK (~18 min) |
| Auditoria ambiente Quarto Suíte | OK |
| `async_chain_status=ready_for_pricing` | OK |
| Módulos encontrados | 7 |

## Onde quebrou

Após `ready_for_pricing`, o **cliente** validou o JSON com Zod e falhou:

```
Resposta do Extrator fora do schema esperado
(environments.0.modules.0.sliding_doors: Invalid input).
```

Guarda-roupas veio com `sliding_doors: 6`. O schema só aceitava `2 | 3 | 4`.

**Não foi falha da Anthropic nem da Edge** — a leitura completa já estava no `partial_extraction`.

## Correção aplicada

- Schema: `sliding_doors` 2–8 com preprocess/coerção
- Sanitize no pipeline: clamp 2–8
- Tipos BOM alinhados

## Próximo passo operacional

Clicar **Retomar** em `4c24b54e` (páginas + partial já existem; deve ir rápido para precificação).

## Padrão para próximos acompanhamentos

1. Monitor: `node scripts/monitor-heavy-quote.mjs <analysisId>`
2. Confirmar logs Edge: `extraction=claude-sonnet` e POST 200 (sem effort)
3. Se falhar após `ready_for_pricing` → olhar Zod no cliente (não redeploy Edge às cegas)
4. Preferir PDF ≤20 páginas no smoke de liberação; cadernos 40+ só depois do Sonnet estável
