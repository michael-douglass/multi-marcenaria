# Conferência de engenharia — DET_CLÍNICA

| Campo | Valor |
| ----- | ----- |
| Data | 16/10/2026 |
| Projeto GARBO | `DET_CLÍNICA` — pasta `e5f7a8ce-a143-47e5-902a-8dd5c5312d3f` |
| Análise GARBO | `8f507c97-dd86-44ad-858b-090ad4ce8ef2` — **COMPLETED** (lote 1–44) |
| Cortecloud | [#23496206 / editmodules](https://marceneiro.cortecloud.com.br/#/plans/23496206/editmodules) |
| Cliente CC | Renata Almeida (HelloMob) |
| Critério | **Quantitativos** (módulos, chapas, peças, ferragens). Preços **ignorados**. |

Evidências:

- [`resultado_cortecloud_23496206.json`](resultado_cortecloud_23496206.json)
- [`nosso_resultado_det_clinica_8f507c97.json`](nosso_resultado_det_clinica_8f507c97.json)
- [`parity-report-23496206.json`](parity-report-23496206.json)
- HAR: `docs/evidence/captura_cortecloud-23496206.har`

---

## 1. Veredito (uma frase)

**Baseline histórico (pré-E3):** paridade baixa — 34 módulos, 1 SKU branco, 0 corrediças vs 139 / 9 SKUs no Cortecloud.  
**Pós fromScratch E3–E7 (16/10):** **aprovado parcial** — paleta multi-SKU (14), corrediças 19, zero fantasmas; módulos **45 < 70** (ainda longe dos 139 HelloMob). Detalhe na §12.

---

## 2. Totais lado a lado (sem R$)

| Indicador | Cortecloud #23496206 | Nosso `8f507c97` | Delta (nós − CC) |
| --------- | -------------------: | ---------------: | ---------------: |
| Ambientes / furniture groups | **7** | **7** | 0 (nomes divergem) |
| Módulos (instâncias) | **139** | **34** in-scope (+2 OOS) | **−105** |
| Tipos de módulo HelloMob | **15** | (agregados / nomes livres) | — |
| Linhas de peças / qtd peças | 524 / **668** | BOM 187 linhas / soma qtd **~** (peças explode) | ordem diferente |
| SKUs de chapa | **9** | **1** (só Branco 15) | **−8 SKUs** |
| Chapas (un. estimadas) | **41** | **57** | +16 (mas cor errada) |
| Área chapas (m² peças) | **186,11** | (não consolidado por cor) | — |
| Corrediças (un.) | presentes (muitos balcões c/ gavetas) | **0** | FALTA |
| Dobradiças (un.) | presentes (várias portas) | **30** (“DOBRADIÇA RETA”) | provavelmente ABAIXO |

> Chapas CC: `consumption = ceil(m² das peças ÷ área da chapa)`. Os m² batem com a aba **Chapas** da UI (ex.: Branco 15 mm = 56,76 m²).

---

## 3. Ambientes

### Cortecloud (`furniture` dos clients)

| Ambiente CC | Peças (qtd) |
| ----------- | ----------: |
| Sala Luiz Fernando | alto (vários balcões/aéreos) |
| Sala Renata | alto |
| Esterilizaçao | médio |
| Cozinha | médio |
| Balcao recepçao | médio |
| Painel recepçao | painéis |
| Divisoria | laterais/tampos (vidro fora do MDF) |

### Nosso

| Ambiente | Módulos in-scope |
| -------- | ---------------: |
| Recepção | 7 |
| Sala Renata | 7 |
| Sala Luiz Fernando | 7 |
| Quarto Suíte | 7 |
| Cozinha | 2 |
| Sala de Esterilização | 3 |
| Banheiros | 1 |

### Leitura

- **Certo:** Recepção, Sala Renata, Sala Luiz Fernando, Cozinha, Esterilização aparecem nos dois lados.
- **Errado / suspeito:** nós criamos **Quarto Suíte** e **Banheiros** — no CC a “Divisoria” é furniture à parte (e o vidro foi corretamente OOS no nosso). Há risco de **renomear/agrupar errado** ambientes do PDF.
- **Falta explícita no mapeamento de nomes:** `Divisoria` (CC) ↔ nosso OOS de vidro + possível mistura em Quarto Suíte.

---

## 4. Módulos — o buraco principal

### Cortecloud — tipos HelloMob (instâncias)

| Tipo | Instâncias |
| ---- | ---------: |
| Lateral de tamponamento | 47 |
| Painel avulso | 30 |
| Tampo para tamponamento | 18 |
| Balcão gavetas iguais | 7 |
| Estrutura rodape avulsa | 7 |
| Balcão 2 portas | 10 |
| Aéreo 2 portas | 4 |
| Balcão para forno embutido | 3 |
| Balcão 1 porta | 4 |
| Nicho com prateleiras | 2 |
| Aéreo 3 portas / 1 porta / Balcão 3 portas / etc. | demais |
| **Total** | **139** |

### Nosso — 34 módulos (amostra por ambiente)

| Ambiente | Exemplos |
| -------- | -------- |
| Recepção | Balcao Recepcao, Balcao Com Led, Painel Em/Recepcao/Fontana Magma, Aéreo |
| Sala Renata | Armário, Mesa De Atendimento, Mesa de jantar, Painéis c/ espelho, Aéreo |
| Sala Luiz Fernando | Armário, Bancada, Mesa Em/Base, Tampo Granito Alaska, Aéreo, Painel |
| Cozinha | Aéreo, Bancada |
| Esterilização | Aéreo, Armário, Prateleira Aerea |
| Quarto Suíte | Painel TV/ripado/decorativo, Gaveteiro, Aéreo, Bancada… |
| Banheiros | Bancada |

### O que faltou vs HelloMob

- Fatiamento em **laterais / tampos de tamponamento / rodapés / nichos / fornos** (nós agregamos em “Armário”, “Bancada”, “Painel”).
- Contagem de **Balcão gavetas iguais** (origem natural das corrediças) — no nosso quase não há gaveteiro explícito (só 1 “Gaveteiro” no Quarto Suíte).
- **Aéreos e balcões por porta** (1/2/3 portas) viram nomes genéricos.

**Conclusão módulos:** a IA leu o PDF da clínica e **achatou** ~4× a granularidade HelloMob. Isso explica ferragens e chapas incompletas/erradas.

---

## 5. Chapas — deveria × foi

### Cortecloud (SKU × m² × un. estimada)

| SKU | m² | Un. (ceil) |
| --- | -: | ---------: |
| MDF Branco 15 Eucatex | 56,76 | 12 |
| MDF Salerno 15 Syncro Guararapes | 33,00 | 7 |
| MDF Carvalho Lir 15 Duratex | 23,78 | 5 |
| MDF Itapua 15 Duratex | 17,00 | 4 |
| MDF Cinza Fossil 15 Duratex | 15,37 | 4 |
| MDF Branco 6 Multimarcas | 14,07 | 3 |
| MDF Areia 15 Matt Guararapes | 13,55 | 3 |
| MDF Fontana Magma 15 Guararapes | 9,60 | 2 |
| MDF Lana 15 Conceito Duratex | 2,98 | 1 |
| **Total** | **186,11** | **41** |

### Nosso

| SKU | Un. BOM |
| --- | ------: |
| MDF Branco TX 15mm (**único**) | **57** |
| Demais cores / 6 mm | **0** |

### Status

| Tema | Status |
| ---- | ------ |
| Total de chapas na mesma ordem de grandeza | PARCIAL (57 vs 41) — **números enganosos** |
| Paleta multi-cor (Salerno, Carvalho, Fossil, Areia, Fontana, Lana, 6 mm) | **FALHA** — colapso total em Branco 15 |
| Menção Fontana Magma no nome do painel Recepção | Nome ok, **chapa não** |

Causa alinhada ao PRD v16 (paleta dinâmica): o BOM/persistência **não propagou** a `project_sheet_palette` — tudo virou Branco TX 15.

---

## 6. Ferragens e fitas

| Item | Cortecloud | Nosso | Status |
| ---- | ---------- | ----- | ------ |
| Corrediças (gavetas) | Implícitas em 7× “Balcão gavetas iguais” (+ peças de gaveta na lista) | **0** | **FALTA** |
| Dobradiças | Vários balcões/aéreos com 1–3 portas | 30× DOBRADIÇA RETA | ABAIXO / simplificado |
| Trilho | presente no catálogo/serviço | 1× TRILHO SUPERIOR/B | parcial |
| Fitas | 6 cores (Itapua, Branco, Areia, Salerno, Carvalho Lir, Cinza Fossil) 22 mm | não auditado SKU a SKU neste relatório | provável colapso junto das chapas |
| Vidraçaria / Metalon | fora do MDF | OOS corretos: Divisoria Vidro Canelado Op; Suporte Metalon Prateado | **CERTO** |

---

## 7. O que deu certo

1. Cotação **COMPLETED** em 44 páginas (não travou em schema após heal de vidro).
2. **Fora de escopo** de vidro/metalon tratado sem matar o lote.
3. Ambientes principais da clínica **reconhecidos** (Recepção, salas, cozinha, esterilização).
4. Alguns nomes próximos ao real (Balcão Recepção, Painel Fontana Magma, forno/mesa na Sala Luiz Fernando).
5. Extração Cortecloud via login `.env` + HAR estável (524 peças, m² chapas = UI).

---

## 8. O que deu errado

1. **Granularidade HelloMob** (139 → 34): tamponamentos, rodapés, nichos e gaveteiros sumiram ou foram fundidos.
2. **Paleta de chapas**: 9 SKUs → 1 (Branco 15); Salerno/Carvalho/Fossil/Areia/Fontana/Lana/6 mm zerados no BOM.
3. **Corrediças = 0** com projeto cheio de gavetas.
4. Ambiente **Quarto Suíte** provavelmente **fantasma** / mal mapeado vs Divisória/outras pranchas.
5. Contagem de dobradiças **baixa** frente ao número de portas HelloMob.

---

## 9. O que precisa aprimorar (backlog)

| Prioridade | Ação | Onde |
| ---------- | ---- | ---- |
| P0 | Impedir colapso de paleta: cada cor/espessura do PDF → SKU em `project_sheet_palette` e no BOM | `bom-consolidate` / pipeline / persist BOM |
| P0 | Detectar **gaveteiros** e emitir corrediças por unidade (nunca 0 quando há gavetas) | extrator + `hardware-alias` / bom-engine |
| P1 | Modularizar como HelloMob: laterais/tampos/rodapé/nicho separados quando o PDF mostrar | prompts + schema tipologia |
| P1 | Auditor de cobertura: se inventário CC/HelloMob tem N “Balcão gavetas”, nosso deve ter ≥ N fontes de corrediça | circuit breaker / coverage |
| P2 | Mapear ambientes PDF ↔ furniture CC (evitar “Quarto Suíte” em clínica) | inventário capa |
| P2 | Export Cockpit já ajuda a auditar BOM; incluir resumo de **SKU chapas × qtd** na Lista de compras | UI AuditWorkspace |

---

## 10. Mapa mental da diferença

```
PDF DET_CLÍNICA (44 pág)
        │
        ├─ Cortecloud HelloMob ──► 139 módulos atômicos ──► 668 peças ──► 9 SKUs / 186 m²
        │
        └─ Corte Claude (pós E3–E6 offline) ──► 31 módulos ──► 15 SKUs / corrediças 3 / sem fantasma
             (E5 ≥70 módulos → ainda falta fromScratch LLM na UI)
```

---

## 11. Anexos rápidos

- Audit GARBO: `/orcamentos-ia?audit=8f507c97-dd86-44ad-858b-090ad4ce8ef2`
- Script de captura: `scripts/capture-det-clinica-cortecloud.mjs`
- Nota: preços CC desatualizados — **não** usados como critério de sucesso nesta conferência.

---

## 12. Pós-épicos E3–E7 (16/10/2026)

### 12.1 Medições (antes → offline → after fromScratch)

| Indicador | Antes | Offline (E3–E6) | Após fromScratch LLM | Meta | Status |
| --------- | ----: | --------------: | -------------------: | ---- | ------ |
| SKUs chapa comerciais | 1 | **15** | **14** | ≥ 5 (ideal 9 CC) | **OK E3** |
| Corrediças (pares) | 0 | **3** | **19** (15 oculta 45 + 4 teles 25) | > 0 | **OK E4** |
| Módulos in-scope | 34 | 31 | **45** | ≥ 70 | **E5 falha** |
| Fantasmas Quarto/Banheiros | 2 | **0** | **0** | 0 | **OK E6** |
| Chapas agregadas (un.) | 57 Branco | 52 multi-SKU | **80** multi-SKU (Branco/Freijó/Fontana/Itapuã/Lana/Salerno/Areia…) | multi-cor | OK direção |

FromScratch executado via Edge async (`scripts/e7-fromscratch-det-clinica.mjs`, anti-504): início ~18:37 UTC, retoma pág. 35 após stall, consolidate 19:21 UTC. Status final: `COMPLETED`. Ambientes: Recepção, Sala Renata, Cozinha, Sala Esterilização, Sala Luiz Fernando.

### 12.2 Checklist visual / dados do Audit (Fase 4)

Fonte: `quote_analyses.totals` da análise `8f507c97…` (mesmo payload que pasta/BOM e lista de compras). UI browser exigiu login — inspeção pelo dado persistido.

| Item | Resultado |
| ---- | --------- |
| Tabela SKU × mm (paleta / chapas) | Várias cores além de Branco (Freijó, Fontana, Itapuã, Lana, Salerno, Areia, Bege Papiro…) |
| Lista de compras — CORREDIÇA | Presente: CORREDIÇA OCULTA 45 (15) + CORREDIÇA TELES 25 (4) |
| Ambientes | Clínicos reais; **sem** Quarto Suíte / Banheiros |
| Nomes atômicos | Parcial: painéis/gaveteiros nomeados; ainda faltam Lateral de tamponamento, Rodapé, Balcão gavetas canônicos HelloMob |
| Circuit breaker | `null` (status COMPLETED, sem blockers fantasma) |

### 12.3 Veredito final

**Aprovado parcial:** E3+E4+E6 OK após fromScratch; E5 ainda **45 < 70** módulos (gap HelloMob — CC tem 139). Páginas 37–42 tiveram skip/JSON inválido na cadeia; próximo ajuste: prompts/merge para tipos faltantes em `modelo-modulo-hellomob-23496206.md` e robustez do lote final do PDF.

Artefatos: `nosso_resultado_det_clinica_8f507c97.json`, `parity-report-23496206.json`, `e7-fromscratch-run.log`.
