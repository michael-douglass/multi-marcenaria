# PRD v16 — Paridade Fabril e Arquitetura em Sub-Projetos de 15 Páginas

| Campo | Valor |
| --- | --- |
| **Versão** | **v16.0** |
| **Data** | 14 de Outubro de 2026 |
| **Base** | PRD v11 (Corte Claude), v15 (paridade #23125828), HelloMob #22168837 |
| **Plano referência** | Cortecloud `#23125828` — Flaviane e Hélio / Anamá Arq |
| **HelloMob referência** | Cortecloud `#22168837` — Camila e Otávio / Quarto |
| **Arquitetura** | Edge `orcamentos-ia-pipeline` + client LangGraph `pipeline.ts` |

---

## 1. Objetivo

Fechar a lacuna fabril vs Cortecloud (#23125828: **74 chapas / 13 SKUs / ~1223 peças**) com quatro épicos:

1. Processamento resiliente em **sub-projetos de no máximo 15 páginas**
2. **Paleta multi-cor dinâmica** (sem colapso em Jatobá)
3. **Modularização HelloMob** + caixaria atômica
4. **De-Para** de ferragens + **uma única** passagem de precificação (MPC 45%)

---

## 2. Épico 1 — Sub-projetos 15 páginas & resiliência de schemas

### 2.1 Norma

| Item | Valor |
| --- | --- |
| `CHECKPOINT_EVERY_PAGES` | **15** |
| Leitura IA | **1 página / request** (cadeia async Edge + `waitUntil`) |
| Checkpoint | `quote_analyses.totals`: `current_page`, `partial_extraction`, `extraction_lot`, `checkpoint_every_pages` |
| Tipologias módulo | Só 8: `balcao\|aereo\|armario_correr\|armario_giro\|nicho\|painel\|gaveteiro\|outro` |
| Sanitizer | `normalizeModuleTypology` via `z.preprocess` — `divisoria`/`estante`/`coluna`/`prateleira` → `nicho` |
| Anti-OOS | Marcenaria MDF/MDP/madeira **nunca** `out_of_scope=true` |

### 2.2 Arquivos

| Camada | Arquivo |
| --- | --- |
| Edge | `supabase/functions/orcamentos-ia-pipeline/index.ts` |
| Schema | `src/lib/orcamentos-ia/schemas.ts` |
| Pipeline | `src/lib/orcamentos-ia/pipeline.ts` (`coerceModuleTypologies`) |
| UI progress | `src/lib/orcamentos-ia/storage.ts` |
| Smoke | `scripts/smoke-normalize-typology.mjs` |

### 2.3 Gate

- `pnpm exec tsc --noEmit`
- `node scripts/smoke-normalize-typology.mjs`
- REA → `docs/evidence/rea-js-prd-v16-epic1.json`

---

## 3. Épico 2 — Paleta multi-cor dinâmica (13 SKUs)

### 3.1 Norma

- No **Lote 1** (capa/legenda), a IA preenche `project_sheet_palette[]` com `{ label, thickness_mm, role }`.
- Roles: `box_white` | `back_white` | `front_color`.
- **PROIBIDO** colapsar frentes coloridas em Jatobá genérico.
- Default seguro = só caixa Branco Eucatex 15 + fundo Branco Multimarcas/TX 6.
- Frentes: Bege Papiro, Imbuia Caiapó, Lord Matt, Mint Essencial, Blush Essencial, Azul Astral, Areia Noronha.

### 3.2 Arquivos

| Peça | Arquivo |
| --- | --- |
| Helper | `src/lib/orcamentos-ia/project-sheet-palette.ts` |
| Consolidate | `src/lib/orcamentos-ia/bom-consolidate.ts` → `resolvePaletteForPricing` |
| Schema | `project_sheet_palette` em `quoteExtractionSchema` |
| Merge | `mergeExtractions` une paletas dos lotes (filtra Jatobá) |
| Prompts | `engineering-modular.ts` + Edge `_shared/engineering-modular-prompts.ts` |
| Edge schema | `EXTRACTOR_SCHEMA.project_sheet_palette` |
| Persistência | `totals.project_sheet_palette` pós-consolidação |
| Smoke | `scripts/smoke-project-sheet-palette.mjs` |

### 3.3 Gate

- Smoke paleta + REA → `docs/evidence/rea-js-prd-v16-epic2.json`

---

## 4. Épico 3 — HelloMob + caixaria atômica

### 4.1 Norma

- Guarda-roupa → colunas `Armário 1 coluna {L}×{A}×{P}` (merge **não** funde cotas diferentes).
- Caixaria mínima: laterais E+D + base + fundo **6 mm** Branco TX (+ tampo em tipologias caixa fechada).
- Evidência ground-truth: `docs/evidence/hellomob-22168837-atomic-pieces.json`.

### 4.2 Arquivos

| Peça | Arquivo |
| --- | --- |
| Merge keys | `moduleFamilyKey` / `canonicalModuleName` em `merge-extraction.ts` |
| Placeholder client | `ensureModulePlaceholder` → `enrichMinimalCaixariaClient` |
| Placeholder Edge | `enrichMinimalCaixaria` (fundo 6 mm + tampo sync) |
| Prompts | seção HELLOMOB em `engineering-modular.ts` |
| Smokes | `scripts/smoke-fundo-6mm.mjs`, `scripts/smoke-hellomob-merge-keys.mjs` |

### 4.3 Gate

- Evidência presente e consistente
- Smoke fundo 6 mm + merge keys

---

## 5. Épico 4 — De-Para + preço único

### 5.1 Norma

| Alias canônico | Chave |
| --- | --- |
| PUXADOR ALÇA | `puxador_alca` |
| DOBRADIÇA RETA SOFT-CLOSE | `dobradica_soft_close` |
| DOBRADIÇA RETA | `dobradica_reta` |
| Articulador uno Tavares Forte | `articulador_uno` |
| RM-331 PERFIL DE LED EMB | `perfil_led_rm331` |
| FITA LED | `fita_led` |
| (+ corrediças, cabideiro, RO82, trilho) | … |

- `FETCHING_MARKET_PRICES` / `calculateQuotePricing` **uma única vez** após `async_chain_status=ready_for_pricing` e consolidação do BOM.
- Sem precificação no meio dos checkpoints de 15 páginas.
- Seed operacional: `node --env-file=.env scripts/seed-hardware-aliases.mjs <companyId>`

### 5.2 Arquivos

| Peça | Arquivo |
| --- | --- |
| De-Para | `src/lib/orcamentos-ia/hardware-alias.ts` |
| Seed | `scripts/seed-hardware-aliases.mjs` |
| Preço | `pipeline.ts` → `nodeResolvePricesAndPersist` |
| Smoke | `scripts/smoke-hardware-alias.mjs` |

### 5.3 Gate final

- `pnpm exec tsc --noEmit`
- Smokes Épico 4
- REA → `docs/evidence/rea-js-prd-v16-epic4.json`
- Este PRD completo

---

## 6. Matriz paridade chapas (#23125828)

| Cor / espessura | Consumo CC |
| --- | ---: |
| Branco TX 15 mm | 33 |
| Branco TX 6 mm | 10 |
| Imbuia Caiapó 15 / 6 | 8 / 2 |
| Areia Noronha 15 / 6 | 8 / 1 |
| Blush Essencial 15 / 6 | 3 / 1 |
| Mint Essencial 15 / 6 | 2 / 1 |
| Azul Astral 15 | 2 |
| Lord Matt 15 | 2 |
| Bege Papiro 15 | 1 |
| **Total** | **74** |

---

## 7. Travas absolutas (herdadas)

1. PROIBIDO preço por m² de fachada  
2. PROIBIDO inventar R$ na IA  
3. Ferragens por unidade individual  
4. Caixa Branco TX; frentes na cor do projeto  
5. Tipologia de módulo ≠ `function` de peça (`divisoria` é função de peça)  
6. PROIBIDO colapsar frentes coloridas em Jatobá  

---

## 8. Fluxo ponta a ponta

```text
PDF → inventário → lotes ≤15 pág (1 pág/IA)
  → merge + project_sheet_palette
  → placeholders caixaria (fundo 6 mm)
  → auditor / self-heal
  → consolidateExtractionForPricing (paleta dinâmica + De-Para)
  → ready_for_pricing
  → FETCHING_MARKET_PRICES (única) + calculateQuotePricing (MPC)
  → COMPLETED / NEEDS_REVIEW
```

---

## 9. Status de implementação

| Épico | Status | Evidência |
| --- | --- | --- |
| 1 Sub-projetos + schema | **Concluído** | `docs/evidence/rea-js-prd-v16-epic1.json` |
| 2 Paleta dinâmica | **Concluído** | `docs/evidence/rea-js-prd-v16-epic2.json` |
| 3 HelloMob caixaria | **Concluído** | `hellomob-22168837-atomic-pieces.json` + smokes |
| 4 De-Para + preço único | **Concluído** | `docs/evidence/rea-js-prd-v16-epic4.json` |

---

## 10. Fora de escopo (aceite manual)

- Reprocessar PDF Flaviane completo no ambiente pós-deploy
- Alterar fórmula MPC além da passagem única já existente
