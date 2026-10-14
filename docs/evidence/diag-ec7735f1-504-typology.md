# Diagnóstico job `ec7735f1` — 504 no console + FAILED no banco

- **Projeto:** `zzqgtclvuetemzhqzhbq`
- **Job:** `ec7735f1-b1c8-4e32-b105-8cdcc43bf777`
- **PDF:** `A4_ARQ_DET_QUARTO SUÍTE_CO_REV01.pdf` (13 páginas)
- **Modelo:** `claude-sonnet`
- **Janela:** 2026-10-14 16:04 → 16:25 UTC (~21 min)

## O que o navegador mostrou

`Failed to load resource: …/orcamentos-ia-pipeline … 504`

504 = o **gateway do Supabase** cortou a espera daquela chamada HTTP (limite ~150s). Não é “PDF inválido” nem “login”.

## Causa real do FAILED (banco)

```
Resposta do Extrator fora do schema esperado
(environments.0.modules.0.typology: Invalid option:
 expected balcao|aereo|armario_correr|armario_giro|nicho|painel|gaveteiro|outro)
```

No `partial_extraction`, o 1º módulo veio assim:

- name: `Divisória com nichos 870×2701`
- **typology: `"divisoria"`** ← valor **não permitido** no Zod

Valores válidos: `balcao | aereo | armario_correr | armario_giro | nicho | painel | gaveteiro | outro`.
Para divisória/nicho o esperado seria `nicho` ou `outro` (não `divisoria`).

## Linha do tempo

1. Conversão PDF 13 págs. OK  
2. Cadeia async leu págs. 1–13 (~16:05→16:23)  
3. Págs. 2 e 10: resposta IA inválida (ignoradas)  
4. Auditoria incremental Quarto Suíte (~16:23:57)  
5. Em ~16:25:49 → **FAILED** por typology inválida  
6. Console pode mostrar **504** se alguma invocação (ex.: auditoria longa) estourou o gateway — sintoma paralelo, não a causa do FAILED

## Cobertura (inventário vs extraído)

| Esperado (capa) | Extraído |
|-----------------|----------|
| Guarda Roupas | **faltou** |
| Divisória com nichos | Divisória… (mas typology inválida) |
| Painel TV Lino | Painel TV 2520×1550 |
| Cabeceira | **faltou** |
| Aparador | **faltou** |
| Mesa de Cabeceira | **faltou** |

`async_chain_status` ficou `ready_for_pricing`, mas o pós-processamento/auditoria **derrubou** o job no schema.

## Conclusão

| Sintoma | Significado |
|---------|-------------|
| **504** | Timeout do gateway numa chamada HTTP à Edge |
| **FAILED** | Tipologia inventada pela IA (`divisoria`) fora do enum Zod |

**Correção sugerida (próximo passo):** preprocessar `typology` (mapear `divisoria`→`nicho`/`outro`, etc.) em vez de rejeitar o orçamento inteiro — mesmo padrão já usado em `sliding_doors`.
