# Relatório de engenharia — job `88d8bba4`

**PDF:** A4_ARQ_DET_QUARTO SUÍTE_CO_REV01.pdf (13 páginas)  
**Modelo IA:** Claude Sonnet  
**Duração:** 16:43 → 17:05 UTC (~22 min)  
**Resultado:** COMPLETED

| Indicador | Valor |
|-----------|-------|
| Custo materiais | R$ 13.854,84 |
| Preço venda (MPC 45%) | R$ 25.190,62 |
| Fórmula | Custo ÷ (1 − 45%) |
| Materiais | 126 linhas (111 estoque + 15 mercado) |
| BOM fabril | 39 itens |
| Cobertura inventário | 6/6 |
| Preço por m² fachada | **NÃO** (using_facade_sqm=false) |

---

## Mapa da fábrica (quem faz o quê)

```
PDF → imagens → inventário (IA) → leitura página a página (IA)
    → auditoria (IA) → self-heal (IA) → consolidar chapas (código)
    → precificar 1× (código + estoque) → gravar → COMPLETED
```

- **IA (visão):** enxerga o desenho e lista móveis/peças.  
- **Código (bom-engine / pricing):** desmonta, normaliza tipologias, busca preço, aplica margem.  
- **Edge Function** `orcamentos-ia-pipeline` v63: 1 página por request (anti-504).  
- **Browser (LangGraph):** orquestra, espera a cadeia, finaliza e precifica.

---

## Passo a passo real deste job

### 1) Upload e conversão (16:43:18–16:43:44) — ~26 s
O PDF vira 13 JPEGs no Storage. Sem IA ainda — só “fotografar” cada folha para a visão.

### 2) Inventário da capa (16:43:44–16:43:52) — IA Extrator
Lê capa/chave e promete 6 móveis no **Quarto Suíte**:
1. Guarda Roupas em MDF Arauco  
2. Divisória Amendoeira com nichos  
3. Painel TV Lino  
4. Cabeceira Amendoeira  
5. Aparador Amendoeira  
6. Mesa de Cabeceira Lino  

### 3) Cadeia async — Extrator visão página a página (16:43:59–17:01:36)
Uma chamada Claude por página (~1–1,5 min cada). Merge acumula BOM.  
Tipologias inválidas (ex. `divisoria`) são **sanitizadas** para o enum de 8 (fix pós-ec7735f1).

### 4) Auditoria adversarial (17:01:51–17:03:37) — IA Auditor
Revisa o ambiente Quarto Suíte: remove alucinações, completa BOM, reforça tipologias.

### 5) Self-heal cirúrgico (17:03:37–17:05:17) — IA + código
Faltava **Guarda Roupas**. 1 ciclo heal encaixou o Armário.  
`missing_after: []` · cobertura **6/6**.

### 6) Consolidação BOM (código, sem preço)
Paleta de chapas (sem colapsar Amendoeira/Lino em uma só cor de frente) + De-Para de ferragens:

- **23 chapas** em 8 SKUs (Branco 15/6, Amendoeira, Lino, Arauco…)  
- **11 linhas** de ferragem canônica (dobradiça, corrediça, minifix, cabideiro…)

### 7) Precificação única (17:05:18–17:05:22) — ~4 s
Ordem: estoque → De-Para → mercado (flag `using_market_price`).  
**Não** inventa R$ na IA. Modalidade **MPC 45%**:

`venda = 13854,84 ÷ (1 − 0,45) ≈ 25.190,62`

### 8) Persistência e COMPLETED (17:05:22)
Ambientes, módulos, materiais e `bom_items` gravados.

---

## Módulos orçados

| Módulo | Página | Custo aprox. | Materiais | Escopo |
|--------|--------|--------------|-----------|--------|
| Armário (Guarda-Roupas) | 9 | R$ 7.282 | 30 | sim |
| Aparador | 12 | R$ 1.622 | 17 | sim |
| Mesa de Cabeceira | 12 | R$ 1.297 | 19 | sim |
| Divisória Amendoeira c/ nichos | 11 | R$ 1.189 | 23 | sim |
| Cabeceira | 12 | R$ 905 | 16 | sim |
| Painel TV | 11 | R$ 924 | 10 | sim |
| Painel ripado | 11 | R$ 644 | 11 | sim (extra vs inventário) |
| Espelho | 13 | R$ 0 | 0 | fora (vidraçaria) |

---

## Maiores linhas de preço (amostra)

1. Chapa MDF Branco Eucatex 15 mm × 8 → R$ 2.240 (estoque)  
2. Corrediça oculta 45 × 16 → R$ 1.200  
3. Chapa MDF Arauco × 3 → R$ 1.192  
4. Chapa MDF Branco 6 mm × 4 → R$ 1.120  
5. Cabideiro oval × 16 → R$ 480  
6. Fita Amendoeira 22 mm (mercado) → R$ 305  

---

## Engenharia da IA (resumo)

| Agente | Papel | Onde |
|--------|-------|------|
| Extrator (Sonnet) | Lê prancha → JSON tipologias/peças/fitas | Edge, 1 pág/tick |
| Auditor (Opus/Sonnet) | Corrige alucinações, tipologias, BOM | Edge, pós-lote |
| Self-heal | Só módulos faltantes do inventário | Client + Edge |
| Desmontador | Determinístico (não é LLM) | bom-engine TS |
| Precificador | Estoque/mercado + MPC | pricing.ts |

**Travas:** sem R$ inventado pela IA · sem venda por m² de fachada · ferragens por unidade · tipologias mapeadas (`divisoria`→`nicho` etc.) · 1 precificação no fim.

---

## Alertas úteis à revisão humana

- Peças > chapa 2750×1850 (bases/tampos do armário e travessas da cabeceira) — conferir se a IA agrupoou.  
- Algumas cotas estimadas (ripas, profundidades).  
- Painel ripado entrou como extra além do inventário da capa.  
- 15 itens com preço de mercado (confirmar na UI).  

---

## Comparação com o job falho `ec7735f1`

| | ec7735f1 | 88d8bba4 |
|--|----------|----------|
| Tipologia `divisoria` | FAILED no Zod | Sanitizada / concluído |
| Guarda-Roupas | faltou | Self-heal recuperou |
| Preço | — | R$ 25.190,62 |
