# Gaps de paridade — DET_CLÍNICA `8f507c97` × Cortecloud #23496206

| Campo | Valor |
| ----- | ----- |
| Data | 16/10/2026 |
| Análise GARBO | `8f507c97-dd86-44ad-858b-090ad4ce8ef2` |
| Cortecloud | `#23496206` |
| Modelo canônico | [`modelo-modulo-hellomob-23496206.md`](modelo-modulo-hellomob-23496206.md) |
| JSON machine | [`parity-report-23496206.json`](parity-report-23496206.json) |
| Critério | Quantitativos apenas (sem R$) |

---

## 1. Veredito E2

**Paridade baixa — gaps mensuráveis e priorizados.**  
Módulos: **34 / 139 (−105)**. Paleta: **1 / 9 SKUs**. Corrediças: **0** com **14** frentes de gaveta no HelloMob.

Este checklist é o **aceite** dos épicos E3–E7.

---

## 2. Totais

| Indicador | Cortecloud / HelloMob | Nosso | Delta |
| --------- | --------------------: | ----: | ----: |
| Módulos (instâncias) | 139 | 34 | **−105** |
| Tipos HelloMob | 15 | agregados (ver buckets) | — |
| SKUs chapa | 9 | **1** | **−8** |
| Chapas (un.) | 41 | 57 | +16 (enganoso) |
| Peças / linhas BOM | 668 qtd | 187 linhas BOM | ordem diferente |
| Corrediças | sinal forte (gavetas) | **0** | FALTA |
| Dobradiças | muitas portas | 30 | ABAIXO |

---

## 3. Ambientes

| Ambiente CC | No nosso? | Nota |
| ----------- | --------- | ---- |
| Balcao recepçao | Sim → Recepção | OK parcial (fundido com painel) |
| Painel recepçao | Sim → Recepção | OK parcial |
| Sala Renata | Sim | OK |
| Sala Luiz Fernando | Sim | OK |
| Cozinha | Sim | OK |
| Esterilizaçao | Sim → Sala de Esterilização | OK |
| Divisoria | Não como ambiente | Vidro OOS (correto) — laterais MDF da divisória podem ter sumido |

**Fantasmas nossos (CC não tem):**

- `Quarto Suíte` — **7 módulos** (suspeita alta)
- `Banheiros` — **1 módulo**

**Aceite E6:** zero ambientes fantasma clínicos óbvios; Divisória MDF mapeada ou justificada OOS.

---

## 4. Módulos por tipo HelloMob

Contagem CC = instâncias HelloMob. “Nosso bucket” agrupa nomes genéricos (pode superestimar cobertura).

| Tipo CC | CC n | Bucket nosso | Nosso n | Status |
| ------- | ---: | ------------ | ------: | ------ |
| Lateral de tamponamento | 47 | Lateral / tamponamento | 0 | **FALTA** |
| Painel avulso | 30 | Painel | ~10+ | ABAIXO / agregado |
| Tampo para tamponamento | 18 | Tampo tamponamento | ~1–2 | **FALTA** / quase zero |
| Balcão gavetas iguais | 7 | Gaveteiro / gavetas | 1 | **ABAIXO** |
| Estrutura rodape avulsa | 7 | Rodapé | 0 | **FALTA** |
| Vista horizontal | 3 | Vista | 0 | **FALTA** |
| Nicho com prateleiras | 2 | Nicho / prateleira | ~1 | ABAIXO |
| Aéreos (1/2/3 portas) | 6 | Aéreo | ~5 | PARCIAL |
| Balcões porta/coluna/forno | 19 | Balcão / armário / bancada | ~10+ | ABAIXO / agregado |

**Cobertura de buckets com ≥1 módulo nosso:** ~60% dos buckets (ainda longe do ideal fabril).

**Aceite E5:** módulos in-scope **≥ 70** **ou** cobertura de buckets HelloMob **≥ 60%** *com* laterais/tampos/rodapé **> 0**.

---

## 5. Chapas (SKU × un.)

| SKU CC | CC un. | CC m² | Nosso un. | Status |
| ------ | -----: | ----: | --------: | ------ |
| BRANCO 15mm | 12 | 56,76 | **57** | PRESENTE (excesso / mono-SKU) |
| SALERNO 15mm | 7 | 33,00 | **0** | **FALTA** |
| CARVALHO LIR 15mm | 5 | 23,78 | **0** | **FALTA** |
| ITAPUA 15mm | 4 | 17,00 | **0** | **FALTA** |
| CINZA FOSSIL 15mm | 4 | 15,37 | **0** | **FALTA** |
| BRANCO 6mm | 3 | 14,07 | **0** | **FALTA** |
| AREIA 15mm | 3 | 13,55 | **0** | **FALTA** |
| FONTANA 15mm | 2 | 9,60 | **0** | **FALTA** |
| LANA 15mm | 1 | 2,98 | **0** | **FALTA** |

**Aceite E3:** ≥ **5** SKUs distintos com qtd > 0 no BOM (meta 9).  
**Aceite E7:** ≥ **6** SKUs.

---

## 6. Ferragens

| Item | Sinal CC / HelloMob | Nosso | Status |
| ---- | ------------------- | ----: | ------ |
| Corrediças | 7× Balcão gavetas; **14** frentes gaveta na `lista` | **0** | **FALTA** |
| Dobradiças | Balcões/aéreos com 1–3 portas | 30 | ABAIXO |
| Puxador/perfil | prefs HelloMob | 6 | PARCIAL |
| Fitas multi-cor | 6 edge ids | não SKU-a-SKU aqui | provável colapso |

**Aceite E4:** `corredica` agregada **> 0** e coerente com gavetas (ordem de grandeza das 14 frentes / 7 módulos).  
**Aceite E6 (coverage):** inventário com gavetas + corrediças 0 → `NEEDS_REVIEW`.

---

## 7. OOS (já corretos)

| Módulo nosso | Status |
| ------------ | ------ |
| Divisoria Vidro Canelado Op | OOS OK |
| Suporte Metalon Prateado | OOS OK |

---

## 8. Checklist de aceite por épico (E3–E7)

| Épico | Gate numérico | Valor atual | Passa? |
| ----- | ------------- | ----------: | ------ |
| **E3** Paleta | SKUs chapa ≥ 5 | **15** (E7 offline) | **SIM** |
| **E4** Corrediças | corredica > 0 | **3** pares (E7 offline) | **SIM** |
| **E5** Módulos | in-scope ≥ 70 **ou** buckets ≥ 60% com laterais/tampos/rodapé > 0 | **31** (código merge OK; falta fromScratch LLM) | **parcial** |
| **E6** Coverage + fantasmas | regra gaveta→review; sem Quarto Suíte fantasma | phantoms **0**; breaker OK | **SIM** (offline) |
| **E7** Final | SKUs ≥ 6; corredica > 0; módulos ≥ 70 ou gap tipos < 40% | SKUs/corrediça/fantasma OK; módulos 31 | **parcial** — falta UI fromScratch |

---

## 9. Ordem de ataque (já no plano)

1. **E3** — paleta multi-SKU (senão o R$ mente)  
2. **E4** — gavetas → corrediças  
3. **E5** — modularização (laterais / tampos / rodapé / gaveteiros)  
4. **E6** — auditor + ambientes + UI SKUs  
5. **E7** — re-cotar e reabrir esta tabela  

---

## 10. Artefatos

- Atualizado: `docs/evidence/parity-report-23496206.json`  
- Este arquivo: `docs/evidence/parity-gaps-det-clinica-8f507c97.md`
