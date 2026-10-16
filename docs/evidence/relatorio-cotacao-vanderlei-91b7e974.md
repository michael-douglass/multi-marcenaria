# Relatório — Cotação Vanderlei (lote 1–40)

**Data:** 2026-10-16 (UTC)  
**Lead:** Vanderlei (`lead_id` 10982)  
**Pasta:** `45800786-fb09-4f5d-8512-30aefcc73156`  
**Análise:** `91b7e974-2e60-426a-9223-ed637a257a1f`  
**PDF:** Marcenaria.pdf (páginas 1–40 selecionadas)

---

## Resultado final

| Campo | Valor |
|--------|--------|
| Status | **COMPLETED** |
| Erro fatal | nenhum (`error_message` null) |
| Início | 2026-10-16 01:49:21 UTC |
| Fim | 2026-10-16 02:59:29 UTC |
| Duração total | **~70 min** |
| Páginas | 40 / 40 processadas |
| Ambientes gravados | 9 |
| Módulos | 43 persistidos / 75 encontrados na extração |
| Materiais (`quote_materials`) | 468 |
| Linhas BOM (`bom_items`) | 193 |
| Custo materiais | R$ 127.927,70 |
| Preço de venda | **R$ 232.595,77** |
| Modalidade | MPC 45% (não usa m² de fachada) |
| Circuit breaker | ok (`blockers: []`) |
| Cobertura (lote) | 96/96 expected · missing 0 · deferred 15 |

### Ambientes persistidos

| Ambiente | Módulos | Materiais |
|----------|---------|-----------|
| Quarto Suíte | 13 | 194 |
| Espaço Gourmet | 8 | 61 |
| Lavanderia | 4 | 57 |
| Sala de Estar | 4 | 47 |
| Closet | 3 | 37 |
| Home Office | 3 | 22 |
| Banheiro | 4 | 19 |
| Cozinha | 2 | 16 |
| Escritório | 2 | 15 |

---

## Desempenho por fase

| Fase | Observação |
|------|------------|
| Extração de módulos | ~55 min · ~1 pág/min · 3 sublotes · estável |
| Auditoria incremental | ~15 min · 9 ambientes (~1–2 min cada) |
| Preços + persistência | ~1 min |
| Cadeia async | `running` → `ready_for_pricing` sem travar |

**Veredito de performance:** lentidão esperada para PDF grande com visão + auditoria; sem falha de cadeia e sem necessidade de Retomar.

---

## Lote anterior (falhou — esperado)

| Análise | Status | Motivo |
|---------|--------|--------|
| `c20abe89-…` | FAILED | Sem `page_ranges` (corrigido depois com seletor de páginas no lead) |

---

## Avisos e qualidade (não bloquearam)

1. **Muitas páginas são render 3D sem cotas** — dimensões estimadas; revisada humana recomendada.
2. **45 itens com preço de mercado** (`market_price_flags`) — confirmar na UI de auditoria.
3. **15 módulos “deferred”** na cobertura — inventário antecipado vs. páginas ainda sem detalhe; `missing = 0`.
4. **112 peças sem cota** + algumas peças &gt; chapa 2750×1850 — flags de engenharia nos `warnings`.
5. **Miniatura page-001** — 400 no browser durante a conversão (arquivo ainda inexistente); Storage ok após conclusão (HEAD 200).

---

## Bugs encontrados e correções

### 1. `pageProgress is not defined` (UI lead) — já corrigido
- **Onde:** `LeadOrcamentosIaSection.tsx`
- **Efeito:** tela branca / AppErrorBoundary ao abrir o lead
- **Correção:** helpers `derivePageProgress` / `deriveModulesFound`

### 2. “Recomeçar do zero” não limpava `bom_items` — corrigido agora
- **Onde:** `pipeline.ts` (`resumeQuoteAnalysis`, ramo `fromScratch`)
- **Bug:** `delete().eq('analysis_id', …)` — coluna inexistente (a coluna real é `project_id`, com FK para `quote_analyses.id`)
- **Efeito:** ao recomeçar, BOM antigo podia sobrar misturado
- **Correção:** usar `clearBomItemsForProject(analysisId)` + comentário no `bom-persist.ts`

### 3. Miniatura do lead frágil — corrigido agora
- **Onde:** `LeadOrcamentosIaSection.tsx`
- **Bug:** sempre pedia `page-001.jpg` fixo, mesmo antes de converter
- **Correção:** usa o primeiro path de `totals.page_paths` do lote preferido

---

## Conclusão

A cotação **concluiu com sucesso**, precificação BOM/MPC válida, circuit breaker limpo e dados gravados (ambientes, módulos, materiais, BOM).  
Pontos de atenção para o usuário: revisar estimativas de cotas em renders, confirmar ~45 preços de mercado e validar peças grandes / sem cota na tela de auditoria.

**Próximo passo sugerido:** abrir o lote em `/orcamentos-ia?project=45800786-fb09-4f5d-8512-30aefcc73156` e fazer a auditoria humana dos ambientes com mais avisos (Quarto Suíte e Espaço Gourmet).
