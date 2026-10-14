# PRD v12 — Circuit Breaker do Auditor + Paridade Cortecloud #23574204

| Campo | Valor |
| ----- | ----- |
| Versão | **v12.0-circuit-breaker** |
| Data | 2026-10-13 |
| Base | PRD v11.3 Corte Claude + evidência ELITON `93805427` |
| Plano referência | Cortecloud [#23574204](https://marceneiro.cortecloud.com.br/#/plans/23574204/view) |

## 1. Problema (5 falhas ELITON)

1. `sale_price` / margem MPC não gravados após `COMPLETED`.
2. Quantidades infladas por fusão de lotes/vistas do PDF.
3. Dual material incompleto (caixa em Noite 15 em vez de Branco TX 15).
4. Contagem enganosa de R$ 0 (lista de corte `corte-peca` + cobráveis).
5. Omissão de Painel / Ripado (coverage só warning).

## 2. Circuit Breaker (obrigatório)

Antes de `COMPLETED`, `evaluateCircuitBreaker` deve retornar `ok: true`. Caso contrário status = **`NEEDS_REVIEW`**.

Bloqueadores:

| # | Regra |
| - | ----- |
| B1 | Item **cobrável** (chapa agregada, fita, ferragem, puxador) com `unit_price = 0` |
| B2 | Flags de fusão de vista / tetos (laterais > 4, tampos > 2, portas > teto) |
| B3 | `sale_price` ausente/zero ou MPC% / ×N ausente conforme modalidade |
| B4 | Caixa interna fora de MDF Branco TX (salvo override explícito) |
| B5 | `coverage.missing.length > 0` (inclui Painel/Ripado do inventário) |

Linhas `corte-peca` podem ficar R$ 0 (preço na chapa agregada) e **não** disparam B1.

## 3. Merge anti-vista

- Chave de peça: `function|nome|W×H×T`.
- Quantidades entre lotes: **MAX**, nunca soma.
- Módulos com cotas externas divergentes: mantém a vista mais rica; descarta espelho.
- `validatePlausibleQuantities` alimenta o breaker.

## 4. Dual material (Default-with-Override)

Defaults Cortecloud (plano 23574204):

- Caixa: MDF Branco TX `box_thickness_mm` (15)
- Frente: cor do projeto `front_thickness_mm` (18)
- Gaveta: `kit_fabril_5_pecas`
- `mixed_edge_banding: true`

`applyDualMaterialBoxDefaults` reescreve laterais/base/fundo/prateleira/divisória/travessa após a extração.

## 5. Persistência financeira

Em `nodeResolvePricesAndPersist` / reauditoria:

- `totals.sale_price`, `totals.materials_cost` (`cost_price`), `totals.mpc_margin_pct`, `totals.multiplier_n`
- `pricing_modality`, `pricing_params`
- `totals.circuit_breaker` (relatório)

Proibido m² de fachada na venda (mantém v11).

## 6. Evidências / REA

| Artefato | Path |
| -------- | ---- |
| Nosso resultado | `docs/evidence/nosso_resultado.json` |
| Referência CalcmeX/Cortecloud | `docs/evidence/resultado_calcmex.json` |
| Compare | `docs/evidence/cortecloud-23574204-rea-compare.json` |
| HAR micro | `docs/evidence/captura_cortecloud-23574204-micro.har` |
| Captura | `scripts/capture-cortecloud.js --url ...23574204...` |

## 7. Critério de aceite

Reprocessar ELITON GOURMET:

1. `sale_price > 0` e MPC gravados.
2. Zero cobráveis a R$ 0.
3. Laterais da Ilha ≤ 4; sem soma de vistas.
4. Caixas em Branco TX.
5. Painel/Ripado presentes **ou** status `NEEDS_REVIEW` com blocker de cobertura.
6. `COMPLETED` somente com `circuit_breaker.ok === true`.

## 8. Arquivos-chave

- `src/lib/orcamentos-ia/circuit-breaker.ts`
- `src/lib/orcamentos-ia/merge-extraction.ts`
- `src/lib/orcamentos-ia/pipeline.ts`
- `src/lib/orcamentos-ia/pricing.ts` (cálculo; persistência no pipeline)
- `src/components/orcamentos-ia/AuditWorkspace.tsx`
- `supabase/migrations/20261014_orcamentos_ia_needs_review_status.sql`
- Prompts Edge/src `engineering-modular-prompts.ts` / `engineering-modular.ts`
