# PRD v12.1 — Corte Claude: acertos consolidados (sistema pronto para reuso)

| Campo | Valor |
| ----- | ----- |
| **Versão** | **12.1-acertos-consolidados** |
| **Data** | 13 de outubro de 2026 |
| **Status** | **Canônico de operação** — o que já funciona e deve ser preservado |
| **Base** | PRD v11.3 + PRD v12 Circuit Breaker + planos Dedup / Claude max / Ripado |
| **Projeto referência** | ELITON GOURMET × Cortecloud [#23574204](https://marceneiro.cortecloud.com.br/#/plans/23574204/view) |
| **Análise referência (pós-dedup)** | `019d7ebd-95c9-469c-8df9-82f70bfe7af0` |
| **Stack** | Vite + React + TypeScript + Supabase + LangGraph + Vercel AI SDK (OpenAI + Anthropic) |

> Este documento **não substitui** o PRD v11 (regras de marcenaria/BOM). Ele **congela os acertos** de engenharia, prompts, merge, breaker, modelos e evidências para reabrir o trabalho sem perder o que já está certo.

---

## 1. Visão em uma frase

O Corte Claude lê o PDF do projeto, monta a **lista de peças (BOM)** como a fábrica corta, **não vende por m² de fachada**, cruza com estoque, aplica margem MPC (ou ×N) e só libera `COMPLETED` se o **circuit breaker** passar — com Claude Opus no modo max e trava geométrica contra vistas duplicadas.

---

## 2. Regras de ouro (não negociar)

Estes acertos são **lei** do módulo. Qualquer evolução futura deve respeitá-los.

| # | Regra | Onde vive |
| - | ----- | --------- |
| R1 | **Proibido** precificar venda por m² de fachada (L×A × R$/m²) | `pricing.ts`, prompts Extrator/Auditor |
| R2 | Venda só por **BOM** + margem **MPC %** ou multiplicador **×N** | `pricing.ts`, `pipeline.ts` |
| R3 | m² só para **consumo de chapa** (área peça ÷ 5,0875 + perda) | bom-engine / pricing |
| R4 | Ferragens / conectores / parafusos **por unidade**, nunca por caixa | prompts + BOM |
| R5 | Caixa interna = **MDF Branco TX** (espessura da fábrica); frente = cor do projeto | `applyDualMaterialBoxDefaults`, breaker B4 |
| R6 | Mesmo móvel físico (planta + elevação + corte) = **um módulo** com nome canônico | prompts + `canonicalModuleName` / `moduleFamilyKey` |
| R7 | Quantidades entre lotes/vistas: **MAX**, nunca soma | `merge-extraction.ts` |
| R8 | Tetos geométricos **corrigem** (não só avisam): laterais / portas / tampos | `forceDeduplicateViewQuantities` |
| R9 | `COMPLETED` só se `evaluateCircuitBreaker().ok` | `circuit-breaker.ts` + status `NEEDS_REVIEW` |
| R10 | Modo **max**: extrator/auditor = **claude-opus-5-5**; **sem** fallback silencioso para gpt-4o | `llm-json.ts` `allowOpenAiFallback`, Edge `callLlm` |
| R11 | Ripado/brise do inventário **não pode sumir**; ripas individuais 18 mm | prompts + coverage fail-closed |
| R12 | `company_id` = empresa CRM existente (sem tabela `companies` duplicada) | schema / RLS |

---

## 3. Mapa do sistema (arquivos que importam)

### 3.1 Frontend (SPA)

| Papel | Path |
| ----- | ---- |
| Hub + Audit Workspace | `src/pages/orcamentos-ia/`, `src/components/orcamentos-ia/` |
| Pipeline cliente (orquestração) | `src/lib/orcamentos-ia/pipeline.ts` |
| Merge / dedup / coverage | `src/lib/orcamentos-ia/merge-extraction.ts` |
| Circuit breaker | `src/lib/orcamentos-ia/circuit-breaker.ts` |
| Precificação | `src/lib/orcamentos-ia/pricing.ts` (**fórmula congelada**) |
| BOM determinístico | `src/lib/orcamentos-ia/bom-engine/` |
| Schemas Zod | `src/lib/orcamentos-ia/schemas.ts` |
| Modelos | `src/lib/orcamentos-ia/openai-models.ts` |
| Prompts (fonte SPA) | `src/lib/orcamentos-ia/prompts/engineering-modular.ts` |
| Tokens UI Corte Claude | `src/lib/orcamentos-ia/ui-tokens.ts` (accent `#0066FF`) |
| Diretrizes Cursor | `.cursorrules` |

### 3.2 Edge (Supabase)

| Função | Papel |
| ------ | ----- |
| `orcamentos-ia-pipeline` | Inventário + extract + audit (visão/LLM) |
| `orcamentos-ia-chat` | Chat Iris / conferência |
| `orcamentos-ia-memory` | Memórias RAG (`ai_memories`) |
| `_shared/engineering-modular-prompts.ts` | Espelho dos prompts (manter sync com SPA) |
| `_shared/llm-json.ts` | Structured outputs Claude; gate de fallback |

### 3.3 Banco

| Artefato | Path / tabela |
| -------- | ------------- |
| Init módulo | `supabase/migrations/20260921_init_orcamentos_ia.sql` |
| BOM v11 | `20261006_orcamentos_ia_v11_bom.sql` |
| RLS company | `20261013_orcamentos_ia_rls_company.sql` |
| Status `NEEDS_REVIEW` | `20261014_orcamentos_ia_needs_review_status.sql` |
| Standards defaults | `20261014_orcamentos_ia_company_standards_defaults.sql` |
| Tabelas-chave | `quote_analyses`, `quote_environments`, `quote_modules`, `quote_materials`, `bom_items`, `system_preferences`, `ai_memories` |

Aplicar migrations: `pnpm migrate` (usa `DATABASE_URL`).

---

## 4. Fluxo operacional (como o dinheiro e o BOM nascem)

```text
PDF → páginas (imagem) → inventário (âncora)
      → extract Claude (lotes) → mergeExtractions (MAX + família)
      → forceDeduplicateViewQuantities
      → audit Claude (modo max) → forceDeduplicate de novo
      → dual material Branco TX → sanitize/schema
      → coverage + BOM gaps
      → estoque / mercado → bom-engine → persist
      → pricing MPC/×N → circuit breaker
      → COMPLETED | NEEDS_REVIEW
```

**Portão final de preço:** o clamp geométrico no **cliente** (`pipeline.ts`) depois do merge e depois da auditoria — a Edge pode ter merge próprio, mas o cliente é a trava que impede venda inflada por vistas.

---

## 5. Acertos de produto (marcenaria)

### 5.1 Tipologias e inventário

- Inventário âncora guia cobertura (Gourmet + Lavabo no ELITON).
- Nomes canônicos curtos: `Ilha`, `Bancada`, `Painel TV`, `Painel ripado`, `Cristaleira`, `Torre geladeira`, `Mesa de jantar`, `Bancada Lavabo`, `Aéreo`, `Armário`, `Gaveteiro`.
- Cor/material **não** vai no nome do módulo (`material_name` / descrição).
- Pedra, eletro, decoração, cadeiras de loja → `out_of_scope=true`.

### 5.2 Dual material (Default-with-Override) — paridade Cortecloud

Defaults alinhados ao plano **#23574204**:

- Caixa: MDF Branco TX `box_thickness_mm` (15)
- Frente: cor do projeto `front_thickness_mm` (18)
- Gaveta: kit fabril 5 peças
- Fita mista permitida (`mixed_edge_banding`)

### 5.3 Ripado / brise / colmeia

- Prompt exige ripas individuais (~30–50 mm × altura, 18 mm) + apoio — rejeita “painel liso genérico” no lugar do ripado.
- Gaveteiros/cristaleiras: colmeias, caixas de gaveta, tampos 18 mm quando visíveis.
- Coverage + breaker: omitir ripado do inventário → `NEEDS_REVIEW`.

### 5.4 Desmonte determinístico

- `bom-engine/` explode caixaria (base under_sides, tampo over_sides, nicho cavilha, etc.).
- Persistência em `bom_items` + materiais em `quote_materials`.
- Lista de corte pode ter linha `corte-peca` a R$ 0 **sem** disparar breaker (preço na chapa agregada).

---

## 6. Acertos de engenharia anti-inflação (dedup)

### 6.1 Chave de família

Em `merge-extraction.ts`:

- `canonicalModuleName(name)` — remove parênteses, sufixo ` - …`, tokens de cor/material/espessura; colapsa tipologias.
- `moduleFamilyKey(name)` — chave normalizada da família.
- `mergeEnvironment` agrupa por **família**, não pelo nome completo cru.
- `modulesMatchCoverage` / `buildCoverageReport` usam família (ex.: inventário `Ilha` cobre `Ilha (Noite)`).

### 6.2 Trava que corrige — `forceDeduplicateViewQuantities`

| Grupo | Teto | Ação |
| ----- | ---- | ---- |
| Laterais (caixa) | 2 (painel/mesa até 4) | Mantém peças de maior área×qty; demove resto + nota |
| Tampos | 2 | Idem |
| Portas/frentes | `max(4, ceil(L/300)+2)` | Idem |

Rodar: pós-`mergeExtractions`, pós-auditoria, porta final pré-coverage, e no caminho de reaudit.

### 6.3 Flags vs correção

- `validatePlausibleQuantities` → rede de segurança / breaker.
- Após clamp correto, flags tendem a **zero** (smoke Ilha: laterais=2, flags=[]).

### 6.4 Prompt “MÓDULO FÍSICO ÚNICO”

Extrator + Auditor (`engineering-modular.ts` **e** Edge sync):

- Um móvel físico = um módulo.
- Auditor: fundir família + renomear canônico; se passar do teto, **apagar** vistas duplicadas (não só avisar).

---

## 7. Circuit breaker (acertos v12)

Antes de `COMPLETED`, `evaluateCircuitBreaker` deve retornar `ok: true`. Senão → **`NEEDS_REVIEW`**.

| ID | Bloqueador |
| -- | ---------- |
| B1 | Item **cobrável** com `unit_price = 0` |
| B2 | Flags de fusão / tetos (laterais, tampos, portas) |
| B3 | `sale_price` ausente/zero ou MPC% / ×N ausente |
| B4 | Caixa fora de MDF Branco TX (salvo override) |
| B5 | `coverage.missing.length > 0` |

Persistir em `totals`: `sale_price`, `materials_cost`, `mpc_margin_pct`, `multiplier_n`, `circuit_breaker`, `pricing_modality`, `duplicate_view_flags`, `prompt_traces`.

---

## 8. Modelos e LLM (acertos Claude max)

| Uso | Modelo |
| --- | ------ |
| Extrator visão (max) | `claude-opus-5-5` |
| Auditor (max) | `claude-opus-5-5` |
| Embeddings RAG | `text-embedding-3-small` |

**Acertos de integração Anthropic:**

1. Structured outputs / schema JSON (não forçar `tool_choice` tipo tool no Opus 5.5 — gerava 500).
2. `allowOpenAiFallback: false` quando `mode === 'max'` e modelo Claude — **proibido** cair em gpt-4o em silêncio.
3. Cap de páginas na auditoria max (~12) para evitar 504.
4. Traces em `totals.prompt_traces` com `model: claude-opus-5-5`.

Referência de evidência: `docs/evidence/rea-llm-json-max-no-fallback.json`.

---

## 9. UI / UX (acertos)

- Rota `/orcamentos-ia` → hub Corte Claude → Audit Workspace após análise.
- Tailwind + Lucide; accent `#0066FF`; shaders/hub alinhados ao design Corte Claude.
- Leitor PDF ~200 DPI com overlay SVG; highlight sincronizado; raio-X 3D complementar.
- Banner de circuit breaker / NEEDS_REVIEW no Audit Workspace.
- Preços de mercado com confirmação quando não há estoque (`using_market_price`).

---

## 10. Deploy e ops (como republicar sem perder acertos)

```bash
# 1) Schema
pnpm migrate

# 2) Payloads Edge
node scripts/build-deploy-payload.mjs

# 3) Deploy funções do módulo
node scripts/deploy-edge-via-mcp.mjs orcamentos-ia-pipeline
node scripts/deploy-edge-via-mcp.mjs orcamentos-ia-chat
node scripts/deploy-edge-via-mcp.mjs orcamentos-ia-memory
```

**Cuidado de sintaxe nos prompts Edge:** template string do Auditor deve fechar com `` ` `` **sem** `}` extra depois do backtick (quebrava o bundler Deno).

Frontend (Netlify): build `pnpm build` / publish `dist` — migrations **não** rodam na Netlify.

---

## 11. Snapshot de aceite ELITON (estado congelado 2026-10-13)

### 11.1 Cortecloud #23574204 (referência visual)

| Item | Valor |
| ---- | ----- |
| Total central | R$ 25.066,22 |
| Materiais | R$ 22.652,56 |
| Mão de obra | R$ 2.413,66 |
| Chapas compra | Louro 3 · **Noite 14** · Branco 15mm 4 · Branco 6mm 1 |

URL: https://marceneiro.cortecloud.com.br/#/plans/23574204/view

### 11.2 GARBO pós-dedup — `019d7ebd-95c9-469c-8df9-82f70bfe7af0`

| Critério | Resultado |
| -------- | --------- |
| Status | **COMPLETED** |
| Circuit breaker | **ok**, 0 flags de vista |
| Venda / materiais | R$ **60.058,99** / R$ **33.032,44** (MPC 45%) |
| Ilha | **1** módulo canônico; laterais na árvore IA = **2** |
| Painel ripado | Presente (**14 ripas**) |
| Painel TV | Separado do ripado |
| Modelos | **7× claude-opus-5-5**, 0 gpt |
| Ambientes | Espaço Gourmet + Lavabo |

UI: `http://localhost:3000/orcamentos-ia?audit=019d7ebd-95c9-469c-8df9-82f70bfe7af0`

### 11.3 Evolução vs falha anterior `f22b5194`

| | f22b5194 (falha) | 019d7ebd (pós-dedup) |
| - | ---------------- | -------------------- |
| Status | NEEDS_REVIEW | COMPLETED |
| Venda | ~R$ 133.524 | ~R$ 60.059 |
| Causa principal | Ilhas/vistas somadas | Família + clamp |

### 11.4 Residuais conhecidos (registro, não “lista de bugfix” deste PRD)

Documentar para não redescobrir:

1. Venda ainda **acima** do total Cortecloud (~R$ 25k) e da faixa informal ~R$ 25–40k.
2. Duas mesas no Gourmet (`Mesa De Jantar Organica` + `Mesa De Jantar Belize Organica`) — família “mesa de jantar” ainda pode falhar quando o token `de` quebra regex antiga `mesa\s*jantar` (se ainda não colapsar no código vigente).
3. Contagem de “chapas compradas” Cortecloud ≠ soma de linhas BOM GARBO (métodos diferentes).
4. UI pode alertar cobertura em Bancada / Aéreo / Painel ripado mesmo com módulos presentes.

---

## 12. Catálogo de evidências (REA + JSON)

| Tema | Arquivo |
| ---- | ------- |
| Índice REA módulo | `docs/evidence/orcamentos-ia-rea-index.json` |
| Circuit breaker / compare Cortecloud | `docs/evidence/cortecloud-23574204-rea-compare.json` |
| Dedup vistas / família | `docs/evidence/rea-dedup-vistas-modulos.json` |
| Aceite dedup ELITON | `docs/evidence/eliton-gourmet-dedup-verify-019d7ebd.json` |
| Claude sem fallback gpt | `docs/evidence/rea-llm-json-max-no-fallback.json` |
| Ripado schemas | `docs/evidence/rea-orcamentos-ia-schemas-ripado-v12.json` |
| Verify Claude+ripado (pré-dedup) | `docs/evidence/eliton-gourmet-claude-verify-f22b5194.json` |
| Nosso × CalcmeX | `docs/evidence/nosso_resultado.json`, `resultado_calcmex.json` |
| HAR Cortecloud | `docs/evidence/captura_cortecloud-23574204-micro.har` |
| Standards REA | `docs/evidence/company-standards-rea.json` |

---

## 13. Checklist de preservação (antes de mudar código)

Antes de qualquer PR futuro no módulo:

- [ ] `pricing.ts` — não alterar fórmula de venda sem decisão explícita
- [ ] Manter R1–R12 deste documento
- [ ] Sync prompts SPA ↔ `supabase/functions/_shared/engineering-modular-prompts.ts`
- [ ] Redeploy `orcamentos-ia-pipeline` após mudar prompts/llm-json
- [ ] Smoke: `Ilha (Noite)` + `Ilha balcão` → 1 módulo, laterais ≤ 2, flags []
- [ ] Max: traces só `claude-opus-5-5` (zero gpt em `prompt_traces`)
- [ ] Breaker: cobrável R$0 / coverage missing / sem sale_price → `NEEDS_REVIEW`
- [ ] REA `analyze_javascript_application` em `src/lib/orcamentos-ia` se mexer em merge/pipeline
- [ ] Template Auditor sem `}` órfão após o backtick de fechamento

---

## 14. Referências cruzadas

| Documento | Uso |
| --------- | --- |
| `docs/prd_v11_sistema_orcamento_corte_claude.md` | Regras de marcenaria / BOM / schema |
| `docs/prd_v12_circuit_breaker_auditor_cortecloud.md` | Breaker + paridade 23574204 |
| `EXECUTION_PLAN.md` (Fases v11 / v12) | Checklist de épicos |
| `.cursorrules` | Diretrizes Cursor do módulo |
| `orcamento-com-IA/prd_sistema_orcamento_gpt-v8.md` | Histórico Planilha 4.0 |

---

## 15. Declaração de congelamento

Este PRD v12.1 registra o estado **operacional** do Corte Claude após:

1. BOM fabril sem m² de fachada (v11)  
2. Circuit breaker + dual Branco TX + coverage fail-closed (v12)  
3. Claude Opus 5.5 no max sem fallback gpt  
4. Ripado/colmeia nos prompts + evidência  
5. Deduplicação por família + clamp geométrico pós-LLM  

**Objetivo:** reabrir o módulo daqui a semanas/meses e saber exatamente o que já está certo, onde está no código, e qual evidência prova cada acerto.
