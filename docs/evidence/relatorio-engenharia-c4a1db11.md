# Relatório de engenharia — job `c4a1db11`

**PDF:** Caderno Executivo Pav Inferior - Casa Mesa_260828_175240.pdf (**49 páginas**, ~80 MB)  
**Modelo IA:** Claude Sonnet  
**Duração:** 17:31 → 18:40 UTC (~**69 min**)  
**Resultado:** **NEEDS_REVIEW** (circuit breaker) — preços calculados mesmo assim

| Indicador | Valor |
|-----------|-------|
| Custo materiais | R$ 11.939,98 |
| Preço venda (MPC 45%) | R$ 21.709,05 |
| Fórmula | Custo ÷ (1 − 45%) |
| Materiais | 176 linhas (155 estoque + 21 mercado) |
| BOM fabril | 64 itens |
| Chapas agregadas | 15 un. em 6 SKUs |
| Ferragens canônicas | 27 linhas |
| Módulos orçados | 14 persistidos (vários ambientes) |
| Preço por m² fachada | **NÃO** |
| Motivo revisão | Inventário pede **Churrasqueira** (Gourmet) — sistema tratou como fora de escopo (alvenaria/pedra), circuit breaker acionou |

---

## Mapa da fábrica

```
PDF 80MB → 49 JPEGs → inventário (IA) → Extrator 1 pág/tick (4 lotes × 15)
→ Auditoria por ambiente (7–8 envs) → Self-heal 3× → consolidar BOM (código)
→ precificar 1× → circuit breaker → NEEDS_REVIEW
```

---

## Passo a passo real (acompanhado)

### 1) Criação + upload (17:31–17:38)
- Job criado `PENDING` sem PDF (~6 min de upload).
- PDF gravado no Storage; status → `CONVERTING_PAGES`.

### 2) Conversão (17:38–~17:40)
- 49 páginas → JPEG no Storage (código, sem IA).

### 3) Inventário da capa (IA Extrator)
Inventário curto (âncora):
1. Gourmet → **Churrasqueira**
2. Home Office → **Mesa com Prateleiras**
3. Área de Serviço → **Armário Organizador**

### 4) Extração async — 49 páginas, lotes de 15 (17:40–18:26)
| Lote | Páginas | Marco observado | Módulos (aprox.) |
|------|---------|-----------------|------------------|
| 1/4 | 1–15 | Capas/renders — quase sem BOM | 0→5 |
| 2/4 | 16–30 | Lavanderia + plantas | →12 |
| 3/4 | 31–45 | Gourmet/Área Serviço/portas | →19 |
| 4/4 | 46–49 | Home Office + contra-capa | →23→17 pós-audit |

- Páginas **39 e 40** ignoradas (JSON/schema inválido) — cadeia **não morreu**.
- Muitas páginas só render/marmoraria/elétrica → warnings “sem marcenaria”.

### 5) Auditoria incremental (18:26–18:35) — IA Auditor
Ambientes auditados (ordem típica): Lavabo → Lavanderia → Área de Serviço → Home Office → Quarto Suíte → Gourmet → Área Externa → Acesso/Banheiro.  
Auditor removeu alucinações e realocou ambientes.

### 6) Self-heal 3 ciclos (18:35–18:38)
1. Cirúrgico: Churrasqueira + Armário Organizador  
2–3. Injeção forçada da Churrasqueira  
**Resultado:** Armário recuperado; Churrasqueira ficou `out_of_scope=true` (não é MDF) → ainda conta como “faltando” para o breaker.

### 7) Consolidação BOM (código)
- Chapas: Branco Eucatex 15 (7), Branco 6 mm (4), Branco TX 18, Louro Freijó, Mint Essencial, Compensado Naval  
- Ferragens: dobradiças, corrediças, minifix, trilhos, puxadores, vidros canelados, etc.

### 8) Precificação única (~18:39:52–18:40:03)
Estoque → De-Para → mercado. MPC 45%.  
`venda = 11939,98 ÷ 0,55 ≈ 21.709,05`

### 9) Circuit breaker → NEEDS_REVIEW
Cobertura inventário 2/3 (falta Churrasqueira como marcenaria). Preços **já gravados**.

---

## Módulos persistidos (custo)

| Ambiente | Módulo | Página | Custo | Escopo |
|----------|--------|--------|-------|--------|
| Área de Serviço | Armário | 37 | R$ 2.108 | sim |
| Área Externa | Caixa de Areia | 34 | R$ 1.456 | sim |
| Área de Serviço | Porta Depósito correr | 42 | R$ 1.283 | sim |
| Quarto Suíte | Armário | 37 | R$ 1.255 | sim |
| Área de Serviço | Porta Acesso giro | 42 | R$ 1.203 | sim |
| Quarto Suíte | Mesa c/ prateleiras | 47 | R$ 1.190 | sim |
| Home Office | Mesa c/ prateleiras | 18 | R$ 1.135 | sim |
| Lavanderia | Bancada | 16 | R$ 918 | sim |
| Lavanderia | Prateleira madeira | 16 | R$ 578 | sim |
| Área Externa | Porta de correr | 38 | R$ 567 | sim |
| Quarto Suíte | Divisória ripada | 42 | R$ 336 | sim |
| Gourmet | Churrasqueira | 18 | R$ 0 | **fora** |
| Área Externa | Pergolados | 34 | R$ 0 | **fora** |

---

## Engenharia da IA

| Agente | Papel | Neste job |
|--------|-------|-----------|
| Extrator (Sonnet) | Lê cada prancha → JSON | 49 ticks Edge, ~1–1,5 min/página |
| Auditor | Corrige ambientes/BOM | 7–8 ambientes |
| Self-heal | Completa faltantes do inventário | 3 tentativas |
| Desmontador | bom-engine TS (não LLM) | 64 bom_items |
| Precificador | Estoque/mercado + MPC | 176 linhas / ~8 s |

**Travas observadas:** sem R$ na IA · sem m² fachada · tipologias sanitizadas · skip de página 39/40 · 1 preço no fim · circuit breaker por inventário.

---

## Por que NEEDS_REVIEW (e não FAILED)

A **Churrasqueira** do inventário é **obra/pedra**, não marcenaria. O sistema:
1. Criou o módulo com `out_of_scope=true` (correto para MDF),
2. Mas o circuit breaker ainda exige cobertura do inventário → **NEEDS_REVIEW**.

Isso é revisão humana, não crash. Preço já está disponível para auditoria na UI.

---

## Alertas para revisão

- Inventário da capa era **curto** (3 itens) vs caderno enorme → muitos “extras”.  
- Várias cotas estimadas (17 peças sem cota).  
- 21 itens com preço de mercado.  
- Confirmar se Churrasqueira deve sair do inventário de marcenaria (só OOS) ou se há caixa MDF sob ela no projeto.
