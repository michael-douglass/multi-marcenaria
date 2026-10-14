# Teste de boas práticas — 740a388a (14/10/2026)

- **PDF:** A4_ARQ_DET_QUARTO SUI_TE_CO_REV01.pdf (**13** páginas)
- **Resultado:** COMPLETED (~21 min), venda ~R$ 23.673, 9 módulos

## Checklist do plano

| Prática | Resultado |
|---------|-----------|
| 1 página / LLM | OK — cadeia avançou page a page |
| `checkpoint_every_pages=15` gravado | OK (visto no meio da corrida) |
| `extraction_lot=1` | OK (13 págs = 1 lote; sem barreira aos 15) |
| Sem `FETCHING_MARKET_PRICES` durante extração | OK — só EXTRACTING → AUDITING → COMPLETED |
| Preço uma vez no fim | OK — poll de 15s não chegou a capturar FETCHING (passagem rápida) |
| `consolidated_bom` no totals | OK — 26 chapas (Branco 15×17 + Branco 6×9), 18 linhas ferragem |
| De-Para canônico | OK — PUXADOR ALÇA, DOBRADIÇA RETA, CORREDIÇA OCULTA 45, CABIDEIRO OVAL |

## Limitação deste PDF

Com **13 < 15** páginas não houve mensagem “Lote 1/N concluído — checkpoint”. Para validar a barreira aos 15, usar PDF ≥30 págs (ex. Casa Mesa 49).

## Ajuste pós-teste

Edge **v61**: `setStage` no início da página também usa texto “Lote X/Y…”, para não sobrescrever o detalhe no meio do LLM.
