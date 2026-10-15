# Sistema de Precificação com IA — Operação e Reparo

| Campo | Valor |
| ----- | ----- |
| Versão | 1.0 (2026-10-15) |
| Escopo | Módulo `/orcamentos-ia` (Corte Claude / BOM fabril) |
| PRD canônico | `docs/prd_v11_sistema_orcamento_corte_claude.md` |
| Plano técnico | `EXECUTION_PLAN.md` (Fase v11+) |
| Evidências recentes | `docs/evidence/diagnostico-falso-concluido-7af3758b.md`, `docs/evidence/inspecao-7af3758b-vs-camila-cortecloud.md` |

Este documento é o **manual operacional** do sistema real em produção (Vite + React + Supabase + Edge + LangGraph no cliente).  
Objetivo: explicar **como deve funcionar**, **o que não pode acontecer**, e **como diagnosticar e reparar** quando um lote trava, “conclui” errado ou gera BOM incompleto.

> O arquivo antigo `docs/sistemadeprecificacaocomia.md` é um rascunho genérico (Python/Excel/Gemini). **Não** é a fonte da verdade do código atual. Use este documento + o PRD v11.

---

## 1. Regra de ouro da precificação

1. **Proibido** vender por m² de fachada (L × A × R$/m²).
2. Venda só por **BOM** (lista de materiais) + margem **MPC %** ou multiplicador ×N.
3. **m²** existe só para **consumo de chapa**: área da peça ÷ 5,0875 + 15% perda.
4. Ferragens, conectores, parafusos e acessórios: **sempre unidade individual** (nunca caixa/pacote).
5. Fallback de preço: `inventory_items` → senão `market_reference_prices` + confirmação na UI (`using_market_price`).
6. Correções na auditoria com justificativa → embeddings → `ai_memories`.

Se o resultado “parece barato/caro” sem BOM completo, o problema é de **extração/merge**, não de fórmula de venda.

---

## 2. Arquitetura em uma frase

O PDF vira páginas → a Edge lê página a página e monta um JSON de ambientes/módulos → o navegador valida esse JSON, monta o BOM fabril e busca preços → grava ambientes, módulos e `bom_items` → mostra o Raio-X / auditoria.

```
Upload PDF
  → thumbs / pages (Storage)
  → Edge orcamentos-ia-pipeline (cadeia async: extract_page → audit → ready_for_pricing)
  → Cliente pipeline.ts (finalizeExtractionTree → BOM → preços → persist)
  → quote_environments / quote_modules / bom_items
  → UI Audit Workspace + Raio-X 3D
```

### Onde mora cada parte

| Peça | Caminho |
| ---- | ------- |
| Orquestração cliente | `src/lib/orcamentos-ia/pipeline.ts` |
| Schema Zod (árvore de extração) | `src/lib/orcamentos-ia/schemas.ts` |
| Merge / dedupe / placeholders | `src/lib/orcamentos-ia/merge-extraction.ts` |
| Rebalance de ambientes | `src/lib/orcamentos-ia/rebalance.ts` |
| Clamp geométrico / split ripado | `src/lib/orcamentos-ia/geometry-bounds.ts` |
| BOM fabril (HelloMob) | `src/lib/orcamentos-ia/bom-engine/` |
| Status / Storage / orphans | `src/lib/orcamentos-ia/storage.ts` |
| Jobs em 2º plano / Retomar | `src/contexts/OrcamentosIaBackgroundContext.tsx` |
| Edge (visão + cadeia) | `supabase/functions/orcamentos-ia-pipeline/` |
| Preferências construtivas | `system_preferences` |
| Itens do BOM | `bom_items` |

---

## 3. Máquina de estados (como deve ser)

### 3.1 `quote_analyses.status` (coluna, check constraint)

Valores válidos no banco:

- `PENDING`
- `PROCESSING`
- `CONVERTING_PAGES`
- `READING_LAYOUT`
- `EXTRACTING_MODULES`
- `FETCHING_MARKET_PRICES`
- `AUDITING_REVISION`
- `NEEDS_REVIEW`
- `COMPLETED`
- `FAILED`

### 3.2 `totals.pipeline_stage` (JSON fino, UI)

Etapas úteis:

| Stage | Significado |
| ----- | ----------- |
| `upload` / `converting_pages` | PDF → imagens |
| `extracting_batch` | Lendo páginas (cadeia Edge) |
| `auditing` | Auditoria de ambientes |
| `pricing_pending` | Extração pronta; falta precificar no cliente |
| `fetching_prices` | Buscando preços / montando BOM |
| `persisting` | Gravando no banco |
| `completed` / `failed` / `needs_review` | Terminal |

### 3.3 `totals.async_chain_status` (cadeia Edge)

| Valor | Significado |
| ----- | ----------- |
| `running` | Edge ainda lendo/auditando |
| `ready_for_pricing` | Pode precificar no cliente |
| `failed` | Cadeia parou com erro |

### 3.4 Checkpoint de ouro para “só falta preço”

Função: `isReadyForClientPricing(totals)` em `storage.ts`.

Condições:

1. `async_chain_status = ready_for_pricing` **ou** `pipeline_stage = pricing_pending`
2. Existe `totals.partial_extraction.environments` com pelo menos 1 ambiente

**Não** use só o toast da UI nem só `status = COMPLETED` para decidir se terminou.

---

## 4. Fluxo feliz (como deve ser feito)

1. Usuário sobe PDF (ou escolhe páginas do projeto).
2. Storage recebe PDF + páginas (`page-N.webp` / png).
3. Edge inicia cadeia: 1 página por tick (anti-504).
4. A cada página, acumula módulos em `partial_extraction`.
5. Ao fechar páginas + auditoria → `async_chain_status = ready_for_pricing`, `pipeline_stage = pricing_pending`.
6. Cliente chama `finalizeExtractionTree`:
   - rebalance de ambientes
   - merge / dedupe de vistas
   - anti-alucinação
   - clamp geométrico
   - sanitize (quantidades, edge_banding, placeholders)
   - parse Zod estrito
7. Cliente monta BOM (`bom-engine`), busca preços, persiste.
8. `status = COMPLETED` (ou `NEEDS_REVIEW` se circuit breaker).
9. Toast de “concluído” **somente** depois de confirmar no banco `COMPLETED` / `NEEDS_REVIEW`.

---

## 5. Falhas conhecidas e como reparar

### 5.1 Falso “concluído” (toast ×2 com UI ainda em “6 · BOM”)

**Sintoma:** aviso de lote concluído enquanto a etapa visual ainda é BOM/preço.

**Causa:** corrida Edge (`chain_tick` atrasado) × cliente precificando; toast sem confirmar DB.

**Como deve ficar:**

- Edge **não** reescreve cadeia se já está em `ready_for_pricing` / `pricing_pending` / `fetching_prices` / `persisting` / `completed` (skip `client_or_ready`).
- Toast de sucesso só após `confirmDbTerminal` ler `COMPLETED` ou `NEEDS_REVIEW`.

**Evidência:** `docs/evidence/diagnostico-falso-concluido-7af3758b.md`.

**Reparo operacional:**

1. Conferir no SQL o `status` real e `totals.pipeline_stage`.
2. Se já `COMPLETED` com `sale_price`, ignorar toast fantasma.
3. Se `pricing_pending` + `partial_extraction` cheio → **Retomar** (não recomeçar do zero).

---

### 5.2 Job FAILED com “Módulo sem materiais” após extrair dezenas de módulos

**Sintoma (exemplo DET_CLÍNICA `8f507c97`):**

```
Resposta do Extrator fora do schema esperado
(environments.2.modules.5: Módulo sem materiais…)
```

Ao mesmo tempo: `partial_extraction` com muitos módulos ricos (caixaria/ferragens/fitas).

**Causa raiz (2026-10-15):**

1. Módulo de **vidraçaria** (“Divisória em vidro canelado…”) veio com `out_of_scope: true` e arrays vazios (correto para BOM MDF).
2. O preprocess do Zod em `schemas.ts` via a palavra **“divisória”** e **forçava** `out_of_scope = false` (trava anti-descarte de marcenaria).
3. SuperRefine exigia materiais → **derrubava o orçamento inteiro**.
4. O índice `environments.N.modules.M` no erro é o da árvore **após** merge/sanitize — não necessariamente o mesmo módulo no JSON cru.

**Correção de código (obrigatória):**

1. Em `schemas.ts`: não forçar in-scope se for vidro/alumínio/vidraçaria/blindex; e marcar `out_of_scope = true` nesses casos.
2. Em `merge-extraction.ts`: hints de fora de escopo incluem vidraçaria / blindex / serralheria / maca (equipamento).
3. Em `pipeline.ts` (`finalizeExtractionTree`): se o único erro for “Módulo sem materiais”, chamar `markEmptyModulesOutOfScope` e tentar parse de novo — **não** matar o lote.

**Reparo operacional (SQL heal) quando o código novo já está no browser:**

```sql
-- Liberar para Retomar só a precificação (não reler 44 páginas)
UPDATE quote_analyses
SET
  error_message = NULL,
  status = 'EXTRACTING_MODULES',  -- valor válido do CHECK
  updated_at = now(),
  totals = totals || jsonb_build_object(
    'pipeline_stage', 'pricing_pending',
    'pipeline_detail', 'Extração pronta — Retomar para precificar.',
    'async_chain_status', 'ready_for_pricing',
    'thought_kind', 'price'
  )
WHERE id = '<analysis_id>'
  AND totals ? 'partial_extraction';
```

Depois: **recarregar a página** (pegar JS novo) → **Retomar**.

**Diagnóstico rápido:**

```sql
-- Módulos vazios in-scope no partial
WITH mods AS (
  SELECT e.env->>'name' AS env_name, m.mod->>'name' AS mod_name,
         coalesce((m.mod->>'out_of_scope')::boolean, false) AS oos,
         jsonb_array_length(coalesce(m.mod->'caixaria','[]'::jsonb)) AS caix,
         jsonb_array_length(coalesce(m.mod->'ferragens','[]'::jsonb)) AS ferr
  FROM quote_analyses qa
  CROSS JOIN LATERAL jsonb_array_elements(qa.totals->'partial_extraction'->'environments') AS e(env)
  CROSS JOIN LATERAL jsonb_array_elements(e.env->'modules') AS m(mod)
  WHERE qa.id = '<analysis_id>'
)
SELECT * FROM mods
WHERE oos = false AND caix = 0 AND ferr = 0;
```

Reproduzir parse local (dev): montar script que rode `rebalance → merge → sanitize → quoteExtractionSchema.safeParse` sobre `partial_extraction` (cuidado: alias `@/` e `import.meta.env` do Vite).

---

### 5.3 `error_message` fantasma bloqueando Retomar

**Sintoma:** PDF e páginas existem, mas o pipeline recusa continuar; mensagem antiga tipo “Upload interrompido”.

**Causa:** `isQuoteAnalysisCancelled` usa regex `/interrompid/i` e casa com “Upload interrompido” **mesmo** com PDF já salvo; e/ou `failOrphanPendingAnalysesWithoutPdf` marcou FAILED sem limpar depois.

**Reparo:**

```sql
UPDATE quote_analyses
SET error_message = NULL, updated_at = now()
WHERE id = '<analysis_id>'
  AND source_pdf_path IS NOT NULL;
```

Evitar gravar `error_message` com a palavra “interrompido” para falhas recuperáveis de upload.

---

### 5.4 Storage 400 em signed URL de thumbs/pages

**Sintoma:** console com POST signed URL 400; UI “Upload interrompido” em lote 1–44.

**Causa típica:** pedido de URL assinada **antes** do objeto existir no bucket (corrida thumbs × pages), ou path errado.

**Reparo:** não é “hackear” Storage — garantir ordem upload→sign; limpar `error_message` se o PDF/páginas já estão lá; Retomar.

Ruído conhecido no console (não é falha do lote): `THREE.Clock`, fake worker do PDF.js.

---

### 5.5 BOM completo na UI × poucos módulos vs Cortecloud/HelloMob

**Sintoma:** `COMPLETED` com preço, mas 3 módulos agregados vs ~33 HelloMob; zero corrediças/dobradiças.

**Causa:** fusão agressiva (`canonicalModuleName` / `moduleFamilyKey` / `collapseModulesByFamily`), tipologias não fatiadas, ferragens não extraídas.

**Não é reparo de “preço”** — é backlog de **paridade fabril** (PRD v15/v16, evidências Camila/Cortecloud).

Checklist:

1. Contar módulos em `quote_modules` vs inventário HelloMob.
2. Listar categorias em `bom_items` (corrediça, dobradiça, minifix…).
3. Comparar chapas (espessura/cor) com lista Camila / Cortecloud.
4. Abrir issues de split (ex.: Armário 1 coluna com cotas no nome **não** pode colapsar).

**Evidência:** `docs/evidence/inspecao-7af3758b-vs-camila-cortecloud.md`.

---

### 5.6 PENDING órfão sem PDF

`failOrphanPendingAnalysesWithoutPdf`: PENDING sem `source_pdf_path` há >5 min → FAILED.

**Reparo:** se o usuário ainda vai subir o PDF, criar análise nova; não “Retomar” fantasma sem arquivo.

---

## 6. Playbook do operador (não técnico)

| Situação na tela | O que fazer |
| ---------------- | ----------- |
| “Falhou” mas a mensagem fala de schema / módulo sem materiais, e já leu muitas páginas | Recarregar página → **Retomar** (não “Recomeçar do zero”) |
| Toast “concluído” mas ainda aparece etapa BOM | Esperar / conferir lista; se preço não apareceu, Retomar |
| “Upload interrompido” com PDF já na lista | Pedir limpeza de `error_message` + Retomar |
| Precisa refazer leitura do zero | **Recomeçar do zero** (apaga checkpoint de páginas) |
| Quer comparar fábrica | Usar lista Camila + link Cortecloud + contar módulos/ferragens |

---

## 7. Playbook do desenvolvedor

### 7.1 Ordem de investigação

1. Ler `quote_analyses`: `status`, `error_message`, `source_pdf_path`, `totals.pipeline_stage`, `totals.async_chain_status`, `totals.modules_found_count`.
2. Se há `partial_extraction` → o problema é **pós-extração** (Zod/sanitize/BOM), não leitura de página.
3. Localizar módulo do path do erro **depois** de merge (não confiar só no índice do JSON cru).
4. Rodar `quoteExtractionSchema.safeParse` na árvore sanitizada.
5. Só então olhar Edge logs / Storage.

### 7.2 O que nunca fazer

- Precificar por m² de fachada.
- Somar quantidades de vistas duplicadas (usar MAX / vista mais rica).
- Apagar `partial_extraction` para “limpar erro” se a meta é só precificar.
- Forçar `out_of_scope = false` em tudo que contém “divisória” (vidro ≠ MDF).
- Confiar em toast sem ler o banco.

### 7.3 Rede de segurança no `finalizeExtractionTree`

Ordem desejada:

1. sanitize + parse
2. retries (strip nulls, typology)
3. se só restam erros “Módulo sem materiais” → `markEmptyModulesOutOfScope` → parse de novo
4. só então `throw` com detalhe Zod (máx. 3 issues)

### 7.4 Fora de escopo (não entra no BOM MDF)

Exemplos que **devem** permanecer fora:

- Vidraçaria, blindex, alumínio estrutural, serralheria
- Pedra / granito / quartzo / porcelanato / gesso / drywall
- Decoração de loja (tapete, puff, pendente…)
- Equipamentos (ex.: maca clínica), mesmo com “MDF” na descrição se não for caixa de marcenaria

Marcenaria tipada (`balcao`, `painel`, `armario_*`, etc.) **não** deve ser descartada por engano.

---

## 8. Tabelas e campos críticos

| Artefato | Uso |
| -------- | --- |
| `quote_projects` | Projeto / PDF / páginas |
| `quote_analyses` | Job: status, totals JSONB, error_message, extraction_model |
| `totals.partial_extraction` | Árvore IA antes da precificação |
| `totals.async_chain_status` | Estado da Edge |
| `totals.pipeline_stage` / `pipeline_detail` | UI timeline |
| `quote_environments` / módulos | Árvore persistida pós-preço |
| `bom_items` | Linhas de compra/custo |
| `system_preferences` | Padrões construtivos da empresa |
| `inventory_items` / `market_reference_prices` | Preços |
| `ai_memories` | Aprendizado de correções |

`company_id` = ID da empresa CRM existente (sem tabela `companies` duplicada).

---

## 9. Casos de referência (outubro/2026)

| Análise | Projeto | Lição |
| ------- | ------- | ----- |
| `7af3758b-…` | A4 Quarto Suíte | Falso concluído ×2; COMPLETED R$ 27.466; paridade baixa vs Cortecloud #22168837 (3 vs 33 módulos) |
| `8f507c97-…` | DET_CLÍNICA (44 págs) | FAILED por divisória de **vidro** forçada in-scope; heal → `pricing_pending` + Retomar |
| `a23cfccd-…` (lote antigo) | DET pasta | `error_message` fantasma “Upload interrompido” com PDF+páginas já no Storage |

---

## 10. Checklist de aceite de um lote “saudável”

- [ ] `status` ∈ {`COMPLETED`, `NEEDS_REVIEW`}
- [ ] `pipeline_stage = completed` (ou needs_review)
- [ ] `error_message` nulo
- [ ] Ambientes/módulos persistidos (`quote_environments` count > 0)
- [ ] `bom_items` com chapas **e** ferragens plausíveis (dobradiça/corrediça quando o projeto tem porta/gaveta)
- [ ] Preço de venda derivado do BOM + MPC (não de m² fachada)
- [ ] Contagem de módulos na mesma ordem de grandeza do HelloMob/Cortecloud (paridade)
- [ ] Itens de vidraçaria/pedra listados fora de escopo, **sem** derrubar o job

---

## 11. Evolução / dívidas conscientes

1. **Paridade fabril P0:** split HelloMob (colunas, portas avulsas, laterais de tamponamento) — ver PRD v15/v16.
2. Ferragens estruturais (corrediça, dobradiça) não podem zerar em guarda-roupa/balcão.
3. Colapso de nomes (`Painel ripado 01/02`) deve preservar identidade quando cotas diferem; cotas no `moduleFamilyKey` já ajudam — monitorar falsos merges.
4. Endurecer `isQuoteAnalysisCancelled` para não casar “Upload interrompido” recuperável.
5. Manter Edge e cliente alinhados no skip `client_or_ready`.

---

## 12. Comandos úteis

```bash
# Typecheck / build (check principal do repo)
pnpm build

# Migrations
pnpm migrate

# Dev (porta 3000)
pnpm dev
```

Consultas SQL: preferir MCP Supabase / `execute_sql` no projeto configurado em `.env` (`VITE_SUPABASE_PROJECT_ID`).

---

## 13. Histórico deste documento

| Data | Mudança |
| ---- | ------- |
| 2026-10-15 | Criação: fluxo real, estados, playbooks, falha vidraçaria DET_CLÍNICA, falso concluído 7af3758b, heal SQL, regras BOM |

**Mantenedores:** time GARBO / módulo Orçamentos IA.  
Ao corrigir um novo modo de falha de precificação, **atualize a seção 5** com sintoma → causa → reparo → evidência.
